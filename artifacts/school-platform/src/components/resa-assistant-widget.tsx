import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bot, MapPin, MessageCircle, Send, X } from "lucide-react";

const helpTopics = [
  { keys: ["attendance", "clock in", "clock out", "biometric"], title: "Attendance", answer: "Attendance tools are available from the relevant staff or student dashboard. Administrators can review daily attendance and use Smart Attendance Centre for registered attendance stations.", href: "/portal-navigation-guide" },
  { keys: ["result", "report card", "grade", "score"], title: "Results", answer: "Students and parents can view results after the school publishes them. Authorised staff use Results Management to enter, review and publish results.", href: "/portal-navigation-guide" },
  { keys: ["fee", "payment", "receipt", "school fees"], title: "Fees and payments", answer: "Parents can review available fee information from the parent dashboard. Payments and receipts must follow the school's finance verification process.", href: "/portal-navigation-guide" },
  { keys: ["assignment", "homework", "project"], title: "Assignments", answer: "Teachers publish assignments for assigned classes and subjects. Students open published work from their assignments area and submit the requested evidence.", href: "/portal-navigation-guide" },
  { keys: ["cbt", "exam", "examination", "test"], title: "Examinations and CBT", answer: "Students can access examinations that have been published for their class. Teachers and administrators manage examinations through their authorised examination tools.", href: "/portal-navigation-guide" },
  { keys: ["map", "direction", "location", "where is resa", "address"], title: "Maps and directions", answer: "Open RESA Maps & Places to view the school's address, search a destination and launch live directions in Google Maps.", href: "/maps" },
  { keys: ["teacher", "class", "subject", "assign"], title: "Classes and teaching assignments", answer: "Administrators maintain classes and subjects and assign teachers to the appropriate class, subject and academic session.", href: "/portal-navigation-guide" },
];

export default function ResaAssistantWidget() {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const activePage = useMemo(() => path.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "home", [path]);

  function ask(value = question) {
    const q = value.trim().toLowerCase();
    if (!q) return;
    const match = helpTopics.find(topic => topic.keys.some(key => q.includes(key)));
    setReply(match ? `${match.title}: ${match.answer}` : "I could not find a verified answer in the current RESA help library. Please open the Portal Navigation Guide for approved instructions or contact RESA Customer Care. I will not guess about school procedures.");
    setQuestion(value);
  }

  return <div className="fixed bottom-4 right-4 z-[1200]">
    {open && <section role="dialog" aria-label="RESA help assistant" className="mb-3 flex w-[min( calc(100vw-2rem), 380px)] flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-[#103b2d] p-4 text-white">
        <div className="flex items-center gap-2"><Bot size={20}/><div><p className="font-extrabold">Ask RESA</p><p className="text-[11px] text-emerald-100">Quick help • Page: {activePage}</p></div></div>
        <button onClick={()=>setOpen(false)} aria-label="Close assistant" className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
      </header>
      <div className="max-h-72 space-y-3 overflow-y-auto p-4">
        <p className="text-sm leading-6 text-slate-600">Hello! Ask about attendance, results, fees, assignments, examinations or school directions.</p>
        <div className="flex flex-wrap gap-2">{["How do I check results?","How does attendance work?","Find RESA on the map"].map(q=><button key={q} onClick={()=>ask(q)} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">{q}</button>)}</div>
        {reply && <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{reply}</div>}
      </div>
      <form onSubmit={e=>{e.preventDefault();ask();}} className="flex gap-2 border-t border-slate-100 p-3">
        <input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type your question…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700" aria-label="Ask RESA a question"/>
        <button aria-label="Send question" className="rounded-xl bg-[#174c35] px-3 text-white"><Send size={17}/></button>
      </form>
      <footer className="flex justify-between gap-2 px-4 pb-3 text-xs"><a href="/portal-navigation-guide" className="font-semibold text-emerald-800 underline">Portal guide</a><a href="/maps" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><MapPin size={12}/> Maps</a><a href="https://wa.me/2348058422691" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><MessageCircle size={12}/> Customer care</a></footer>
      <p className="px-4 pb-3 text-[10px] leading-4 text-slate-400">This initial assistant uses approved quick-help topics. It is not yet connected to a generative AI service.</p>
    </section>}
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={open ? "Close Ask RESA assistant" : "Open Ask RESA assistant"} className="ml-auto flex items-center gap-2 rounded-full bg-[#103b2d] px-4 py-3 font-bold text-white shadow-xl ring-2 ring-white transition hover:bg-[#1a5a3d]">
      {open ? <X size={19}/> : <MessageCircle size={19}/>}<span className="text-sm">Ask RESA</span>
    </button>
  </div>;
}
