create schema if not exists private;

create table if not exists public.resa_customer_care_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  chief_admin_user_id uuid not null references auth.users(id) on delete restrict,
  availability_enabled boolean not null default true,
  availability_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  availability_start time not null default time '08:00',
  availability_end time not null default time '16:00',
  timezone text not null default 'Africa/Lagos',
  website_popup_enabled boolean not null default true,
  soft_sound_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint resa_customer_care_days_valid check (
    cardinality(availability_days) between 1 and 7
    and availability_days <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint resa_customer_care_time_valid check (availability_start < availability_end)
);

create table if not exists public.resa_customer_care_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  duty_key text not null check (duty_key in ('all','general','fees','admissions','cbt','results','attendance','technical')),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  enabled boolean not null default true,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique (school_id, duty_key)
);

alter table public.resa_chat_conversations
  add column if not exists customer_care_duty text not null default 'general';

alter table public.resa_chat_conversations
  drop constraint if exists resa_chat_conversations_customer_care_duty_check;
alter table public.resa_chat_conversations
  add constraint resa_chat_conversations_customer_care_duty_check
  check (customer_care_duty in ('general','fees','admissions','cbt','results','attendance','technical'));

create or replace function private.is_resa_chief_admin(p_school_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.resa_customer_care_settings s
    join public.school_memberships m
      on m.school_id = s.school_id
     and m.user_id = s.chief_admin_user_id
     and m.status = 'active'::public.membership_status
     and m.role = 'admin'::public.school_role
    where s.school_id = p_school_id
      and s.chief_admin_user_id = p_user_id
  );
$function$;

revoke all on function private.is_resa_chief_admin(uuid, uuid) from public, anon;
grant execute on function private.is_resa_chief_admin(uuid, uuid) to authenticated;

alter table public.resa_customer_care_settings enable row level security;
alter table public.resa_customer_care_assignments enable row level security;

drop policy if exists "RESA admins can read Customer Care settings" on public.resa_customer_care_settings;
create policy "RESA admins can read Customer Care settings"
on public.resa_customer_care_settings for select to authenticated
using (
  exists (
    select 1 from public.school_memberships m
    where m.school_id = resa_customer_care_settings.school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'::public.membership_status
      and m.role = 'admin'::public.school_role
  )
);

drop policy if exists "RESA Chief Admin manages Customer Care settings" on public.resa_customer_care_settings;
create policy "RESA Chief Admin manages Customer Care settings"
on public.resa_customer_care_settings for update to authenticated
using (private.is_resa_chief_admin(school_id, (select auth.uid())))
with check (private.is_resa_chief_admin(school_id, (select auth.uid())));

drop policy if exists "RESA admins can read Customer Care assignments" on public.resa_customer_care_assignments;
create policy "RESA admins can read Customer Care assignments"
on public.resa_customer_care_assignments for select to authenticated
using (
  exists (
    select 1 from public.school_memberships m
    where m.school_id = resa_customer_care_assignments.school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'::public.membership_status
      and m.role = 'admin'::public.school_role
  )
);

drop policy if exists "RESA Chief Admin manages Customer Care assignments" on public.resa_customer_care_assignments;
create policy "RESA Chief Admin manages Customer Care assignments"
on public.resa_customer_care_assignments for all to authenticated
using (private.is_resa_chief_admin(school_id, (select auth.uid())))
with check (
  private.is_resa_chief_admin(school_id, (select auth.uid()))
  and exists (
    select 1 from public.school_memberships m
    where m.school_id = resa_customer_care_assignments.school_id
      and m.user_id = resa_customer_care_assignments.admin_user_id
      and m.status = 'active'::public.membership_status
      and m.role = 'admin'::public.school_role
  )
);

grant select, update on public.resa_customer_care_settings to authenticated;
grant select, insert, update, delete on public.resa_customer_care_assignments to authenticated;

insert into public.resa_customer_care_settings (
  school_id, chief_admin_user_id, updated_by
)
values (
  '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid,
  '85bfff8f-72ee-49b8-bd80-213001468a0a'::uuid,
  '85bfff8f-72ee-49b8-bd80-213001468a0a'::uuid
)
on conflict (school_id) do update
set chief_admin_user_id = excluded.chief_admin_user_id,
    updated_by = excluded.updated_by,
    updated_at = now();

insert into public.resa_customer_care_assignments (
  school_id, duty_key, admin_user_id, assigned_by
)
values (
  '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid,
  'all',
  '85bfff8f-72ee-49b8-bd80-213001468a0a'::uuid,
  '85bfff8f-72ee-49b8-bd80-213001468a0a'::uuid
)
on conflict (school_id, duty_key) do update
set admin_user_id = excluded.admin_user_id,
    enabled = true,
    assigned_by = excluded.assigned_by,
    assigned_at = now();

create or replace function public.get_resa_customer_care_availability(p_school_id uuid)
returns table (
  availability_enabled boolean,
  availability_days smallint[],
  availability_start time,
  availability_end time,
  timezone text,
  website_popup_enabled boolean,
  soft_sound_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select s.availability_enabled, s.availability_days, s.availability_start,
         s.availability_end, s.timezone, s.website_popup_enabled, s.soft_sound_enabled
  from public.resa_customer_care_settings s
  where s.school_id = p_school_id;
$function$;

revoke all on function public.get_resa_customer_care_availability(uuid) from public;
grant execute on function public.get_resa_customer_care_availability(uuid) to anon, authenticated;
