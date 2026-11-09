import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import QrCodeDisplay from "@/components/qr-code-display";

type PersonOption = { id: string; user_id: string | null; label: string; type: "student" | "staff"; is_active: boolean };
type ParentOption = { id: string; label: string; userId: string | null };
type CardData = {
  kind: "staff" | "parent";
  name: string;
  reference: string;
  role: string;
  department: string;
  children: string[];
  photoUrl: string;
  payload: string;
};

const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";

function createCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then((digest) => ({
    token,
    hash: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""),
  }));
}

async function loadProfilePhoto(client: any, userId: string | null): Promise<string> {
  if (!userId) return "";
  try {
    const { data: files, error: listError } = await client.storage.from("resa-profile-photos").list(userId, { limit: 20 });
    if (listError) return "";
    const photo = (files ?? []).find((file: any) => /^profile\.(jpg|png|webp)$/i.test(file.name));
    if (!photo) return "";
    const { data, error } = await client.storage.from("resa-profile-photos").createSignedUrl(userId + "/" + photo.name, 3600);
    return error ? "" : data?.signedUrl ?? "";
  } catch {
    return "";
  }
}

export default function SmartAccessIdCards({
  schoolId,
  people,
  parentOptions,
  staffQrEnabled,
  parentQrEnabled,
}: {
  schoolId: string;
  people: PersonOption[];
  parentOptions: ParentOption[];
  staffQrEnabled: boolean;
  parentQrEnabled: boolean;
}) {
  const [staffId, setStaffId] = useState("");
  const [parentId, setParentId] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoomQr, setZoomQr] = useState(false);

  async function loadExistingStaffCard() {
    const person = people.find((item) => item.id === staffId && item.type === "staff" && item.is_active);
    if (!person) { setError("Select a staff member."); return; }
    setBusy("staff"); setError(""); setNotice(""); setCard(null);
    try {
      const client = getSupabaseClient() as any;
      const { data: staff, error: staffError } = await client.from("staff")
        .select("staff_number,job_title,department,person_id,user_id")
        .eq("school_id", schoolId).eq("id", person.id).maybeSingle();
      if (staffError) throw staffError;
      if (!staff) throw new Error("The selected staff record could not be found.");
      const { data: credentialId, error: qrError } = await client.rpc("resa_get_active_attendance_qr", {
        p_school_id: schoolId, p_person_type: "staff", p_person_id: person.id,
      });
      if (qrError) throw qrError;
      if (!credentialId) throw new Error("No active staff QR exists yet. Use Issue / rotate only when an administrator intends to create or replace the credential.");
      let profileUserId = person.user_id || staff.user_id || null;
      if (!profileUserId && staff.person_id) {
        const { data: linkedPerson, error: linkedError } = await client.from("people")
          .select("user_id").eq("school_id", schoolId).eq("id", staff.person_id).maybeSingle();
        if (linkedError) throw linkedError;
        profileUserId = linkedPerson?.user_id ?? null;
      }
      const photoUrl = await loadProfilePhoto(client, profileUserId);
      setCard({
        kind: "staff",
        name: person.label,
        reference: staff.staff_number || "Staff ID not assigned",
        role: staff.job_title || "Staff",
        department: staff.department || "Not specified",
        children: [],
        photoUrl,
        payload: "RESA-ID:" + credentialId,
      });
      setNotice("Existing staff ID-card QR loaded. The credential is unchanged; only an administrator can deliberately rotate it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Existing staff QR card could not be loaded.");
    } finally { setBusy(""); }
  }

  async function issueStaffCard(replaceExisting = false) {
    if (replaceExisting && !window.confirm('Create a replacement QR for this staff member? The current QR will be revoked and the replacement will require approval.')) return;
    const person = people.find((item) => item.id === staffId && item.type === "staff" && item.is_active);
    if (!person) { setError("Select a staff member."); return; }
    setBusy("staff"); setError(""); setNotice(""); setCard(null);
    try {
      const client = getSupabaseClient() as any;
      const { hash } = await createCredential();
      const { data: staff, error: staffError } = await client.from("staff")
        .select("staff_number,job_title,department")
        .eq("school_id", schoolId).eq("id", person.id).maybeSingle();
      if (staffError) throw staffError;
      if (!staff) throw new Error("The selected staff record could not be found.");
      const { data, error: rpcError } = await client.rpc("resa_issue_attendance_qr", {
        p_school_id: schoolId, p_person_type: "staff", p_person_id: person.id, p_token_hash: hash, p_replace: replaceExisting,
      });
      if (rpcError) throw rpcError;
      if (!data?.credential_id) throw new Error("The staff QR credential was not issued.");
      setNotice(data.already_exists ? "The existing staff QR for " + person.label + " was retained. Status: " + data.approval_status + ". No duplicate was created." : "A staff QR was " + (replaceExisting ? "replaced" : "created") + " for " + person.label + " and is awaiting administrator approval. After approval it will appear automatically on the staff dashboard ID card.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Staff QR card could not be issued.");
    } finally { setBusy(""); }
  }

  async function issueParentCard() {
    const parent = parentOptions.find((item) => item.id === parentId);
    if (!parent) { setError("Select an active parent portal account."); return; }
    setBusy("parent"); setError(""); setNotice(""); setCard(null);
    try {
      const client = getSupabaseClient() as any;
      const { token, hash } = await createCredential();
      const { data, error: rpcError } = await client.rpc("resa_issue_parent_qr", {
        p_school_id: schoolId, p_parent_guardian_id: parent.id, p_token_hash: hash,
      });
      if (rpcError) throw rpcError;
      if (!data?.credential_id) throw new Error("The parent QR credential was not issued.");

      const { data: links, error: linksError } = await client.from("parent_student_portal_access")
        .select("student_id").eq("school_id", schoolId).eq("parent_guardian_id", parent.id).eq("is_active", true);
      if (linksError) throw linksError;
      const studentIds = [...new Set((links ?? []).map((row: any) => row.student_id).filter(Boolean))] as string[];
      let children: string[] = [];
      if (studentIds.length) {
        const { data: students, error: studentsError } = await client.from("students")
          .select("id,person_id,admission_number").eq("school_id", schoolId).in("id", studentIds);
        if (studentsError) throw studentsError;
        const personIds = [...new Set((students ?? []).map((row: any) => row.person_id).filter(Boolean))] as string[];
        const { data: childPeople, error: peopleError } = personIds.length
          ? await client.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds)
          : { data: [], error: null };
        if (peopleError) throw peopleError;
        const names = new Map((childPeople ?? []).map((row: any) => [row.id, [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ")]));
        children = (students ?? []).map((row: any) => {
          const name = names.get(row.person_id) || "Student";
          return row.admission_number ? name + " · " + row.admission_number : name;
        });
      }
      const photoUrl = await loadProfilePhoto(client, parent.userId);
      setCard({
        kind: "parent",
        name: parent.label,
        reference: "Parent / Guardian",
        role: "Authorised parent portal account",
        department: "",
        children,
        photoUrl,
        payload: "RESA1:" + token,
      });
      setNotice("Parent QR credential issued. Any previous parent credential has been revoked. This card identifies the parent; it does not authorise child collection by itself.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parent QR card could not be issued.");
    } finally { setBusy(""); }
  }

  return <section className="rounded-2xl border bg-white p-5 shadow-sm">
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        .resa-smart-id-card, .resa-smart-id-card * { visibility: visible !important; }
        .resa-smart-id-card { display: block !important; position: fixed !important; left: 12mm !important; top: 12mm !important; width: 85.6mm !important; height: 54mm !important; min-height: 54mm !important; max-height: 54mm !important; overflow: hidden !important; margin: 0 !important; padding: 2.5mm !important; box-sizing: border-box !important; border: 0.35mm solid #164e36 !important; border-radius: 2mm !important; background: #fff !important; color: #111 !important; box-shadow: none !important; }
        @page { size: A4; margin: 0; }
      }
    `}</style>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-extrabold">Staff and parent QR ID cards</h2><p className="mt-1 text-sm text-slate-600">Issue a revocable credential, include the account photograph and print a school ID card. Only the credential hash is stored.</p></div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border p-4">
        <h3 className="font-bold">Staff identification card</h3>
        <label className="mt-3 block text-sm font-semibold">Teacher / staff member
          <select className={field} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Select staff</option>
            {people.filter((item) => item.type === "staff" && item.is_active).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void loadExistingStaffCard()} disabled={busy !== "" || !staffId || !staffQrEnabled} className="rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold text-emerald-900 disabled:opacity-50">{busy === "staff" ? "Loading…" : "Load existing staff card"}</button><button type="button" onClick={() => void issueStaffCard(false)} disabled={busy !== "" || !staffId || !staffQrEnabled} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === "staff" ? "Working…" : "Create QR if missing"}</button><button type="button" onClick={() => void issueStaffCard(true)} disabled={busy !== "" || !staffId || !staffQrEnabled} className="rounded-xl border border-amber-400 px-4 py-3 text-sm font-bold text-amber-900 disabled:opacity-50">Replace existing QR</button></div>
        {!staffQrEnabled && <p className="mt-2 text-xs text-amber-800">Enable Staff QR attendance in School feature controls first.</p>}
      </div>
      <div className="rounded-xl border p-4">
        <h3 className="font-bold">Parent / guardian identification card</h3>
        <label className="mt-3 block text-sm font-semibold">Parent portal account
          <select className={field} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Select parent</option>
            {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void issueParentCard()} disabled={busy !== "" || !parentId || !parentQrEnabled} className="mt-3 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === "parent" ? "Issuing…" : "Issue / rotate parent QR card"}</button>
        {!parentQrEnabled && <p className="mt-2 text-xs text-amber-800">Enable Parent QR identity in School feature controls first.</p>}
      </div>
    </div>
    {error && <p role="alert" className="mt-4 break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {card && <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">New {card.kind} ID card preview</p><button type="button" onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm font-bold">Print ID card</button></div>
      <article className="resa-smart-id-card relative mx-auto flex aspect-[1.586/1] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border-2 border-emerald-900 bg-white p-3 text-slate-900 shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b-2 border-amber-400 pb-1.5">
          <img src="/media/logo/resa-logo.jpg" alt="RESA crest" className="h-8 w-8 shrink-0 rounded-full object-contain" />
          <div className="min-w-0 flex-1 text-center"><p className="text-[10px] font-black leading-tight tracking-wide text-emerald-950">RHEMA EXPLOITS SCIENCE ACADEMY INT’L</p><p className="text-[8px] font-bold tracking-[0.16em] text-emerald-800">OFFICIAL SCHOOL IDENTIFICATION</p></div>
          <span className="text-[8px] font-black text-amber-700">RESA</span>
        </header>
        <div className="flex min-h-0 flex-1 items-center gap-2.5 py-2">
          <div className="h-[76px] w-[60px] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100">
            {card.photoUrl ? <img src={card.photoUrl} alt={card.name + " passport photograph"} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[8px] font-bold text-slate-500">PHOTO</span>}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="line-clamp-2 break-words text-[11px] font-black text-slate-950">{card.name}</p>
            <p className="mt-1 text-[8px] font-extrabold uppercase tracking-wide text-emerald-800">{card.kind === "staff" ? "STAFF IDENTIFICATION" : "PARENT / GUARDIAN ID"}</p>
            <p className="mt-1 truncate text-[9px] font-bold text-slate-800">{card.reference}</p>
            {card.kind === "staff" && <><p className="truncate text-[8px] text-slate-700">{card.role}</p><p className="truncate text-[8px] text-slate-700">{card.department}</p></>}
            {card.kind === "parent" && <div className="mt-1"><p className="text-[7px] font-bold text-slate-700">LINKED CHILDREN</p>{card.children.slice(0, 2).map((name) => <p key={name} className="truncate text-[7px] text-slate-700">{name}</p>)}</div>}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <QrCodeDisplay value={card.payload} size={76}/>
            <span className="text-[7px] font-black tracking-wide text-slate-700">SCAN TO VERIFY</span>
          </div>
        </div>
        <footer className="border-t border-amber-300 pt-1 text-center text-[7px] font-semibold text-emerald-950">PASSION • SKILLS • EXCELLENT SPIRIT</footer>
      </article>
      <div className="mt-2 flex justify-center print:hidden"><button type="button" onClick={() => setZoomQr(true)} className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-bold text-emerald-900">Enlarge QR code</button></div>
      {zoomQr && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Enlarged QR code" onClick={() => setZoomQr(false)}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <p className="font-extrabold text-emerald-950">RESA secure QR credential</p>
          <div className="my-4 flex justify-center"><QrCodeDisplay value={card.payload} size={280}/></div>
          <p className="mb-4 text-xs text-slate-600">Keep this code private. Verify the cardholder’s photograph before accepting a scan.</p>
          <button type="button" onClick={() => setZoomQr(false)} className="rounded-lg bg-emerald-900 px-5 py-2 text-sm font-bold text-white">Close</button>
        </div>
      </div>}
      <p className="mt-2 text-xs text-slate-500">The QR contains a unique, non-personal credential reference. It does not reveal private details; attendance still requires an authorised operator and visual photo verification. Rotate it only when an administrator deliberately replaces the card.</p>
    </div>}
  </section>;
}
