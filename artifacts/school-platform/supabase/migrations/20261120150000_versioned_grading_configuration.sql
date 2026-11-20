-- Versioned, school-admin-controlled grading maxima for each academic term.
-- Initial standard: CAT 1 20 + CAT 2 20 + Examination 50 + Coursework pool 10 = 100.
-- Coursework remains a combined Notes/Assignments/Projects pool until the school
-- explicitly approves an individual split; no arbitrary split is assumed.
create table if not exists public.school_grading_configurations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_session_id uuid not null,
  term_id uuid not null,
  version integer not null check (version > 0),
  cat1_max numeric(7,2) not null default 20 check (cat1_max >= 0),
  cat2_max numeric(7,2) not null default 20 check (cat2_max >= 0),
  exam_max numeric(7,2) not null default 50 check (exam_max >= 0),
  coursework_max numeric(7,2) not null default 10 check (coursework_max >= 0),
  notes_max numeric(7,2),
  assignments_max numeric(7,2),
  projects_max numeric(7,2),
  total_max numeric(7,2) not null default 100 check (total_max = 100),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint school_grading_configurations_total_100
    check (abs(cat1_max + cat2_max + exam_max + coursework_max - total_max) < 0.001),
  constraint school_grading_configurations_coursework_split
    check (
      (notes_max is null and assignments_max is null and projects_max is null)
      or (
        notes_max is not null and assignments_max is not null and projects_max is not null
        and notes_max >= 0 and assignments_max >= 0 and projects_max >= 0
        and abs(notes_max + assignments_max + projects_max - coursework_max) < 0.001
      )
    ),
  constraint school_grading_configurations_version_unique
    unique (school_id, academic_session_id, term_id, version)
);

create index if not exists school_grading_configurations_term_idx
  on public.school_grading_configurations (school_id, academic_session_id, term_id, version desc);

alter table public.student_subject_results
  add column if not exists coursework_score numeric(7,2),
  add column if not exists grading_configuration_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_subject_results_grading_configuration_fk'
      and conrelid = 'public.student_subject_results'::regclass
  ) then
    alter table public.student_subject_results
      add constraint student_subject_results_grading_configuration_fk
      foreign key (grading_configuration_id)
      references public.school_grading_configurations(id)
      on delete restrict;
  end if;
end $$;

alter table public.school_grading_configurations enable row level security;

drop policy if exists "school members can read grading configurations" on public.school_grading_configurations;
create policy "school members can read grading configurations"
on public.school_grading_configurations for select to authenticated
using (public.has_school_role(school_id, array['admin','teacher']::public.school_role[]));

drop policy if exists "school admins can create grading configurations" on public.school_grading_configurations;
create policy "school admins can create grading configurations"
on public.school_grading_configurations for insert to authenticated
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and (created_by is null or created_by = (select auth.uid()))
);

create table if not exists public.school_grading_configuration_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  grading_configuration_id uuid not null references public.school_grading_configurations(id) on delete restrict,
  changed_by uuid,
  action text not null check (action = 'created'),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists school_grading_configuration_audit_school_idx
  on public.school_grading_configuration_audit (school_id, created_at desc);

alter table public.school_grading_configuration_audit enable row level security;

drop policy if exists "school admins can read grading configuration audit" on public.school_grading_configuration_audit;
create policy "school admins can read grading configuration audit"
on public.school_grading_configuration_audit for select to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "school admins can append grading configuration audit" on public.school_grading_configuration_audit;
create policy "school admins can append grading configuration audit"
on public.school_grading_configuration_audit for insert to authenticated
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and (changed_by is null or changed_by = (select auth.uid()))
);
