import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type PendingCredential = {
  id: string;
  person_type: "student" | "staff";
  student_id: string | null;
  staff_id: string | null;
  created_at: string;
  name: string;
  reference: string;
};

export default function AttendanceQrApprovals({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<PendingCredential[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data: credentials, error: credentialError } = await db
        .from("attendance_qr_credentials")
        .select("id,person_type,student_id,staff_id,created_at,approval_status,is_active")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (credentialError) throw credentialError;
      const all = credentials ?? [];
      const pending = all.filter((row: any) => row.approval_status === "pending");
      setPendingCount(pending.length);
      setApprovedCount(all.filter((row: any) => row.approval_status === "approved").length);

      const studentIds = [...new Set(pending.filter((row: any) => row.person_type === "student").map((row: any) => row.student_id).filter(Boolean))] as string[];
      const staffIds = [...new Set(pending.filter((row: any) => row.person_type === "staff").map((row: any) => row.staff_id).filter(Boolean))] as string[];
      const [studentsResult, staffResult] = await Promise.all([
        studentIds.length ? db.from("students").select("id,person_id,admission_number").eq("school_id", schoolId).in("id", studentIds) : { data: [], error: null },
        staffIds.length ? db.from("staff").select("id,person_id,staff_number,job_title").eq("school_id", schoolId).in("id", staffIds) : { data: [], error: null },
      ]);
      if (studentsResult.error) throw studentsResult.error;
      if (staffResult.error) throw staffResult.error;
      const personIds = [...new Set([
        ...(studentsResult.data ?? []).map((row: any) => row.person_id),
        ...(staffResult.data ?? []).map((row: any) => row.person_id),
      ].filter(Boolean))] as string[];
      const peopleResult = personIds.length
        ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds)
        : { data: [], error: null };
      if (peopleResult.error) throw peopleResult.error;
      const names = new Map((peopleResult.data ?? []).map((row: any) => [row.id, [row.first_name,row.middle_name,row.last_name].filter(Boolean).join(" ")]));
      const studentMap = new Map<string, any>((studentsResult.data ?? []).map((row: any) => [row.id,row]));
      const staffMap = new Map<string, any>((staffResult.data ?? []).map((row: any) => [row.id,row]));
      setRows(pending.map((credential: any) => {
        const person = credential.person_type === "student" ? studentMap.get(credential.student_id) : staffMap.get(credential.staff_id);
        const fallback = credential.person_type === "student" ? person?.admission_number : person?.staff_number || person?.job_title;
        return {
          id: credential.id,
          person_type: credential.person_type,
          student_id: credential.student_id,
          staff_id: credential.staff_id,
          created_at: credential.created_at,
          name: String(names.get(person?.person_id) || fallback || "School member"),
          reference: String(fallback || ""),
        };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR approval queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  async function review(row: PendingCredential, decision: "approved" | "rejected") {
    setBusy(row.id);
    setError("");
    setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again before reviewing QR credentials.");
      const update = decision === "approved"
        ? { approval_status: "approved", approved_by: auth.user.id, approved_at: new Date().toISOString(), approval_note: null }
        : { approval_status: "rejected", approved_by: auth.user.id, approved_at: new Date().toISOString(), approval_note: "Rejected by school administrator", is_active: false, revoked_at: new Date().toISOString() };
      const { error: updateError } = await db.from("attendance_qr_credentials")
        .update(update)
        .eq("id", row.id)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .eq("approval_status", "pending");
      if (updateError) throw updateError;
      setNotice(decision === "approved"
        ? row.name + "'s QR identity has been approved. Their RESA ID card will now display the attendance QR."
        : row.name + "'s QR identity was rejected and the credential has been disabled.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR review could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><ShieldCheck size={21}/></span><div><h2 className="text-lg font-extrabold">QR identity approval</h2><p className="text-sm text-slate-600">Review every student and staff QR before it becomes valid for attendance or appears on their ID card.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Refresh</button>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Awaiting approval</p><p className="mt-1 text-2xl font-extrabold text-amber-950">{pendingCount}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-900">Approved and active</p><p className="mt-1 text-2xl font-extrabold text-emerald-950">{approvedCount}</p></div></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading ? <p className="mt-4 text-sm text-slate-500">Loading QR identities…</p> : rows.length === 0 ? <div className="mt-4 rounded-xl border border-dashed p-5 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={25}/><p className="mt-2 font-bold text-slate-800">No QR identities awaiting approval</p><p className="mt-1 text-sm text-slate-500">Newly issued and previously active credentials will appear here until reviewed.</p></div> : <div className="mt-4 divide-y rounded-xl border">{rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-full bg-slate-100 p-2 text-slate-600"><UserRound size={18}/></span><div className="min-w-0"><p className="font-bold">{row.name}</p><p className="text-xs text-slate-500">{row.person_type === "student" ? "Student" : "Teacher / staff"}{row.reference ? " · " + row.reference : ""} · Issued {new Date(row.created_at).toLocaleDateString("en-NG")}</p><p className="mt-1 text-[11px] font-semibold text-amber-800">Pending administrator approval</p></div></div><div className="flex gap-2"><button type="button" disabled={!!busy} onClick={() => void review(row,"approved")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === row.id ? "Saving…" : <><CheckCircle2 size={14}/>Approve</>}</button><button type="button" disabled={!!busy} onClick={() => void review(row,"rejected")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><XCircle size={14}/>Reject</button></div></article>)}</div>}
    <p className="mt-3 text-xs leading-5 text-slate-500">Approving activates the existing QR credential without changing its token or attendance history. Rejected credentials are disabled. Staff should still visually verify the photograph at the attendance station.</p>
  </section>;
}
