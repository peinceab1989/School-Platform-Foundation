import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Setting = { paystack_enabled: boolean; updated_at?: string; updated_by?: string | null };
type Audit = { id: string; action: string; created_at: string; actor_id: string | null };

export default function PaystackAdminSettings({ schoolId }: { schoolId: string }) {
  const [setting, setSetting] = useState<Setting>({ paystack_enabled: false });
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const [settingsResult, auditResult] = await Promise.all([
        db.from("resa_payment_gateway_settings").select("paystack_enabled,updated_at,updated_by").eq("school_id", schoolId).maybeSingle(),
        db.from("resa_payment_gateway_audit").select("id,action,created_at,actor_id").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(8),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (auditResult.error) throw auditResult.error;
      setSetting(settingsResult.data ?? { paystack_enabled: false });
      setAudit(auditResult.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment channel settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  async function setEnabled(enabled: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Your administrator session has expired. Sign in again.");
      const { error: saveError } = await db.from("resa_payment_gateway_settings").upsert({
        school_id: schoolId,
        paystack_enabled: enabled,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id" });
      if (saveError) throw saveError;
      setNotice(enabled
        ? "Paystack has been enabled as an optional payment method. Checkout will remain unavailable until server credentials, signed webhook, clearance authorisation and test acceptance are complete."
        : "Paystack has been disabled. Parents can continue using the school's approved offline payment methods. Existing provider transactions must still be reconciled.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Paystack setting could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Finance settings · Optional online channel</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold text-slate-900"><ShieldCheck size={19}/> Paystack administration</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">RESA administrators control whether parents may use Paystack. It is never compulsory. Bank transfer, POS and cash remain available under the school's normal verification process.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="font-bold text-slate-900">Enable Paystack online payments</p>
        <p className="mt-1 text-xs text-slate-600">Default: OFF. Turning it off blocks new online checkouts at the server.</p>
        <p className={setting.paystack_enabled ? "mt-2 text-sm font-bold text-emerald-800" : "mt-2 text-sm font-bold text-slate-600"}>{loading ? "Checking setting…" : setting.paystack_enabled ? "Administrator switch: ON" : "Administrator switch: OFF"}</p>
      </div>
      <button type="button" disabled={loading || saving} onClick={() => void setEnabled(!setting.paystack_enabled)}
        aria-pressed={setting.paystack_enabled}
        className={setting.paystack_enabled ? "min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-extrabold text-amber-900 disabled:opacity-50" : "min-h-11 rounded-xl bg-emerald-900 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"}>
        {saving ? "Saving…" : setting.paystack_enabled ? "Disable Paystack" : "Enable Paystack"}
      </button>
    </div>
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
      <AlertCircle size={16} className="mt-0.5 shrink-0"/>
      <p>This switch is not a substitute for merchant setup or parent payment clearance. Paystack must remain unavailable to parents until test credentials, webhook verification, administrator-approved clearance IDs and end-to-end tests are complete. Secret keys are never entered or displayed here.</p>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-bold text-slate-700">Recent payment-channel changes · {audit.length}</summary>
      <div className="mt-2 divide-y rounded-lg border">
        {audit.length === 0 ? <p className="p-3 text-xs text-slate-500">No changes recorded yet.</p> : audit.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 p-3 text-xs">
          <span className="font-semibold">{item.action.replaceAll("_", " ")}</span>
          <span className="text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
        </div>)}
      </div>
    </details>
    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={14}/> Changes are recorded in the RESA payment-channel audit log.</p>
  </section>;
}
