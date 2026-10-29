import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BellRing, BookOpen, ClipboardList, FileText, MessageCircle, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Props = { schoolId: string; userId: string };
const links = [
  { title: "Announcements", description: "Create school notices, then publish or unpublish them.", href: "/announcements", icon: BellRing, action: "Manage announcements" },
  { title: "Teaching materials", description: "Review teacher drafts and publish or unpublish learning resources for students.", href: "/teaching-materials", icon: BookOpen, action: "Manage learning resources" },
  { title: "Examinations & CBT", description: "Manage examination availability and draft/published status.", href: "/examinations", icon: ClipboardList, action: "Manage examinations" },
  { title: "Results publication", description: "Review results and control when results are published for students.", href: "/results-management", icon: FileText, action: "Manage results" },
  { title: "School messages", description: "Choose whether all active students can use private school messages.", href: "/school-communication", icon: Users, action: "Manage message access" },
  { title: "School chat", description: "Open the school chat and manage its activation switch.", href: "/resa-chat", icon: MessageCircle, action: "Manage chat" },
];

export default function PublicationCentre({ schoolId, userId }: Props) {
  const [chatEnabled, setChatEnabled] = useState(false);
  const [studentsEnabled, setStudentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const db = getSupabaseClient() as any;
    const [chat, access] = await Promise.all([
      db.from("resa_chat_settings").select("chat_enabled").eq("school_id", schoolId).maybeSingle(),
      db.from("school_messaging_access").select("allow_all_students").eq("school_id", schoolId).maybeSingle(),
    ]);
    if (chat.error) setError("Chat status could not be loaded: " + chat.error.message);
    else setChatEnabled(Boolean(chat.data?.chat_enabled));
    if (access.error) setError(previous => (previous ? previous + " · " : "") + "Student message access could not be loaded: " + access.error.message);
    else setStudentsEnabled(Boolean(access.data?.allow_all_students));
    setLoading(false);
  }, [schoolId]);
  useEffect(() => { void load(); }, [load]);

  async function toggleChat() {
    setSaving("chat"); setError(""); setNotice("");
    const db = getSupabaseClient() as any;
    const next = !chatEnabled;
    const result = await db.from("resa_chat_settings").upsert({ school_id: schoolId, chat_enabled: next, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
    if (result.error) setError("Could not change chat status: " + result.error.message);
    else { setChatEnabled(next); setNotice(next ? "School chat is now active." : "School chat is now paused. Existing messages are retained."); }
    setSaving("");
  }

  async function toggleStudents() {
    setSaving("students"); setError(""); setNotice("");
    const db = getSupabaseClient() as any;
    const next = !studentsEnabled;
    const result = await db.from("school_messaging_access").upsert({ school_id: schoolId, allow_all_students: next, allowed_student_ids: [], updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
    if (result.error) setError("Could not change student messaging access: " + result.error.message);
    else { setStudentsEnabled(next); setNotice(next ? "Private school messaging is enabled for all active students." : "Private school messaging is paused for students. Existing messages remain saved."); }
    setSaving("");
  }

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to admin dashboard</Link>
      <header className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Administrator controls</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Publication & Activation Centre</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">One place to find publication controls and activate school communication. Publishing a resource, examination, announcement or result is separate from saving it as a draft.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><MessageCircle size={22}/></span><div className="min-w-0 flex-1"><h2 className="font-extrabold">School chat</h2><p className="mt-1 text-sm text-slate-600">Admin/teacher/student chat is governed by active school membership and teacher-class assignments.</p><p className="mt-3 text-sm font-bold">{loading ? "Checking status…" : chatEnabled ? "Status: Active" : "Status: Paused"}</p></div></div>
          <button type="button" disabled={loading || saving !== ""} onClick={() => void toggleChat()} className="mt-4 w-full rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "chat" ? "Saving…" : chatEnabled ? "Pause school chat" : "Activate school chat"}</button>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-sky-50 p-3 text-sky-900"><Users size={22}/></span><div className="min-w-0 flex-1"><h2 className="font-extrabold">Student private messaging</h2><p className="mt-1 text-sm text-slate-600">Controls private messages between active school members. Disabling this does not delete message history.</p><p className="mt-3 text-sm font-bold">{loading ? "Checking status…" : studentsEnabled ? "Status: Enabled for all active students" : "Status: Restricted for students"}</p></div></div>
          <button type="button" disabled={loading || saving !== ""} onClick={() => void toggleStudents()} className="mt-4 w-full rounded-xl bg-sky-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "students" ? "Saving…" : studentsEnabled ? "Restrict student messaging" : "Enable messaging for all students"}</button>
        </article>
      </section>
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Publication controls</h2><p className="mt-1 text-sm text-slate-600">Open the relevant page to publish, unpublish, or review items.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{links.map(item => { const Icon = item.icon; return <article key={item.href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="mb-3 w-fit rounded-xl bg-emerald-50 p-3 text-emerald-900"><Icon size={21}/></span><h3 className="font-extrabold">{item.title}</h3><p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{item.description}</p><Link href={item.href} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 px-3 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-50">{item.action}</Link></article>; })}</div>
      </section>
      <p className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldCheck size={19} className="mt-0.5 shrink-0"/> These controls are protected by school membership and Supabase row-level security. Only an active school administrator should be able to change activation settings.</p>
    </div>
  </main>;
}
