-- Scope teacher access to learners in classes/sessions actually assigned to that teacher.
-- Admins retain school-wide access; students retain access to their own records;
-- parents are delegated to the hardened parent_can_access_student helper.

CREATE OR REPLACE FUNCTION public.can_access_student_record(
  p_school_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.students AS scope_student
      WHERE scope_student.id = p_student_id
        AND scope_student.school_id = p_school_id
    )
    AND (
      public.has_school_role(p_school_id, ARRAY['admin']::public.school_role[])
      OR EXISTS (
        SELECT 1
        FROM public.students AS student
        LEFT JOIN public.people AS person
          ON person.id = student.person_id
         AND person.school_id = student.school_id
        WHERE student.id = p_student_id
          AND student.school_id = p_school_id
          AND (
            student.user_id = auth.uid()
            OR person.user_id = auth.uid()
          )
      )
      OR (
        public.has_school_role(p_school_id, ARRAY['teacher']::public.school_role[])
        AND EXISTS (
          SELECT 1
          FROM public.students AS student
          JOIN public.student_enrollments AS enrollment
            ON enrollment.student_id = student.id
           AND enrollment.school_id = student.school_id
           AND enrollment.status = 'active'
          JOIN public.staff AS staff
            ON staff.school_id = student.school_id
           AND staff.user_id = auth.uid()
           AND staff.status = 'active'
          WHERE student.id = p_student_id
            AND student.school_id = p_school_id
            AND student.status = 'active'
            AND (
              EXISTS (
                SELECT 1
                FROM public.teacher_assignments AS assignment
                WHERE assignment.school_id = enrollment.school_id
                  AND assignment.staff_id = staff.id
                  AND assignment.class_id = enrollment.class_id
                  AND assignment.academic_session_id = enrollment.academic_session_id
              )
              OR EXISTS (
                SELECT 1
                FROM public.class_form_teachers AS form_teacher
                WHERE form_teacher.school_id = enrollment.school_id
                  AND form_teacher.staff_id = staff.id
                  AND form_teacher.class_id = enrollment.class_id
                  AND form_teacher.academic_session_id = enrollment.academic_session_id
              )
              OR EXISTS (
                SELECT 1
                FROM public.class_timetables AS timetable
                WHERE timetable.school_id = enrollment.school_id
                  AND timetable.staff_id = staff.id
                  AND timetable.class_id = enrollment.class_id
                  AND timetable.academic_session_id = enrollment.academic_session_id
              )
            )
        )
      )
      OR (
        public.has_school_role(p_school_id, ARRAY['parent']::public.school_role[])
        AND public.parent_can_access_student(p_student_id)
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_access_student_record(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_student_record(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_access_student_record(uuid, uuid) IS
  'Allows admins school-wide, students themselves, active parents through the hardened parent helper, and teachers only for active learners enrolled in classes/sessions assigned to that teacher.';
