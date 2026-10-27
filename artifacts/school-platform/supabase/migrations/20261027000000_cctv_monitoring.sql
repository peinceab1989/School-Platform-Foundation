-- RESA CCTV inventory and parent camera-access grants.
-- No stream URLs or credentials are stored in browser-readable tables.
create table if not exists public.cctv_cameras (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  camera_name text not null check (length(trim(camera_name)) between 2 and 120),
  location text not null check (length(trim(location)) between 2 and 160),
  notes text not null default '',
  is_enabled boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, camera_name, location),
  unique (id, school_id)
);

create table if not exists public.cctv_parent_camera_access (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  camera_id uuid not null references public.cctv_cameras(id) on delete cascade,
  parent_guardian_id uuid not null references public.parents_guardians(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid not null default auth.uid() references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (camera_id, parent_guardian_id),
  constraint cctv_access_camera_school_fk foreign key (camera_id, school_id)
    references public.cctv_cameras(id, school_id) on delete cascade
);

create index if not exists cctv_cameras_school_idx on public.cctv_cameras(school_id);
create index if not exists cctv_parent_camera_access_parent_idx on public.cctv_parent_camera_access(parent_guardian_id, school_id);
create index if not exists cctv_parent_camera_access_camera_idx on public.cctv_parent_camera_access(camera_id);

alter table public.cctv_cameras enable row level security;
alter table public.cctv_parent_camera_access enable row level security;

grant select, insert, update, delete on public.cctv_cameras to authenticated;
grant select, insert, update, delete on public.cctv_parent_camera_access to authenticated;

drop policy if exists cctv_camera_read_authorized on public.cctv_cameras;
create policy cctv_camera_read_authorized on public.cctv_cameras
for select to authenticated using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  or exists (
    select 1 from public.cctv_parent_camera_access a
    join public.parent_portal_accounts p
      on p.parent_guardian_id = a.parent_guardian_id
     and p.school_id = a.school_id
    join public.parents_guardians pg
      on pg.id = a.parent_guardian_id and pg.school_id = a.school_id
    where a.camera_id = cctv_cameras.id
      and a.school_id = cctv_cameras.school_id
      and a.is_active
      and p.is_active
      and pg.portal_enabled
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists cctv_camera_admin_insert on public.cctv_cameras;
create policy cctv_camera_admin_insert on public.cctv_cameras
for insert to authenticated with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and created_by = (select auth.uid())
);
drop policy if exists cctv_camera_admin_update on public.cctv_cameras;
create policy cctv_camera_admin_update on public.cctv_cameras
for update to authenticated using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
) with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
);
drop policy if exists cctv_camera_admin_delete on public.cctv_cameras;
create policy cctv_camera_admin_delete on public.cctv_cameras
for delete to authenticated using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
);

drop policy if exists cctv_parent_access_admin_manage on public.cctv_parent_camera_access;
drop policy if exists cctv_parent_access_admin_insert on public.cctv_parent_camera_access;
drop policy if exists cctv_parent_access_admin_update on public.cctv_parent_camera_access;
drop policy if exists cctv_parent_access_admin_delete on public.cctv_parent_camera_access;

create policy cctv_parent_access_admin_insert on public.cctv_parent_camera_access
for insert to authenticated with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and granted_by = (select auth.uid())
  and exists (
    select 1 from public.cctv_cameras c
    where c.id = cctv_parent_camera_access.camera_id and c.school_id = cctv_parent_camera_access.school_id
  )
  and exists (
    select 1 from public.parents_guardians pg
    where pg.id = cctv_parent_camera_access.parent_guardian_id
      and pg.school_id = cctv_parent_camera_access.school_id and pg.portal_enabled
  )
);
create policy cctv_parent_access_admin_update on public.cctv_parent_camera_access
for update to authenticated using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
) with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
);
create policy cctv_parent_access_admin_delete on public.cctv_parent_camera_access
for delete to authenticated using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
);

drop policy if exists cctv_parent_access_admin_select on public.cctv_parent_camera_access;
create policy cctv_parent_access_admin_select on public.cctv_parent_camera_access
for select to authenticated using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
);

drop policy if exists cctv_parent_access_read_own on public.cctv_parent_camera_access;
create policy cctv_parent_access_read_own on public.cctv_parent_camera_access
for select to authenticated using (
  is_active and exists (
    select 1 from public.parent_portal_accounts p
    join public.parents_guardians pg
      on pg.id = p.parent_guardian_id and pg.school_id = p.school_id
    where p.parent_guardian_id = cctv_parent_camera_access.parent_guardian_id
      and p.school_id = cctv_parent_camera_access.school_id
      and p.user_id = (select auth.uid())
      and p.is_active and pg.portal_enabled
  )
);

comment on table public.cctv_cameras is 'RESA CCTV inventory only. Live streaming must use a secured streaming gateway; never put camera/NVR credentials or raw private stream URLs here.';
comment on table public.cctv_parent_camera_access is 'Explicit school-admin approval for parent camera viewing. RLS limits parent visibility to their own active grants.';
