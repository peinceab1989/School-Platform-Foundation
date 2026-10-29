import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}
function clean(value: unknown, max = 254) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });
  if (!URL || !ANON || !SERVICE) return reply(500, { error: "Server configuration is incomplete." });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Authentication required." });
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: moduleControl, error: moduleControlError } = await admin.from("nexus_module_controls").select("is_enabled").eq("module_key", "staff_invitations").maybeSingle();
  if (moduleControlError || !moduleControl) return reply(503, { error: "Could not verify staff invitations availability." });
  if (!moduleControl.is_enabled) return reply(403, { error: "Staff invitations are currently disabled by the system administrator." });
  try {
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply(401, { error: "Your session is invalid or expired." });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "A valid JSON body is required." });
    const schoolId = clean(body.school_id, 36);
    const email = clean(body.email).toLowerCase();
    const action = clean(body.action, 20);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply(400, { error: "A valid school and email are required." });
    }
    if (!["remove", "resend"].includes(action)) return reply(400, { error: "Unsupported action." });
    const { data: adminMembership, error: adminErr } = await admin.from("school_memberships").select("role,status").eq("school_id", schoolId).eq("user_id", user.id).maybeSingle();
    if (adminErr) throw new Error("Could not verify administrator permissions.");
    if (!adminMembership || adminMembership.role !== "admin" || adminMembership.status !== "active") return reply(403, { error: "An active school administrator must authorize this action." });

    const { data: people, error: peopleErr } = await admin.from("people").select("id,user_id,first_name,last_name,email").eq("school_id", schoolId).ilike("email", email);
    if (peopleErr) throw new Error("Could not locate the existing school person record.");
    if (!people?.length) return reply(404, { error: "No existing person record was found for this email. You can use the normal invitation form." });
    if (people.length !== 1) return reply(409, { error: "Multiple person records match this email. Please resolve the duplicate records safely before continuing." });
    const person = people[0];
    const uid = person.user_id as string | null;
    let memberships: Array<{id:string; role:string; status:string}> = [];
    let staffRows: Array<{id:string; status:string; user_id:string|null; person_id:string}> = [];
    if (uid) {
      const { data, error } = await admin.from("school_memberships").select("id,role,status").eq("school_id", schoolId).eq("user_id", uid);
      if (error) throw new Error("Could not verify the existing school membership.");
      memberships = data ?? [];
      const { data: staff, error: staffErr } = await admin.from("staff").select("id,status,user_id,person_id").eq("school_id", schoolId).eq("person_id", person.id);
      if (staffErr) throw new Error("Could not verify the staff record.");
      staffRows = staff ?? [];
    } else {
      const { data: staff, error: staffErr } = await admin.from("staff").select("id,status,user_id,person_id").eq("school_id", schoolId).eq("person_id", person.id);
      if (staffErr) throw new Error("Could not verify the staff record.");
      staffRows = staff ?? [];
    }
    const teacherMemberships = memberships.filter(m => m.role === "teacher");
    const otherMemberships = memberships.filter(m => m.role !== "teacher");

    // Password recovery is safe for an existing teacher account, including
    // an active teacher who never completed password setup. It changes no role
    // or membership status. Removal remains restricted to pending invitations.
    if (action === "resend") {
      if (!uid) return reply(409, { error: "This record has no linked account. Remove the incomplete school record first, then send a fresh invitation using the normal form." });
      if (teacherMemberships.length !== 1 || otherMemberships.length > 0 || staffRows.length !== 1) {
        return reply(409, { error: "The email is not linked to exactly one teacher record in this school. No password email was requested; contact the portal administrator to review the records." });
      }
      return reply(200, { success: true, email, message: "Teacher account verified. A password setup/recovery email may now be requested." });
    }

    const isSafePending = otherMemberships.length === 0 &&
      teacherMemberships.length === 1 &&
      teacherMemberships.every(m => m.status === "invited") &&
      staffRows.length === 1 &&
      staffRows.every(s => s.status === "pending");
    if (!isSafePending) return reply(409, { error: "This record is linked to an active, suspended, approved, or non-teacher account. It has been protected from removal." });

    // Remove only the school's pending invitation rows. Never delete the global Auth user.
    for (const row of staffRows) {
      const { error } = await admin.from("staff").delete().eq("id", row.id).eq("school_id", schoolId).eq("status", "pending");
      if (error) throw new Error("Could not remove the pending staff record. No account was deleted.");
    }
    for (const row of teacherMemberships) {
      const { error } = await admin.from("school_memberships").delete().eq("id", row.id).eq("school_id", schoolId).eq("status", "invited");
      if (error) throw new Error("Could not remove the pending membership. The global account was retained.");
    }
    const { error: personDeleteError } = await admin.from("people").delete().eq("id", person.id).eq("school_id", schoolId);
    if (personDeleteError) throw new Error("Could not remove the incomplete person record. Check related records before retrying.");
    return reply(200, { success: true, message: "The incomplete school invitation was removed. The Auth account, if any, was retained." });
  } catch (error) {
    console.error("resa-manage-staff-invitation failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: error instanceof Error ? error.message : "The request could not be completed." });
  }
});