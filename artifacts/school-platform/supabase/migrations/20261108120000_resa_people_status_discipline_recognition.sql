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
