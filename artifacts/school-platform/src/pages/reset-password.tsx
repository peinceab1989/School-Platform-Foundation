import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    let client: ReturnType<typeof getSupabaseClient>;
    try {
      client = getSupabaseClient();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Supabase is not configured.");
      setReady(true);
      return;
    }
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
      setMustChangePassword(session?.user.app_metadata?.must_change_password === true);
      setReady(true);
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setMessage("The reset link could not be verified. Request a new link and try again.");
      setHasSession(Boolean(data.session));
      setMustChangePassword(data.session?.user.app_metadata?.must_change_password === true);
      setReady(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) return setMessage("Choose a password with at least 8 characters.");
    if (password !== confirmPassword) return setMessage("The passwords do not match.");
    setBusy(true);
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      if (mustChangePassword) {
        const { data, error: completionError } = await client.functions.invoke(
          "resa-admin-reset-student-password",
          { body: { action: "complete_password_change" } },
        );
        if (completionError) throw completionError;
        if (data?.error) throw new Error(String(data.error));
      }
      setSuccess(true);
      setMessage(mustChangePassword ? "Your temporary password has been replaced. You can now continue to RESA." : "Your password has been updated successfully. You can now sign in to RESA.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your password could not be updated. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-10 text-[#20382b]">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[#dce6dc] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f2e9] text-[#17633e]"><KeyRound size={24} /></span>
          <div><p className="text-xs font-bold tracking-[0.16em] text-[#8a6a19]">RESA SCHOOL PORTAL</p><h1 className="text-2xl font-bold">Reset password</h1></div>
        </div>
        {!ready ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /> Verifying your reset link…</div>
        ) : success ? (
          <div className="space-y-4"><p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{message}</p><button type="button" onClick={() => window.location.assign("/portal")} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white hover:bg-emerald-900">Return to sign in</button></div>
        ) : !hasSession ? (
          <div className="space-y-4"><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{message || "This reset link is invalid, expired, or already used. Return to the portal and request a new link."}</p><Link href="/portal" className="block w-full rounded-lg bg-emerald-800 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-900">Return to portal</Link></div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">{mustChangePassword ? "For your security, you must replace the temporary password before using the RESA portal." : "Choose a new password for your RESA portal account."}</p>
            <label className="block text-sm font-semibold" htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="At least 8 characters" />
            <label className="block text-sm font-semibold" htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Enter the password again" />
            {message && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{message}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}{busy ? "Updating password…" : "Save new password"}</button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-slate-500">Keep your password private. RESA staff will never ask you to share it.</p>
      </section>
    </main>
  );
}
