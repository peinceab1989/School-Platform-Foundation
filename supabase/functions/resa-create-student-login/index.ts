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
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { success: false, error: "Method not allowed." });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(500, { success: false, error: "Server configuration is incomplete." });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { success: false, error: "Sign in as a school administrator first." });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let createdUserId: string | null = null;
  let schoolId: string | null = null;
  let studentId: string | null = null;
  let personId: string | null = null;
  let oldPersonEmail: string | null = null;
  let personUpdated = false;
  let studentUpdated = false;
  let membershipCreated = false;
  let portalAccountCreated = false;

  try {
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply(401, { success: false, error: "Your session is invalid or expired." });

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

    const requestedStudentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedStudentId)) {
      return reply(400, { success: false, error: "A valid student_id is required." });
    }
    if (!validEmail(email)) return reply(400, { success: false, error: "Enter a valid email address for the student's login invitation." });

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id, person_id, user_id, status")
      .eq("id", requestedStudentId)
      .maybeSingle();

    if (studentError) throw new Error("Could not verify the student record.");
    if (!student) return reply(404, { success: false, error: "Student record not found." });
    if ((student.status || "").toLowerCase() !== "active") {
      return reply(409, { success: false, error: "Only active students can be given a portal login. Update the student status first." });
    }

    studentId = student.id;
    schoolId = student.school_id;
    personId = student.person_id;

    const { data: adminMembership, error: membershipCheckError } = await adminClient
      .from("school_memberships")
      .select("id")
      .eq("school_id", schoolId)
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .maybeSingle();

    if (membershipCheckError) throw new Error("Could not verify school administrator permissions.");
    if (!adminMembership) return reply(403, { success: false, error: "Only an active administrator of this student's school can create the login." });

    if (student.user_id) return reply(409, { success: false, error: "This student is already linked to a login account." });

    const { data: existingPortalAccount, error: accountCheckError } = await adminClient
      .from("student_portal_accounts").select("id")
      .eq("student_id", student.id).maybeSingle();
    if (accountCheckError) throw new Error("Could not check existing student portal access.");
    if (existingPortalAccount) return reply(409, { success: false, error: "A portal account is already registered for this student." });

    const { data: person, error: personError } = await adminClient
      .from("people").select("id, school_id, email, user_id, first_name, last_name")
      .eq("id", student.person_id).eq("school_id", schoolId).single();
    if (personError || !person) throw new Error("Could not verify the student's person record.");
    if (person.user_id) return reply(409, { success: false, error: "This person is already linked to a login account." });
    oldPersonEmail = person.email;
    if (person.email && person.email.trim().toLowerCase() !== email) {
      return reply(409, { success: false, error: "The email entered differs from the email already saved on this student. Update or verify the student email first." });
    }

    const { data: emailMatch, error: emailMatchError } = await adminClient
      .from("people").select("id").eq("school_id", schoolId).ilike("email", email)
      .neq("id", person.id).maybeSingle();
    if (emailMatchError) throw new Error("Could not check whether this email belongs to another person.");
    if (emailMatch) return reply(409, { success: false, error: "This email is already attached to another person in this school." });

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://resa-school-portal.netlify.app/accept-invitation",
      data: {
        first_name: person.first_name,
        last_name: person.last_name,
        school_id: schoolId,
        student_id: student.id,
        account_type: "student",
      },
    });
    if (inviteError || !inviteData.user) {
      return reply(409, { success: false, error: "Supabase could not send the invitation. Check whether this email already has an Auth account and whether the invitation redirect URL is allowed." });
    }
    createdUserId = inviteData.user.id;

    const { error: updatePersonError } = await adminClient.from("people")
      .update({ user_id: createdUserId, email }).eq("id", person.id).eq("school_id", schoolId);
    if (updatePersonError) throw new Error("Could not link the login to the person record.");
    personUpdated = true;

    const { error: updateStudentError } = await adminClient.from("students")
      .update({ user_id: createdUserId }).eq("id", student.id).eq("school_id", schoolId);
    if (updateStudentError) throw new Error("Could not link the login to the student record.");
    studentUpdated = true;

    const { error: createMembershipError } = await adminClient.from("school_memberships")
      .insert({ school_id: schoolId, user_id: createdUserId, role: "student", status: "active" });
    if (createMembershipError) throw new Error("Could not create the student access membership.");
    membershipCreated = true;

    const { error: createAccountError } = await adminClient.from("student_portal_accounts")
      .insert({ school_id: schoolId, student_id: student.id, user_id: createdUserId, is_active: true });
    if (createAccountError) throw new Error("Could not create the student portal account.");
    portalAccountCreated = true;

    return reply(201, {
      success: true,
      message: "Student login invitation sent. The student must open the email invitation to set up access.",
      student: { id: student.id, email, account_status: "invitation_sent" },
    });
  } catch (error) {
    if (createdUserId && schoolId && studentId && personId) {
      if (portalAccountCreated) await adminClient.from("student_portal_accounts").delete().eq("school_id", schoolId).eq("student_id", studentId).eq("user_id", createdUserId);
      if (membershipCreated) await adminClient.from("school_memberships").delete().eq("school_id", schoolId).eq("user_id", createdUserId).eq("role", "student");
      if (studentUpdated) await adminClient.from("students").update({ user_id: null }).eq("id", studentId).eq("school_id", schoolId).eq("user_id", createdUserId);
      if (personUpdated) await adminClient.from("people").update({ user_id: null, email: oldPersonEmail }).eq("id", personId).eq("school_id", schoolId).eq("user_id", createdUserId);
      await adminClient.auth.admin.deleteUser(createdUserId);
    }
    console.error("resa-create-student-login failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { success: false, error: "Student login creation failed and was rolled back where possible. Check the Edge Function logs before retrying." });
  }
});