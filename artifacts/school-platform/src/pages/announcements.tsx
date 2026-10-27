import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BellRing, CalendarClock, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  title: string;
  content: string;
  announcement_type: string;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};
const emptyForm = { title: "", content: "", announcement_type: "general", expires_at: "" };
const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
  : "No expiry";

export default function AnnouncementsPage({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const client = getSupabaseClient();
      const { data, error: queryError } = await client
        .from("announcements")
        .select("id,title,content,announcement_type,is_published,published_at,expires_at,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setRows((data ?? []) as Announcement[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      setError("Enter both a title and announcement message.");
      return;
    }
    setSaving(true);
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Sign in again.");
      const { error: insertError } = await client.from("announcements").insert({
        school_id: schoolId,
        title,
        content,
        announcement_type: form.announcement_type,
        expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
        is_published: false,
      });
      if (insertError) throw insertError;
      setForm(emptyForm);
      setShowForm(false);
      setNotice("Announcement saved as a draft. Publish it when it is ready for school members.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: Announcement) {
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      const client = getSupabaseClient();
      const nextPublished = !row.is_published;
      const { error: updateError } = await client.from("announcements")
        .update({ is_published: nextPublished, published_at: nextPublished ? new Date().toISOString() : null })
        .eq("id", row.id).eq("school_id", schoolId);
      if (updateError) throw updateError;
      setNotice(nextPublished ? "Announcement published." : "Announcement returned to draft.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this announcement.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteAnnouncement(row: Announcement) {
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return;
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      const client = getSupabaseClient();
      const { error: deleteError } = await client.from("announcements").delete().eq("id", row.id).eq("school_id", schoolId);
      if (deleteError) throw deleteError;
      setNotice("Announcement deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this announcement.");
    } finally {
      setBusyId("");
    }
  }

  const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600";
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-green-900 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><BellRing className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-widest text-green-100">RESA School Portal</p><h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Announcements</h1></div></div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      </div></header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">School notices</h2><p className="mt-1 text-sm text-slate-600">Create notices as drafts, then publish or unpublish them when needed.</p></div><div className="flex gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
            <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-3 py-2 text-sm font-bold text-white hover:bg-green-900"><Plus className="h-4 w-4" /> New notice</button>
          </div></div>
          {showForm && <form onSubmit={(event) => void createAnnouncement(event)} className="mt-5 space-y-4 rounded-xl border border-green-100 bg-green-50/50 p-4 sm:p-5">
            <label className="block text-sm font-semibold">Title<input className={field} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} maxLength={180} required /></label>
            <label className="block text-sm font-semibold">Message<textarea className={field} rows={5} value={form.content} onChange={(event) => setForm((old) => ({ ...old, content: event.target.value }))} maxLength={10000} required /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Category<select className={field} value={form.announcement_type} onChange={(event) => setForm((old) => ({ ...old, announcement_type: event.target.value }))}><option value="general">General</option><option value="academic">Academic</option><option value="event">Event</option><option value="urgent">Urgent</option><option value="admissions">Admissions</option></select></label><label className="block text-sm font-semibold">Expiry date (optional)<input className={field} type="date" min={new Date().toISOString().slice(0, 10)} value={form.expires_at} onChange={(event) => setForm((old) => ({ ...old, expires_at: event.target.value }))} /></label></div>
            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><Send className="h-4 w-4" />{saving ? "Saving…" : "Save draft"}</button></div>
          </form>}
        </section>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
        <section className="mt-5 space-y-3">
          {loading ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading announcements…</p> : !rows.length ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No announcements yet. Create your first notice above.</p> : rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.is_published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{row.is_published ? "Published" : "Draft"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{row.announcement_type}</span></div><h3 className="mt-3 break-words text-lg font-bold">{row.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{row.content}</p><p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span>Created {formatDate(row.created_at)}</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Expires: {formatDate(row.expires_at)}</span></p></div>
              <div className="flex shrink-0 gap-2"><button type="button" disabled={busyId === row.id} onClick={() => void togglePublished(row)} className="rounded-lg bg-green-800 px-3 py-2 text-xs font-bold text-white hover:bg-green-900 disabled:opacity-50">{busyId === row.id ? "Working…" : row.is_published ? "Unpublish" : "Publish"}</button><button type="button" disabled={busyId === row.id} onClick={() => void deleteAnnouncement(row)} aria-label={`Delete ${row.title}`} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          </article>)}
        </section>
      </div>
    </main>
  );
}
