import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  Database,
  MembershipStatus,
  SchoolRole,
} from '@/lib/supabase/database.types';

export interface SchoolMembership {
  id: string;
  schoolId: string;
  schoolName: string;
  role: SchoolRole;
  status: MembershipStatus;
}

export interface AccessCheckResult {
  passed: boolean;
  membershipCount: number;
  checkedAt: string;
  message: string;
}

export async function runMembershipAccessCheck(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<{ result: AccessCheckResult; memberships: SchoolMembership[] }> {
  if (!userId) {
    throw new Error('A signed-in user is required to check school access.');
  }

  // Read only memberships belonging to the signed-in user.
  const { data: visibleMemberships, error: membershipError } = await client
    .from('school_memberships')
    .select('id, school_id, user_id, role, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (membershipError) {
    throw new Error(
      `Could not read school access records. Confirm the Phase 1 SQL migration and access policies. ${membershipError.message}`,
    );
  }

  const membershipsData = visibleMemberships ?? [];

  // Retain this safeguard in case an unexpected record is returned.
  const foreignMemberships = membershipsData.filter(
    (membership) => membership.user_id !== userId,
  );

  if (foreignMemberships.length > 0) {
    return {
      memberships: [],
      result: {
        passed: false,
        membershipCount: membershipsData.length,
        checkedAt: new Date().toISOString(),
        message:
          'The database returned an access record for another account. Do not use this project until its access policies are corrected.',
      },
    };
  }

  const schoolIds = [
    ...new Set(membershipsData.map((row) => row.school_id)),
  ];
  const schoolNames = new Map<string, string>();

  if (schoolIds.length > 0) {
    const { data: visibleSchools, error: schoolError } = await client
      .from('schools')
      .select('id, name')
      .in('id', schoolIds);

    if (schoolError) {
      throw new Error(
        `Could not confirm school access. Confirm the Phase 1 SQL migration and access policies. ${schoolError.message}`,
      );
    }

    for (const school of visibleSchools ?? []) {
      schoolNames.set(school.id, school.name);
    }
  }

  const memberships: SchoolMembership[] = membershipsData.map((row) => ({
    id: row.id,
    schoolId: row.school_id,
    schoolName: schoolNames.get(row.school_id) ?? 'School unavailable',
    role: row.role,
    status: row.status,
  }));

  const checkedAt = new Date().toISOString();

  return {
    memberships,
    result: {
      passed: true,
      membershipCount: memberships.length,
      checkedAt,
      message:
        memberships.length > 0
          ? 'The database returned only memberships linked to this signed-in account.'
          : 'No school memberships are linked to this account yet.',
    },
  };
}

export async function confirmUnknownSchoolIsDenied(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  const unknownSchoolId = crypto.randomUUID();

  const { data, error } = await client.rpc('has_school_role', {
    p_school_id: unknownSchoolId,
    p_roles: null,
  });

  if (error) {
    throw new Error(
      `Could not run the role helper check. Confirm the Phase 1 SQL migration has been applied. ${error.message}`,
    );
  }

  return data === false;
}