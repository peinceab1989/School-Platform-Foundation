import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpenCheck, CheckCircle2, RotateCcw } from "lucide-react";

type DrillQuestion = { level: string; subject: string; prompt: string; options: string[]; answer: number; explanation: string };
const bank: DrillQuestion[] = [
  { level: "Primary / Common Entrance", subject: "Mathematics", prompt: "What is 3/4 of 20?", options: ["5", "10", "15", "16"], answer: 2, explanation: "20 ÷ 4 = 5, and 5 × 3 = 15." },
  { level: "Primary / Common Entrance", subject: "English", prompt: "Choose the word closest in meaning to “rapid”.", options: ["Slow", "Quick", "Quiet", "Weak"], answer: 1, explanation: "Rapid means fast or quick." },
  { level: "JSS / BECE", subject: "Basic Science", prompt: "Which organ pumps blood around the human body?", options: ["Lung", "Kidney", "Heart", "Liver"], answer: 2, explanation: "The heart pumps blood through the circulatory system." },
  { level: "JSS / BECE", subject: "Mathematics", prompt: "Solve: 2x + 6 = 16.", options: ["x = 3", "x = 4", "x = 5", "x = 11"], answer: 2, explanation: "Subtract 6 to get 2x = 10, then divide by 2." },
  { level: "SS / WAEC-NECO-JAMB practice", subject: "Biology", prompt: "The basic structural and functional unit of life is the:", options: ["Tissue", "Organ", "Cell", "System"], answer: 2, explanation: "The cell is the basic unit of living organisms." },
  { level: "SS / WAEC-NECO-JAMB practice", subject: "English", prompt: "Choose the correct sentence.", options: ["She have finished.", "She has finished.", "She having finished.", "She finish yesterday."], answer: 1, explanation: "“She has finished” uses the correct subject–verb form." },
  { level: "SS / WAEC-NECO-JAMB practice", subject: "Mathematics", prompt: "If f(x) = 2x², what is f(3)?", options: ["6", "12", "18", "36"], answer: 2, explanation: "f(3) = 2 × 3² = 2 × 9 = 18." },
  { level: "SS / WAEC-NECO-JAMB practice", subject: "Physics", prompt: "The SI unit of force is the:", options: ["Joule", "Watt", "Newton", "Pascal"], answer: 2, explanation: "Force is measured in newtons (N)." },
];

export default function StudentPracticeDrillsPage() {
  const levels = ["All levels", ...Array.from(new Set(bank.map(q => q.level)))];
  const [level, setLevel] = useState(levels[0]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const questions = useMemo(() => bank.filter(q => level === "All levels" || q.level === level), [level]);
  const question = questions[Math.min(index, Math.max(0, questions.length - 1))];
  const score = questions.reduce((total, q, i) => total + (picked[i] === q.answer ? 1 : 0), 0);
  const changeLevel = (value: string) => { setLevel(value); setIndex(0); setPicked({}); setChecked(false); };
  const restart = () => { setIndex(0); setPicked({}); setChecked(false); };
  return <main className="min-h-screen bg-[#f5f7f2] text-slate-900">
    <header className="bg-gradient-to-br from-emerald-950 to-emerald-700 text-white"><div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/portal-options" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-50 hover:text-amber-200"><ArrowLeft size={16}/> Portal & Services</Link>
      <div className="mt-5 flex items-center gap-3"><span className="rounded-2xl bg-white/10 p-3 text-amber-200"><BookOpenCheck size={28}/></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA learning hub</p><h1 className="text-2xl font-extrabold sm:text-3xl">Test Drilling & Practice</h1></div></div>
      <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50">Practise questions, check your answers and read explanations. This starter question set runs in your browser and remains usable offline after the page has loaded.</p>
    </div></header>
    <section className="mx-auto max-w-3xl px-4 py-7">
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Practice set notice:</strong> these are starter practice questions, not official past-paper questions. More curriculum-aligned question banks can be added by class, subject, topic and exam year.</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="flex flex-col gap-1 text-sm font-bold">Exam level<select value={level} onChange={e=>changeLevel(e.target.value)} className="min-w-56 rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium">{levels.map(v=><option key={v}>{v}</option>)}</select></label><div className="text-sm text-slate-500">Question {index+1} of {questions.length}</div></div>
      {question && <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800"><span className="rounded-full bg-emerald-50 px-3 py-1">{question.subject}</span><span className="rounded-full bg-slate-100 px-3 py-1">{question.level}</span></div>
        <h2 className="mt-5 text-lg font-extrabold leading-7 sm:text-xl">{question.prompt}</h2>
        <div className="mt-5 space-y-3">{question.options.map((option,i)=><label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${checked && i===question.answer ? "border-emerald-400 bg-emerald-50" : picked[index]===i ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"}`}><input type="radio" name={`question-${index}`} checked={picked[index]===i} disabled={checked} onChange={()=>setPicked(p=>({...p,[index]:i}))}/><span className="flex-1 text-sm font-medium">{String.fromCharCode(65+i)}. {option}</span>{checked && i===question.answer && <CheckCircle2 size={18} className="text-emerald-700"/>}</label>)}</div>
        {checked && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6"><p className={picked[index]===question.answer ? "font-bold text-emerald-800" : "font-bold text-rose-700"}>{picked[index]===question.answer ? "Correct!" : "Not quite — review the explanation."}</p><p className="mt-1 text-slate-700">{question.explanation}</p></div>}
        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4"><button onClick={()=>setChecked(true)} disabled={checked || picked[index]===undefined} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Check answer</button><button onClick={()=>{setIndex(i=>Math.max(0,i-1));setChecked(false)}} disabled={index===0} className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40">Previous</button><button onClick={()=>{setIndex(i=>Math.min(questions.length-1,i+1));setChecked(false)}} disabled={index===questions.length-1} className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40">Next question</button><button onClick={restart} className="ml-auto inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><RotateCcw size={15}/> Restart</button></div>
      </article>}
      <div className="mt-4 flex items-center justify-between rounded-2xl border bg-white p-4"><div><p className="text-sm text-slate-500">Current practice score</p><p className="text-2xl font-extrabold text-emerald-900">{score} / {questions.length}</p></div><p className="max-w-xs text-right text-xs leading-5 text-slate-500">Your answers stay in this page session. This practice score is not an official school result.</p></div>
    </section>
  </main>;
}
