import { createClient } from "npm:@supabase/supabase-js@2";
const URL = Deno.env.get("SUPABASE_URL");
const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
function reply(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers }); }
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });
  if (!URL || !ANON || !SERVICE) return reply(500, { error: "Server configuration is incomplete." });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in as a school administrator first." });
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply(401, { error: "Your session is invalid or expired." });
    let body: Record<string, unknown>;
    try { const parsed = await req.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { error: "A JSON object is required." }); body = parsed as Record<string, unknown>; }
    catch { return reply(400, { error: "A valid JSON request body is required." }); }
    const action = typeof body.action === "string" ? body.action : "lookup_email";
    if (action !== "complete_password_change") {
      const { data: moduleControl, error: moduleControlError } = await adminClient.from("nexus_module_controls").select("is_enabled").eq("module_key", "student_password_management").maybeSingle();
      if (moduleControlError || !moduleControl) return reply(503, { error: "Could not verify student password management availability." });
      if (!moduleControl.is_enabled) return reply(403, { error: "Student password management is currently disabled by the system administrator." });
    }
    if (action === "complete_password_change") {
      if (user.app_metadata?.must_change_password !== true) return reply(403, { error: "No temporary-password change is pending for this account." });
      const { error: clearError } = await adminClient.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, must_change_password: false }
      });
      if (clearError) throw new Error("Could not complete the required password change.");
      return reply(200, { success: true });
    }
    if (action !== "lookup_email" && action !== "set_temporary_password") return reply(400, { error: "Unsupported password action." });
    const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) return reply(400, { error: "A valid student_id is required." });
    const { data: student, error: studentError } = await adminClient.from("students").select("id, school_id, user_id, status").eq("id", studentId).maybeSingle();
    if (studentError) throw new Error("Could not verify the student record.");
    if (!student) return reply(404, { error: "Student record not found." });
    const { data: membership, error: membershipError } = await adminClient.from("school_memberships").select("id").eq("school_id", student.school_id).eq("user_id", user.id).eq("role", "admin").eq("status", "active").maybeSingle();
    if (membershipError) throw new Error("Could not verify school administrator permissions.");
    if (!membership) return reply(403, { error: "Only an active administrator of this student's school can request a reset." });
    if (!student.user_id) return reply(409, { error: "This student has no linked portal login. Create the login first." });
    if (action === "set_temporary_password") {
      if (student.status !== "active") return reply(409, { error: "Only active students can receive a temporary password." });
      const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(student.user_id);
      if (authUserError || !authUser.user) return reply(404, { error: "The linked portal account could not be found." });
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
      const temporaryPassword = "RESA-" + hex.slice(0, 18) + "-" + hex.slice(18);
      const { error: updateError } = await adminClient.auth.admin.updateUserById(student.user_id, {
        password: temporaryPassword,
        app_metadata: { ...authUser.user.app_metadata, must_change_password: true }
      });
      if (updateError) return reply(500, { error: "Could not set the temporary password. The current password remains unchanged if the update failed." });
      return reply(200, { success: true, temporary_password: temporaryPassword, must_change_password: true });
    }
    const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(student.user_id);
    if (authUserError || !authUser.user?.email) return reply(404, { error: "The linked portal account has no usable email address." });
    return reply(200, { success: true, email: authUser.user.email });
  } catch (error) {
    console.error("resa-admin-reset-student-password failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "Could not verify this student's login for password reset." });
  }
});
