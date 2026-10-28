import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type StaffOption = { id: string; staff_number: string | null; person_id: string; name: string };
type ClassOption = { id: string; name: string; level: string | null };
type SubjectOption = { id: string; name: string; code: string | null };
type SessionOption = { id: string; name: string; is_current: boolean };
type TeachingRow = { id: string; staff_id: string; class_id: string; subject_id: string; academic_session_id: string; staffName: string; staffNumber: string | null; className: string; subjectName: string; sessionName: string };

export default function TeachingAssignmentsPage({ schoolId }: { schoolId: string }) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [classSubjects, setClassSubjects] = useState<{ class_id: string; subject_id: string }[]>([]);
  const [rows, setRows] = useState<TeachingRow[]>([]);
  const [form, setForm] = useState({ staff_id: "", class_id: "", subject_id: "", academic_session_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [staffResult, classResult, subjectResult, classSubjectResult, sessionResult, assignmentResult, settingsResult] = await Promise.all([
        db.from("staff").select("id,staff_number,person_id,status").eq("school_id", schoolId).order("created_at", { ascending: false }),
        db.from("school_classes").select("id,name,level").eq("school_id", schoolId).order("name"),
        db.from("subjects").select("id,name,code").eq("school_id", schoolId).order("name"),
        db.from("class_subjects").select("class_id,subject_id").eq("school_id", schoolId),
        db.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("start_date", { ascending: false }),
        db.from("teacher_assignments").select("id,staff_id,class_id,subject_id,academic_session_id").eq("school_id", schoolId),
        db.from("school_settings").select("current_academic_session_id").eq("school_id", schoolId).maybeSingle(),
      ]);
      for (const result of [staffResult, classResult, subjectResult, classSubjectResult, sessionResult, assignmentResult, settingsResult]) {
        if (result.error) throw result.error;
      }
      const peopleIds = [...new Set((staffResult.data ?? []).map((item: any) => item.person_id).filter(Boolean))];
      let people = new Map<string, string>();
      if (peopleIds.length) {
        const peopleResult = await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", peopleIds);
        if (peopleResult.error) throw peopleResult.error;
        people = new Map((peopleResult.data ?? []).map((person: any) => [person.id, [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")]));
      }
      const staffRows: StaffOption[] = (staffResult.data ?? []).map((item: any) => ({
        id: item.id, staff_number: item.staff_number, person_id: item.person_id,
        name: people.get(item.person_id) || item.staff_number || "Staff member",
      }));
      const classRows = (classResult.data ?? []) as ClassOption[];
      const subjectRows = (subjectResult.data ?? []) as SubjectOption[];
      const classSubjectRows = (classSubjectResult.data ?? []) as { class_id: string; subject_id: string }[];
      const sessionRows = (sessionResult.data ?? []) as SessionOption[];
      const assignmentRows = assignmentResult.data ?? [];
      const staffById = new Map(staffRows.map((item) => [item.id, item]));
      const classById = new Map(classRows.map((item) => [item.id, item]));
      const subjectById = new Map(subjectRows.map((item) => [item.id, item]));
      const sessionById = new Map(sessionRows.map((item) => [item.id, item]));
      setStaff(staffRows);
      setClasses(classRows);
      setSubjects(subjectRows);
      setClassSubjects(classSubjectRows);
      setSessions(sessionRows);
      setRows(assignmentRows.map((item: any) => {
        const member = staffById.get(item.staff_id);
        return {
          ...item, staffName: member?.name ?? "Staff record unavailable",
          staffNumber: member?.staff_number ?? null,
          className: classById.get(item.class_id)?.name ?? "Class unavailable",
          subjectName: subjectById.get(item.subject_id)?.name ?? "Subject unavailable",
          sessionName: sessionById.get(item.academic_session_id)?.name ?? "Session unavailable",
        } as TeachingRow;
      }).sort((a: TeachingRow, b: TeachingRow) => a.staffName.localeCompare(b.staffName)));
      const preferredSession = settingsResult.data?.current_academic_session_id || sessionRows.find((item) => item.is_current)?.id || sessionRows[0]?.id || "";
      setForm((previous) => ({
        ...previous,
        staff_id: staffRows.some((item) => item.id === previous.staff_id) ? previous.staff_id : staffRows[0]?.id || "",
        class_id: classRows.some((item) => item.id === previous.class_id) ? previous.class_id : classRows[0]?.id || "",
        academic_session_id: sessionRows.some((item) => item.id === previous.academic_session_id) ? previous.academic_session_id : preferredSession,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Teaching assignments could not be loaded.");
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const allowedSubjects = subjects.filter((subject) => classSubjects.some((item) => item.class_id === form.class_id && item.subject_id === subject.id));

  useEffect(() => {
    if (allowedSubjects.some((item) => item.id === form.subject_id)) return;
    setForm((previous) => ({ ...previous, subject_id: allowedSubjects[0]?.id || "" }));
  }, [form.class_id, form.subject_id, classSubjects, subjects]);

  async function create(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!form.staff_id || !form.class_id || !form.subject_id || !form.academic_session_id) {
      setError("Select a staff member, class, subject, and academic session."); return;
    }
    if (!classSubjects.some((item) => item.class_id === form.class_id && item.subject_id === form.subject_id)) {
      setError("That subject is not assigned to the selected class. Update Subject Management first."); return;
    }
    if (rows.some((item) => item.staff_id === form.staff_id && item.class_id === form.class_id && item.subject_id === form.subject_id && item.academic_session_id === form.academic_session_id)) {
      setError("This teacher already has this class and subject assignment for the selected session."); return;
    }
    setSaving(true);
    try {
      const db = getSupabaseClient() as any;
      const { error: insertError } = await db.from("teacher_assignments").insert({
        school_id: schoolId, staff_id: form.staff_id, class_id: form.class_id,
        subject_id: form.subject_id, academic_session_id: form.academic_session_id,
      });
      if (insertError) throw insertError;
      setNotice("Teaching assignment saved. The teacher's dashboard will use this class and subject.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The teaching assignment could not be saved.");
    } finally { setSaving(false); }
  }

  async function remove(row: TeachingRow) {
    if (!window.confirm(`Remove ${row.staffName}'s ${row.className} / ${row.subjectName} assignment for ${row.sessionName}?`)) return;
    setRemoving(row.id); setError(""); setNotice("");
    try {
      const { error: deleteError } = await (getSupabaseClient() as any).from("teacher_assignments")
        .delete().eq("school_id", schoolId).eq("id", row.id);
      if (deleteError) throw deleteError;
      setNotice("Teaching assignment removed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The teaching assignment could not be removed.");
    } finally { setRemoving(null); }
  }

  const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3 text-amber-200"><Users size={24}/></span><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">RESA School Portal</p><h1 className="text-2xl font-extrabold">Teaching Assignments</h1></div></div>
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm"><ArrowLeft size={16}/> Dashboard</Link>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold">Assign teachers to classes and subjects</h2><p className="mt-1 text-sm leading-6 text-slate-600">A teacher can only create assignments and CBT exams for class/subject pairs assigned here. First make sure the subject is assigned to the class in Subject Management.</p>
        {error && <p role="alert" className="mt-4 break-words rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mr-1 inline" size={16}/>{notice}</p>}
        <form onSubmit={(event) => void create(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Teacher / staff member<select required className={field} value={form.staff_id} onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value }))}><option value="">Choose staff member</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}{item.staff_number ? ` · ${item.staff_number}` : ""}</option>)}</select></label>
          <label className="text-sm font-semibold">Academic session<select required className={field} value={form.academic_session_id} onChange={(e) => setForm((p) => ({ ...p, academic_session_id: e.target.value }))}><option value="">Choose session</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? " · Current" : ""}</option>)}</select></label>
          <label className="text-sm font-semibold">Class<select required className={field} value={form.class_id} onChange={(e) => setForm((p) => ({ ...p, class_id: e.target.value, subject_id: "" }))}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Subject assigned to this class<select required className={field} value={form.subject_id} onChange={(e) => setForm((p) => ({ ...p, subject_id: e.target.value }))}><option value="">Choose subject</option>{allowedSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{form.class_id && !allowedSubjects.length && <span className="mt-1 block text-xs font-normal text-amber-800">No subjects are assigned to this class yet. Open Subject Management first.</span>}</label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh records</button><button disabled={saving || loading || !allowedSubjects.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} {saving ? "Saving…" : "Assign teacher"}</button></div>
        </form>
      </section>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Current teaching assignments</h2><p className="mt-1 text-sm text-slate-600">{rows.length} assignment(s) found</p></div>
        {loading ? <p className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 size={18} className="animate-spin"/> Loading teaching assignments…</p> : !rows.length ? <p className="p-8 text-center text-sm text-slate-500">No teaching assignments exist yet. Use the form above to assign a teacher.</p> : <div className="divide-y">{rows.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div className="min-w-0"><h3 className="font-bold">{row.staffName}{row.staffNumber ? <span className="ml-2 text-xs font-medium text-slate-500">{row.staffNumber}</span> : null}</h3><p className="mt-1 text-sm text-slate-700">{row.className} · {row.subjectName}</p><p className="mt-1 text-xs text-slate-500">Session: {row.sessionName}</p></div><button type="button" onClick={() => void remove(row)} disabled={removing === row.id} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><Trash2 size={15}/>{removing === row.id ? "Removing…" : "Remove"}</button></article>)}</div>}
      </section>
      <p className="pb-4 text-center text-xs text-slate-500">Teaching assignments control which class and subject pairs are available in the teacher workspace.</p>
    </div>
  </main>;
}
