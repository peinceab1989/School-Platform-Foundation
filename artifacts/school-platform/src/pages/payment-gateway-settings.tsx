import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ShieldCheck, LockKeyhole, RefreshCw, Save, Power, AlertTriangle, Plus, Pencil, Landmark, Wallet, Copy, ExternalLink } from "lucide-react";

type ProviderStatus = {
  provider: string; enabled: boolean; environment: string; displayName: string | null;
  settlementBankName: string | null; settlementAccountName: string | null; settlementLast4: string | null;
  testApiConfigured: boolean; testWebhookConfigured: boolean; liveApiConfigured: boolean; liveWebhookConfigured: boolean;
  updatedAt: string | null;
};
type PaymentMethod = {
  id: string; method_type: "bank_transfer" | "pos" | "cash" | "other"; display_name: string;
  bank_name: string | null; account_name: string | null; account_number: string | null;
  payment_url: string | null; instructions: string; is_enabled: boolean; display_order: number;
};
type PaymentMethodForm = {
  methodType: PaymentMethod["method_type"]; displayName: string; bankName: string;
  accountName: string; accountNumber: string; paymentUrl: string; instructions: string; displayOrder: string;
};
const emptyMethod: PaymentMethodForm = {
  methodType: "bank_transfer", displayName: "Bank transfer", bankName: "",
  accountName: "", accountNumber: "", paymentUrl: "", instructions: "Transfer the exact admission form fee and keep your transaction reference.", displayOrder: "0",
};
const ownerId = "85bfff8f-72ee-49b8-bd80-213001468a0a";
export default function PaymentGatewaySettingsPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [rows, setRows] = useState<ProviderStatus[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodForm, setMethodForm] = useState<PaymentMethodForm>(emptyMethod);
  const [editingMethodId, setEditingMethodId] = useState("");
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
      setMethods(data.paymentMethods ?? []);
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
  function editMethod(method: PaymentMethod) {
    setEditingMethodId(method.id);
    setMethodForm({
      methodType: method.method_type, displayName: method.display_name, bankName: method.bank_name ?? "",
      accountName: method.account_name ?? "", accountNumber: method.account_number ?? "",
      paymentUrl: method.payment_url ?? "", instructions: method.instructions ?? "",
      displayOrder: String(method.display_order ?? 0),
    });
  }
  async function savePaymentMethod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const data = await call("save_payment_method", {
        id: editingMethodId || undefined, ...methodForm,
      });
      setNotice(data.message || "Payment option saved.");
      setMethodForm(emptyMethod); setEditingMethodId("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment option could not be saved."); }
    finally { setBusy(false); }
  }
  async function togglePaymentMethod(method: PaymentMethod) {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await call("set_payment_method_enabled", { id: method.id, enabled: !method.is_enabled });
      setNotice(data.message || "Payment option updated.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment option could not be updated."); }
    finally { setBusy(false); }
  }
  if (!isOwner) return <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6"><h1 className="text-xl font-bold">Access restricted</h1><p className="mt-2 text-sm text-slate-600">Only the designated RESA proprietor can manage payment gateway credentials and public admission payment instructions.</p></section>;
  return <main className="mx-auto max-w-5xl space-y-6 text-slate-900">
    <header className="rounded-2xl bg-emerald-950 p-6 text-white"><div className="flex items-center gap-3"><ShieldCheck size={28}/><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Proprietor control centre</p><h1 className="text-2xl font-extrabold">Payment & Collection Settings</h1></div></div><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">Manage the payment instructions applicants see when purchasing an admission form. Only enabled methods appear publicly. Secret gateway credentials remain encrypted in Supabase Vault.</p><p className="mt-2 text-xs text-emerald-200">Authorised proprietor: princeabgreat@gmail.com</p></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-extrabold"><Landmark size={20}/> Admission payment methods</h2><p className="text-sm text-slate-600">Add bank transfer, POS, cash office or another approved manual payment method.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{methods.filter(m=>m.is_enabled).length} visible to applicants</span></div>
      <div className="mt-4 space-y-3">
        {methods.length===0&&<p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">No manual payment options have been configured yet. Applicants will be directed to RESA Customer Care until an approved option is enabled.</p>}
        {methods.map(method=><article key={method.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Wallet size={17}/><strong>{method.display_name}</strong><span className={method.is_enabled?"rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800":"rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600"}>{method.is_enabled?"Visible":"Hidden"}</span></div>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{method.method_type.replace("_"," ")}</p>
            {method.method_type==="bank_transfer"&&<p className="mt-2 text-sm text-slate-700">{method.bank_name} · {method.account_name} · {method.account_number}</p>}
            {method.payment_url&&<p className="mt-1 break-all text-xs text-slate-600">{method.payment_url}</p>}
            {method.instructions&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{method.instructions}</p>}
          </div><div className="flex gap-2"><button type="button" onClick={()=>editMethod(method)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-bold"><Pencil size={14}/> Edit</button><button type="button" disabled={busy} onClick={()=>void togglePaymentMethod(method)} className="min-h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-50">{method.is_enabled?"Hide":"Show"}</button></div></div>
        </article>)}
      </div>
      <form onSubmit={savePaymentMethod} className="mt-6 rounded-xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold">{editingMethodId?"Edit payment option":"Add a payment option"}</h3>{editingMethodId&&<button type="button" onClick={()=>{setEditingMethodId("");setMethodForm(emptyMethod);}} className="text-xs font-bold text-slate-600 underline">Cancel edit</button>}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Payment type<select required value={methodForm.methodType} onChange={e=>setMethodForm({...methodForm,methodType:e.target.value as PaymentMethodForm["methodType"]})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"><option value="bank_transfer">Bank transfer</option><option value="pos">POS at school</option><option value="cash">Cash at school office</option><option value="other">Other approved method</option></select></label>
          <label className="text-sm font-semibold">Display name<input required maxLength={100} value={methodForm.displayName} onChange={e=>setMethodForm({...methodForm,displayName:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" placeholder="e.g. RESA Admission Account"/></label>
          {methodForm.methodType==="bank_transfer"&&<>
            <label className="text-sm font-semibold">Bank name<input required maxLength={120} value={methodForm.bankName} onChange={e=>setMethodForm({...methodForm,bankName:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"/></label>
            <label className="text-sm font-semibold">Account name<input required maxLength={160} value={methodForm.accountName} onChange={e=>setMethodForm({...methodForm,accountName:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"/></label>
            <label className="text-sm font-semibold sm:col-span-2">Account number<input required inputMode="numeric" autoComplete="off" maxLength={20} value={methodForm.accountNumber} onChange={e=>setMethodForm({...methodForm,accountNumber:e.target.value.replace(/\D/g,"").slice(0,20)})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 font-mono" placeholder="Enter the official school account number"/></label>
          </>}
          <label className="text-sm font-semibold sm:col-span-2">Secure payment link (optional)<input type="url" value={methodForm.paymentUrl} onChange={e=>setMethodForm({...methodForm,paymentUrl:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" placeholder="https://…"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Instructions shown to applicants<textarea required={methodForm.methodType!=="bank_transfer"} rows={3} maxLength={2000} value={methodForm.instructions} onChange={e=>setMethodForm({...methodForm,instructions:e.target.value})} className="mt-1 w-full rounded-lg border bg-white p-3" placeholder="Explain where/how to pay and what reference to retain."/></label>
          <label className="text-sm font-semibold">Display order<input type="number" min={0} max={1000} value={methodForm.displayOrder} onChange={e=>setMethodForm({...methodForm,displayOrder:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"/></label>
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-800">Only enter an official RESA collection account. Enabled bank details and instructions are publicly visible to admission applicants. Manual payments are not automatically verified; RESA must confirm funds before issuing a form number.</p>
        <button disabled={busy} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{busy?"Saving…":editingMethodId?"Save payment option":"Add payment option"}</button>
      </form>
      <button type="button" onClick={()=>void refresh()} disabled={busy} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><RefreshCw size={15}/> Refresh payment options</button>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Paystack online checkout</h2><p className="text-sm text-slate-600">Secure online card/bank checkout is separate from manual transfer/POS options.</p></div><span className={paystack?.enabled?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800":"rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"}>{paystack?.enabled?"Test gateway enabled":"Disabled"}</span></div>
      <label className="mt-5 block text-sm font-semibold">Environment<select value={environment} onChange={e=>setEnvironment(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="test">Test / Sandbox</option><option value="live">Live / Production (locked)</option></select></label>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">Paystack secret API key<input type="password" autoComplete="new-password" spellCheck={false} value={apiSecretKey} onChange={e=>setApiSecretKey(e.target.value)} placeholder={environment==="test"?"sk_test_…":"sk_live_…"} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm"/></label>
        <label className="block text-sm font-semibold">Webhook signing secret<input type="password" autoComplete="new-password" spellCheck={false} value={webhookSigningSecret} onChange={e=>setWebhookSigningSecret(e.target.value)} placeholder="whsec_…" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm"/></label>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><LockKeyhole size={15} className="mt-0.5 shrink-0"/>Credentials are sent directly to the authenticated server function over HTTPS and stored encrypted at rest in Supabase Vault. They are not saved in browser storage, ordinary database columns or source code.</p>
      <button type="button" onClick={()=>void saveCredentials()} disabled={busy||(!apiSecretKey.trim()&&!webhookSigningSecret.trim())||environment==="live"} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/> Save credentials securely</button>
      {environment==="live"&&<p className="mt-2 text-xs text-amber-800">Live credential registration is locked in this release. Complete test-mode acceptance and merchant verification first.</p>}
      <div className="mt-5 rounded-xl bg-slate-50 p-4"><h3 className="font-bold">Credential status (values never shown)</h3><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p>Test API key: <strong>{paystack?.testApiConfigured?"Configured":"Not configured"}</strong></p><p>Test webhook secret: <strong>{paystack?.testWebhookConfigured?"Configured":"Not configured"}</strong></p><p>Live API key: <strong>{paystack?.liveApiConfigured?"Configured":"Not configured"}</strong></p><p>Live webhook secret: <strong>{paystack?.liveWebhookConfigured?"Configured":"Not configured"}</strong></p></div><button type="button" onClick={()=>void refresh()} disabled={busy} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><RefreshCw size={15}/> Refresh status</button></div>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={()=>void enableTest()} disabled={busy||!paystack?.testApiConfigured||!paystack?.testWebhookConfigured||environment!=="test"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Power size={16}/> Enable test mode</button><button type="button" onClick={()=>void disableGateway()} disabled={busy||!paystack?.enabled} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Disable gateway</button></div>
    </section>
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-extrabold text-amber-950"><AlertTriangle size={18}/> Live payments are locked</h2><p className="mt-2 text-sm leading-6 text-amber-900">Live collection requires verified Paystack merchant onboarding and settlement details, a complete successful test transaction and webhook/receipt reconciliation, review of the production deployment, and a separate proprietor-approved release. Monnify and Flutterwave are not active adapters in this release.</p></section>
  </main>;
}
