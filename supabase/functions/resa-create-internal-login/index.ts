import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SCHOOL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function tempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const value = Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join("");
  return "RESA-" + value.slice(0, 24) + "-" + value.slice(24);
}

function aliasPart(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

function resaAlias(first: string, last: string) {
  const a = aliasPart(first);
  const b = aliasPart(last);
  return a && b ? a + "." + b + "@resa.com" : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { success: false, error: "POST required." });
  if (!URL || !ANON || !SERVICE) return reply(503, { success: false, error: "The internal login service is not configured." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { success: false, error: "An active administrator session is required." });

  const userClient = createClient(URL, ANON, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let createdUserId: string | null = null;
  let schoolId = "";
  let recordId = "";
  let personId = "";
  let role: "student" | "teacher" | "parent" | null = null;
  let personLinked = false;
  let recordLinked = false;
  let membershipCreated = false;
  let portalCreated = false;
  let parentAccessCreated = false;
  let guardianEnabled = false;

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return reply(401, { success: false, error: "Your administrator session is invalid or expired." });

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { success: false, error: "A JSON object is required." });
      body = parsed as Record<string, unknown>;
    } catch {
      return reply(400, { success: false, error: "A valid JSON request body is required." });
    }

    role = body.role === "student" || body.role === "teacher" || body.role === "parent" ? body.role : null;
    recordId = typeof body.record_id === "string" ? body.record_id.trim() : "";
    const action = body.action === "reset_temporary_password" ? "reset_temporary_password" : "create";
    if (!role || !SCHOOL_ID_PATTERN.test(recordId)) return reply(400, { success: false, error: "Choose a valid account type and school record." });

    let record: Record<string, any> | null = null;
    let person: Record<string, any> | null = null;
    let linkedStudents: Array<Record<string, any>> = [];
    if (role === "student") {
      const result = await admin.from("students")
        .select("id,school_id,person_id,user_id,status,admission_number")
        .eq("id", recordId).maybeSingle();
      if (result.error) throw new Error("Could not verify the student record.");
      record = result.data;
    } else if (role === "teacher") {
      const result = await admin.from("staff")
        .select("id,school_id,person_id,user_id,status,staff_number")
        .eq("id", recordId).maybeSingle();
      if (result.error) throw new Error("Could not verify the staff record.");
      record = result.data;
    } else {
      const result = await admin.from("parents_guardians")
        .select("id,school_id,person_id,portal_enabled,relationship")
        .eq("id", recordId).maybeSingle();
      if (result.error) throw new Error("Could not verify the parent record.");
      record = result.data;
    }
    if (!record) return reply(404, { success: false, error: "The selected school record was not found." });
    schoolId = record.school_id;
    personId = record.person_id;

    const { data: adminMembership, error: adminMembershipError } = await admin
      .from("school_memberships").select("id")
      .eq("school_id", schoolId).eq("user_id", authData.user.id)
      .eq("role", "admin").eq("status", "active").maybeSingle();
    if (adminMembershipError) throw new Error("Could not verify school administrator permissions.");
    if (!adminMembership) return reply(403, { success: false, error: "Only an active administrator of this school can manage internal logins." });

    const { data: activationModule, error: activationModuleError } = await admin
      .from("nexus_module_controls").select("is_enabled")
      .eq("module_key", "account_activation").maybeSingle();
    if (activationModuleError || !activationModule) return reply(503, { success: false, error: "Could not verify account activation availability." });
    if (!activationModule.is_enabled) return reply(403, { success: false, error: "Account activation is disabled by the system administrator." });
    const roleModuleKey = role === "student" ? "student_portal" : role === "teacher" ? "staff_invitations" : "parent_portal";
    const { data: roleModule, error: roleModuleError } = await admin
      .from("nexus_module_controls").select("is_enabled")
      .eq("module_key", roleModuleKey).maybeSingle();
    if (roleModuleError || !roleModule) return reply(503, { success: false, error: "Could not verify the selected portal module." });
    if (!roleModule.is_enabled) return reply(403, { success: false, error: "The " + roleModuleKey.replace(/_/g, " ") + " module is disabled by the system administrator." });

    if (role === "student" && record.status !== "active") return reply(409, { success: false, error: "Only active students can receive an internal login." });
    if (role === "teacher" && record.status !== "active") return reply(409, { success: false, error: "Only active staff records can receive an internal login." });

    const personResult = await admin.from("people")
      .select("id,school_id,first_name,last_name,phone,email,user_id")
      .eq("id", personId).eq("school_id", schoolId).maybeSingle();
    if (personResult.error) throw new Error("Could not verify the person's contact record.");
    person = personResult.data;
    if (!person) return reply(404, { success: false, error: "The linked person record could not be found." });

    if (role === "parent") {
      const linksResult = await admin.from("student_parent_guardians")
        .select("student_id,is_primary")
        .eq("school_id", schoolId).eq("parent_guardian_id", recordId);
      if (linksResult.error) throw new Error("Could not verify the parent's linked students.");
      linkedStudents = linksResult.data ?? [];
      if (!linkedStudents.length) return reply(409, { success: false, error: "Link at least one student to this parent before creating portal access." });
    }

    const loginId = resaAlias(person.first_name ?? "", person.last_name ?? "");
    if (!loginId) return reply(409, { success: false, error: "Complete the person's first and last names before creating a RESA login ID." });

    if (action === "reset_temporary_password") {
      const existingUserId = role === "student" || role === "teacher" ? record.user_id : person.user_id;
      if (!existingUserId) return reply(409, { success: false, error: "This record has no linked portal login yet." });

      const { data: activeMembership, error: activeMembershipError } = await admin
        .from("school_memberships").select("id")
        .eq("school_id", schoolId).eq("user_id", existingUserId)
        .eq("role", role).eq("status", "active").maybeSingle();
      if (activeMembershipError) throw new Error("Could not verify the linked account's school access.");
      if (!activeMembership) return reply(409, { success: false, error: "Only an active school portal account can receive a password reset." });

      if (role === "student") {
        const { data: portal, error } = await admin.from("student_portal_accounts")
          .select("id").eq("school_id", schoolId).eq("student_id", recordId)
          .eq("user_id", existingUserId).eq("is_active", true).maybeSingle();
        if (error) throw new Error("Could not verify the student's portal account.");
        if (!portal) return reply(409, { success: false, error: "The student portal account is inactive or unavailable." });
      } else if (role === "parent") {
        const { data: portal, error } = await admin.from("parent_portal_accounts")
          .select("id").eq("school_id", schoolId).eq("parent_guardian_id", recordId)
          .eq("user_id", existingUserId).eq("is_active", true).maybeSingle();
        if (error) throw new Error("Could not verify the parent's portal account.");
        if (!portal || record.portal_enabled !== true) return reply(409, { success: false, error: "The parent portal account is inactive or unavailable." });
      }

      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(existingUserId);
      if (authUserError || !authUser.user) return reply(404, { success: false, error: "The linked login account could not be found." });
      const password = tempPassword();
      const { error: passwordError } = await admin.auth.admin.updateUserById(existingUserId, {
        password,
        app_metadata: { ...authUser.user.app_metadata, must_change_password: true, resa_internal_login: true },
      });
      if (passwordError) throw new Error("Could not reset the temporary password.");
      return reply(200, {
        success: true,
        role,
        login_id: loginId,
        temporary_password: password,
        must_change_password: true,
        message: "A new one-time temporary password has been created. The user must change it at next sign-in.",
      });
    }

    const existingUserId = role === "student" || role === "teacher" ? record.user_id : person.user_id;
    if (existingUserId || person.user_id) return reply(409, { success: false, error: "This record or its person profile is already linked to a login account." });

    if (role === "student") {
      const { data: existingPortal, error } = await admin.from("student_portal_accounts")
        .select("id").eq("school_id", schoolId).eq("student_id", recordId).maybeSingle();
      if (error) throw new Error("Could not check existing student portal access.");
      if (existingPortal) return reply(409, { success: false, error: "A student portal account already exists for this record." });
    }
    if (role === "parent") {
      const { data: existingPortal, error } = await admin.from("parent_portal_accounts")
        .select("id").eq("school_id", schoolId).eq("parent_guardian_id", recordId).maybeSingle();
      if (error) throw new Error("Could not check existing parent portal access.");
      if (existingPortal) return reply(409, { success: false, error: "A parent portal account or invitation already exists for this record. Resolve it before creating another." });
    }

    const password = tempPassword();
    const internalEmail = "resa." + role + "." + recordId.toLowerCase() + "@login.resa.invalid";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: person.first_name,
        last_name: person.last_name,
        school_id: schoolId,
        account_type: role,
        internal_login: true,
      },
      app_metadata: {
        must_change_password: true,
        resa_internal_login: true,
      },
    });
    if (createError || !created.user) {
      console.error("Internal RESA Auth user creation failed", createError?.message);
      return reply(409, { success: false, error: "The internal login could not be created. Check for an existing Auth record linked to this school record." });
    }
    createdUserId = created.user.id;

    const { data: personUpdatedRow, error: personUpdateError } = await admin.from("people")
      .update({ user_id: createdUserId }).eq("id", personId).eq("school_id", schoolId).is("user_id", null)
      .select("id").maybeSingle();
    if (personUpdateError || !personUpdatedRow) throw new Error("Could not safely link the internal login to the person record.");
    personLinked = true;

    if (role === "student") {
      const { data: linkedStudent, error } = await admin.from("students")
        .update({ user_id: createdUserId }).eq("id", recordId).eq("school_id", schoolId).is("user_id", null)
        .select("id").maybeSingle();
      if (error || !linkedStudent) throw new Error("Could not safely link the internal login to the student record.");
      recordLinked = true;
    } else if (role === "teacher") {
      const { data: linkedStaff, error } = await admin.from("staff")
        .update({ user_id: createdUserId }).eq("id", recordId).eq("school_id", schoolId).is("user_id", null)
        .select("id").maybeSingle();
      if (error || !linkedStaff) throw new Error("Could not safely link the internal login to the staff record.");
      recordLinked = true;
    }

    const { error: membershipError } = await admin.from("school_memberships").insert({
      school_id: schoolId,
      user_id: createdUserId,
      role,
      status: "active",
    });
    if (membershipError) throw new Error("Could not create the active school membership.");
    membershipCreated = true;

    if (role === "student") {
      const { error } = await admin.from("student_portal_accounts").insert({
        school_id: schoolId, student_id: recordId, user_id: createdUserId, is_active: true,
      });
      if (error) throw new Error("Could not create the student portal account.");
      portalCreated = true;
    } else if (role === "parent") {
      const { error } = await admin.from("parent_portal_accounts").insert({
        school_id: schoolId, parent_guardian_id: recordId, user_id: createdUserId, is_active: true,
      });
      if (error) throw new Error("Could not create the parent portal account.");
      portalCreated = true;

      const accessRows = linkedStudents.map((link) => ({
        school_id: schoolId,
        parent_guardian_id: recordId,
        student_id: link.student_id,
        relationship: record.relationship,
        is_primary: link.is_primary,
        is_active: true,
      }));
      const { error: accessError } = await admin.from("parent_student_portal_access")
        .upsert(accessRows, { onConflict: "parent_guardian_id,student_id" });
      if (accessError) throw new Error("Could not create the parent's linked-student access.");
      parentAccessCreated = true;

      const { data: guardianUpdated, error: guardianError } = await admin.from("parents_guardians")
        .update({ portal_enabled: true }).eq("id", recordId).eq("school_id", schoolId)
        .select("id").maybeSingle();
      if (guardianError || !guardianUpdated) throw new Error("Could not safely enable the parent portal record.");
      guardianEnabled = true;
    }

    const formalLoginId = role === "student"
      ? record.admission_number
      : role === "teacher"
        ? record.staff_number
        : person.phone;
    return reply(201, {
      success: true,
      role,
      login_id: loginId,
      alternative_login_id: formalLoginId ?? null,
      temporary_password: password,
      must_change_password: true,
      message: "Internal RESA login created. No email was sent. The user must change the temporary password at first sign-in.",
    });
  } catch (error) {
    if (createdUserId) {
      if (guardianEnabled) await admin.from("parents_guardians").update({ portal_enabled: false }).eq("id", recordId).eq("school_id", schoolId);
      if (parentAccessCreated) await admin.from("parent_student_portal_access").delete().eq("school_id", schoolId).eq("parent_guardian_id", recordId);
      if (portalCreated && role === "student") await admin.from("student_portal_accounts").delete().eq("school_id", schoolId).eq("student_id", recordId).eq("user_id", createdUserId);
      if (portalCreated && role === "parent") await admin.from("parent_portal_accounts").delete().eq("school_id", schoolId).eq("parent_guardian_id", recordId).eq("user_id", createdUserId);
      if (membershipCreated) await admin.from("school_memberships").delete().eq("school_id", schoolId).eq("user_id", createdUserId).eq("role", role);
      if (recordLinked && role === "student") await admin.from("students").update({ user_id: null }).eq("id", recordId).eq("school_id", schoolId).eq("user_id", createdUserId);
      if (recordLinked && role === "teacher") await admin.from("staff").update({ user_id: null }).eq("id", recordId).eq("school_id", schoolId).eq("user_id", createdUserId);
      if (personLinked) await admin.from("people").update({ user_id: null }).eq("id", personId).eq("school_id", schoolId).eq("user_id", createdUserId);
      await admin.auth.admin.deleteUser(createdUserId);
    }
    console.error("resa-create-internal-login failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { success: false, error: "The internal login could not be completed. Any partial account changes were rolled back where possible." });
  }
});
