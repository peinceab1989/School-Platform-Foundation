import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, FilePlus2, Globe2, History, ImagePlus, Newspaper, Pencil, RefreshCw, Save, ShieldCheck, UploadCloud } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type ContentType = "news" | "announcement" | "event" | "admissions" | "gallery" | "page";
type WebsiteContent = {
  id: string;
  school_id: string;
  content_type: ContentType;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  image_alt: string | null;
  video_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type ContentRevision = {
  id: string;
  revision_number: number;
  action: "created" | "updated" | "published" | "unpublished";
  created_at: string;
  changed_by: string | null;
  snapshot: Record<string, any>;
};
type Draft = {
  content_type: ContentType;
  title: string;
  slug: string;
  summary: string;
  body: string;
  image_url: string;
  image_alt: string;
  video_url: string;
  seo_title: string;
  seo_description: string;
  published_at: string;
  expires_at: string;
  sort_order: string;
};
const EMPTY: Draft = {
  content_type: "news", title: "", slug: "", summary: "", body: "",
  image_url: "", image_alt: "", video_url: "", seo_title: "", seo_description: "", published_at: "", expires_at: "", sort_order: "0",
};
const TYPES: { value: ContentType; label: string; help: string }[] = [
  { value: "news", label: "News", help: "School news and achievements" },
  { value: "announcement", label: "Announcement", help: "Public notices and important updates" },
  { value: "event", label: "Event", help: "Upcoming and past school events" },
  { value: "admissions", label: "Admissions", help: "Admission information and notices" },
  { value: "gallery", label: "Gallery", help: "Photo or media highlights" },
  { value: "page", label: "Managed page", help: "Standalone public page managed without a redeployment" },
];
const field = "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const label = "block text-sm font-semibold text-slate-800";
const toLocalInput = (value: string | null) => { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const makeSlug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);

export default function WebsiteManagerPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [items, setItems] = useState<WebsiteContent[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | ContentType>("all");
  const [search, setSearch] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [historyItem, setHistoryItem] = useState<WebsiteContent | null>(null);
  const [historyRows, setHistoryRows] = useState<ContentRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data, error: queryError } = await db.from("public_website_content")
        .select("id,school_id,content_type,title,slug,summary,body,image_url,image_alt,video_url,seo_title,seo_description,is_published,published_at,expires_at,sort_order,created_at,updated_at")
        .eq("school_id", schoolId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setItems((data ?? []) as WebsiteContent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Website content could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => items.filter(item => {
    const matchesType = filter === "all" || item.content_type === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [item.title, item.slug, item.summary ?? ""].join(" ").toLowerCase().includes(query);
    return matchesType && matchesSearch;
  }), [items, filter, search]);

  function startNew() {
    setDraft(EMPTY);
    setEditingId(null);
    setAutoSlug(true);
    setError("");
    setNotice("");
  }

  function edit(item: WebsiteContent) {
    setEditingId(item.id);
    setAutoSlug(false);
    setDraft({
      content_type: item.content_type, title: item.title, slug: item.slug,
      summary: item.summary ?? "", body: item.body ?? "", image_url: item.image_url ?? "",
      image_alt: item.image_alt ?? "", video_url: item.video_url ?? "", seo_title: item.seo_title ?? "", seo_description: item.seo_description ?? "", published_at: toLocalInput(item.published_at),
      expires_at: toLocalInput(item.expires_at), sort_order: String(item.sort_order ?? 0),
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(previous => {
      const next = { ...previous, [key]: value };
      if (key === "title" && autoSlug) next.slug = makeSlug(String(value));
      return next;
    });
  }

  async function uploadImage(file: File) {
    setError(""); setNotice("");
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!allowed.has(file.type)) { setError("Choose a JPG, PNG, WebP or GIF image."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Website images must be 8 MB or smaller."); return; }
    setUploadingImage(true);
    try {
      const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "img";
      const objectPath = `${schoolId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const storage = getSupabaseClient().storage.from("resa-public-website-media");
      const { data, error: uploadError } = await storage.upload(objectPath, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data: publicFile } = storage.getPublicUrl(data.path);
      update("image_url", publicFile.publicUrl);
      if (!draft.image_alt.trim()) update("image_alt", file.name.replace(/\\.[^.]+$/, "").replace(/[-_]+/g, " "));
      setNotice("Image uploaded to the school's public website media library. Save the content draft to attach it to this page.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed. Check your administrator access and try again.");
    } finally { setUploadingImage(false); }
  }

  async function save(publish: boolean) {
    setError("");
    setNotice("");
    const title = draft.title.trim();
    const slug = makeSlug(draft.slug);
    if (!title) { setError("Enter a title before saving."); return; }
    if (!slug) { setError("Enter a valid page slug."); return; }
    if (draft.video_url.trim()) {
      try { const parsed = new URL(draft.video_url.trim()); if (parsed.protocol !== "https:") throw new Error(); }
      catch { setError("Video URL must be a valid HTTPS address."); return; }
    }
    if (draft.image_url.trim()) {
      try {
        const parsed = new URL(draft.image_url.trim());
        if (parsed.protocol !== "https:") throw new Error();
      } catch { setError("Image URL must be a valid HTTPS address."); return; }
    }
    const publishedAt = draft.published_at ? new Date(draft.published_at).toISOString() : (publish ? new Date().toISOString() : null);
    const expiresAt = draft.expires_at ? new Date(draft.expires_at).toISOString() : null;
    if (publishedAt && expiresAt && new Date(expiresAt).getTime() <= new Date(publishedAt).getTime()) {
      setError("The expiry time must be later than the publication time."); return;
    }
    setSaving(true);
    try {
      const db = getSupabaseClient() as any;
      const row = {
        school_id: schoolId, content_type: draft.content_type, title, slug,
        summary: draft.summary.trim() || null, body: draft.body.trim() || null,
        image_url: draft.image_url.trim() || null, image_alt: draft.image_alt.trim() || null,
        is_published: publish, published_at: publish ? publishedAt : null,
        expires_at: expiresAt, sort_order: Math.max(-10000, Math.min(10000, Number.parseInt(draft.sort_order, 10) || 0)),
        updated_at: new Date().toISOString(),
      };
      const result = editingId
        ? await db.from("public_website_content").update(row).eq("school_id", schoolId).eq("id", editingId).select("id").single()
        : await db.from("public_website_content").insert({ ...row, created_by: userId }).select("id").single();
      if (result.error) throw result.error;
      setNotice(publish
        ? (publishedAt && new Date(publishedAt).getTime() > Date.now() ? "Content saved and scheduled. It will appear publicly when its publication time arrives." : "Content published successfully.")
        : "Draft saved. It is not visible on the public website.");
      setEditingId(null);
      setDraft(EMPTY);
      setAutoSlug(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Website content could not be saved. Check your administrator access.");
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory(item: WebsiteContent) {
    setHistoryItem(item);
    setHistoryRows([]);
    setHistoryLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data, error: historyError } = await db.from("public_website_content_revisions")
        .select("id,revision_number,action,created_at,changed_by,snapshot")
        .eq("school_id", schoolId).eq("content_id", item.id)
        .order("revision_number", { ascending: false }).limit(20);
      if (historyError) throw historyError;
      setHistoryRows((data ?? []) as ContentRevision[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revision history could not be loaded.");
    } finally { setHistoryLoading(false); }
  }

  async function restoreRevision(revision: ContentRevision) {
    if (!historyItem) return;
    if (!window.confirm(`Restore revision ${revision.revision_number} for “${historyItem.title}”? The current version will remain in the history.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const snapshot = revision.snapshot ?? {};
      const row = {
        content_type: snapshot.content_type,
        title: snapshot.title,
        slug: snapshot.slug,
        summary: snapshot.summary ?? null,
        body: snapshot.body ?? null,
        image_url: snapshot.image_url ?? null,
        image_alt: snapshot.image_alt ?? null,
        is_published: Boolean(snapshot.is_published),
        published_at: snapshot.published_at ?? null,
        expires_at: snapshot.expires_at ?? null,
        sort_order: Number(snapshot.sort_order ?? 0),
        updated_at: new Date().toISOString(),
      };
      const db = getSupabaseClient() as any;
      const { error: restoreError } = await db.from("public_website_content")
        .update(row).eq("school_id", schoolId).eq("id", historyItem.id);
      if (restoreError) throw restoreError;
      setNotice(`Revision ${revision.revision_number} restored. The previous live version was preserved in the revision history.`);
      setHistoryItem(null);
      setHistoryRows([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The selected revision could not be restored.");
    } finally { setSaving(false); }
  }

  async function setPublished(item: WebsiteContent, publish: boolean) {
    setSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { error: updateError } = await db.from("public_website_content").update({
        is_published: publish,
        published_at: publish ? (item.published_at || new Date().toISOString()) : null,
        updated_at: new Date().toISOString(),
      }).eq("school_id", schoolId).eq("id", item.id);
      if (updateError) throw updateError;
      setNotice(publish ? "Content is now published." : "Content unpublished and retained as a draft.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publication status could not be changed.");
    } finally { setSaving(false); }
  }

  const statusLabel = (item: WebsiteContent) => {
    if (!item.is_published) return "Draft";
    if (item.published_at && new Date(item.published_at).getTime() > Date.now()) return "Scheduled";
    if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) return "Expired";
    return "Published";
  };

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <Link href="/publication-centre" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Publication Centre</Link>
      <header className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#09291f] via-[#14543b] to-[#24724d] p-5 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-amber-200"><Globe2 size={15}/> RESA website control</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Website & Content Manager</h1>
            <p className="mt-3 text-sm leading-7 text-emerald-50 sm:text-base">Update the public RESA website without editing code. Create news, announcements, events, admissions notices, photo/video highlights and standalone managed pages with search metadata. Save drafts, schedule publication or publish when ready.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/announcements" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Portal announcements</Link><button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-emerald-950 shadow hover:bg-amber-200"><FilePlus2 size={17}/> New content</button></div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs text-emerald-100">Total items</p><p className="mt-1 text-2xl font-black">{items.length}</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs text-emerald-100">Published / scheduled</p><p className="mt-1 text-2xl font-black">{items.filter(x => x.is_published).length}</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs text-emerald-100">Drafts</p><p className="mt-1 text-2xl font-black">{items.filter(x => !x.is_published).length}</p></div>
        </div>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-extrabold">Content library</h2><p className="mt-1 text-sm text-slate-600">Search, edit, publish or unpublish website content.</p></div>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh</button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
            <input aria-label="Search website content" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, slug or summary" className={field}/>
            <select aria-label="Filter content type" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className={field}><option value="all">All content types</option>{TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Loading school website content…</p>
              : visibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><Newspaper className="mx-auto text-slate-400" size={28}/><p className="mt-2 font-bold">No matching content</p><p className="mt-1 text-sm text-slate-500">Create your first item or change the search filter.</p></div>
              : visibleItems.map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-900">{TYPES.find(t => t.value === item.content_type)?.label ?? item.content_type}</span><span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + (statusLabel(item) === "Published" ? "bg-green-100 text-green-800" : statusLabel(item) === "Scheduled" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700")}>{statusLabel(item)}</span></div>
                    <h3 className="mt-2 break-words font-extrabold">{item.title}</h3>
                    <p className="mt-1 break-all text-xs text-slate-500">/{item.slug}</p>
                    {item.summary && <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>}
                    <p className="mt-2 text-xs text-slate-500">Updated {new Date(item.updated_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  {item.image_url && <img src={item.image_url} alt={item.image_alt || ""} loading="lazy" className="h-16 w-20 rounded-lg border object-cover"/>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => edit(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"><Pencil size={14}/> Edit</button>
                  <button type="button" onClick={() => void loadHistory(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"><History size={14}/> History</button>
                  <button type="button" onClick={() => void setPublished(item, !item.is_published)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{item.is_published ? "Unpublish" : "Publish"}</button>
                </div>
              </article>)}
          </div>
          {historyItem && <section className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-extrabold text-indigo-950">Revision history</h3><p className="mt-1 text-xs text-indigo-800">{historyItem.title} · latest 20 saved versions</p></div>
              <button type="button" onClick={() => { setHistoryItem(null); setHistoryRows([]); }} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-900">Close history</button>
            </div>
            {historyLoading ? <p className="mt-3 text-sm text-indigo-800">Loading revisions…</p>
              : historyRows.length === 0 ? <p className="mt-3 text-sm text-indigo-800">No saved revisions were found for this item.</p>
              : <div className="mt-3 space-y-2">{historyRows.map(revision => <div key={revision.id} className="rounded-lg border border-indigo-100 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-900">Revision {revision.revision_number} · {revision.action}</p><p className="mt-1 text-xs text-slate-500">{new Date(revision.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p></div><button type="button" onClick={() => void restoreRevision(revision)} disabled={saving} className="rounded-lg bg-indigo-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Restore this version</button></div>
                <p className="mt-2 text-sm font-semibold text-slate-800">{String(revision.snapshot?.title ?? "Untitled")}</p>
                {revision.snapshot?.summary && <p className="mt-1 text-xs leading-5 text-slate-600">{String(revision.snapshot.summary).slice(0, 240)}</p>}
              </div>)}</div>}
          </section>}
        </article>

        <article className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><Pencil size={20}/></span><div><h2 className="text-xl font-extrabold">{editingId ? "Edit content" : "Create content"}</h2><p className="text-sm text-slate-600">All fields can be updated later.</p></div></div>
          <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); void save(false); }}>
            <label className={label}>Content type<select value={draft.content_type} onChange={e => update("content_type", e.target.value as ContentType)} className={field}>{TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.help}</option>)}</select></label>
            <label className={label}>Title<input value={draft.title} onChange={e => update("title", e.target.value)} maxLength={160} required placeholder="Enter a clear public heading" className={field}/></label>
            <label className={label}>Page slug<div className="mt-1.5 flex gap-2"><input value={draft.slug} onChange={e => { setAutoSlug(false); update("slug", e.target.value); }} maxLength={100} required placeholder="e.g. science-fair-2026" className={field}/><button type="button" title="Generate slug from title" onClick={() => { setAutoSlug(true); update("slug", makeSlug(draft.title)); }} className="shrink-0 rounded-xl border px-3 text-xs font-bold hover:bg-slate-50">Auto</button></div></label>
            <label className={label}>Short summary<textarea value={draft.summary} onChange={e => update("summary", e.target.value)} maxLength={500} rows={3} placeholder="A short introduction displayed with the item" className={field}/></label>
            <label className={label}>Main content<textarea value={draft.body} onChange={e => update("body", e.target.value)} maxLength={12000} rows={7} placeholder="Write the full public information here. Use plain text; do not paste HTML or scripts." className={field}/></label>
            <div className="rounded-xl border border-dashed border-slate-300 p-3">
              <p className="flex items-center gap-2 text-sm font-bold"><ImagePlus size={16}/> Featured image</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Paste a secure public image URL. RESA will not execute uploaded HTML or scripts.</p>
              <label className={label + " mt-3"}>Upload image from this device<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingImage} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.currentTarget.value = ""; }} className={field}/><span className="mt-1 block text-xs font-normal text-slate-500">{uploadingImage ? "Uploading image…" : "JPG, PNG, WebP or GIF · maximum 8 MB"}</span></label>
              <label className={label + " mt-3"}>Or paste an HTTPS image URL<input type="url" value={draft.image_url} onChange={e => update("image_url", e.target.value)} placeholder="https://…" className={field}/></label>
              <label className={label + " mt-3"}>Image description (accessibility)<input value={draft.image_alt} onChange={e => update("image_alt", e.target.value)} maxLength={180} placeholder="Describe the image briefly" className={field}/></label>\n              <label className={label + " mt-3"}>Video link (optional)<input type="url" value={draft.video_url} onChange={e => update("video_url", e.target.value)} placeholder="https://youtu.be/... or https://vimeo.com/..." className={field}/><span className="mt-1 block text-xs font-normal text-slate-500">Use a public HTTPS YouTube, Vimeo or direct MP4/WebM link. Video files are not uploaded to school storage.</span></label>
              {draft.image_url && <img src={draft.image_url} alt={draft.image_alt} className="mt-3 max-h-40 w-full rounded-lg border object-cover" onError={e => { e.currentTarget.style.display = "none"; }}/>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Publish date & time<input type="datetime-local" value={draft.published_at} onChange={e => update("published_at", e.target.value)} className={field}/><span className="mt-1 block text-xs font-normal text-slate-500">Leave blank to publish immediately when you choose Publish.</span></label>
              <label className={label}>Expiry date & time<input type="datetime-local" value={draft.expires_at} onChange={e => update("expires_at", e.target.value)} className={field}/><span className="mt-1 block text-xs font-normal text-slate-500">Optional automatic expiry on the public site.</span></label>
            </div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-extrabold">Search appearance (optional)</p><label className={label + " mt-3"}>SEO title<input value={draft.seo_title} onChange={e => update("seo_title", e.target.value)} maxLength={160} placeholder="Search-result title" className={field}/></label><label className={label + " mt-3"}>SEO description<textarea value={draft.seo_description} onChange={e => update("seo_description", e.target.value)} maxLength={320} rows={2} placeholder="Short description for search engines" className={field}/></label></div>\n            {draft.content_type === "page" && <p className="rounded-lg bg-sky-50 p-3 text-xs leading-5 text-sky-900">After publishing, this managed page will be available at /pages/{makeSlug(draft.slug) || "your-page-slug"}.</p>}\n            <label className={label}>Display order<input type="number" value={draft.sort_order} onChange={e => update("sort_order", e.target.value)} min={-10000} max={10000} className={field}/></label>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <button type="submit" disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-900 px-4 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50"><Save size={16}/>{saving ? "Saving…" : "Save draft"}</button>
              <button type="button" disabled={saving} onClick={() => void save(true)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><UploadCloud size={16}/>{saving ? "Saving…" : "Publish / Schedule"}</button>
              {editingId && <button type="button" onClick={startNew} className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-slate-50">Cancel edit</button>}
            </div>
          </form>
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><p className="text-sm font-extrabold">Live content preview</p><p className="text-xs text-slate-500">A preview of the public content card</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">{TYPES.find(t => t.value === draft.content_type)?.label ?? "Content"}</span></div>
            {draft.image_url && <img src={draft.image_url} alt={draft.image_alt} className="max-h-48 w-full object-cover"/>}
            <div className="p-4"><h3 className="text-lg font-extrabold text-slate-900">{draft.title.trim() || "Your title will appear here"}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{draft.summary.trim() || "Your short introduction will appear here."}</p>{draft.body.trim() && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft.body}</p>}</div>
          </section>
          <div className="mt-5 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-950"><p className="flex items-center gap-2 font-bold"><Eye size={15}/> Publishing safeguards</p><p className="mt-1">Drafts remain private. Scheduled items become public only when their publication time arrives. Unpublishing retains the record; nothing is permanently deleted from this screen.</p></div>
        </article>
      </section>

      <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldCheck size={18} className="mt-0.5 shrink-0"/> Website editing is restricted by RESA's existing administrator / proprietor database policies. This manager controls public content only; it cannot change authentication, payments, user permissions or application security settings.</p>
      <p className="mt-3 text-center text-xs text-slate-500">RESA School Portal · Website Control Centre · Changes are saved to the school's secured content records.</p>
    </div>
  </main>;
}
