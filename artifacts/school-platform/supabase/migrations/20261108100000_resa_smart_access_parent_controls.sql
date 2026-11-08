-- RESA Smart Access: parent identification, authorised child collection and events.
-- Additive only. Existing student/staff attendance and parent portal links are preserved.
-- Parent-facing features remain disabled until explicitly enabled by a school administrator.

create table if not exists public.smart_access_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  student_qr_enabled boolean not null default false,
  staff_qr_enabled boolean not null default false,
  parent_qr_enabled boolean not null default false,
  child_pickup_enabled boolean not null default false,
  parent_events_enabled boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_guardian_id uuid not null references public.parents_guardians(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (school_id, parent_guardian_id)
);

create index if not exists parent_qr_credentials_school_active_idx
  on public.parent_qr_credentials(school_id, is_active);

create table if not exists public.child_collection_authorizations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_guardian_id uuid not null references public.parents_guardians(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  collector_full_name text not null check (length(trim(collector_full_name)) between 2 and 160),
  collector_phone text not null check (length(trim(collector_phone)) between 7 and 30),
  relationship text not null check (length(trim(relationship)) between 2 and 80),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected','revoked','expired')),
  requested_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint collection_authorization_valid_window check (valid_until is null or valid_until > valid_from),
  constraint collection_authorization_student_parent_link check (
    exists (
      select 1 from public.parent_student_portal_access a
      where a.school_id = child_collection_authorizations.school_id
        and a.parent_guardian_id = child_collection_authorizations.parent_guardian_id
        and a.student_id = child_collection_authorizations.student_id
        and a.is_active
    )
  )
);

create index if not exists child_collection_authorizations_lookup_idx
  on public.child_collection_authorizations(school_id, student_id, approval_status, valid_until);

create table if not exists public.child_collection_releases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  parent_guardian_id uuid references public.parents_guardians(id) on delete set null,
  authorization_id uuid references public.child_collection_authorizations(id) on delete set null,
  collector_full_name text not null,
  collector_relationship text,
  verification_method text not null check (verification_method in ('parent_qr','approved_collector','manual_verified')),
  released_by uuid not null references auth.users(id),
  station_id uuid references public.biometric_devices(id) on delete set null,
  release_time timestamptz not null default now(),
  verification_note text not null check (length(trim(verification_note)) >= 3)
);

create index if not exists child_collection_releases_school_time_idx
  on public.child_collection_releases(school_id, release_time desc);
create index if not exists child_collection_releases_student_idx
  on public.child_collection_releases(student_id, release_time desc);

create table if not exists public.school_access_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  event_name text not null check (length(trim(event_name)) between 2 and 160),
  event_description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_open_for_registration boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint school_access_event_time check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.school_access_event_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  event_id uuid not null references public.school_access_events(id) on delete cascade,
  parent_guardian_id uuid not null references public.parents_guardians(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  station_id uuid references public.biometric_devices(id) on delete set null,
  unique (event_id, parent_guardian_id)
);

create index if not exists school_access_event_attendance_event_idx
  on public.school_access_event_attendance(school_id, event_id, checked_in_at);

alter table public.smart_access_settings enable row level security;
alter table public.parent_qr_credentials enable row level security;
alter table public.child_collection_authorizations enable row level security;
alter table public.child_collection_releases enable row level security;
alter table public.school_access_events enable row level security;
alter table public.school_access_event_attendance enable row level security;

grant select, insert, update on public.smart_access_settings to authenticated;
grant select, insert, update on public.parent_qr_credentials to authenticated;
grant select, insert, update on public.child_collection_authorizations to authenticated;
grant select, insert on public.child_collection_releases to authenticated;
grant select, insert, update on public.school_access_events to authenticated;
grant select, insert on public.school_access_event_attendance to authenticated;

drop policy if exists smart_access_settings_admin_manage on public.smart_access_settings;
create policy smart_access_settings_admin_manage on public.smart_access_settings
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists parent_qr_credentials_admin_manage on public.parent_qr_credentials;
create policy parent_qr_credentials_admin_manage on public.parent_qr_credentials
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists collection_authorizations_admin_manage on public.child_collection_authorizations;
create policy collection_authorizations_admin_manage on public.child_collection_authorizations
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists collection_authorizations_parent_read on public.child_collection_authorizations;
create policy collection_authorizations_parent_read on public.child_collection_authorizations
for select to authenticated
using (
  exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = child_collection_authorizations.school_id
      and a.parent_guardian_id = child_collection_authorizations.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active
  )
);

drop policy if exists collection_authorizations_parent_request on public.child_collection_authorizations;
create policy collection_authorizations_parent_request on public.child_collection_authorizations
for insert to authenticated
with check (
  approval_status = 'pending'
  and requested_by = (select auth.uid())
  and reviewed_by is null
  and exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = child_collection_authorizations.school_id
      and a.parent_guardian_id = child_collection_authorizations.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active
  )
  and exists (
    select 1 from public.parent_student_portal_access l
    where l.school_id = child_collection_authorizations.school_id
      and l.parent_guardian_id = child_collection_authorizations.parent_guardian_id
      and l.student_id = child_collection_authorizations.student_id
      and l.is_active
  )
);

drop policy if exists child_collection_releases_school_staff_read on public.child_collection_releases;
create policy child_collection_releases_school_staff_read on public.child_collection_releases
for select to authenticated
using (public.has_school_role(school_id, array['admin','teacher']::public.school_role[]));

drop policy if exists child_collection_releases_parent_read_own on public.child_collection_releases;
create policy child_collection_releases_parent_read_own on public.child_collection_releases
for select to authenticated
using (
  parent_guardian_id is not null and exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = child_collection_releases.school_id
      and a.parent_guardian_id = child_collection_releases.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active
  )
);

drop policy if exists child_collection_releases_staff_append on public.child_collection_releases;
create policy child_collection_releases_staff_append on public.child_collection_releases
for insert to authenticated
with check (
  released_by = (select auth.uid())
  and public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
);

drop policy if exists school_access_events_admin_manage on public.school_access_events;
create policy school_access_events_admin_manage on public.school_access_events
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists school_access_event_attendance_admin_read on public.school_access_event_attendance;
create policy school_access_event_attendance_admin_read on public.school_access_event_attendance
for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists school_access_event_attendance_parent_read_own on public.school_access_event_attendance;
create policy school_access_event_attendance_parent_read_own on public.school_access_event_attendance
for select to authenticated
using (
  exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = school_access_event_attendance.school_id
      and a.parent_guardian_id = school_access_event_attendance.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active
  )
);

drop policy if exists school_access_event_attendance_staff_append on public.school_access_event_attendance;
create policy school_access_event_attendance_staff_append on public.school_access_event_attendance
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
);

-- Attendance and collection audit rows are append-only for normal authenticated clients.
revoke update, delete, truncate on public.child_collection_releases from authenticated;
revoke update, delete, truncate on public.school_access_event_attendance from authenticated;

comment on table public.parent_qr_credentials is
'Hashed, revocable parent QR credentials. Raw QR secrets are never stored in this table.';
comment on table public.child_collection_authorizations is
'Parent-submitted collector requests require explicit school-admin approval before release.';
comment on table public.child_collection_releases is
'Append-only child collection evidence. A QR scan alone is not release authorisation.';
comment on table public.school_access_event_attendance is
'Append-only parent attendance records for school events.';
