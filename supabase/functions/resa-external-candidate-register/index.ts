import { createClient } from "npm:@supabase/supabase-js@2.117.2";

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

async function hashKey(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { success: false, error: "POST required." });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(500, { success: false, error: "Registration service is not configured." });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let createdAuthUserId: string | null = null;
  let candidateId: string | null = null;
  let purchaseId: string | null = null;
  let schoolId: string | null = null;

  try {
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

    const formNumber = typeof body.form_number === "string" ? body.form_number.trim().toUpperCase() : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim().replace(/\s+/g, " ") : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const dateOfBirth = typeof body.date_of_birth === "string" ? body.date_of_birth : null;

    if (formNumber.length < 8 || formNumber.length > 40) {
      return reply(400, { success: false, error: "Enter a valid verified external CBT form number." });
    }
    if (fullName.length < 3 || fullName.length > 180) {
      return reply(400, { success: false, error: "Enter the candidate's full name." });
    }
    if (!validEmail(email)) return reply(400, { success: false, error: "Enter a valid email address." });
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (domain.endsWith(".test") || domain.endsWith(".invalid") || ["example.com", "example.org"].includes(domain)) {
      return reply(400, { success: false, error: "Use a real email address that can receive the invitation." });
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return reply(400, { success: false, error: "Enter the date of birth in a valid date format." });
    }

    const rateKey = await hashKey(`${email}|${formNumber}`);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin.from("external_candidate_registration_events")
      .select("id", { count: "exact", head: true })
      .eq("rate_key", rateKey)
      .gte("created_at", tenMinutesAgo);
    if (rateError) throw new Error("Could not verify registration rate limits.");
    if ((count ?? 0) >= 5) return reply(429, { success: false, error: "Too many registration attempts. Wait ten minutes before trying again." });
    await admin.from("external_candidate_registration_events").delete().lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const { error: eventError } = await admin.from("external_candidate_registration_events").insert({ rate_key: rateKey });
    if (eventError) throw new Error("Could not record the registration request.");

    const { data: purchase, error: purchaseError } = await admin
      .from("external_candidate_form_purchases")
      .select("id,school_id,form_type,verification_status,redeemed_at")
      .eq("form_number", formNumber)
      .maybeSingle();
    if (purchaseError) throw new Error("Could not verify the form number.");
    if (!purchase || purchase.form_type !== "external_cbt" || purchase.verification_status !== "verified" || purchase.redeemed_at) {
      return reply(400, { success: false, error: "This form number is invalid, unverified, already used, or not an external CBT form. Contact the school office if you believe this is an error." });
    }
    schoolId = purchase.school_id;
    purchaseId = purchase.id;

    const { data: existingCandidate, error: existingCandidateError } = await admin
      .from("external_candidate_registrations")
      .select("id")
      .eq("school_id", schoolId)
      .ilike("email", email)
      .maybeSingle();
    if (existingCandidateError) throw new Error("Could not check the candidate registration.");
    if (existingCandidate) return reply(409, { success: false, error: "A candidate registration already exists for this email address." });

    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not verify whether this email already has a RESA account.");
      if ((data.users ?? []).some((user) => user.email?.toLowerCase() === email)) {
        return reply(409, { success: false, error: "This email already belongs to a RESA account. Use a separate email address for external CBT registration." });
      }
      if ((data.users ?? []).length < 1000) break;
    }

    const requestOrigin = req.headers.get("origin") ?? "";
    const allowedOrigins = new Set(["https://resa-school-portal.netlify.app"]);
    const redirectOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : "https://resa-school-portal.netlify.app";

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${redirectOrigin}/accept-invitation`,
      data: { account_type: "external_candidate", full_name: fullName, school_id: schoolId },
    });
    if (inviteError || !invite.user) {
      return reply(409, { success: false, error: "The invitation email could not be sent. Check the email address and school email-delivery settings." });
    }
    createdAuthUserId = invite.user.id;

    // Store the external-candidate marker in trusted app_metadata. The frontend
    // must never make role decisions from user-editable user_metadata.
    const { error: metadataError } = await admin.auth.admin.updateUserById(
      createdAuthUserId,
      { app_metadata: { ...(invite.user.app_metadata ?? {}), account_type: "external_candidate" } },
    );
    if (metadataError) throw new Error("Could not securely initialise the external candidate account.");

    const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const candidateNumber = `EXT-${new Date().getFullYear()}-${randomPart}`;
    const { data: candidate, error: candidateError } = await admin
      .from("external_candidate_registrations")
      .insert({
        school_id: schoolId,
        form_purchase_id: purchaseId,
        candidate_number: candidateNumber,
        full_name: fullName,
        email,
        phone: phone || null,
        date_of_birth: dateOfBirth,
        auth_user_id: createdAuthUserId,
        status: "pending_review",
      })
      .select("id,candidate_number")
      .single();
    if (candidateError || !candidate) throw new Error("Could not create the candidate registration.");
    candidateId = candidate.id;

    const { data: redeemed, error: redeemError } = await admin
      .from("external_candidate_form_purchases")
      .update({ redeemed_at: new Date().toISOString(), redeemed_by_candidate_id: candidateId })
      .eq("id", purchaseId)
      .eq("verification_status", "verified")
      .is("redeemed_at", null)
      .select("id")
      .maybeSingle();
    if (redeemError || !redeemed) throw new Error("The form number has just been used or could not be reserved. Please contact the school office.");

    return reply(201, {
      success: true,
      message: "Registration received. Check your email to create your password. Your CBT access will be available after the school approves your registration and assigns an examination.",
      candidate_number: candidateNumber,
      status: "pending_review",
    });
  } catch (error) {
    if (candidateId && schoolId) {
      await admin.from("external_candidate_registrations").delete().eq("id", candidateId).eq("school_id", schoolId);
    }
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
    if (purchaseId) await admin.from("external_candidate_form_purchases")
      .update({ redeemed_at: null, redeemed_by_candidate_id: null }).eq("id", purchaseId).eq("redeemed_by_candidate_id", candidateId);
    console.error("resa-external-candidate-register failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { success: false, error: "Candidate registration could not be completed. Do not retry repeatedly; contact the school office with your form number." });
  }
});
