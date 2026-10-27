import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Laptop,
  LibraryBig,
  ShieldCheck,
  UsersRound,
  Video,
  WalletCards,
  MessageCircle,
  X,
  Send,
  Clock3,
} from "lucide-react";
import { Link } from "wouter";
import { SchoolLogo } from "@/components/school-logo";

const options = [
  { title: "Check Results", description: "View academic results and progress.", href: "/results", icon: ClipboardCheck, tone: "blue", group: "Student services" },
  { title: "E-learning", description: "Lessons, study resources and practice activities.", href: "/student-dashboard", icon: BookOpen, tone: "orange", group: "Student services" },
  { title: "Computer Based Test", description: "Open online assessments and CBT activities.", href: "/student-cbt", icon: Laptop, tone: "slate", group: "Student services" },
  { title: "Assignments", description: "Go to your student learning area.", href: "/student-dashboard", icon: GraduationCap, tone: "blue", group: "Student services" },
  { title: "Live Classes", description: "Continue to the school learning portal.", href: "/portal", icon: Video, tone: "gold", group: "Student services" },
  { title: "School Fees", description: "Continue to the secure school portal.", href: "/portal", icon: WalletCards, tone: "sand", group: "Student services" },
  { title: "Staff Platform", description: "Sign in to staff tools and teaching resources.", href: "/portal", icon: UsersRound, tone: "green", group: "Staff & administration" },
  { title: "Admin Platform", description: "Manage school records and operations.", href: "/dashboard", icon: ShieldCheck, tone: "green", group: "Staff & administration" },
];

const toneClasses: Record<string, string> = {
  blue: "bg-sky-50 text-sky-800 ring-sky-100 group-hover:bg-sky-100",
  orange: "bg-orange-50 text-orange-800 ring-orange-100 group-hover:bg-orange-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200 group-hover:bg-slate-200",
  gold: "bg-amber-50 text-amber-800 ring-amber-100 group-hover:bg-amber-100",
  sand: "bg-yellow-50 text-yellow-900 ring-yellow-100 group-hover:bg-yellow-100",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-100 group-hover:bg-emerald-100",
};


function CustomerCareWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("Portal or account access");
  const sendMessage = () => {
    const clean = message.trim();
    if (!clean) return;
    const text = "Hello RESA Customer Care.\\nTopic: " + topic + "\\nMessage: " + clean;
    window.open("https://wa.me/2348058422691?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  };
  return <>
    {open && <section aria-label="RESA customer care chat" className="fixed bottom-24 right-4 z-[100] flex max-h-[min(620px,calc(100dvh-7rem))] w-[min(370px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-emerald-900/15 bg-white shadow-2xl sm:bottom-24 sm:right-6">
      <div className="bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><Headset size={23}/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-emerald-900 bg-lime-300"/></span><div><p className="font-extrabold">RESA Customer Care</p><p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-50"><span className="h-2 w-2 rounded-full bg-lime-300"/> Send us a message</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close customer care chat" className="rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white"><X size={19}/></button>
        </div>
        <p className="mt-4 text-sm leading-6 text-emerald-50">Hello! 👋 Welcome to RESA. Tell us what you need help with and we’ll prepare a message to our school contact.</p>
      </div>
      <div className="space-y-3 overflow-y-auto p-4">
        <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-slate-100 p-3 text-sm leading-5 text-slate-700">Hi there! Please choose a topic and drop your message below.</div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">How can we help?</label>
        <select value={topic} onChange={e => setTopic(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
          <option>Portal or account access</option><option>Admissions and enrolment</option><option>Fees and payment</option><option>Results, CBT or learning</option><option>Parent or student support</option><option>General enquiry</option>
        </select>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Your message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={1200} placeholder="Type your message here…" className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><Clock3 size={13}/> Opens WhatsApp</span><span>{message.length}/1200</span></div>
        <button type="button" onClick={sendMessage} disabled={!message.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"><Send size={17}/> Send message <ArrowUpRight size={16}/></button>
        <p className="text-center text-[11px] leading-4 text-slate-500">WhatsApp opens with your message prepared. Tap Send in WhatsApp to deliver it.</p>
      </div>
    </section>}
    <button type="button" onClick={() => setOpen(v => !v)} aria-label={open ? "Close customer care" : "Chat with RESA customer care"} className="fixed bottom-5 right-4 z-[101] flex items-center gap-2 rounded-full bg-emerald-900 px-4 py-3.5 text-sm font-extrabold text-white shadow-xl ring-4 ring-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 sm:bottom-6 sm:right-6">
      {open ? <X size={20}/> : <span className="relative"><MessageCircle size={21}/><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-emerald-900 bg-lime-300"/></span>}
      {open ? "Close chat" : "Customer care"}
      {!open && <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-950">Chat</span>}
    </button>
  </>;
}

export default function PortalOptionsPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-900">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
            <SchoolLogo alt="Official RESA crest" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-amber-300/70 shadow-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-wide text-emerald-950 sm:text-base">RHEMA EXPLOITS SCIENCE ACADEMY</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.17em] text-amber-700 sm:text-xs">Passion • Skills • Excellent Spirit</p>
            </div>
          </Link>
          <Link href="/portal" className="shrink-0 rounded-xl border border-emerald-900/15 px-3 py-2 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50 sm:px-4">Sign in</Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 text-white">
        <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10 sm:h-96 sm:w-96" />
        <div aria-hidden="true" className="absolute -right-5 -top-12 h-52 w-52 rounded-full border border-amber-200/15 sm:h-72 sm:w-72" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200 sm:text-sm">Welcome to RESA</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Your school. Your learning. One portal.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/90 sm:text-base">Choose the service you need below. Secure areas will ask you to sign in with your school account.</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 sm:text-sm"><ShieldCheck size={16} className="text-amber-200" /> Secure access for students, staff and administrators</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700">Get started</p><h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Choose an option</h2></div>
          <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 sm:inline-flex">Mobile friendly</span>
        </div>

        <h3 className="mb-3 text-sm font-bold text-slate-500">STUDENT SERVICES</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.filter((item) => item.group === "Student services").map((item) => {
            const Icon = item.icon;
            if (item.title === "E-learning") return <div key={item.title} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-lg sm:p-5">
              <Link href={item.href} className="group flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClasses[item.tone]}`}><Icon size={23} strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1"><span className="block font-extrabold text-slate-900">E-learning</span><span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span></span>
                <ArrowUpRight size={18} className="shrink-0 text-slate-400 transition group-hover:text-emerald-800" />
              </Link>
              <Link href="/practice-drills" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-extrabold text-amber-950 transition hover:bg-amber-100"><span className="flex items-center gap-2"><BookOpenCheck size={18}/> Test drilling & practice</span><ArrowUpRight size={16}/></Link>
            </div>;
            return <Link key={item.title} href={item.href} className="group flex min-h-[116px] items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:p-5">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition ${toneClasses[item.tone]}`}><Icon size={23} strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1"><span className="block font-extrabold text-slate-900">{item.title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span></span>
              <ArrowUpRight size={18} className="shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-800" />
            </Link>;
          })}
        </div>

        <h3 className="mb-3 mt-8 text-sm font-bold text-slate-500">STAFF & ADMINISTRATION</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.filter((item) => item.group === "Staff & administration").map((item) => {
            const Icon = item.icon;
            return <Link key={item.title} href={item.href} className="group flex min-h-[112px] items-center gap-4 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:p-5">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition ${toneClasses[item.tone]}`}><Icon size={23} strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1"><span className="block font-extrabold text-slate-900">{item.title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span></span>
              <ArrowUpRight size={18} className="shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-800" />
            </Link>;
          })}
        </div>


      </section>

      <footer className="border-t border-emerald-950/10 bg-white px-4 py-5 text-center text-xs text-slate-500"><p className="font-semibold text-emerald-900">RHEMA EXPLOITS SCIENCE ACADEMY (RESA)</p><p className="mt-1">PASSION • SKILLS • EXCELLENT SPIRIT</p><p className="mt-3">Designed &amp; Powered by JETAB TECH</p></footer>
    </main>
  );
}
