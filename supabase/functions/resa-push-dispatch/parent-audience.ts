export type ParentStudentLink = { parent_guardian_id: string; is_active: boolean };
export type ParentStudentAccess = { parent_guardian_id: string; is_active: boolean };
export type ParentGuardian = { id: string; person_id: string; portal_enabled: boolean };
export type ParentPerson = { id: string; user_id: string | null };
export type ParentPortalAccount = { user_id: string; parent_guardian_id: string; is_active: boolean };
export type ParentMembership = { user_id: string; role: string; status: string };

export type ParentAudienceInput = {
  studentLinks: ParentStudentLink[];
  activeAccess: ParentStudentAccess[];
  guardians: ParentGuardian[];
  people: ParentPerson[];
  accounts: ParentPortalAccount[];
  memberships: ParentMembership[];
  requestedGuardianIds?: string[];
};

/**
 * Pure fail-closed filter for a single school/student's parent notification
 * audience. Every relationship and account state must agree on the same
 * guardian, person, user and school-scoped membership (the caller scopes
 * database reads to the school and exact student).
 */
export function resolveEligibleParentUserIds(input: ParentAudienceInput): string[] {
  const linked = new Set(input.studentLinks.filter((row) => row.is_active).map((row) => row.parent_guardian_id));
  const requested = input.requestedGuardianIds?.length
    ? new Set(input.requestedGuardianIds)
    : null;
  const activeAccess = new Set(input.activeAccess
    .filter((row) => row.is_active && linked.has(row.parent_guardian_id) &&
      (!requested || requested.has(row.parent_guardian_id)))
    .map((row) => row.parent_guardian_id));

  const enabledGuardians = input.guardians.filter((row) =>
    row.portal_enabled && activeAccess.has(row.id)
  );
  const userByGuardian = new Map<string, string>();
  const personUser = new Map(input.people
    .filter((row) => Boolean(row.user_id))
    .map((row) => [row.id, row.user_id as string]));

  for (const guardian of enabledGuardians) {
    const userId = personUser.get(guardian.person_id);
    if (userId) userByGuardian.set(guardian.id, userId);
  }

  const activeParentMemberships = new Set(input.memberships
    .filter((row) => row.role === "parent" && row.status === "active")
    .map((row) => row.user_id));

  return [...new Set(input.accounts
    .filter((row) => row.is_active &&
      userByGuardian.get(row.parent_guardian_id) === row.user_id &&
      activeParentMemberships.has(row.user_id))
    .map((row) => row.user_id))];
}
