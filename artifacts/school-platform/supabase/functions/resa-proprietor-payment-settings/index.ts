import { createClient } from "npm:@supabase/supabase-js@2";

const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("RESA_ALLOWED_ORIGIN") ?? "https://school-platform-foundation.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
function backendClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default;
  if (!url || !key) throw new Error("Supabase backend credentials are unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function isProprietor(admin: ReturnType<typeof backendClient>, userId: string) {
  const { data, error } = await admin.from("school_payment_gateway_proprietors")
    .select("user_id").eq("school_id", SCHOOL_ID).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
async function audit(admin: ReturnType<typeof backendClient>, actor: string, action: string, provider: string, environment: string, details: Record<string, unknown> = {}) {
  const { error } = await admin.from("school_payment_gateway_audit").insert({
    school_id: SCHOOL_ID, actor_user_id: actor, action, provider, environment, details,
  });
  if (error) throw error;
}
async function storeVaultSecret(admin: ReturnType<typeof backendClient>, provider: string, environment: string, kind: string, value: string) {
  const { error } = await admin.rpc("resa_store_payment_gateway_secret", {
    p_school_id: SCHOOL_ID, p_provider: provider, p_environment: environment,
    p_secret_kind: kind, p_secret_value: value,
  });
  if (error) throw new Error("Supabase Vault could not store or rotate the credential securely");
}

async function readVaultSecret(admin: ReturnType<typeof backendClient>, provider: string, environment: string, kind: string): Promise<string | null> {
  const { data, error } = await admin.rpc("resa_get_payment_gateway_secret", {
    p_school_id: SCHOOL_ID, p_provider: provider, p_environment: environment, p_secret_kind: kind,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign-in required" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? publishable.default;
    if (!url || !anon) return json({ error: "Authentication service unavailable" }, 503);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user?.id) return json({ error: "Valid sign-in required" }, 401);
    const admin = backendClient();
    if (!(await isProprietor(admin, auth.user.id))) return json({ error: "Only the designated RESA proprietor can manage payment gateways." }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "status");
    const provider = String(body.provider ?? "paystack");
    const environment = String(body.environment ?? "test");
    if (!["paystack", "monnify", "flutterwave"].includes(provider)) return json({ error: "Unsupported provider" }, 400);
    if (!["test", "live"].includes(environment)) return json({ error: "Invalid environment" }, 400);

    if (action === "status") {
      const [{ data: settings, error: settingsError }, { data: refs, error: refsError }, { data: paymentMethods, error: methodsError }] = await Promise.all([
        admin.from("school_payment_gateway_settings").select("provider,is_enabled,environment,display_name,settlement_bank_name,settlement_account_name,settlement_account_number_last4,settlement_verified_at,activated_at,updated_at").eq("school_id", SCHOOL_ID),
        admin.from("school_payment_gateway_secret_refs").select("provider,environment,secret_kind,updated_at").eq("school_id", SCHOOL_ID),
        admin.from("school_admission_payment_methods").select("id,method_type,display_name,bank_name,account_name,account_number,payment_url,instructions,is_enabled,display_order,updated_at").eq("school_id", SCHOOL_ID).order("display_order").order("created_at"),
      ]);
      if (settingsError) throw settingsError;
      if (refsError) throw refsError;
      if (methodsError) throw methodsError;
      return json({
        proprietor: true,
        paymentMethods: paymentMethods ?? [],
        providers: ["paystack", "monnify", "flutterwave"].map((p) => {
          const row = settings?.find((x: any) => x.provider === p);
          const has = (env: string, kind: string) => Boolean(refs?.some((x: any) => x.provider === p && x.environment === env && x.secret_kind === kind));
          return {
            provider: p, enabled: Boolean(row?.is_enabled), environment: row?.environment ?? "test",
            displayName: row?.display_name ?? null, settlementBankName: row?.settlement_bank_name ?? null,
            settlementAccountName: row?.settlement_account_name ?? null, settlementLast4: row?.settlement_account_number_last4 ?? null,
            testApiConfigured: has("test", "api_secret_key"), testWebhookConfigured: has("test", "webhook_signing_secret"),
            liveApiConfigured: has("live", "api_secret_key"), liveWebhookConfigured: has("live", "webhook_signing_secret"),
            updatedAt: row?.updated_at ?? null,
          };
        }),
      });
    }

    if (action === "save_payment_method") {
      const id = String(body.id ?? "").trim();
      const methodType = String(body.methodType ?? "");
      const displayName = String(body.displayName ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
      const bankName = String(body.bankName ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      const accountName = String(body.accountName ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
      const accountNumber = String(body.accountNumber ?? "").replace(/\D/g, "").slice(0, 20);
      const paymentUrl = String(body.paymentUrl ?? "").trim().slice(0, 500);
      const instructions = String(body.instructions ?? "").trim().slice(0, 2000);
      const displayOrder = Number.isInteger(Number(body.displayOrder)) ? Math.max(0, Math.min(1000, Number(body.displayOrder))) : 0;
      if (!["bank_transfer", "pos", "cash", "other"].includes(methodType)) return json({ error: "Choose a supported manual payment method." }, 400);
      if (displayName.length < 2) return json({ error: "Enter a clear payment option name." }, 400);
      if (methodType === "bank_transfer" && (!bankName || !accountName || !/^[0-9]{6,20}$/.test(accountNumber))) {
        return json({ error: "Bank transfer requires a bank name, account name and valid account number." }, 400);
      }
      if (paymentUrl && !/^https:\/\/\//i.test(paymentUrl)) return json({ error: "Payment links must use HTTPS." }, 400);
      if (methodType !== "bank_transfer" && !instructions && !paymentUrl) return json({ error: "Add payment instructions or a secure payment link." }, 400);
      const values = {
        school_id: SCHOOL_ID, method_type: methodType, display_name: displayName,
        bank_name: bankName || null, account_name: accountName || null,
        account_number: accountNumber || null, payment_url: paymentUrl || null,
        instructions, display_order: displayOrder, updated_by: auth.user.id, updated_at: new Date().toISOString(),
      };
      let saved: any;
      if (id) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json({ error: "Invalid payment method identifier." }, 400);
        const { data, error } = await admin.from("school_admission_payment_methods").update(values).eq("id", id).eq("school_id", SCHOOL_ID)
          .select("id,method_type,display_name,bank_name,account_name,account_number,payment_url,instructions,is_enabled,display_order,updated_at").single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await admin.from("school_admission_payment_methods").insert({ ...values, created_by: auth.user.id })
          .select("id,method_type,display_name,bank_name,account_name,account_number,payment_url,instructions,is_enabled,display_order,updated_at").single();
        if (error) throw error;
        saved = data;
      }
      const { error: auditError } = await admin.from("school_admission_payment_method_audit").insert({
        school_id: SCHOOL_ID, method_id: saved.id, actor_user_id: auth.user.id,
        action: id ? "updated" : "created",
        details: { method_type: methodType, display_name: displayName, account_number_changed: Boolean(accountNumber), payment_url_configured: Boolean(paymentUrl) },
      });
      if (auditError) throw auditError;
      return json({ success: true, method: saved, message: "Admission payment option saved. It will appear to applicants only when enabled." });
    }

    if (action === "set_payment_method_enabled") {
      const id = String(body.id ?? "").trim();
      const enabled = body.enabled === true;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json({ error: "Invalid payment method identifier." }, 400);
      const { data, error } = await admin.from("school_admission_payment_methods").update({ is_enabled: enabled, updated_by: auth.user.id, updated_at: new Date().toISOString() })
        .eq("id", id).eq("school_id", SCHOOL_ID).select("id").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("school_admission_payment_method_audit").insert({
        school_id: SCHOOL_ID, method_id: data.id, actor_user_id: auth.user.id,
        action: enabled ? "enabled" : "disabled", details: {},
      });
      if (auditError) throw auditError;
      return json({ success: true, message: enabled ? "Payment option is now visible to applicants." : "Payment option hidden from applicants." });
    }

    if (action === "save_credentials") {
      if (provider !== "paystack") return json({ error: "This provider's secure adapter is not implemented yet. Paystack is the first supported provider." }, 409);
      if (environment === "live") return json({ error: "Live credential registration is locked until the approved production release." }, 409);
      const apiKey = String(body.apiSecretKey ?? "").trim();
      const webhookSecret = String(body.webhookSigningSecret ?? "").trim();
      const expectedPrefix = environment === "test" ? "sk_test_" : "sk_live_";
      if (apiKey && !apiKey.startsWith(expectedPrefix)) return json({ error: `The ${environment} Paystack secret key must start with ${expectedPrefix}` }, 400);
      const legacyWebhookKeyPrefix = environment === "test" ? "sk_test_" : "sk_live_";
      if (webhookSecret && !webhookSecret.startsWith("whsec_") && !webhookSecret.startsWith(legacyWebhookKeyPrefix)) {
        return json({ error: `Enter a Paystack webhook signing secret (whsec_) or the matching ${environment} legacy API key.` }, 400);
      }
      if (!apiKey && !webhookSecret) return json({ error: "Enter at least one new credential to save." }, 400);
      if (apiKey) await storeVaultSecret(admin, provider, environment, "api_secret_key", apiKey);
      if (webhookSecret) await storeVaultSecret(admin, provider, environment, "webhook_signing_secret", webhookSecret);
      const { error } = await admin.from("school_payment_gateway_settings").upsert({
        school_id: SCHOOL_ID, provider, environment, is_enabled: false, updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,provider" });
      if (error) throw error;
      await audit(admin, auth.user.id, "credentials_saved", provider, environment, { apiKeyUpdated: Boolean(apiKey), webhookSecretUpdated: Boolean(webhookSecret) });
      return json({ success: true, message: "Credentials encrypted in Supabase Vault. They cannot be viewed again in the portal.", enabled: false });
    }

    if (action === "enable_test") {
      if (provider !== "paystack" || environment !== "test") return json({ error: "Only Paystack test mode can be enabled in this release." }, 409);
      const { data: refs, error: refsError } = await admin.from("school_payment_gateway_secret_refs").select("secret_kind")
        .eq("school_id", SCHOOL_ID).eq("provider", provider).eq("environment", "test");
      if (refsError) throw refsError;
      const kinds = new Set((refs ?? []).map((x: any) => x.secret_kind));
      if (!kinds.has("api_secret_key") || !kinds.has("webhook_signing_secret")) return json({ error: "Save both the Paystack test API secret and webhook signing secret first." }, 409);
      const testApiSecret = await readVaultSecret(admin, "paystack", "test", "api_secret_key");
      if (!testApiSecret || !testApiSecret.startsWith("sk_test_")) return json({ error: "A valid Paystack test secret key is required." }, 409);
      const validationResponse = await fetch("https://api.paystack.co/balance", { method: "GET", headers: { Authorization: `Bearer ${testApiSecret}` } });
      const validationPayload = await validationResponse.json().catch(() => ({}));
      if (!validationResponse.ok || validationPayload.status !== true) return json({ error: "Paystack rejected the test API key. Check the key in your Paystack dashboard and save it again." }, 409);
      const { error } = await admin.from("school_payment_gateway_settings").upsert({
        school_id: SCHOOL_ID, provider, environment: "test", is_enabled: true, activated_at: new Date().toISOString(), activated_by: auth.user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,provider" });
      if (error) throw error;
      await audit(admin, auth.user.id, "test_enabled", provider, "test", { liveMode: false });
      return json({ success: true, message: "Paystack test mode enabled. No live payments are enabled." });
    }

    if (action === "disable") {
      const { error } = await admin.from("school_payment_gateway_settings").upsert({
        school_id: SCHOOL_ID, provider, environment, is_enabled: false, updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,provider" });
      if (error) throw error;
      await audit(admin, auth.user.id, "gateway_disabled", provider, environment);
      return json({ success: true, message: "Gateway disabled." });
    }

    if (action === "enable_live") {
      await audit(admin, auth.user.id, "live_activation_blocked", provider, "live", { reason: "End-to-end test acceptance and live onboarding gates are not yet implemented." });
      return json({ error: "Live activation is locked until end-to-end test acceptance, merchant verification and a separate production release are complete." }, 409);
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("RESA proprietor payment settings error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Payment settings could not be updated. Please retry or contact JETAB TECH." }, 500);
  }
});
