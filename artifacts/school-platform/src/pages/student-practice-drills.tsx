import { useMemo, useState } from "react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ArrowLeft, BookOpenCheck, CheckCircle2, RotateCcw, ExternalLink, Trophy, Sparkles, LoaderCircle } from "lucide-react";

type DrillQuestion = {
  id: string;
  level: string;
  subject: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  source: string;
};

const bank: DrillQuestion[] = [
  { id: "pri-math-1", level: "Primary / Common Entrance", subject: "Mathematics", prompt: "What is 3/4 of 20?", options: ["5", "10", "15", "16"], answer: 2, explanation: "20 ÷ 4 = 5, and 5 × 3 = 15.", source: "RESA starter practice bank" },
  { id: "pri-eng-1", level: "Primary / Common Entrance", subject: "English", prompt: "Choose the word closest in meaning to “rapid”.", options: ["Slow", "Quick", "Quiet", "Weak"], answer: 1, explanation: "Rapid means fast or quick.", source: "RESA starter practice bank" },
  { id: "jss-sci-1", level: "JSS / BECE", subject: "Basic Science", prompt: "Which organ pumps blood around the human body?", options: ["Lung", "Kidney", "Heart", "Liver"], answer: 2, explanation: "The heart pumps blood through the circulatory system.", source: "RESA starter practice bank" },
  { id: "jss-math-1", level: "JSS / BECE", subject: "Mathematics", prompt: "Solve: 2x + 6 = 16.", options: ["x = 3", "x = 4", "x = 5", "x = 11"], answer: 2, explanation: "Subtract 6 to get 2x = 10, then divide by 2.", source: "RESA starter practice bank" },
  { id: "ss-bio-1", level: "SS / WAEC-NECO-JAMB practice", subject: "Biology", prompt: "The basic structural and functional unit of life is the:", options: ["Tissue", "Organ", "Cell", "System"], answer: 2, explanation: "The cell is the basic unit of living organisms.", source: "RESA starter practice bank" },
  { id: "ss-eng-1", level: "SS / WAEC-NECO-JAMB practice", subject: "English", prompt: "Choose the correct sentence.", options: ["She have finished.", "She has finished.", "She having finished.", "She finish yesterday."], answer: 1, explanation: "“She has finished” uses the correct subject–verb form.", source: "RESA starter practice bank" },
  { id: "ss-math-1", level: "SS / WAEC-NECO-JAMB practice", subject: "Mathematics", prompt: "If f(x) = 2x², what is f(3)?", options: ["6", "12", "18", "36"], answer: 2, explanation: "f(3) = 2 × 3² = 2 × 9 = 18.", source: "RESA starter practice bank" },
  { id: "ss-phy-1", level: "SS / WAEC-NECO-JAMB practice", subject: "Physics", prompt: "The SI unit of force is the:", options: ["Joule", "Watt", "Newton", "Pascal"], answer: 2, explanation: "Force is measured in newtons (N).", source: "RESA starter practice bank" },
];

const countOptions = [5, 10, 20, 30];

export default function StudentPracticeDrillsPage() {
  const levels = useMemo(() => ["All levels", ...Array.from(new Set(bank.map(q => q.level)))], []);
  const subjects = useMemo(() => ["All subjects", ...Array.from(new Set(bank.map(q => q.subject)))], []);
  const [level, setLevel] = useState("All levels");
  const [subject, setSubject] = useState("All subjects");
  const [requestedCount, setRequestedCount] = useState("5");
  const [questions, setQuestions] = useState<DrillQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const available = useMemo(
    () => bank.filter(q => (level === "All levels" || q.level === level) && (subject === "All subjects" || q.subject === subject)),
    [level, subject],
  );
  const question = questions[index];
  const score = questions.reduce((total, q) => total + (picked[q.id] === q.answer ? 1 : 0), 0);
  const answered = questions.filter(q => picked[q.id] !== undefined).length;

  const startDrill = () => {
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const count = requestedCount === "all" ? shuffled.length : Math.min(Number(requestedCount), shuffled.length);
    setQuestions(shuffled.slice(0, count));
    setAiGenerated(false);
    setPicked({});
    setIndex(0);
    setSubmitted(false);
    setStarted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setQuestions([]);
    setAiGenerated(false);
    setPicked({});
    setIndex(0);
    setSubmitted(false);
    setStarted(false);
  };

  const generateAiDrill = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const count = requestedCount === "all" ? 10 : Math.min(30, Math.max(1, Number(requestedCount) || 5));
      const { data, error } = await getSupabaseClient().functions.invoke("resa-ai-practice", {
        body: { level, subject, count, topic: aiTopic.trim() },
      });
      if (error) throw new Error(error.message || "The AI question service could not be reached.");
      const rawQuestions = data?.questions;
      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error(data?.error || "The AI service returned no questions. Please try again.");
      }
      const generated: DrillQuestion[] = rawQuestions.map((q: any, i: number) => {
        const options = Array.isArray(q.options) ? q.options.map((option: unknown) => String(option)) : [];
        const answer = Number(q.answer);
        if (!q.prompt || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
          throw new Error("The AI returned a question in an unexpected format. Please generate another set.");
        }
        return {
          id: `ai-${Date.now()}-${i}`,
          level: String(q.level || level),
          subject: String(q.subject || subject),
          prompt: String(q.prompt),
          options,
          answer,
          explanation: String(q.explanation || "Review this answer with your teacher if you are unsure."),
          source: "AI-generated original practice question — review for accuracy",
        };
      });
      setQuestions(generated);
      setAiGenerated(true);
      setPicked({});
      setIndex(0);
      setSubmitted(false);
      setStarted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI question generation failed. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  return <main className="min-h-screen bg-[#f5f7f2] text-slate-900">
    <header className="bg-gradient-to-br from-emerald-950 to-emerald-700 text-white"><div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/portal-options" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-50 hover:text-amber-200"><ArrowLeft size={16}/> Portal & Services</Link>
      <div className="mt-5 flex items-center gap-3"><span className="rounded-2xl bg-white/10 p-3 text-amber-200"><BookOpenCheck size={28}/></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA learning hub</p><h1 className="text-2xl font-extrabold sm:text-3xl">Test Drilling & Practice</h1></div></div>
      <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50">An optional practice area for any level. Choose a subject and how many questions you want to try. Practice is separate from official examinations and does not affect school grades.</p>
    </div></header>
    <section className="mx-auto max-w-3xl px-4 py-7">
      {!started && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold">Build your practice drill</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Select any available level, subject and question count. The count automatically adjusts when fewer questions are available for your selection.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-bold">Class / exam level
            <select value={level} onChange={e=>setLevel(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium">{levels.map(v=><option key={v} value={v}>{v}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">Subject
            <select value={subject} onChange={e=>setSubject(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium">{subjects.map(v=><option key={v} value={v}>{v}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold sm:col-span-2">How many questions?
            <select value={requestedCount} onChange={e=>setRequestedCount(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium">
              {countOptions.map(n=><option key={n} value={String(n)}>{n} questions{available.length < n ? ` (up to ${available.length} available)` : ""}</option>)}
              <option value="all">All available ({available.length})</option>
            </select>
          </label>
        </div>
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-900 p-2.5 text-amber-200"><Sparkles size={22}/></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-emerald-950">AI Question Generator</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Generate fresh practice questions with multiple-choice answers and explanations for revision. These are practice materials, not official exam questions or grades.</p>
            </div>
          </div>
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-bold">Topic (optional)
            <input value={aiTopic} onChange={e=>setAiTopic(e.target.value)} placeholder="e.g. fractions, photosynthesis, grammar, algebra" maxLength={120} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/>
          </label>
          <button type="button" onClick={()=>void generateAiDrill()} disabled={aiBusy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3.5 font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
            {aiBusy ? <><LoaderCircle size={18} className="animate-spin"/> Generating questions…</> : <><Sparkles size={18}/> Generate AI practice questions</>}
          </button>
          {aiError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{aiError}</p>}
          <p className="mt-2 text-xs leading-5 text-slate-500">Requires a signed-in RESA account and the school’s AI service configuration. AI-generated answers should be reviewed by a teacher.</p>
        </div>
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><strong>{available.length}</strong> question(s) currently available for this selection. Questions are shuffled for each drill.</div>
        <button type="button" onClick={startDrill} disabled={!available.length} className="mt-5 w-full rounded-xl bg-emerald-900 px-5 py-3.5 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">Start optional practice drill</button>
        <div className="mt-6 border-t pt-5">
          <h3 className="font-bold">Need more practice material?</h3>
          <p className="mt-1 text-sm text-slate-600">These external learning sites provide additional study material. External questions are not automatically imported into this quiz.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a href="https://www.khanacademy.org/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold hover:bg-slate-50">Khan Academy <ExternalLink size={15}/></a>
            <a href="https://www.ck12.org/student/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold hover:bg-slate-50">CK-12 learning <ExternalLink size={15}/></a>
            <a href="https://www.bbc.co.uk/bitesize" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold hover:bg-slate-50">BBC Bitesize <ExternalLink size={15}/></a>
            <a href="https://waec.org/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold hover:bg-slate-50">WAEC official website <ExternalLink size={15}/></a>
          </div>
        </div>
      </div>}

      {started && !submitted && question && <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800"><span className="rounded-full bg-emerald-50 px-3 py-1">{question.subject}</span><span className="rounded-full bg-slate-100 px-3 py-1">{question.level}</span></div>
          <span className="text-sm font-semibold text-slate-500">Question {index+1} of {questions.length}</span>
        </div>
        <h2 className="mt-5 text-lg font-extrabold leading-7 sm:text-xl">{question.prompt}</h2>
        <div className="mt-5 space-y-3">{question.options.map((option,i)=><label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${picked[question.id]===i ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"}`}><input type="radio" name={question.id} checked={picked[question.id]===i} onChange={()=>setPicked(p=>({...p,[question.id]:i}))}/><span className="flex-1 text-sm font-medium">{String.fromCharCode(65+i)}. {option}</span></label>)}</div>
        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
          <button type="button" onClick={()=>setIndex(i=>Math.max(0,i-1))} disabled={index===0} className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40">Previous</button>
          <button type="button" onClick={()=>setIndex(i=>Math.min(questions.length-1,i+1))} disabled={index===questions.length-1} className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40">Next question</button>
          <button type="button" onClick={()=>{setSubmitted(true);window.scrollTo({top:0,behavior:"smooth"});}} className="ml-auto rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white">Submit drill</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">{answered} of {questions.length} answered. You can submit with unanswered questions.</p>
      </article>}

      {started && submitted && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-amber-50 p-3 text-amber-800"><Trophy size={26}/></span><div><p className="text-sm font-semibold text-slate-500">Practice result · not an official grade</p><h2 className="text-2xl font-extrabold">{score} / {questions.length} correct</h2></div></div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{width:`${questions.length ? score / questions.length * 100 : 0}%`}}/></div>
        <p className="mt-2 text-sm text-slate-600">You answered {answered} of {questions.length} questions. Review each answer and explanation below.</p>
        <div className="mt-6 space-y-4">{questions.map((q,i)=><article key={q.id} className="rounded-xl border p-4">
          <div className="flex items-start gap-2"><span className="mt-0.5 text-sm font-bold text-slate-500">{i+1}.</span><div className="min-w-0 flex-1"><p className="font-bold">{q.prompt}</p><p className={`mt-2 text-sm font-semibold ${picked[q.id]===q.answer ? "text-emerald-800" : "text-rose-700"}`}>{picked[q.id]===undefined ? "Not answered" : picked[q.id]===q.answer ? "Correct" : "Your answer: " + q.options[picked[q.id]]}</p><p className="mt-1 text-sm text-slate-700">Correct answer: <strong>{q.options[q.answer]}</strong></p><p className="mt-2 text-sm leading-6 text-slate-600">{q.explanation}</p><p className="mt-2 text-xs text-slate-400">Source: {q.source}</p></div></div>
        </article>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={()=>aiGenerated ? void generateAiDrill() : startDrill()} disabled={aiBusy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><RotateCcw size={16}/> {aiBusy ? "Generating…" : "Try another drill"}</button><button type="button" onClick={reset} className="rounded-xl border px-4 py-3 text-sm font-bold">Change drill settings</button></div>
      </section>}

      <p className="mt-5 text-center text-xs leading-5 text-slate-500">RESA learning hub · Practice is optional and does not affect official results. The built-in bank currently contains starter questions; online resources open separately and are not represented as imported or verified quiz questions.</p>
    </section>
  </main>;
}
