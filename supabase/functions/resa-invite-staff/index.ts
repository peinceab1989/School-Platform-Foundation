
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function cleanText(value: unknown, maxLength = 100): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function generateStaffNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return `RESA-${suffix}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return reply(405, {
      success: false,
      error: "Method not allowed.",
    });
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return reply(500, {
      success: false,
      error: "Server configuration is incomplete.",
    });
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, {
      success: false,
      error: "Authentication is required.",
    });
  }

  const userClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const adminClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data: moduleControl, error: moduleControlError } = await adminClient.from("nexus_module_controls").select("is_enabled").eq("module_key", "staff_invitations").maybeSingle();
  if (moduleControlError || !moduleControl) return reply(503, { error: "Could not verify staff invitations availability." });
  if (!moduleControl.is_enabled) return reply(403, { error: "Staff invitations are currently disabled by the system administrator." });

  let invitedUserId: string | null = null;
  let invitedSchoolId: string | null = null;
  let personId: string | null = null;
  let membershipCreated = false;
  let staffCreated = false;
  let staffNumberCreated: string | null = null;

  try {
    // 1. Verify the caller's authenticated identity.
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return reply(401, {
        success: false,
        error: "Your session is invalid or expired.",
      });
    }

    // 2. Validate the request body.
    let parsedBody: unknown;

    try {
      parsedBody = await req.json();
    } catch {
      return reply(400, {
        success: false,
        error: "A valid JSON request body is required.",
      });
    }

    if (
      !parsedBody ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      return reply(400, {
        success: false,
        error: "The request body must be a JSON object.",
      });
    }

    const body = parsedBody as Record<string, unknown>;

    const schoolId = cleanText(body.school_id, 36);
    const email = cleanText(body.email, 254).toLowerCase();
    const firstName = cleanText(body.first_name, 100);
    const lastName = cleanText(body.last_name, 100);
    const phone = cleanText(body.phone, 30);
    const jobTitle = cleanText(body.job_title, 100);
    const department = cleanText(body.department, 100);

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(schoolId)
    ) {
      return reply(400, {
        success: false,
        error: "A valid school_id is required.",
      });
    }

    if (
      !validEmail(email) ||
      !firstName ||
      !lastName
    ) {
      return reply(400, {
        success: false,
        error: "A valid email, first name, and last name are required.",
      });
    }

    invitedSchoolId = schoolId;

    // 3. Confirm that the school exists.
    const { data: school, error: schoolError } =
      await adminClient
        .from("schools")
        .select("id")
        .eq("id", schoolId)
        .maybeSingle();

    if (schoolError) {
      throw new Error("Could not verify the school.");
    }

    if (!school) {
      return reply(404, {
        success: false,
        error: "School not found.",
      });
    }

    // 4. Only an active administrator of this school may invite staff.
    const { data: membership, error: membershipError } =
      await adminClient
        .from("school_memberships")
        .select("id, role, status")
        .eq("school_id", schoolId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (membershipError) {
      throw new Error("Could not verify administrator permissions.");
    }

    if (
      !membership ||
      membership.role !== "admin" ||
      membership.status !== "active"
    ) {
      return reply(403, {
        success: false,
        error:
          "An active school administrator must authorize this action.",
      });
    }

    // 5. Prevent duplicate people in this school.
    const { data: existingPerson, error: personLookupError } =
      await adminClient
        .from("people")
        .select("id")
        .eq("school_id", schoolId)
        .ilike("email", email)
        .maybeSingle();

    if (personLookupError) {
      throw new Error("Could not check existing person records.");
    }

    if (existingPerson) {
      return reply(409, {
        success: false,
        error:
          "A person with this email already exists in this school.",
      });
    }

    // 6. Send the invitation. The role is fixed to teacher.
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://resa-school-portal.netlify.app/accept-invitation",
        data: {
          first_name: firstName,
          last_name: lastName,
          school_id: schoolId,
          invited_by: user.id,
        },
      });

    if (inviteError || !inviteData.user) {
      return reply(409, {
        success: false,
        error:
          "The invitation could not be created. Check whether this email already has an account and review Supabase Auth settings.",
      });
    }

    invitedUserId = inviteData.user.id;

    // 7. Create the person's school record.
    const { data: person, error: createPersonError } =
      await adminClient
        .from("people")
        .insert({
          school_id: schoolId,
          user_id: invitedUserId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
        })
        .select("id")
        .single();

    if (createPersonError || !person) {
      throw new Error("Could not create the person record.");
    }

    personId = person.id;

    // 8. Create a teacher membership in the invited state.
    // This does not grant active membership by itself.
    const { error: createMembershipError } =
      await adminClient
        .from("school_memberships")
        .insert({
          school_id: schoolId,
          user_id: invitedUserId,
          role: "teacher",
          status: "invited",
        });

    if (createMembershipError) {
      throw new Error("Could not create the teacher membership.");
    }

    membershipCreated = true;

    // 9. Allocate a unique staff number and create a pending staff record.
    let created = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      const staffNumber = generateStaffNumber();

      const { error: createStaffError } =
        await adminClient
          .from("staff")
          .insert({
            school_id: schoolId,
            person_id: personId,
            user_id: invitedUserId,
            staff_number: staffNumber,
            job_title: jobTitle || null,
            department: department || null,
            status: "pending",
          });

      if (!createStaffError) {
        created = true;
        staffCreated = true;
        staffNumberCreated = staffNumber;
        break;
      }

      // Retry only for the staff-number unique constraint.
      const errorText = [
        createStaffError.message,
        createStaffError.details,
        createStaffError.hint,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const isStaffNumberCollision =
        createStaffError.code === "23505" &&
        errorText.includes("staff_school_id_staff_number_key");

      if (!isStaffNumberCollision) {
        throw new Error("Could not create the staff record.");
      }
    }

    if (!created || !staffNumberCreated) {
      throw new Error("Could not allocate a unique staff number.");
    }

    return reply(201, {
      success: true,
      message:
        "Staff invitation created. Teacher access remains pending approval.",
      staff: {
        user_id: invitedUserId,
        person_id: personId,
        staff_number: staffNumberCreated,
        email,
        role: "teacher",
        membership_status: "invited",
        staff_status: "pending",
      },
    });
  } catch (error) {
    // 10. Compensate for partial database writes.
    // Cleanup is limited to this invited user and school.
    if (invitedUserId && invitedSchoolId) {
      if (staffCreated) {
        const { error: rollbackStaffError } =
          await adminClient
            .from("staff")
            .delete()
            .eq("school_id", invitedSchoolId)
            .eq("user_id", invitedUserId);

        if (rollbackStaffError) {
          console.error("Staff rollback failed.");
        }
      }

      if (membershipCreated) {
        const { error: rollbackMembershipError } =
          await adminClient
            .from("school_memberships")
            .delete()
            .eq("school_id", invitedSchoolId)
            .eq("user_id", invitedUserId)
            .eq("role", "teacher");

        if (rollbackMembershipError) {
          console.error("Membership rollback failed.");
        }
      }

      if (personId) {
        const { error: rollbackPersonError } =
          await adminClient
            .from("people")
            .delete()
            .eq("school_id", invitedSchoolId)
            .eq("id", personId);

        if (rollbackPersonError) {
          console.error("Person rollback failed.");
        }
      }

      const { error: rollbackUserError } =
        await adminClient.auth.admin.deleteUser(invitedUserId);

      if (rollbackUserError) {
        console.error("Auth user rollback failed.");
      }
    }

    console.error(
      "resa-invite-staff failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return reply(500, {
      success: false, 
      error:
        "The invitation could not be completed. Check the function logs before retrying.",
    });
  }
});
