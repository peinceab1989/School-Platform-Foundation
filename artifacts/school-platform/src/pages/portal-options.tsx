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
  Headset,
} from "lucide-react";
import { Link } from "wouter";
import { SchoolLogo } from "@/components/school-logo";

const options = [
  { title: "Check Results", description: "View academic results and progress.", href: "/results", icon: ClipboardCheck, tone: "blue", group: "Student services" },
  { title: "E-learning", description: "Continue learning and access study resources.", href: "/student-dashboard", icon: BookOpen, tone: "orange", group: "Student services" },
  { title: "Computer Based Test", description: "Open online assessments and CBT activities.", href: "/student-cbt", icon: Laptop, tone: "slate", group: "Student services" },
  { title: "Test Drilling & Practice", description: "Practise questions and review answer explanations.", href: "/practice-drills", icon: BookOpenCheck, tone: "green", group: "Student services" },
  { title: "Assignments", description: "Go to your student learning area.", href: "/student-dashboard", icon: GraduationCap, tone: "blue", group: "Student services" },
  { title: "Test Drilling & Practice", description: "Practise questions and check answers with explanations.", href: "/practice-drills", icon: BookOpen, tone: "green", group: "Student services" },
  { title: "Live Classes", description: "Continue to the school learning portal.", href: "/portal", icon: Video, tone: "gold", group: "Student services" },
  { title: "School Fees", description: "Continue to the secure school portal.", href: "/portal", icon: WalletCards, tone: "sand", group: "Student services" },
  { title: "Staff Platform", description: "Sign in to staff tools and teaching resources.", href: "/portal", icon: UsersRound, tone: "green", group: "Staff & administration" },
  { title: "Customer Care", description: "Contact RESA for help by chat, message or phone.", href: "/contact", icon: Headset, tone: "gold", group: "Staff & administration" },
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

        <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><MessageCircle size={22} /></span>
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700">We are here to help</p><h2 className="mt-1 text-xl font-extrabold">RESA Customer Care</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Contact the school directly by WhatsApp message, phone call or email. In-app live chat and voice/video calling are not yet available, so these links take you to the school's direct contact channels.</p></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <a href="https://wa.me/2348058422691" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-emerald-100 p-4 font-bold text-emerald-900 transition hover:bg-emerald-50"><MessageCircle size={20}/><span><span className="block">WhatsApp</span><span className="mt-1 block text-xs font-medium text-slate-500">Send a message</span></span></a>
            <a href="tel:+2348058422691" className="flex items-center gap-3 rounded-xl border border-emerald-100 p-4 font-bold text-emerald-900 transition hover:bg-emerald-50"><Phone size={20}/><span><span className="block">Call the school</span><span className="mt-1 block text-xs font-medium text-slate-500">+234 805 842 2691</span></span></a>
            <a href="mailto:rhemaexploitsacademy@gmail.com" className="flex items-center gap-3 rounded-xl border border-emerald-100 p-4 font-bold text-emerald-900 transition hover:bg-emerald-50"><Mail size={20}/><span><span className="block">Email</span><span className="mt-1 block text-xs font-medium text-slate-500">Send an enquiry</span></span></a>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2 text-amber-800 shadow-sm"><CalendarDays size={20} /></span><div><p className="font-bold text-slate-900">Need help accessing the portal?</p><p className="mt-1 text-sm leading-6 text-slate-600">Use your school account to sign in. If your account is not active, contact the school administrator.</p></div></div>
          <Link href="/contact" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800">Contact RESA <ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-white px-4 py-5 text-center text-xs text-slate-500"><p className="font-semibold text-emerald-900">RHEMA EXPLOITS SCIENCE ACADEMY (RESA)</p><p className="mt-1">PASSION • SKILLS • EXCELLENT SPIRIT</p><p className="mt-3">Designed &amp; Powered by JETAB TECH</p></footer>
    </main>
  );
}
