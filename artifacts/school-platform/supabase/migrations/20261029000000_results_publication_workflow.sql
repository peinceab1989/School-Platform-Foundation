-- Result workflow: drafts stay private; only published results are visible to students and linked parents.
alter table public.student_term_results
  add column if not exists workflow_status text not null default 'published',
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists published_at timestamptz;

alter table public.student_term_results
  drop constraint if exists student_term_results_workflow_status_check;

alter table public.student_term_results
  add constraint student_term_results_workflow_status_check
  check (workflow_status in ('draft', 'submitted', 'approved', 'published'));

update public.student_term_results
set published_at = coalesce(published_at, created_at)
where workflow_status = 'published' and published_at is null;

drop policy if exists "students can read own term results" on public.student_term_results;
create policy "students can read own published term results"
on public.student_term_results for select to authenticated
using (
  workflow_status = 'published'
  and exists (
    select 1 from public.students s
    where s.id = student_term_results.student_id
      and s.school_id = student_term_results.school_id
      and s.user_id = (select auth.uid())
  )
);

drop policy if exists "parents can read linked term results" on public.student_term_results;
create policy "parents can read linked published term results"
on public.student_term_results for select to authenticated
using (workflow_status = 'published' and public.parent_can_access_student(student_id));

drop policy if exists "students can read own subject results" on public.student_subject_results;
create policy "students can read own subject results for published term"
on public.student_subject_results for select to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.student_term_results tr
      on tr.student_id = s.id and tr.school_id = s.school_id
    where s.id = student_subject_results.student_id
      and s.school_id = student_subject_results.school_id
      and s.user_id = (select auth.uid())
      and tr.id = student_subject_results.term_result_id
      and tr.workflow_status = 'published'
  )
);

drop policy if exists "parents can read linked subject results" on public.student_subject_results;
create policy "parents can read linked subject results for published term"
on public.student_subject_results for select to authenticated
using (
  public.parent_can_access_student(student_id)
  and exists (
    select 1 from public.student_term_results tr
    where tr.id = student_subject_results.term_result_id
      and tr.school_id = student_subject_results.school_id
      and tr.workflow_status = 'published'
  )
);
