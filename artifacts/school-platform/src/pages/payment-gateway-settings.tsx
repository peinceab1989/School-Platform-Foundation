import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ShieldCheck, LockKeyhole, RefreshCw, Save, Power, AlertTriangle } from "lucide-react";

type ProviderStatus = {
  provider: string; enabled: boolean; environment: string; displayName: string | null;
  settlementBankName: string | null; settlementAccountName: string | null; settlementLast4: string | null;
  testApiConfigured: boolean; testWebhookConfigured: boolean; liveApiConfigured: boolean; liveWebhookConfigured: boolean;
  updatedAt: string | null;
};
const ownerId = "85bfff8f-72ee-49b8-bd80-213001468a0a";
export default function PaymentGatewaySettingsPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [rows, setRows] = useState<ProviderStatus[]>([]);
  const [apiSecretKey, setApiSecretKey] = useState("");
  const [webhookSigningSecret, setWebhookSigningSecret] = useState("");
  const [environment, setEnvironment] = useState("test");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isOwner = userId === ownerId;
  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-proprietor-payment-settings", {
      body: { action, provider: "paystack", environment, ...extra },
    });
    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const refresh = useCallback(async () => {
    if (!isOwner) return;
    setBusy(true); setError("");
    try {
      const data = await call("status");
      setRows(data.providers ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load secure payment settings."); }
    finally { setBusy(false); }
  }, [isOwner, environment]);
  useEffect(() => { void refresh(); }, [refresh]);
  const paystack = rows.find((r) => r.provider === "paystack");
  async function saveCredentials() {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await call("save_credentials", { apiSecretKey, webhookSigningSecret });
      setApiSecretKey(""); setWebhookSigningSecret("");
      setNotice(data.message || "Credentials saved securely.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Credentials could not be saved."); }
    finally { setBusy(false); }
  }
  async function enableTest() {
    setBusy(true); setError(""); setNotice("");
    try { const data = await call("enable_test"); setNotice(data.message); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Test mode could not be enabled."); }
    finally { setBusy(false); }
  }
  async function disableGateway() {
    setBusy(true); setError(""); setNotice("");
    try { const data = await call("disable"); setNotice(data.message); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Gateway could not be disabled."); }
    finally { setBusy(false); }
  }
  if (!isOwner) return <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6"><h1 className="text-xl font-bold">Access restricted</h1><p className="mt-2 text-sm text-slate-600">Only the designated RESA proprietor can manage payment gateway credentials.</p></section>;
  return <main className="mx-auto max-w-5xl space-y-6 text-slate-900">
    <header className="rounded-2xl bg-emerald-950 p-6 text-white"><div className="flex items-center gap-3"><ShieldCheck size={28}/><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Proprietor control centre</p><h1 className="text-2xl font-extrabold">Payment Gateway Settings</h1></div></div><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">Register payment merchant credentials securely. Secret values are encrypted in Supabase Vault and are never displayed again after saving.</p><p className="mt-2 text-xs text-emerald-200">Authorised proprietor: princeabgreat@gmail.com</p></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Paystack merchant credentials</h2><p className="text-sm text-slate-600">First provider being implemented for RESA online school-fee payments.</p></div><span className={paystack?.enabled ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"}>{paystack?.enabled ? "Test gateway enabled" : "Disabled"}</span></div>
      <label className="mt-5 block text-sm font-semibold">Environment<select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="test">Test / Sandbox</option><option value="live">Live / Production (locked)</option></select></label>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">Paystack secret API key<input type="password" autoComplete="new-password" spellCheck={false} value={apiSecretKey} onChange={(e) => setApiSecretKey(e.target.value)} placeholder={environment === "test" ? "sk_test_…" : "sk_live_…"} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm"/></label>
        <label className="block text-sm font-semibold">Webhook signing secret<input type="password" autoComplete="new-password" spellCheck={false} value={webhookSigningSecret} onChange={(e) => setWebhookSigningSecret(e.target.value)} placeholder="whsec_…" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm"/></label>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><LockKeyhole size={15} className="mt-0.5 shrink-0"/>Credentials are sent directly to the authenticated server function over HTTPS and stored encrypted at rest in Supabase Vault. They are not saved in browser storage, ordinary database columns or source code.</p>
      <button type="button" onClick={() => void saveCredentials()} disabled={busy || (!apiSecretKey.trim() && !webhookSigningSecret.trim()) || environment === "live"} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/> Save credentials securely</button>
      {environment === "live" && <p className="mt-2 text-xs text-amber-800">Live credential registration is locked in this release. Complete test-mode acceptance and merchant verification first.</p>}
      <div className="mt-5 rounded-xl bg-slate-50 p-4"><h3 className="font-bold">Credential status (values never shown)</h3><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p>Test API key: <strong>{paystack?.testApiConfigured ? "Configured" : "Not configured"}</strong></p><p>Test webhook secret: <strong>{paystack?.testWebhookConfigured ? "Configured" : "Not configured"}</strong></p><p>Live API key: <strong>{paystack?.liveApiConfigured ? "Configured" : "Not configured"}</strong></p><p>Live webhook secret: <strong>{paystack?.liveWebhookConfigured ? "Configured" : "Not configured"}</strong></p></div><button type="button" onClick={() => void refresh()} disabled={busy} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><RefreshCw size={15}/> Refresh status</button></div>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void enableTest()} disabled={busy || !paystack?.testApiConfigured || !paystack?.testWebhookConfigured || environment !== "test"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Power size={16}/> Enable test mode</button><button type="button" onClick={() => void disableGateway()} disabled={busy || !paystack?.enabled} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Disable gateway</button></div>
    </section>
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-extrabold text-amber-950"><AlertTriangle size={18}/> Live payments are locked</h2><p className="mt-2 text-sm leading-6 text-amber-900">Live collection will not be activated from this page. It requires verified Paystack merchant onboarding and settlement details, a complete successful test transaction and webhook/receipt reconciliation, review of the production deployment, and a separate proprietor-approved release.</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-extrabold">Other providers</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-xl border p-4"><strong>Monnify</strong><p className="mt-1 text-sm text-slate-600">Adapter and signed webhook implementation pending. Credentials cannot yet be registered.</p><span className="mt-2 inline-block text-xs font-bold text-amber-800">Not available</span></div><div className="rounded-xl border p-4"><strong>Flutterwave</strong><p className="mt-1 text-sm text-slate-600">Adapter and signature verification implementation pending. Credentials cannot yet be registered.</p><span className="mt-2 inline-block text-xs font-bold text-amber-800">Not available</span></div></div></section>
  </main>;
}
