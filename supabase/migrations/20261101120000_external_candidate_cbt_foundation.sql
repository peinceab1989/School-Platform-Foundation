-- Separate external CBT candidates and trusted form-purchase verification.
-- External candidates never become ordinary RESA student records.

begin;

create table if not exists public.external_candidate_form_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  form_number text not null,
  form_type text not null default 'external_cbt' check (form_type in ('external_cbt','admission')),
  amount_paid numeric(12,2) not null check (amount_paid > 0),
  payment_reference text,
  paid_at date,
  verification_status text not null default 'verified' check (verification_status in ('verified','void')),
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  redeemed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint external_candidate_form_purchase_school_number_unique unique (school_id, form_number)
);

create unique index if not exists external_form_purchase_number_ci_uidx
  on public.external_candidate_form_purchases (school_id, lower(form_number));
create unique index if not exists external_form_purchase_payment_ref_ci_uidx
  on public.external_candidate_form_purchases (school_id, lower(payment_reference))
  where payment_reference is not null and length(trim(payment_reference)) > 0;

create table if not exists public.external_candidate_registrations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  form_purchase_id uuid not null unique references public.external_candidate_form_purchases(id) on delete restrict,
  candidate_number text not null,
  full_name text not null check (length(trim(full_name)) between 3 and 180),
  email text not null,
  phone text,
  date_of_birth date,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','suspended')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_candidate_school_number_unique unique (school_id, candidate_number)
);

create unique index if not exists external_candidate_email_ci_uidx
  on public.external_candidate_registrations (school_id, lower(email));

alter table public.external_candidate_form_purchases
  add column if not exists redeemed_by_candidate_id uuid
  references public.external_candidate_registrations(id) on delete set null;

create table if not exists public.external_candidate_exam_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  candidate_id uuid not null references public.external_candidate_registrations(id) on delete cascade,
  exam_id uuid not null references public.online_exams(id) on delete cascade,
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  available_from timestamptz,
  available_until timestamptz,
  status text not null default 'assigned' check (status in ('assigned','withdrawn')),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint external_candidate_exam_assignment_unique unique (candidate_id, exam_id),
  constraint external_candidate_exam_assignment_window_check check (available_from is null or available_until is null or available_until >= available_from)
);

create table if not exists public.external_candidate_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  candidate_id uuid not null references public.external_candidate_registrations(id) on delete cascade,
  exam_id uuid not null references public.online_exams(id) on delete cascade,
  assignment_id uuid not null references public.external_candidate_exam_assignments(id) on delete restrict,
  attempt_number integer not null check (attempt_number between 1 and 10),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired','graded')),
  score numeric(8,2),
  total_marks numeric(8,2) not null default 0,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz,
  result_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint external_candidate_attempt_number_unique unique (candidate_id, exam_id, attempt_number),
  constraint external_candidate_attempt_time_check check (ends_at > started_at),
  constraint external_candidate_attempt_marks_check check (total_marks >= 0 and (score is null or score >= 0))
);

create table if not exists public.external_candidate_exam_answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attempt_id uuid not null references public.external_candidate_exam_attempts(id) on delete cascade,
  question_id uuid not null references public.online_exam_questions(id) on delete cascade,
  answer_text text,
  marks_awarded numeric(8,2) not null default 0,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_candidate_answer_question_unique unique (attempt_id, question_id),
  constraint external_candidate_answer_marks_nonnegative check (marks_awarded >= 0)
);

create table if not exists public.external_candidate_registration_events (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists external_candidate_registration_events_rate_idx
  on public.external_candidate_registration_events (rate_key, created_at desc);
alter table public.external_candidate_registration_events enable row level security;
revoke all on public.external_candidate_registration_events from public, anon, authenticated;

create index if not exists external_candidate_registrations_status_idx
  on public.external_candidate_registrations (school_id, status, created_at desc);
create index if not exists external_candidate_assignments_candidate_idx
  on public.external_candidate_exam_assignments (candidate_id, status);
create index if not exists external_candidate_attempts_candidate_exam_idx
  on public.external_candidate_exam_attempts (candidate_id, exam_id, attempt_number);
create index if not exists external_candidate_answers_attempt_idx
  on public.external_candidate_exam_answers (attempt_id);

alter table public.external_candidate_form_purchases enable row level security;
alter table public.external_candidate_registrations enable row level security;
alter table public.external_candidate_exam_assignments enable row level security;
alter table public.external_candidate_exam_attempts enable row level security;
alter table public.external_candidate_exam_answers enable row level security;

grant select, insert, update, delete on public.external_candidate_form_purchases to authenticated;
grant select, insert, update, delete on public.external_candidate_registrations to authenticated;
grant select, insert, update, delete on public.external_candidate_exam_assignments to authenticated;
grant select, insert, update, delete on public.external_candidate_exam_attempts to authenticated;
grant select, insert, update, delete on public.external_candidate_exam_answers to authenticated;

drop policy if exists "school admins manage external candidate form purchases" on public.external_candidate_form_purchases;
create policy "school admins manage external candidate form purchases"
  on public.external_candidate_form_purchases for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "school admins manage external candidate registrations" on public.external_candidate_registrations;
create policy "school admins manage external candidate registrations"
  on public.external_candidate_registrations for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "external candidates read own registration" on public.external_candidate_registrations;
create policy "external candidates read own registration"
  on public.external_candidate_registrations for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "school admins manage external candidate exam assignments" on public.external_candidate_exam_assignments;
create policy "school admins manage external candidate exam assignments"
  on public.external_candidate_exam_assignments for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "school admins manage external candidate attempts" on public.external_candidate_exam_attempts;
create policy "school admins manage external candidate attempts"
  on public.external_candidate_exam_attempts for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

drop policy if exists "school admins manage external candidate answers" on public.external_candidate_exam_answers;
create policy "school admins manage external candidate answers"
  on public.external_candidate_exam_answers for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

commit;
