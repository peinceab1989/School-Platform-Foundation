import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";

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

function normalizedPhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^234/, "0");
}

function phoneCandidates(value: string): string[] {
  const digits = value.replace(/\D/g, "");
  const variants = new Set([value.trim(), digits]);
  if (digits.startsWith("234") && digits.length === 13) {
    variants.add("0" + digits.slice(3));
    variants.add("+" + digits);
  } else if (digits.startsWith("0") && digits.length === 11) {
    variants.add("234" + digits.slice(1));
    variants.add("+234" + digits.slice(1));
  } else if (digits.length === 10) {
    variants.add("0" + digits);
    variants.add("234" + digits);
    variants.add("+234" + digits);
  }
  return [...variants].filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "POST required." });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(503, { error: "The sign-in service is not configured." });
  }

  try {
    const body = await req.json().catch(() => null);
    const loginId = typeof body?.login_id === "string" ? body.login_id.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!loginId || !password || loginId.length > 40 || password.length > 128 || !/^(?:[a-zA-Z0-9][a-zA-Z0-9+(). /_-]{2,39}|\\+\\d[\\d ().-]{7,20})$/.test(loginId)) {
      return reply(400, { error: "Enter your login ID and password." });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const candidateUserIds = new Set<string>();
    const identifier = loginId.trim();

    // Student admission numbers resolve only to active student portal accounts.
    const { data: studentRows, error: studentError } = await admin
      .from("students")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("status", "active")
      .eq("admission_number", identifier.toUpperCase())
      .limit(3);
    if (studentError) throw new Error("Could not verify the student login ID.");
    for (const student of studentRows ?? []) {
      const { data: portal, error } = await admin
        .from("student_portal_accounts")
        .select("user_id")
        .eq("school_id", SCHOOL_ID)
        .eq("student_id", student.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error("Could not verify the student portal account.");
      if (portal?.user_id) {
        const { data: membership, error: membershipError } = await admin
          .from("school_memberships")
          .select("id")
          .eq("school_id", SCHOOL_ID)
          .eq("user_id", portal.user_id)
          .eq("role", "student")
          .eq("status", "active")
          .maybeSingle();
        if (membershipError) throw new Error("Could not verify student school access.");
        if (membership) candidateUserIds.add(portal.user_id);
      }
    }

    // Teacher staff numbers resolve only to active staff with active teacher membership.
    const { data: staffRows, error: staffError } = await admin
      .from("staff")
      .select("user_id")
      .eq("school_id", SCHOOL_ID)
      .eq("status", "active")
      .eq("staff_number", identifier.toUpperCase())
      .not("user_id", "is", null)
      .limit(3);
    if (staffError) throw new Error("Could not verify the staff login ID.");
    for (const staff of staffRows ?? []) {
      if (!staff.user_id) continue;
      const { data: membership, error } = await admin
        .from("school_memberships")
        .select("id")
        .eq("school_id", SCHOOL_ID)
        .eq("user_id", staff.user_id)
        .eq("role", "teacher")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw new Error("Could not verify teacher school access.");
      if (membership) candidateUserIds.add(staff.user_id);
    }

    // Parent phone login is available only after an invitation has been accepted
    // and the parent portal account and school membership are active.
    const phoneValues = phoneCandidates(identifier);
    if (/^\+?\d[\d ().-]{7,20}$/.test(identifier)) {
      const { data: people, error: peopleError } = await admin
        .from("people")
        .select("id,phone")
        .eq("school_id", SCHOOL_ID)
        .in("phone", phoneValues)
        .limit(5);
      if (peopleError) throw new Error("Could not verify the parent phone login.");
      const matchedPeople = (people ?? []).filter((person) =>
        typeof person.phone === "string" &&
        normalizedPhone(person.phone) === normalizedPhone(identifier)
      );
      for (const person of matchedPeople) {
        const { data: guardians, error: guardianError } = await admin
          .from("parents_guardians")
          .select("id")
          .eq("school_id", SCHOOL_ID)
          .eq("person_id", person.id)
          .limit(3);
        if (guardianError) throw new Error("Could not verify the parent record.");
        for (const guardian of guardians ?? []) {
          const { data: portal, error: portalError } = await admin
            .from("parent_portal_accounts")
            .select("user_id")
            .eq("school_id", SCHOOL_ID)
            .eq("parent_guardian_id", guardian.id)
            .eq("is_active", true)
            .maybeSingle();
          if (portalError) throw new Error("Could not verify parent portal access.");
          if (!portal?.user_id) continue;
          const { data: membership, error: membershipError } = await admin
            .from("school_memberships")
            .select("id")
            .eq("school_id", SCHOOL_ID)
            .eq("user_id", portal.user_id)
            .eq("role", "parent")
            .eq("status", "active")
            .maybeSingle();
          if (membershipError) throw new Error("Could not verify parent school access.");
          if (membership) candidateUserIds.add(portal.user_id);
        }
      }
    }

    // Do not reveal whether an ID exists, belongs to another role, or is inactive.
    if (candidateUserIds.size !== 1) {
      return reply(401, { error: "The login ID or password is incorrect, or this portal account is not active." });
    }

    const userId = [...candidateUserIds][0];
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);
    const email = userResult?.user?.email;
    if (userError || !email) {
      return reply(401, { error: "The login ID or password is incorrect, or this portal account is not active." });
    }

    // Supabase Auth performs password verification and applies its normal
    // authentication protections. Never compare or store passwords here.
    const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });
    if (signInError || !signInData.session) {
      return reply(401, { error: "The login ID or password is incorrect, or this portal account is not active." });
    }

    return reply(200, { session: signInData.session });
  } catch (error) {
    console.error("resa-login-by-id failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "Sign-in could not be completed. Please try again." });
  }
});
