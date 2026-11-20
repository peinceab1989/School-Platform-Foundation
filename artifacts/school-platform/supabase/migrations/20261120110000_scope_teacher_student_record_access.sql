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


-- Remove school-wide teacher reads of sensitive learner and person records.
DROP POLICY IF EXISTS "school staff can read students" ON public.students;
CREATE POLICY "authorised users can read scoped student records"
ON public.students
FOR SELECT TO authenticated
USING (public.can_access_student_record(school_id, id));

DROP POLICY IF EXISTS "school staff can read people" ON public.people;
CREATE POLICY "school members can read linked student and guardian people"
ON public.people
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.person_id = people.id
      AND student.school_id = people.school_id
      AND public.can_access_student_record(student.school_id, student.id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.parents_guardians AS guardian
    JOIN public.student_parent_guardians AS relationship
      ON relationship.parent_guardian_id = guardian.id
     AND relationship.school_id = guardian.school_id
    WHERE guardian.person_id = people.id
      AND guardian.school_id = people.school_id
      AND public.can_access_student_record(relationship.school_id, relationship.student_id)
  )
);

DROP POLICY IF EXISTS "school members can read form submissions" ON public.school_form_submissions;
CREATE POLICY "authorised users can read scoped form submissions"
ON public.school_form_submissions
FOR SELECT TO authenticated
USING (
  has_school_role(school_id, ARRAY['admin']::public.school_role[])
  OR submitted_by = (SELECT auth.uid())
  OR (
    student_id IS NOT NULL
    AND public.can_access_student_record(school_id, student_id)
  )
);

-- Child-collection records are student-specific; do not expose the whole school's
-- release log to every teacher or every parent account.
DROP POLICY IF EXISTS "child_collection_releases_parent_read_own" ON public.child_collection_releases;
DROP POLICY IF EXISTS "child_collection_releases_school_staff_read" ON public.child_collection_releases;
CREATE POLICY "authorised users can read scoped child collection releases"
ON public.child_collection_releases
FOR SELECT TO authenticated
USING (
  has_school_role(school_id, ARRAY['admin']::public.school_role[])
  OR (
    student_id IS NOT NULL
    AND public.can_access_student_record(school_id, student_id)
  )
);

DROP POLICY IF EXISTS "child_collection_releases_staff_append" ON public.child_collection_releases;
CREATE POLICY "admins and assigned teachers can append child collection releases"
ON public.child_collection_releases
FOR INSERT TO authenticated
WITH CHECK (
  released_by = (SELECT auth.uid())
  AND (
    has_school_role(school_id, ARRAY['admin']::public.school_role[])
    OR (
      has_school_role(school_id, ARRAY['teacher']::public.school_role[])
      AND student_id IS NOT NULL
      AND public.can_access_student_record(school_id, student_id)
    )
  )
);

-- Route and pickup-point details are visible only to administrators and families/
-- teachers/students who can access a currently assigned learner on that route.
DROP POLICY IF EXISTS "assigned families and staff can read pickup points" ON public.transport_pickup_points;
CREATE POLICY "authorised families and teachers can read assigned pickup points"
ON public.transport_pickup_points
FOR SELECT TO authenticated
USING (
  has_school_role(school_id, ARRAY['admin']::public.school_role[])
  OR EXISTS (
    SELECT 1
    FROM public.student_transport_assignments AS assignment
    WHERE assignment.route_id = transport_pickup_points.route_id
      AND assignment.school_id = transport_pickup_points.school_id
      AND assignment.pickup_point_id = transport_pickup_points.id
      AND assignment.status = 'active'
      AND (assignment.end_date IS NULL OR assignment.end_date >= CURRENT_DATE)
      AND public.can_access_student_record(assignment.school_id, assignment.student_id)
  )
);

DROP POLICY IF EXISTS "authorised staff and assigned families can read transport route" ON public.transport_routes;
CREATE POLICY "authorised families and teachers can read assigned transport routes"
ON public.transport_routes
FOR SELECT TO authenticated
USING (
  has_school_role(school_id, ARRAY['admin']::public.school_role[])
  OR EXISTS (
    SELECT 1
    FROM public.student_transport_assignments AS assignment
    WHERE assignment.route_id = transport_routes.id
      AND assignment.school_id = transport_routes.school_id
      AND assignment.status = 'active'
      AND (assignment.end_date IS NULL OR assignment.end_date >= CURRENT_DATE)
      AND public.can_access_student_record(assignment.school_id, assignment.student_id)
  )
);
