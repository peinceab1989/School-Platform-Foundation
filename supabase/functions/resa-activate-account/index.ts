import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { error: "A valid invitation session is required. Please reopen your latest invitation email." });
  }

  try {
    const token = authorization.slice("Bearer ".length).trim();
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user?.id || !user.email) {
      return reply(401, { error: "Your invitation session is invalid or expired. Ask the school administrator to send a fresh invitation." });
    }

    let body: { password?: unknown };
    try {
      body = await req.json();
    } catch {
      return reply(400, { error: "A new password is required." });
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return reply(400, { error: "Choose a password with at least 8 characters." });
    }
    if (password.length > 128) {
      return reply(400, { error: "Password is too long." });
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return reply(400, { error: "Choose a password containing at least one letter and one number." });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const { data: moduleControl, error: moduleControlError } = await adminClient.from("nexus_module_controls").select("is_enabled").eq("module_key", "account_activation").maybeSingle();
  if (moduleControlError || !moduleControl) return reply(503, { error: "Could not verify account activation availability." });
  if (!moduleControl.is_enabled) return reply(403, { error: "Account activation is currently disabled by the system administrator." });

    // Eligibility comes from trusted school records, never editable user metadata.
    // Invited teachers can set a password before approval, but invited status does
    // not grant access to protected school features.
    const [
      { data: membershipRows, error: membershipError },
      { data: studentRows, error: studentError },
      { data: parentAccountRows, error: parentAccountError },
    ] = await Promise.all([
      adminClient
        .from("school_memberships")
        .select("school_id,role,status")
        .eq("user_id", user.id)
        .in("role", ["student", "teacher", "parent"])
        .in("status", ["invited", "active"])
        .limit(10),
      adminClient
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .limit(1),
      adminClient
        .from("parent_portal_accounts")
        .select("id,school_id,parent_guardian_id,is_active")
        .eq("user_id", user.id)
        .limit(2),
    ]);

    if (membershipError || studentError || parentAccountError) {
      console.error("Account activation lookup failed", membershipError?.message, studentError?.message, parentAccountError?.message);
      return reply(500, { error: "Could not verify your school account. Please try again or contact the administrator." });
    }

    const memberships = membershipRows ?? [];
    const hasEligibleMembership = memberships.some(
      (row: { role: string; status: string }) =>
        (row.role === "teacher" || row.role === "student" || row.role === "parent") &&
        (row.status === "invited" || row.status === "active"),
    );
    const hasStudentLink = (studentRows ?? []).length > 0;
    const parentAccount = (parentAccountRows ?? [])[0] ?? null;
    const parentMembership = memberships.find((row: { role: string; status: string; school_id: string }) =>
      row.role === "parent" && (row.status === "invited" || row.status === "active") &&
      parentAccount?.school_id === row.school_id
    );

    if (parentAccount && !parentMembership) {
      return reply(403, { error: "This parent portal account has no matching invited school membership. Ask the administrator to review the invitation." });
    }
    if (parentMembership && !parentAccount) {
      return reply(403, { error: "The parent portal account is incomplete. Ask the administrator to resend the invitation." });
    }

    let parentGuardianId: string | null = null;
    if (parentAccount && parentMembership) {
      parentGuardianId = parentAccount.parent_guardian_id;
      const { data: guardian, error: guardianError } = await adminClient
        .from("parents_guardians")
        .select("id,school_id,person_id")
        .eq("id", parentGuardianId)
        .eq("school_id", parentAccount.school_id)
        .maybeSingle();
      if (guardianError || !guardian) {
        console.error("Parent guardian activation lookup failed", guardianError?.message);
        return reply(403, { error: "The parent record could not be verified. Ask the administrator to review the invitation." });
      }
      const { data: person, error: personError } = await adminClient
        .from("people")
        .select("id,user_id")
        .eq("id", guardian.person_id)
        .eq("school_id", guardian.school_id)
        .maybeSingle();
      if (personError || !person || person.user_id !== user.id) {
        console.error("Parent identity link verification failed", personError?.message);
        return reply(403, { error: "This invitation is not linked to your parent identity. Ask the administrator for help." });
      }
      const { data: accessLinks, error: accessError } = await adminClient
        .from("parent_student_portal_access")
        .select("id")
        .eq("school_id", guardian.school_id)
        .eq("parent_guardian_id", guardian.id)
        .eq("is_active", true)
        .limit(1);
      if (accessError || !accessLinks?.length) {
        console.error("Parent student access verification failed", accessError?.message);
        return reply(403, { error: "No active student link was found for this parent account. Ask the administrator to link the student first." });
      }
    }

    if (!hasEligibleMembership && !hasStudentLink) {
      return reply(403, { error: "This account is not eligible for school activation. Ask the school administrator to verify the invitation." });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      console.error("Account activation password update failed", updateError.message);
      return reply(400, { error: updateError.message || "Could not set your password. Please try again." });
    }

    if (parentGuardianId && parentAccount) {
      const [guardianUpdate, portalUpdate, membershipUpdate] = await Promise.all([
        adminClient.from("parents_guardians")
          .update({ portal_enabled: true })
          .eq("id", parentGuardianId)
          .eq("school_id", parentAccount.school_id),
        adminClient.from("parent_portal_accounts")
          .update({ is_active: true })
          .eq("id", parentAccount.id)
          .eq("user_id", user.id),
        adminClient.from("school_memberships")
          .update({ status: "active" })
          .eq("school_id", parentAccount.school_id)
          .eq("user_id", user.id)
          .eq("role", "parent"),
      ]);
      if (guardianUpdate.error || portalUpdate.error || membershipUpdate.error) {
        console.error("Parent account activation write failed", guardianUpdate.error?.message, portalUpdate.error?.message, membershipUpdate.error?.message);
        return reply(500, { error: "Your password was saved, but parent portal activation did not finish. Ask the administrator to retry activation." });
      }
    }

    return reply(200, {
      success: true,
      message: parentGuardianId
        ? "Parent password created and parent portal access activated."
        : "Password created successfully. School access remains controlled by the account's school membership status.",
      role: parentGuardianId ? "parent" : undefined,
      email: user.email,
    });
  } catch (error) {
    console.error("resa-activate-account failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "Account activation failed. Please try again or ask the school administrator for a fresh invitation." });
  }
});
