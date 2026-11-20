-- Require a fully active, same-school parent account and guardian/student relationship.
-- The existing live schema stores relationship activity in parent_student_portal_access;
-- student_parent_guardians represents the underlying relationship and has no is_active column.

CREATE OR REPLACE FUNCTION public.parent_can_access_guardian(p_parent_guardian_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.parents_guardians AS guardian
    JOIN public.people AS person
      ON person.id = guardian.person_id
     AND person.school_id = guardian.school_id
    JOIN public.parent_portal_accounts AS portal_account
      ON portal_account.parent_guardian_id = guardian.id
     AND portal_account.school_id = guardian.school_id
     AND portal_account.user_id = person.user_id
     AND portal_account.is_active = TRUE
    JOIN public.school_memberships AS membership
      ON membership.user_id = person.user_id
     AND membership.school_id = guardian.school_id
     AND membership.role::text = 'parent'
     AND membership.status::text = 'active'
    WHERE guardian.id = p_parent_guardian_id
      AND person.user_id = (SELECT auth.uid())
      AND guardian.portal_enabled = TRUE
  );
$function$;

CREATE OR REPLACE FUNCTION public.parent_can_access_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.people AS person
    JOIN public.parents_guardians AS guardian
      ON guardian.person_id = person.id
     AND guardian.school_id = person.school_id
    JOIN public.parent_portal_accounts AS portal_account
      ON portal_account.parent_guardian_id = guardian.id
     AND portal_account.school_id = guardian.school_id
     AND portal_account.user_id = person.user_id
     AND portal_account.is_active = TRUE
    JOIN public.school_memberships AS membership
      ON membership.user_id = person.user_id
     AND membership.school_id = guardian.school_id
     AND membership.role::text = 'parent'
     AND membership.status::text = 'active'
    JOIN public.student_parent_guardians AS relationship
      ON relationship.parent_guardian_id = guardian.id
     AND relationship.school_id = guardian.school_id
    JOIN public.parent_student_portal_access AS access_link
      ON access_link.parent_guardian_id = guardian.id
     AND access_link.school_id = guardian.school_id
     AND access_link.student_id = relationship.student_id
     AND access_link.is_active = TRUE
    JOIN public.students AS student
      ON student.id = access_link.student_id
     AND student.school_id = access_link.school_id
    WHERE person.user_id = (SELECT auth.uid())
      AND guardian.portal_enabled = TRUE
      AND student.id = p_student_id
      AND student.status = 'active'
  );
$function$;

-- Preserve authenticated RLS-policy execution; deny anonymous direct invocation.
REVOKE ALL ON FUNCTION public.parent_can_access_guardian(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parent_can_access_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_can_access_guardian(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parent_can_access_student(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.parent_can_access_guardian(uuid) IS
  'Returns true only for the signed-in user with an active same-school parent portal account and active parent membership.';

COMMENT ON FUNCTION public.parent_can_access_student(uuid) IS
  'Returns true only for the signed-in user with an active same-school parent portal account, active parent membership, active child-access link, matching guardian-student relationship, and active student.';
