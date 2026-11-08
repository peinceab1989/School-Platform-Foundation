import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import QrCodeDisplay from "@/components/qr-code-display";

type PersonOption = { id: string; user_id: string | null; label: string; type: "student" | "staff" };
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

  async function issueStaffCard() {
    const person = people.find((item) => item.id === staffId && item.type === "staff");
    if (!person) { setError("Select a staff member."); return; }
    setBusy("staff"); setError(""); setNotice(""); setCard(null);
    try {
      const client = getSupabaseClient() as any;
      const { token, hash } = await createCredential();
      const { data: staff, error: staffError } = await client.from("staff")
        .select("staff_number,job_title,department,person_id,user_id")
        .eq("school_id", schoolId).eq("id", person.id).maybeSingle();
      if (staffError) throw staffError;
      if (!staff) throw new Error("The selected staff record could not be found.");
      let profileUserId = person.user_id || staff.user_id || null;
      if (!profileUserId && staff.person_id) {
        const { data: linkedPerson, error: linkedError } = await client.from("people")
          .select("user_id").eq("school_id", schoolId).eq("id", staff.person_id).maybeSingle();
        if (linkedError) throw linkedError;
        profileUserId = linkedPerson?.user_id ?? null;
      }
      const { data, error: rpcError } = await client.rpc("resa_issue_attendance_qr", {
        p_school_id: schoolId, p_person_type: "staff", p_person_id: person.id, p_token_hash: hash,
      });
      if (rpcError) throw rpcError;
      if (!data?.credential_id) throw new Error("The staff QR credential was not issued.");
      const photoUrl = await loadProfilePhoto(client, profileUserId);
      setCard({
        kind: "staff",
        name: person.label,
        reference: staff.staff_number || "Staff ID not assigned",
        role: staff.job_title || "Staff",
        department: staff.department || "Not specified",
        children: [],
        photoUrl,
        payload: "RESA1:" + token,
      });
      setNotice("Staff QR credential issued. Any previous staff credential has been revoked. Print the card and keep the QR private.");
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
        .resa-smart-id-card { display: block !important; position: fixed !important; left: 12mm !important; top: 12mm !important; width: 85.6mm !important; min-height: 54mm !important; margin: 0 !important; padding: 4mm !important; box-sizing: border-box !important; border: 1px solid #164e36 !important; border-radius: 3mm !important; background: #fff !important; color: #111 !important; box-shadow: none !important; }
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
            {people.filter((item) => item.type === "staff").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void issueStaffCard()} disabled={busy !== "" || !staffId || !staffQrEnabled} className="mt-3 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === "staff" ? "Issuing…" : "Issue / rotate staff QR card"}</button>
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
      <article className="resa-smart-id-card mx-auto w-full max-w-[420px] rounded-xl border-2 border-emerald-900 bg-white p-4 shadow-sm">
        <header className="mb-2 border-b-2 border-amber-300 pb-2 text-center text-xs font-extrabold tracking-wide text-emerald-950">RHEMA EXPLOITS SCIENCE ACADEMY INT’L · RESA</header>
        <div className="flex items-center gap-3">
          <div className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-emerald-50">
            {card.photoUrl ? <img src={card.photoUrl} alt={card.name + " passport photograph"} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-emerald-900">PHOTO</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-extrabold text-slate-950">{card.name}</p>
            <p className="mt-1 text-[10px] font-bold uppercase text-emerald-900">{card.kind === "staff" ? "STAFF IDENTIFICATION" : "PARENT / GUARDIAN ID"}</p>
            <p className="mt-1 text-[10px] text-slate-700">{card.reference}</p>
            {card.kind === "staff" && <><p className="text-[10px] text-slate-700">{card.role}</p><p className="text-[10px] text-slate-700">{card.department}</p></>}
            {card.kind === "parent" && <div className="mt-1"><p className="text-[9px] font-bold text-slate-700">LINKED CHILDREN</p>{card.children.length ? card.children.slice(0, 3).map((name) => <p key={name} className="truncate text-[9px] text-slate-700">{name}</p>) : <p className="text-[9px] text-slate-500">No active child links</p>}{card.children.length > 3 && <p className="text-[9px] text-slate-600">+{card.children.length - 3} more</p>}</div>}
          </div>
          <div className="shrink-0"><QrCodeDisplay value={card.payload} size={104}/></div>
        </div>
        <footer className="mt-2 border-t border-amber-300 pt-1 text-center text-[8px] text-slate-600">School identity credential · Verify the holder’s photograph · QR scan alone does not authorise child release</footer>
      </article>
      <p className="mt-2 text-xs text-slate-500">The raw QR secret is shown only in this live card preview and is not stored in the database. If it is lost, rotate the credential and print a new card.</p>
    </div>}
  </section>;
}
