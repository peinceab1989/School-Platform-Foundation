import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { success: false, error: "POST required." });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(500, { success: false, error: "Server configuration is incomplete." });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { success: false, error: "An active administrator session is required." });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let invitedUserId: string | null = null;
  let parentId: string | null = null;
  let personId: string | null = null;
  let schoolId: string | null = null;

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (userError || !caller) return reply(401, { success: false, error: "Your session is invalid or expired." });

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

    schoolId = typeof body.school_id === "string" ? body.school_id.trim() : "";
    parentId = typeof body.parent_guardian_id === "string" ? body.parent_guardian_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentId)) {
      return reply(400, { success: false, error: "A valid school and parent record are required." });
    }

    const { data: moduleControl, error: moduleError } = await adminClient
      .from("nexus_module_controls").select("is_enabled")
      .eq("module_key", "parent_portal").maybeSingle();
    if (moduleError || !moduleControl) return reply(503, { success: false, error: "Could not verify parent portal availability." });
    if (!moduleControl.is_enabled) return reply(403, { success: false, error: "The parent portal is disabled by the system administrator." });

    const { data: membership, error: membershipError } = await adminClient
      .from("school_memberships").select("role,status")
      .eq("school_id", schoolId).eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (membershipError) throw new Error("Could not verify administrator permissions.");
    if (!membership || membership.status !== "active") {
      return reply(403, { success: false, error: "Only an active school administrator can invite a parent." });
    }

    const { data: guardian, error: guardianError } = await adminClient
      .from("parents_guardians")
      .select("id,school_id,person_id,relationship")
      .eq("id", parentId).eq("school_id", schoolId).maybeSingle();
    if (guardianError) throw new Error("Could not load the parent record.");
    if (!guardian) return reply(404, { success: false, error: "Parent record not found in this school." });

    const { data: person, error: personError } = await adminClient
      .from("people").select("id,first_name,last_name,email,phone,user_id")
      .eq("id", guardian.person_id).eq("school_id", schoolId).maybeSingle();
    if (personError) throw new Error("Could not load the parent's contact record.");
    if (!person) return reply(404, { success: false, error: "The parent contact record is missing." });

    const email = typeof person.email === "string" ? person.email.trim().toLowerCase() : "";
    if (!validEmail(email)) return reply(400, { success: false, error: "Add a valid parent email address before sending an invitation." });
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (domain.endsWith(".test") || domain.endsWith(".invalid") || domain === "example.com" || domain === "example.org") {
      return reply(400, { success: false, error: "This is a demo or placeholder email address. Enter the parent's real, deliverable email address." });
    }
    if (person.user_id) return reply(409, { success: false, error: "This parent contact is already linked to a sign-in account. Do not reuse another person's login." });

    const { data: linkedStudents, error: linksError } = await adminClient
      .from("student_parent_guardians").select("student_id,is_primary")
      .eq("school_id", schoolId).eq("parent_guardian_id", parentId);
    if (linksError) throw new Error("Could not verify the parent's linked students.");
    if (!linkedStudents?.length) return reply(400, { success: false, error: "Link this parent to at least one student before inviting them." });

    const { data: existingPortal, error: portalLookupError } = await adminClient
      .from("parent_portal_accounts").select("id,is_active,user_id")
      .eq("parent_guardian_id", parentId).maybeSingle();
    if (portalLookupError) throw new Error("Could not verify existing parent portal access.");
    if (existingPortal?.is_active) return reply(409, { success: false, error: "This parent already has an active portal account." });
    if (existingPortal) return reply(409, { success: false, error: "A parent invitation already exists for this record. Resolve that invitation before sending another." });

    let foundAuthUser = false;
    for (let page = 1; page <= 10; page++) {
      const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) throw new Error("Could not check whether the parent email already has a sign-in account.");
      if ((usersPage.users ?? []).some((item) => item.email?.toLowerCase() === email)) {
        foundAuthUser = true;
        break;
      }
      if ((usersPage.users ?? []).length < 1000) break;
    }
    if (foundAuthUser) {
      return reply(409, { success: false, error: "This email already belongs to a RESA sign-in account. Use a separate email for the parent; never attach a parent role to an administrator, teacher or student login." });
    }

    const requestOrigin = req.headers.get("origin") ?? "";
    const allowedOrigins = new Set([
      "https://resa-school-portal.netlify.app",
      "https://deploy-preview-9--resa-school-portal.netlify.app",
    ]);
    const redirectOrigin = allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : "https://resa-school-portal.netlify.app";
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${redirectOrigin}/accept-invitation`,
      data: {
        first_name: person.first_name,
        last_name: person.last_name,
        school_id: schoolId,
        parent_guardian_id: parentId,
        role: "parent",
        account_type: "parent",
        invited_by: caller.id,
      },
    });
    if (inviteError || !inviteData.user) {
      return reply(409, { success: false, error: "The parent invitation could not be created. Confirm the email is unused and check Supabase Auth email delivery settings." });
    }
    invitedUserId = inviteData.user.id;

    const { error: personUpdateError } = await adminClient.from("people")
      .update({ user_id: invitedUserId }).eq("id", person.id).eq("school_id", schoolId).is("user_id", null);
    if (personUpdateError) throw new Error("Could not link the invited account to the parent record.");
    personId = person.id;

    const { error: membershipInsertError } = await adminClient.from("school_memberships").insert({
      school_id: schoolId, user_id: invitedUserId, role: "parent", status: "invited",
    });
    if (membershipInsertError) throw new Error("Could not create the parent school membership.");

    const { error: portalInsertError } = await adminClient.from("parent_portal_accounts").insert({
      school_id: schoolId, parent_guardian_id: parentId, user_id: invitedUserId, is_active: false,
    });
    if (portalInsertError) throw new Error("Could not create the parent portal account.");

    const portalLinks = linkedStudents.map((link) => ({
      school_id: schoolId,
      parent_guardian_id: parentId,
      student_id: link.student_id,
      relationship: guardian.relationship,
      is_primary: link.is_primary,
      is_active: true,
    }));
    const { error: accessError } = await adminClient.from("parent_student_portal_access")
      .upsert(portalLinks, { onConflict: "parent_guardian_id,student_id" });
    if (accessError) throw new Error("Could not prepare the parent's student access links.");

    // Access remains off until the parent accepts the invitation and sets a password.
    const { error: guardianUpdateError } = await adminClient.from("parents_guardians")
      .update({ portal_enabled: false }).eq("id", parentId).eq("school_id", schoolId);
    if (guardianUpdateError) throw new Error("Could not keep parent access pending until activation.");

    return reply(201, {
      success: true,
      message: "Parent invitation sent. Access will activate after the parent verifies the invitation and creates a password.",
      parent: { parent_guardian_id: parentId, user_id: invitedUserId, email, role: "parent", membership_status: "invited", portal_status: "pending" },
    });
  } catch (error) {
    if (invitedUserId && schoolId) {
      await adminClient.from("parent_portal_accounts").delete().eq("school_id", schoolId).eq("user_id", invitedUserId);
      await adminClient.from("school_memberships").delete().eq("school_id", schoolId).eq("user_id", invitedUserId).eq("role", "parent");
      if (personId) await adminClient.from("people").update({ user_id: null }).eq("id", personId).eq("school_id", schoolId).eq("user_id", invitedUserId);
      await adminClient.auth.admin.deleteUser(invitedUserId);
    }
    console.error("resa-invite-parent failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { success: false, error: "The parent invitation could not be completed. Review the function logs before retrying." });
  }
});
