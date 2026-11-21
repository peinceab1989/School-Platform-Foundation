import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyPaystackWebhookSignature } from "./signature.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const PAYSTACK_WEBHOOK_SECRET = Deno.env.get("PAYSTACK_WEBHOOK_SECRET") || "";
const PAYSTACK_MODE = (Deno.env.get("PAYSTACK_MODE") || "test").toLowerCase();
const APP_URL = (Deno.env.get("RESA_APP_URL") || "https://school-platform-foundation.pages.dev").replace(/\/$/, "");\n// Fail closed until administrator-issued RESA Payment Clearance IDs are enforced end-to-end.\nconst PAYMENT_CLEARANCE_GATE_READY = false;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function cors(origin: string | null) {
  const allowed = [APP_URL, "https://school-platform-foundation.pages.dev", "https://resa-school-portal.netlify.app"];
  let cloudflarePreview = false;
  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      cloudflarePreview = hostname === "school-platform-foundation.pages.dev" ||
        hostname.endsWith(".school-platform-foundation.pages.dev");
    } catch {
      cloudflarePreview = false;
    }
  }
  const value = origin && (allowed.includes(origin) || cloudflarePreview) ? origin : APP_URL;
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}


async function currentUser(req: Request) {
  const header = req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("Sign in to continue.");
  const token = header.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: header } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Your sign-in session could not be verified.");
  return data.user;
}

async function verifyWithPaystack(reference: string) {
  if (!PAYSTACK_SECRET_KEY) throw new Error("Online payments are not configured yet. Please contact RESA Finance.");
  const result = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
    headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY },
  });
  const payload = await result.json().catch(() => null);
  if (!result.ok || !payload?.status || !payload?.data) throw new Error("Paystack could not verify this transaction yet.");
  return payload.data;
}

async function settleVerifiedTransaction(data: Record<string, unknown>) {
  const reference = String(data.reference || "");
  const status = String(data.status || "");
  const amount = Number(data.amount);
  const currency = String(data.currency || "");
  const domain = String(data.domain || "");
  const transactionId = String(data.id || "");
  if (!reference || status !== "success" || !Number.isSafeInteger(amount) || amount <= 0 || !transactionId) {
    throw new Error("The Paystack transaction is not a successful, verifiable payment.");
  }
  const expectedDomain = PAYSTACK_MODE === "live" ? "live" : "test";
  if (currency !== "NGN" || domain !== expectedDomain) throw new Error("The Paystack transaction mode or currency does not match RESA configuration.");
  const { data: settled, error } = await admin.rpc("record_verified_paystack_fee_payment", {
    p_reference: reference,
    p_provider_transaction_id: transactionId,
    p_amount_kobo: amount,
    p_currency: currency,
    p_provider_domain: domain,
  });
  if (error) throw error;
  return settled as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, headers);

  const url = new URL(req.url);
  const isWebhook = url.searchParams.get("action") === "webhook";
  if (isWebhook) {
    const raw = new Uint8Array(await req.arrayBuffer());
    if (!(await verifyPaystackWebhookSignature({
      modernSignature: req.headers.get("paystack-signature"),
      legacySignature: req.headers.get("x-paystack-signature"),
      rawBody: raw,
      webhookSecret: PAYSTACK_WEBHOOK_SECRET,
      secretKey: PAYSTACK_SECRET_KEY,
    }))) return response({ error: "Invalid Paystack signature" }, 401);
    let event: Record<string, unknown>;
    try { event = JSON.parse(new TextDecoder().decode(raw)); } catch { return response({ error: "Invalid webhook payload" }, 400); }
    if (event.event !== "charge.success") return response({ received: true });
    try {
      const eventData = event.data as Record<string, unknown>;
      const reference = String(eventData?.reference || "");
      if (!reference) return response({ error: "Missing transaction reference" }, 400);
      const verified = await verifyWithPaystack(reference);
      if (String(verified.reference) !== reference) return response({ error: "Paystack verification reference mismatch" }, 400);
      const settled = await settleVerifiedTransaction(verified as Record<string, unknown>);
      if (settled.review_required) return response({ received: true, finance_review_required: true });
      return response({ received: true });
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : "Webhook processing failed" }, 500);
    }
  }

  try {
    const user = await currentUser(req);
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "status") {
      const schoolId = String(body.school_id || "");
      if (!schoolId) return response({ error: "School context is required." }, 400, headers);
      const { data: gatewaySetting, error: settingError } = await admin
        .from("resa_payment_gateway_settings")
        .select("paystack_enabled")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (settingError) throw settingError;
      const enabled = gatewaySetting?.paystack_enabled === true;
      const expectedKeyPrefix = PAYSTACK_MODE === "live" ? "sk_live_" : "sk_test_";
      const validMode = PAYSTACK_MODE === "test" || PAYSTACK_MODE === "live";
      const configured = validMode && PAYSTACK_SECRET_KEY.startsWith(expectedKeyPrefix) &&
        PAYSTACK_WEBHOOK_SECRET.startsWith("whsec_") && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
      return response({ enabled, configured: enabled && configured, mode: PAYSTACK_MODE === "live" ? "live" : "test",
        message: !enabled ? "Paystack is disabled by RESA Finance." : !configured ? "Paystack merchant setup is incomplete." : null }, 200, headers);
    }

    if (action === "initialize") {
      const requestedSchoolId = String(body.school_id || "");
      if (!requestedSchoolId) return response({ error: "School context is required." }, 400, headers);
      const { data: gatewaySetting, error: settingError } = await admin
        .from("resa_payment_gateway_settings")
        .select("paystack_enabled")
        .eq("school_id", requestedSchoolId)
        .maybeSingle();
      if (settingError) throw settingError;
      if (gatewaySetting?.paystack_enabled !== true) {
        return response({ error: "Paystack is currently disabled by RESA Finance. Please use an approved offline payment method or contact the school." }, 403, headers);
      }
      if (!PAYSTACK_SECRET_KEY) return response({ error: "Paystack is not configured yet. RESA Finance must complete merchant setup." }, 503, headers);
      if (!["test", "live"].includes(PAYSTACK_MODE)) return response({ error: "Paystack mode is misconfigured." }, 503, headers);
      if ((PAYSTACK_MODE === "test" && !PAYSTACK_SECRET_KEY.startsWith("sk_test_")) ||
          (PAYSTACK_MODE === "live" && !PAYSTACK_SECRET_KEY.startsWith("sk_live_"))) {
        return response({ error: "The Paystack key does not match the configured payment mode." }, 503, headers);
      }

      const schoolId = String(body.school_id || "");
      const assignmentId = String(body.assignment_id || "");
      const amountNaira = Number(body.amount_naira);
      if (!schoolId || !assignmentId || !Number.isFinite(amountNaira) || amountNaira <= 0 || Math.round(amountNaira * 100) <= 0) {
        return response({ error: "Choose a fee and enter a valid amount." }, 400, headers);
      }

      const { data: accounts, error: accountError } = await admin.from("parent_portal_accounts")
        .select("parent_guardian_id").eq("school_id", schoolId).eq("user_id", user.id).eq("is_active", true);
      if (accountError) throw accountError;
      const guardianIds = (accounts || []).map((row: Record<string, unknown>) => String(row.parent_guardian_id));
      if (!guardianIds.length) return response({ error: "Only an active linked parent account can pay a learner's fees here." }, 403, headers);

      const { data: assignment, error: assignmentError } = await admin.from("student_fee_assignments")
        .select("id,school_id,student_id,amount_due").eq("id", assignmentId).eq("school_id", schoolId).maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return response({ error: "The selected fee assignment was not found." }, 404, headers);

      const { data: childLinks, error: childLinkError } = await admin.from("parent_student_portal_access")
        .select("student_id").eq("school_id", schoolId).eq("is_active", true)
        .in("parent_guardian_id", guardianIds).eq("student_id", assignment.student_id);
      if (childLinkError) throw childLinkError;
      if (!childLinks?.length) return response({ error: "This learner is not linked to your parent account." }, 403, headers);

      const { data: visibleFees, error: visibilityError } = await admin.from("parent_fee_portal_views")
        .select("id").eq("school_id", schoolId).eq("student_id", assignment.student_id)
        .eq("student_fee_assignment_id", assignmentId).eq("can_view", true).in("parent_guardian_id", guardianIds);
      if (visibilityError) throw visibilityError;
      if (!visibleFees?.length) return response({ error: "This fee has not been authorised for parent payment viewing." }, 403, headers);

      const { data: payments, error: paymentError } = await admin.from("student_fee_payments")
        .select("amount_paid").eq("school_id", schoolId).eq("student_fee_assignment_id", assignmentId);
      if (paymentError) throw paymentError;
      const paid = (payments || []).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amount_paid || 0), 0);
      const balance = Math.max(0, Number(assignment.amount_due) - paid);
      const amountKobo = Math.round(amountNaira * 100);
      if (amountNaira > balance + 0.001) return response({ error: "Payment exceeds the current outstanding balance of ₦" + balance.toLocaleString("en-NG") + "." }, 400, headers);
      if (Math.abs(amountNaira - amountKobo / 100) > 0.000001) return response({ error: "Enter an amount with no more than two decimal places." }, 400, headers);

      if (!user.email || !user.email_confirmed_at) return response({ error: "Your RESA sign-in account needs a verified email address before online payment. Contact the school office if you need help." }, 400, headers);
      const reference = "RESA-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
      const { data: intentId, error: intentError } = await admin.rpc("create_paystack_payment_intent", {
        p_school_id: schoolId,
        p_assignment_id: assignmentId,
        p_student_id: assignment.student_id,
        p_initiated_by: user.id,
        p_reference: reference,
        p_amount_kobo: amountKobo,
        p_gateway_mode: PAYSTACK_MODE,
      });
      if (intentError) throw intentError;

      const callbackUrl = APP_URL + "/parent-dashboard?paystack=verify";
      const initialized = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: amountKobo,
          currency: "NGN",
          reference,
          callback_url: callbackUrl,
          metadata: { school_id: schoolId, fee_assignment_id: assignmentId, payment_intent_id: intentId },
        }),
      });
      const initPayload = await initialized.json().catch(() => null);
      if (!initialized.ok || !initPayload?.status || !initPayload?.data?.authorization_url) {
        await admin.from("paystack_payment_intents").update({ status: "failed", failure_reason: "Paystack initialization failed", updated_at: new Date().toISOString() }).eq("id", intentId);
        return response({ error: "Paystack could not start checkout. Please try again or contact RESA Finance." }, 502, headers);
      }
      const { error: checkoutUpdateError } = await admin.from("paystack_payment_intents").update({
        authorization_url: initPayload.data.authorization_url,
        access_code: initPayload.data.access_code,
        updated_at: new Date().toISOString(),
      }).eq("id", intentId);
      if (checkoutUpdateError) throw checkoutUpdateError;
      return response({ authorization_url: initPayload.data.authorization_url, reference }, 200, headers);
    }

    if (action === "verify") {
      const reference = String(body.reference || "");
      if (!reference) return response({ error: "A payment reference is required." }, 400, headers);
      const { data: intent, error: intentError } = await admin.from("paystack_payment_intents")
        .select("reference,initiated_by,status,school_id,receipt_number").eq("reference", reference).maybeSingle();
      if (intentError) throw intentError;
      if (!intent || intent.initiated_by !== user.id) return response({ error: "This payment reference does not belong to your signed-in account." }, 403, headers);
      if (intent.status === "paid") return response({ success: true, status: "paid", receipt_number: intent.receipt_number }, 200, headers);
      const verified = await verifyWithPaystack(reference);
      if (String(verified.reference) !== reference) return response({ error: "Paystack verification reference mismatch." }, 400, headers);
      if (String(verified.status) !== "success") return response({ success: false, status: String(verified.status || "pending"), message: "Paystack has not confirmed this payment as successful yet." }, 200, headers);
      const settled = await settleVerifiedTransaction(verified as Record<string, unknown>);
      if (settled.review_required) return response({ success: false, status: "review_required", message: "Payment received, but the fee balance changed. RESA Finance must reconcile this transaction." }, 409, headers);
      return response({ success: true, status: "paid", receipt_number: settled.receipt_number }, 200, headers);
    }

    return response({ error: "Unknown payment action." }, 400, headers);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Payment processing failed." }, 400, headers);
  }
});
