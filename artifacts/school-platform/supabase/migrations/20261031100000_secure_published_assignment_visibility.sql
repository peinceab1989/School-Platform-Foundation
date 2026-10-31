-- Ensure student and linked-parent assignment reads are limited to published
-- work for the learner's active class and exact academic session.
drop policy if exists "authorized users can read assignments" on public.assignments;
create policy "authorized users can read assignments"
on public.assignments
for select
to authenticated
using (
  has_school_role(school_id, array['admin'::school_role])
  or exists (
    select 1
    from public.staff s
    where s.id = assignments.staff_id
      and s.school_id = assignments.school_id
      and s.user_id = (select auth.uid())
      and s.status = 'active'
      and has_school_role(assignments.school_id, array['teacher'::school_role])
  )
  or exists (
    select 1
    from public.class_timetables ct
    join public.staff s
      on s.id = ct.staff_id and s.school_id = ct.school_id
    where ct.school_id = assignments.school_id
      and ct.class_id = assignments.class_id
      and ct.subject_id = assignments.subject_id
      and s.user_id = (select auth.uid())
      and s.status = 'active'
      and has_school_role(assignments.school_id, array['teacher'::school_role])
  )
  or (
    assignments.status = 'published'
    and exists (
      select 1
      from public.student_enrollments se
      join public.students st
        on st.id = se.student_id and st.school_id = se.school_id
      where se.school_id = assignments.school_id
        and se.class_id = assignments.class_id
        and se.academic_session_id = assignments.academic_session_id
        and se.status = 'active'
        and st.status = 'active'
        and (
          st.user_id = (select auth.uid())
          or public.parent_can_access_student(st.id)
        )
    )
  )
);
