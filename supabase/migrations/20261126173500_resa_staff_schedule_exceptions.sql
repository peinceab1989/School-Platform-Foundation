create table if not exists public.school_staff_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  exception_type text not null check (exception_type in ('leave','authorised_off_day','training','other')),
  status text not null default 'approved' check (status in ('pending','approved','rejected','cancelled')),
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_staff_schedule_exceptions_date_order check (ends_on >= starts_on),
  constraint school_staff_schedule_exceptions_approval_attribution check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists school_staff_schedule_exceptions_lookup_idx
  on public.school_staff_schedule_exceptions(school_id,staff_user_id,starts_on,ends_on)
  where status='approved';

alter table public.school_staff_schedule_exceptions enable row level security;
revoke all on public.school_staff_schedule_exceptions from anon;
grant select,insert,update,delete on public.school_staff_schedule_exceptions to authenticated,service_role;

drop policy if exists "School admins manage staff schedule exceptions" on public.school_staff_schedule_exceptions;
create policy "School admins manage staff schedule exceptions"
  on public.school_staff_schedule_exceptions for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "Staff read own schedule exceptions" on public.school_staff_schedule_exceptions;
create policy "Staff read own schedule exceptions"
  on public.school_staff_schedule_exceptions for select to authenticated
  using (public.has_school_role(school_id) and staff_user_id=auth.uid());

create or replace function public.validate_school_staff_schedule_exception()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not public.has_school_role(new.school_id, array['admin'::public.school_role]) then
    raise exception 'Only an active school administrator may manage staff schedule exceptions';
  end if;

  if not exists (
    select 1
    from public.school_memberships m
    join public.staff sf on sf.school_id=m.school_id and sf.user_id=m.user_id and sf.status='active'
    where m.school_id=new.school_id and m.user_id=new.staff_user_id
      and m.status='active' and m.role in ('admin'::public.school_role,'teacher'::public.school_role)
  ) then
    raise exception 'Staff schedule exception must reference an active staff membership';
  end if;

  if tg_op='INSERT' then
    new.created_by := auth.uid();
  end if;
  if new.status='approved' and (tg_op='INSERT' or old.status is distinct from 'approved') then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.validate_school_staff_schedule_exception() from public,anon,authenticated;

drop trigger if exists school_staff_schedule_exception_validate on public.school_staff_schedule_exceptions;
create trigger school_staff_schedule_exception_validate
  before insert or update on public.school_staff_schedule_exceptions
  for each row execute function public.validate_school_staff_schedule_exception();

drop trigger if exists school_staff_schedule_exceptions_nexus_audit on public.school_staff_schedule_exceptions;
create trigger school_staff_schedule_exceptions_nexus_audit
  after insert or update or delete on public.school_staff_schedule_exceptions
  for each row execute function public.nexus_audit_row_change();

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
  if p_school_id is null or p_staff_user_id is null then return false; end if;

  select * into v_schedule
  from public.school_operating_schedules s
  where s.school_id=p_school_id and s.configured_at is not null;
  if not found then return false; end if;

  v_local_date := (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos'))::date;
  v_local_time := (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos'))::time;
  v_day_key := extract(isodow from (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos')))::integer::text;
  v_day := v_schedule.weekly_schedule -> v_day_key;

  if exists (
    select 1 from public.school_staff_schedule_exceptions e
    where e.school_id=p_school_id and e.staff_user_id=p_staff_user_id
      and e.status='approved' and e.starts_on<=v_local_date and e.ends_on>=v_local_date
  ) then
    return false;
  end if;

  select r.* into v_closure
  from public.school_calendar_rules r
  where r.school_id=p_school_id and r.status='active' and r.rule_type='closure'
    and r.starts_at<=p_at and r.ends_at>p_at
    and (r.scopes @> array['all']::text[] or r.scopes @> array['staff']::text[])
  order by r.created_at desc limit 1;

  if found then
    select r.* into v_override
    from public.school_calendar_rules r
    where r.school_id=p_school_id and r.status='active'
      and r.rule_type='override' and r.overrides_rule_id=v_closure.id
      and r.starts_at<=p_at and r.ends_at>p_at
      and (r.scopes @> array['all']::text[] or r.scopes @> array['staff']::text[])
    order by r.created_at desc limit 1;
    if not found then return false; end if;
  else
    select r.* into v_opening
    from public.school_calendar_rules r
    where r.school_id=p_school_id and r.status='active' and r.rule_type='special_opening'
      and r.starts_at<=p_at and r.ends_at>p_at
      and (r.scopes @> array['all']::text[] or r.scopes @> array['staff']::text[])
    order by r.created_at desc limit 1;
    if found then
      if not coalesce(v_opening.attendance_allowed,false) then return false; end if;
    elsif not coalesce((v_day->>'enabled')::boolean,false) then
      return false;
    end if;
  end if;

  return exists (
    select 1
    from public.school_staff_work_schedules sws
    join public.staff sf on sf.school_id=sws.school_id and sf.user_id=sws.staff_user_id and sf.status='active'
    join public.school_memberships sm on sm.school_id=sws.school_id and sm.user_id=sws.staff_user_id
      and sm.status='active' and sm.role in ('admin'::public.school_role,'teacher'::public.school_role)
    where sws.school_id=p_school_id and sws.staff_user_id=p_staff_user_id
      and sws.day_of_week=extract(isodow from (p_at at time zone coalesce(v_schedule.timezone,'Africa/Lagos')))::smallint
      and sws.status='active' and sws.effective_from<=v_local_date
      and (sws.effective_until is null or sws.effective_until>=v_local_date)
      and sws.starts_at<=v_local_time and sws.ends_at>v_local_time
  );
end;
$function$;

revoke all on function public.school_staff_is_scheduled(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.school_staff_is_scheduled(uuid,uuid,timestamptz) to service_role;
