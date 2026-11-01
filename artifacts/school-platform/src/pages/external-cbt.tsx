import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Exam = { id: string; title: string; instructions: string | null; duration_minutes: number | null; total_marks: number; attempts_remaining: number; attempts_used: number; max_attempts: number; is_open: boolean; active_attempt: { attempt_number: number } | null; result: { score: number; total_marks: number } | null };
type Question = { id: string; question_text: string; question_type: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; marks: number };
type Attempt = { id: string; attempt_number: number; started_at: string; ends_at: string };
type Candidate = { candidate_number: string; full_name: string; status: string };

export default function ExternalCbtPage({ onSignOut }: { onSignOut: () => void }) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeExam, setActiveExam] = useState<{ id: string; title: string; instructions: string | null; total_marks: number } | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [submitted, setSubmitted] = useState(false);
  const autoSubmitAttemptId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-external-cbt", { body: { action: "list" } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setCandidate(data?.candidate ?? null);
      setExams(Array.isArray(data?.exams) ? data.exams : []);
      setNotice(data?.message ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your candidate portal."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!attempt || submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt, submitted]);

  const remainingSeconds = useMemo(() => attempt ? Math.max(0, Math.ceil((new Date(attempt.ends_at).getTime() - now) / 1000)) : 0, [attempt, now]);
  const clock = `${String(Math.floor(remainingSeconds / 60)).padStart(2,"0")}:${String(remainingSeconds % 60).padStart(2,"0")}`;

  const submitAttempt = useCallback(async (automatic = false) => {
    if (!attempt || busy || submitted) return;
    setBusy(true); setError("");
    try {
      const payload = Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }));
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-external-cbt", {
        body: { action: "submit", attempt_id: attempt.id, answers: payload },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true); setNotice(data?.message || (automatic ? "Time expired. Your attempt has been submitted." : "Your examination has been submitted."));
      setActiveExam(null); setAttempt(null); setQuestions([]); setAnswers({});
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Submission failed. Your answers have been retained; try again."); }
    finally { setBusy(false); }
  }, [attempt, answers, busy, submitted, load]);

  useEffect(() => {
    if (attempt && remainingSeconds === 0 && !busy && !submitted && autoSubmitAttemptId.current !== attempt.id) {
      autoSubmitAttemptId.current = attempt.id;
      void submitAttempt(true);
    }
  }, [attempt, remainingSeconds, busy, submitted, submitAttempt]);

  useEffect(() => {
    if (!attempt || submitted || Object.keys(answers).length === 0) return;
    const timer = window.setTimeout(async () => {
      const { error: saveError } = await getSupabaseClient().functions.invoke("resa-external-cbt", {
        body: { action: "save", attempt_id: attempt.id, answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })) },
      });
      if (saveError) setError("Your latest answer could not be saved yet. Keep this page open and retry before submitting.");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [attempt, answers, submitted]);

  async function startExam(examId: string) {
    setBusy(true); setError(""); setNotice(""); setSubmitted(false);
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-external-cbt", { body: { action: "start", exam_id: examId } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setActiveExam(data.exam); setAttempt(data.attempt); setQuestions(data.questions ?? []); setAnswers({}); autoSubmitAttemptId.current = null; setNow(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : "The examination could not be started."); }
    finally { setBusy(false); }
  }

  if (attempt && activeExam) {
    return <main className="min-h-screen bg-stone-50 px-4 py-6 text-slate-900"><div className="mx-auto max-w-4xl">
      <header className="sticky top-0 z-10 mb-5 rounded-2xl bg-emerald-950 p-4 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA External CBT</p><h1 className="text-xl font-extrabold">{activeExam.title}</h1><p className="text-xs text-emerald-100">Attempt {attempt.attempt_number} · {candidate?.candidate_number}</p></div><div className="rounded-xl bg-white/10 px-4 py-2 text-center"><p className="text-xs text-emerald-100">Time remaining</p><p className="flex items-center gap-2 text-2xl font-extrabold tabular-nums"><Clock3 size={20}/>{clock}</p></div></div></header>
      {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {activeExam.instructions&&<section className="mb-4 rounded-xl border bg-white p-4 text-sm leading-6"><h2 className="font-bold">Instructions</h2><p className="mt-1 whitespace-pre-wrap">{activeExam.instructions}</p></section>}
      <div className="space-y-4">{questions.map((q,index)=>{const isChoice=["multiple_choice","mcq","objective"].includes(q.question_type.toLowerCase());return <section key={q.id} className="rounded-2xl border bg-white p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><h2 className="font-bold leading-6">{index+1}. {q.question_text}</h2><span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900">{q.marks} mark{Number(q.marks)===1?"":"s"}</span></div>{isChoice?<div className="mt-4 grid gap-2">{(["A","B","C","D"] as const).map((letter)=>{const option=q[`option_${letter.toLowerCase()}` as "option_a"|"option_b"|"option_c"|"option_d"];if(!option)return null;return <label key={letter} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${answers[q.id]===letter?"border-emerald-700 bg-emerald-50":""}`}><input type="radio" name={q.id} value={letter} checked={answers[q.id]===letter} onChange={()=>setAnswers(current=>({...current,[q.id]:letter}))} className="mt-1"/><span><strong>{letter}.</strong> {option}</span></label>})}</div>:<textarea rows={4} maxLength={5000} value={answers[q.id]??""} onChange={e=>setAnswers(current=>({...current,[q.id]:e.target.value}))} className="mt-4 w-full rounded-xl border p-3" placeholder="Type your answer here…"/>}</section>})}</div>
      <div className="mt-5 flex flex-wrap justify-between gap-3 rounded-2xl border bg-white p-4"><p className="self-center text-sm text-slate-600">{Object.values(answers).filter(Boolean).length} of {questions.length} questions answered</p><button disabled={busy} onClick={()=>{if(window.confirm("Submit this examination now? You cannot change your answers afterwards."))void submitAttempt(false)}} className="rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?"Submitting…":"Submit examination"}</button></div>
    </div></main>;
  }

  return <main className="min-h-screen bg-stone-50 px-4 py-6 text-slate-900"><div className="mx-auto max-w-5xl">
    <header className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · External Candidate Portal</p><h1 className="mt-2 text-2xl font-extrabold">External CBT Examinations</h1><p className="mt-2 text-sm text-emerald-100">{candidate?.full_name} · {candidate?.candidate_number}</p></div><button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold"><LogOut size={16}/> Sign out</button></div></header>
    {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {notice&&<div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
    {loading?<div className="mt-5 rounded-2xl border bg-white p-8 text-center"><RefreshCw className="mx-auto animate-spin"/>Loading your examinations…</div>:candidate?.status!=="approved"?<section className="mt-5 rounded-2xl border bg-white p-6"><ShieldCheck className="text-emerald-800" size={34}/><h2 className="mt-3 text-xl font-extrabold">Registration status: {candidate?.status?.replaceAll("_"," ")}</h2><p className="mt-2 text-sm leading-6 text-slate-600">You can sign in while your registration is being reviewed. Examination access will become available after the school approves your candidate record and assigns an exam.</p><button onClick={()=>void load()} className="mt-4 rounded-lg border px-4 py-2 text-sm font-bold">Refresh status</button></section>:<section className="mt-5 space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Your assigned examinations</h2><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> Refresh</button></div>{exams.map(exam=><article key={exam.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{exam.title}</h3><p className="mt-1 text-sm text-slate-600">{exam.duration_minutes??60} minutes · {exam.total_marks} marks · {exam.attempts_remaining} attempt(s) remaining</p>{exam.instructions&&<p className="mt-2 text-sm text-slate-500">{exam.instructions}</p>}{exam.result&&<p className="mt-2 text-sm font-bold text-emerald-800">Published result: {exam.result.score} / {exam.result.total_marks}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-bold ${exam.is_open?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-800"}`}>{exam.is_open?"Available":"Outside exam window"}</span></div><button disabled={busy||!exam.is_open||exam.attempts_remaining<=0} onClick={()=>void startExam(exam.id)} className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{exam.active_attempt?"Resume examination":"Start examination"}</button></article>)}{exams.length===0&&<div className="rounded-2xl border border-dashed bg-white p-8 text-center"><CheckCircle2 className="mx-auto text-slate-400" size={32}/><p className="mt-3 font-bold">No examination assigned yet</p><p className="mt-1 text-sm text-slate-500">The school will publish your assigned examination here.</p></div>}</section>}
    <footer className="py-6 text-center text-xs text-slate-500">Secure external assessment area · Designed & Powered by JETAB TECH · <Link href="/portal" className="font-bold text-emerald-900">RESA portal</Link></footer>
  </div></main>;
}
