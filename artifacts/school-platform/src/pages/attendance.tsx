import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck, Check, RefreshCw, Save } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type ClassRow = { id: string; name: string; level: string | null };
type SessionRow = { id: string; name: string; is_current: boolean };
type StudentRow = {
  id: string;
  person_id: string;
  admission_number: string;
  status: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};
type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceRow = {
  id: string;
  student_id: string;
  status: string;
  remarks: string | null;
};

const todayInLagos = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const statusOptions: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const labelStatus = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const fullName = (student: StudentRow) =>
  [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");

export default function AttendancePage({ schoolId }: { schoolId: string }) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [date, setDate] = useState(todayInLagos);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSetup = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const client = getSupabaseClient();
      const [classResult, sessionResult] = await Promise.all([
        client.from("school_classes").select("id,name,level").eq("school_id", schoolId).order("name"),
        client.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("start_date", { ascending: false }),
      ]);
      if (classResult.error) throw classResult.error;
      if (sessionResult.error) throw sessionResult.error;
      const classRows = (classResult.data ?? []) as ClassRow[];
      const sessionRows = (sessionResult.data ?? []) as SessionRow[];
      setClasses(classRows);
      setSessions(sessionRows);
      setClassId((current) => current || classRows[0]?.id || "");
      setSessionId((current) => current || sessionRows.find((row) => row.is_current)?.id || sessionRows[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load classes and academic sessions.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const loadRegister = useCallback(async () => {
    if (!schoolId || !classId || !sessionId || !date) {
      setStudents([]);
      setStatuses({});
      setRemarks({});
      setExistingIds({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      const client = getSupabaseClient();
      const { data: enrollmentRows, error: enrollmentError } = await client
        .from("student_enrollments")
        .select("student_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("academic_session_id", sessionId)
        .eq("status", "active");
      if (enrollmentError) throw enrollmentError;

      const enrolledIds = [...new Set((enrollmentRows ?? []).map((row) => row.student_id))];
      if (!enrolledIds.length) {
        setStudents([]);
        setStatuses({});
        setRemarks({});
        setExistingIds({});
        return;
      }

      const { data: enrolledRows, error: studentsError } = await client
        .from("students")
        .select("id,person_id,admission_number,status")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .in("id", enrolledIds)
        .order("admission_number");
      if (studentsError) throw studentsError;

      const allStudents = enrolledRows ?? [];
      const ids = allStudents.map((student) => student.person_id);
      const { data: people, error: peopleError } = await client
        .from("people")
        .select("id,first_name,middle_name,last_name")
        .eq("school_id", schoolId)
        .in("id", ids);
      if (peopleError) throw peopleError;
      const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
      const roster: StudentRow[] = allStudents
        .filter((student) => peopleById.has(student.person_id))
        .map((student) => ({
          ...student,
          ...peopleById.get(student.person_id)!,
        })) as StudentRow[];

      const { data: attendanceRows, error: attendanceError } = await client
        .from("student_attendance")
        .select("id,student_id,status,remarks")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("academic_session_id", sessionId)
        .eq("attendance_date", date);
      if (attendanceError) throw attendanceError;

      const records = (attendanceRows ?? []) as AttendanceRow[];
      const statusMap: Record<string, AttendanceStatus> = {};
      const remarksMap: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      records.forEach((record) => {
        if (statusOptions.includes(record.status as AttendanceStatus)) {
          statusMap[record.student_id] = record.status as AttendanceStatus;
        }
        remarksMap[record.student_id] = record.remarks ?? "";
        idMap[record.student_id] = record.id;
      });
      roster.forEach((student) => {
        if (!statusMap[student.id]) statusMap[student.id] = "present";
      });
      setStudents(roster);
      setStatuses(statusMap);
      setRemarks(remarksMap);
      setExistingIds(idMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the attendance register.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, sessionId, date]);

  useEffect(() => { void loadSetup(); }, [loadSetup]);
  useEffect(() => { void loadRegister(); }, [loadRegister]);

  const totals = useMemo(() => statusOptions.reduce((result, status) => {
    result[status] = Object.values(statuses).filter((value) => value === status).length;
    return result;
  }, {} as Record<AttendanceStatus, number>), [statuses]);

  async function saveRegister() {
    if (!classId || !sessionId || !date) {
      setError("Select a class, academic session and date before saving.");
      return;
    }
    if (!students.length) {
      setError("There are no active students in the register to save.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const client = getSupabaseClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session has expired. Sign in again.");

      for (const student of students) {
        const record = {
          school_id: schoolId,
          student_id: student.id,
          academic_session_id: sessionId,
          class_id: classId,
          attendance_date: date,
          status: statuses[student.id] ?? "present",
          remarks: remarks[student.id]?.trim() || null,
        };
        const recordId = existingIds[student.id];
        const result = recordId
          ? await client.from("student_attendance").update(record).eq("id", recordId).eq("school_id", schoolId)
          : await client.from("student_attendance").insert(record);
        if (result.error) {
          throw new Error(`Could not save ${fullName(student)}: ${result.error.message}`);
        }
      }
      setNotice(`Attendance saved for ${students.length} students on ${date}.`);
      await loadRegister();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attendance could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600";
  const selectedClass = classes.find((item) => item.id === classId);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-green-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/10 p-3"><CalendarCheck className="h-6 w-6" /></span>
            <div><p className="text-xs font-bold uppercase tracking-widest text-green-100">RESA School Portal</p><h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Student Attendance</h1></div>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold">Attendance register</h2><p className="mt-1 text-sm text-slate-600">Record and review attendance by class, academic session and date.</p></div>
            <button type="button" onClick={() => void loadRegister()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">Class<select className={`mt-1 block ${fieldClass}`} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.level ? ` · ${item.level}` : ""}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Academic session<select className={`mt-1 block ${fieldClass}`} value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Choose session</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? " (Current)" : ""}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Attendance date<input className={`mt-1 block ${fieldClass}`} type="date" value={date} max={todayInLagos()} onChange={(event) => setDate(event.target.value)} /></label>
          </div>
          {(!classes.length || !sessions.length) && !loading && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Create at least one class and one academic session before recording attendance.</p>}
        </section>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statusOptions.map((status) => <div key={status} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">{labelStatus(status)}</p><p className="mt-1 text-2xl font-extrabold">{totals[status]}</p></div>)}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
            <div><h2 className="font-bold">{selectedClass?.name ?? "Class register"}</h2><p className="mt-1 text-sm text-slate-600">{students.length} active student{students.length === 1 ? "" : "s"}</p></div>
            <button type="button" onClick={() => void saveRegister()} disabled={saving || loading || !students.length || !sessionId} className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save attendance"}</button>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading attendance register…</p> : !students.length ? <p className="p-8 text-center text-sm text-slate-500">No active student records were found. Add students first or check the selected school.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Admission No.</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Attendance status</th><th className="px-4 py-3">Remarks (optional)</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-medium">{student.admission_number}</td><td className="px-4 py-3 font-semibold">{fullName(student)}</td><td className="px-4 py-3"><select aria-label={`Attendance status for ${fullName(student)}`} className={`max-w-44 ${fieldClass}`} value={statuses[student.id] ?? "present"} onChange={(event) => setStatuses((previous) => ({ ...previous, [student.id]: event.target.value as AttendanceStatus }))}>{statusOptions.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select></td><td className="px-4 py-3"><input aria-label={`Remarks for ${fullName(student)}`} className={`min-w-52 ${fieldClass}`} value={remarks[student.id] ?? ""} onChange={(event) => setRemarks((previous) => ({ ...previous, [student.id]: event.target.value }))} placeholder="Add a note" maxLength={500} /></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><Check className="h-4 w-4" /> Attendance is saved to the school's existing Supabase attendance records.</div>
        </section>
      </div>
    </main>
  );
}
