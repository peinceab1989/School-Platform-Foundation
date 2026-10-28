import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Save, RefreshCw, Settings2, School, UserRound, ShieldCheck,
  Eye, EyeOff, CheckCircle2, AlertCircle, LogOut,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Settings = {
  id?: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  current_academic_session_id: string | null;
  current_term_id: string | null;
};
type SessionOption = { id: string; name: string };
type TermOption = { id: string; name: string; academic_session_id: string };
type Tab = "school" | "account" | "security";

const blank: Settings = {
  motto: "", address: "", phone: "", email: "", website: "", logo_url: "",
  current_academic_session_id: null, current_term_id: null,
};
const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100";
const labelClass = "block text-sm font-semibold text-slate-700";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-green-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";

export default function SchoolSettingsPage({ schoolId }: { schoolId: string }) {
  const [form, setForm] = useState<Settings>(blank);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [userId, setUserId] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState<Tab>("school");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient();
      const [{ data: authData, error: authError }, { data: schoolData, error: schoolError }, { data: sessionData, error: sessionError }, { data: termData, error: termError }] = await Promise.all([
        db.auth.getUser(),
        db.from("school_settings").select("*").eq("school_id", schoolId).maybeSingle(),
        db.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("start_date", { ascending: false }),
        db.from("academic_terms").select("id,name,academic_session_id").eq("school_id", schoolId).order("term_number"),
      ]);
      if (authError) throw authError;
      if (schoolError) throw schoolError;
      if (sessionError) throw sessionError;
      if (termError) throw termError;
      const user = authData.user;
      setUserId(user?.id ?? "");
      setCurrentEmail(user?.email ?? "");
      setNewEmail(user?.email ?? "");
      setDisplayName(String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ""));
      setForm(schoolData ? { ...blank, ...schoolData } : blank);
      setSessions(sessionData ?? []);
      setTerms(termData ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  async function saveSchool(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient();
      const payload = {
        school_id: schoolId,
        motto: form.motto?.trim() || null,
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        website: form.website?.trim() || null,
        logo_url: form.logo_url?.trim() || null,
        current_academic_session_id: form.current_academic_session_id || null,
        current_term_id: form.current_term_id || null,
        updated_at: new Date().toISOString(),
      };
      const result = form.id
        ? await db.from("school_settings").update(payload).eq("id", form.id).eq("school_id", schoolId)
        : await db.from("school_settings").insert(payload);
      if (result.error) throw result.error;
      setNotice("School profile and academic defaults saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save school settings.");
    } finally { setSaving(false); }
  }

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setAccountSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient();
      const updates: { data: { full_name: string }; email?: string } = {
        data: { full_name: displayName.trim() },
      };
      const requestedEmail = newEmail.trim();
      if (requestedEmail && requestedEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        updates.email = requestedEmail;
      }
      const { data, error: updateError } = await db.auth.updateUser(updates);
      if (updateError) throw updateError;
      if (updates.email) {
        setNotice("Profile saved. Check the new email inbox for Supabase's confirmation link before the email address changes.");
      } else {
        setNotice("Administrator profile saved.");
      }
      setCurrentEmail(data.user?.email ?? currentEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update administrator profile.");
    } finally { setAccountSaving(false); }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(""); setConfirmPassword("");
      setNotice("Your password has been changed successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password.");
    } finally { setPasswordSaving(false); }
  }

  async function signOutOtherSessions() {
    setSigningOutOthers(true); setError(""); setNotice("");
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut({ scope: "others" });
      if (signOutError) throw signOutError;
      setNotice("Other sessions have been signed out. This current session remains active.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign out other sessions.");
    } finally { setSigningOutOthers(false); }
  }

  const tabs: { id: Tab; label: string; description: string; icon: typeof School }[] = [
    { id: "school", label: "School profile", description: "School details and academic defaults", icon: School },
    { id: "account", label: "Admin profile", description: "Name and login email", icon: UserRound },
    { id: "security", label: "Password & security", description: "Password and active sessions", icon: ShieldCheck },
  ];

  return (
    <main className="min-h-screen bg-[#f5f7f1] text-slate-900">
      <header className="bg-gradient-to-r from-green-950 via-green-900 to-green-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3"><Settings2 size={23} /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">RESA School Portal</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Settings centre</h1><p className="mt-1 text-sm text-green-100">Manage the school, your administrator profile, and account security.</p></div>
          </div>
          <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft size={16} /> <span className="hidden sm:inline">Dashboard</span></Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Administrator settings</h2><p className="mt-1 text-sm text-slate-600">These controls are for the signed-in account and this school's existing settings record.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className={secondaryButton}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>

        {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{error}</span></div>}
        {notice && <div role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /> <span>{notice}</span></div>}

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Settings sections" className="h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {tabs.map(({ id, label, description, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setTab(id); setError(""); setNotice(""); }} className={`mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-left transition last:mb-0 ${tab === id ? "bg-green-950 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`}>
                <Icon size={19} className="mt-0.5 shrink-0" />
                <span><span className="block text-sm font-bold">{label}</span><span className={`mt-1 block text-xs leading-5 ${tab === id ? "text-green-100" : "text-slate-500"}`}>{description}</span></span>
              </button>
            ))}
            <div className="mx-2 my-3 border-t border-slate-100" />
            <div className="px-3 pb-2 pt-1"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Signed-in account</p><p className="mt-2 break-all text-sm font-semibold text-slate-800">{currentEmail || "Loading account…"}</p><p className="mt-1 break-all text-xs text-slate-500">User ID: {userId || "—"}</p></div>
          </nav>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading settings…</div> : <>
              {tab === "school" && <form onSubmit={saveSchool}>
                <div className="mb-5 border-b border-slate-100 pb-4"><h3 className="text-lg font-extrabold">School profile & academic defaults</h3><p className="mt-1 text-sm text-slate-500">Update the details shown across the school portal and choose the current session and term.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([{ key: "motto", label: "School motto" }, { key: "address", label: "School address" }, { key: "phone", label: "School phone" }, { key: "email", label: "School email" }, { key: "website", label: "Website URL" }, { key: "logo_url", label: "Logo image URL" }] as const).map(f => <label key={f.key} className={labelClass}>{f.label}<input className={fieldClass} value={form[f.key] ?? ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} maxLength={500} placeholder={f.key === "logo_url" ? "https://…" : ""} /></label>)}
                  <label className={labelClass}>Current academic session<select className={fieldClass} value={form.current_academic_session_id ?? ""} onChange={e => setForm(p => ({ ...p, current_academic_session_id: e.target.value || null, current_term_id: null }))}><option value="">Not selected</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                  <label className={labelClass}>Current term<select className={fieldClass} value={form.current_term_id ?? ""} onChange={e => setForm(p => ({ ...p, current_term_id: e.target.value || null }))}><option value="">Not selected</option>{terms.filter(t => !form.current_academic_session_id || t.academic_session_id === form.current_academic_session_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                </div>
                <div className="mt-6 flex justify-end"><button disabled={saving} className={primaryButton}><Save size={16} />{saving ? "Saving…" : "Save school settings"}</button></div>
              </form>}

              {tab === "account" && <form onSubmit={saveAccount}>
                <div className="mb-5 border-b border-slate-100 pb-4"><h3 className="text-lg font-extrabold">Administrator profile</h3><p className="mt-1 text-sm text-slate-500">Change the name attached to your signed-in account or request a login email change.</p></div>
                <div className="mb-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current login email</p><p className="mt-1 break-all font-semibold">{currentEmail || "No email found"}</p><p className="mt-2 text-xs leading-5 text-slate-500">Supabase may require you to confirm a new email address before it becomes active.</p></div>
                <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Administrator display name<input className={fieldClass} value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={120} placeholder="Your full name" /></label><label className={labelClass}>New login email<input className={fieldClass} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="email" required /></label></div>
                <div className="mt-6 flex justify-end"><button disabled={accountSaving} className={primaryButton}><Save size={16} />{accountSaving ? "Saving…" : "Save administrator profile"}</button></div>
              </form>}

              {tab === "security" && <div>
                <div className="mb-5 border-b border-slate-100 pb-4"><h3 className="text-lg font-extrabold">Password & security</h3><p className="mt-1 text-sm text-slate-500">Keep your administrator login secure. Use a strong password that you do not use elsewhere.</p></div>
                <form onSubmit={changePassword} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                  <h4 className="font-bold">Change password</h4><p className="mt-1 mb-4 text-sm text-slate-500">Use at least 8 characters. Your current session is used to authenticate this change.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>New password<span className="relative mt-1 block"><input className={fieldClass + " pr-11"} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3 text-slate-500">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
                    <label className={labelClass}>Confirm new password<input className={fieldClass} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></label>
                  </div>
                  <div className="mt-5 flex justify-end"><button disabled={passwordSaving} className={primaryButton}><ShieldCheck size={16} />{passwordSaving ? "Changing password…" : "Change password"}</button></div>
                </form>
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                  <div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-amber-800" /><div className="min-w-0"><h4 className="font-bold text-amber-950">Sign out other sessions</h4><p className="mt-1 text-sm leading-6 text-amber-900">Use this if you have signed in on a shared or old device. It attempts to end other sessions while keeping this device signed in.</p><button type="button" onClick={() => void signOutOtherSessions()} disabled={signingOutOthers} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"><LogOut size={16} />{signingOutOthers ? "Signing out other sessions…" : "Sign out other sessions"}</button></div></div>
                </div>
              </div>}
            </>}
          </section>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">RHEMA EXPLOITS SCIENCE ACADEMY (RESA) · PASSION • SKILLS • EXCELLENT SPIRIT</p>
      </div>
    </main>
  );
}
