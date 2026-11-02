import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Save, RefreshCw, Settings2, School, UserRound, ShieldCheck,
  Eye, EyeOff, CheckCircle2, AlertCircle, LogOut, KeyRound, Search, Copy, LoaderCircle,
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
type Tab = "school" | "account" | "access" | "security";
type AccessRow = { role: "student" | "teacher" | "parent"; recordId: string; name: string; email: string; loginId: string; formalId: string; userId: string | null; accessStatus: string; active: boolean };

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
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [accessSearch, setAccessSearch] = useState("");
  const [accessRole, setAccessRole] = useState<"all" | "student" | "teacher" | "parent">("all");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessBusy, setAccessBusy] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<{ name: string; loginId: string; formalId: string; password: string } | null>(null);
  const [copiedAccessPassword, setCopiedAccessPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [customerCareEnabled, setCustomerCareEnabled] = useState(true);
  const [customerCareSaving, setCustomerCareSaving] = useState(false);
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
      const { data: careData, error: careError } = await (db as any).from("resa_chat_settings").select("customer_care_enabled").eq("school_id", schoolId).maybeSingle();
      if (careError) throw careError;
      setCustomerCareEnabled(careData?.customer_care_enabled !== false);
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

  async function saveCustomerCareSetting() {
    setCustomerCareSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient();
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Your administrator session has expired. Please sign in again.");
      const { error: updateError } = await (db as any).from("resa_chat_settings").update({
        customer_care_enabled: customerCareEnabled,
        updated_by: authData.user.id,
        updated_at: new Date().toISOString(),
      }).eq("school_id", schoolId);
      if (updateError) throw updateError;
      setNotice(customerCareEnabled
        ? "Public Customer Care has been activated. The floating Help handle will appear on public pages."
        : "Public Customer Care has been deactivated. The floating Help handle is now hidden from public pages.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update Customer Care availability.");
      await load();
    } finally { setCustomerCareSaving(false); }
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

  const loadAccessAccounts = useCallback(async () => {
    setAccessLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [sr, tr, pr] = await Promise.all([
        db.from("students").select("id,person_id,admission_number,status,user_id").eq("school_id", schoolId).order("created_at", { ascending: false }),
        db.from("staff").select("id,person_id,staff_number,status,user_id").eq("school_id", schoolId).order("created_at", { ascending: false }),
        db.from("parents_guardians").select("id,person_id,portal_enabled,relationship").eq("school_id", schoolId).order("created_at", { ascending: false }),
      ]);
      for (const r of [sr,tr,pr]) if (r.error) throw r.error;
      const personIds = [...new Set([...(sr.data ?? []).map((x:any)=>x.person_id), ...(tr.data ?? []).map((x:any)=>x.person_id), ...(pr.data ?? []).map((x:any)=>x.person_id)].filter(Boolean))];
      const [peopleResult, paResult, studentPortalResult] = await Promise.all([
        personIds.length ? db.from("people").select("id,first_name,middle_name,last_name,email,phone,user_id").eq("school_id",schoolId).in("id",personIds) : Promise.resolve({data:[],error:null}),
        db.from("parent_portal_accounts").select("parent_guardian_id,user_id,is_active").eq("school_id",schoolId),
      ]);
      if (peopleResult.error) throw peopleResult.error;
      if (paResult.error) throw paResult.error;
      if (studentPortalResult.error) throw studentPortalResult.error;
      const people = new Map<string,any>((peopleResult.data ?? []).map((x:any)=>[x.id,x]));
      const parentAccounts = new Map<string,any>((paResult.data ?? []).map((x:any)=>[x.parent_guardian_id,x]));
      const studentPortals = new Map<string,any>((studentPortalResult.data ?? []).map((x:any)=>[x.student_id,x]));
      const userIds = [...new Set([...(sr.data ?? []).map((x:any)=>x.user_id), ...(tr.data ?? []).map((x:any)=>x.user_id), ...(pr.data ?? []).map((x:any)=>people.get(x.person_id)?.user_id || parentAccounts.get(x.id)?.user_id)].filter(Boolean))];
      const mr = userIds.length ? await db.from("school_memberships").select("user_id,role,status").eq("school_id",schoolId).in("user_id",userIds) : {data:[],error:null};
      if (mr.error) throw mr.error;
      const memberships = new Map<string,any>((mr.data ?? []).map((x:any)=>[x.user_id+":"+x.role,x]));
      const makeAlias = (p:any) => {
        if (!p) return "";
        const part = (v:string) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.+|\.+$/g,"");
        return part(p.first_name)+"."+part(p.last_name)+"@resa.com";
      };
      const rows: AccessRow[] = [];
      for (const x of sr.data ?? []) { const p=people.get(x.person_id); const uid=x.user_id ?? null; const m=uid?memberships.get(uid+":student"):null; rows.push({role:"student",recordId:x.id,name:[p?.first_name,p?.middle_name,p?.last_name].filter(Boolean).join(" ")||x.admission_number||"Student",email:p?.email??"",loginId:makeAlias(p),formalId:x.admission_number??"",userId:uid,accessStatus:m?.status??(uid?"linked / unverified":"not linked"),active:Boolean(uid&&m?.status==="active"&&x.status==="active"&&studentPortals.get(x.id)?.is_active===true&&studentPortals.get(x.id)?.user_id===uid)}); }
      for (const x of tr.data ?? []) { const p=people.get(x.person_id); const uid=x.user_id ?? null; const m=uid?memberships.get(uid+":teacher"):null; rows.push({role:"teacher",recordId:x.id,name:[p?.first_name,p?.middle_name,p?.last_name].filter(Boolean).join(" ")||x.staff_number||"Teacher",email:p?.email??"",loginId:makeAlias(p),formalId:x.staff_number??"",userId:uid,accessStatus:m?.status??(uid?"linked / unverified":"not linked"),active:Boolean(uid&&m?.status==="active"&&x.status==="active")}); }
      for (const x of pr.data ?? []) { const p=people.get(x.person_id); const pa=parentAccounts.get(x.id); const uid=p?.user_id??pa?.user_id??null; const m=uid?memberships.get(uid+":parent"):null; rows.push({role:"parent",recordId:x.id,name:[p?.first_name,p?.middle_name,p?.last_name].filter(Boolean).join(" ")||"Parent",email:p?.email??"",loginId:makeAlias(p),formalId:p?.phone??"",userId:uid,accessStatus:m?.status??(uid?"linked / unverified":"not linked"),active:Boolean(uid&&m?.status==="active"&&pa?.is_active&&x.portal_enabled)}); }
      setAccessRows(rows);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not load account access records."); }
    finally { setAccessLoading(false); }
  }, [schoolId]);

  async function issueAccessPassword(row: AccessRow) {
    const key=row.role+":"+row.recordId; setAccessBusy(key); setAccessResult(null); setCopiedAccessPassword(false); setError(""); setNotice("");
    try {
      const db=getSupabaseClient(); const {data:sessionData,error:sessionError}=await db.auth.getSession();
      if(sessionError) throw sessionError;
      if(!sessionData.session) throw new Error("Your administrator session has expired. Please sign in again.");
      const action=row.userId?"reset_access_password":"create";
      const {data,error:invokeError}=await db.functions.invoke("resa-create-internal-login",{body:{role:row.role,record_id:row.recordId,...(row.userId?{action}:{})}});
      if(invokeError){let message=invokeError.message;try{const response=invokeError.context;if(response&&typeof response.json==="function"){const body=await response.json();if(typeof body?.error==="string")message=body.error;}}catch{/* keep original */}throw new Error(message||"The RESA access password could not be issued.");}
      if(data?.success!==true||typeof data?.temporary_password!=="string") throw new Error(data?.error||"The server did not return a new RESA access password.");
      setAccessResult({name:row.name,loginId:data.login_id||row.loginId,formalId:data.alternative_login_id||row.formalId,password:data.temporary_password});
      setNotice(row.userId?"A new RESA access password is active immediately.":"The internal RESA login has been created and its access password is active immediately.");
      await loadAccessAccounts();
    } catch(e) { setError(e instanceof Error?e.message:"Could not issue the RESA access password."); }
    finally { setAccessBusy(null); }
  }

  const tabs: { id: Tab; label: string; description: string; icon: typeof School }[] = [
    { id: "school", label: "School profile", description: "School details and academic defaults", icon: School },
    { id: "account", label: "Admin profile", description: "Name and login email", icon: UserRound },
    { id: "access", label: "Account & passwords", description: "Manage student, teacher and parent logins", icon: KeyRound },
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
              <button key={id} type="button" onClick={() => { setTab(id); setError(""); setNotice(""); if (id === "access" && accessRows.length === 0) void loadAccessAccounts(); }} className={`mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-left transition last:mb-0 ${tab === id ? "bg-green-950 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`}>
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
              {tab === "school" && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4">
                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Settings2 size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold text-slate-900">Public Customer Care</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Manage whether the floating Help handle appears on the public RESA website. This setting does not affect private messages inside the signed-in school portal.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${customerCareEnabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{customerCareEnabled ? "Active" : "Deactivated"}</span>
                      <span className="text-sm text-slate-600">{customerCareEnabled ? "Visitors can contact RESA through the public Help handle." : "The public Help handle is hidden from visitors."}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Includes public admin-chat and WhatsApp contact options.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button type="button" role="switch" aria-checked={customerCareEnabled} onClick={() => setCustomerCareEnabled(v => !v)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${customerCareEnabled ? "bg-green-800" : "bg-slate-300"}`} aria-label="Toggle public Customer Care">
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${customerCareEnabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <button type="button" onClick={() => void saveCustomerCareSetting()} disabled={customerCareSaving || loading} className={primaryButton}><Save size={16}/>{customerCareSaving ? "Saving…" : "Save changes"}</button>
                  </div>
                </div>
              </section>}

              {tab === "account" && <form onSubmit={saveAccount}>
                <div className="mb-5 border-b border-slate-100 pb-4"><h3 className="text-lg font-extrabold">Administrator profile</h3><p className="mt-1 text-sm text-slate-500">Change the name attached to your signed-in account or request a login email change.</p></div>
                <div className="mb-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current login email</p><p className="mt-1 break-all font-semibold">{currentEmail || "No email found"}</p><p className="mt-2 text-xs leading-5 text-slate-500">Supabase may require you to confirm a new email address before it becomes active.</p></div>
                <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Administrator display name<input className={fieldClass} value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={120} placeholder="Your full name" /></label><label className={labelClass}>New login email<input className={fieldClass} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="email" required /></label></div>
                <div className="mt-6 flex justify-end"><button disabled={accountSaving} className={primaryButton}><Save size={16} />{accountSaving ? "Saving…" : "Save administrator profile"}</button></div>
              </form>}

              {tab === "access" && <div>
                <div className="mb-5 border-b border-slate-100 pb-4"><h3 className="text-lg font-extrabold">Account & password management</h3><p className="mt-1 text-sm leading-6 text-slate-500">Find a student, teacher or parent to create an internal RESA login or issue a new individual access password. This does not suspend or change the person's school record. Passwords are displayed only once after issue.</p></div>
                <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_190px_auto]">
                  <label className={labelClass}>Search by name, RESA login, school ID or email<span className="relative mt-1 block"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input className={fieldClass+" pl-9"} value={accessSearch} onChange={e=>setAccessSearch(e.target.value)} placeholder="Search accounts…"/></span></label>
                  <label className={labelClass}>Account type<select className={fieldClass} value={accessRole} onChange={e=>setAccessRole(e.target.value as typeof accessRole)}><option value="all">All account types</option><option value="student">Students</option><option value="teacher">Teachers</option><option value="parent">Parents</option></select></label>
                  <div className="flex items-end"><button type="button" onClick={()=>void loadAccessAccounts()} disabled={accessLoading} className={secondaryButton}><RefreshCw size={15} className={accessLoading?"animate-spin":""}/> Refresh accounts</button></div>
                </div>
                {accessResult && <div role="status" className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-extrabold text-green-950">Password issued for {accessResult.name}</p><p className="mt-1 break-all text-sm text-green-900">Login: {accessResult.loginId||"Use official school ID"}{accessResult.formalId?" · "+accessResult.formalId:""}</p><p className="mt-3 text-xs font-bold uppercase tracking-wide text-green-800">New RESA access password — shown once</p><p className="mt-1 break-all rounded-lg border border-green-200 bg-white px-3 py-3 font-mono text-base font-bold text-slate-900">{accessResult.password}</p><p className="mt-2 text-xs text-green-900">Share privately. It works immediately and cannot be retrieved later.</p></div><button type="button" onClick={()=>{void navigator.clipboard.writeText(accessResult.password).then(()=>setCopiedAccessPassword(true)).catch(()=>setError("Copy was blocked. Select and copy the password manually."));}} className={primaryButton}><Copy size={15}/>{copiedAccessPassword?"Copied":"Copy password"}</button></div></div>}
                {accessLoading?<div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin" size={22}/>Loading school accounts…</div>:<div className="space-y-3">
                  {accessRows.filter(row=>(accessRole==="all"||row.role===accessRole)&&[row.name,row.loginId,row.formalId,row.email,row.accessStatus].some(v=>String(v??"").toLowerCase().includes(accessSearch.trim().toLowerCase()))).map(row=>{const key=row.role+":"+row.recordId;const busy=accessBusy===key;const canCreate=!row.userId;const canReset=row.active;return <article key={key} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{row.name}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{row.role}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.active?"bg-green-100 text-green-800":row.userId?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-600"}`}>{row.accessStatus}</span></div><p className="mt-1 break-all text-sm text-slate-600">{row.loginId||"RESA alias unavailable"}{row.formalId?" · "+row.formalId:""}</p>{row.email&&<p className="mt-1 break-all text-xs text-slate-500">{row.email}</p>}</div><button type="button" onClick={()=>void issueAccessPassword(row)} disabled={accessBusy!==null||(!canCreate&&!canReset)} className={primaryButton}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<KeyRound size={16} />}{busy?"Working…":canCreate?"Create RESA login & password":canReset?"Reset access password":"Access needs review"}</button></div>{!canCreate&&!canReset&&<p className="mt-2 text-xs text-amber-800">This account is linked but not active. Review membership or portal activation before resetting its password.</p>}</article>;})}
                  {!accessRows.some(row=>(accessRole==="all"||row.role===accessRole)&&[row.name,row.loginId,row.formalId,row.email,row.accessStatus].some(v=>String(v??"").toLowerCase().includes(accessSearch.trim().toLowerCase())))&&<p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No accounts match this search.</p>}
                </div>}
              </div>}
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
