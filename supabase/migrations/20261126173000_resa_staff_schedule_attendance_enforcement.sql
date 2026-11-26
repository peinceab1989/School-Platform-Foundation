-- Align attendance reminders with the configured school calendar and each staff member's individual schedule.
CREATE OR REPLACE FUNCTION public.school_calendar_effective_status(p_school_id uuid, p_at timestamp with time zone DEFAULT now(), p_scope text DEFAULT 'attendance'::text)
 RETURNS TABLE(status text, reason text, opens_at time without time zone, closes_at time without time zone, timezone text, attendance_allowed boolean, source_rule_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_schedule public.school_operating_schedules%rowtype;
  v_day_key text;
  v_day jsonb;
  v_local_time time;
  v_closure public.school_calendar_rules%rowtype;
  v_opening public.school_calendar_rules%rowtype;
  v_override public.school_calendar_rules%rowtype;
begin
  if (auth.uid() is null and coalesce(auth.role(),'') <> 'service_role'
      and current_user not in ('postgres','supabase_admin','service_role'))
    or (auth.uid() is not null and not public.has_school_role(p_school_id)) then
    raise exception 'Access denied: active school membership or trusted service role required';
  end if;
  if p_scope not in ('attendance','timetable','examinations','staff','public_events','notifications','all') then
    raise exception 'Unsupported calendar scope';
  end if;

  select * into v_schedule
  from public.school_operating_schedules s
  where s.school_id = p_school_id;

  if not found or v_schedule.configured_at is null then
    return query select 'unconfigured'::text,
      'The school has not configured its operating schedule yet.'::text,
      null::time, null::time, 'Africa/Lagos'::text, false, null::uuid;
    return;
  end if;

  select r.* into v_closure
  from public.school_calendar_rules r
  where r.school_id = p_school_id and r.status = 'active'
    and r.rule_type = 'closure'
    and r.starts_at <= p_at and r.ends_at > p_at
    and (r.scopes @> array['all']::text[] or r.scopes @> array[p_scope]::text[])
  order by r.created_at desc
  limit 1;

  if found then
    select r.* into v_override
    from public.school_calendar_rules r
    where r.school_id = p_school_id and r.status = 'active'
      and r.rule_type = 'override' and r.overrides_rule_id = v_closure.id
      and r.starts_at <= p_at and r.ends_at > p_at
      and (r.scopes @> array['all']::text[] or r.scopes @> array[p_scope]::text[])
    order by r.created_at desc limit 1;
    if found then
      return query select 'open_override'::text,
        coalesce(v_override.override_reason, 'Explicit administrator override')::text,
        (p_at at time zone 'Africa/Lagos')::time,
        (v_override.ends_at at time zone 'Africa/Lagos')::time,
        'Africa/Lagos'::text, true, v_override.id;
      return;
    end if;

    select r.* into v_opening
    from public.school_calendar_rules r
    where r.school_id = p_school_id and r.status = 'active'
      and r.rule_type = 'special_opening'
      and r.starts_at <= p_at and r.ends_at > p_at
      and (r.scopes @> array['all']::text[] or r.scopes @> array[p_scope]::text[])
    order by r.created_at desc limit 1;
    if found then
      return query select 'conflict'::text,
        'An active closure overlaps a special opening. An administrator must explicitly resolve the conflict.'::text,
        null::time, null::time, 'Africa/Lagos'::text, false, v_closure.id;
      return;
    end if;

    return query select 'closed'::text, v_closure.title,
      null::time, null::time, 'Africa/Lagos'::text, false, v_closure.id;
    return;
  end if;

  select r.* into v_opening
  from public.school_calendar_rules r
  where r.school_id = p_school_id and r.status = 'active'
    and r.rule_type = 'special_opening'
    and r.starts_at <= p_at and r.ends_at > p_at
    and (r.scopes @> array['all']::text[] or r.scopes @> array[p_scope]::text[])
  order by r.created_at desc limit 1;
  if found then
    return query select 'special_activity'::text, v_opening.title,
      (v_opening.starts_at at time zone 'Africa/Lagos')::time,
      (v_opening.ends_at at time zone 'Africa/Lagos')::time,
      'Africa/Lagos'::text, v_opening.attendance_allowed, v_opening.id;
    return;
  end if;

  v_day_key := extract(isodow from (p_at at time zone 'Africa/Lagos'))::integer::text;
  v_day := v_schedule.weekly_schedule -> v_day_key;
  v_local_time := (p_at at time zone 'Africa/Lagos')::time;
  if coalesce((v_day ->> 'enabled')::boolean, false)
    and coalesce((v_day ->> 'opens_at')::time, '00:00'::time) <= v_local_time
    and coalesce((v_day ->> 'closes_at')::time, '00:00'::time) > v_local_time then
    return query select 'open'::text, 'Configured weekly operating hours'::text,
      (v_day ->> 'opens_at')::time, (v_day ->> 'closes_at')::time,
      'Africa/Lagos'::text, true, null::uuid;
  else
    return query select 'closed'::text, 'Outside configured weekly operating hours'::text,
      null::time, null::time, 'Africa/Lagos'::text, false, null::uuid;
  end if;
end;
$function$


create or replace function public.school_staff_is_scheduled(
  p_school_id uuid,
  p_staff_user_id uuid,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_schedule public.school_operating_schedules%rowtype;
  v_day_key text;
  v_day jsonb;
  v_local_date date;
  v_local_time time;
  v_closure public.school_calendar_rules%rowtype;
  v_override public.school_calendar_rules%rowtype;
  v_opening public.school_calendar_rules%rowtype;
begin
  if p_school_id is null or p_staff_user_id is null then
    return false;
  end if;

  select * into v_schedule
  from public.school_operating_schedules s
  where s.school_id = p_school_id and s.configured_at is not null;
  if not found then
    return false;
  end if;

  v_local_date := (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos'))::date;
  v_local_time := (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos'))::time;
  v_day_key := extract(isodow from (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos')))::integer::text;
  v_day := v_schedule.weekly_schedule -> v_day_key;

  select r.* into v_closure
  from public.school_calendar_rules r
  where r.school_id = p_school_id and r.status = 'active'
    and r.rule_type = 'closure'
    and r.starts_at <= p_at and r.ends_at > p_at
    and (r.scopes @> array['all']::text[] or r.scopes @> array['staff']::text[])
  order by r.created_at desc limit 1;

  if found then
    select r.* into v_override
    from public.school_calendar_rules r
    where r.school_id = p_school_id and r.status = 'active'
      and r.rule_type = 'override' and r.overrides_rule_id = v_closure.id
      and r.starts_at <= p_at and r.ends_at > p_at
      and (r.scopes @> array['all']::text[] or r.scopes @> array['staff']::text[])
    order by r.created_at desc limit 1;
    if not found then
      return false;
    end if;
  else
    select r.* into v_opening
    from public.school_calendar_rules r
    where r.school_id = p_school_id and r.status = 'active'
      and r.rule_type = 'special_opening'
      and r.starts_at <= p_at and r.ends_at > p_at
      and (r.scopes @> array['all']::text[] or r.scopes @> array['staff']::text[])
    order by r.created_at desc limit 1;

    if found then
      if not coalesce(v_opening.attendance_allowed,false) then
        return false;
      end if;
    elsif not coalesce((v_day ->> 'enabled')::boolean,false) then
      return false;
    end if;
  end if;

  return exists (
    select 1
    from public.school_staff_work_schedules sws
    join public.staff sf
      on sf.school_id = sws.school_id and sf.user_id = sws.staff_user_id and sf.status = 'active'
    join public.school_memberships sm
      on sm.school_id = sws.school_id and sm.user_id = sws.staff_user_id
      and sm.status = 'active' and sm.role in ('admin'::public.school_role,'teacher'::public.school_role)
    where sws.school_id = p_school_id
      and sws.staff_user_id = p_staff_user_id
      and sws.day_of_week = extract(isodow from (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos')))::smallint
      and sws.status = 'active'
      and sws.effective_from <= v_local_date
      and (sws.effective_until is null or sws.effective_until >= v_local_date)
      and sws.starts_at <= v_local_time
      and sws.ends_at > v_local_time
  );
end;
$function$;

revoke all on function public.school_staff_is_scheduled(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.school_staff_is_scheduled(uuid,uuid,timestamptz) to service_role;


CREATE OR REPLACE FUNCTION public.resa_process_attendance_checkpoints()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_attendance_allowed boolean := false;
begin
  -- Student reminders begin at 10:00; staff reminders follow each individual schedule.

  for v_school in
    select s.id, s.name, coalesce(ss.notify_parents_on_student_absence, false) as parent_absence_alerts_enabled
    from public.schools s
    left join public.school_settings ss on ss.school_id = s.id
  loop
    select coalesce((select cs.attendance_allowed
      from public.school_calendar_effective_status(v_school.id, now(), 'attendance') cs limit 1), false)
    into v_attendance_allowed;
    if not v_attendance_allowed then
      continue;
    end if;

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
      and v_local_time >= time '10:00'
      and (sa.id is null or (sa.check_in_at is null and sa.status not in ('present', 'late')))
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_created := v_created + v_count;

    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, staff_id, alert_status)
    select distinct v_school.id, v_today, 'staff', sf.id, 'pending'
    from public.staff sf
    left join public.staff_attendance sa
      on sa.school_id = sf.school_id and sa.staff_id = sf.id and sa.attendance_date = v_today
    where sf.school_id = v_school.id and sf.status = 'active' and sf.user_id is not null
      and public.school_staff_is_scheduled(v_school.id, sf.user_id, now())
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
        and (a.person_type <> 'staff' or (sf.user_id is not null and public.school_staff_is_scheduled(v_school.id, sf.user_id, now())))
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
          'Student absence',
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
        ' has no recorded check-in by ' || to_char(v_local_time, 'HH12:MI AM') || ' Lagos time. Reminder #' || v_reminder_count ||
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
$function$

