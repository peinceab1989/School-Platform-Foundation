import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Clock3, RefreshCw, UserCheck, UserRound, LogIn, LogOut, MapPin, ClipboardList, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Staff = { id: string; person_id: string; staff_number: string | null; job_title: string | null; status: string; user_id: string | null; name: string };
type RecordRow = { id: string; staff_id: string; attendance_date: string; status: string; check_in_time: string | null; check_out_time: string | null; remarks: string | null };
type Movement = { id: string; staff_id: string; movement_type: string; purpose: string; destination: string; departure_at: string; expected_return_at: string | null; actual_return_at: string | null; status: string; remarks: string | null };
const lagosDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const lagosTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
const localDateTimeValue = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00+01:00`).toISOString() : null;
const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export default function StaffAttendancePage({ schoolId }: { schoolId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currentlyOffSiteCount, setCurrentlyOffSiteCount] = useState(0);
  const [date, setDate] = useState(lagosDate());
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("present");
  const [remarks, setRemarks] = useState("");
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [movementType, setMovementType] = useState("official_exit");
  const [expectedDate, setExpectedDate] = useState(lagosDate());
  const [expectedTime, setExpectedTime] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const staffById = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff]);
  const filteredStaff = useMemo(() => staff.filter(s => `${s.name} ${s.staff_number ?? ""} ${s.job_title ?? ""}`.toLowerCase().includes(staffSearch.toLowerCase())), [staff, staffSearch]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data: s, error: se } = await db.from("staff").select("id,person_id,staff_number,job_title,status,user_id").eq("school_id", schoolId).eq("status", "active").order("staff_number");
      if (se) throw se;
      const ids = (s ?? []).map((x: any) => x.person_id).filter(Boolean);
      const { data: p, error: pe } = ids.length ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", ids) : { data: [], error: null };
      if (pe) throw pe;
      const people = new Map((p ?? []).map((x: any) => [x.id, [x.first_name, x.middle_name, x.last_name].filter(Boolean).join(" ")]));
      const list = (s ?? []).map((x: any) => ({ ...x, name: people.get(x.person_id) || x.staff_number || "Staff member" }));
      setStaff(list);
      if (!selected && list.length) setSelected(list[0].id);
      const [attendanceResult, movementResult, openMovementResult] = await Promise.all([
        db.from("staff_attendance").select("id,staff_id,attendance_date,status,check_in_time,check_out_time,remarks").eq("school_id", schoolId).eq("attendance_date", date).order("created_at", { ascending: false }),
        db.from("staff_movement_book").select("id,staff_id,movement_type,purpose,destination,departure_at,expected_return_at,actual_return_at,status,remarks").eq("school_id", schoolId).gte("departure_at", date + "T00:00:00+01:00").lt("departure_at", new Date(new Date(date + "T00:00:00+01:00").getTime() + 86400000).toISOString()).order("departure_at", { ascending: false }).limit(250),
        db.from("staff_movement_book").select("id").eq("school_id", schoolId).in("status", ["out", "overdue"]).limit(500),
      ]);
      if (attendanceResult.error) throw attendanceResult.error;
      if (movementResult.error) throw movementResult.error;
      if (openMovementResult.error) throw openMovementResult.error;
      setRows(attendanceResult.data ?? []);
      setMovements(movementResult.data ?? []);
      setCurrentlyOffSiteCount((openMovementResult.data ?? []).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load staff attendance and movement records.");
    } finally { setLoading(false); }
  }, [schoolId, date, selected]);

  useEffect(() => { void load(); }, [load]);

  // If the administrator leaves the live register open overnight, advance it
  // to the new Lagos school day. A deliberately selected historical date is
  // preserved, and the expected-return date follows today only when it was
  // still set to the previous current day.
  useEffect(() => {
    let currentDay = lagosDate();
    const timer = window.setInterval(() => {
      const nextDay = lagosDate();
      if (nextDay === currentDay) return;
      const previousDay = currentDay;
      currentDay = nextDay;
      setDate((value) => value === previousDay ? nextDay : value);
      setExpectedDate((value) => value === previousDay ? nextDay : value);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function saveAttendance(action: "check_in" | "check_out" | "status") {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const existing = rows.find(r => r.staff_id === selected);
      const now = lagosTime();
      if (action === "check_out" && !existing?.check_in_time) throw new Error("Record a check-in before checking this staff member out.");
      if (action === "check_in" && existing?.check_in_time) throw new Error("A check-in is already recorded for this staff member today.");
      if (action === "check_out" && existing?.check_out_time) throw new Error("A check-out is already recorded for this staff member today.");
      const payload: any = {
        school_id: schoolId, staff_id: selected, attendance_date: date,
        status: action === "status" ? status : (action === "check_in" ? "present" : "checked_out"),
        remarks: remarks.trim() || existing?.remarks || null, recorded_by: auth.user.id,
      };
      if (action === "check_in") payload.check_in_time = now;
      if (action === "check_out") payload.check_out_time = now;
      if (action === "status" && status === "absent") { payload.check_in_time = null; payload.check_out_time = null; }
      const { error: writeError } = await db.from("staff_attendance").upsert(payload, { onConflict: "staff_id,attendance_date" });
      if (writeError) throw writeError;
      setNotice(action === "check_in" ? "Staff check-in recorded." : action === "check_out" ? "Staff check-out recorded." : "Attendance status saved.");
      setRemarks(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save staff attendance."); }
    finally { setSaving(false); }
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!selected) throw new Error("Select a staff member first.");
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const expected = localDateTimeValue(expectedDate, expectedTime);
      if (expected && new Date(expected).getTime() <= Date.now()) throw new Error("Expected return time must be in the future.");
      const { error: writeError } = await db.from("staff_movement_book").insert({
        school_id: schoolId, staff_id: selected, movement_type: movementType,
        purpose: purpose.trim(), destination: destination.trim(),
        expected_return_at: expected, recorded_by: auth.user.id, remarks: remarks.trim() || null,
      });
      if (writeError) throw writeError;
      setNotice("Staff movement recorded in the movement book.");
      setPurpose(""); setDestination(""); setExpectedTime(""); setRemarks(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the movement record."); }
    finally { setSaving(false); }
  }

  async function markReturned(movement: Movement) {
    setSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { error: updateError } = await db.from("staff_movement_book").update({
        status: "returned", actual_return_at: new Date().toISOString(), returned_recorded_by: auth.user.id,
      }).eq("id", movement.id).eq("school_id", schoolId).eq("status", "out");
      if (updateError) throw updateError;
      setNotice(`${staffById.get(movement.staff_id)?.name || "Staff member"} marked as returned.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update the movement record."); }
    finally { setSaving(false); }
  }

  const fmt = (value: string | null) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value)) : "—";
  const timeFmt = (value: string | null) => value ? value.slice(0, 5) : "—";
  const todayAttendance = rows.length;
  const checkedIn = rows.filter(r => r.check_in_time && !r.check_out_time).length;
  const returnedToday = movements.filter(m => m.status === "returned").length;

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-900 text-white"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Dashboard</Link>
      <div className="flex flex-wrap items-center gap-3"><span className="rounded-2xl bg-white/10 p-3"><Clock3 size={27}/></span><div><p className="text-xs uppercase tracking-[.18em] text-emerald-200">RESA • Staff Operations</p><h1 className="text-2xl font-extrabold sm:text-3xl">Staff Attendance & Movement Centre</h1></div></div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">Record staff arrival and departure, monitor who is currently on the premises, and maintain an auditable movement book for official duty, personal exit and return.</p>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[[ "Active staff", staff.length, "Currently active staff records" ],["Attendance entries", todayAttendance, "Records for selected date"],["Currently checked in", checkedIn, "Staff with no recorded checkout"],["Currently off-site", currentlyOffSiteCount, `${returnedToday} movements returned on selected date` ]].map(([label,value,caption])=><article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><strong className="mt-1 block text-3xl font-black tracking-tight text-slate-900">{value}</strong><p className="mt-1 text-xs text-slate-500">{caption}</p></article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(300px,.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-2.5 text-sky-800"><UserCheck size={21}/></span><div><h2 className="text-lg font-extrabold">Staff clock-in / clock-out</h2><p className="text-xs text-slate-500">Admin-assisted attendance station</p></div></div>
            <label className="mt-4 block text-sm font-semibold">Find staff member<input className={field} type="search" placeholder="Search by name, staff number or role" value={staffSearch} onChange={e=>setStaffSearch(e.target.value)}/></label>
            <label className="mt-3 block text-sm font-semibold">Staff member<select className={field} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose staff</option>{filteredStaff.map(s=><option key={s.id} value={s.id}>{s.name}{s.staff_number ? ` · ${s.staff_number}` : ""}</option>)}</select></label>
            {selected && <p className="mt-2 text-xs text-slate-500">{staffById.get(selected)?.job_title || "Staff"} {staffById.get(selected)?.staff_number ? `· ${staffById.get(selected)?.staff_number}` : ""}</p>}
            <label className="mt-3 block text-sm font-semibold">Attendance date<input type="date" className={field} value={date} onChange={e=>setDate(e.target.value)}/></label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={()=>void saveAttendance("check_in")} disabled={saving||!selected||!!rows.find(r=>r.staff_id===selected)?.check_in_time} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><LogIn size={17}/> Clock in</button>
              <button type="button" onClick={()=>void saveAttendance("check_out")} disabled={saving||!selected||!rows.find(r=>r.staff_id===selected)?.check_in_time||!!rows.find(r=>r.staff_id===selected)?.check_out_time} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><LogOut size={17}/> Clock out</button>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm font-bold">Manual attendance status</p><div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><select className={field} value={status} onChange={e=>setStatus(e.target.value)}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="on_leave">On leave</option></select><button type="button" onClick={()=>void saveAttendance("status")} disabled={saving||!selected} className="rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-40">Save</button></div></div>
            <label className="mt-3 block text-sm font-semibold">Attendance remarks<textarea className={field} rows={2} value={remarks} onChange={e=>setRemarks(e.target.value)} maxLength={500} placeholder="Optional note"/></label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-800"><MapPin size={21}/></span><div><h2 className="text-lg font-extrabold">New movement entry</h2><p className="text-xs text-slate-500">Record staff leaving the school premises</p></div></div>
            <form onSubmit={e=>void submitMovement(e)} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">Movement category<select className={field} value={movementType} onChange={e=>setMovementType(e.target.value)}><option value="official_exit">Official errand / exit</option><option value="personal_exit">Personal permission</option><option value="field_duty">Field duty / off-site assignment</option></select></label>
              <label className="block text-sm font-semibold">Purpose<textarea className={field} required minLength={3} maxLength={1000} rows={2} value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="Reason for leaving the premises"/></label>
              <label className="block text-sm font-semibold">Destination<input className={field} required minLength={2} maxLength={300} value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Where is the staff member going?"/></label>
              <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Expected return date<input className={field} type="date" min={lagosDate()} value={expectedDate} onChange={e=>setExpectedDate(e.target.value)}/></label><label className="block text-sm font-semibold">Expected return time<input className={field} type="time" value={expectedTime} onChange={e=>setExpectedTime(e.target.value)}/></label></div>
              <button type="submit" disabled={saving||!selected||!purpose.trim()||!destination.trim()} className="w-full rounded-xl bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-40">Record staff movement</button>
            </form>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Daily attendance register</h2><p className="text-sm text-slate-500">Attendance for {date}</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div>
            {loading?<p className="py-8 text-sm text-slate-500">Loading attendance…</p>:rows.length===0?<div className="py-10 text-center text-sm text-slate-500"><UserRound className="mx-auto mb-2" size={30}/>No attendance entries for this date.</div>:<div className="mt-4 space-y-2">{rows.map(r=>{const s=staffById.get(r.staff_id);return <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="font-bold">{s?.name||"Staff record"}</p><p className="mt-1 text-xs text-slate-500">In: {timeFmt(r.check_in_time)} · Out: {timeFmt(r.check_out_time)}</p>{r.remarks&&<p className="mt-1 text-xs text-slate-600">{r.remarks}</p>}</div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-900">{r.status.replaceAll("_"," ")}</span></article>})}</div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="inline-flex items-center gap-2 text-lg font-extrabold"><ClipboardList size={20}/> Staff movement book</h2><p className="text-sm text-slate-500">Official record of departures and returns</p></div><select aria-label="Filter movement records" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={movementFilter} onChange={e=>setMovementFilter(e.target.value)}><option value="all">All movements</option><option value="out">Still off-site</option><option value="returned">Returned</option></select></div>
            {loading?<p className="py-8 text-sm text-slate-500">Loading movement book…</p>:movements.filter(m=>movementFilter==="all"||m.status===movementFilter).length===0?<div className="py-10 text-center text-sm text-slate-500"><MapPin className="mx-auto mb-2" size={30}/>No movement records for this date.</div>:<div className="mt-4 space-y-3">{movements.filter(m=>movementFilter==="all"||m.status===movementFilter).map(m=>{const overdue=m.status==="out"&&m.expected_return_at&&new Date(m.expected_return_at).getTime()<Date.now();return <article key={m.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{staffById.get(m.staff_id)?.name||"Staff member"}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{m.movement_type.replaceAll("_"," ")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${m.status==="returned"?"bg-emerald-50 text-emerald-800":overdue?"bg-rose-50 text-rose-800":"bg-amber-50 text-amber-800"}`}>{m.status==="returned"?"Returned":overdue?"Overdue":"Off-site"}</span></div><p className="mt-3 text-sm"><strong>Destination:</strong> {m.destination}</p><p className="mt-1 text-sm"><strong>Purpose:</strong> {m.purpose}</p><div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2"><span>Departed: {fmt(m.departure_at)}</span><span>Expected back: {fmt(m.expected_return_at)}</span>{m.actual_return_at&&<span>Returned: {fmt(m.actual_return_at)}</span>}</div>{m.remarks&&<p className="mt-2 text-xs text-slate-600">{m.remarks}</p>}{m.status==="out"&&<button type="button" onClick={()=>void markReturned(m)} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><CheckCircle2 size={15}/> Mark as returned</button>}</article>})}</div>}
          </section>
        </div>
      </section>
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck className="mr-2 inline" size={17}/>{notice}</p>}
      {error&&<p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <p className="text-xs leading-5 text-slate-500">Security note: entries are restricted by the existing school-admin role. These are admin-recorded check-ins and movement entries, not fingerprint-verified biometrics. A compatible staff biometric terminal requires its own secure hardware integration. Movement entries are retained as an audit trail; returning a staff member closes the open movement record without deleting it.</p>
    </div>
  </main>;
}
