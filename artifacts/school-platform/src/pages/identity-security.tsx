import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarClock, Fingerprint, LockKeyhole, Pencil, Plus, RefreshCw, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Passkey = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
};
type Identity = {
  person_type: "student" | "teacher" | "staff" | "parent" | "admin" | "proprietor";
  person_id: string | null;
  display_label: string;
  allowed_activities: string[];
};
type AttendanceEvent = {
  id: string;
  person_type: string;
  activity: string;
  event_type: "check_in" | "check_out";
  event_time: string;
  attendance_date: string;
  verification_method: string;
};
const activityLabels: Record<string, string> = {
  school_arrival: "Student school arrival",
  school_departure: "Student school departure",
  work_arrival: "Work arrival",
  work_departure: "Work departure",
  school_visit: "Parent / guardian school visit",
  school_visit_exit: "Parent / guardian visit exit",
};
const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
  : "Not yet used";
const errorText = (error: unknown) => error instanceof Error ? error.message : "The security action could not be completed.";

export default function IdentitySecurityPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentIdentity = useMemo(
    () => identities.find(item => `${item.person_type}:${item.person_id ?? "account"}` === selectedIdentity) ?? identities[0],
    [identities, selectedIdentity],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseClient();
    const db = supabase as any;
    const auth = supabase.auth as any;
    try {
      const [passkeyResult, identityResult, eventResult] = await Promise.all([
        auth.passkey.list(),
        db.rpc("resa_get_attendance_identities", { p_school_id: schoolId }),
        db.from("resa_identity_attendance_events")
          .select("id,person_type,activity,event_type,event_time,attendance_date,verification_method")
          .eq("school_id", schoolId).eq("user_id", userId)
          .order("event_time", { ascending: false }).limit(30),
      ]);
      if (passkeyResult.error) throw passkeyResult.error;
      if (identityResult.error) throw identityResult.error;
      if (eventResult.error) throw eventResult.error;
      const nextPasskeys = (passkeyResult.data ?? []) as Passkey[];
      const nextIdentities = (Array.isArray(identityResult.data) ? identityResult.data : []) as Identity[];
      setPasskeys(nextPasskeys);
      setIdentities(nextIdentities);
      setEvents((eventResult.data ?? []) as AttendanceEvent[]);
      setSelectedIdentity(previous => nextIdentities.some(item => `${item.person_type}:${item.person_id ?? "account"}` === previous)
        ? previous
        : nextIdentities[0] ? `${nextIdentities[0].person_type}:${nextIdentities[0].person_id ?? "account"}` : "");
    } catch (e) {
      const details = errorText(e);
      setError(/passkey_disabled/i.test(details)
        ? "Passkeys are not enabled in the RESA Supabase Auth project settings yet. The application configuration is prepared; the project Auth setting must be enabled before registration or sign-in can work."
        : details);
    } finally {
      setLoading(false);
    }
  }, [schoolId, userId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (currentIdentity && !currentIdentity.allowed_activities.includes(selectedActivity)) {
      setSelectedActivity(currentIdentity.allowed_activities[0] ?? "");
    }
  }, [currentIdentity, selectedActivity]);

  async function registerPasskey() {
    setBusy(true); setError(""); setNotice("");
    try {
      const auth = getSupabaseClient().auth as any;
      const { data, error: registerError } = await auth.registerPasskey();
      if (registerError) throw registerError;
      if (data?.id && newPasskeyName.trim()) {
        const { error: renameError } = await auth.passkey.update({
          passkeyId: data.id,
          friendlyName: newPasskeyName.trim().slice(0, 120),
        });
        if (renameError) throw renameError;
      }
      setNewPasskeyName("");
      setNotice("Your passkey has been registered securely. Your fingerprint or face data stays on your device; RESA receives only the passkey verification result.");
      await load();
    } catch (e) {
      const details = errorText(e);
      setError(/passkey_disabled/i.test(details)
        ? "Passkeys are not enabled in the Supabase Auth project settings yet. Enable Authentication → Passkeys for the RESA project, with the RESA relying-party domain, then try again."
        : details);
    } finally { setBusy(false); }
  }

  async function renamePasskey(passkey: Passkey) {
    if (!renameValue.trim()) { setError("Enter a name for this passkey."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const auth = getSupabaseClient().auth as any;
      const { error: updateError } = await auth.passkey.update({
        passkeyId: passkey.id,
        friendlyName: renameValue.trim().slice(0, 120),
      });
      if (updateError) throw updateError;
      setNotice("Passkey name updated.");
      setRenameId(""); setRenameValue("");
      await load();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function deletePasskey(passkey: Passkey) {
    if (!window.confirm(`Remove the passkey “${passkey.friendly_name || "This device"}” from your RESA account? You will no longer be able to sign in with it.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const auth = getSupabaseClient().auth as any;
      const { error: deleteError } = await auth.passkey.delete({ passkeyId: passkey.id });
      if (deleteError) throw deleteError;
      setNotice("Passkey removed from this account.");
      await load();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function verifyAndRecordAttendance() {
    if (!currentIdentity || !selectedActivity) { setError("Select your RESA identity and attendance action."); return; }
    if (!passkeys.length) { setError("Register a passkey on this device before recording attendance."); return; }
    const eventType = selectedActivity.endsWith("arrival") || selectedActivity === "school_visit" ? "check_in" : "check_out";
    setBusy(true); setError(""); setNotice("");
    try {
      const supabase = getSupabaseClient();
      const before = await supabase.auth.getUser();
      if (before.error || before.data.user?.id !== userId) throw new Error("Your RESA session has changed. Sign in again before recording attendance.");

      const { data: verified, error: verifyError } = await supabase.auth.signInWithPasskey();
      if (verifyError) throw verifyError;
      if (verified.user?.id !== userId) {
        await supabase.auth.signOut();
        throw new Error("The selected passkey belongs to a different RESA account. You have been signed out to protect account privacy.");
      }

      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      if (claimsError) throw claimsError;
      const claims = (claimsData as any)?.claims ?? {};
      const amr = Array.isArray(claims.amr) ? claims.amr : [];
      if (!amr.some((entry: any) => entry?.method === "passkey")) {
        throw new Error("RESA could not confirm a fresh passkey verification. Please try the attendance action again.");
      }

      const db = supabase as any;
      const { data: recorded, error: recordError } = await db.rpc("resa_record_passkey_attendance", {
        p_school_id: schoolId,
        p_person_type: currentIdentity.person_type,
        p_person_id: currentIdentity.person_id,
        p_activity: selectedActivity,
        p_event_type: eventType,
        p_device_label: "RESA mobile / school device",
      });
      if (recordError) throw recordError;
      setNotice(`${activityLabels[selectedActivity] ?? selectedActivity} recorded successfully at ${formatDate(recorded?.event_time)}.`);
      await load();
    } catch (e) {
      const details = errorText(e);
      setError(/passkey_disabled/i.test(details)
        ? "Passkey authentication is not enabled for this RESA Supabase project yet."
        : details);
    } finally { setBusy(false); }
  }

  const todayEvents = events.filter(item => item.attendance_date === new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()));

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to dashboard</Link>
      <header className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#09291f] via-[#14543b] to-[#24724d] p-5 text-white shadow-lg sm:p-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-amber-200"><ShieldCheck size={15}/> RESA account protection</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Passkeys & Attendance</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50 sm:text-base">Secure your RESA account with a device passkey, then verify each attendance action using your phone or an authorised school device. The device may use fingerprint, face recognition or its secure screen lock.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs text-emerald-100">Registered passkeys</p><p className="mt-1 text-2xl font-black">{passkeys.length}</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs text-emerald-100">Linked school identities</p><p className="mt-1 text-2xl font-black">{identities.length}</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs text-emerald-100">Attendance actions today</p><p className="mt-1 text-2xl font-black">{todayEvents.length}</p></div>
        </div>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><Fingerprint size={22}/></span><div><h2 className="text-xl font-extrabold">Your passkeys</h2><p className="text-sm text-slate-600">Add, rename or revoke trusted devices.</p></div></div>
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">Passkeys are phishing-resistant. Your fingerprint, face scan or PIN remains with Android, your browser or password manager. RESA stores no biometric image or template.</div>
          <label className="mt-4 block text-sm font-semibold text-slate-800">Device name (optional)<input value={newPasskeyName} onChange={e => setNewPasskeyName(e.target.value)} maxLength={120} placeholder="e.g. My Android phone" className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"/></label>
          <button type="button" onClick={() => void registerPasskey()} disabled={busy || loading} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Plus size={17}/>{busy ? "Please wait…" : "Register a passkey on this device"}</button>
          <div className="mt-4 space-y-3">
            {loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading passkeys…</p>
              : passkeys.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">No passkeys registered yet. Add one on this phone or an approved school device.</p>
              : passkeys.map(passkey => <div key={passkey.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3"><Smartphone className="mt-1 shrink-0 text-emerald-800" size={19}/><div className="min-w-0"><p className="break-words font-bold">{passkey.friendly_name || "RESA passkey"}</p><p className="mt-1 text-xs text-slate-500">Added {formatDate(passkey.created_at)}</p><p className="mt-1 text-xs text-slate-500">Last used {formatDate(passkey.last_used_at)}</p></div></div>
                  <BadgeCheck className="shrink-0 text-emerald-700" size={19}/>
                </div>
                {renameId === passkey.id ? <div className="mt-3 flex gap-2"><input value={renameValue} onChange={e => setRenameValue(e.target.value)} maxLength={120} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="New device name"/><button type="button" onClick={() => void renamePasskey(passkey)} disabled={busy} className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white">Save</button><button type="button" onClick={() => setRenameId("")} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cancel</button></div>
                  : <div className="mt-3 flex gap-2"><button type="button" onClick={() => { setRenameId(passkey.id); setRenameValue(passkey.friendly_name || ""); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-slate-50"><Pencil size={13}/> Rename</button><button type="button" onClick={() => void deletePasskey(passkey)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 size={13}/> Revoke</button></div>}
              </div>)}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-900"><LockKeyhole size={22}/></span><div><h2 className="text-xl font-extrabold">Verified attendance</h2><p className="text-sm text-slate-600">A new passkey check is required for every action.</p></div></div>
          {!identities.length ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-600">No active student, staff, parent or school leadership identity is linked to this account for this school. Ask the school administrator to verify your account association.</div>
            : <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-800">Attendance identity<select value={selectedIdentity} onChange={e => setSelectedIdentity(e.target.value)} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">{identities.map(item => <option key={`${item.person_type}:${item.person_id ?? "account"}`} value={`${item.person_type}:${item.person_id ?? "account"}`}>{item.display_label}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-800">Attendance action<select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">{(currentIdentity?.allowed_activities ?? []).map(activity => <option key={activity} value={activity}>{activityLabels[activity] ?? activity}</option>)}</select></label>
              <button type="button" onClick={() => void verifyAndRecordAttendance()} disabled={busy || loading || !passkeys.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b77916] px-4 py-3.5 text-sm font-extrabold text-white hover:bg-[#99600d] disabled:opacity-50"><Fingerprint size={18}/>{busy ? "Verifying…" : `Verify & ${selectedActivity.endsWith("arrival") || selectedActivity === "school_visit" ? "check in" : "check out"}`}</button>
              {!passkeys.length && <p className="text-xs text-amber-800">Register a passkey first to enable verified attendance.</p>}
            </div>}
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><p className="flex items-center gap-2 font-bold text-slate-800"><CalendarClock size={15}/> Attendance integrity</p><p className="mt-1">Portal sign-in alone never counts as attendance. Each clock-in or clock-out requires a fresh passkey sign-in, and RESA checks the account category, school link and daily duplicate rules on the server.</p></div>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Your recent attendance activity</h2><p className="mt-1 text-sm text-slate-600">Passkey-verified records for this school account.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-3">Activity</th><th className="py-3 pr-3">Action</th><th className="py-3 pr-3">Date & time</th><th className="py-3">Verification</th></tr></thead>
            <tbody>{events.length ? events.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3 pr-3 font-semibold">{activityLabels[item.activity] ?? item.activity}</td><td className="py-3 pr-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{item.event_type === "check_in" ? "Checked in" : "Checked out"}</span></td><td className="py-3 pr-3 text-slate-600">{formatDate(item.event_time)}</td><td className="py-3 text-slate-600">Passkey</td></tr>)
              : <tr><td colSpan={4} className="py-8 text-center text-slate-500">No attendance events recorded yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-950"><p className="font-bold">No personal smartphone?</p><p className="mt-1">The school can set up an approved shared tablet or attendance terminal. Each student or staff member must have their own passkey registered on a supported device. The device may verify with its fingerprint sensor, face unlock or secure PIN.</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><p className="font-bold">Important distinction</p><p className="mt-1">A passkey confirms the account holder's identity; by itself it does not prove GPS location or physical presence. The school should pair attendance with its approved on-site terminal or station procedure where physical presence must be enforced.</p></div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">RESA School Portal · Secure identity and attendance · No biometric templates stored by RESA</p>
    </div>
  </main>;
}
