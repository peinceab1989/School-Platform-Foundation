import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bot, MapPin, MessageCircle, Send, X, ArrowUpRight, LoaderCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type HelpTopic = {
  keys: string[];
  title: string;
  answer: string;
  href: string;
};
type ChatMessage = { role: "user" | "assistant"; content: string };

const helpTopics: HelpTopic[] = [
  { keys: ["attendance", "clock in", "clock out", "biometric", "check in", "check out"], title: "Attendance", answer: "Administrators can review daily attendance and manage registered devices in Smart Attendance Centre. Teachers and other users should use the attendance options available to their assigned role. If a device or scan fails, do not create a duplicate record; ask an authorised administrator to review it.", href: "/attendance" },
  { keys: ["result", "results", "report card", "grade", "score"], title: "Results", answer: "Students and parents can view results after the school publishes them. Authorised staff use Results Management to enter, review and publish results. Unpublished results may not appear in student or parent accounts.", href: "/results-management" },
  { keys: ["fee", "fees", "payment", "receipt", "school fees"], title: "Fees and payments", answer: "Parents can review available fee information from the parent dashboard. Payments and receipts must follow the school's finance verification process. A payment should not be treated as confirmed until an authorised finance officer verifies it.", href: "/fees-management" },
  { keys: ["assignment", "assignments", "homework", "project", "practical"], title: "Assignments", answer: "Teachers publish assignments for their assigned classes and subjects. Students open published work from their assignments area and submit the requested evidence. Only the assigned teacher and authorised school staff should review private submissions.", href: "/student-assignments" },
  { keys: ["cbt", "exam", "examination", "test"], title: "Examinations and CBT", answer: "Students can access examinations that have been published for their class and session. Teachers and administrators manage examinations through their authorised examination tools. If an exam is missing, check its publication status and class/session assignment.", href: "/examinations" },
  { keys: ["map", "maps", "direction", "directions", "location", "where is resa", "address"], title: "Maps and directions", answer: "Open RESA Maps & Places to search for destinations, view the school location and open live directions in Google Maps. Route times and road conditions are supplied by Google Maps and can change.", href: "/maps" },
  { keys: ["teacher", "class", "classes", "subject", "assign teacher", "teaching assignment"], title: "Classes and teaching assignments", answer: "Administrators maintain classes and subjects and assign teachers to the correct class, subject and academic session. Teachers should only work with classes and subjects assigned to their account.", href: "/teaching-assignments" },
  { keys: ["admission", "admissions", "enrolment", "enrollment", "register student"], title: "Admissions and enrolment", answer: "Admissions staff manage applications and admission decisions. After approval, authorised staff should complete the learner's class enrolment for the correct academic session. Do not create a second student record to solve a linking issue.", href: "/admissions-management" },
  { keys: ["staff", "invite teacher", "staff invitation", "approve teacher"], title: "Staff accounts", answer: "Administrators use Staff Invitations to invite and manage staff access. Only approve a person after verifying their identity and role. Existing accounts and permissions should not be changed casually.", href: "/staff-invitations" },
  { keys: ["parent", "guardian", "link child", "link learner"], title: "Parents and guardians", answer: "Parent accounts should only be linked to learners after the relationship and learner details have been verified by authorised school staff. Parents can then view information for learners linked to their account.", href: "/parent-management" },
  { keys: ["drive", "upload", "photo", "video", "file"], title: "RESA Drive", answer: "RESA Drive is used for school-managed files and media. Uploads should follow the school's file-size and access rules. If a file does not appear after upload, check its upload status before uploading it again.", href: "/school-services" },
  { keys: ["message", "messages", "communication", "announcement", "chat"], title: "School communication", answer: "Use the school communication area for authorised school messages. Avoid sharing passwords, payment credentials or sensitive student information in general messages.", href: "/school-communication" },
  { keys: ["settings", "school profile", "school information"], title: "School settings", answer: "School settings should only be changed by authorised administrators. Confirm the academic session, term and school details before saving changes that affect the wider portal.", href: "/school-settings" },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function findTopic(question: string) {
  const q = normalise(question);
  if (!q) return undefined;
  return helpTopics
    .map(topic => ({
      topic,
      score: topic.keys.reduce((best, key) => {
        const keyword = normalise(key);
        return keyword && (q === keyword || q.includes(` ${keyword} `) || q.startsWith(`${keyword} `) || q.endsWith(` ${keyword}`))
          ? Math.max(best, keyword.split(" ").length + (q === keyword ? 2 : 0))
          : best;
      }, 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.topic;
}

export default function ResaAssistantWidget() {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const activePage = useMemo(() => path.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "home", [path]);

  async function ask(value = question) {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user" as const, content: trimmed }].slice(-8);
    setMessages(history);
    setQuestion("");
    setPending(true);
    setFallbackNotice(false);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke<{ answer?: string }>("resa-ai-assistant", {
        body: { messages: history, currentPage: activePage },
      });
      if (error) throw error;
      if (typeof data?.answer !== "string" || !data.answer.trim()) throw new Error("The assistant returned no answer.");
      setMessages([...history, { role: "assistant", content: data.answer.trim() }].slice(-8));
    } catch {
      const topic = findTopic(trimmed);
      const answer = topic
        ? `${topic.title}\n\n${topic.answer}\n\nVerified help-library fallback: the AI assistant is temporarily unavailable.`
        : "The AI assistant is temporarily unavailable. Please try again later, use the verified Portal Navigation Guide, or contact RESA Customer Care. Do not share passwords or sensitive student information here.";
      setMessages([...history, { role: "assistant", content: answer }].slice(-8));
      setFallbackNotice(true);
    } finally {
      setPending(false);
    }
  }

  return <div className="fixed bottom-4 right-4 z-[1200]">
    {open && <section role="dialog" aria-modal="false" aria-label="Ask RESA AI assistant" className="mb-3 flex w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-[#103b2d] p-4 text-white">
        <div className="flex items-center gap-2"><Bot size={20}/><div><p className="font-extrabold">Ask RESA</p><p className="text-[11px] text-emerald-100">AI portal guidance • Page: {activePage}</p></div></div>
        <button type="button" onClick={()=>setOpen(false)} aria-label="Close assistant" className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
      </header>
      <div className="max-h-80 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <p className="text-sm leading-6 text-slate-600">Hello! I can guide you through RESA's general portal features. I cannot view private school records or change account data. Please do not share passwords, payment details or sensitive personal information.</p>
        <div className="flex flex-wrap gap-2">{["How do I check results?","How does biometric attendance work?","How do I enrol a student?","How do I use school fees?"].map(q=><button type="button" key={q} disabled={pending} onClick={()=>void ask(q)} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{q}</button>)}</div>
        {messages.map((message, index)=><div key={index} className={message.role==="user"?"ml-7 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-950":"mr-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"}><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{message.role==="user"?"You":"Ask RESA"}</p><p className="whitespace-pre-wrap">{message.content}</p></div>)}
        {pending && <div className="flex items-center gap-2 text-sm text-slate-500" role="status"><LoaderCircle size={16} className="animate-spin"/> Ask RESA is preparing a reply…</div>}
        {fallbackNotice && <p className="text-[10px] text-amber-700">AI service unavailable; a verified help-library fallback may be shown.</p>}
      </div>
      <form onSubmit={e=>{e.preventDefault();void ask();}} className="flex gap-2 border-t border-slate-100 p-3">
        <input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1200} disabled={pending} placeholder="Ask a portal question…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700 disabled:bg-slate-50" aria-label="Ask RESA a question"/>
        <button type="submit" aria-label="Send question" disabled={pending || !question.trim()} className="rounded-xl bg-[#174c35] px-3 text-white disabled:opacity-50">{pending?<LoaderCircle size={17} className="animate-spin"/>:<Send size={17}/>}</button>
      </form>
      <footer className="flex justify-between gap-2 px-4 pb-3 text-xs"><a href="/portal-navigation-guide" className="font-semibold text-emerald-800 underline">Portal guide</a><a href="/maps" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><MapPin size={12}/> Maps</a><a href="https://wa.me/2348058422691" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><MessageCircle size={12}/> Customer care</a></footer>
      <p className="px-4 pb-3 text-[10px] leading-4 text-slate-400">AI guidance is informational, may be inaccurate and cannot access private records or perform school actions.</p>
    </section>}
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={open ? "Close Ask RESA assistant" : "Open Ask RESA assistant"} className="ml-auto flex items-center gap-2 rounded-full bg-[#103b2d] px-4 py-3 font-bold text-white shadow-xl ring-2 ring-white transition hover:bg-[#1a5a3d]">
      {open ? <X size={19}/> : <MessageCircle size={19}/>}<span className="text-sm">Ask RESA</span>
    </button>
  </div>;
}
