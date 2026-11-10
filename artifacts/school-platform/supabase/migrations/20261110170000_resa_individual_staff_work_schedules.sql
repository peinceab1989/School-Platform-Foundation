-- Individual weekly staff schedules and date-specific exceptions.
-- Absence checkpoints now respect assigned workdays and approved leave.

create table if not exists public.staff_work_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  work_days smallint[] not null default array[1,2,3,4,5,6]::smallint[],
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_work_schedules_school_staff_unique unique (school_id, staff_id),
  constraint staff_work_schedules_days_valid check (
    cardinality(work_days) between 1 and 7
    and work_days <@ array[1,2,3,4,5,6,7]::smallint[]
  )
);

create table if not exists public.staff_work_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  exception_date date not null,
  exception_type text not null check (exception_type in ('off', 'working_day')),
  reason text not null check (length(trim(reason)) between 3 and 500),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_work_schedule_exceptions_unique unique (school_id, staff_id, exception_date)
);

create index if not exists staff_work_schedules_lookup_idx
  on public.staff_work_schedules (school_id, staff_id);
create index if not exists staff_work_schedule_exceptions_date_idx
  on public.staff_work_schedule_exceptions (school_id, exception_date, staff_id);

create table if not exists public.staff_work_schedule_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null,
  entity_type text not null check (entity_type in ('weekly_schedule', 'date_exception')),
  entity_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid references auth.users(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_work_schedule_audit_lookup_idx
  on public.staff_work_schedule_audit (school_id, staff_id, created_at desc);

alter table public.staff_work_schedules enable row level security;
alter table public.staff_work_schedule_exceptions enable row level security;
alter table public.staff_work_schedule_audit enable row level security;

drop policy if exists "School admins manage staff work schedules" on public.staff_work_schedules;
create policy "School admins manage staff work schedules"
  on public.staff_work_schedules for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "School admins manage staff work schedule exceptions" on public.staff_work_schedule_exceptions;
create policy "School admins manage staff work schedule exceptions"
  on public.staff_work_schedule_exceptions for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "School admins read staff work schedule audit" on public.staff_work_schedule_audit;
create policy "School admins read staff work schedule audit"
  on public.staff_work_schedule_audit for select to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]));

create or replace function public.audit_staff_work_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row jsonb;
  v_before jsonb;
  v_after jsonb;
  v_school_id uuid;
  v_staff_id uuid;
  v_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_before := v_row;
    v_after := null;
  else
    v_row := to_jsonb(new);
    v_before := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
    v_after := v_row;
  end if;

  v_school_id := (v_row ->> 'school_id')::uuid;
  v_staff_id := (v_row ->> 'staff_id')::uuid;
  v_entity_id := (v_row ->> 'id')::uuid;

  insert into public.staff_work_schedule_audit (
    school_id, staff_id, entity_type, entity_id, action,
    actor_user_id, before_data, after_data
  ) values (
    v_school_id, v_staff_id,
    case when tg_table_name = 'staff_work_schedules' then 'weekly_schedule' else 'date_exception' end,
    v_entity_id, tg_op, auth.uid(), v_before, v_after
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function public.audit_staff_work_schedule_change() from public, anon, authenticated;

drop trigger if exists audit_staff_work_schedule_changes on public.staff_work_schedules;
create trigger audit_staff_work_schedule_changes
  after insert or update or delete on public.staff_work_schedules
  for each row execute function public.audit_staff_work_schedule_change();

drop trigger if exists audit_staff_work_schedule_exception_changes on public.staff_work_schedule_exceptions;
create trigger audit_staff_work_schedule_exception_changes
  after insert or update or delete on public.staff_work_schedule_exceptions
  for each row execute function public.audit_staff_work_schedule_change();

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
begin
  if v_local_time < time '10:00' or v_local_time >= time '20:00' then
    return jsonb_build_object('skipped', true, 'reason', 'Outside the Lagos attendance reminder window', 'date', v_today);
  end if;

  for v_school in select s.id, s.name from public.schools s loop
    -- Student attendance continues on the existing Monday-Saturday checkpoint.
    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, student_id, alert_status)
    select v_school.id, v_today, 'student', st.id, 'pending'
    from public.students st
    join public.student_enrollments en on en.student_id = st.id and en.school_id = st.school_id and en.status = 'active'
    join public.academic_sessions ac on ac.id = en.academic_session_id and ac.school_id = en.school_id and ac.is_current
    left join public.student_attendance sa on sa.school_id = st.school_id and sa.student_id = st.id and sa.attendance_date = v_today
    where st.school_id = v_school.id and st.status = 'active'
      and extract(isodow from v_today) between 1 and 6
      and (sa.id is null or (sa.check_in_at is null and sa.status not in ('present', 'late')))
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_created := v_created + v_count;

    -- Resolve any pending staff alert if today's schedule/leave means the
    -- staff member is not expected to attend. This also clears stale alerts
    -- when an administrator changes a schedule after the checkpoint.
    update public.attendance_checkpoint_alerts a
    set alert_status = 'resolved',
        acknowledgement_note = coalesce(
          a.acknowledgement_note,
          'Automatically resolved: staff member is not scheduled to work or has approved leave.'
        )
    from public.staff sf
    where a.school_id = v_school.id
      and a.attendance_date = v_today
      and a.person_type = 'staff'
      and a.staff_id = sf.id
      and a.alert_status = 'pending'
      and (
        sf.status <> 'active'
        or exists (
          select 1 from public.staff_leave_requests lr
          where lr.school_id = sf.school_id and lr.staff_id = sf.id
            and lr.status = 'approved'
            and lr.start_date <= v_today and lr.end_date >= v_today
        )
        or case
          when exists (
            select 1 from public.staff_work_schedule_exceptions ex
            where ex.school_id = sf.school_id and ex.staff_id = sf.id
              and ex.exception_date = v_today and ex.exception_type = 'working_day'
          ) then false
          when exists (
            select 1 from public.staff_work_schedule_exceptions ex
            where ex.school_id = sf.school_id and ex.staff_id = sf.id
              and ex.exception_date = v_today and ex.exception_type = 'off'
          ) then true
          when exists (
            select 1 from public.staff_work_schedules ws
            where ws.school_id = sf.school_id and ws.staff_id = sf.id
          ) then not (
            extract(isodow from v_today)::smallint = any (
              select ws.work_days from public.staff_work_schedules ws
              where ws.school_id = sf.school_id and ws.staff_id = sf.id
            )
          )
          else extract(isodow from v_today) not between 1 and 6
        end
      );

    -- No schedule row means the legacy Monday-Saturday expectation.
    insert into public.attendance_checkpoint_alerts(school_id, attendance_date, person_type, staff_id, alert_status)
    select v_school.id, v_today, 'staff', sf.id, 'pending'
    from public.staff sf
    left join public.staff_attendance sa
      on sa.school_id = sf.school_id and sa.staff_id = sf.id and sa.attendance_date = v_today
    where sf.school_id = v_school.id and sf.status = 'active'
      and not exists (
        select 1 from public.staff_leave_requests lr
        where lr.school_id = sf.school_id and lr.staff_id = sf.id
          and lr.status = 'approved'
          and lr.start_date <= v_today and lr.end_date >= v_today
      )
      and case
        when exists (
          select 1 from public.staff_work_schedule_exceptions ex
          where ex.school_id = sf.school_id and ex.staff_id = sf.id
            and ex.exception_date = v_today and ex.exception_type = 'working_day'
        ) then true
        when exists (
          select 1 from public.staff_work_schedule_exceptions ex
          where ex.school_id = sf.school_id and ex.staff_id = sf.id
            and ex.exception_date = v_today and ex.exception_type = 'off'
        ) then false
        when exists (
          select 1 from public.staff_work_schedules ws
          where ws.school_id = sf.school_id and ws.staff_id = sf.id
        ) then extract(isodow from v_today)::smallint = any (
          select ws.work_days from public.staff_work_schedules ws
          where ws.school_id = sf.school_id and ws.staff_id = sf.id
        )
        else extract(isodow from v_today) between 1 and 6
      end
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
