import { createClient } from "npm:@supabase/supabase-js@2";

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const equal = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
async function hmac(secret: string, message: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, message));
}
async function verifySignature(raw: Uint8Array, request: Request, signingSecrets: string[]): Promise<boolean> {
  const modern = request.headers.get("paystack-signature");
  if (modern) {
    if (!signingSecrets.length) return false;
    const parts = modern.split(",");
    const timestamp = parts.find((p) => p.trim().startsWith("t="))?.trim().slice(2);
    if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const signatures = parts.filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3).split(":").at(-1) ?? "");
    if (!signatures.length) return false;
    const prefix = new TextEncoder().encode(`${timestamp}.`);
    const message = new Uint8Array(prefix.length + raw.length);
    message.set(prefix); message.set(raw, prefix.length);
    for (const secret of signingSecrets) {
      const expected = await hmac(secret, message);
      if (signatures.some((sig) => /^[0-9a-f]{128}$/.test(sig) && equal(expected, sig))) return true;
    }
    return false;
  }
  const legacy = request.headers.get("x-paystack-signature");
  if (legacy && /^[0-9a-f]{128}$/.test(legacy)) {
    for (const secret of signingSecrets) if (equal(await hmac(secret, raw), legacy)) return true;
  }
  return false;
}
const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
async function readVaultSecret(admin: any, environment: string, kind: string): Promise<string | null> {
  const { data, error } = await admin.rpc("resa_get_payment_gateway_secret", {
    p_school_id: SCHOOL_ID, p_provider: "paystack", p_environment: environment, p_secret_kind: kind,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default;
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase server secret is not configured");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signingSecrets: string[] = [];
    for (const environment of ["test", "live"]) {
      const secret = await readVaultSecret(admin, environment, "webhook_signing_secret");
      if (secret) signingSecrets.push(secret);
    }
    const raw = new Uint8Array(await req.arrayBuffer());
    if (!(await verifySignature(raw, req, signingSecrets))) return new Response("Invalid signature", { status: 401 });
    const event = JSON.parse(new TextDecoder().decode(raw));
    if (event.event !== "charge.success" || !event.data?.reference) return new Response("Event ignored", { status: 200 });

    const reference = String(event.data.reference);
    const { data: intent, error: intentError } = await admin.from("student_fee_payment_intents")
      .select("id,expected_amount_minor,currency,status,provider").eq("provider", "paystack")
      .eq("provider_reference", reference).maybeSingle();
    if (intentError) throw intentError;
    if (!intent) {
      const { data: admissionIntent, error: admissionIntentError } = await admin.from("admission_form_payment_intents")
        .select("id,school_id,amount_minor,currency,status,provider_reference").eq("provider", "paystack")
        .eq("provider_reference", reference).maybeSingle();
      if (admissionIntentError) throw admissionIntentError;
      if (!admissionIntent) return new Response("Unknown reference", { status: 200 });
      if (admissionIntent.status === "paid") return new Response("Admission form already issued", { status: 200 });

      const { data: admissionGateway, error: admissionGatewayError } = await admin.from("school_payment_gateway_settings")
        .select("environment").eq("school_id", admissionIntent.school_id).eq("provider", "paystack").maybeSingle();
      if (admissionGatewayError) throw admissionGatewayError;
      const admissionEnvironment = admissionGateway?.environment === "live" ? "live" : "test";
      const admissionSecret = await readVaultSecret(admin, admissionEnvironment, "api_secret_key");
      const admissionPrefix = admissionEnvironment === "live" ? "sk_live_" : "sk_test_";
      if (!admissionSecret || !admissionSecret.startsWith(admissionPrefix)) {
        console.error("RESA admission verification credential is unavailable");
        return new Response("Admission payment verification is temporarily unavailable", { status: 500 });
      }

      const admissionVerifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${admissionSecret}` },
      });
      const admissionVerified = await admissionVerifyResponse.json().catch(() => ({}));
      const admissionTx = admissionVerified.data;
      if (!admissionVerifyResponse.ok || admissionVerified.status !== true || admissionTx?.status !== "success") {
        return new Response("Admission provider verification is not final; retry webhook", { status: 500 });
      }
      if (admissionTx.reference !== reference || admissionTx.currency !== "NGN" ||
          Number(admissionTx.amount) !== Number(admissionIntent.amount_minor) ||
          (event.data.id != null && String(admissionTx.id) !== String(event.data.id))) {
        await admin.from("admission_form_payment_intents")
          .update({ status: "failed", failure_code: "provider_verification_mismatch", updated_at: new Date().toISOString() })
          .eq("id", admissionIntent.id).neq("status", "paid");
        return new Response("Verified admission transaction does not match the RESA payment intent", { status: 200 });
      }

      const { error: admissionRecordError } = await admin.rpc("record_verified_admission_form_purchase", {
        p_intent_id: admissionIntent.id,
        p_provider_transaction_id: String(admissionTx.id),
        p_verified_amount_minor: Number(admissionTx.amount),
        p_verified_currency: String(admissionTx.currency),
      });
      if (admissionRecordError) {
        console.error("RESA verified admission payment RPC failed", admissionRecordError.message);
        return new Response("Admission payment verification requires retry", { status: 500 });
      }
      return new Response("Admission form payment verified", { status: 200 });
    }
    if (intent.status === "paid") return new Response("Already processed", { status: 200 });
    const { data: gateway, error: gatewayError } = await admin.from("school_payment_gateway_settings")
      .select("environment").eq("school_id", SCHOOL_ID).eq("provider", "paystack").maybeSingle();
    if (gatewayError) throw gatewayError;
    const environment = gateway?.environment === "live" ? "live" : "test";
    const secretKey = await readVaultSecret(admin, environment, "api_secret_key");
    const expectedPrefix = environment === "live" ? "sk_live_" : "sk_test_";
    if (!secretKey || !secretKey.startsWith(expectedPrefix)) {
      console.error("RESA Paystack verification credential is unavailable for the active environment");
      return new Response("Payment verification is temporarily unavailable", { status: 500 });
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verified = await verifyResponse.json().catch(() => ({}));
    const tx = verified.data;
    // Provider/API delays and not-yet-final verification are retryable. Do not
    // permanently fail a legitimate intent because Paystack is temporarily unavailable.
    if (!verifyResponse.ok || verified.status !== true || tx?.status !== "success") {
      return new Response("Provider verification is not final; retry webhook", { status: 500 });
    }
    if (tx.reference !== reference || tx.currency !== "NGN" ||
        Number(tx.amount) !== Number(intent.expected_amount_minor) ||
        (event.data.id != null && String(tx.id) !== String(event.data.id))) {
      await admin.from("student_fee_payment_intents").update({ status: "failed", failure_code: "provider_verification_mismatch" })
        .eq("id", intent.id).neq("status", "paid");
      return new Response("Verified transaction does not match the RESA payment intent", { status: 200 });
    }

    const { error: rpcError } = await admin.rpc("record_gateway_verified_school_fee_payment", {
      p_intent_id: intent.id,
      p_provider_transaction_id: String(tx.id),
      p_verified_amount_minor: Number(tx.amount),
      p_verified_currency: String(tx.currency),
    });
    if (rpcError) {
      console.error("RESA verified payment RPC failed", rpcError.message);
      return new Response("Payment verification requires retry", { status: 500 });
    }
    return new Response("Payment verified", { status: 200 });
  } catch (error) {
    console.error("RESA Paystack webhook error", error instanceof Error ? error.message : "unknown");
    return new Response("Webhook processing failed", { status: 500 });
  }
});
