-- Ensure every parent-facing policy uses the same active guardian/account/membership
-- checks as parent_can_access_guardian and parent_can_access_student.

DROP POLICY IF EXISTS "collection_authorizations_parent_read" ON public.child_collection_authorizations;
CREATE POLICY "collection_authorizations_parent_read"
ON public.child_collection_authorizations
FOR SELECT TO authenticated
USING (
  public.parent_can_access_guardian(parent_guardian_id)
);

DROP POLICY IF EXISTS "collection_authorizations_parent_request" ON public.child_collection_authorizations;
CREATE POLICY "collection_authorizations_parent_request"
ON public.child_collection_authorizations
FOR INSERT TO authenticated
WITH CHECK (
  approval_status = 'pending'
  AND requested_by = auth.uid()
  AND reviewed_by IS NULL
  AND public.parent_can_access_guardian(parent_guardian_id)
  AND public.parent_can_access_student(student_id)
);

DROP POLICY IF EXISTS "parent_official_requests_parent_read" ON public.parent_official_access_requests;
CREATE POLICY "parent_official_requests_parent_read"
ON public.parent_official_access_requests
FOR SELECT TO authenticated
USING (
  public.parent_can_access_guardian(parent_guardian_id)
);

DROP POLICY IF EXISTS "parent_official_requests_parent_submit" ON public.parent_official_access_requests;
CREATE POLICY "parent_official_requests_parent_submit"
ON public.parent_official_access_requests
FOR INSERT TO authenticated
WITH CHECK (
  request_status = 'pending'
  AND requested_by = auth.uid()
  AND reviewed_by IS NULL
  AND public.parent_can_access_guardian(parent_guardian_id)
  AND (student_id IS NULL OR public.parent_can_access_student(student_id))
);

DROP POLICY IF EXISTS "parents manage own attendance notification preferences" ON public.parent_attendance_notification_preferences;
CREATE POLICY "parents manage own attendance notification preferences"
ON public.parent_attendance_notification_preferences
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND public.parent_can_access_guardian(parent_guardian_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.parent_can_access_guardian(parent_guardian_id)
);
