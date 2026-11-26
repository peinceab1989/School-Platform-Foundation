-- Administrator-controlled parent absence alerts.
-- Existing administrator/HR attendance checkpoint alerts remain unchanged.
alter table public.school_settings
  add column if not exists notify_parents_on_student_absence boolean not null default false,
  add column if not exists attendance_parent_absence_notifications_updated_by uuid references auth.users(id) on delete set null,
  add column if not exists attendance_parent_absence_notifications_updated_at timestamptz;

alter table public.biometric_parent_notifications
  add column if not exists attendance_checkpoint_alert_id uuid;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'biometric_parent_notifications_checkpoint_alert_fk'
      and conrelid = 'public.biometric_parent_notifications'::regclass
  ) then
    alter table public.biometric_parent_notifications
      add constraint biometric_parent_notifications_checkpoint_alert_fk
      foreign key (attendance_checkpoint_alert_id)
      references public.attendance_checkpoint_alerts(id)
      on delete restrict;
  end if;
end;
$constraint$;

create unique index if not exists biometric_parent_notifications_checkpoint_guardian_uidx
  on public.biometric_parent_notifications(attendance_checkpoint_alert_id, parent_guardian_id)
  where attendance_checkpoint_alert_id is not null;

create or replace function public.resa_process_attendance_checkpoints()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_local_time time := (now() at time zone 'Africa/Lagos')::time;
  v_school record;
  v_alert record;
  v_sender uuid;
  v_reminders integer := 0;
  v_created integer := 0;
  v_message text;
  v_count integer := 0;
  v_reminder_count integer := 0;
  v_parent_notifications integer := 0;
begin
  if extract(isodow from (now() at time zone 'Africa/Lagos')) = 7 then
    return jsonb_build_object('skipped', true, 'reason', 'Sunday is not a standard attendance day', 'date', v_today);
  end if;
  if v_local_time < time '10:00' or v_local_time >= time '20:00' then
    return jsonb_build_object('skipped', true, 'reason', 'Outside the Lagos attendance reminder window', 'date', v_today);
  end if;

  for v_school in
    select s.id, s.name, coalesce(ss.notify_parents_on_student_absence, false) as parent_absence_alerts_enabled
    from public.schools s
    left join public.school_settings ss on ss.school_id = s.id
  loop
    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, student_id, alert_status)
    select v_school.id, v_today, 'student', st.id, 'pending'
    from public.students st
    join public.student_enrollments en
      on en.student_id = st.id and en.school_id = st.school_id and en.status = 'active'
    join public.academic_sessions ac
      on ac.id = en.academic_session_id and ac.school_id = en.school_id and ac.is_current
    left join public.student_attendance sa
      on sa.school_id = st.school_id and sa.student_id = st.id and sa.attendance_date = v_today
    where st.school_id = v_school.id and st.status = 'active'
      and (sa.id is null or (sa.check_in_at is null and sa.status not in ('present', 'late')))
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_created := v_created + v_count;

    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, staff_id, alert_status)
    select v_school.id, v_today, 'staff', sf.id, 'pending'
    from public.staff sf
    left join public.staff_attendance sa
      on sa.school_id = sf.school_id and sa.staff_id = sf.id and sa.attendance_date = v_today
    where sf.school_id = v_school.id and sf.status = 'active'
      and (sa.id is null or (sa.check_in_time is null and sa.status not in ('present', 'checked_out')))
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_created := v_created + v_count;

    select m.user_id into v_sender
    from public.school_memberships m
    where m.school_id = v_school.id and m.role = 'admin' and m.status = 'active'
    order by m.created_at
    limit 1;

    for v_alert in
      select a.*,
        case when a.person_type = 'student' then concat_ws(' ', p.first_name, p.middle_name, p.last_name)
             else concat_ws(' ', sp.first_name, sp.middle_name, sp.last_name) end as person_name,
        case when a.person_type = 'student' then st.admission_number else sf.staff_number end as person_reference
      from public.attendance_checkpoint_alerts a
      left join public.students st on st.id = a.student_id and st.school_id = a.school_id
      left join public.people p on p.id = st.person_id and p.school_id = st.school_id
      left join public.staff sf on sf.id = a.staff_id and sf.school_id = a.school_id
      left join public.people sp on sp.id = sf.person_id and sp.school_id = sf.school_id
      where a.school_id = v_school.id and a.attendance_date = v_today and a.alert_status = 'pending'
        and (a.last_reminded_at is null or a.last_reminded_at <= now() - interval '30 minutes')
      order by a.first_detected_at
      for update of a skip locked
    loop
      update public.attendance_checkpoint_alerts
      set last_reminded_at = now(), reminder_count = reminder_count + 1
      where id = v_alert.id
      returning reminder_count into v_reminder_count;

      -- Parent absence alerts are a one-time, idempotent in-app notification.
      -- The recipient must be the verified active portal account for a guardian
      -- who is actively linked to this exact student in this school.
      if v_alert.person_type = 'student' and v_school.parent_absence_alerts_enabled then
        insert into public.biometric_parent_notifications (
          school_id,
          student_id,
          biometric_event_id,
          parent_guardian_id,
          attendance_checkpoint_alert_id,
          channel,
          notification_type,
          message,
          status,
          sent_at
        )
        select distinct
          v_school.id,
          v_alert.student_id,
          null,
          pga.parent_guardian_id,
          v_alert.id,
          'in_app',
          'attendance',
          'RESA attendance alert: ' || coalesce(v_alert.person_name, 'Your child') ||
            ' has not been recorded as present at school by ' ||
            to_char(v_local_time, 'HH12:MI AM') || ' Lagos time on ' ||
            to_char(v_today, 'DD Mon YYYY') ||
            '. Please contact the school if this is unexpected.',
          'delivered',
          now()
        from public.parent_student_portal_access pga
        join public.parents_guardians pg
          on pg.id = pga.parent_guardian_id
         and pg.school_id = pga.school_id
         and pg.portal_enabled = true
        join public.parent_portal_accounts ppa
          on ppa.parent_guardian_id = pg.id
         and ppa.school_id = pg.school_id
         and ppa.is_active = true
        join public.people parent_person
          on parent_person.id = pg.person_id
         and parent_person.school_id = pg.school_id
         and parent_person.user_id = ppa.user_id
        join public.school_memberships membership
          on membership.school_id = pg.school_id
         and membership.user_id = ppa.user_id
         and membership.role = 'parent'::public.school_role
         and membership.status = 'active'::public.membership_status
        where pga.school_id = v_school.id
          and pga.student_id = v_alert.student_id
          and pga.is_active = true
        on conflict (attendance_checkpoint_alert_id, parent_guardian_id)
          where attendance_checkpoint_alert_id is not null
          do nothing;

        get diagnostics v_count = row_count;
        v_parent_notifications := v_parent_notifications + v_count;
      end if;

      v_message := 'RESA attendance alert: ' || coalesce(v_alert.person_name, 'School member') ||
        case when v_alert.person_reference is not null then ' (' || v_alert.person_reference || ')' else '' end ||
        ' has no recorded check-in by 10:00 AM Lagos time. Reminder #' || v_reminder_count ||
        '. Please investigate and acknowledge this alert in the Smart Attendance Centre.';

      if v_sender is not null then
        insert into public.school_messages(school_id, sender_id, recipient_id, subject, message)
        select v_school.id, v_sender, rec.user_id, 'Attendance checkpoint alert', v_message
        from (
          select m.user_id
          from public.school_memberships m
          where m.school_id = v_school.id and m.role = 'admin' and m.status = 'active'
          union
          select sf.user_id
          from public.staff sf
          where sf.school_id = v_school.id and sf.status = 'active' and sf.user_id is not null
            and lower(trim(coalesce(sf.department, ''))) in (
              'hr', 'human resources', 'human resource', 'human resources department',
              'customer care', 'customer service', 'customer support', 'customer relations'
            )
        ) rec
        where rec.user_id is not null;
        v_reminders := v_reminders + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'date', v_today,
    'created_alerts', v_created,
    'reminders_sent', v_reminders,
    'parent_notifications_sent', v_parent_notifications
  );
end;
$function$;

revoke all on function public.resa_process_attendance_checkpoints() from public, anon, authenticated;
grant execute on function public.resa_process_attendance_checkpoints() to service_role;
