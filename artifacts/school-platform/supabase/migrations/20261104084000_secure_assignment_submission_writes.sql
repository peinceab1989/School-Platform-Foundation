-- Secure assignment submission writes for students and grading updates for assigned teachers.
-- Students may submit only for their own active enrolment and only while work is published.
-- Teachers may grade only submissions for classes/subjects assigned to their active staff profile.

drop policy if exists "students can submit own published assignments" on public.assignment_submissions;
create policy "students can submit own published assignments"
on public.assignment_submissions
for insert
to authenticated
with check (
  status <> 'graded'
  and score is null
  and feedback is null
  and graded_by is null
  and graded_at is null
  and has_school_role(school_id, array['student'::school_role])
  and exists (
    select 1
    from public.students st
    join public.student_enrollments se
      on se.student_id = st.id
     and se.school_id = st.school_id
    join public.assignments a
      on a.id = assignment_submissions.assignment_id
     and a.school_id = assignment_submissions.school_id
    where st.id = assignment_submissions.student_id
      and st.school_id = assignment_submissions.school_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
      and se.status = 'active'
      and se.class_id = a.class_id
      and se.academic_session_id = a.academic_session_id
      and a.status = 'published'
  )
);

drop policy if exists "students can update own ungraded submissions" on public.assignment_submissions;
create policy "students can update own ungraded submissions"
on public.assignment_submissions
for update
to authenticated
using (
  status <> 'graded'
  and has_school_role(school_id, array['student'::school_role])
  and exists (
    select 1
    from public.students st
    join public.student_enrollments se
      on se.student_id = st.id
     and se.school_id = st.school_id
    join public.assignments a
      on a.id = assignment_submissions.assignment_id
     and a.school_id = assignment_submissions.school_id
    where st.id = assignment_submissions.student_id
      and st.school_id = assignment_submissions.school_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
      and se.status = 'active'
      and se.class_id = a.class_id
      and se.academic_session_id = a.academic_session_id
      and a.status = 'published'
  )
)
with check (
  has_school_role(school_id, array['student'::school_role])
  and exists (
    select 1
    from public.students st
    join public.student_enrollments se
      on se.student_id = st.id
     and se.school_id = st.school_id
    join public.assignments a
      on a.id = assignment_submissions.assignment_id
     and a.school_id = assignment_submissions.school_id
    where st.id = assignment_submissions.student_id
      and st.school_id = assignment_submissions.school_id
      and st.user_id = (select auth.uid())
      and st.status = 'active'
      and se.status = 'active'
      and se.class_id = a.class_id
      and se.academic_session_id = a.academic_session_id
      and a.status = 'published'
  )
);

drop policy if exists "assigned teachers can grade assignment submissions" on public.assignment_submissions;
create policy "assigned teachers can grade assignment submissions"
on public.assignment_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    join public.teacher_assignments ta
      on ta.school_id = a.school_id
     and ta.staff_id = a.staff_id
     and ta.academic_session_id = a.academic_session_id
     and ta.class_id = a.class_id
     and ta.subject_id = a.subject_id
    join public.staff s
      on s.id = ta.staff_id
     and s.school_id = ta.school_id
    where a.id = assignment_submissions.assignment_id
      and a.school_id = assignment_submissions.school_id
      and s.user_id = (select auth.uid())
      and s.status = 'active'
      and has_school_role(a.school_id, array['teacher'::school_role])
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    join public.teacher_assignments ta
      on ta.school_id = a.school_id
     and ta.staff_id = a.staff_id
     and ta.academic_session_id = a.academic_session_id
     and ta.class_id = a.class_id
     and ta.subject_id = a.subject_id
    join public.staff s
      on s.id = ta.staff_id
     and s.school_id = ta.school_id
    where a.id = assignment_submissions.assignment_id
      and a.school_id = assignment_submissions.school_id
      and s.user_id = (select auth.uid())
      and s.status = 'active'
      and has_school_role(a.school_id, array['teacher'::school_role])
  )
);
