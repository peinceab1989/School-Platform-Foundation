import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, CircleAlert, LockKeyhole, Plus, RefreshCw, ShieldCheck, VideoOff } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type CameraRow = { id: string; school_id: string; camera_name: string; location: string; notes: string; is_enabled: boolean; created_at: string };
type ParentAccount = { id: string; parent_guardian_id: string; user_id: string; is_active: boolean; guardian?: { portal_enabled: boolean; relationship: string | null } | null };
type GrantRow = { id: string; camera_id: string; parent_guardian_id: string; is_active: boolean; granted_at: string };

export default function SchoolCctvPage({ schoolId, role = "admin" }: { schoolId: string; role?: "admin" | "parent" }) {
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [parentId, setParentId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient();
      const cameraResult = await db.from("cctv_cameras").select("id,school_id,camera_name,location,notes,is_enabled,created_at").eq("school_id", schoolId).order("location");
      if (cameraResult.error) throw cameraResult.error;
      setCameras((cameraResult.data ?? []) as CameraRow[]);
      if (role === "admin") {
        const [parentResult, grantResult] = await Promise.all([
          db.from("parent_portal_accounts").select("id,parent_guardian_id,user_id,is_active,parents_guardians!inner(portal_enabled,relationship)").eq("school_id", schoolId).eq("is_active", true),
          db.from("cctv_parent_camera_access").select("id,camera_id,parent_guardian_id,is_active,granted_at").eq("school_id", schoolId).order("granted_at", { ascending: false }),
        ]);
        if (parentResult.error) throw parentResult.error;
        if (grantResult.error) throw grantResult.error;
        setParents((parentResult.data ?? []).map((p: any) => ({...p, guardian: Array.isArray(p.parents_guardians) ? p.parents_guardians[0] : p.parents_guardians})) as ParentAccount[]);
        setGrants((grantResult.data ?? []) as GrantRow[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "CCTV records could not be loaded. Confirm the database migration has been applied.");
    } finally { setLoading(false); }
  }, [schoolId, role]);

  useEffect(() => { void load(); }, [load]);

  const addCamera = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient();
      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Sign in again.");
      const { error: insertError } = await db.from("cctv_cameras").insert({ school_id: schoolId, camera_name: name.trim(), location: location.trim(), notes: notes.trim(), created_by: user.id });
      if (insertError) throw insertError;
      setName(""); setLocation(""); setNotes(""); setNotice("Camera location added to the inventory. Live video remains unavailable until a secure camera stream is connected.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add camera location."); }
    finally { setBusy(false); }
  };

  const grantAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!parentId || !cameraId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient();
      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Sign in again.");
      const parent = parents.find(p => p.parent_guardian_id === parentId);
      if (!parent || !parent.is_active || !parent.guardian?.portal_enabled) throw new Error("Choose an active parent account with parent portal access enabled.");
      const { error: grantError } = await db.from("cctv_parent_camera_access").upsert({ school_id: schoolId, camera_id: cameraId, parent_guardian_id: parentId, is_active: true, granted_by: user.id, revoked_at: null }, { onConflict: "camera_id,parent_guardian_id" });
      if (grantError) throw grantError;
      setNotice("Parent viewing permission granted for this camera. The feed itself is not live until camera streaming is installed.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not grant parent access."); }
    finally { setBusy(false); }
  };

  const setGrantActive = async (grant: GrantRow, active: boolean) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await getSupabaseClient().from("cctv_parent_camera_access").update({ is_active: active, revoked_at: active ? null : new Date().toISOString() }).eq("id", grant.id).eq("school_id", schoolId);
      if (updateError) throw updateError;
      setNotice(active ? "Parent camera permission restored." : "Parent camera permission revoked.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Permission update failed."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#f5f7f2] text-slate-900">
    <header className="bg-gradient-to-br from-emerald-950 to-emerald-700 text-white"><div className="mx-auto max-w-5xl px-4 py-6">
      <Link href={role === "admin" ? "/dashboard" : "/portal"} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-50"><ArrowLeft size={16}/> {role === "admin" ? "Admin dashboard" : "Parent portal"}</Link>
      <div className="mt-5 flex items-center gap-3"><span className="rounded-2xl bg-white/10 p-3 text-amber-200"><Camera size={28}/></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA safety & visibility</p><h1 className="text-2xl font-extrabold sm:text-3xl">{role === "admin" ? "CCTV & Live Monitoring" : "Approved School Camera Views"}</h1></div></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">{role === "admin" ? "Register camera locations and control parent permissions. This dashboard does not claim a camera is online unless a secure streaming service is connected." : "Only camera locations explicitly approved for your parent account are listed. Live video will appear after the school connects its secure camera streaming service."}</p>
    </div></header>
    <section className="mx-auto max-w-5xl space-y-5 px-4 py-7">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><VideoOff size={22} className="mt-0.5 shrink-0"/><div><p className="font-extrabold">Live video is not connected yet</p><p className="mt-1 text-sm leading-6">RESA has not installed its CCTV cameras. This page currently manages camera locations and approval records only. It does not show simulated footage. A real installation will require a secured streaming gateway, authentication, and camera/NVR configuration.</p></div></div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><CircleAlert size={17} className="mr-2 inline"/>{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Camera locations</h2><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-50"><RefreshCw size={15}/> Refresh</button></div>
      {loading ? <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading camera permissions…</div> : cameras.length === 0 ? <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">No camera locations registered yet.</div> : <div className="grid gap-3 sm:grid-cols-2">{cameras.map(c => <article key={c.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{c.camera_name}</h3><p className="mt-1 text-sm text-slate-600">{c.location}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">Not connected</span></div>{c.notes && <p className="mt-3 text-sm leading-6 text-slate-600">{c.notes}</p>}{role === "parent" && <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14}/> Access approved · live stream not installed</p>}</article>)}</div>}
      {role === "admin" && <>
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-lg font-extrabold"><Plus size={19}/> Register a camera location</h2><p className="mt-1 text-sm text-slate-600">Use this to prepare the inventory before cameras are installed. Do not enter passwords or private camera stream URLs.</p><form onSubmit={addCamera} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Camera label<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Main entrance" className="mt-1 block w-full rounded-xl border px-3 py-3 font-normal"/></label><label className="text-sm font-bold">Location<input required minLength={2} maxLength={160} value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Main gate" className="mt-1 block w-full rounded-xl border px-3 py-3 font-normal"/></label><label className="text-sm font-bold sm:col-span-2">Notes (optional)<input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Purpose or installation note" className="mt-1 block w-full rounded-xl border px-3 py-3 font-normal"/></label><button disabled={busy} className="rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saving…" : "Add camera location"}</button></form></section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck size={20}/> Parent viewing approvals</h2><p className="mt-1 text-sm leading-6 text-slate-600">Only active parent portal accounts with portal access enabled can be granted a camera. Grants do not create a live stream or give access to other cameras.</p>
          <form onSubmit={grantAccess} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-sm font-bold">Parent account<select required value={parentId} onChange={e=>setParentId(e.target.value)} className="mt-1 block w-full rounded-xl border bg-white px-3 py-3 font-normal"><option value="">Select parent</option>{parents.filter(p=>p.guardian?.portal_enabled).map(p=><option key={p.parent_guardian_id} value={p.parent_guardian_id}>Parent account · {p.user_id.slice(0,8)}… ({p.guardian?.relationship || "Guardian"})</option>)}</select></label><label className="text-sm font-bold">Camera location<select required value={cameraId} onChange={e=>setCameraId(e.target.value)} className="mt-1 block w-full rounded-xl border bg-white px-3 py-3 font-normal"><option value="">Select camera</option>{cameras.map(c=><option key={c.id} value={c.id}>{c.camera_name} — {c.location}</option>)}</select></label><button disabled={busy || !parents.length || !cameras.length} className="rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Approve parent"}</button></form>
          <h3 className="mt-6 font-extrabold">Current approvals</h3>{grants.length===0 ? <p className="mt-2 text-sm text-slate-500">No parent camera permissions yet.</p> : <div className="mt-3 space-y-2">{grants.map(g=>{const c=cameras.find(x=>x.id===g.camera_id);const p=parents.find(x=>x.parent_guardian_id===g.parent_guardian_id);return <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="text-sm"><p className="font-bold">{c?.camera_name || "Camera"} — {c?.location || "Location"}</p><p className="mt-1 text-xs text-slate-500">Parent account · {p?.user_id.slice(0,8) || g.parent_guardian_id.slice(0,8)}…</p><span className={`mt-1 inline-block text-xs font-bold ${g.is_active ? "text-emerald-800" : "text-rose-700"}`}>{g.is_active ? "Access approved" : "Access revoked"}</span></div><button type="button" disabled={busy} onClick={()=>void setGrantActive(g,!g.is_active)} className="rounded-lg border px-3 py-2 text-xs font-bold">{g.is_active ? "Revoke access" : "Restore access"}</button></div>})}</div>}
        </section>
      </>}
      <p className="flex items-start gap-2 pb-4 text-xs leading-5 text-slate-500"><LockKeyhole size={14} className="mt-0.5 shrink-0"/> Camera metadata and approvals are protected by Supabase row-level security. Live video must be delivered through an authenticated streaming gateway, never by exposing public camera URLs or recorder credentials.</p>
    </section>
  </main>;
}
