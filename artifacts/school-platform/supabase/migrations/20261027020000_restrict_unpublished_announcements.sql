-- Restrict announcement reads to published items for ordinary school members.
-- Administrators retain access to drafts through the existing admin management policy.
DROP POLICY IF EXISTS "school members can read announcements" ON public.announcements;

CREATE POLICY "school members can read announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  is_published = true
  AND public.has_school_role(school_id)
);
