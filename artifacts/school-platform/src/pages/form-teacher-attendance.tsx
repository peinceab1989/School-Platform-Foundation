import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, Printer, RefreshCw, Users, UserCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ClassRow = { id: string; name: string; level: string | null };
type SessionRow = { id: string; name: string; is_current: boolean };
type StaffRow = { id: string; person_id: string; staff_number: string | null; name: string };
type FormTeacherRow = { id: string; staff_id: string; class_id: string; academic_session_id: string };
type StudentRow = { id: string; person_id: string; admission_number: string; name: string };
type AttendanceRow = { student_id: string; attendance_date: string; status: string };
type Props = { schoolId: string; userId: string; role: "admin" | "teacher" };

const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
};
const monthStart = () => today().slice(0, 8) + "01";
const label = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

export default function FormTeacherAttendancePage({ schoolId, userId, role }: Props) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [assignments, setAssignments] = useState<FormTeacherRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const staffQuery = role === "teacher"
        ? db.from("staff").select("id,person_id,staff_number,status,user_id").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active")
        : db.from("staff").select("id,person_id,staff_number,status,user_id").eq("school_id", schoolId).eq("status", "active").order("created_at", { ascending: false });
      const [c, s, st, a] = await Promise.all([
        db.from("school_classes").select("id,name,level").eq("school_id", schoolId).order("name"),
        db.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("start_date", { ascending: false }),
        staffQuery,
        db.from("class_form_teachers").select("id,staff_id,class_id,academic_session_id").eq("school_id", schoolId),
      ]);
      for (const x of [c, s, st, a]) if (x.error) throw x.error;
      const classRows = (c.data ?? []) as ClassRow[];
      const sessionRows = (s.data ?? []) as SessionRow[];
      let staffRows = st.data ?? [];
      if (role === "teacher" && !staffRows.length) {
        const ownPerson = await db.from("people").select("id").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
        if (ownPerson.error) throw ownPerson.error;
        if (ownPerson.data?.id) {
          const linkedStaff = await db.from("staff").select("id,person_id,staff_number,status,user_id").eq("school_id", schoolId).eq("person_id", ownPerson.data.id).eq("status", "active").maybeSingle();
          if (linkedStaff.error) throw linkedStaff.error;
          staffRows = linkedStaff.data ? [linkedStaff.data] : [];
        }
      }
      const peopleIds = [...new Set(staffRows.map((x: any) => x.person_id).filter(Boolean))];
      let people = new Map<string, string>();
      if (peopleIds.length) {
        const p = await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", peopleIds);
        if (p.error) throw p.error;
        people = new Map((p.data ?? []).map((x: any) => [x.id, [x.first_name, x.middle_name, x.last_name].filter(Boolean).join(" ")]));
      }
      const allStaff: StaffRow[] = staffRows.map((x: any) => ({ id: x.id, person_id: x.person_id, staff_number: x.staff_number, name: people.get(x.person_id) || x.staff_number || "Staff member" }));
      const assignmentRows = (a.data ?? []) as FormTeacherRow[];
      setClasses(classRows); setSessions(sessionRows); setStaff(allStaff);
      const allowedAssignments = role === "admin" ? assignmentRows : assignmentRows.filter(x => allStaff.some(s => s.id === x.staff_id));
      setAssignments(allowedAssignments);
      const preferred = sessionRows.find(x => x.is_current)?.id || sessionRows[0]?.id || "";
      setSessionId(prev => sessionRows.some(x => x.id === prev) ? prev : preferred);
      setClassId(prev => {
        if (role === "admin") return classRows.some(x => x.id === prev) ? prev : classRows[0]?.id || "";
        if (allowedAssignments.some(a => a.class_id === prev && a.academic_session_id === preferred)) return prev;
        return classRows.find(c => allowedAssignments.some(a => a.class_id === c.id && a.academic_session_id === preferred))?.id
          || classRows.find(c => allowedAssignments.some(a => a.class_id === c.id))?.id || "";
      });
      setStaffId(prev => allStaff.some(x => x.id === prev) ? prev : allStaff[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load form-teacher assignments.");
    } finally { setLoading(false); }
  }, [schoolId, role, userId]);

  useEffect(() => { void load(); }, [load]);

  const visibleAssignments = useMemo(() => assignments.filter(a =>
    (!sessionId || a.academic_session_id === sessionId) && (!classId || a.class_id === classId)
  ), [assignments, sessionId, classId]);

  const loadComparison = useCallback(async () => {
    setError("");
    if (!sessionId || !classId || !fromDate || !toDate || fromDate > toDate) {
      setStudents([]); setAttendance([]);
      if (fromDate > toDate) setError("The start date must not be later than the end date.");
      return;
    }
    try {
      const db = getSupabaseClient() as any;
      const [enrollments, records] = await Promise.all([
        db.from("student_enrollments").select("student_id").eq("school_id", schoolId).eq("class_id", classId).eq("academic_session_id", sessionId).eq("status", "active"),
        db.from("student_attendance").select("student_id,attendance_date,status").eq("school_id", schoolId).eq("class_id", classId).eq("academic_session_id", sessionId).gte("attendance_date", fromDate).lte("attendance_date", toDate).order("attendance_date"),
      ]);
      if (enrollments.error) throw enrollments.error;
      if (records.error) throw records.error;
      const ids = [...new Set((enrollments.data ?? []).map((x: any) => x.student_id))];
      if (!ids.length) { setStudents([]); setAttendance(records.data ?? []); return; }
      const sr = await db.from("students").select("id,person_id,admission_number").eq("school_id", schoolId).in("id", ids).order("admission_number");
      if (sr.error) throw sr.error;
      const pids = [...new Set((sr.data ?? []).map((x: any) => x.person_id))];
      const pr = pids.length ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", pids) : { data: [], error: null };
      if (pr.error) throw pr.error;
      const names = new Map((pr.data ?? []).map((x: any) => [x.id, [x.first_name, x.middle_name, x.last_name].filter(Boolean).join(" ")]));
      setStudents((sr.data ?? []).map((x: any) => ({ ...x, name: names.get(x.person_id) || "Student" })));
      setAttendance((records.data ?? []) as AttendanceRow[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Attendance comparison could not be loaded."); }
  }, [schoolId, sessionId, classId, fromDate, toDate]);

  useEffect(() => { void loadComparison(); }, [loadComparison]);

  async function assign(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!staffId || !classId || !sessionId) { setError("Select a teacher, class, and academic session."); return; }
    if (assignments.some(a => a.staff_id === staffId && a.class_id === classId && a.academic_session_id === sessionId)) {
      setError("This teacher is already assigned as form teacher for that class and session."); return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await (getSupabaseClient() as any).from("class_form_teachers").insert({ school_id: schoolId, staff_id: staffId, class_id: classId, academic_session_id: sessionId, assigned_by: userId });
      if (insertError) throw insertError;
      setNotice("Form teacher assigned. They can now view and compare attendance for this class.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The form teacher assignment could not be saved."); }
    finally { setSaving(false); }
  }

  async function removeAssignment(a: FormTeacherRow) {
    if (!window.confirm("Remove this form teacher assignment?")) return;
    setError(""); setNotice("");
    try {
      const { error: deleteError } = await (getSupabaseClient() as any).from("class_form_teachers").delete().eq("school_id", schoolId).eq("id", a.id);
      if (deleteError) throw deleteError;
      setNotice("Form teacher assignment removed."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove the assignment."); }
  }

  const counts = useMemo(() => {
    const byStudent = new Map<string, { present: number; absent: number; late: number; excused: number; records: number }>();
    for (const s of students) byStudent.set(s.id, { present: 0, absent: 0, late: 0, excused: 0, records: 0 });
    for (const row of attendance) {
      const item = byStudent.get(row.student_id); if (!item) continue;
      const status = row.status.toLowerCase() as "present" | "absent" | "late" | "excused";
      if (status in item && status !== "records") item[status]++;
      item.records++;
    }
    return byStudent;
  }, [students, attendance]);

  const totals = useMemo(() => attendance.reduce((a, r) => {
    const key = r.status.toLowerCase() as "present" | "absent" | "late" | "excused";
    if (key in a) a[key]++;
    return a;
  }, { present: 0, absent: 0, late: 0, excused: 0 }), [attendance]);

  const currentClass = classes.find(c => c.id === classId)?.name || "Selected class";
  const currentSession = sessions.find(s => s.id === sessionId)?.name || "Selected session";
  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white print:bg-white print:text-black"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5"><div><p className="text-xs uppercase tracking-widest text-emerald-200 print:text-black">RESA School Portal</p><h1 className="text-2xl font-bold">Form Teacher & Attendance</h1><p className="mt-1 text-sm text-emerald-100 print:text-black">Class attendance comparison and form-teacher assignments</p></div><div className="flex flex-wrap gap-2 print:hidden"><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-emerald-950"><Printer size={16}/> Print</button><Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm"><ArrowLeft size={16}/> Dashboard</Link></div></div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {role === "admin" && <section className="rounded-xl border bg-white p-5 shadow-sm print:hidden"><h2 className="flex items-center gap-2 text-lg font-bold"><UserCheck size={19}/> Assign a form teacher</h2><p className="mt-1 text-sm text-slate-600">The assigned teacher gets access to attendance comparisons for the selected class and session.</p>
        <form onSubmit={assign} className="mt-4 grid gap-3 sm:grid-cols-4"><label className="text-sm font-semibold">Teacher<select className={field+" mt-1"} value={staffId} onChange={e=>setStaffId(e.target.value)}><option value="">Choose teacher</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}{s.staff_number?" ("+s.staff_number+")":""}</option>)}</select></label>
        <label className="text-sm font-semibold">Class<select className={field+" mt-1"} value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Choose class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Academic session<select className={field+" mt-1"} value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">Choose session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_current?" (Current)":""}</option>)}</select></label>
        <button disabled={saving||loading} className="self-end rounded-lg bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?"Assigning…":"Assign form teacher"}</button></form>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Class</th><th className="p-3">Form teacher</th><th className="p-3">Session</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{visibleAssignments.map(a=><tr key={a.id}><td className="p-3">{classes.find(c=>c.id===a.class_id)?.name||"—"}</td><td className="p-3">{staff.find(s=>s.id===a.staff_id)?.name||"—"}</td><td className="p-3">{sessions.find(s=>s.id===a.academic_session_id)?.name||"—"}</td><td className="p-3"><button onClick={()=>void removeAssignment(a)} className="font-semibold text-red-700 underline">Remove</button></td></tr>)}{!visibleAssignments.length&&<tr><td colSpan={4} className="p-4 text-slate-500">No form teacher assignments match these filters.</td></tr>}</tbody></table></div>
      </section>}
      <section className="rounded-xl border bg-white p-5 shadow-sm print:hidden"><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays size={19}/> Attendance comparison filters</h2><div className="mt-4 grid gap-3 sm:grid-cols-4"><label className="text-sm font-semibold">Class<select className={field+" mt-1"} value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Choose class</option>{(role==="teacher"?classes.filter(c=>assignments.some(a=>a.class_id===c.id&&a.academic_session_id===sessionId)):classes).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm font-semibold">Session<select className={field+" mt-1"} value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">Choose session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-sm font-semibold">From date<input type="date" className={field+" mt-1"} value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label className="text-sm font-semibold">To date<input type="date" className={field+" mt-1"} value={toDate} onChange={e=>setToDate(e.target.value)}/></label></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void loadComparison()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Refresh comparison</button><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white"><Printer size={15}/> Print comparison</button></div></section>
      <section className="rounded-xl border bg-white p-5 shadow-sm print:border-0 print:p-0"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{currentClass} — Attendance Comparison</h2><p className="text-sm text-slate-600">{currentSession} • {fromDate} to {toDate}</p><p className="mt-1 text-xs text-slate-500">Percentages are based on attendance records saved in the selected date range. Days with no attendance record are not assumed to be absent.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-900"><Users size={15}/>{students.length} students</span></div>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">{[["Present",totals.present],["Absent",totals.absent],["Late",totals.late],["Excused",totals.excused]].map(([name,n])=><div key={name} className="rounded-lg bg-slate-50 p-3"><p className="text-sm text-slate-500">{name}</p><p className="text-2xl font-extrabold">{n}</p></div>)}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 print:bg-white"><tr>{["No.","Student","Admission No.","Present","Absent","Late","Excused","Records","Present %"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{students.map((s,i)=>{const c=counts.get(s.id)||{present:0,absent:0,late:0,excused:0,records:0};const pct=c.records?Math.round(c.present/c.records*100):0;return <tr key={s.id}><td className="px-3 py-3">{i+1}</td><td className="px-3 py-3 font-semibold">{s.name}</td><td className="px-3 py-3">{s.admission_number}</td><td className="px-3 py-3">{c.present}</td><td className="px-3 py-3">{c.absent}</td><td className="px-3 py-3">{c.late}</td><td className="px-3 py-3">{c.excused}</td><td className="px-3 py-3">{c.records}</td><td className="px-3 py-3 font-bold">{c.records?pct+"%":"—"}</td></tr>})}{!students.length&&<tr><td colSpan={9} className="p-8 text-center text-slate-500">{loading?"Loading class roster…":"No active students enrolled in this class and session."}</td></tr>}</tbody></table></div>
      </section>
      <p className="text-xs text-slate-500 print:hidden">Attendance access is limited to school administrators and the form teacher assigned to the selected class and session.</p>
    </div>
    <style>{'@media print { body { background: white !important; } main { background: white !important; } button, a { display: none !important; } table { font-size: 10px; } }'}</style>
  </main>;
}
