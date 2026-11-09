import { Link } from "wouter";
import { ArrowLeft, BellRing, BookOpen, ClipboardList, FileText, ShieldCheck } from "lucide-react";

type Props = { schoolId: string; userId: string };
const links = [
  { title: "Announcements", description: "Create school notices, then publish or unpublish them.", href: "/announcements", icon: BellRing, action: "Manage announcements" },
  { title: "Teaching materials", description: "Review teacher drafts and publish or unpublish learning resources for students.", href: "/teaching-materials", icon: BookOpen, action: "Manage learning resources" },
  { title: "Examinations & CBT", description: "Manage examination availability and draft/published status.", href: "/examinations", icon: ClipboardList, action: "Manage examinations" },
  { title: "Results publication", description: "Review results and control when results are published for students.", href: "/results-management", icon: FileText, action: "Manage results" },
 
];

export default function PublicationCentre({ schoolId, userId }: Props) {
  // The communication controls now live in the Communication Centre.
  void schoolId;
  void userId;

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to admin dashboard</Link>
      <header className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Administrator controls</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Publication & Activation Centre</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">One place to find publication controls and activate school communication. Publishing a resource, examination, announcement or result is separate from saving it as a draft.</p>
      </header>
      <section className="mt-6">
        <div className="mb-3"><h2 className="text-xl font-extrabold">Publication controls</h2><p className="mt-1 text-sm text-slate-600">Open the relevant page to publish, unpublish, or review items.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{links.map(item => { const Icon = item.icon; return <article key={item.href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="mb-3 w-fit rounded-xl bg-emerald-50 p-3 text-emerald-900"><Icon size={21}/></span><h3 className="font-extrabold">{item.title}</h3><p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{item.description}</p><Link href={item.href} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 px-3 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-50">{item.action}</Link></article>; })}</div>
      </section>
      <p className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldCheck size={19} className="mt-0.5 shrink-0"/> These controls are protected by school membership and Supabase row-level security. Only an active school administrator should be able to change activation settings.</p>
    </div>
  </main>;
}
