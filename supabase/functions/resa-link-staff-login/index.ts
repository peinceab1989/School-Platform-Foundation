import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function clean(value: unknown, max = 254): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { success: false, error: "POST required." });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(503, { success: false, error: "The staff invitation service is not configured." });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { success: false, error: "An active administrator session is required." });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let invitedUserId: string | null = null;
  let schoolId = "";
  let staffId = "";
  let personId = "";
  let personLinked = false;
  let staffLinked = false;
  let membershipCreated = false;

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return reply(401, { success: false, error: "Your administrator session is invalid or expired." });

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return reply(400, { success: false, error: "A JSON object is required." });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return reply(400, { success: false, error: "A valid JSON request body is required." });
    }

    schoolId = clean(body.school_id, 36);
    staffId = clean(body.staff_id, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
      return reply(400, { success: false, error: "A valid school and staff record are required." });
    }

    const { data: moduleControl, error: moduleError } = await admin
      .from("nexus_module_controls").select("is_enabled")
      .eq("module_key", "staff_invitations").maybeSingle();
    if (moduleError || !moduleControl) return reply(503, { success: false, error: "Could not verify staff invitation availability." });
    if (!moduleControl.is_enabled) return reply(403, { success: false, error: "Staff invitations are disabled by the system administrator." });

    const { data: membership, error: membershipError } = await admin
      .from("school_memberships").select("role,status")
      .eq("school_id", schoolId).eq("user_id", authData.user.id).maybeSingle();
    if (membershipError) throw new Error("Could not verify administrator permissions.");
    if (!membership || membership.role !== "admin" || membership.status !== "active") {
      return reply(403, { success: false, error: "Only an active school administrator can invite staff." });
    }

    const { data: staff, error: staffError } = await admin
      .from("staff").select("id,school_id,person_id,user_id,staff_number,status")
      .eq("id", staffId).eq("school_id", schoolId).maybeSingle();
    if (staffError) throw new Error("Could not load the existing staff record.");
    if (!staff) return reply(404, { success: false, error: "The staff record was not found in this school." });
    if (staff.status !== "active") return reply(409, { success: false, error: "Only active staff records can be linked to a login." });
    if (staff.user_id) return reply(409, { success: false, error: "This staff record is already linked to a login account." });

    const { data: person, error: personError } = await admin
      .from("people").select("id,first_name,last_name,email,user_id")
      .eq("id", staff.person_id).eq("school_id", schoolId).maybeSingle();
    if (personError) throw new Error("Could not load the staff contact record.");
    if (!person) return reply(404, { success: false, error: "The staff contact record is missing." });
    personId = person.id;
    if (person.user_id) return reply(409, { success: false, error: "This staff contact is already linked to another login. Ask an administrator to review the record." });

    const email = clean(person.email).toLowerCase();
    if (!validEmail(email)) return reply(400, { success: false, error: "Add a valid, deliverable email address to this staff record before inviting them." });
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (domain.endsWith(".test") || domain.endsWith(".invalid") || domain === "example.com" || domain === "example.org") {
      return reply(400, { success: false, error: "This is a demo or placeholder email. Enter the staff member's real email address." });
    }

    for (let page = 1; page <= 10; page++) {
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) throw new Error("Could not check whether this email already has a sign-in account.");
      if ((users.users ?? []).some((item) => item.email?.toLowerCase() === email)) {
        return reply(409, { success: false, error: "This email already belongs to a RESA sign-in account. Do not attach a staff role to another person's login." });
      }
      if ((users.users ?? []).length < 1000) break;
    }

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://resa-school-portal.netlify.app/accept-invitation",
      data: {
        first_name: person.first_name,
        last_name: person.last_name,
        school_id: schoolId,
        invited_by: authData.user.id,
        role: "teacher",
        account_type: "teacher",
        staff_id: staffId,
      },
    });
    if (inviteError || !inviteData.user) {
      return reply(409, { success: false, error: "The invitation could not be created. Check the email address and Supabase Auth delivery settings." });
    }
    invitedUserId = inviteData.user.id;

    const { error: personUpdateError } = await admin.from("people")
      .update({ user_id: invitedUserId }).eq("id", personId).eq("school_id", schoolId).is("user_id", null);
    if (personUpdateError) throw new Error("Could not link the invited account to the staff contact.");
    personLinked = true;

    const { error: staffUpdateError } = await admin.from("staff")
      .update({ user_id: invitedUserId }).eq("id", staffId).eq("school_id", schoolId).is("user_id", null);
    if (staffUpdateError) throw new Error("Could not link the invited account to the existing staff record.");
    staffLinked = true;

    const { error: createMembershipError } = await admin.from("school_memberships").insert({
      school_id: schoolId, user_id: invitedUserId, role: "teacher", status: "invited",
    });
    if (createMembershipError) throw new Error("Could not create the teacher school membership.");
    membershipCreated = true;

    return reply(201, {
      success: true,
      message: "Invitation sent to the existing staff member. Teacher access remains pending until the invitation is accepted and an administrator approves the account.",
      staff: { staff_id: staffId, staff_number: staff.staff_number, user_id: invitedUserId, email, membership_status: "invited" },
    });
  } catch (error) {
    if (invitedUserId) {
      if (membershipCreated) await admin.from("school_memberships").delete().eq("school_id", schoolId).eq("user_id", invitedUserId).eq("role", "teacher");
      if (staffLinked) await admin.from("staff").update({ user_id: null }).eq("id", staffId).eq("school_id", schoolId).eq("user_id", invitedUserId);
      if (personLinked) await admin.from("people").update({ user_id: null }).eq("id", personId).eq("school_id", schoolId).eq("user_id", invitedUserId);
      await admin.auth.admin.deleteUser(invitedUserId);
    }
    console.error("resa-link-staff-login failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { success: false, error: "The existing staff login could not be linked. Check the function logs before retrying." });
  }
});
