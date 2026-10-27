import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, Database, Search, ShieldCheck } from "lucide-react";
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
  { key: "drive", title: "RESA Drive", description: "School file metadata. Uploads require a verified Storage bucket and policies.", table: "resa_drive_files" },
  { key: "biometric", title: "Biometric Attendance", description: "Registered devices and attendance event records.", table: "biometric_devices" },
];
type RowRecord = Record<string, unknown>;
export default function SchoolServicesPage({ schoolId }: { schoolId: string }) {
  const [activeKey, setActiveKey] = useState(MODULES[0].key);
  const [rows, setRows] = useState<RowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const active = MODULES.find(m => m.key === activeKey) ?? MODULES[0];
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const result = await db.from(active.table).select("*").eq("school_id", schoolId).limit(100);
      if (result.error) throw result.error;
      setRows((result.data ?? []) as RowRecord[]);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "This module could not be loaded. Check its schema and school access policies.");
    } finally { setLoading(false); }
  }, [active.table, schoolId]);
  useEffect(() => { void load(); }, [load]);
  const visibleRows = rows.filter(row => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  const label = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-green-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-green-100"><ArrowLeft size={16}/> Back to dashboard</Link>
      <div className="flex items-center gap-3"><Database size={28}/><div><p className="text-xs uppercase tracking-widest text-green-200">RESA School Portal</p><h1 className="text-2xl font-bold sm:text-3xl">Additional School Services</h1></div></div>
      <p className="mt-2 max-w-3xl text-sm text-green-100">School-scoped records from existing RESA database modules. This first view is read-only; no records are changed here.</p>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border bg-white p-3 shadow-sm"><h2 className="px-3 py-2 font-bold">Modules</h2>{MODULES.map(m=><button key={m.key} onClick={()=>{setActiveKey(m.key);setSearch("");}} className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-sm ${activeKey===m.key?"bg-green-900 font-semibold text-white":"hover:bg-green-50"}`}><span className="block">{m.title}</span><span className={`mt-1 block text-xs ${activeKey===m.key?"text-green-100":"text-slate-500"}`}>{m.description}</span></button>)}</aside>
      <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{active.title}</h2><p className="mt-1 text-sm text-slate-600">{active.description}</p><p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={14}/> Admin-only view · maximum 100 rows · scoped to this school</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div>
        <label className="my-4 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400"/><input className="min-w-0 flex-1 py-3 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search loaded records…"/></label>
        {loading&&<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading records…</p>}
        {error&&!loading&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Module needs configuration</h3><p className="mt-1 break-words text-sm text-amber-900">{error}</p><p className="mt-2 text-sm text-amber-900">No security policy has been bypassed. This table may use a different school key or require an administrator-approved policy.</p></div>}
        {!loading&&!error&&visibleRows.length===0&&<div className="rounded-xl border border-dashed p-8 text-center"><Database className="mx-auto mb-3 text-slate-400" size={30}/><h3 className="font-semibold">No matching records</h3><p className="mt-1 text-sm text-slate-500">{rows.length===0?"No records are available for this school in this module yet.":"Try a different search."}</p></div>}
        {!loading&&!error&&visibleRows.length>0&&<><p className="mb-3 text-xs text-slate-500">Showing {visibleRows.length} of {rows.length} loaded records.</p><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 font-semibold">Record</th><th className="px-3 py-3 font-semibold">Details</th></tr></thead><tbody>{visibleRows.map((row,i)=><tr key={String(row.id??i)} className="border-t align-top"><td className="max-w-52 break-words px-3 py-3 font-medium">{String(row.name??row.title??row.id??`Record ${i+1}`)}</td><td className="px-3 py-3"><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(row).filter(([k])=>!["school_id","id"].includes(k)).map(([k,v])=><div key={k} className="min-w-0"><dt className="text-xs text-slate-500">{label(k)}</dt><dd className="break-words">{v===null||v===undefined||v===""?"—":typeof v==="object"?JSON.stringify(v):String(v)}</dd></div>)}</dl></td></tr>)}</tbody></table></div></>}
        <p className="mt-5 text-xs leading-5 text-slate-500">This hub currently provides safe record visibility only. Create, payment processing, file uploads, payroll actions and status changes must be enabled only after each table's columns, relationships and RLS policies are verified.</p>
      </section>
    </div>
  </main>;
}
