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
    if (password.length < 8) return reply(400, { error: "Choose a password with at least 8 characters." });
    if (password.length > 128) return reply(400, { error: "Password is too long." });
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return reply(400, { error: "Choose a password containing at least one letter and one number." });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Eligibility comes from trusted school records, never editable user metadata.
    // Invited teachers can set a password before approval, but invited status does
    // not grant access to protected school features.
    const [
      { data: membershipRows, error: membershipError },
      { data: studentRows, error: studentError },
    ] = await Promise.all([
      adminClient.from("school_memberships")
        .select("role,status")
        .eq("user_id", user.id)
        .in("role", ["student", "teacher"])
        .in("status", ["invited", "active"])
        .limit(5),
      adminClient.from("students").select("id").eq("user_id", user.id).limit(1),
    ]);

    if (membershipError || studentError) {
      console.error("Account activation lookup failed", membershipError?.message, studentError?.message);
      return reply(500, { error: "Could not verify your school account. Please try again or contact the administrator." });
    }

    const memberships = membershipRows ?? [];
    const hasEligibleMembership = memberships.some(
      (row: { role: string; status: string }) =>
        (row.role === "teacher" || row.role === "student") &&
        (row.status === "invited" || row.status === "active"),
    );
    const hasStudentLink = (studentRows ?? []).length > 0;

    if (!hasEligibleMembership && !hasStudentLink) {
      return reply(403, { error: "This account is not eligible for student or teacher activation. Ask the school administrator to verify the invitation." });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      console.error("Account activation password update failed", updateError.message);
      return reply(400, { error: updateError.message || "Could not set your password. Please try again." });
    }

    return reply(200, {
      success: true,
      message: "Password created successfully. School access remains controlled by the account's school membership status.",
      email: user.email,
    });
  } catch (error) {
    console.error("resa-activate-account failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "Account activation failed. Please try again or ask the school administrator for a fresh invitation." });
  }
});
