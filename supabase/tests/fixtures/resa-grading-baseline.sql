-- Synthetic baseline for testing only. This is not a production schema dump.
-- It contains only the existing objects required by the three pending RESA
-- CAT/grading/CBT migrations and deliberately contains no real school data.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create type public.school_role as enum ('admin', 'teacher', 'student', 'parent', 'staff');

-- This fixture-only role helper models admin/teacher claims. It is not a copy
-- of RESA's production membership authorization function.
create or replace function public.has_school_role(
  p_school_id uuid,
  p_roles public.school_role[]
)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
    and current_setting('request.jwt.claim.role', true) = 'admin'
    and 'admin'::public.school_role = any(p_roles);
$$;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null
);

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  name text not null
);

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_session_id uuid not null,
  name text not null,
  term_number integer not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  department_id uuid
);

create table public.student_term_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  academic_session_id uuid not null,
  term_id uuid not null,
  class_id uuid not null,
  total_score numeric not null default 0,
  average_score numeric not null default 0,
  position integer,
  teacher_comment text,
  principal_comment text,
  created_at timestamptz not null default now(),
  workflow_status text not null default 'published',
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  published_by uuid,
  published_at timestamptz
);

create table public.student_subject_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  term_result_id uuid not null,
  student_id uuid not null,
  subject_id uuid not null,
  ca_score numeric not null default 0,
  exam_score numeric not null default 0,
  total_score numeric not null default 0,
  grade text,
  position integer,
  teacher_comment text,
  created_at timestamptz not null default now()
);

-- term_id is intentionally absent: migration 20261120140000 must add it.
create table public.online_exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_session_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  title text not null,
  instructions text,
  duration_minutes integer,
  total_marks numeric not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.online_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  exam_id uuid not null,
  student_id uuid not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric default 0,
  status text not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table public.online_exam_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  exam_id uuid not null,
  question_text text not null default 'Synthetic test question',
  question_type text not null default 'multiple_choice',
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  marks numeric not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.online_exam_answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  attempt_id uuid not null,
  question_id uuid not null,
  answer_text text,
  is_correct boolean,
  marks_awarded numeric default 0,
  created_at timestamptz not null default now()
);


-- Existing transfer ledger from RESA's established CBT schema.
create table public.cbt_result_transfers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  attempt_id uuid not null unique,
  term_result_id uuid not null,
  subject_result_id uuid not null,
  raw_score numeric not null,
  raw_total numeric not null,
  exam_score numeric not null,
  transferred_by uuid not null references auth.users(id),
  transferred_at timestamptz not null default now()
);

insert into auth.users (id)
values ('20000000-0000-0000-0000-000000000001');

insert into public.schools (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Synthetic RESA test school');

insert into public.students (id, school_id) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001');

insert into public.school_classes (id, school_id, name)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Synthetic class');

insert into public.subjects (id, school_id, name, code)
values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Synthetic Mathematics', 'SYN-MATH');

insert into public.academic_sessions (id, school_id, name, start_date, end_date, is_current)
values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Synthetic session', '2026-09-01', '2027-07-31', true);

insert into public.academic_terms (id, school_id, academic_session_id, name, term_number, is_current)
values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Legacy term', 1, false),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'New grading term', 2, false),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Published-result term', 3, false);

-- A historical combined CA 40 + Exam 60 result exists before the migrations.
insert into public.student_term_results (
  id, school_id, student_id, academic_session_id, term_id, class_id,
  total_score, average_score, workflow_status
) values (
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  100, 100, 'published'
);

insert into public.student_subject_results (
  id, school_id, term_result_id, student_id, subject_id,
  ca_score, exam_score, total_score, grade
) values (
  '81000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  40, 60, 100, 'A'
);
