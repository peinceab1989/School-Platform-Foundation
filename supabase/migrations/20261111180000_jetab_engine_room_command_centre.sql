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


-- The private JETAB owner can review membership/person directories without
-- weakening school-level access for ordinary authenticated users.
drop policy if exists "Nexus owner reads all school memberships" on public.school_memberships;
create policy "Nexus owner reads all school memberships"
  on public.school_memberships for select to authenticated
  using (public.is_nexus_owner());

drop policy if exists "Nexus owner reads people directory" on public.people;
create policy "Nexus owner reads people directory"
  on public.people for select to authenticated
  using (public.is_nexus_owner());


-- A submitted explanation automatically advances the case and creates an
-- immutable audit event. The response itself remains visible only to its
-- author and the verified JETAB owner.
create or replace function public.nexus_mark_compliance_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.nexus_compliance_cases
    set status = 'response_received', updated_at = now()
    where id = new.case_id
      and status in ('issued','under_review');

  insert into public.nexus_audit_logs (actor_user_id, action, target_type, target_id, details)
  values (
    new.responder_user_id,
    'compliance_response_submitted',
    'compliance_case',
    new.case_id::text,
    jsonb_build_object('response_id', new.id, 'submitted_at', new.created_at)
  );
  return new;
end;
$$;

revoke all on function public.nexus_mark_compliance_response() from public, anon, authenticated;
drop trigger if exists nexus_mark_compliance_response_trigger on public.nexus_compliance_responses;
create trigger nexus_mark_compliance_response_trigger
after insert on public.nexus_compliance_responses
for each row execute function public.nexus_mark_compliance_response();


-- Secure owner-only issuance creates the case and attempts an in-app notice
-- in one transaction. The notice is best-effort so an unrelated messaging
-- permission/configuration issue cannot silently discard the formal case.
create or replace function public.nexus_issue_compliance_case(
  p_subject_user_id uuid,
  p_school_id uuid,
  p_case_type text,
  p_severity text,
  p_title text,
  p_allegation text,
  p_policy_reference text default null,
  p_response_due_at timestamptz default null,
  p_warning_reviewed boolean default false
)
returns table (case_id uuid, case_number text, notification_sent boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_case_number text;
  v_notice_sent boolean := false;
begin
  if not public.is_nexus_owner() then
    raise exception 'Access denied: Nexus owner only';
  end if;
  if p_subject_user_id is null then
    raise exception 'A recipient account is required';
  end if;
  if p_case_type not in ('query','warning') then
    raise exception 'Unsupported compliance document type';
  end if;
  if p_case_type = 'warning' and p_warning_reviewed is not true then
    raise exception 'A warning requires documented human review';
  end if;
  if length(trim(coalesce(p_title,''))) = 0 or length(trim(coalesce(p_allegation,''))) = 0 then
    raise exception 'A title and incident explanation are required';
  end if;

  if p_school_id is not null and not exists (
    select 1 from public.school_memberships m
    where m.user_id = p_subject_user_id and m.school_id = p_school_id
  ) then
    raise exception 'The recipient does not belong to the selected school';
  end if;

  insert into public.nexus_compliance_cases (
    subject_user_id, issuer_user_id, school_id, case_type, severity,
    title, allegation, policy_reference, response_due_at, status
  ) values (
    p_subject_user_id, (select auth.uid()), p_school_id, p_case_type, p_severity,
    trim(p_title), trim(p_allegation), nullif(trim(coalesce(p_policy_reference,'')), ''),
    p_response_due_at, 'issued'
  )
  returning id, case_number
  into v_case_id, v_case_number;

  insert into public.nexus_audit_logs (
    actor_user_id, action, target_type, target_id, details
  ) values (
    (select auth.uid()), 'compliance_case_issued', 'compliance_case', v_case_id::text,
    jsonb_build_object(
      'case_number', v_case_number,
      'subject_user_id', p_subject_user_id,
      'case_type', p_case_type,
      'severity', p_severity
    )
  );

  if p_school_id is not null then
    begin
      insert into public.school_messages (
        school_id, sender_id, recipient_id, subject, message, channel
      ) values (
        p_school_id,
        (select auth.uid()),
        p_subject_user_id,
        case when p_case_type = 'query' then 'Formal query · ' else 'Written warning · ' end || v_case_number,
        'A formal ' || p_case_type || ' has been issued. Sign in to RESA and open My Queries and Warnings (/my-compliance). Reference: ' || v_case_number || '.',
        'private'
      );
      v_notice_sent := true;
    exception when others then
      v_notice_sent := false;
    end;
  end if;

  return query select v_case_id, v_case_number, v_notice_sent;
end;
$$;

revoke all on function public.nexus_issue_compliance_case(uuid,uuid,text,text,text,text,text,timestamptz,boolean) from public, anon;
grant execute on function public.nexus_issue_compliance_case(uuid,uuid,text,text,text,text,text,timestamptz,boolean) to authenticated;


-- Capture successful database writes for the core school workflows. Only
-- table/record identifiers and changed column names are stored; row contents,
-- passwords, messages, marks and payment values are deliberately excluded.
create or replace function public.nexus_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_action text;
  v_target_id text;
  v_school_id uuid;
  v_changed_fields jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
    v_action := 'data_insert';
    select coalesce(v_new->>'id', v_new->>'student_id', v_new->>'staff_id', v_new->>'person_id')
      into v_target_id;
    select coalesce(array_agg(k order by k), array[]::text[])::jsonb
      into v_changed_fields from jsonb_object_keys(v_new) as keys(k);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
    v_action := 'data_update';
    select coalesce(v_new->>'id', v_new->>'student_id', v_new->>'staff_id', v_new->>'person_id')
      into v_target_id;
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
      into v_changed_fields
      from jsonb_each(v_new) n
      join jsonb_each(v_old) o using (key)
      where n.value is distinct from o.value;
  else
    v_old := to_jsonb(old);
    v_row := v_old;
    v_action := 'data_delete';
    select coalesce(v_old->>'id', v_old->>'student_id', v_old->>'staff_id', v_old->>'person_id')
      into v_target_id;
    select coalesce(array_agg(k order by k), array[]::text[])::jsonb
      into v_changed_fields from jsonb_object_keys(v_old) as keys(k);
  end if;

  if coalesce(v_row->>'school_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_school_id := (v_row->>'school_id')::uuid;
  else
    v_school_id := null;
  end if;

  insert into public.nexus_activity_events (
    actor_user_id, school_id, actor_role, dashboard, route, action,
    target_type, target_id, outcome, metadata
  ) values (
    (select auth.uid()), v_school_id, 'unknown', 'data', null,
    v_action, tg_table_name, v_target_id, 'success',
    jsonb_build_object(
      'operation', tg_op,
      'table', tg_table_name,
      'changed_fields', v_changed_fields,
      'source', 'database_trigger'
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.nexus_audit_row_change() from public, anon, authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'admission_applications',
    'admission_documents',
    'admission_payments',
    'admission_application_rate_events',
    'announcements',
    'assignment_submissions',
    'assignments',
    'attendance_checkpoint_alerts',
    'attendance_manual_audit',
    'attendance_qr_credentials',
    'biometric_attendance_events',
    'cbt_result_transfers',
    'class_timetables',
    'external_candidate_exam_answers',
    'external_candidate_exam_assignments',
    'external_candidate_exam_attempts',
    'fee_types',
    'message_broadcasts',
    'online_exam_answers',
    'online_exam_attempts',
    'online_exams',
    'parent_attendance_notification_preferences',
    'people',
    'nexus_compliance_cases',
    'nexus_compliance_responses',
    'nexus_module_controls',
    'school_access_event_attendance',
    'school_feedback',
    'school_messages',
    'school_memberships',
    'staff',
    'staff_attendance',
    'student_attendance',
    'student_fee_assignments',
    'student_fee_discounts',
    'student_fee_payments',
    'student_readmissions',
    'student_subject_results',
    'student_term_results',
    'resa_chat_message_reads',
    'resa_chat_messages',
    'student_transport_assignments',
    'students',
    'teacher_assignments',
    'timetable_periods'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists nexus_audit_row_change_trigger on public.%I', v_table);
      execute format(
        'create trigger nexus_audit_row_change_trigger after insert or update or delete on public.%I for each row execute function public.nexus_audit_row_change()',
        v_table
      );
    end if;
  end loop;
end;
$$;
