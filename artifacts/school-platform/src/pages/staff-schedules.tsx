import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, RefreshCw, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type StaffRow = { id: string; person_id: string; staff_number: string | null; job_title: string | null; status: string; name: string };
type ScheduleRow = { id: string; staff_id: string; work_days: number[]; notes: string | null; updated_at: string };
type ExceptionRow = { id: string; staff_id: string; exception_date: string; exception_type: "off" | "working_day"; reason: string; created_at: string };
type AuditRow = { id: string; staff_id: string; entity_type: string; action: string; created_at: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null };

const days = [{ value: 1, label: "Monday" }, { value: 2, label: "Tuesday" }, { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }, { value: 7, label: "Sunday" }];
const defaultWorkDays = [1, 2, 3, 4, 5, 6];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export default function StaffSchedulesPage({ schoolId }: { schoolId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [workDays, setWorkDays] = useState<number[]>(defaultWorkDays);
  const [notes, setNotes] = useState("");
  const [exceptionDate, setExceptionDate] = useState(today());
  const [exceptionType, setExceptionType] = useState<"off" | "working_day">("off");
  const [exceptionReason, setExceptionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedStaff = useMemo(() => staff.find(row => row.id === selectedStaffId), [staff, selectedStaffId]);
  const selectedSchedule = useMemo(() => schedules.find(row => row.staff_id === selectedStaffId), [schedules, selectedStaffId]);
  const selectedExceptions = useMemo(() => exceptions.filter(row => row.staff_id === selectedStaffId), [exceptions, selectedStaffId]);
  const selectedAudit = useMemo(() => audit.filter(row => row.staff_id === selectedStaffId).slice(0, 12), [audit, selectedStaffId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [staffResult, scheduleResult, exceptionResult, auditResult] = await Promise.all([
        db.from("staff").select("id,person_id,staff_number,job_title,status").eq("school_id", schoolId).eq("status", "active").order("staff_number"),
        db.from("staff_work_schedules").select("id,staff_id,work_days,notes,updated_at").eq("school_id", schoolId),
        db.from("staff_work_schedule_exceptions").select("id,staff_id,exception_date,exception_type,reason,created_at").eq("school_id", schoolId).gte("exception_date", today()).order("exception_date").limit(200),
        db.from("staff_work_schedule_audit").select("id,staff_id,entity_type,action,created_at,before_data,after_data").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      ]);
      for (const result of [staffResult, scheduleResult, exceptionResult, auditResult]) if (result.error) throw result.error;
      const rows = staffResult.data ?? [];
      const personIds = [...new Set(rows.map((row: any) => row.person_id).filter(Boolean))];
      const peopleResult = personIds.length ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds) : { data: [], error: null };
      if (peopleResult.error) throw peopleResult.error;
      const names = new Map((peopleResult.data ?? []).map((person: any) => [person.id, [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")]));
      setStaff(rows.map((row: any) => ({ ...row, name: names.get(row.person_id) || row.staff_number || "Staff member" })));
      setSchedules(scheduleResult.data ?? []);
      setExceptions(exceptionResult.data ?? []);
      setAudit(auditResult.data ?? []);
      setSelectedStaffId(current => current || rows[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Staff work schedules could not be loaded.");
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const row = schedules.find(item => item.staff_id === selectedStaffId);
    setWorkDays(row?.work_days?.map(Number) ?? defaultWorkDays);
    setNotes(row?.notes ?? "");
  }, [schedules, selectedStaffId]);

  async function saveSchedule() {
    if (!selectedStaffId || workDays.length === 0) { setError("Select a staff member and at least one working day."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await db.from("staff_work_schedules").upsert({
        school_id: schoolId, staff_id: selectedStaffId,
        work_days: [...workDays].sort((a, b) => a - b),
        notes: notes.trim() || null, updated_by: auth.user.id,
      }, { onConflict: "school_id,staff_id" });
      if (saveError) throw saveError;
      setNotice("Weekly staff work schedule saved. Absence checks will now use these days.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The staff schedule could not be saved."); }
    finally { setSaving(false); }
  }

  async function saveException() {
    if (!selectedStaffId || !exceptionDate || exceptionReason.trim().length < 3) { setError("Choose a date and enter a reason of at least 3 characters."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await db.from("staff_work_schedule_exceptions").upsert({
        school_id: schoolId, staff_id: selectedStaffId, exception_date: exceptionDate,
        exception_type: exceptionType, reason: exceptionReason.trim(), updated_by: auth.user.id,
      }, { onConflict: "school_id,staff_id,exception_date" });
      if (saveError) throw saveError;
      setNotice(exceptionType === "off" ? "Approved off-day saved. No absence alert will be sent for this staff member on that date." : "Additional working day saved. The normal workday schedule is overridden for that date.");
      setExceptionReason(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The schedule exception could not be saved."); }
    finally { setSaving(false); }
  }

  async function removeException(id: string) {
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: deleteError } = await (getSupabaseClient() as any).from("staff_work_schedule_exceptions").delete().eq("id", id).eq("school_id", schoolId);
      if (deleteError) throw deleteError;
      setNotice("Date-specific schedule change removed.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The schedule change could not be removed."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-900 text-white"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Dashboard</Link>
      <div className="flex items-center gap-3"><span className="rounded-2xl bg-white/10 p-3"><CalendarDays size={26}/></span><div><p className="text-xs uppercase tracking-[.18em] text-emerald-200">RESA • Human Resources</p><h1 className="text-2xl font-extrabold sm:text-3xl">Staff Work Schedules</h1></div></div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">Assign each staff member their actual working days. RESA uses these assignments when checking absence alerts, so scheduled off-days are not treated as absences.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><UserRound className="text-emerald-800"/><h2 className="text-lg font-extrabold">Weekly working days</h2></div>
          {loading ? <p className="py-8 text-sm text-slate-500">Loading staff schedules…</p> : !staff.length ? <p className="py-8 text-sm text-slate-500">No active staff records were found.</p> : <>
            <label className="mt-4 block text-sm font-semibold">Staff member<select className={field} value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}>{staff.map(row => <option key={row.id} value={row.id}>{row.name}{row.staff_number ? " · " + row.staff_number : ""}{row.job_title ? " — " + row.job_title : ""}</option>)}</select></label>
            <p className="mt-4 text-sm text-slate-600">Select the days this staff member is expected to report.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{days.map(day => <label key={day.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-emerald-50"><input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={workDays.includes(day.value)} onChange={e => setWorkDays(current => e.target.checked ? [...current, day.value] : current.filter(value => value !== day.value))}/><span className="text-sm font-medium">{day.label}</span></label>)}</div>
            <label className="mt-4 block text-sm font-semibold">Schedule note (optional)<textarea className={field} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Part-time ICT instructor — reports three days weekly"/></label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{selectedSchedule ? "Custom schedule saved" : "No custom schedule yet · legacy default is Monday to Saturday"}</p><button type="button" disabled={saving || !selectedStaffId} onClick={() => void saveSchedule()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{saving ? "Saving…" : "Save working days"}</button></div>
          </>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Clock3 className="text-emerald-800"/><h2 className="text-lg font-extrabold">One-date schedule change</h2></div>
          <p className="mt-2 text-sm text-slate-600">Record a one-off off-day or an additional working day without changing the normal weekly schedule.</p>
          <label className="mt-4 block text-sm font-semibold">Date<input className={field} type="date" value={exceptionDate} onChange={e => setExceptionDate(e.target.value)}/></label>
          <label className="mt-3 block text-sm font-semibold">Change type<select className={field} value={exceptionType} onChange={e => setExceptionType(e.target.value as "off" | "working_day")}><option value="off">Approved off-day — exclude from absence alerts</option><option value="working_day">Additional working day — expect attendance</option></select></label>
          <label className="mt-3 block text-sm font-semibold">Reason<input className={field} value={exceptionReason} onChange={e => setExceptionReason(e.target.value)} placeholder="e.g. Approved duty swap"/></label>
          <button type="button" disabled={saving || !selectedStaffId} onClick={() => void saveException()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Check size={16}/>Save date change</button>
          <p className="mt-3 text-xs text-slate-500">Date changes apply only to the selected staff member and are recorded in the audit history.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><CalendarDays className="text-emerald-800"/><h2 className="text-lg font-extrabold">Upcoming date changes</h2><button type="button" onClick={() => void load()} className="ml-auto rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Refresh schedules"><RefreshCw size={16}/></button></div>
        {!selectedExceptions.length ? <p className="mt-3 text-sm text-slate-500">No upcoming one-date changes for this staff member.</p> : <div className="mt-3 divide-y divide-slate-100">{selectedExceptions.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{new Date(row.exception_date + "T12:00:00+01:00").toLocaleDateString("en-NG",{dateStyle:"full"})}</p><p className="text-xs text-slate-500">{row.exception_type === "off" ? "Approved off-day" : "Additional working day"} · {row.reason}</p></div><button type="button" disabled={saving} onClick={() => void removeException(row.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"><Trash2 size={14}/>Remove</button></div>)}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-800"/><h2 className="text-lg font-extrabold">Schedule change audit</h2></div>
        {!selectedAudit.length ? <p className="mt-3 text-sm text-slate-500">No schedule changes have been recorded yet.</p> : <div className="mt-3 divide-y divide-slate-100">{selectedAudit.map(row => <div key={row.id} className="py-3"><p className="text-sm font-semibold">{row.entity_type === "weekly_schedule" ? "Weekly schedule" : "Date exception"} · {row.action.toLowerCase()}</p><p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"})}</p></div>)}</div>}
      </section>
      <p className="text-xs leading-5 text-slate-500">All schedule dates and attendance checkpoints use Africa/Lagos time. Staff without a custom schedule keep the existing Monday–Saturday attendance expectation until the administrator assigns their individual days.</p>
    </div>
  </main>;
}
