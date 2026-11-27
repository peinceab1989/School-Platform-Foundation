import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
const PRIMARY_ORIGIN = "https://school-platform-foundation.pages.dev";
const LEGACY_ORIGIN = "https://resa-school-portal.netlify.app";
const configuredOrigin = Deno.env.get("RESA_ALLOWED_ORIGIN");
const allowedOrigin = (origin: string) => origin === PRIMARY_ORIGIN || origin === LEGACY_ORIGIN ||
  (configuredOrigin ? origin === configuredOrigin : false) ||
  /^https:\/\/[a-f0-9]{8,40}\.school-platform-foundation\.pages\.dev$/.test(origin);
const headers = (origin: string) => ({
  ...(allowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
});
const reply = (origin: string, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: headers(origin) });
const clean = (value: unknown, max = 180) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

async function readVaultSecret(admin: any, environment: string, kind: string): Promise<string | null> {
  const { data, error } = await admin.rpc("resa_get_payment_gateway_secret", {
    p_school_id: SCHOOL_ID, p_provider: "paystack", p_environment: environment, p_secret_kind: kind,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigin(origin)) return reply(origin, 403, { success: false, error: "This website is not authorised to use RESA admission checkout." });
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return reply(origin, 405, { success: false, error: "POST required." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default;
    if (!supabaseUrl || !serviceKey) return reply(origin, 503, { success: false, error: "Admission checkout is temporarily unavailable." });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(origin, 400, { success: false, error: "A valid JSON request is required." });
    const action = clean(body.action, 20);

    if (action === "quote") {
      const [{ data: settings, error: settingsError }, { data: gateway, error: gatewayError }, { data: methods, error: methodsError }] = await Promise.all([
        admin.from("school_admission_settings").select("form_price,currency,online_checkout_enabled").eq("school_id", SCHOOL_ID).maybeSingle(),
        admin.from("school_payment_gateway_settings").select("is_enabled,environment").eq("school_id", SCHOOL_ID).eq("provider", "paystack").maybeSingle(),
        admin.from("school_admission_payment_methods").select("id,method_type,display_name,bank_name,account_name,account_number,payment_url,instructions,display_order").eq("school_id", SCHOOL_ID).eq("is_enabled", true).order("display_order").order("created_at"),
      ]);
      if (settingsError || gatewayError || methodsError) throw new Error("Could not read admission payment settings.");
      const price = settings?.form_price == null ? null : Number(settings.form_price);
      const validPrice = price !== null && Number.isFinite(price) && price > 0;
      const gatewayReady = Boolean(gateway?.is_enabled && ["test", "live"].includes(gateway.environment));
      const onlineCheckoutAvailable = Boolean(settings?.online_checkout_enabled && gatewayReady && price && price >= 50);
      return reply(origin, 200, {
        success: true, form_price: validPrice ? price : null,
        currency: settings?.currency ?? "NGN",
        online_checkout_available: onlineCheckoutAvailable,
        payment_available: onlineCheckoutAvailable || Boolean(methods?.length),
        payment_methods: methods ?? [],
        payment_environment: gatewayReady ? gateway?.environment ?? null : null,
      });
    }

    if (action === "status") {
      const reference = clean(body.reference, 100);
      if (!/^RESA-ADM-PAY-[A-F0-9]{32}$/.test(reference)) return reply(origin, 400, { success: false, error: "A valid payment reference is required." });
      const { data: intent, error } = await admin.from("admission_form_payment_intents")
        .select("id,status,form_purchase_id,provider_reference,amount_minor,currency,payment_environment")
        .eq("provider_reference", reference).eq("school_id", SCHOOL_ID).maybeSingle();
      if (error) throw error;
      if (!intent) return reply(origin, 404, { success: false, error: "Admission payment reference not found." });

      if (intent.status !== "paid") {
        if (intent.status === "failed") return reply(origin, 200, { success: true, status: "failed", verified: false });
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SCHOOL_ID + "|status|" + reference));
        const rateKey = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count, error: rateError } = await admin.from("admission_application_rate_events")
          .select("id", { count: "exact", head: true }).eq("rate_key", rateKey).gte("created_at", since);
        if (rateError) throw rateError;
        if ((count ?? 0) >= 10) return reply(origin, 429, { success: false, error: "Too many status checks. Wait a few minutes before trying again." });
        const { error: rateInsertError } = await admin.from("admission_application_rate_events").insert({ rate_key: rateKey });
        if (rateInsertError) throw rateInsertError;

        const environment = intent.payment_environment === "live" ? "live" : "test";
        const secretKey = await readVaultSecret(admin, environment, "api_secret_key");
        const expectedPrefix = environment === "live" ? "sk_live_" : "sk_test_";
        if (!secretKey || !secretKey.startsWith(expectedPrefix)) {
          return reply(origin, 503, { success: false, error: "RESA payment verification is temporarily unavailable. No form number has been issued." });
        }
        const verifyResponse = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
          headers: { Authorization: "Bearer " + secretKey },
        });
        const verified = await verifyResponse.json().catch(() => ({}));
        const tx = verified.data;
        if (!verifyResponse.ok || verified.status !== true || tx?.status !== "success") {
          return reply(origin, 200, { success: true, status: intent.status, verified: false });
        }
        if (tx.reference !== reference || tx.currency !== "NGN" ||
            Number(tx.amount) !== Number(intent.amount_minor) || tx.id == null) {
          await admin.from("admission_form_payment_intents")
            .update({ status: "failed", failure_code: "provider_verification_mismatch", updated_at: new Date().toISOString() })
            .eq("id", intent.id).neq("status", "paid");
          return reply(origin, 200, { success: true, status: "failed", verified: false });
        }
        const { data: recorded, error: recordError } = await admin.rpc("record_verified_admission_form_purchase", {
          p_intent_id: intent.id,
          p_provider_transaction_id: String(tx.id),
          p_verified_amount_minor: Number(tx.amount),
          p_verified_currency: String(tx.currency),
        });
        if (recordError) throw recordError;
        if (!recorded?.form_number || !recorded?.receipt_number) throw new Error("Verified payment did not return an issued admission form.");
        return reply(origin, 200, {
          success: true, status: "paid", verified: true,
          form_number: recorded.form_number, receipt_number: recorded.receipt_number,
          amount_paid: Number(tx.amount) / 100, paid_at: new Date().toISOString(),
        });
      }

      if (!intent.form_purchase_id) throw new Error("Paid admission intent has no linked form purchase.");
      const { data: purchase, error: purchaseError } = await admin.from("external_candidate_form_purchases")
        .select("form_number,receipt_number,amount_paid,paid_at").eq("id", intent.form_purchase_id).eq("school_id", SCHOOL_ID).maybeSingle();
      if (purchaseError || !purchase) throw new Error("Verified admission form is awaiting reconciliation.");
      return reply(origin, 200, {
        success: true, status: "paid", verified: true,
        form_number: purchase.form_number, receipt_number: purchase.receipt_number,
        amount_paid: purchase.amount_paid, paid_at: purchase.paid_at,
      });
    }

    if (action !== "initialize") return reply(origin, 400, { success: false, error: "Unsupported admission checkout action." });

    const applicantName = clean(body.applicant_name, 160);
    const classAppliedFor = clean(body.class_applied_for, 100);
    const parentName = clean(body.parent_name, 160);
    const phone = clean(body.phone, 40);
    const email = clean(body.email, 254).toLowerCase();
    const parentEmail = clean(body.parent_email, 254).toLowerCase();
    const clientRequestKey = clean(body.client_request_key, 36);
    if (applicantName.length < 3 || classAppliedFor.length < 2 || parentName.length < 3 || phone.replace(/\D/g, "").length < 7) {
      return reply(origin, 400, { success: false, error: "Enter the applicant, class, parent/guardian and a valid phone number." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))) {
      return reply(origin, 400, { success: false, error: "Enter a valid email address for the payment receipt." });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestKey)) {
      return reply(origin, 400, { success: false, error: "Refresh the page and try again." });
    }

    const [{ data: settings, error: settingsError }, { data: gateway, error: gatewayError }] = await Promise.all([
      admin.from("school_admission_settings").select("form_price,currency,online_checkout_enabled").eq("school_id", SCHOOL_ID).maybeSingle(),
      admin.from("school_payment_gateway_settings").select("is_enabled,environment").eq("school_id", SCHOOL_ID).eq("provider", "paystack").maybeSingle(),
    ]);
    if (settingsError || gatewayError) throw new Error("Could not read admission payment settings.");
    const amount = Number(settings?.form_price);
    if (!settings?.online_checkout_enabled || !Number.isFinite(amount) || amount < 50) {
      return reply(origin, 503, { success: false, error: "Online admission payment is not enabled. Please contact RESA Admissions for the confirmed fee and approved payment instructions." });
    }
    if (!gateway?.is_enabled || !["test", "live"].includes(gateway.environment)) {
      return reply(origin, 503, { success: false, error: "RESA has not enabled its secure Paystack payment gateway yet. No payment has been taken." });
    }
    const secretKey = await readVaultSecret(admin, gateway.environment, "api_secret_key");
    const expectedPrefix = gateway.environment === "test" ? "sk_test_" : "sk_live_";
    if (!secretKey || !secretKey.startsWith(expectedPrefix)) {
      return reply(origin, 503, { success: false, error: "The school payment credential is not configured for this environment. No payment has been taken." });
    }

    const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SCHOOL_ID + "|" + phone.replace(/\D/g, "") + "|" + email));
    const rateKey = [...new Uint8Array(digestBytes)].map(v => v.toString(16).padStart(2, "0")).join("");
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin.from("admission_application_rate_events")
      .select("id", { count: "exact", head: true }).eq("rate_key", rateKey).gte("created_at", since);
    if (rateError) throw rateError;
    if ((count ?? 0) >= 5) return reply(origin, 429, { success: false, error: "Too many checkout attempts. Wait ten minutes before trying again." });
    const { error: rateInsertError } = await admin.from("admission_application_rate_events").insert({ rate_key: rateKey });
    if (rateInsertError) throw rateInsertError;

    const { data: existing, error: existingError } = await admin.from("admission_form_payment_intents")
      .select("id,status,checkout_url,provider_reference,form_purchase_id")
      .eq("school_id", SCHOOL_ID).eq("client_request_key", clientRequestKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "paid") return reply(origin, 200, { success: true, status: "paid", reference: existing.provider_reference });
    if (existing?.status === "pending" && existing.checkout_url) {
      return reply(origin, 200, { success: true, checkout_url: existing.checkout_url, reference: existing.provider_reference });
    }
    if (existing) return reply(origin, 409, { success: false, error: "This checkout request is already being processed. Refresh the page before starting another." });

    const amountMinor = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 5000) return reply(origin, 400, { success: false, error: "The configured admission fee is outside the supported payment range." });
    const reference = "RESA-ADM-PAY-" + crypto.randomUUID().replaceAll("-", "").toUpperCase();
    const { data: intent, error: intentError } = await admin.from("admission_form_payment_intents").insert({
      school_id: SCHOOL_ID, buyer_email: email, buyer_phone: phone,
      applicant_name: applicantName, class_applied_for: classAppliedFor,
      parent_name: parentName, parent_email: parentEmail || null,
      amount, amount_minor: amountMinor, currency: "NGN",
      provider: "paystack", payment_environment: gateway.environment, provider_reference: reference, client_request_key: clientRequestKey,
      status: "pending", expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).select("id").single();
    if (intentError) {
      if (intentError.code === "23505") return reply(origin, 409, { success: false, error: "This checkout request has already been received. Refresh the page and check its status." });
      throw intentError;
    }

    const callbackUrl = Deno.env.get("RESA_ADMISSION_PAYMENT_CALLBACK_URL") ?? PRIMARY_ORIGIN + "/admissions";
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: "Bearer " + secretKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email, amount: String(amountMinor), currency: "NGN", reference, callback_url: callbackUrl,
        metadata: { resa_payment_type: "admission_form", resa_admission_intent_id: intent.id, school_id: SCHOOL_ID },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status !== true || !payload.data?.authorization_url) {
      await admin.from("admission_form_payment_intents").update({ status: "failed", failure_code: "provider_initialization_failed", updated_at: new Date().toISOString() }).eq("id", intent.id);
      return reply(origin, 502, { success: false, error: "Paystack could not start checkout. No admission form number has been issued." });
    }
    const { error: updateError } = await admin.from("admission_form_payment_intents")
      .update({ checkout_url: payload.data.authorization_url, updated_at: new Date().toISOString() }).eq("id", intent.id);
    if (updateError) throw updateError;
    return reply(origin, 200, { success: true, checkout_url: payload.data.authorization_url, reference, amount, currency: "NGN" });
  } catch (error) {
    console.error("RESA admission checkout error:", error instanceof Error ? error.message : "unknown");
    return reply(origin, 500, { success: false, error: "Admission checkout could not be started. No form number is issued until RESA verifies the payment." });
  }
});
