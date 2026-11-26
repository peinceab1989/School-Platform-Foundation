-- RESA authoritative school calendar, operating hours and staff schedules.
-- Additive only. Existing academic terms, events and attendance history are preserved.
-- All date/time policy evaluation uses Africa/Lagos.

create table if not exists public.school_operating_schedules (
  school_id uuid primary key references public.schools(id) on delete cascade,
  timezone text not null default 'Africa/Lagos' check (timezone = 'Africa/Lagos'),
  weekly_schedule jsonb not null default '{}'::jsonb,
  configured_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint school_operating_schedule_is_object check (jsonb_typeof(weekly_schedule) = 'object')
);

create table if not exists public.school_calendar_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 160),
  description text,
  rule_type text not null check (rule_type in ('closure','special_opening','override')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  scopes text[] not null default array['all']::text[],
  attendance_allowed boolean not null default false,
  overrides_rule_id uuid references public.school_calendar_rules(id) on delete restrict,
  override_reason text,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_calendar_rule_window check (ends_at > starts_at),
  constraint school_calendar_rule_scopes check (
    cardinality(scopes) > 0 and scopes <@ array['all','attendance','timetable','examinations','staff','public_events','notifications']::text[]
  ),
  constraint school_calendar_override_requires_reason check (
    (rule_type = 'override' and overrides_rule_id is not null and length(trim(coalesce(override_reason,''))) >= 10)
    or (rule_type <> 'override' and overrides_rule_id is null and override_reason is null)
  )
);

create index if not exists school_calendar_rules_school_window_idx
  on public.school_calendar_rules (school_id, starts_at, ends_at)
  where status = 'active';
create index if not exists school_calendar_rules_override_idx
  on public.school_calendar_rules (overrides_rule_id)
  where overrides_rule_id is not null;

create table if not exists public.school_staff_work_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  effective_from date not null,
  effective_until date,
  status text not null default 'active' check (status in ('active','paused','ended')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_staff_schedule_hours check (ends_at > starts_at),
  constraint school_staff_schedule_dates check (effective_until is null or effective_until >= effective_from)
);

create index if not exists school_staff_work_schedules_staff_day_idx
  on public.school_staff_work_schedules (school_id, staff_user_id, day_of_week, effective_from)
  where status = 'active';

alter table public.school_operating_schedules enable row level security;
alter table public.school_calendar_rules enable row level security;
alter table public.school_staff_work_schedules enable row level security;

drop policy if exists "School members read operating schedule" on public.school_operating_schedules;
create policy "School members read operating schedule"
  on public.school_operating_schedules for select to authenticated
  using (public.has_school_role(school_id));

drop policy if exists "School admins manage operating schedule" on public.school_operating_schedules;
create policy "School admins manage operating schedule"
  on public.school_operating_schedules for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "School members read calendar rules" on public.school_calendar_rules;
create policy "School members read calendar rules"
  on public.school_calendar_rules for select to authenticated
  using (public.has_school_role(school_id));

drop policy if exists "School admins manage calendar rules" on public.school_calendar_rules;
create policy "School admins manage calendar rules"
  on public.school_calendar_rules for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "Staff read own work schedules" on public.school_staff_work_schedules;
create policy "Staff read own work schedules"
  on public.school_staff_work_schedules for select to authenticated
  using (
    public.has_school_role(school_id)
    and staff_user_id = (select auth.uid())
  );

drop policy if exists "School admins read staff work schedules" on public.school_staff_work_schedules;
create policy "School admins read staff work schedules"
  on public.school_staff_work_schedules for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "School admins manage staff work schedules" on public.school_staff_work_schedules;
create policy "School admins manage staff work schedules"
  on public.school_staff_work_schedules for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

grant select on public.school_operating_schedules, public.school_calendar_rules to authenticated;
grant insert, update, delete on public.school_operating_schedules, public.school_calendar_rules to authenticated;
grant select on public.school_staff_work_schedules to authenticated;
grant insert, update, delete on public.school_staff_work_schedules to authenticated;

create or replace function public.school_calendar_effective_status(
  p_school_id uuid,
  p_at timestamptz default now(),
  p_scope text default 'attendance'
)
returns table (
  status text,
  reason text,
  opens_at time,
  closes_at time,
  timezone text,
  attendance_allowed boolean,
  source_rule_id uuid
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_schedule public.school_operating_schedules%rowtype;
  v_day_key text;
  v_day jsonb;
  v_local_time time;
  v_closure public.school_calendar_rules%rowtype;
  v_opening public.school_calendar_rules%rowtype;
  v_override public.school_calendar_rules%rowtype;
begin
  if (auth.uid() is null and coalesce(auth.role(),'') <> 'service_role')
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
$function$;

revoke all on function public.school_calendar_effective_status(uuid,timestamptz,text) from public, anon;
grant execute on function public.school_calendar_effective_status(uuid,timestamptz,text) to authenticated;

comment on table public.school_operating_schedules is 'Authoritative weekly school operating schedule; no weekly days are assumed until configured by an administrator.';
comment on table public.school_calendar_rules is 'Dated closures, special openings and explicit audited overrides for school operating policy.';
comment on table public.school_staff_work_schedules is 'Effective-dated individual staff work schedules; visible to the staff member and school administrators.';

-- Attribute calendar writes to the authenticated administrator, not client-supplied ids.
create or replace function public.set_school_calendar_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    end if;
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$function$;

create or replace function public.set_school_calendar_schedule_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$function$;

drop trigger if exists school_calendar_rules_set_actor on public.school_calendar_rules;
create trigger school_calendar_rules_set_actor
  before insert or update on public.school_calendar_rules
  for each row execute function public.set_school_calendar_actor();

drop trigger if exists school_staff_work_schedules_set_actor on public.school_staff_work_schedules;
create trigger school_staff_work_schedules_set_actor
  before insert or update on public.school_staff_work_schedules
  for each row execute function public.set_school_calendar_actor();

drop trigger if exists school_operating_schedules_set_actor on public.school_operating_schedules;
create trigger school_operating_schedules_set_actor
  before insert or update on public.school_operating_schedules
  for each row execute function public.set_school_calendar_schedule_actor();

revoke all on function public.set_school_calendar_actor() from public, anon, authenticated;
revoke all on function public.set_school_calendar_schedule_actor() from public, anon, authenticated;

-- Reuse the existing immutable Engine Room audit trigger for calendar changes.
drop trigger if exists school_operating_schedules_nexus_audit on public.school_operating_schedules;
create trigger school_operating_schedules_nexus_audit
  after insert or update or delete on public.school_operating_schedules
  for each row execute function public.nexus_audit_row_change();

drop trigger if exists school_calendar_rules_nexus_audit on public.school_calendar_rules;
create trigger school_calendar_rules_nexus_audit
  after insert or update or delete on public.school_calendar_rules
  for each row execute function public.nexus_audit_row_change();

drop trigger if exists school_staff_work_schedules_nexus_audit on public.school_staff_work_schedules;
create trigger school_staff_work_schedules_nexus_audit
  after insert or update or delete on public.school_staff_work_schedules
  for each row execute function public.nexus_audit_row_change();

-- Block ordinary same-day student attendance on configured closures.
-- Historical corrections remain possible; privileged service-role writes are
-- trusted server operations and must independently validate the signed-in actor.
create or replace function public.enforce_school_calendar_student_attendance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_status record;
begin
  if new.attendance_date <> (now() at time zone 'Africa/Lagos')::date then
    return new;
  end if;

  select * into v_status
  from public.school_calendar_effective_status(new.school_id, now(), 'attendance');

  if v_status.status = 'unconfigured' then
    return new;
  end if;
  if v_status.status in ('closed','conflict') then
    raise exception 'Student attendance is unavailable: %', v_status.reason;
  end if;
  if v_status.status = 'special_activity' and not coalesce(v_status.attendance_allowed,false) then
    raise exception 'Attendance is not enabled for this special activity.';
  end if;
  return new;
end;
$function$;

drop trigger if exists student_attendance_school_calendar_guard on public.student_attendance;
create trigger student_attendance_school_calendar_guard
  before insert or update of attendance_date, school_id, status, check_in_at, check_in_event_id, biometric_event_id
  on public.student_attendance
  for each row execute function public.enforce_school_calendar_student_attendance();

revoke all on function public.enforce_school_calendar_student_attendance() from public, anon, authenticated;

-- Reflect the real database enforcement in Engine Room. The module may be
-- disabled before configuration, but cannot be switched off after a weekly
-- operating policy exists because that would silently reopen attendance.
create or replace function public.protect_configured_school_calendar_module()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.module_key = 'school_calendar'
    and old.is_enabled is true
    and new.is_enabled is false
    and exists (
      select 1 from public.school_operating_schedules s
      where s.configured_at is not null
    ) then
    raise exception 'The school calendar cannot be disabled while an operating schedule is configured. Remove or replace the schedule through the authorised calendar workflow first.';
  end if;
  return new;
end;
$function$;

drop trigger if exists protect_configured_school_calendar_module on public.nexus_module_controls;
create trigger protect_configured_school_calendar_module
  before update of is_enabled on public.nexus_module_controls
  for each row execute function public.protect_configured_school_calendar_module();

revoke all on function public.protect_configured_school_calendar_module() from public, anon, authenticated;

update public.nexus_module_controls
set settings = settings || jsonb_build_object(
  'enforcement_state','database_enforced',
  'health_state','unknown',
  'route','/school-calendar',
  'enforcement_note','RLS-protected calendar rules, explicit closure overrides, audit triggers and same-day student-attendance database guard.'
)
where module_key = 'school_calendar';
