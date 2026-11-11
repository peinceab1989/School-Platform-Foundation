-- JETAB Engine Room: activity, compliance and feature registry foundation.
-- Additive only. Existing school records, auth users and memberships are preserved.

create table if not exists public.nexus_activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  school_id uuid,
  actor_role text not null default 'unknown'
    check (actor_role in ('admin','teacher','student','parent','staff','unknown')),
  dashboard text not null,
  route text,
  action text not null,
  target_type text,
  target_id text,
  outcome text not null default 'success'
    check (outcome in ('success','failure','attempt','unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nexus_activity_events_created_at_idx
  on public.nexus_activity_events (created_at desc);
create index if not exists nexus_activity_events_actor_created_idx
  on public.nexus_activity_events (actor_user_id, created_at desc);
create index if not exists nexus_activity_events_school_created_idx
  on public.nexus_activity_events (school_id, created_at desc);
create index if not exists nexus_activity_events_action_idx
  on public.nexus_activity_events (action);

alter table public.nexus_activity_events enable row level security;

drop policy if exists "Nexus owner reads activity events" on public.nexus_activity_events;
create policy "Nexus owner reads activity events"
  on public.nexus_activity_events for select to authenticated
  using (public.is_nexus_owner());

drop policy if exists "Users record their own dashboard activity" on public.nexus_activity_events;
create policy "Users record their own dashboard activity"
  on public.nexus_activity_events for insert to authenticated
  with check (actor_user_id = (select auth.uid()));

revoke update, delete on public.nexus_activity_events from anon, authenticated;
grant select, insert on public.nexus_activity_events to authenticated;

create table if not exists public.nexus_compliance_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default (
    'JETAB-' || to_char(now() at time zone 'Africa/Lagos', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  subject_user_id uuid references auth.users(id) on delete set null,
  issuer_user_id uuid references auth.users(id) on delete set null,
  school_id uuid,
  case_type text not null check (case_type in ('query','warning','incident','review')),
  severity text not null default 'standard' check (severity in ('low','standard','serious','urgent')),
  title text not null,
  allegation text not null,
  policy_reference text,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'issued'
    check (status in ('draft','issued','response_received','under_review','warning_issued','escalated','resolved','closed','withdrawn')),
  response_due_at timestamptz,
  decision text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexus_compliance_cases_subject_created_idx
  on public.nexus_compliance_cases (subject_user_id, created_at desc);
create index if not exists nexus_compliance_cases_status_created_idx
  on public.nexus_compliance_cases (status, created_at desc);
create index if not exists nexus_compliance_cases_school_created_idx
  on public.nexus_compliance_cases (school_id, created_at desc);

alter table public.nexus_compliance_cases enable row level security;

drop policy if exists "Nexus owner manages compliance cases" on public.nexus_compliance_cases;
create policy "Nexus owner manages compliance cases"
  on public.nexus_compliance_cases for all to authenticated
  using (public.is_nexus_owner())
  with check (public.is_nexus_owner());

drop policy if exists "Subjects can read their own issued cases" on public.nexus_compliance_cases;
create policy "Subjects can read their own issued cases"
  on public.nexus_compliance_cases for select to authenticated
  using (subject_user_id = (select auth.uid()) and status <> 'draft');

grant select, insert, update, delete on public.nexus_compliance_cases to authenticated;

create table if not exists public.nexus_compliance_responses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.nexus_compliance_cases(id) on delete restrict,
  responder_user_id uuid not null references auth.users(id) on delete restrict,
  response_text text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nexus_compliance_responses_case_created_idx
  on public.nexus_compliance_responses (case_id, created_at desc);

alter table public.nexus_compliance_responses enable row level security;

drop policy if exists "Subjects submit their own compliance responses" on public.nexus_compliance_responses;
create policy "Subjects submit their own compliance responses"
  on public.nexus_compliance_responses for insert to authenticated
  with check (
    responder_user_id = (select auth.uid())
    and exists (
      select 1 from public.nexus_compliance_cases c
      where c.id = case_id
        and c.subject_user_id = (select auth.uid())
        and c.status <> 'draft'
    )
  );

drop policy if exists "Nexus owner reads compliance responses" on public.nexus_compliance_responses;
create policy "Nexus owner reads compliance responses"
  on public.nexus_compliance_responses for select to authenticated
  using (public.is_nexus_owner());

drop policy if exists "Responders read their own compliance responses" on public.nexus_compliance_responses;
create policy "Responders read their own compliance responses"
  on public.nexus_compliance_responses for select to authenticated
  using (responder_user_id = (select auth.uid()));

revoke update, delete on public.nexus_compliance_responses from anon, authenticated;
grant select, insert on public.nexus_compliance_responses to authenticated;

-- Keep an immutable audit trail for membership lifecycle changes.
create or replace function public.nexus_audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_action text;
  v_target_id text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'membership_created';
    v_target_id := new.id::text;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_action := case
      when old.status::text is distinct from new.status::text then 'membership_status_changed'
      when old.role::text is distinct from new.role::text then 'membership_role_changed'
      else 'membership_updated'
    end;
    v_target_id := new.id::text;
  else
    v_old := to_jsonb(old);
    v_action := 'membership_removed';
    v_target_id := old.id::text;
  end if;

  insert into public.nexus_audit_logs (actor_user_id, action, target_type, target_id, details)
  values (
    (select auth.uid()),
    v_action,
    'school_membership',
    v_target_id,
    jsonb_build_object(
      'old', case when v_old is null then null else jsonb_build_object('user_id', v_old->>'user_id', 'role', v_old->>'role', 'status', v_old->>'status') end,
      'new', case when v_new is null then null else jsonb_build_object('user_id', v_new->>'user_id', 'role', v_new->>'role', 'status', v_new->>'status') end,
      'school_id', coalesce(v_new->>'school_id', v_old->>'school_id')
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.nexus_audit_membership_change() from public, anon, authenticated;

drop trigger if exists nexus_audit_membership_change_trigger on public.school_memberships;
create trigger nexus_audit_membership_change_trigger
after insert or update or delete on public.school_memberships
for each row execute function public.nexus_audit_membership_change();

-- Register additional controls without changing any existing module state.
insert into public.nexus_module_controls (module_key, display_name, is_enabled, settings)
values
  ('school_calendar', 'School Calendar and Closure Controls', true, '{"category":"School Operations","enforcement_state":"registry_only"}'::jsonb),
  ('assignments', 'Assignments and Submissions', true, '{"category":"Teaching and Learning","enforcement_state":"registry_only"}'::jsonb),
  ('teaching_materials', 'Teaching Materials', true, '{"category":"Teaching and Learning","enforcement_state":"registry_only"}'::jsonb),
  ('timetable', 'Class Timetable', true, '{"category":"School Operations","enforcement_state":"registry_only"}'::jsonb),
  ('school_communication', 'Messaging and Communication', true, '{"category":"Communication","enforcement_state":"registry_only"}'::jsonb),
  ('announcements', 'Announcements', true, '{"category":"Communication","enforcement_state":"registry_only"}'::jsonb),
  ('student_id_cards', 'Student ID Cards', true, '{"category":"Identity and Access","enforcement_state":"registry_only"}'::jsonb),
  ('staff_id_cards', 'Staff ID Cards', true, '{"category":"Identity and Access","enforcement_state":"registry_only"}'::jsonb),
  ('parent_authorizations', 'Parent Pickup Authorizations', true, '{"category":"Identity and Access","enforcement_state":"registry_only"}'::jsonb),
  ('biometric_offline_sync', 'Biometric Offline Synchronisation', true, '{"category":"Attendance","enforcement_state":"registry_only"}'::jsonb),
  ('compliance_cases', 'Compliance, Queries and Warnings', true, '{"category":"Governance","enforcement_state":"registry_only"}'::jsonb),
  ('user_access_management', 'User Access and Membership Management', true, '{"category":"Security","enforcement_state":"registry_only"}'::jsonb),
  ('activity_audit', 'Daily Activity and Visit Records', true, '{"category":"Security","enforcement_state":"registry_only"}'::jsonb),
  ('pwa_installation', 'Installable App and PWA', true, '{"category":"Application","enforcement_state":"registry_only"}'::jsonb)
on conflict (module_key) do nothing;

