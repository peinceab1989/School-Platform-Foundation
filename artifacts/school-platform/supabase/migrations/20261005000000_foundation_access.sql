-- Phase 1: school identity, user profiles, school memberships, and RLS.
-- Apply this file to a new Supabase project before connecting the app.

create type public.school_role as enum ('admin', 'teacher', 'student', 'parent');
create type public.membership_status as enum ('active', 'invited', 'suspended');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.school_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);

create index school_memberships_user_id_idx
  on public.school_memberships (user_id);
create index school_memberships_school_id_idx
  on public.school_memberships (school_id);

create or replace function public.has_school_role(
  p_school_id uuid,
  p_roles public.school_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.school_memberships as membership
    where membership.school_id = p_school_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (p_roles is null or membership.role = any (p_roles))
  );
$function$;

revoke all on function public.has_school_role(uuid, public.school_role[]) from public;
grant execute on function public.has_school_role(uuid, public.school_role[]) to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

revoke all on function public.create_profile_for_new_user() from public;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;

grant select, update on public.schools to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.school_memberships to authenticated;

create policy "members can read their schools"
  on public.schools for select to authenticated
  using (public.has_school_role(id));

create policy "school admins can update their schools"
  on public.schools for update to authenticated
  using (public.has_school_role(id, array['admin']::public.school_role[]))
  with check (public.has_school_role(id, array['admin']::public.school_role[]));

create policy "users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "users and school admins can read memberships"
  on public.school_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_school_role(school_id, array['admin']::public.school_role[])
  );

create policy "school admins can add memberships"
  on public.school_memberships for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy "school admins can update memberships"
  on public.school_memberships for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy "school admins can remove memberships"
  on public.school_memberships for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
