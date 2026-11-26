-- Include designated Customer Care staff in the existing repeated attendance
-- checkpoint messages. The scheduler cadence and acknowledgement workflow
-- remain unchanged; this adds an in-portal recipient audience only.

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
  v_person_name text;
  v_message text;
  v_count integer := 0;
  v_reminder_count integer := 0;
begin
  if extract(isodow from (now() at time zone 'Africa/Lagos')) = 7 then
    return jsonb_build_object('skipped', true, 'reason', 'Sunday is not a standard attendance day', 'date', v_today);
  end if;
  if v_local_time < time '10:00' or v_local_time >= time '20:00' then
    return jsonb_build_object('skipped', true, 'reason', 'Outside the Lagos attendance reminder window', 'date', v_today);
  end if;

  for v_school in select s.id, s.name from public.schools s loop
    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, student_id, alert_status)
    select v_school.id, v_today, 'student', st.id, 'pending'
    from public.students st
    join public.student_enrollments en on en.student_id = st.id and en.school_id = st.school_id and en.status = 'active'
    join public.academic_sessions ac on ac.id = en.academic_session_id and ac.school_id = en.school_id and ac.is_current
    left join public.student_attendance sa on sa.school_id = st.school_id and sa.student_id = st.id and sa.attendance_date = v_today
    where st.school_id = v_school.id and st.status = 'active'
      and (sa.id is null or (sa.check_in_at is null and sa.status not in ('present', 'late')))
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_created := v_created + v_count;

    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, staff_id, alert_status)
    select v_school.id, v_today, 'staff', sf.id, 'pending'
    from public.staff sf
    left join public.staff_attendance sa on sa.school_id = sf.school_id and sa.staff_id = sf.id and sa.attendance_date = v_today
    where sf.school_id = v_school.id and sf.status = 'active'
      and (sa.id is null or (sa.check_in_time is null and sa.status not in ('present', 'checked_out')))
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_created := v_created + v_count;

    select m.user_id into v_sender
    from public.school_memberships m
    where m.school_id = v_school.id and m.role = 'admin' and m.status = 'active'
    order by m.created_at limit 1;

    if v_sender is null then continue; end if;

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
      where id = v_alert.id returning reminder_count into v_reminder_count;

      v_message := 'RESA attendance alert: ' || coalesce(v_alert.person_name, 'School member') ||
        case when v_alert.person_reference is not null then ' (' || v_alert.person_reference || ')' else '' end ||
        ' has no recorded check-in by 10:00 AM Lagos time. Reminder #' || v_reminder_count ||
        '. Please investigate and acknowledge this alert in the Smart Attendance Centre.';

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
    end loop;
  end loop;

  return jsonb_build_object('date', v_today, 'created_alerts', v_created, 'reminders_sent', v_reminders);
end;
$function$;

revoke all on function public.resa_process_attendance_checkpoints() from public, anon, authenticated;
grant execute on function public.resa_process_attendance_checkpoints() to service_role;
