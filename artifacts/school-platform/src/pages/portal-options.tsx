import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
  Laptop,
  ShieldCheck,
  MessageCircle,
  Globe,
  X,
  Code2,
  Smartphone,
  Palette,
  Headset,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SchoolLogo } from "@/components/school-logo";

const options = [
  { title: "Check Results", description: "View published academic results and progress.", href: "/my-results", icon: ClipboardCheck, tone: "blue", group: "Student services" },
  { title: "E-learning", description: "Lessons, study resources and practice activities.", href: "/student-dashboard", icon: BookOpen, tone: "orange", group: "Student services" },
  { title: "Computer Based Test", description: "Open online assessments and CBT activities.", href: "/student-cbt", icon: Laptop, tone: "slate", group: "Student services" },
  { title: "External Candidate Registration", description: "RESA · External CBT — Register with your school-verified form number. Each verified form number can only be used once.", href: "/external-cbt-registration", icon: ClipboardCheck, tone: "gold", group: "Student services" },
  { title: "Assignments", description: "View and track class assignments separately from CBT.", href: "/student-assignments", icon: GraduationCap, tone: "blue", group: "Student services" },
  { title: "Admin Platform", description: "Secure sign-in for school staff and administration.", href: "/portal", icon: ShieldCheck, tone: "green", group: "Staff & administration" },
];

const learningWebsites = [
  { title: "Zoom", description: "Join a live class using a meeting link from your teacher.", href: "https://zoom.us/join" },
  { title: "Google Meet", description: "Join a teacher-provided Google Meet session.", href: "https://meet.google.com/" },
  { title: "Microsoft Teams", description: "Join online lessons and class meetings.", href: "https://teams.microsoft.com/" },
  { title: "Canva", description: "Create presentations, posters and learning projects.", href: "https://www.canva.com/" },
  { title: "YouTube", description: "Watch teacher-approved educational videos.", href: "https://www.youtube.com/" },
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
  const [jetabOpen, setJetabOpen] = useState(false);

  useEffect(() => {
    if (!jetabOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setJetabOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jetabOpen]);

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
          <div className="flex shrink-0 items-center gap-2"><a href="https://wa.me/2348058422691?text=Hello%20RESA%20Customer%20Care.%20I%20need%20assistance." target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-900/15 px-3 py-2 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50"><MessageCircle size={16}/> <span className="hidden sm:inline">Customer Care</span></a><Link href="/portal" className="shrink-0 rounded-xl bg-emerald-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 sm:px-4">Sign in</Link></div>
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

        <section aria-labelledby="learning-websites-heading" className="mt-8 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700">Approved external tools</p>
            <h2 id="learning-websites-heading" className="mt-1 text-xl font-extrabold tracking-tight">Online classes & learning websites</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Use these services when a teacher or the school provides a class link or learning activity. RESA account details should only be entered on the official service websites.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {learningWebsites.map((site) => (
              <a key={site.title} href={site.href} target="_blank" rel="noopener noreferrer" className="group flex min-h-[104px] items-start justify-between gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <span><span className="block font-extrabold text-slate-900">{site.title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{site.description}</span></span>
                <ArrowUpRight size={18} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-emerald-800" />
              </a>
            ))}
          </div>
        </section>

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

      <footer className="border-t border-emerald-950/10 bg-white px-4 py-6 text-center text-xs text-slate-500"><p className="font-semibold text-emerald-900">RHEMA EXPLOITS SCIENCE ACADEMY (RESA)</p><p className="mt-1">PASSION • SKILLS • EXCELLENT SPIRIT</p><p className="mt-3 text-[10px]">Designed &amp; Powered by <button type="button" onClick={() => setJetabOpen(true)} aria-haspopup="dialog" aria-expanded={jetabOpen} className="font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-sm">JETAB TECH</button></p><Link href="/" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-800/20 bg-emerald-50 px-5 py-3 text-sm font-extrabold text-emerald-950 transition hover:border-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><ArrowUpRight size={17} aria-hidden="true" className="rotate-[-135deg]" /> Back to Official RESA Website</Link></footer>
      {jetabOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setJetabOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="jetab-profile-title" aria-describedby="jetab-profile-description" className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-emerald-900/10 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><button type="button" onClick={() => setJetabOpen(false)} aria-label="Close JETAB TECH information" className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><X size={19}/></button><div className="flex items-center gap-3 pr-12"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-amber-200 shadow-sm"><Code2 size={28}/></span><div><p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-700">Digital solutions &amp; technology</p><h2 id="jetab-profile-title" className="mt-1 text-2xl font-black tracking-tight text-emerald-950">JETAB TECH</h2></div></div><p id="jetab-profile-description" className="mt-5 text-sm leading-7 text-slate-600">JETAB TECH creates practical digital solutions that help schools, organisations and growing businesses work smarter, serve people better and grow with confidence.</p><div className="mt-5"><h3 className="text-sm font-extrabold text-slate-900">What we do</h3><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="flex items-start gap-3 rounded-xl bg-emerald-50/80 p-3"><Globe size={19} className="mt-0.5 shrink-0 text-emerald-800"/><span><strong className="block text-sm text-slate-900">Websites &amp; web platforms</strong><span className="text-xs leading-5 text-slate-600">Professional websites and online portals.</span></span></div><div className="flex items-start gap-3 rounded-xl bg-emerald-50/80 p-3"><Smartphone size={19} className="mt-0.5 shrink-0 text-emerald-800"/><span><strong className="block text-sm text-slate-900">Apps &amp; custom software</strong><span className="text-xs leading-5 text-slate-600">Purpose-built applications and business tools.</span></span></div><div className="flex items-start gap-3 rounded-xl bg-emerald-50/80 p-3"><Palette size={19} className="mt-0.5 shrink-0 text-emerald-800"/><span><strong className="block text-sm text-slate-900">Graphics &amp; branding</strong><span className="text-xs leading-5 text-slate-600">Digital design and brand communication.</span></span></div><div className="flex items-start gap-3 rounded-xl bg-emerald-50/80 p-3"><Headset size={19} className="mt-0.5 shrink-0 text-emerald-800"/><span><strong className="block text-sm text-slate-900">IT support &amp; training</strong><span className="text-xs leading-5 text-slate-600">Technology support, guidance and skills development.</span></span></div></div><p className="mt-3 text-xs leading-5 text-slate-500">Also: school management systems, attendance solutions, business automation and tailored digital projects.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href="https://jetab-tech.pages.dev" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><Globe size={17}/> Visit JETAB TECH Website <ArrowUpRight size={16}/></a><a href="https://wa.me/2347054078988?text=Hello%20JETAB%20TECH.%20I%20would%20like%20to%20make%20an%20enquiry%20about%20your%20digital%20services." target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-900/20 bg-white px-4 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><MessageCircle size={17}/> Chat on WhatsApp <ArrowUpRight size={16}/></a></div><p className="mt-4 text-center text-xs text-slate-400">JETAB TECH · Designed to make technology work for you.</p></section></div>}

    </main>
  );
}
