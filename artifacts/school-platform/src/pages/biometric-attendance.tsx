import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Fingerprint, LogIn, LogOut, Plus, RefreshCw, Search, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import QrAttendancePanel from "@/components/qr-attendance-panel";
import AttendanceQrApprovals from "@/components/attendance-qr-approvals";

type Student = { id: string; person_id: string; admission_number: string; name: string; class_id: string; session_id: string };
type Device = { id: string; device_name: string; device_type: string; location: string | null; is_active: boolean };
type EventRow = { id: string; student_id: string; event_type: "check_in" | "check_out"; event_time: string; verification_method: string };
const lagosDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const timeLabel = (value: string) => new Date(value).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });

export default function BiometricAttendancePage({ schoolId }: { schoolId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [checkpointAlerts,setCheckpointAlerts]=useState<Array<Record<string,any>>>([]);
  const [acknowledgementNotes,setAcknowledgementNotes]=useState<Record<string,string>>({});

  const [search, setSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("Main entrance");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [deviceResult, studentResult, sessionResult, eventResult, checkpointResult] = await Promise.all([
        db.from("biometric_devices").select("id,device_name,device_type,location,is_active").eq("school_id", schoolId).eq("is_active", true).order("created_at", { ascending: false }),
        db.from("students").select("id,person_id,admission_number").eq("school_id", schoolId).eq("status", "active").order("admission_number").limit(1000),
        db.from("academic_sessions").select("id,is_current").eq("school_id", schoolId).order("start_date", { ascending: false }),
        db.from("biometric_attendance_events").select("id,student_id,event_type,event_time,verification_method").eq("school_id", schoolId).gte("event_time", lagosDate() + "T00:00:00+01:00").order("event_time", { ascending: false }).limit(150),
        db.from("attendance_checkpoint_alerts").select("*").eq("school_id",schoolId).eq("attendance_date",lagosDate()).order("first_detected_at",{ascending:false}).limit(250),
      ]);
      if (deviceResult.error) throw deviceResult.error;
      if (studentResult.error) throw studentResult.error;
      if (sessionResult.error) throw sessionResult.error;
      if (eventResult.error) throw eventResult.error;
      if (checkpointResult.error) throw checkpointResult.error;
      const studentRows = studentResult.data ?? [];
      const personIds = studentRows.map((s: any) => s.person_id).filter(Boolean);
      const [peopleResult, enrollmentResult] = await Promise.all([
        personIds.length ? db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds) : { data: [], error: null },
        db.from("student_enrollments").select("student_id,class_id,academic_session_id").eq("school_id", schoolId).eq("status", "active"),
      ]);
      if (peopleResult.error) throw peopleResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;
      const people = new Map((peopleResult.data ?? []).map((p: any) => [String(p.id), [p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")]));
      const currentSession = (sessionResult.data ?? []).find((s: any) => s.is_current)?.id ?? sessionResult.data?.[0]?.id;
      const enrollments = new Map<string, any>();
      for (const row of enrollmentResult.data ?? []) if (!enrollments.has(String(row.student_id)) && (!currentSession || row.academic_session_id === currentSession)) enrollments.set(String(row.student_id), row);
      const roster: Student[] = studentRows.flatMap((s: any) => {
        const enrollment = enrollments.get(String(s.id));
        if (!enrollment) return [];
        return [{ id: String(s.id), person_id: String(s.person_id), admission_number: String(s.admission_number), name: people.get(String(s.person_id)) || String(s.admission_number), class_id: String(enrollment.class_id), session_id: String(enrollment.academic_session_id) }];
      });
      setStudents(roster);
      setDevices((deviceResult.data ?? []) as Device[]);
      setSelectedDevice((current: string) => current || deviceResult.data?.[0]?.id || "");
      setEvents((eventResult.data ?? []) as EventRow[]);
      setCheckpointAlerts(checkpointResult.data??[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Biometric attendance data could not be loaded."); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  // Keep the live register scoped to the current Lagos calendar day.
  // Historical student_attendance rows remain untouched for admin/form-teacher review.
  useEffect(() => {
    let currentDay = lagosDate();
    const timer = setInterval(() => {
      const nextDay = lagosDate();
      if (nextDay !== currentDay) {
        currentDay = nextDay;
        setSearch("");
        void load();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const filteredStudents = useMemo(() => students.filter(s => (s.name + " " + s.admission_number).toLowerCase().includes(search.trim().toLowerCase())), [students, search]);
  const studentNames = useMemo(() => new Map(students.map(s => [s.id, s.name])), [students]);

  async function registerDesk() {
    if (!deviceName.trim()) { setError("Enter a name for this attendance station."); return; }
    setSaving("device"); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data, error: insertError } = await db.from("biometric_devices").insert({
        school_id: schoolId, device_name: deviceName.trim(), device_type: "admin_console",
        location: deviceLocation.trim() || null, serial_number: null, is_active: true,
      }).select("id,device_name,device_type,location,is_active").single();
      if (insertError) throw insertError;
      setDevices(previous => [data as Device, ...previous]);
      setSelectedDevice(String(data.id));
      setDeviceName("");
      setNotice("Attendance station registered. This records the station details; it does not enrol fingerprint templates.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not register the attendance station."); }
    finally { setSaving(""); }
  }

  async function acknowledgeCheckpoint(alertId:string){
    setSaving("checkpoint:"+alertId);setError("");setNotice("");
    try{
      const db=getSupabaseClient() as any;
      const {data,error:e}=await db.rpc("resa_acknowledge_attendance_checkpoint",{
        p_alert_id:alertId,p_note:acknowledgementNotes[alertId]?.trim()||null,
      });
      if(e)throw e;if(!data?.success)throw new Error("The alert was not acknowledged.");
      setNotice("Attendance checkpoint alert acknowledged.");await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not acknowledge attendance alert.");}
    finally{setSaving("");}
  }

  async function recordEvent(student: Student, eventType: "check_in" | "check_out") {
    if (!selectedDevice) { setError("Register or select an attendance station first."); return; }
    setSaving(student.id + eventType); setError(""); setNotice("");
    const db = getSupabaseClient() as any;
    try {
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Your session has expired. Sign in again.");
      const today = lagosDate();
      const { data: existing, error: attendanceError } = await db.from("student_attendance")
        .select("id,check_in_at,check_out_at").eq("school_id", schoolId).eq("student_id", student.id).eq("attendance_date", today).maybeSingle();
      if (attendanceError) throw attendanceError;
      if (eventType === "check_in" && existing?.check_in_at) throw new Error("This learner has already been checked in today.");
      if (eventType === "check_out" && !existing?.check_in_at) throw new Error("This learner has not been checked in today.");
      if (eventType === "check_out" && existing?.check_out_at) throw new Error("This learner has already been checked out today.");

      const { data: event, error: eventError } = await db.from("biometric_attendance_events").insert({
        school_id: schoolId, biometric_device_id: selectedDevice, student_id: student.id,
        event_type: eventType, verification_method: "other",
      }).select("id,event_time").single();
      if (eventError) throw eventError;
      const stamp = String(event.event_time);
      setNotice(`${student.name} ${eventType === "check_in" ? "checked in" : "checked out"} successfully at ${timeLabel(stamp)}. Parent attendance notification was queued automatically for linked guardians.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attendance could not be recorded.");
    } finally { setSaving(""); }
  }

  const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Dashboard</Link>
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><Fingerprint size={26}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA School Portal</p><h1 className="text-2xl font-extrabold sm:text-3xl">Smart Attendance Centre</h1></div></div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100">Admin-assisted student check-in and check-out, registered attendance stations, and parent portal attendance alerts.</p>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6">
      <AttendanceQrApprovals schoolId={schoolId}/>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Attendance station</h2><p className="mt-1 text-sm text-slate-600">Register the school phone, tablet or admin desk as a check-in station.</p></div><Smartphone className="text-emerald-800" size={24}/></div>
          <label className="mt-4 block text-sm font-semibold">Registered station<select className={field} value={selectedDevice} onChange={e=>setSelectedDevice(e.target.value)}><option value="">Choose station</option>{devices.map(d=><option key={d.id} value={d.id}>{d.device_name}{d.location?" · "+d.location:""}</option>)}</select></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">New station name<input className={field} value={deviceName} onChange={e=>setDeviceName(e.target.value)} placeholder="e.g. RESA Main Gate Phone" maxLength={100}/></label><label className="block text-sm font-semibold">Station location<input className={field} value={deviceLocation} onChange={e=>setDeviceLocation(e.target.value)} placeholder="Main entrance" maxLength={120}/></label></div>
          <button type="button" onClick={()=>void registerDesk()} disabled={saving==="device"} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus size={16}/>{saving==="device"?"Registering…":"Register attendance station"}</button>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldCheck size={14} className="mr-1 inline"/>Security note: this web portal can register station details and record administrator-verified attendance. It cannot directly enrol or read fingerprint templates from a phone's built-in sensor. A supported external terminal and its vendor integration are required for true fingerprint matching.</p>
        </article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Bell size={20} className="text-emerald-800"/><h2 className="text-lg font-extrabold">Parent alerts</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">When a student is checked in, RESA creates an in-portal attendance alert for each linked guardian whose parent portal is enabled. Parents can view it on their dashboard. WhatsApp delivery can be added later when a verified WhatsApp Business provider is configured.</p><div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"><UserCheck size={18}/> {devices.length} active station{devices.length===1?"":"s"} · {students.length} active enrolled learners</div></article>
      </section>
      <QrAttendancePanel schoolId={schoolId} stationId={selectedDevice} onRecorded={() => void load()}/>
      {error&&<p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5"><div><h2 className="text-lg font-extrabold">Student check-in / check-out</h2><p className="mt-1 text-sm text-slate-600">Search by student name or admission number. All actions are timestamped in Lagos time.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div>
        <label className="relative mx-4 mt-4 block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="w-full rounded-xl border px-3 py-3 pl-10 text-sm" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student name or admission number…"/></label>
        {loading?<p className="p-8 text-center text-sm text-slate-500">Loading student roster…</p>:filteredStudents.length===0?<p className="p-8 text-center text-sm text-slate-500">No enrolled students match this search.</p>:<div className="mt-3 divide-y">{filteredStudents.map(student=>{const studentEvents=events.filter(e=>e.student_id===student.id);const checkedIn=studentEvents.some(e=>e.event_type==="check_in");const checkedOut=studentEvents.some(e=>e.event_type==="check_out");return <article key={student.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"><div className="min-w-0"><p className="font-bold">{student.name}</p><p className="mt-1 text-xs text-slate-500">{student.admission_number} · {studentEvents[0]?studentEvents[0].event_type.replace("_"," ")+ " "+timeLabel(studentEvents[0].event_time):"No check-in recorded today"}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>void recordEvent(student,"check_in")} disabled={!selectedDevice||!!saving||checkedIn} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40"><LogIn size={16}/>{saving===student.id+"check_in"?"Saving…":"Clock in"}</button><button type="button" onClick={()=>void recordEvent(student,"check_out")} disabled={!selectedDevice||!!saving||!checkedIn||checkedOut} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-900 disabled:opacity-40"><LogOut size={16}/>{saving===student.id+"check_out"?"Saving…":"Clock out"}</button></div></article>})}</div>}
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold">10:00 AM attendance checkpoint alerts</h2><p className="mt-1 text-sm text-slate-600">Repeated admin/HR reminders stop when the alert is acknowledged or the person checks in.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{checkpointAlerts.filter(a=>a.alert_status==="pending").length} pending</span></div>
        {checkpointAlerts.length===0?<p className="mt-3 text-sm text-slate-500">No checkpoint alerts for today.</p>:<div className="mt-3 divide-y">{checkpointAlerts.map(alert=><article key={alert.id} className="py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{alert.person_type==="student"?(studentNames.get(alert.student_id)||"Student"):"Staff member"} · {alert.person_type}</p><p className="mt-1 text-xs text-slate-500">Reminder count: {alert.reminder_count} · First detected: {timeLabel(alert.first_detected_at)}</p>{alert.acknowledgement_note&&<p className="mt-1 text-sm text-slate-600">Note: {alert.acknowledgement_note}</p>}</div><span className={alert.alert_status==="pending"?"rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900":"rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900"}>{alert.alert_status}</span></div>{alert.alert_status==="pending"&&<div className="mt-3 flex flex-wrap gap-2"><input className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm" value={acknowledgementNotes[alert.id]||""} onChange={e=>setAcknowledgementNotes(p=>({...p,[alert.id]:e.target.value}))} placeholder="Acknowledgement note (optional)"/><button type="button" onClick={()=>void acknowledgeCheckpoint(alert.id)} disabled={!!saving} className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving==="checkpoint:"+alert.id?"Saving…":"Acknowledge"}</button></div>}</article>)}</div>}
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-extrabold">Today's attendance event log</h2>{events.length===0?<p className="mt-3 text-sm text-slate-500">No check-in or check-out events have been recorded today.</p>:<div className="mt-3 divide-y">{events.slice(0,30).map(event=><div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-semibold">{studentNames.get(event.student_id)||"Student"}</span><span className="text-slate-600">{event.event_type.replace("_"," ")} · {timeLabel(event.event_time)} · Admin recorded</span></div>)}</div>}</section>
    </div>
  </main>;
}
