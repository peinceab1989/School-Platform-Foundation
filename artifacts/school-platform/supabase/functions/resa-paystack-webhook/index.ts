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
async function verifySignature(raw: Uint8Array, request: Request): Promise<boolean> {
  const signingSecret = Deno.env.get("PAYSTACK_WEBHOOK_SECRET");
  const legacySecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const modern = request.headers.get("paystack-signature");
  if (modern && signingSecret) {
    const parts = modern.split(",");
    const timestamp = parts.find((p) => p.trim().startsWith("t="))?.trim().slice(2);
    if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const signatures = parts.filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3).split(":").at(-1) ?? "");
    const prefix = new TextEncoder().encode(`${timestamp}.`);
    const message = new Uint8Array(prefix.length + raw.length);
    message.set(prefix); message.set(raw, prefix.length);
    const expected = await hmac(signingSecret, message);
    return signatures.some((sig) => /^[0-9a-f]{128}$/.test(sig) && equal(expected, sig));
  }
  const legacy = request.headers.get("x-paystack-signature");
  if (legacy && legacySecret && /^[0-9a-f]{128}$/.test(legacy)) return equal(await hmac(legacySecret, raw), legacy);
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const raw = new Uint8Array(await req.arrayBuffer());
    if (!(await verifySignature(raw, req))) return new Response("Invalid signature", { status: 401 });
    const event = JSON.parse(new TextDecoder().decode(raw));
    if (event.event !== "charge.success" || !event.data?.reference) return new Response("Event ignored", { status: 200 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get(secretKeys.default ?? "");
    if (!serviceKey) throw new Error("Supabase server secret is not configured");
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const reference = String(event.data.reference);
    const { data: intent, error: intentError } = await admin.from("student_fee_payment_intents")
      .select("id,expected_amount_minor,currency,status,provider").eq("provider", "paystack")
      .eq("provider_reference", reference).maybeSingle();
    if (intentError) throw intentError;
    if (!intent) return new Response("Unknown reference", { status: 200 });
    if (intent.status === "paid") return new Response("Already processed", { status: 200 });

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verified = await verifyResponse.json().catch(() => ({}));
    const tx = verified.data;
    if (!verifyResponse.ok || verified.status !== true || tx?.status !== "success" ||
        tx.reference !== reference || tx.currency !== "NGN" ||
        Number(tx.amount) !== Number(intent.expected_amount_minor)) {
      await admin.from("student_fee_payment_intents").update({ status: "failed", failure_code: "provider_verification_mismatch" })
        .eq("id", intent.id).neq("status", "paid");
      return new Response("Transaction not verified", { status: 200 });
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
