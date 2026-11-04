-- Allow learners to submit only their own work for published assignments
-- in their currently active class/session. Teachers may grade only work
-- belonging to an assignment allocated to their active staff account.
-- Existing SELECT and school-admin ALL policies are intentionally preserved.

DROP POLICY IF EXISTS "students can submit own published assignments" ON public.assignment_submissions;
CREATE POLICY "students can submit own published assignments"
ON public.assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'submitted'
  AND score IS NULL
  AND feedback IS NULL
  AND graded_by IS NULL
  AND graded_at IS NULL
  AND submitted_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.student_enrollments se
      ON se.student_id = st.id
     AND se.school_id = st.school_id
    JOIN public.assignments a
      ON a.school_id = se.school_id
     AND a.class_id = se.class_id
     AND a.academic_session_id = se.academic_session_id
    WHERE st.id = assignment_submissions.student_id
      AND st.school_id = assignment_submissions.school_id
      AND st.user_id = (SELECT auth.uid())
      AND st.status = 'active'
      AND se.status = 'active'
      AND a.id = assignment_submissions.assignment_id
      AND a.status = 'published'
      AND a.school_id = assignment_submissions.school_id
  )
);

DROP POLICY IF EXISTS "students can update own ungraded submissions" ON public.assignment_submissions;
CREATE POLICY "students can update own ungraded submissions"
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
  status <> 'graded'
  AND EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.student_enrollments se
      ON se.student_id = st.id
     AND se.school_id = st.school_id
    JOIN public.assignments a
      ON a.school_id = se.school_id
     AND a.class_id = se.class_id
     AND a.academic_session_id = se.academic_session_id
    WHERE st.id = assignment_submissions.student_id
      AND st.school_id = assignment_submissions.school_id
      AND st.user_id = (SELECT auth.uid())
      AND st.status = 'active'
      AND se.status = 'active'
      AND a.id = assignment_submissions.assignment_id
      AND a.status = 'published'
      AND a.school_id = assignment_submissions.school_id
  )
)
WITH CHECK (
  status = 'submitted'
  AND score IS NULL
  AND feedback IS NULL
  AND graded_by IS NULL
  AND graded_at IS NULL
  AND submitted_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.student_enrollments se
      ON se.student_id = st.id
     AND se.school_id = st.school_id
    JOIN public.assignments a
      ON a.school_id = se.school_id
     AND a.class_id = se.class_id
     AND a.academic_session_id = se.academic_session_id
    WHERE st.id = assignment_submissions.student_id
      AND st.school_id = assignment_submissions.school_id
      AND st.user_id = (SELECT auth.uid())
      AND st.status = 'active'
      AND se.status = 'active'
      AND a.id = assignment_submissions.assignment_id
      AND a.status = 'published'
      AND a.school_id = assignment_submissions.school_id
  )
);

DROP POLICY IF EXISTS "assigned active teachers can grade assignment submissions" ON public.assignment_submissions;
CREATE POLICY "assigned active teachers can grade assignment submissions"
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.staff s
      ON s.id = a.staff_id
     AND s.school_id = a.school_id
    JOIN public.teacher_assignments ta
      ON ta.school_id = a.school_id
     AND ta.staff_id = s.id
     AND ta.academic_session_id = a.academic_session_id
     AND ta.class_id = a.class_id
     AND ta.subject_id = a.subject_id
    WHERE a.id = assignment_submissions.assignment_id
      AND a.school_id = assignment_submissions.school_id
      AND s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
      AND has_school_role(a.school_id, ARRAY['teacher'::school_role])
  )
)
WITH CHECK (
  status = 'graded'
  AND graded_by = (SELECT auth.uid())
  AND graded_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.staff s
      ON s.id = a.staff_id
     AND s.school_id = a.school_id
    JOIN public.teacher_assignments ta
      ON ta.school_id = a.school_id
     AND ta.staff_id = s.id
     AND ta.academic_session_id = a.academic_session_id
     AND ta.class_id = a.class_id
     AND ta.subject_id = a.subject_id
    WHERE a.id = assignment_submissions.assignment_id
      AND a.school_id = assignment_submissions.school_id
      AND s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
      AND has_school_role(a.school_id, ARRAY['teacher'::school_role])
  )
);
