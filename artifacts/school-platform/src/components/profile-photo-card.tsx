import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

const BUCKET = "resa-profile-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Props = { userId: string; displayName?: string; roleLabel: string };

export default function ProfilePhotoCard({ userId, displayName, roleLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const savedPath = typeof data.user?.user_metadata?.resa_profile_photo_path === "string"
      ? data.user.user_metadata.resa_profile_photo_path : "";
    if (!savedPath || !savedPath.startsWith(userId + "/")) {
      setPath(""); setPhotoUrl(""); return;
    }
    const { data: signed, error: signedError } = await client.storage.from(BUCKET).createSignedUrl(savedPath, 3600);
    if (signedError) throw signedError;
    setPath(savedPath); setPhotoUrl(signed.signedUrl);
  }, [userId]);

  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "Profile photo could not be loaded.")); }, [load]);

  async function upload(file?: File) {
    if (!file) return;
    setError(""); setMessage("");
    if (!ACCEPTED.includes(file.type)) { setError("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > MAX_BYTES) { setError("The photo must be 5 MB or smaller."); return; }
    setBusy(true);
    try {
      const client = getSupabaseClient();
      const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const nextPath = userId + "/profile." + extension;
      const { error: uploadError } = await client.storage.from(BUCKET).upload(nextPath, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await client.auth.updateUser({ data: { resa_profile_photo_path: nextPath } });
      if (metadataError) throw metadataError;
      await load();
      setMessage("Your profile photograph has been updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Photo upload failed. Please try again."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function remove() {
    if (!path || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const client = getSupabaseClient();
      const { error: removeError } = await client.storage.from(BUCKET).remove([path]);
      if (removeError) throw removeError;
      const { error: metadataError } = await client.auth.updateUser({ data: { resa_profile_photo_path: null } });
      if (metadataError) throw metadataError;
      setPath(""); setPhotoUrl(""); setMessage("Your profile photograph has been removed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove the photograph."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5" aria-label="Profile photograph">
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-emerald-100 bg-emerald-50">
        {photoUrl ? <img src={photoUrl} alt={displayName ? displayName + " profile photograph" : "Your profile photograph"} className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9 text-emerald-800" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">My profile photograph</p>
        <h2 className="mt-1 truncate text-base font-extrabold text-slate-900">{displayName || "Your profile"}</h2>
        <p className="mt-1 text-sm text-slate-600">{roleLabel} account · JPG, PNG or WebP · up to 5 MB</p>
      </div>
    </div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : photoUrl ? <Camera className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
        {busy ? "Please wait…" : photoUrl ? "Change photograph" : "Upload photograph"}
      </button>
      {photoUrl && <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-800 disabled:opacity-60"><Trash2 className="h-4 w-4" /> Remove</button>}
    </div>
    {message && <p role="status" className="mt-3 text-sm font-medium text-emerald-800">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
  </section>;
}
