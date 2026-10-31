import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, Database, Search, ShieldCheck, Upload, FileText, Download, Trash2, FolderOpen } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ModuleDefinition = { key: string; title: string; description: string; table: string };
const MODULES: ModuleDefinition[] = [
  { key: "drive", title: "RESA Drive", description: "Upload, organize and securely download school files, videos, images and teaching resources.", table: "resa_drive_files" },
];
type RowRecord = Record<string, unknown>;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const safeFileName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(-160) || "file";

export default function SchoolServicesPage({ schoolId }: { schoolId: string }) {
  const [activeKey, setActiveKey] = useState(MODULES[0].key);
  const [rows, setRows] = useState<RowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState("General");
  const [uploading, setUploading] = useState(false);
  const active = MODULES.find(m => m.key === activeKey) ?? MODULES[0];
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const query = db.from(active.table).select("*").eq("school_id", schoolId).limit(100);
      const result = activeKey === "drive" ? await query.order("created_at", { ascending: false }) : await query;
      if (result.error) throw result.error;
      setRows((result.data ?? []) as RowRecord[]);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "This module could not be loaded. Check its schema and school access policies.");
    } finally { setLoading(false); }
  }, [active.table, schoolId]);
  useEffect(() => { void load(); }, [load]);
  const uploadFile = async () => {
    if (!selectedFile) { setError("Choose a file before uploading."); return; }
    if (selectedFile.size > MAX_FILE_BYTES) { setError("This file is larger than the 100 MB limit. Compress it or choose a smaller file."); return; }
    setUploading(true); setError(""); setNotice("");
    const db = getSupabaseClient() as any;
    let uploadedPath = "";
    try {
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error("Your session has expired. Sign in again and retry.");
      const cleanedName = safeFileName(selectedFile.name);
      uploadedPath = `${schoolId}/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${cleanedName}`;
      const storageResult = await db.storage.from("resa-drive").upload(uploadedPath, selectedFile, {
        contentType: selectedFile.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
      if (storageResult.error) throw storageResult.error;
      const metadataResult = await db.from("resa_drive_files").insert({
        school_id: schoolId,
        uploaded_by: authData.user.id,
        file_name: cleanedName,
        original_name: selectedFile.name,
        storage_path: uploadedPath,
        folder_name: folderName.trim() || "General",
        mime_type: selectedFile.type || "application/octet-stream",
        file_size: selectedFile.size,
        visibility: "private",
        published_to_website: false,
        is_active: true,
      });
      if (metadataResult.error) {
        await db.storage.from("resa-drive").remove([uploadedPath]);
        uploadedPath = "";
        throw metadataResult.error;
      }
      setSelectedFile(null);
      const picker = document.getElementById("resa-drive-file-picker") as HTMLInputElement | null;
      if (picker) picker.value = "";
      setNotice(`Uploaded “${selectedFile.name}” successfully.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Check your connection and try again.");
    } finally { setUploading(false); }
  };
  const downloadFile = async (row: RowRecord) => {
    setError(""); setNotice("");
    try {
      const path = String(row.storage_path ?? "");
      if (!path) throw new Error("This record has no storage path.");
      const { data, error: signedError } = await (getSupabaseClient() as any).storage.from("resa-drive").createSignedUrl(path, 60);
      if (signedError) throw signedError;
      if (!data?.signedUrl) throw new Error("A secure download link could not be created.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); }
  };
  const deleteFile = async (row: RowRecord) => {
    if (!window.confirm(`Delete “${String(row.original_name ?? row.file_name ?? "this file")}” from RESA Drive? This cannot be undone.`)) return;
    setError(""); setNotice("");
    const db = getSupabaseClient() as any;
    try {
      const path = String(row.storage_path ?? "");
      const removeResult = await db.storage.from("resa-drive").remove([path]);
      if (removeResult.error) throw removeResult.error;
      const metadataResult = await db.from("resa_drive_files").delete().eq("id", String(row.id)).eq("school_id", schoolId);
      if (metadataResult.error) throw metadataResult.error;
      setNotice("File deleted.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The file could not be deleted."); }
  };
  const visibleRows = rows.filter(row => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  const label = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-green-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-green-100"><ArrowLeft size={16}/> Back to dashboard</Link>
      <div className="flex items-center gap-3"><Database size={28}/><div><p className="text-xs uppercase tracking-widest text-green-200">RESA School Portal</p><h1 className="text-2xl font-bold sm:text-3xl">RESA Drive</h1></div></div>
      <p className="mt-2 max-w-3xl text-sm text-green-100">Private, school-scoped file storage for authorised administrators. Other service modules will return when their full workflows are ready.</p>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border bg-white p-3 shadow-sm"><h2 className="px-3 py-2 font-bold">Private files</h2>{MODULES.map(m=><button key={m.key} onClick={()=>{setActiveKey(m.key);setSearch("");setError("");setNotice("");}} className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-sm ${activeKey===m.key?"bg-green-900 font-semibold text-white":"hover:bg-green-50"}`}><span className="block">{m.title}</span><span className={`mt-1 block text-xs ${activeKey===m.key?"text-green-100":"text-slate-500"}`}>{m.description}</span></button>)}</aside>
      <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{active.title}</h2><p className="mt-1 text-sm text-slate-600">{active.description}</p><p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={14}/> Admin-only uploads · private storage · 100 MB per file</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div>
        {error&&<div role="alert" className="mt-4 break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        {activeKey==="drive" ? <>
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
            <h3 className="flex items-center gap-2 font-bold text-emerald-950"><Upload size={18}/> Upload to RESA Drive</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Supports videos, photos, PDFs, Word/Excel/PowerPoint files, audio, ZIP archives and other file types. Files remain private unless a separate publishing workflow is explicitly used.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Folder
                <input value={folderName} onChange={e=>setFolderName(e.target.value)} maxLength={80} placeholder="e.g. Videos, School Documents" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-700"/>
              </label>
              <label className="block text-sm font-semibold">Choose a file
                <input id="resa-drive-file-picker" type="file" onChange={e=>setSelectedFile(e.target.files?.[0]??null)} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white p-2 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900 file:px-3 file:py-2 file:font-semibold file:text-white"/>
              </label>
            </div>
            {selectedFile&&<p className="mt-2 flex items-center gap-2 break-all text-xs text-slate-600"><FileText size={15}/>{selectedFile.name} · {formatBytes(selectedFile.size)}</p>}
            <button type="button" onClick={()=>void uploadFile()} disabled={!selectedFile||uploading} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16}/>{uploading?"Uploading securely…":"Upload file"}</button>
            <p className="mt-2 text-xs text-slate-500">Maximum size: 100 MB per file. Keep this page open until the upload completes.</p>
          </div>
          <label className="my-4 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400"/><input className="min-w-0 flex-1 py-3 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files and folders…"/></label>
          {loading&&<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading files…</p>}
          {!loading&&!error&&visibleRows.length===0&&<div className="rounded-xl border border-dashed p-8 text-center"><FolderOpen className="mx-auto mb-3 text-slate-400" size={30}/><h3 className="font-semibold">Your RESA Drive is ready</h3><p className="mt-1 text-sm text-slate-500">Upload the first file or video above. Uploaded files will appear here.</p></div>}
          {!loading&&visibleRows.length>0&&<div className="mt-3 divide-y rounded-xl border">{visibleRows.map((row,i)=><div key={String(row.id??i)} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-900"><FileText size={20}/></span><div className="min-w-0"><p className="break-words font-semibold">{String(row.original_name??row.file_name??"Unnamed file")}</p><p className="mt-1 break-words text-xs text-slate-500">{String(row.folder_name??"General")} · {formatBytes(Number(row.file_size??0))} · {String(row.mime_type??"file")}</p><p className="mt-1 text-xs text-slate-400">{row.created_at?new Date(String(row.created_at)).toLocaleString():""}</p></div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={()=>void downloadFile(row)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-emerald-50"><Download size={15}/> Download</button><button type="button" onClick={()=>void deleteFile(row)} aria-label="Delete file" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={15}/><span className="hidden sm:inline">Delete</span></button></div></div>)}</div>}
        </> : <>
          <label className="my-4 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400"/><input className="min-w-0 flex-1 py-3 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search loaded records…"/></label>
          {loading&&<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading records…</p>}
          {!loading&&!error&&visibleRows.length===0&&<div className="rounded-xl border border-dashed p-8 text-center"><Database className="mx-auto mb-3 text-slate-400" size={30}/><h3 className="font-semibold">No matching records</h3><p className="mt-1 text-sm text-slate-500">{rows.length===0?"No records are available for this school in this module yet.":"Try a different search."}</p></div>}
          {!loading&&!error&&visibleRows.length>0&&<><p className="mb-3 text-xs text-slate-500">Showing {visibleRows.length} of {rows.length} loaded records.</p><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 font-semibold">Record</th><th className="px-3 py-3 font-semibold">Details</th></tr></thead><tbody>{visibleRows.map((row,i)=><tr key={String(row.id??i)} className="border-t align-top"><td className="max-w-52 break-words px-3 py-3 font-medium">{String(row.name??row.title??row.id??`Record ${i+1}`)}</td><td className="px-3 py-3"><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(row).filter(([k])=>!["school_id","id"].includes(k)).map(([k,v])=><div key={k} className="min-w-0"><dt className="text-xs text-slate-500">{label(k)}</dt><dd className="break-words">{v===null||v===undefined||v===""?"—":typeof v==="object"?JSON.stringify(v):String(v)}</dd></div>)}</dl></td></tr>)}</tbody></table></div></>}
        </>}
        <p className="mt-5 text-xs leading-5 text-slate-500">RESA Drive uploads and file deletion are restricted by existing administrator-only database and Storage policies. Downloads use short-lived private links.</p>
      </section>
    </div>
  </main>;
}
