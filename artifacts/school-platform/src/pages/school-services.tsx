import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, Database, Search, ShieldCheck, Upload, FileText, Download, Trash2, FolderOpen, Eye, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ModuleDefinition = { key: string; title: string; description: string; table: string };
const MODULES: ModuleDefinition[] = [
  { key: "fees", title: "Fees & Payments", description: "Fee types, student charges, payments and receipts.", table: "student_fee_assignments" },
  { key: "timetable", title: "Class Timetable", description: "Class schedules and timetable periods.", table: "class_timetables" },
  { key: "library", title: "Library", description: "Library books, loans and fines.", table: "library_books" },
  { key: "inventory", title: "Inventory & Assets", description: "School stock and asset records.", table: "inventory_items" },
  { key: "transport", title: "Transport", description: "Vehicles, routes, pickup points and student assignments.", table: "transport_routes" },
  { key: "payroll", title: "Staff Payroll & Leave", description: "Payroll, leave requests and staff appraisal records.", table: "staff_payroll" },
  { key: "admissions", title: "Admissions", description: "Admission applications, documents and payment records.", table: "admission_applications" },
  { key: "drive", title: "RESA Drive", description: "Upload, organize and securely download school files, videos, images and teaching resources.", table: "resa_drive_files" },
  { key: "biometric", title: "Biometric Attendance", description: "Registered devices and attendance event records.", table: "biometric_devices" },
];
type RowRecord = Record<string, unknown>;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const safeFileName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(-160) || "file";
const describeUploadError = (error: unknown) => {
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [value.message, value.code, value.details, value.hint]
      .filter((part) => typeof part === "string" && part.trim())
      .map((part) => String(part).trim());
    if (parts.length) return [...new Set(parts)].join(" · ");
  }
  return error instanceof Error ? error.message : "Unknown upload error";
};

// Android may suspend/remount the page while the system file picker is open.
// Keep the selected File in IndexedDB so returning from the picker does not
// silently clear the selection before the user can upload it.
const PENDING_DRIVE_DB = "resa-drive-pending-uploads";
const PENDING_DRIVE_STORE = "files";
function openPendingDriveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Local file recovery is unavailable in this browser.")); return; }
    const request = indexedDB.open(PENDING_DRIVE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PENDING_DRIVE_STORE)) request.result.createObjectStore(PENDING_DRIVE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local upload recovery."));
  });
}
async function savePendingDriveFile(schoolId: string, file: File): Promise<void> {
  const db = await openPendingDriveDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_DRIVE_STORE, "readwrite");
      tx.objectStore(PENDING_DRIVE_STORE).put(file, schoolId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save the selected file locally."));
      tx.onabort = () => reject(tx.error ?? new Error("Local file recovery was interrupted."));
    });
  } finally { db.close(); }
}
async function getPendingDriveFile(schoolId: string): Promise<File | null> {
  const db = await openPendingDriveDb();
  try {
    return await new Promise<File | null>((resolve, reject) => {
      const tx = db.transaction(PENDING_DRIVE_STORE, "readonly");
      const request = tx.objectStore(PENDING_DRIVE_STORE).get(schoolId);
      request.onsuccess = () => resolve(request.result instanceof File ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Could not recover the selected file."));
    });
  } finally { db.close(); }
}
async function clearPendingDriveFile(schoolId: string): Promise<void> {
  const db = await openPendingDriveDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_DRIVE_STORE, "readwrite");
      tx.objectStore(PENDING_DRIVE_STORE).delete(schoolId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not clear the local upload copy."));
    });
  } finally { db.close(); }
}

export default function SchoolServicesPage({ schoolId }: { schoolId: string }) {
  // Always reopen this page on RESA Drive. Android file pickers can resume
  // the web app by remounting the route; restoring a previously selected
  // Fees module made the upload form disappear immediately after file choice.
  const [activeKey, setActiveKey] = useState("drive");
  useEffect(() => {
    try {
      window.sessionStorage.setItem("resa-school-services-active-module", activeKey);
    } catch {
      // Keep the page usable when browser storage is unavailable.
    }
  }, [activeKey]);
  const [rows, setRows] = useState<RowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoringFile, setRestoringFile] = useState(true);
  const [savingFile, setSavingFile] = useState(false);
  const [folderName, setFolderName] = useState("General");
  const [driveVisibility, setDriveVisibility] = useState<"school" | "private">("school");
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const active = MODULES.find(m => m.key === activeKey) ?? MODULES[0];
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const query = db.from(active.table).select("*").eq("school_id", schoolId).limit(100);
      const result = activeKey === "drive" ? await query.order("created_at", { ascending: false }) : await query;
      if (result.error) throw result.error;
      const records = (result.data ?? []) as RowRecord[];
      if (activeKey === "drive") {
        // A failed preview URL for one old/moved file must never hide the
        // entire Drive register. Keep every metadata row visible and let the
        // administrator open/download the affected file to see a clear error.
        const mediaRecords = await Promise.all(records.map(async (row) => {
          try {
            const mime = String(row.mime_type ?? "").toLowerCase();
            const path = String(row.storage_path ?? "");
            if (!path || !(mime.startsWith("image/") || mime.startsWith("video/"))) return row;
            const signed = await db.storage.from("resa-drive").createSignedUrl(path, 1800);
            return signed.error || !signed.data?.signedUrl ? row : { ...row, preview_url: signed.data.signedUrl };
          } catch {
            return row;
          }
        }));
        setRows(mediaRecords);
      } else {
        setRows(records);
      }
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "This module could not be loaded. Check its schema and school access policies.");
    } finally { setLoading(false); }
  }, [active.table, activeKey, schoolId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let mounted = true;
    void getPendingDriveFile(schoolId).then(file => {
      if (mounted && file) {
        setSelectedFile(file);
        setNotice(`Recovered “${file.name}” from this device. Press Upload file to continue.`);
      }
    }).catch(() => {
      if (mounted) setNotice("Choose your file again if a previous selection was lost. Keep this page open until upload completes.");
    }).finally(() => { if (mounted) setRestoringFile(false); });
    return () => { mounted = false; };
  }, [schoolId]);
  const uploadFile = async () => {
    let fileToUpload = selectedFile;
    if (!fileToUpload) {
      try { fileToUpload = await getPendingDriveFile(schoolId); } catch { /* A fresh selection can still be uploaded. */ }
    }
    if (!fileToUpload) {
      setError("Your file selection was not retained. Please choose it again, wait for its name to appear, then upload.");
      return;
    }
    if (fileToUpload.size > MAX_FILE_BYTES) { setError("This file is larger than the 50 MB limit on the current Supabase Free plan. Compress it or choose a smaller file."); return; }
    setUploading(true); setError(""); setNotice(""); setUploadStage("Checking your school account");
    const db = getSupabaseClient() as any;
    let uploadedPath = "";
    let stage = "checking your school account";
    try {
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error("Your session has expired. Sign in again and retry.");
      const cleanedName = safeFileName(fileToUpload.name);
      stage = "uploading the file to secure storage"; setUploadStage("Uploading file to secure storage");
      uploadedPath = `${schoolId}/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${cleanedName}`;
      const storageResult = await db.storage.from("resa-drive").upload(uploadedPath, fileToUpload, {
        contentType: fileToUpload.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
      if (storageResult.error) throw storageResult.error;
      stage = "saving the file register"; setUploadStage("Saving file details");
      const metadataResult = await db.from("resa_drive_files").insert({
        school_id: schoolId,
        uploaded_by: authData.user.id,
        file_name: cleanedName,
        original_name: fileToUpload.name,
        storage_path: uploadedPath,
        folder_name: folderName.trim() || "General",
        mime_type: fileToUpload.type || "application/octet-stream",
        file_size: fileToUpload.size,
        visibility: driveVisibility,
        published_to_website: false,
        is_active: true,
      });
      if (metadataResult.error) {
        const cleanup = await db.storage.from("resa-drive").remove([uploadedPath]);
        if (cleanup.error) throw new Error(`File details were rejected (${describeUploadError(metadataResult.error)}). Storage cleanup also failed (${describeUploadError(cleanup.error)}); contact the administrator before retrying.`);
        throw metadataResult.error;
      }
      setSelectedFile(null);
      try { await clearPendingDriveFile(schoolId); } catch { /* Cloud upload and metadata are already saved. */ }
      setDriveVisibility("school");
      const picker = document.getElementById("resa-drive-file-picker") as HTMLInputElement | null;
      if (picker) picker.value = "";
      setUploadStage("");
      setNotice(`Uploaded “${fileToUpload.name}” successfully.`);
      await load();
    } catch (e) {
      setError(`RESA Drive failed while ${stage}: ${describeUploadError(e)}. Check your connection and school administrator access, then retry.`);
      setUploadStage("");
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
  const previewFile = async (row: RowRecord) => {
    const path = String(row.storage_path ?? "");
    const mime = String(row.mime_type ?? "").toLowerCase();
    if (!path || !(mime.startsWith("image/") || mime.startsWith("video/"))) return;
    setPreviewLoading(String(row.id ?? path)); setError("");
    try {
      const { data, error: signedError } = await (getSupabaseClient() as any).storage.from("resa-drive").createSignedUrl(path, 120);
      if (signedError) throw signedError;
      if (!data?.signedUrl) throw new Error("A secure preview link could not be created.");
      setPreview({ url: data.signedUrl, mime, name: String(row.original_name ?? row.file_name ?? "RESA Drive media") });
    } catch (e) { setError(e instanceof Error ? e.message : "Preview could not be opened."); }
    finally { setPreviewLoading(null); }
  };
  const toggleDriveVisibility = async (row: RowRecord) => {
    const nextVisibility = String(row.visibility ?? "private") === "school" ? "private" : "school";
    setError(""); setNotice("");
    try {
      const { error: updateError } = await (getSupabaseClient() as any).from("resa_drive_files")
        .update({ visibility: nextVisibility })
        .eq("id", String(row.id)).eq("school_id", schoolId);
      if (updateError) throw updateError;
      setNotice(nextVisibility === "school" ? "File shared with authorised RESA portal members." : "File returned to administrator-only visibility.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "File visibility could not be updated."); }
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
      <div className="flex items-center gap-3"><Database size={28}/><div><p className="text-xs uppercase tracking-widest text-green-200">RESA School Portal</p><h1 className="text-2xl font-bold sm:text-3xl">Additional School Services</h1></div></div>
      <p className="mt-2 max-w-3xl text-sm text-green-100">School-scoped records and secure file storage for authorised school administrators.</p>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border bg-white p-3 shadow-sm"><h2 className="px-3 py-2 font-bold">Modules</h2>{MODULES.map(m=><button type="button" key={m.key} onClick={()=>{setActiveKey(m.key);setSearch("");setError("");setNotice("");}} className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-sm ${activeKey===m.key?"bg-green-900 font-semibold text-white":"hover:bg-green-50"}`}><span className="block">{m.title}</span><span className={`mt-1 block text-xs ${activeKey===m.key?"text-green-100":"text-slate-500"}`}>{m.description}</span></button>)}</aside>
      <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{active.title}</h2><p className="mt-1 text-sm text-slate-600">{active.description}</p><p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={14}/> Admin-only uploads · private storage · 50 MB per file</p></div><div className="flex flex-wrap gap-2">{activeKey==="fees"&&<Link href="/fees-management" className="rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white">Open fee management</Link>}{activeKey==="biometric"&&<Link href="/biometric-attendance" className="rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white">Open Smart Attendance Centre</Link>}<button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div></div>
        {error&&<div role="alert" className="mt-4 break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        {activeKey==="drive" ? <>
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
            <h3 className="flex items-center gap-2 font-bold text-emerald-950"><Upload size={18}/> Upload to RESA Drive</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Supports photos, videos, PDFs, Office documents, audio and ZIP files up to 50 MB. Choose whether a file is visible to authorised school members or administrators only. Google Drive is not required.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Folder
                <input value={folderName} onChange={e=>setFolderName(e.target.value)} maxLength={80} placeholder="e.g. Videos, School Documents" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-700"/>
              </label>
              <label className="block text-sm font-semibold">Who can view this file?
                <select value={driveVisibility} onChange={e=>setDriveVisibility(e.target.value as "school" | "private")} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal">
                  <option value="school">Authorised RESA portal members</option>
                  <option value="private">Administrators only</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">Choose a file
                <input id="resa-drive-file-picker" type="file" onClick={() => { try { window.sessionStorage.setItem("resa-school-services-active-module", "drive"); } catch { /* Storage may be unavailable. */ } }} onChange={async e=>{ const file=e.target.files?.[0]??null; setSelectedFile(file); setError(""); if(file){ setSavingFile(true); try { await savePendingDriveFile(schoolId,file); setNotice(`“${file.name}” is ready to upload.`); } catch { setNotice("File selected. Keep this page open while uploading; this browser could not enable recovery if Android reloads the page."); } finally { setSavingFile(false); } } }} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white p-2 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900 file:px-3 file:py-2 file:font-semibold file:text-white"/>
              </label>
            </div>
            {restoringFile&&<p className="mt-2 text-xs text-slate-500">Checking for a file selection interrupted by Android…</p>}{selectedFile&&<p className="mt-2 flex items-center gap-2 break-all text-xs text-slate-600"><FileText size={15}/>{selectedFile.name} · {formatBytes(selectedFile.size)}{savingFile?" · Saving recovery copy…":" · Ready"}</p>}
            <button type="button" onClick={()=>void uploadFile()} disabled={!selectedFile||uploading||savingFile||restoringFile} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16}/>{uploading?"Uploading securely…":"Upload file"}</button>
            {uploading&&<p role="status" aria-live="polite" className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">{uploadStage||"Working securely…"}</p>}
            <p className="mt-2 text-xs text-slate-500">Maximum size: 50 MB per file on the current Supabase Free plan. Your selected file is saved on this device to survive Android page reloads. Keep the page open until upload completes.</p>
          </div>
          <label className="my-4 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400"/><input className="min-w-0 flex-1 py-3 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files and folders…"/></label>
          {loading&&<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading files…</p>}
          {!loading&&!error&&visibleRows.length===0&&<div className="rounded-xl border border-dashed p-8 text-center"><FolderOpen className="mx-auto mb-3 text-slate-400" size={30}/><h3 className="font-semibold">Your RESA Drive is ready</h3><p className="mt-1 text-sm text-slate-500">Upload the first file or video above. Uploaded files will appear here.</p></div>}
          {!loading&&visibleRows.length>0&&<div className="mt-3 divide-y rounded-xl border">{visibleRows.map((row,i)=><div key={String(row.id??i)} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"><div className="flex min-w-0 items-start gap-3">{String(row.mime_type ?? "").startsWith("image/") && row.preview_url ? <img src={String(row.preview_url)} alt={String(row.original_name ?? "RESA Drive image")} loading="lazy" className="h-20 w-24 rounded-lg border object-cover"/> : String(row.mime_type ?? "").startsWith("video/") && row.preview_url ? <video src={String(row.preview_url)} controls playsInline preload="metadata" className="h-20 w-28 rounded-lg bg-black object-cover"/> : <span className="rounded-xl bg-emerald-50 p-2 text-emerald-900"><FileText size={20}/></span>}<div className="min-w-0"><p className="break-words font-semibold">{String(row.original_name??row.file_name??"Unnamed file")}</p><p className="mt-1 break-words text-xs text-slate-500">{String(row.folder_name??"General")} · {formatBytes(Number(row.file_size??0))} · {String(row.mime_type??"file")}</p><p className="mt-1 text-xs text-slate-400">{row.created_at?new Date(String(row.created_at)).toLocaleString():""}</p></div></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={()=>void toggleDriveVisibility(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50">{String(row.visibility ?? "private")==="school"?"Make private":"Share with school"}</button>{(String(row.mime_type ?? "").startsWith("image/") || String(row.mime_type ?? "").startsWith("video/")) && <button type="button" onClick={()=>void previewFile(row)} disabled={previewLoading===String(row.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"><Eye size={15}/>{previewLoading===String(row.id)?"Opening…":"Preview"}</button>}<button type="button" onClick={()=>void downloadFile(row)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-emerald-50"><Download size={15}/> Download</button><button type="button" onClick={()=>void deleteFile(row)} aria-label="Delete file" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={15}/><span className="hidden sm:inline">Delete</span></button></div></div>)}</div>}
        </> : <>
          <label className="my-4 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400"/><input className="min-w-0 flex-1 py-3 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search loaded records…"/></label>
          {loading&&<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading records…</p>}
          {!loading&&!error&&visibleRows.length===0&&<div className="rounded-xl border border-dashed p-8 text-center"><Database className="mx-auto mb-3 text-slate-400" size={30}/><h3 className="font-semibold">No matching records</h3><p className="mt-1 text-sm text-slate-500">{rows.length===0?"No records are available for this school in this module yet.":"Try a different search."}</p></div>}
          {!loading&&!error&&visibleRows.length>0&&<><p className="mb-3 text-xs text-slate-500">Showing {visibleRows.length} of {rows.length} loaded records.</p><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 font-semibold">Record</th><th className="px-3 py-3 font-semibold">Details</th></tr></thead><tbody>{visibleRows.map((row,i)=><tr key={String(row.id??i)} className="border-t align-top"><td className="max-w-52 break-words px-3 py-3 font-medium">{String(row.name??row.title??row.id??`Record ${i+1}`)}</td><td className="px-3 py-3"><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(row).filter(([k])=>!["school_id","id"].includes(k)).map(([k,v])=><div key={k} className="min-w-0"><dt className="text-xs text-slate-500">{label(k)}</dt><dd className="break-words">{v===null||v===undefined||v===""?"—":typeof v==="object"?JSON.stringify(v):String(v)}</dd></div>)}</dl></td></tr>)}</tbody></table></div></>}
        </>}
        <p className="mt-5 text-xs leading-5 text-slate-500">RESA Drive uploads and file deletion are restricted by existing administrator-only database and Storage policies. Downloads use short-lived private links.</p>
      </section>
    </div>
    {preview && <div role="dialog" aria-modal="true" aria-label="RESA Drive media preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={()=>setPreview(null)}><section className="relative max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-white p-3 sm:p-5" onClick={event=>event.stopPropagation()}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="min-w-0 break-words font-bold">{preview.name}</h2><button type="button" onClick={()=>setPreview(null)} aria-label="Close preview" className="rounded-lg border p-2"><X size={18}/></button></div>{preview.mime.startsWith("video/") ? <video src={preview.url} controls playsInline className="mx-auto max-h-[75vh] w-full rounded-lg bg-black" /> : <img src={preview.url} alt={preview.name} className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain" />}</section></div>}
  </main>;
}
