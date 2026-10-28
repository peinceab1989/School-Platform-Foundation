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

function makeTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = crypto.getRandomValues(new Uint8Array(18));
  let password = "";
  for (const value of values) password += alphabet[value % alphabet.length];
  return password;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { error: "Please sign in again before managing a student password." });
  }

  try {
    const token = authorization.slice("Bearer ".length).trim();
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const actor = authData?.user;
    if (authError || !actor?.id) {
      return reply(401, { error: "Your session is invalid or expired. Sign in again." });
    }

    let body: { action?: unknown; student_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return reply(400, { error: "A valid request body is required." });
    }

    const action = typeof body.action === "string" ? body.action : "lookup_email";
    const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Completion is allowed only to the signed-in user who has a pending
    // temporary-password change. Never trust a client-supplied user ID.
    if (action === "complete_password_change") {
      if (actor.app_metadata?.must_change_password !== true) {
        return reply(400, { error: "There is no pending temporary-password change for this account." });
      }
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(actor.id, {
        app_metadata: { ...(actor.app_metadata ?? {}), must_change_password: false },
      });
      if (metadataError) {
        console.error("Could not clear temporary-password flag:", metadataError.message);
        return reply(500, { error: "Your password was updated, but the account status could not be finalized. Contact the administrator." });
      }
      return reply(200, { success: true });
    }

    if (!studentId) return reply(400, { error: "A student record is required." });

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id, user_id, status")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error("Student lookup failed:", studentError.message);
      return reply(500, { error: "Could not verify this student record." });
    }
    if (!student?.user_id) return reply(404, { error: "This student has no linked portal login." });

    const { data: membership, error: membershipError } = await adminClient
      .from("school_memberships")
      .select("id")
      .eq("school_id", student.school_id)
      .eq("user_id", actor.id)
      .eq("role", "admin")
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      console.error("Administrator membership lookup failed:", membershipError.message);
      return reply(500, { error: "Could not verify administrator access." });
    }
    if (!membership) return reply(403, { error: "Access denied. Only an active administrator of this school can manage student passwords." });

    if (action === "lookup_email") {
      const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(student.user_id);
      if (targetError || !target.user?.email) {
        return reply(404, { error: "No email address is linked to this student portal login." });
      }
      return reply(200, { email: target.user.email });
    }

    if (action !== "set_temporary_password") {
      return reply(400, { error: "Unsupported password action." });
    }
    if ((student.status ?? "").toLowerCase() !== "active") {
      return reply(400, { error: "Only active students can receive a temporary password." });
    }

    const temporaryPassword = makeTemporaryPassword();
    const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(student.user_id);
    if (targetError || !target.user) {
      return reply(404, { error: "The student's linked authentication account could not be found." });
    }

    const existingMetadata = target.user.app_metadata ?? {};
    const { error: updateError } = await adminClient.auth.admin.updateUserById(student.user_id, {
      password: temporaryPassword,
      app_metadata: { ...existingMetadata, must_change_password: true },
    });
    if (updateError) {
      console.error("Temporary password update failed:", updateError.message);
      return reply(500, { error: "Could not set the temporary password. No password was returned." });
    }

    // The password is returned once only. The administrator must deliver it
    // privately; never log it or store it in student profile fields.
    return reply(200, { success: true, temporary_password: temporaryPassword });
  } catch (error) {
    console.error("resa-admin-reset-student-password failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "The password operation failed. Please try again or contact support." });
  }
});
