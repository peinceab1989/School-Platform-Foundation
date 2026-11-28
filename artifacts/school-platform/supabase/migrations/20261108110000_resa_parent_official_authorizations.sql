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
