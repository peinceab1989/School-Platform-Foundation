import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BellRing, BookOpen, ClipboardList, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Props = { schoolId: string; userId: string };

const publicationLinks = [
  { title: "Announcements", description: "Create school notices and publish or unpublish them.", href: "/announcements", icon: BellRing, action: "Manage announcements" },
  { title: "Learning materials", description: "Review teacher resources and publish or unpublish them for students.", href: "/teaching-materials", icon: BookOpen, action: "Manage learning materials" },
  { title: "Examinations & CBT", description: "Manage examinations, schedules and publication status.", href: "/examinations", icon: ClipboardList, action: "Manage examinations" },
  { title: "Results", description: "Review scores, approve results and publish report cards.", href: "/results-management", icon: FileText, action: "Manage results" },
];

export default function PublicationCentre({ schoolId, userId }: Props) {
  const [studentsEnabled, setStudentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const access = await db.from("school_messaging_access")
        .select("allow_all_students").eq("school_id", schoolId).maybeSingle();
      if (access.error) throw access.error;
      setStudentsEnabled(Boolean(access.data?.allow_all_students));
    } catch (e) {
      setError("Student messaging access could not be loaded: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  async function toggleStudents() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const next = !studentsEnabled;
      const result = await db.from("school_messaging_access").upsert({
        school_id: schoolId,
        allow_all_students: next,
        allowed_student_ids: [],
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id" });
      if (result.error) throw result.error;
      setStudentsEnabled(next);
      setNotice(next
        ? "Private school messaging is enabled for active students."
        : "Private school messaging is paused for students. Existing messages are retained.");
    } catch (e) {
      setError("Could not change student messaging access: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to admin dashboard</Link>
      <header className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Administrator controls</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Publication Centre</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">Manage publication from the relevant academic page. Drafts remain private until approved and published.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold">Student private messaging</h2>
            <p className="mt-1 text-sm text-slate-600">Controls student access to private school messages. Pausing access does not delete saved messages.</p>
            <p className="mt-3 text-sm font-bold">{loading ? "Checking status…" : studentsEnabled ? "Status: Enabled for active students" : "Status: Restricted for students"}</p>
          </div>
          <button type="button" disabled={loading || saving} onClick={() => void toggleStudents()} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : studentsEnabled ? "Pause student messaging" : "Enable student messaging"}</button>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><RefreshCw size={15}/> Refresh access status</button>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-extrabold">Publication workflows</h2>
        <p className="mt-1 text-sm text-slate-600">Each item has one authoritative management page; this screen is a shortcut, not a second publishing system.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{publicationLinks.map(item => { const Icon = item.icon; return <article key={item.href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="mb-3 w-fit rounded-xl bg-emerald-50 p-3 text-emerald-900"><Icon size={21}/></span><h3 className="font-extrabold">{item.title}</h3><p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{item.description}</p><Link href={item.href} className="mt-4 inline-flex items-center justify-center rounded-xl border border-emerald-900 px-3 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-50">{item.action}</Link></article>; })}</div>
      </section>
      <p className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldCheck size={19} className="mt-0.5 shrink-0"/> Access changes are protected by school membership and Supabase row-level security.</p>
    </div>
  </main>;
}
