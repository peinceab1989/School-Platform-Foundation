import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("RESA_ALLOWED_ORIGIN") ?? "https://school-platform-foundation.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
async function readVaultSecret(admin: any, provider: string, environment: string, kind: string): Promise<string | null> {
  const { data, error } = await admin.rpc("resa_get_payment_gateway_secret", {
    p_school_id: SCHOOL_ID, p_provider: provider, p_environment: environment, p_secret_kind: kind,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return json({ error: "Sign-in required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKeys.default;
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Online payment is not configured yet." }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userResult.user?.id || !userResult.user.email) return json({ error: "Valid parent sign-in and email are required." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const assignmentId = String(body.assignment_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) return json({ error: "A valid fee assignment is required." }, 400);

    const { data: assignment, error: assignmentError } = await admin.from("student_fee_assignments")
      .select("id,school_id,student_id,amount_due,status").eq("id", assignmentId).maybeSingle();
    if (assignmentError || !assignment) return json({ error: "Fee assignment not found." }, 404);

    const { data: parentAccounts, error: parentError } = await admin.from("parent_portal_accounts")
      .select("parent_guardian_id").eq("school_id", assignment.school_id)
      .eq("user_id", userResult.user.id).eq("is_active", true);
    if (parentError) throw parentError;
    const parentIds = (parentAccounts ?? []).map((x: { parent_guardian_id: string }) => x.parent_guardian_id);
    if (!parentIds.length) return json({ error: "This account is not linked to the learner." }, 403);

    const { data: accessRows, error: accessError } = await admin.from("parent_student_portal_access")
      .select("id").eq("school_id", assignment.school_id).eq("student_id", assignment.student_id)
      .in("parent_guardian_id", parentIds).eq("is_active", true).limit(1);
    if (accessError) throw accessError;
    const { data: feeViews, error: viewError } = await admin.from("parent_fee_portal_views")
      .select("id").eq("school_id", assignment.school_id).eq("student_id", assignment.student_id)
      .eq("student_fee_assignment_id", assignment.id).eq("can_view", true)
      .in("parent_guardian_id", parentIds).limit(1);
    if (viewError) throw viewError;
    if (!accessRows?.length || !feeViews?.length) return json({ error: "This fee has not been shared with your parent account." }, 403);

    const { data: gateway, error: gatewayError } = await admin.from("school_payment_gateway_settings")
      .select("is_enabled,environment").eq("school_id", assignment.school_id)
      .eq("provider", "paystack").maybeSingle();
    if (gatewayError) throw gatewayError;
    if (!gateway?.is_enabled || gateway.environment !== "test" && gateway.environment !== "live") {
      return json({ error: "Paystack checkout has not been enabled by school Finance." }, 503);
    }
    const secretKey = await readVaultSecret(admin, "paystack", gateway.environment, "api_secret_key");
    const expectedKeyPrefix = gateway.environment === "test" ? "sk_test_" : "sk_live_";
    if (!secretKey || !secretKey.startsWith(expectedKeyPrefix)) {
      return json({ error: "The configured Paystack server credential is unavailable or does not match the active environment." }, 503);
    }

    const { data: existingPayments, error: paymentsError } = await admin.from("student_fee_payments")
      .select("amount_paid").eq("school_id", assignment.school_id)
      .eq("student_fee_assignment_id", assignment.id);
    if (paymentsError) throw paymentsError;
    const paid = (existingPayments ?? []).reduce((sum: number, row: { amount_paid: number }) => sum + Number(row.amount_paid), 0);
    const balance = Math.max(0, Number(assignment.amount_due) - paid);
    if (!Number.isFinite(balance) || balance <= 0) return json({ error: "There is no outstanding balance on this fee." }, 409);

    const amountMinor = Math.round(balance * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return json({ error: "Fee amount is outside the supported payment range." }, 400);
    const reference = `RESA-${crypto.randomUUID().replaceAll("-", "")}`;
    const { data: intent, error: intentError } = await admin.from("student_fee_payment_intents").insert({
      school_id: assignment.school_id, student_fee_assignment_id: assignment.id,
      student_id: assignment.student_id, initiated_by: userResult.user.id,
      provider: "paystack", provider_reference: reference, expected_amount: balance,
      expected_amount_minor: amountMinor, currency: "NGN", status: "pending",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).select("id").single();
    if (intentError) throw intentError;

    const callbackUrl = Deno.env.get("RESA_PARENT_PAYMENT_CALLBACK_URL")
      ?? "https://school-platform-foundation.pages.dev/parent-dashboard";
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userResult.user.email, amount: String(amountMinor), currency: "NGN",
        reference, callback_url: callbackUrl,
        metadata: { resa_intent_id: intent.id, school_id: assignment.school_id, fee_assignment_id: assignment.id },
      }),
    });
    const payload = await paystackResponse.json().catch(() => ({}));
    if (!paystackResponse.ok || payload.status !== true || !payload.data?.authorization_url) {
      await admin.from("student_fee_payment_intents").update({ status: "failed", failure_code: "provider_initialization_failed" }).eq("id", intent.id);
      return json({ error: "Paystack could not start checkout. No payment was recorded." }, 502);
    }

    const { error: updateError } = await admin.from("student_fee_payment_intents")
      .update({ checkout_url: payload.data.authorization_url }).eq("id", intent.id);
    if (updateError) throw updateError;
    return json({ checkout_url: payload.data.authorization_url, reference, intent_id: intent.id, amount: balance, currency: "NGN" });
  } catch (error) {
    console.error("RESA Paystack checkout error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Checkout could not be started. Please try again or contact school Finance." }, 500);
  }
});
