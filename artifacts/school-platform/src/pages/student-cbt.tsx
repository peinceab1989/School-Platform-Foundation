import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Clock3, RefreshCw, Send } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Exam = {
  id: string; title: string; instructions: string | null; duration_minutes: number | null;
  total_marks: number; start_at: string | null; end_at: string | null; subject_name: string;
  class_id?: string; class_name?: string;
  attempt_id: string | null; attempt_status: string | null; score: number | null;
};
type Question = {
  id: string; question_text: string; question_type: string; option_a: string | null;
  option_b: string | null; option_c: string | null; option_d: string | null; marks: number;
  sort_order: number;
};
type ActiveExam = {
  exam: { id: string; title: string; instructions: string | null; duration_minutes: number | null; total_marks: number };
  attempt: { id: string; started_at: string; deadline: string; status: string };
  questions: Question[];
};

export default function StudentCbtPage({ schoolId }: { schoolId: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [active, setActive] = useState<ActiveExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<{score:number;total_marks:number;manual_marking_required:boolean;message:string}|null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const cacheKey = "resa-cbt-active-attempt-v1";

  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-student-cbt", { body: { action: "list" } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      const listed = (data?.exams ?? []) as Exam[];
      const classIds = [...new Set(listed.map((exam) => exam.class_id).filter((id): id is string => Boolean(id)))];
      if (classIds.length) {
        const { data: classRows, error: classError } = await getSupabaseClient()
          .from("school_classes").select("id,name").eq("school_id", schoolId).in("id", classIds);
        if (classError) throw classError;
        const classNames = new Map((classRows ?? []).map((row) => [row.id, row.name]));
        setExams(listed.map((exam) => ({ ...exam, class_name: exam.class_id ? classNames.get(exam.class_id) ?? "Class unavailable" : "Class not provided by exam service" })));
      } else {
        setExams(listed.map((exam) => ({ ...exam, class_name: "Class not provided by exam service" })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load available examinations.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    try {
      const saved = window.localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { active?: ActiveExam; answers?: Record<string, string> };
        if (parsed.active?.attempt?.id && Array.isArray(parsed.active.questions)) {
          setActive(parsed.active);
          setAnswers(parsed.answers ?? {});
          setNotice("Restored your saved examination and answers from this device.");
          setOfflineSaved(true);
        } else {
          window.localStorage.removeItem(cacheKey);
        }
      }
    } catch {
      setNotice("This browser could not restore the locally saved examination.");
    }
    void load();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [load]);

  useEffect(() => {
    if (!active) return;
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify({ active, answers, savedAt: new Date().toISOString() }));
      setOfflineSaved(true);
    } catch {
      setOfflineSaved(false);
    }
  }, [active, answers]);

  useEffect(() => {
    if (!active) { setRemaining(null); return; }
    const update = () => setRemaining(Math.max(0, Math.floor((new Date(active.attempt.deadline).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const start = async (examId: string) => {
    setBusy(true); setError(""); setNotice(""); setResult(null);
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-student-cbt", { body: { action: "start", exam_id: examId } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setActive(data as ActiveExam);
      setAnswers({});
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify({ active: data as ActiveExam, answers: {}, savedAt: new Date().toISOString() }));
        setOfflineSaved(true);
      } catch { setOfflineSaved(false); }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start this examination.");
      await load();
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!active || busy) return;
    if (!navigator.onLine) {
      setError("You are offline. Your answers are saved on this device, but official submission requires an internet connection. Reconnect and submit again.");
      return;
    }
    if (!window.confirm("Submit this examination now? You cannot change your answers after submission.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = active.questions.map(q => ({ question_id: q.id, answer_text: answers[q.id] ?? "" }));
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-student-cbt", {
        body: { action: "submit", attempt_id: active.attempt.id, answers: payload },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setResult(data); setNotice(data.message || "Your examination was submitted.");
      setActive(null); setAnswers({});
      try { window.localStorage.removeItem(cacheKey); } catch { /* local storage may be unavailable */ }
      setOfflineSaved(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Your answers remain on this screen; please retry.");
    } finally { setBusy(false); }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-green-900 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5">
      <div className="flex items-center gap-3"><BookOpen/><div><p className="text-xs uppercase tracking-widest">RESA School Portal</p><h1 className="text-xl font-bold sm:text-2xl">Student CBT</h1></div></div>
      <Link href="/student-dashboard" className="flex shrink-0 items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm"><ArrowLeft size={16}/> Dashboard</Link>
    </div></header>
    <div className="mx-auto max-w-5xl px-4 py-7">
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${isOnline ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
        <span className="font-semibold">{isOnline ? "Internet connected" : "Offline mode — working from this device"}</span>
        <span>{active ? (offlineSaved ? "Answers saved locally on this device" : "Local saving unavailable") : "Open an exam while online to cache it for offline answer recovery"}</span>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
      {result && <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">Submission receipt</h2><p className="mt-2">Automatically graded score: <strong>{result.score} marks</strong> out of {result.total_marks} total marks.</p>{result.manual_marking_required && <p className="mt-2 text-sm text-amber-800">Written answers require teacher marking. This is not yet your final score.</p>}</section>}
      {active ? <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wide text-green-800">{active.exam.total_marks} marks</p><h2 className="mt-1 text-xl font-bold">{active.exam.title}</h2>{active.exam.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{active.exam.instructions}</p>}</div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 font-bold tabular-nums ${remaining !== null && remaining < 60 ? "bg-red-100 text-red-800" : "bg-green-50 text-green-900"}`}><Clock3 size={18}/>{remaining === null ? "--:--" : formatTime(remaining)}</div></div>
        <div className="my-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="text-slate-600">Answer every question you can. The timer is based on the server-recorded start time.</p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOnline ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{isOnline ? "Online" : "Offline · answers saved locally"}</span>
          {offlineSaved && <span className="text-xs font-semibold text-emerald-800">Draft saved on this device</span>}
        </div>
        <div className="space-y-5">{active.questions.map((q,index) => <fieldset key={q.id} className="rounded-xl border p-4"><legend className="px-1 text-sm font-bold">Question {index+1} · {q.marks} mark(s)</legend><p className="mb-3 whitespace-pre-wrap">{q.question_text}</p>
          {q.question_type === "multiple_choice" ? <div className="space-y-2">{([{key:"A",value:q.option_a},{key:"B",value:q.option_b},{key:"C",value:q.option_c},{key:"D",value:q.option_d}] as const).map(option => option.value !== null && <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-slate-50"><input type="radio" name={q.id} value={option.key} checked={(answers[q.id] ?? "")===option.key} onChange={()=>setAnswers(p=>({...p,[q.id]:option.key}))} className="mt-1"/><span><strong>{option.key}.</strong> {option.value}</span></label>)}</div> : <textarea rows={3} maxLength={10000} className="w-full rounded-lg border p-3 text-sm" value={answers[q.id] ?? ""} onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))} placeholder="Type your answer here"/>}
        </fieldset>)}</div>
        {!active.questions.length && <p className="rounded-lg bg-amber-50 p-4 text-sm">No questions are attached to this exam. Contact your teacher before submitting.</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-slate-600">{Object.values(answers).filter(v=>v.trim()).length} answer(s) entered</p><button type="button" disabled={busy} onClick={()=>void submit()} className="flex items-center gap-2 rounded-lg bg-green-800 px-5 py-3 font-bold text-white disabled:opacity-50"><Send size={16}/>{busy?"Submitting…":"Submit examination"}</button></div>
      </section> : <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Available examinations</h2><p className="text-sm text-slate-600">Only published exams scheduled for your currently enrolled class are shown.</p></div><button onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></div>
        {loading ? <p className="rounded-xl border bg-white p-8 text-center text-slate-500">Loading available examinations…</p> : !exams.length ? <p className="rounded-xl border bg-white p-8 text-center text-slate-600">No examinations are currently available for your class and session.</p> : <div className="grid gap-4 md:grid-cols-2">{exams.map(exam=><article key={exam.id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-green-800">{exam.subject_name || "Subject unavailable"}</p><p className="mt-1 text-xs font-semibold text-slate-500">{exam.class_name || "Class unavailable"}</p><h3 className="mt-1 text-lg font-bold">{exam.title}</h3></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{exam.total_marks} marks</span></div>{exam.instructions && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{exam.instructions}</p>}<p className="mt-3 text-sm text-slate-600">Duration: {exam.duration_minutes ?? 30} minutes</p>
          {exam.attempt_status === "submitted" ? <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-900">Submitted. Auto-graded score: {exam.score ?? 0} marks. {exam.attempt_id ? "" : ""}</div> : <button disabled={busy} onClick={()=>void start(exam.id)} className="mt-4 w-full rounded-lg bg-green-800 px-4 py-3 font-bold text-white disabled:opacity-50">{exam.attempt_status === "in_progress" ? "Resume examination" : "Start examination"}</button>}
        </article>)}</div>}</>}
    </div>
  </main>;
}
