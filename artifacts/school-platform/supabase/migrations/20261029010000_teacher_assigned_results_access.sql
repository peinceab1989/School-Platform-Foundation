-- Restrict teacher score entry to assigned classes, sessions and subjects.
-- Teachers can save/submit results; only administrators can approve and publish.

drop policy if exists "teachers can read assigned class term results" on public.student_term_results;
create policy "teachers can read assigned class term results"
on public.student_term_results for select to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    where ta.school_id = student_term_results.school_id
      and ta.class_id = student_term_results.class_id
      and ta.academic_session_id = student_term_results.academic_session_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
);

drop policy if exists "assigned teachers can create draft term results" on public.student_term_results;
create policy "assigned teachers can create draft term results"
on public.student_term_results for insert to authenticated
with check (
  workflow_status in ('draft', 'submitted')
  and approved_by is null and approved_at is null
  and published_by is null and published_at is null
  and exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    where ta.school_id = student_term_results.school_id
      and ta.class_id = student_term_results.class_id
      and ta.academic_session_id = student_term_results.academic_session_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
);

drop policy if exists "assigned teachers can update unapproved term results" on public.student_term_results;
create policy "assigned teachers can update unapproved term results"
on public.student_term_results for update to authenticated
using (
  workflow_status in ('draft', 'submitted')
  and exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    where ta.school_id = student_term_results.school_id
      and ta.class_id = student_term_results.class_id
      and ta.academic_session_id = student_term_results.academic_session_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
)
with check (
  workflow_status in ('draft', 'submitted')
  and approved_by is null and approved_at is null
  and published_by is null and published_at is null
  and exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    where ta.school_id = student_term_results.school_id
      and ta.class_id = student_term_results.class_id
      and ta.academic_session_id = student_term_results.academic_session_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
);

drop policy if exists "assigned teachers can read subject scores" on public.student_subject_results;
create policy "assigned teachers can read subject scores"
on public.student_subject_results for select to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    join public.student_term_results tr
      on tr.school_id = ta.school_id and tr.class_id = ta.class_id
      and tr.academic_session_id = ta.academic_session_id
      and tr.id = student_subject_results.term_result_id
    where ta.school_id = student_subject_results.school_id
      and ta.subject_id = student_subject_results.subject_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
);

drop policy if exists "assigned teachers can add scores before publication" on public.student_subject_results;
create policy "assigned teachers can add scores before publication"
on public.student_subject_results for insert to authenticated
with check (
  exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    join public.student_term_results tr
      on tr.school_id = ta.school_id and tr.class_id = ta.class_id
      and tr.academic_session_id = ta.academic_session_id
      and tr.id = student_subject_results.term_result_id
      and tr.student_id = student_subject_results.student_id
      and tr.workflow_status in ('draft', 'submitted')
    where ta.school_id = student_subject_results.school_id
      and ta.subject_id = student_subject_results.subject_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
);

drop policy if exists "assigned teachers can update scores before publication" on public.student_subject_results;
create policy "assigned teachers can update scores before publication"
on public.student_subject_results for update to authenticated
using (
  exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    join public.student_term_results tr
      on tr.school_id = ta.school_id and tr.class_id = ta.class_id
      and tr.academic_session_id = ta.academic_session_id
      and tr.id = student_subject_results.term_result_id
      and tr.student_id = student_subject_results.student_id
      and tr.workflow_status in ('draft', 'submitted')
    where ta.school_id = student_subject_results.school_id
      and ta.subject_id = student_subject_results.subject_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
)
with check (
  exists (
    select 1 from public.teacher_assignments ta
    join public.staff st on st.id = ta.staff_id and st.school_id = ta.school_id
    join public.student_term_results tr
      on tr.school_id = ta.school_id and tr.class_id = ta.class_id
      and tr.academic_session_id = ta.academic_session_id
      and tr.id = student_subject_results.term_result_id
      and tr.student_id = student_subject_results.student_id
      and tr.workflow_status in ('draft', 'submitted')
    where ta.school_id = student_subject_results.school_id
      and ta.subject_id = student_subject_results.subject_id
      and st.user_id = (select auth.uid()) and st.status = 'active'
      and public.has_school_role(ta.school_id, array['teacher']::public.school_role[])
  )
);
