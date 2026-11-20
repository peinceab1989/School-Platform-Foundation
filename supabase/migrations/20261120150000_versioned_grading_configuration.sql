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
  add column if not exists notes_score numeric(7,2),
  add column if not exists assignments_score numeric(7,2),
  add column if not exists projects_score numeric(7,2),
  add column if not exists grading_configuration_id uuid;

alter table public.student_subject_results
  drop constraint if exists student_subject_results_coursework_score_nonnegative,
  drop constraint if exists student_subject_results_notes_score_nonnegative,
  drop constraint if exists student_subject_results_assignments_score_nonnegative,
  drop constraint if exists student_subject_results_projects_score_nonnegative;
alter table public.student_subject_results
  add constraint student_subject_results_coursework_score_nonnegative check (coursework_score is null or coursework_score >= 0),
  add constraint student_subject_results_notes_score_nonnegative check (notes_score is null or notes_score >= 0),
  add constraint student_subject_results_assignments_score_nonnegative check (assignments_score is null or assignments_score >= 0),
  add constraint student_subject_results_projects_score_nonnegative check (projects_score is null or projects_score >= 0);

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

create or replace function public.audit_school_grading_configuration_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $audit$
begin
  insert into public.school_grading_configuration_audit (
    school_id, grading_configuration_id, changed_by, action, snapshot
  ) values (
    new.school_id, new.id, coalesce(new.created_by, auth.uid()), 'created', to_jsonb(new)
  );
  return new;
end;
$audit$;

drop trigger if exists trg_audit_school_grading_configuration_insert on public.school_grading_configurations;
create trigger trg_audit_school_grading_configuration_insert
after insert on public.school_grading_configurations
for each row execute function public.audit_school_grading_configuration_insert();

revoke all on function public.audit_school_grading_configuration_insert() from public;

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
alter table public.student_subject_results
  drop constraint if exists student_subject_results_coursework_split_consistency;
alter table public.student_subject_results
  add constraint student_subject_results_coursework_split_consistency
  check (
    (notes_score is null and assignments_score is null and projects_score is null)
    or (
      notes_score is not null and assignments_score is not null and projects_score is not null
      and coursework_score is not null
      and abs(notes_score + assignments_score + projects_score - coursework_score) < 0.001
    )
  );

create or replace function public.validate_resa_student_subject_result_grading()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  cfg public.school_grading_configurations%rowtype;
begin
  if new.grading_configuration_id is null then
    if new.cat1_score is null and new.cat2_score is null and new.coursework_score is null then
      -- Preserve legacy combined-CA rows without inventing component marks.
      return new;
    end if;
    raise exception 'A versioned grading configuration is required for new component scores';
  end if;

  select * into cfg
  from public.school_grading_configurations
  where id = new.grading_configuration_id
    and school_id = new.school_id;

  if not found then
    raise exception 'The grading configuration does not belong to this school';
  end if;

  if new.exam_score is null or new.exam_score < 0 or new.exam_score > cfg.exam_max then
    raise exception 'The examination score exceeds its configured maximum';
  end if;

  if new.cat1_score is null and new.cat2_score is null and new.coursework_score is null then
    if coalesce(new.ca_score, 0) <> 0
      or abs(coalesce(new.total_score, 0) - new.exam_score) >= 0.001 then
      raise exception 'An exam-only transfer must not include unrecorded CA or coursework marks';
    end if;
    -- A configured CBT transfer may write the examination component before the
    -- teacher enters CAT and coursework marks.
    return new;
  end if;

  if new.cat1_score is null or new.cat2_score is null or new.coursework_score is null then
    raise exception 'All configured grading components are required';
  end if;

  if new.cat1_score < 0 or new.cat1_score > cfg.cat1_max
    or new.cat2_score < 0 or new.cat2_score > cfg.cat2_max
    or new.exam_score < 0 or new.exam_score > cfg.exam_max
    or new.coursework_score < 0 or new.coursework_score > cfg.coursework_max then
    raise exception 'A score exceeds its configured maximum';
  end if;

  if abs(coalesce(new.ca_score, 0) - (new.cat1_score + new.cat2_score)) >= 0.001 then
    raise exception 'CA subtotal must equal CAT 1 plus CAT 2';
  end if;

  if cfg.notes_max is null and cfg.assignments_max is null and cfg.projects_max is null then
    if new.notes_score is not null or new.assignments_score is not null or new.projects_score is not null then
      raise exception 'Individual coursework scores are not enabled for this grading version';
    end if;
  else
    if new.notes_score is null or new.assignments_score is null or new.projects_score is null then
      raise exception 'Notes, assignments and projects scores are all required for this grading version';
    end if;
    if new.notes_score < 0 or new.notes_score > cfg.notes_max
      or new.assignments_score < 0 or new.assignments_score > cfg.assignments_max
      or new.projects_score < 0 or new.projects_score > cfg.projects_max
      or abs(new.notes_score + new.assignments_score + new.projects_score - new.coursework_score) >= 0.001 then
      raise exception 'Coursework scores exceed or do not add up to the configured coursework pool';
    end if;
  end if;

  if abs(coalesce(new.total_score, 0) - (new.cat1_score + new.cat2_score + new.exam_score + new.coursework_score)) >= 0.001 then
    raise exception 'Subject total must equal the sum of all configured component scores';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_resa_student_subject_result_grading on public.student_subject_results;
create trigger trg_validate_resa_student_subject_result_grading
before insert or update of cat1_score, cat2_score, ca_score, exam_score, coursework_score,
  notes_score, assignments_score, projects_score, grading_configuration_id, total_score
on public.student_subject_results
for each row execute function public.validate_resa_student_subject_result_grading();

-- Public-schema tables are not automatically exposed through the Data API on newer
-- Supabase projects. Grant only authenticated access; RLS remains the row boundary.
grant select, insert on public.school_grading_configurations to authenticated;
grant select, insert on public.school_grading_configuration_audit to authenticated;

-- The trigger function is not an RPC endpoint.
revoke all on function public.validate_resa_student_subject_result_grading() from public;
-- Atomic, invoker-rights configuration version creation and audit.
create or replace function public.create_school_grading_configuration(
  p_school_id uuid,
  p_academic_session_id uuid,
  p_term_id uuid,
  p_cat1_max numeric,
  p_cat2_max numeric,
  p_exam_max numeric,
  p_coursework_max numeric,
  p_notes_max numeric default null,
  p_assignments_max numeric default null,
  p_projects_max numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_version integer;
  v_config public.school_grading_configurations%rowtype;
  v_has_split boolean;
begin
  if auth.uid() is null
    or not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
    raise exception 'Only an authenticated school administrator may change grading configuration';
  end if;

  if p_cat1_max < 0 or p_cat2_max < 0 or p_exam_max < 0 or p_coursework_max < 0
    or abs(p_cat1_max + p_cat2_max + p_exam_max + p_coursework_max - 100) >= 0.001 then
    raise exception 'Grading component maximums must be non-negative and total exactly 100';
  end if;

  if not exists (
    select 1 from public.academic_sessions
    where id = p_academic_session_id and school_id = p_school_id
  ) or not exists (
    select 1 from public.academic_terms
    where id = p_term_id and school_id = p_school_id
      and academic_session_id = p_academic_session_id
  ) then
    raise exception 'The selected academic session and term must belong to this school';
  end if;

  v_has_split := p_notes_max is not null or p_assignments_max is not null or p_projects_max is not null;
  if v_has_split and (
    p_notes_max is null or p_assignments_max is null or p_projects_max is null
    or p_notes_max < 0 or p_assignments_max < 0 or p_projects_max < 0
    or abs(p_notes_max + p_assignments_max + p_projects_max - p_coursework_max) >= 0.001
  ) then
    raise exception 'Notes, Assignments and Projects must all be set and total the coursework maximum';
  end if;

  select coalesce(max(version), 0) into v_version
  from public.school_grading_configurations
  where school_id = p_school_id
    and academic_session_id = p_academic_session_id
    and term_id = p_term_id;

  if v_version > 0 and exists (
    select 1
    from public.student_term_results tr
    join public.student_subject_results sr
      on sr.term_result_id = tr.id and sr.school_id = tr.school_id
    where tr.school_id = p_school_id
      and tr.academic_session_id = p_academic_session_id
      and tr.term_id = p_term_id
  ) then
    raise exception 'Grading configuration cannot change after subject scores have been saved for this term';
  end if;

  v_version := v_version + 1;

  insert into public.school_grading_configurations (
    school_id, academic_session_id, term_id, version,
    cat1_max, cat2_max, exam_max, coursework_max,
    notes_max, assignments_max, projects_max, total_max, created_by
  ) values (
    p_school_id, p_academic_session_id, p_term_id, v_version,
    p_cat1_max, p_cat2_max, p_exam_max, p_coursework_max,
    p_notes_max, p_assignments_max, p_projects_max, 100, auth.uid()
  ) returning * into v_config;

  return v_config.id;
end;
$$;

revoke all on function public.create_school_grading_configuration(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public;
grant execute on function public.create_school_grading_configuration(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
