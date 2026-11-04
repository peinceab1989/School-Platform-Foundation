-- Allow an authenticated student to submit their own work only for a published
-- assignment attached to their active class and academic-session enrolment.
-- No student UPDATE policy is added: submitted work and teacher grading fields
-- remain immutable to the student after the first submission.

drop policy if exists "active students can submit own published assignments"
on public.assignment_submissions;

create policy "active students can submit own published assignments"
on public.assignment_submissions
for insert
to authenticated
with check (
  status = 'submitted'
  and submitted_at is not null
  and score is null
  and feedback is null
  and graded_by is null
  and graded_at is null
  and has_school_role(school_id, array['student'::public.school_role])
  and exists (
    select 1
    from public.students st
    join public.assignments a
      on a.school_id = st.school_id
     and a.id = assignment_submissions.assignment_id
     and a.status = 'published'
    join public.student_enrollments se
      on se.school_id = st.school_id
     and se.student_id = st.id
     and se.class_id = a.class_id
     and se.academic_session_id = a.academic_session_id
     and se.status = 'active'
    where st.id = assignment_submissions.student_id
      and st.school_id = assignment_submissions.school_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
  )
);
