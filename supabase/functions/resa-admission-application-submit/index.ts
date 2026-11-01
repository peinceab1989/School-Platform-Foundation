import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ALLOWED_ORIGINS = new Set(["https://resa-school-portal.netlify.app"]);

function headers(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://resa-school-portal.netlify.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}
function reply(status: number, body: Record<string, unknown>, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
const text = (value: unknown, max = 200) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return reply(405, { success: false, error: "POST required." }, origin);
  if (!URL || !SERVICE_KEY) return reply(500, { success: false, error: "Admission service is not configured." }, origin);

  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let applicationId: string | null = null;
  let paymentId: string | null = null;
  let purchaseId: string | null = null;

  try {
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { success: false, error: "A JSON object is required." }, origin);
      body = parsed as Record<string, unknown>;
    } catch { return reply(400, { success: false, error: "A valid JSON request body is required." }, origin); }

    const formNumber = text(body.form_number, 40).toUpperCase();
    if (formNumber.length < 8) return reply(400, { success: false, error: "Enter the admission form number issued by RESA." }, origin);

    const { data: purchase, error: purchaseError } = await db.from("external_candidate_form_purchases")
      .select("id,school_id,form_type,amount_paid,payment_reference,paid_at,verification_status,verified_by,redeemed_at")
      .eq("form_number", formNumber).eq("form_type", "admission").maybeSingle();
    if (purchaseError) throw new Error("Could not verify the admission form number.");
    if (!purchase || purchase.verification_status !== "verified" || purchase.redeemed_at) {
      return reply(400, { success: false, error: "This admission form number is invalid, unverified, or already used. Contact the school office if you believe this is an error." }, origin);
    }
    purchaseId = purchase.id;

    const action = text(body.action, 30);
    if (action === "list_classes") {
      const [{ data: classes, error: classError }, { data: session, error: sessionError }] = await Promise.all([
        db.from("school_classes").select("id,name,level").eq("school_id", purchase.school_id).order("name"),
        db.from("academic_sessions").select("id,name").eq("school_id", purchase.school_id).eq("is_current", true).maybeSingle(),
      ]);
      if (classError) throw new Error("Could not load available classes.");
      if (sessionError) throw new Error("Could not load the current academic session.");
      return reply(200, { success: true, classes: classes ?? [], academic_session: session ?? null }, origin);
    }

    if (action !== "submit") return reply(400, { success: false, error: "Unsupported admission action." }, origin);

    const firstName = text(body.applicant_first_name, 80);
    const middleName = text(body.applicant_middle_name, 80);
    const lastName = text(body.applicant_last_name, 80);
    const email = text(body.email, 254).toLowerCase();
    const phone = text(body.phone, 40);
    const parentName = text(body.parent_name, 160);
    const parentPhone = text(body.parent_phone, 40);
    const parentEmail = text(body.parent_email, 254).toLowerCase();
    const dob = text(body.date_of_birth, 10);
    const gender = text(body.gender, 30);
    const address = text(body.address, 500);
    const previousSchool = text(body.previous_school, 180);
    const classId = text(body.class_applied_for, 50);

    if (firstName.length < 2 || lastName.length < 2) return reply(400, { success: false, error: "Enter the applicant's first and last names." }, origin);
    if (parentName.length < 3 || parentPhone.length < 7) return reply(400, { success: false, error: "Enter a parent or guardian name and contact phone number." }, origin);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { success: false, error: "Enter a valid applicant email address." }, origin);
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) return reply(400, { success: false, error: "Enter a valid parent email address." }, origin);
    if (dob && !validDate(dob)) return reply(400, { success: false, error: "Enter a valid date of birth." }, origin);
    if (!classId) return reply(400, { success: false, error: "Select the class being applied for." }, origin);

    const rateKey = await digest(formNumber + "|" + parentPhone);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: rateError } = await db.from("admission_application_rate_events")
      .select("id", { count: "exact", head: true }).eq("rate_key", rateKey).gte("created_at", tenMinutesAgo);
    if (rateError) throw new Error("Could not check application rate limits.");
    if ((count ?? 0) >= 5) return reply(429, { success: false, error: "Too many attempts. Wait ten minutes before trying again." }, origin);
    await db.from("admission_application_rate_events").delete().lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const { error: eventError } = await db.from("admission_application_rate_events").insert({ rate_key: rateKey });
    if (eventError) throw new Error("Could not record the application request.");

    const { data: schoolClass, error: classError } = await db.from("school_classes").select("id")
      .eq("id", classId).eq("school_id", purchase.school_id).maybeSingle();
    if (classError) throw new Error("Could not verify the selected class.");
    if (!schoolClass) return reply(400, { success: false, error: "Select a valid class offered by RESA." }, origin);

    const { data: currentSession, error: sessionError } = await db.from("academic_sessions").select("id")
      .eq("school_id", purchase.school_id).eq("is_current", true).maybeSingle();
    if (sessionError) throw new Error("Could not verify the current academic session.");

    const applicationNumber = "RESA-ADM-" + new Date().getFullYear() + "-" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const { data: application, error: applicationError } = await db.from("admission_applications").insert({
      school_id: purchase.school_id,
      form_purchase_id: purchase.id,
      application_number: applicationNumber,
      academic_session_id: currentSession?.id ?? null,
      applicant_first_name: firstName,
      applicant_middle_name: middleName || null,
      applicant_last_name: lastName,
      date_of_birth: dob || null,
      gender: gender || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      previous_school: previousSchool || null,
      class_applied_for: classId,
      parent_name: parentName,
      parent_phone: parentPhone,
      parent_email: parentEmail || null,
      status: "pending",
    }).select("id,application_number").single();
    if (applicationError || !application) throw new Error("The application could not be recorded. The form number may already have been used.");
    applicationId = application.id;

    const receiptNumber = "RESA-ADM-R-" + new Date().getFullYear() + "-" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const { data: payment, error: paymentError } = await db.from("admission_payments").insert({
      school_id: purchase.school_id,
      application_id: application.id,
      amount: purchase.amount_paid,
      payment_date: purchase.paid_at || new Date().toISOString().slice(0, 10),
      payment_method: "verified_school_payment",
      reference_number: purchase.payment_reference,
      receipt_number: receiptNumber,
      status: "paid",
      remarks: "Admission application form payment verified before form issuance.",
      recorded_by: purchase.verified_by,
    }).select("id").single();
    if (paymentError || !payment) throw new Error("The application payment record could not be created.");
    paymentId = payment.id;

    const { data: redeemed, error: redeemError } = await db.from("external_candidate_form_purchases")
      .update({ redeemed_at: new Date().toISOString(), redeemed_by_application_id: application.id })
      .eq("id", purchase.id).eq("verification_status", "verified").is("redeemed_at", null)
      .select("id").maybeSingle();
    if (redeemError || !redeemed) throw new Error("This form number has just been used. Contact the school office.");

    return reply(201, { success: true, application_number: application.application_number, status: "pending", message: "Your admission application has been received. Keep your application number for future enquiries. The school will contact your parent or guardian after review." }, origin);
  } catch (error) {
    if (paymentId) await db.from("admission_payments").delete().eq("id", paymentId);
    if (applicationId) await db.from("admission_applications").delete().eq("id", applicationId);
    if (purchaseId) await db.from("external_candidate_form_purchases").update({ redeemed_at: null, redeemed_by_application_id: null })
      .eq("id", purchaseId).eq("redeemed_by_application_id", applicationId);
    console.error("resa-admission-application-submit failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { success: false, error: "The admission application could not be completed. Contact the school office with your form number; do not repeatedly resubmit." }, origin);
  }
});
