import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type StatusRecord = {
  id: string;
  record_title: string;
  record_details: string;
  record_category: string;
  record_status: string;
  severity: string | null;
  effective_from: string | null;
  effective_until: string | null;
  decision_date: string | null;
  appeal_deadline: string | null;
  created_at: string;
};

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
  : "Not specified";

export default function PeopleStatusNotices({ schoolId, userId, roleLabel }: { schoolId: string; userId: string; roleLabel: string }) {
  const [records, setRecords] = useState<StatusRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const { data, error: queryError } = await (getSupabaseClient() as any)
        .from("people_status_records")
        .select("id,record_title,record_details,record_category,record_status,severity,effective_from,effective_until,decision_date,appeal_deadline,created_at")
        .eq("school_id", schoolId)
        .eq("subject_user_id", userId)
        .in("record_status", ["issued", "under_appeal", "upheld", "reversed"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      if (queryError) setError("Your official school records could not be loaded right now.");
      else setRecords((data ?? []) as StatusRecord[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [schoolId, userId]);

  if (loading || (!records.length && !error)) return null;
  return <section className="mb-5 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Official school records">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">RESA · Official record notice</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">Your school records & recognition</h2><p className="mt-1 text-sm text-slate-600">Only formally issued records and decisions appear here. Confidential drafts and pending investigations are not shown.</p></div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">{roleLabel}</span>
    </div>
    {error ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : <div className="mt-4 space-y-3">{records.map((record) => <article key={record.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold text-slate-950">{record.record_title}</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">{record.record_category.replaceAll("_", " ")}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold capitalize " + (record.record_status === "reversed" ? "bg-slate-100 text-slate-700" : record.record_status === "under_appeal" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900")}>{record.record_status.replaceAll("_", " ")}</span></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{record.record_details}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>Decision: {dateLabel(record.decision_date)}</span><span>Effective: {dateLabel(record.effective_from)}</span>{record.effective_until && <span>Until: {dateLabel(record.effective_until)}</span>}{record.appeal_deadline && <span className="font-semibold text-amber-800">Appeal deadline: {dateLabel(record.appeal_deadline)}</span>}</div>
    </article>)}</div>}
  </section>;
}
