import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FileText, RefreshCw, Image as ImageIcon, Video } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type DriveFile = {
  id: string;
  original_name: string;
  storage_path: string;
  folder_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string;
};

export default function SharedResaDrivePage({ schoolId, backHref = "/dashboard" }: { schoolId: string; backHref?: string }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const result = await db.from("resa_drive_files")
        .select("id,original_name,storage_path,folder_name,mime_type,file_size,created_at")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .eq("visibility", "school")
        .order("created_at", { ascending: false })
        .limit(100);
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as DriveFile[];
      const withLinks = await Promise.all(rows.map(async (row) => {
        try {
          const signed = await db.storage.from("resa-drive").createSignedUrl(row.storage_path, 3600);
          return signed.error || !signed.data?.signedUrl ? row : { ...row, signed_url: signed.data.signedUrl };
        } catch {
          return row;
        }
      }));
      setFiles(withLinks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shared RESA Drive files could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const formatSize = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return "Size unavailable";
    return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-950 p-5 text-white sm:p-6">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100"><ArrowLeft size={16}/> Back to dashboard</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA School Portal</p>
          <h1 className="mt-1 text-2xl font-extrabold">Shared RESA Drive</h1>
          <p className="mt-1 max-w-2xl text-sm text-emerald-100">Photos, videos and learning files shared by the school. Private administrator files are not shown here.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-bold disabled:opacity-60"><RefreshCw size={15}/> Refresh</button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p className="rounded-xl bg-white p-6 text-sm text-slate-600">Loading shared files…</p> : !files.length ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <FileText className="mx-auto text-emerald-800" size={34}/>
        <h2 className="mt-3 font-bold text-slate-900">No files have been shared yet</h2>
        <p className="mt-1 text-sm text-slate-600">When the administrator uploads a file and chooses “Authorised RESA portal members”, it will appear here.</p>
      </section> : <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {files.map(file => {
          const mime = String(file.mime_type ?? "").toLowerCase();
          const isImage = mime.startsWith("image/");
          const isVideo = mime.startsWith("video/");
          return <article key={file.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {file.signed_url && isImage ? <a href={file.signed_url} target="_blank" rel="noreferrer" className="block bg-slate-100"><img src={file.signed_url} alt={file.original_name} loading="lazy" className="h-52 w-full object-cover"/></a>
              : file.signed_url && isVideo ? <video src={file.signed_url} controls playsInline preload="metadata" className="h-52 w-full bg-black object-contain"/>
              : <div className="flex h-36 items-center justify-center bg-emerald-50 text-emerald-900">{isImage ? <ImageIcon size={42}/> : isVideo ? <Video size={42}/> : <FileText size={42}/>}</div>}
            <div className="space-y-2 p-4">
              <p className="break-words font-bold text-slate-900">{file.original_name}</p>
              <p className="text-xs text-slate-500">{file.folder_name} · {formatSize(file.file_size)}</p>
              <p className="text-xs text-slate-500">{new Date(file.created_at).toLocaleDateString()}</p>
              {file.signed_url ? <a href={file.signed_url} target="_blank" rel="noreferrer" download={file.original_name} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"><Download size={15}/> Open / download</a> : <p className="text-xs text-amber-800">This file could not be opened. Please ask the administrator to check its storage record.</p>}
            </div>
          </article>;
        })}
      </section>}
      <p className="text-center text-xs text-slate-500">Shared files are available only to signed-in members of this RESA school. Google Drive is not required.</p>
    </div>
  </main>;
}
