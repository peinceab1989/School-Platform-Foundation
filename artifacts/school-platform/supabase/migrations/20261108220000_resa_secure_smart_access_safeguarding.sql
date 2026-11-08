-- RESA Smart Attendance operational records.
-- Additive only: preserves existing student_attendance, staff_attendance,
-- biometric_devices and biometric_attendance_events data.

create table if not exists public.attendance_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  person_type text not null check (person_type in ('student','staff')),
  student_id uuid references public.students(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint attendance_qr_exactly_one_person check (
    (person_type = 'student' and student_id is not null and staff_id is null)
    or (person_type = 'staff' and staff_id is not null and student_id is null)
  )
);

create index if not exists attendance_qr_school_active_idx
  on public.attendance_qr_credentials(school_id, is_active);

create table if not exists public.attendance_manual_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  person_type text not null check (person_type in ('student','staff')),
  student_id uuid references public.students(id) on delete restrict,
  staff_id uuid references public.staff(id) on delete restrict,
  action text not null check (action in ('check_in','check_out','status_override')),
  reason text not null check (length(trim(reason)) >= 5),
  previous_value jsonb,
  new_value jsonb not null,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  recorded_at timestamptz not null default now(),
  constraint attendance_manual_exactly_one_person check (
    (person_type = 'student' and student_id is not null and staff_id is null)
    or (person_type = 'staff' and staff_id is not null and student_id is null)
  )
);

create index if not exists attendance_manual_audit_school_date_idx
  on public.attendance_manual_audit(school_id, recorded_at desc);

create table if not exists public.attendance_checkpoint_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_date date not null,
  person_type text not null check (person_type in ('student','staff')),
  student_id uuid references public.students(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  alert_status text not null default 'pending'
    check (alert_status in ('pending','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_reminded_at timestamptz,
  reminder_count integer not null default 0 check (reminder_count >= 0),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  acknowledgement_note text,
  constraint attendance_checkpoint_exactly_one_person check (
    (person_type = 'student' and student_id is not null and staff_id is null)
    or (person_type = 'staff' and staff_id is not null and student_id is null)
  ),
  constraint attendance_checkpoint_one_per_person_day unique
    (school_id, attendance_date, person_type, student_id, staff_id)
);

create index if not exists attendance_checkpoint_pending_idx
  on public.attendance_checkpoint_alerts(school_id, attendance_date, alert_status);

alter table public.attendance_qr_credentials enable row level security;
alter table public.attendance_manual_audit enable row level security;
alter table public.attendance_checkpoint_alerts enable row level security;

grant select, insert, update on public.attendance_qr_credentials to authenticated;
grant select, insert on public.attendance_manual_audit to authenticated;
grant select, insert, update on public.attendance_checkpoint_alerts to authenticated;

drop policy if exists "attendance admins manage QR credentials" on public.attendance_qr_credentials;
create policy "attendance admins manage QR credentials"
  on public.attendance_qr_credentials for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "attendance admins read manual audit" on public.attendance_manual_audit;
create policy "attendance admins read manual audit"
  on public.attendance_manual_audit for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "attendance admins append manual audit" on public.attendance_manual_audit;
create policy "attendance admins append manual audit"
  on public.attendance_manual_audit for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and public.has_school_role(school_id, array['admin']::public.school_role[])
  );

drop policy if exists "attendance admins manage checkpoint alerts" on public.attendance_checkpoint_alerts;
create policy "attendance admins manage checkpoint alerts"
  on public.attendance_checkpoint_alerts for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- The audit table is append-only for authenticated clients.
revoke update, delete, truncate on public.attendance_manual_audit from authenticated;


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
  constraint collection_authorization_valid_window check (valid_until is null or valid_until > valid_from)
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


-- RESA Parent Authorization Centre: official visits and delegated activities.
-- Additive only. Parent submissions are requests, never automatic permission to enter or collect.
-- Notifications are queued for admin and HR delivery by the application notification worker.

create table if not exists public.parent_official_access_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_guardian_id uuid not null references public.parents_guardians(id) on delete cascade,
  purpose text not null check (purpose in (
    'child_pickup','document_collection','meeting','payment_or_finance',
    'academic_consultation','event_attendance','other'
  )),
  student_id uuid references public.students(id) on delete set null,
  delegate_full_name text not null check (length(trim(delegate_full_name)) between 2 and 160),
  delegate_phone text not null check (length(trim(delegate_phone)) between 7 and 30),
  delegate_relationship text,
  delegate_identity_reference text,
  intended_department text,
  intended_staff_member text,
  purpose_details text not null check (length(trim(purpose_details)) between 5 and 1200),
  requested_visit_at timestamptz not null,
  valid_until timestamptz,
  request_status text not null default 'pending'
    check (request_status in ('pending','approved','rejected','revoked','expired','completed')),
  requested_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint parent_official_request_validity check (valid_until is null or valid_until > requested_visit_at),
  constraint parent_official_request_child_required check (
    purpose <> 'child_pickup' or student_id is not null
  )
);

create index if not exists parent_official_access_requests_school_status_idx
  on public.parent_official_access_requests(school_id, request_status, requested_visit_at desc);
create index if not exists parent_official_access_requests_parent_idx
  on public.parent_official_access_requests(parent_guardian_id, created_at desc);

create table if not exists public.parent_official_access_request_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  request_id uuid not null references public.parent_official_access_requests(id) on delete restrict,
  event_type text not null check (event_type in ('submitted','approved','rejected','revoked','checked_in','checked_out','completed')),
  actor_user_id uuid references auth.users(id),
  event_note text,
  occurred_at timestamptz not null default now()
);

create index if not exists parent_official_access_request_events_request_idx
  on public.parent_official_access_request_events(request_id, occurred_at);

create table if not exists public.smart_access_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  request_id uuid references public.parent_official_access_requests(id) on delete cascade,
  notification_type text not null check (notification_type in ('parent_authorization_submitted','parent_authorization_decision','visitor_arrival')),
  audience_roles text[] not null default array['admin','hr']::text[],
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','processing','delivered','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists smart_access_notification_outbox_pending_idx
  on public.smart_access_notification_outbox(delivery_status, created_at)
  where delivery_status in ('pending','failed');

alter table public.parent_official_access_requests enable row level security;
alter table public.parent_official_access_request_events enable row level security;
alter table public.smart_access_notification_outbox enable row level security;

grant select, insert, update on public.parent_official_access_requests to authenticated;
grant select, insert on public.parent_official_access_request_events to authenticated;
grant select on public.smart_access_notification_outbox to authenticated;

drop policy if exists parent_official_requests_admin_manage on public.parent_official_access_requests;
create policy parent_official_requests_admin_manage on public.parent_official_access_requests
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists parent_official_requests_parent_read on public.parent_official_access_requests;
create policy parent_official_requests_parent_read on public.parent_official_access_requests
for select to authenticated
using (
  exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = parent_official_access_requests.school_id
      and a.parent_guardian_id = parent_official_access_requests.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active
  )
);

drop policy if exists parent_official_requests_parent_submit on public.parent_official_access_requests;
create policy parent_official_requests_parent_submit on public.parent_official_access_requests
for insert to authenticated
with check (
  request_status = 'pending'
  and requested_by = (select auth.uid())
  and reviewed_by is null
  and exists (
    select 1 from public.parent_portal_accounts a
    where a.school_id = parent_official_access_requests.school_id
      and a.parent_guardian_id = parent_official_access_requests.parent_guardian_id
      and a.user_id = (select auth.uid())
      and a.is_active
  )
  and (
    student_id is null or exists (
      select 1 from public.parent_student_portal_access l
      where l.school_id = parent_official_access_requests.school_id
        and l.parent_guardian_id = parent_official_access_requests.parent_guardian_id
        and l.student_id = parent_official_access_requests.student_id
        and l.is_active
    )
  )
);

drop policy if exists parent_official_request_events_admin_read on public.parent_official_access_request_events;
create policy parent_official_request_events_admin_read on public.parent_official_access_request_events
for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists parent_official_request_events_parent_read on public.parent_official_access_request_events;
create policy parent_official_request_events_parent_read on public.parent_official_access_request_events
for select to authenticated
using (
  exists (
    select 1 from public.parent_official_access_requests r
    join public.parent_portal_accounts a
      on a.school_id = r.school_id and a.parent_guardian_id = r.parent_guardian_id
    where r.id = parent_official_access_request_events.request_id
      and a.user_id = (select auth.uid()) and a.is_active
  )
);

drop policy if exists smart_access_outbox_admin_read on public.smart_access_notification_outbox;
create policy smart_access_outbox_admin_read on public.smart_access_notification_outbox
for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

revoke update, delete, truncate on public.parent_official_access_request_events from authenticated;
revoke insert, update, delete, truncate on public.smart_access_notification_outbox from authenticated;

comment on table public.parent_official_access_requests is
'Parent-submitted requests for child pickup or other official school purposes. Requests require school approval.';
comment on table public.parent_official_access_request_events is
'Append-only audit trail of parent official access request lifecycle events.';
comment on table public.smart_access_notification_outbox is
'Notification queue for routing parent authorization requests to school administration and HR.';


-- RESA People Status, Discipline and Recognition register.
-- Additive only. Records are private to the subject and authorised school officers.
-- A query/investigation is not a finding or sanction. No automatic account suspension.

create table if not exists public.people_status_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_type text not null check (subject_type in ('student','staff')),
  subject_record_id uuid not null,
  subject_user_id uuid references auth.users(id) on delete set null,
  record_category text not null check (record_category in (
    'query','investigation','warning','suspension','expulsion','termination',
    'commendation','award','promotion','appointment','role_change','other'
  )),
  record_title text not null check (length(trim(record_title)) between 3 and 180),
  record_details text not null check (length(trim(record_details)) between 5 and 5000),
  record_status text not null default 'draft'
    check (record_status in ('draft','pending_review','issued','under_appeal','upheld','reversed','closed','withdrawn')),
  severity text check (severity in ('low','moderate','serious','critical')),
  effective_from timestamptz,
  effective_until timestamptz,
  decision_date timestamptz,
  issued_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  review_note text,
  appeal_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_status_valid_period check (effective_until is null or effective_from is null or effective_until > effective_from)
);

create index if not exists people_status_school_subject_idx
  on public.people_status_records(school_id, subject_type, subject_record_id, created_at desc);
create index if not exists people_status_subject_user_idx
  on public.people_status_records(subject_user_id, created_at desc)
  where subject_user_id is not null;
create index if not exists people_status_school_status_idx
  on public.people_status_records(school_id, record_status, created_at desc);

create table if not exists public.people_status_record_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  record_id uuid not null references public.people_status_records(id) on delete restrict,
  event_type text not null check (event_type in (
    'created','submitted_for_review','issued','reviewed','appealed','upheld',
    'reversed','closed','withdrawn','document_added'
  )),
  actor_user_id uuid references auth.users(id),
  event_details text,
  occurred_at timestamptz not null default now()
);

create index if not exists people_status_events_record_idx
  on public.people_status_record_events(record_id, occurred_at);

create table if not exists public.people_status_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  record_id uuid not null references public.people_status_records(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.people_status_records enable row level security;
alter table public.people_status_record_events enable row level security;
alter table public.people_status_documents enable row level security;

grant select, insert, update on public.people_status_records to authenticated;
grant select, insert on public.people_status_record_events to authenticated;
grant select, insert on public.people_status_documents to authenticated;

drop policy if exists people_status_admin_manage on public.people_status_records;
create policy people_status_admin_manage on public.people_status_records
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists people_status_subject_read_own on public.people_status_records;
create policy people_status_subject_read_own on public.people_status_records
for select to authenticated
using (subject_user_id = (select auth.uid()));

drop policy if exists people_status_events_admin_read on public.people_status_record_events;
create policy people_status_events_admin_read on public.people_status_record_events
for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists people_status_events_subject_read_own on public.people_status_record_events;
create policy people_status_events_subject_read_own on public.people_status_record_events
for select to authenticated
using (
  exists (
    select 1 from public.people_status_records r
    where r.id = people_status_record_events.record_id
      and r.subject_user_id = (select auth.uid())
  )
);

drop policy if exists people_status_events_admin_append on public.people_status_record_events;
create policy people_status_events_admin_append on public.people_status_record_events
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and public.has_school_role(school_id, array['admin']::public.school_role[])
);

drop policy if exists people_status_documents_admin_manage on public.people_status_documents;
create policy people_status_documents_admin_manage on public.people_status_documents
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists people_status_documents_subject_read_own on public.people_status_documents;
create policy people_status_documents_subject_read_own on public.people_status_documents
for select to authenticated
using (
  exists (
    select 1 from public.people_status_records r
    where r.id = people_status_documents.record_id
      and r.subject_user_id = (select auth.uid())
  )
);

revoke update, delete, truncate on public.people_status_record_events from authenticated;
revoke delete, truncate on public.people_status_records from authenticated;
revoke delete, truncate on public.people_status_documents from authenticated;

comment on table public.people_status_records is
'Confidential student/staff discipline, investigation, employment/academic status and recognition records. Subject visibility is limited to the linked account.';
comment on table public.people_status_record_events is
'Append-only audit trail for status decisions, appeals and recognition actions.';
comment on table public.people_status_documents is
'Metadata for private supporting documents. Storage bucket access policies must also restrict files to authorised officers and the record subject.';


-- RESA safeguarding hardening: parent ownership and same-school child linkage.
create or replace function public.validate_parent_smart_access_request()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if auth.uid() is null or new.requested_by is distinct from auth.uid() then
    raise exception 'The signed-in parent account must submit this request';
  end if;
  if not exists (
    select 1 from public.parent_portal_accounts p
    where p.school_id=new.school_id and p.parent_guardian_id=new.parent_guardian_id
      and p.user_id=auth.uid() and p.is_active
  ) then raise exception 'Parent portal account is not linked to this guardian'; end if;
  if new.student_id is not null and not exists (
    select 1 from public.parent_student_portal_access l
    where l.school_id=new.school_id and l.parent_guardian_id=new.parent_guardian_id
      and l.student_id=new.student_id and l.is_active
  ) then raise exception 'This student is not linked to the signed-in parent'; end if;
  return new;
end;
$function$;
drop trigger if exists validate_parent_collection_request on public.child_collection_authorizations;
create trigger validate_parent_collection_request before insert on public.child_collection_authorizations
for each row execute function public.validate_parent_smart_access_request();
drop trigger if exists validate_parent_official_access_request on public.parent_official_access_requests;
create trigger validate_parent_official_access_request before insert on public.parent_official_access_requests
for each row execute function public.validate_parent_smart_access_request();
revoke all on function public.validate_parent_smart_access_request() from public,anon,authenticated;

-- Drafts, queries and unissued investigations are never exposed to the subject.
drop policy if exists people_status_subject_read_own on public.people_status_records;
create policy people_status_subject_read_own on public.people_status_records
for select to authenticated using (
  subject_user_id=(select auth.uid()) and record_status in ('issued','under_appeal','upheld','reversed')
);
drop policy if exists people_status_events_subject_read_own on public.people_status_record_events;
create policy people_status_events_subject_read_own on public.people_status_record_events
for select to authenticated using (exists(
  select 1 from public.people_status_records r where r.id=people_status_record_events.record_id
    and r.subject_user_id=(select auth.uid()) and r.record_status in ('issued','under_appeal','upheld','reversed')
));
drop policy if exists people_status_documents_subject_read_own on public.people_status_documents;
create policy people_status_documents_subject_read_own on public.people_status_documents
for select to authenticated using (exists(
  select 1 from public.people_status_records r where r.id=people_status_documents.record_id
    and r.subject_user_id=(select auth.uid()) and r.record_status in ('issued','under_appeal','upheld','reversed')
));

create or replace function public.validate_people_status_subject()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid;
begin
  if new.subject_type='student' then
    select coalesce(s.user_id,p.user_id) into v_user_id
    from public.students s join public.people p on p.id=s.person_id and p.school_id=s.school_id
    where s.id=new.subject_record_id and s.school_id=new.school_id;
  elsif new.subject_type='staff' then
    select coalesce(sf.user_id,p.user_id) into v_user_id
    from public.staff sf join public.people p on p.id=sf.person_id and p.school_id=sf.school_id
    where sf.id=new.subject_record_id and sf.school_id=new.school_id;
  else raise exception 'Invalid subject type'; end if;
  if not found then raise exception 'Subject record does not belong to this school'; end if;
  if new.subject_user_id is not null and v_user_id is distinct from new.subject_user_id then
    raise exception 'Subject account does not match the selected record';
  end if;
  return new;
end;
$function$;
drop trigger if exists people_status_subject_validate on public.people_status_records;
create trigger people_status_subject_validate before insert or update of school_id,subject_type,subject_record_id,subject_user_id
on public.people_status_records for each row execute function public.validate_people_status_subject();
revoke all on function public.validate_people_status_subject() from public,anon,authenticated;

create or replace function public.audit_people_status_record()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_event text;
begin
  if tg_op='INSERT' then v_event:='created';
  elsif new.record_status is distinct from old.record_status then
    v_event:=case new.record_status when 'pending_review' then 'submitted_for_review'
      when 'issued' then 'issued' when 'under_appeal' then 'appealed'
      when 'upheld' then 'upheld' when 'reversed' then 'reversed'
      when 'closed' then 'closed' when 'withdrawn' then 'withdrawn' else 'reviewed' end;
  else return new; end if;
  insert into public.people_status_record_events(school_id,record_id,event_type,actor_user_id,event_details)
  values(new.school_id,new.id,v_event,coalesce(auth.uid(),new.issued_by),new.record_details);
  return new;
end;
$function$;
drop trigger if exists people_status_record_audit on public.people_status_records;
create trigger people_status_record_audit after insert or update of record_status on public.people_status_records
for each row execute function public.audit_people_status_record();
revoke all on function public.audit_people_status_record() from public,anon,authenticated;

-- Keep an immutable event history for parent pickup decisions and consumption.
alter table public.child_collection_authorizations add column if not exists consumed_at timestamptz,
  add column if not exists consumed_by uuid references auth.users(id);
create table if not exists public.child_collection_authorization_events(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  authorization_id uuid not null references public.child_collection_authorizations(id) on delete restrict,
  event_type text not null check(event_type in('submitted','approved','rejected','revoked','expired','consumed')),
  actor_user_id uuid references auth.users(id),event_note text,occurred_at timestamptz not null default now()
);
create index if not exists child_collection_authorization_events_idx
on public.child_collection_authorization_events(authorization_id,occurred_at);
alter table public.child_collection_authorization_events enable row level security;
grant select on public.child_collection_authorization_events to authenticated;
create policy child_collection_authorization_events_admin_read on public.child_collection_authorization_events
for select to authenticated using(public.has_school_role(school_id,array['admin']::public.school_role[]));
create policy child_collection_authorization_events_parent_read on public.child_collection_authorization_events
for select to authenticated using(exists(
 select 1 from public.child_collection_authorizations a join public.parent_portal_accounts p
 on p.school_id=a.school_id and p.parent_guardian_id=a.parent_guardian_id
 where a.id=child_collection_authorization_events.authorization_id and p.user_id=(select auth.uid()) and p.is_active
));
revoke insert,update,delete,truncate on public.child_collection_authorization_events from authenticated;

create or replace function public.audit_child_collection_authorization()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_event text;
begin
  if tg_op='INSERT' then v_event:='submitted';
  elsif new.consumed_at is not null and old.consumed_at is null then v_event:='consumed';
  elsif new.approval_status is distinct from old.approval_status then v_event:=new.approval_status;
  else return new; end if;
  insert into public.child_collection_authorization_events(school_id,authorization_id,event_type,actor_user_id,event_note)
  values(new.school_id,new.id,v_event,coalesce(auth.uid(),new.reviewed_by,new.consumed_by),new.review_note);
  return new;
end;
$function$;
drop trigger if exists child_collection_authorization_audit on public.child_collection_authorizations;
create trigger child_collection_authorization_audit after insert or update of approval_status,consumed_at
on public.child_collection_authorizations for each row execute function public.audit_child_collection_authorization();
revoke all on function public.audit_child_collection_authorization() from public,anon,authenticated;

-- Notification outbox is generated automatically; delivery requires a trusted worker.
create or replace function public.enqueue_parent_official_request()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  insert into public.parent_official_access_request_events(school_id,request_id,event_type,actor_user_id,event_note)
  values(new.school_id,new.id,'submitted',new.requested_by,'Parent request submitted');
  insert into public.smart_access_notification_outbox(school_id,request_id,notification_type,audience_roles)
  values(new.school_id,new.id,'parent_authorization_submitted',array['admin','hr']::text[]);
  return new;
end;
$function$;
drop trigger if exists parent_official_request_enqueue on public.parent_official_access_requests;
create trigger parent_official_request_enqueue after insert on public.parent_official_access_requests
for each row execute function public.enqueue_parent_official_request();
revoke all on function public.enqueue_parent_official_request() from public,anon,authenticated;

-- Database-atomic release: approved authorization is locked and consumed exactly once.
revoke insert,update,delete,truncate on public.child_collection_releases from authenticated;
create or replace function public.resa_record_child_collection_release(
 p_school_id uuid,p_student_id uuid,p_collector_full_name text,p_collector_relationship text,
 p_verification_method text,p_verification_note text,p_authorization_id uuid default null,
 p_parent_qr_hash text default null,p_station_id uuid default null
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_parent_id uuid; v_auth public.child_collection_authorizations%rowtype; v_release_id uuid;
begin
 if auth.uid() is null or not public.has_school_role(p_school_id,array['admin','teacher']::public.school_role[]) then
  raise exception 'School staff permission is required'; end if;
 if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id and s.child_pickup_enabled) then
  raise exception 'Child collection is disabled by the school'; end if;
 if length(trim(coalesce(p_collector_full_name,'')))<2 or length(trim(coalesce(p_verification_note,'')))<3 then
  raise exception 'Collector name and verification note are required'; end if;
 if not exists(select 1 from public.students s where s.id=p_student_id and s.school_id=p_school_id and s.status='active') then
  raise exception 'Active student not found'; end if;
 if p_station_id is not null and not exists(select 1 from public.biometric_devices d where d.id=p_station_id and d.school_id=p_school_id and d.is_active) then
  raise exception 'Invalid attendance station'; end if;
 if p_authorization_id is not null then
  select * into v_auth from public.child_collection_authorizations
  where id=p_authorization_id and school_id=p_school_id and student_id=p_student_id for update;
  if not found or v_auth.approval_status<>'approved' or v_auth.consumed_at is not null
    or v_auth.valid_from>now() or (v_auth.valid_until is not null and v_auth.valid_until<=now()) then
   raise exception 'No valid unused approved collection authorization'; end if;
  if lower(trim(v_auth.collector_full_name))<>lower(trim(p_collector_full_name)) then
   raise exception 'Collector name does not match authorization'; end if;
  if p_verification_method<>'approved_collector' then raise exception 'Use approved collector verification'; end if;
  v_parent_id:=v_auth.parent_guardian_id;
  update public.child_collection_authorizations set consumed_at=now(),consumed_by=auth.uid() where id=v_auth.id;
 elsif p_verification_method='parent_qr' then
  if p_parent_qr_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid parent QR'; end if;
  select q.parent_guardian_id into v_parent_id from public.parent_qr_credentials q
  join public.parent_student_portal_access l on l.school_id=q.school_id and l.parent_guardian_id=q.parent_guardian_id
  where q.school_id=p_school_id and q.token_hash=p_parent_qr_hash and q.is_active
   and l.student_id=p_student_id and l.is_active;
  if not found then raise exception 'Parent QR is invalid or not linked to this student'; end if;
 elsif p_verification_method<>'manual_verified' then
  raise exception 'Approved authorization, linked parent QR or documented manual verification is required';
 end if;
 insert into public.child_collection_releases(school_id,student_id,parent_guardian_id,authorization_id,
  collector_full_name,collector_relationship,verification_method,released_by,station_id,verification_note)
 values(p_school_id,p_student_id,v_parent_id,p_authorization_id,trim(p_collector_full_name),
  nullif(trim(coalesce(p_collector_relationship,'')),''),p_verification_method,auth.uid(),p_station_id,trim(p_verification_note))
 returning id into v_release_id;
 return jsonb_build_object('success',true,'release_id',v_release_id,'released_at',now());
end;
$function$;
revoke all on function public.resa_record_child_collection_release(uuid,uuid,text,text,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.resa_record_child_collection_release(uuid,uuid,text,text,text,text,uuid,text,uuid) to authenticated;

-- Secure QR issuance stores only the SHA-256 token hash; the raw token is shown once by the client.
create unique index if not exists attendance_qr_active_student_uidx on public.attendance_qr_credentials(school_id,student_id)
where is_active and student_id is not null;
create unique index if not exists attendance_qr_active_staff_uidx on public.attendance_qr_credentials(school_id,staff_id)
where is_active and staff_id is not null;
alter table public.biometric_attendance_events drop constraint if exists biometric_attendance_verification_check;
alter table public.biometric_attendance_events add constraint biometric_attendance_verification_check
check(verification_method=any(array['fingerprint','face','card','other','qr_code']::text[]));

create or replace function public.resa_issue_attendance_qr(p_school_id uuid,p_person_type text,p_person_id uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
 if auth.uid() is null or not public.has_school_role(p_school_id,array['admin']::public.school_role[]) then raise exception 'Admin access required'; end if;
 if p_person_type not in('student','staff') or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid QR credential'; end if;
 if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id
  and ((p_person_type='student' and s.student_qr_enabled) or (p_person_type='staff' and s.staff_qr_enabled))) then
  raise exception 'QR attendance is not enabled'; end if;
 if p_person_type='student' then
  if not exists(select 1 from public.students where id=p_person_id and school_id=p_school_id and status='active') then raise exception 'Active student not found'; end if;
  update public.attendance_qr_credentials set is_active=false,revoked_at=now() where school_id=p_school_id and student_id=p_person_id and is_active;
  insert into public.attendance_qr_credentials(school_id,person_type,student_id,token_hash,created_by)
  values(p_school_id,'student',p_person_id,p_token_hash,auth.uid()) returning id into v_id;
 else
  if not exists(select 1 from public.staff where id=p_person_id and school_id=p_school_id and status='active') then raise exception 'Active staff not found'; end if;
  update public.attendance_qr_credentials set is_active=false,revoked_at=now() where school_id=p_school_id and staff_id=p_person_id and is_active;
  insert into public.attendance_qr_credentials(school_id,person_type,staff_id,token_hash,created_by)
  values(p_school_id,'staff',p_person_id,p_token_hash,auth.uid()) returning id into v_id;
 end if;
 return jsonb_build_object('credential_id',v_id,'issued_at',now());
end;
$function$;
revoke all on function public.resa_issue_attendance_qr(uuid,text,uuid,text) from public,anon;
grant execute on function public.resa_issue_attendance_qr(uuid,text,uuid,text) to authenticated;

-- QR attendance records use the existing biometric event trigger for daily attendance and guardian alerts.
create or replace function public.resa_record_qr_attendance(p_token_hash text,p_station_id uuid,p_event_type text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_qr public.attendance_qr_credentials%rowtype; v_device public.biometric_devices%rowtype;
 v_today date:=(now() at time zone 'Africa/Lagos')::date; v_time time:=(now() at time zone 'Africa/Lagos')::time;
 v_row public.student_attendance%rowtype; v_staff public.staff_attendance%rowtype; v_event_id uuid; v_stamp timestamptz; v_name text;
begin
 if auth.uid() is null or p_event_type not in('check_in','check_out') or p_token_hash !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid QR attendance request'; end if;
 select * into v_qr from public.attendance_qr_credentials where token_hash=p_token_hash and is_active for update;
 if not found then raise exception 'QR credential is invalid or revoked'; end if;
 if not public.has_school_role(v_qr.school_id,array['admin','teacher']::public.school_role[]) then raise exception 'Attendance operator access required'; end if;
 select * into v_device from public.biometric_devices where id=p_station_id and school_id=v_qr.school_id and is_active;
 if not found then raise exception 'Select an active attendance station'; end if;
 if v_qr.person_type='student' then
  perform 1 from public.students where id=v_qr.student_id and school_id=v_qr.school_id and status='active' for update;
  if not found then raise exception 'Student is inactive'; end if;
  select * into v_row from public.student_attendance where school_id=v_qr.school_id and student_id=v_qr.student_id and attendance_date=v_today for update;
  if p_event_type='check_in' and v_row.check_in_at is not null then raise exception 'Already checked in today'; end if;
  if p_event_type='check_out' and (v_row.id is null or v_row.check_in_at is null or v_row.check_out_at is not null) then raise exception 'No valid check-in is available'; end if;
  insert into public.biometric_attendance_events(school_id,biometric_device_id,student_id,event_type,event_time,verification_method)
  values(v_qr.school_id,p_station_id,v_qr.student_id,p_event_type,now(),'qr_code') returning id,event_time into v_event_id,v_stamp;
  select concat_ws(' ',p.first_name,p.middle_name,p.last_name) into v_name from public.students s
   join public.people p on p.id=s.person_id and p.school_id=s.school_id where s.id=v_qr.student_id;
 else
  perform 1 from public.staff where id=v_qr.staff_id and school_id=v_qr.school_id and status='active' for update;
  if not found then raise exception 'Staff member is inactive'; end if;
  if p_event_type='check_in' then
   insert into public.staff_attendance(school_id,staff_id,attendance_date,status,check_in_time,recorded_by,remarks)
   values(v_qr.school_id,v_qr.staff_id,v_today,'present',v_time,auth.uid(),'QR check-in at '||v_device.device_name)
   on conflict(staff_id,attendance_date) do update set status='present',check_in_time=excluded.check_in_time,
    recorded_by=auth.uid(),remarks=concat_ws(' · ',public.staff_attendance.remarks,excluded.remarks)
   where public.staff_attendance.check_in_time is null returning * into v_staff;
   if not found then raise exception 'Already checked in today'; end if;
  else
   update public.staff_attendance set check_out_time=v_time,status='checked_out',recorded_by=auth.uid(),
    remarks=concat_ws(' · ',remarks,'QR check-out at '||v_device.device_name)
   where school_id=v_qr.school_id and staff_id=v_qr.staff_id and attendance_date=v_today and check_in_time is not null and check_out_time is null
   returning * into v_staff;
   if not found then raise exception 'Valid staff check-in required before check-out'; end if;
  end if;
  select concat_ws(' ',p.first_name,p.middle_name,p.last_name) into v_name from public.staff sf
   join public.people p on p.id=sf.person_id and p.school_id=sf.school_id where sf.id=v_qr.staff_id;
 end if;
 return jsonb_build_object('success',true,'person_type',v_qr.person_type,'person_id',coalesce(v_qr.student_id,v_qr.staff_id),
  'person_name',v_name,'event_type',p_event_type,'event_time',coalesce(v_stamp,now()),'station_name',v_device.device_name);
end;
$function$;
revoke all on function public.resa_record_qr_attendance(text,uuid,text) from public,anon;
grant execute on function public.resa_record_qr_attendance(text,uuid,text) to authenticated;

-- Parent QR is a school-issued, revocable credential; it never authorizes pickup without staff verification.
create or replace function public.resa_issue_parent_qr(p_school_id uuid,p_parent_guardian_id uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
 if auth.uid() is null or not public.has_school_role(p_school_id,array['admin']::public.school_role[]) then raise exception 'Admin access required'; end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid parent QR'; end if;
 if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id and s.parent_qr_enabled) then raise exception 'Parent QR is disabled'; end if;
 if not exists(select 1 from public.parents_guardians pg join public.parent_portal_accounts a
  on a.school_id=pg.school_id and a.parent_guardian_id=pg.id and a.is_active
  where pg.id=p_parent_guardian_id and pg.school_id=p_school_id and pg.portal_enabled) then
  raise exception 'Active parent portal account not found'; end if;
 update public.parent_qr_credentials set is_active=false,revoked_at=now()
 where school_id=p_school_id and parent_guardian_id=p_parent_guardian_id and is_active;
 insert into public.parent_qr_credentials(school_id,parent_guardian_id,token_hash,created_by)
 values(p_school_id,p_parent_guardian_id,p_token_hash,auth.uid())
 on conflict(school_id,parent_guardian_id) do update set token_hash=excluded.token_hash,is_active=true,
  created_by=auth.uid(),created_at=now(),revoked_at=null returning id into v_id;
 return jsonb_build_object('credential_id',v_id,'issued_at',now());
end;
$function$;
revoke all on function public.resa_issue_parent_qr(uuid,uuid,text) from public,anon;
grant execute on function public.resa_issue_parent_qr(uuid,uuid,text) to authenticated;

-- Parent event check-in is separate from child collection.
revoke insert,update,delete,truncate on public.school_access_event_attendance from authenticated;
create or replace function public.resa_record_parent_event_checkin(p_school_id uuid,p_event_id uuid,p_parent_qr_hash text,p_station_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_parent_id uuid; v_event public.school_access_events%rowtype; v_id uuid;
begin
 if auth.uid() is null or not public.has_school_role(p_school_id,array['admin','teacher']::public.school_role[]) then raise exception 'Staff access required'; end if;
 if p_parent_qr_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid parent QR'; end if;
 if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id and s.parent_events_enabled and s.parent_qr_enabled) then
  raise exception 'Parent event QR is disabled'; end if;
 select * into v_event from public.school_access_events where id=p_event_id and school_id=p_school_id
  and is_open_for_registration and starts_at<=now() and (ends_at is null or ends_at>now());
 if not found then raise exception 'Event is not open for check-in'; end if;
 select q.parent_guardian_id into v_parent_id from public.parent_qr_credentials q
 where q.school_id=p_school_id and q.token_hash=p_parent_qr_hash and q.is_active;
 if not found then raise exception 'Parent QR is invalid or revoked'; end if;
 if p_station_id is not null and not exists(select 1 from public.biometric_devices d where d.id=p_station_id and d.school_id=p_school_id and d.is_active) then
  raise exception 'Invalid attendance station'; end if;
 insert into public.school_access_event_attendance(school_id,event_id,parent_guardian_id,recorded_by,station_id)
 values(p_school_id,p_event_id,v_parent_id,auth.uid(),p_station_id)
 on conflict(event_id,parent_guardian_id) do nothing returning id into v_id;
 if v_id is null then raise exception 'Parent already checked in for this event'; end if;
 return jsonb_build_object('success',true,'attendance_id',v_id,'event_name',v_event.event_name,'checked_in_at',now());
end;
$function$;
revoke all on function public.resa_record_parent_event_checkin(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.resa_record_parent_event_checkin(uuid,uuid,text,uuid) to authenticated;

-- Audit status transitions and parent authorization outcomes.
create or replace function public.audit_parent_official_request_decision()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if new.request_status is distinct from old.request_status then
  insert into public.parent_official_access_request_events(school_id,request_id,event_type,actor_user_id,event_note)
  values(new.school_id,new.id,case when new.request_status in('approved','rejected','revoked','completed') then new.request_status else 'checked_out' end,
   coalesce(auth.uid(),new.reviewed_by),coalesce(new.review_note,'Request status changed'));
  insert into public.smart_access_notification_outbox(school_id,request_id,notification_type,audience_roles)
  values(new.school_id,new.id,'parent_authorization_decision',array['admin','hr']::text[]);
 end if; return new;
end;
$function$;
drop trigger if exists parent_official_request_decision_audit on public.parent_official_access_requests;
create trigger parent_official_request_decision_audit after update of request_status on public.parent_official_access_requests
for each row execute function public.audit_parent_official_request_decision();
revoke all on function public.audit_parent_official_request_decision() from public,anon,authenticated;


-- Parent submission is atomic: child-pickup requests create both the visit record
-- and the specific collection authorization in the same transaction.
create or replace function public.resa_submit_parent_access_request(
 p_school_id uuid,p_parent_guardian_id uuid,p_purpose text,p_student_id uuid,
 p_delegate_full_name text,p_delegate_phone text,p_delegate_relationship text,
 p_delegate_identity_reference text,p_intended_department text,p_intended_staff_member text,
 p_purpose_details text,p_requested_visit_at timestamptz,p_valid_until timestamptz default null
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_request_id uuid; v_authorization_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in as a parent to submit a request'; end if;
 if not exists(select 1 from public.parent_portal_accounts p where p.school_id=p_school_id and p.parent_guardian_id=p_parent_guardian_id
  and p.user_id=auth.uid() and p.is_active) then raise exception 'Active parent account not found'; end if;
 if p_purpose not in('child_pickup','document_collection','meeting','payment_or_finance','academic_consultation','event_attendance','other') then
  raise exception 'Invalid request purpose'; end if;
 if p_purpose='child_pickup' and p_student_id is null then raise exception 'Select the child'; end if;
 if p_student_id is not null and not exists(select 1 from public.parent_student_portal_access l
  where l.school_id=p_school_id and l.parent_guardian_id=p_parent_guardian_id and l.student_id=p_student_id and l.is_active) then
  raise exception 'Selected child is not linked to this parent'; end if;
 if length(trim(coalesce(p_delegate_full_name,'')))<2 or length(trim(coalesce(p_delegate_phone,'')))<7
  or length(trim(coalesce(p_purpose_details,'')))<5 then raise exception 'Complete the delegate and request details'; end if;
 if p_requested_visit_at<now()-interval '1 minute' or (p_valid_until is not null and p_valid_until<=p_requested_visit_at) then
  raise exception 'Invalid visit or expiry time'; end if;
 insert into public.parent_official_access_requests(
  school_id,parent_guardian_id,purpose,student_id,delegate_full_name,delegate_phone,delegate_relationship,
  delegate_identity_reference,intended_department,intended_staff_member,purpose_details,requested_visit_at,
  valid_until,request_status,requested_by
 ) select p.school_id,p_parent_guardian_id,p_purpose,p_student_id,trim(p_delegate_full_name),trim(p_delegate_phone),
  nullif(trim(coalesce(p_delegate_relationship,'')),''),nullif(trim(coalesce(p_delegate_identity_reference,'')),''),
  nullif(trim(coalesce(p_intended_department,'')),''),nullif(trim(coalesce(p_intended_staff_member,'')),''),
  trim(p_purpose_details),p_requested_visit_at,p_valid_until,'pending',auth.uid()
 from public.parent_portal_accounts p where p.school_id=p_school_id and p.parent_guardian_id=p_parent_guardian_id and p.user_id=auth.uid() and p.is_active
 returning id into v_request_id;
 if p_purpose='child_pickup' then
  insert into public.child_collection_authorizations(
   school_id,parent_guardian_id,student_id,collector_full_name,collector_phone,relationship,
   valid_from,valid_until,approval_status,requested_by
  ) select p.school_id,p_parent_guardian_id,p_student_id,trim(p_delegate_full_name),trim(p_delegate_phone),
   coalesce(nullif(trim(coalesce(p_delegate_relationship,'')),''),'Not specified'),
   p_requested_visit_at,p_valid_until,'pending',auth.uid()
  from public.parent_portal_accounts p where p.school_id=p_school_id and p.parent_guardian_id=p_parent_guardian_id and p.user_id=auth.uid() and p.is_active
  returning id into v_authorization_id;
 end if;
 return jsonb_build_object('request_id',v_request_id,'authorization_id',v_authorization_id,'status','pending');
end;
$function$;
revoke all on function public.resa_submit_parent_access_request(uuid,uuid,text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.resa_submit_parent_access_request(uuid,uuid,text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz) to authenticated;
