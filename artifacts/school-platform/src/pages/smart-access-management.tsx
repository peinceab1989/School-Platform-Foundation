import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, ShieldCheck, ClipboardList, UserRound, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Row = Record<string, any>;
type PersonOption = { id: string; user_id: string | null; label: string; type: "student" | "staff" };
const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function SmartAccessManagementPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [tab, setTab] = useState<"requests" | "pickup" | "people" | "releases">("requests");
  const [requests, setRequests] = useState<Row[]>([]);
  const [authorizations, setAuthorizations] = useState<Row[]>([]);
  const [records, setRecords] = useState<Row[]>([]);
  const [releases, setReleases] = useState<Row[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNote, setReviewNote] = useState<Record<string,string>>({});
  const [subjectType, setSubjectType] = useState<"student"|"staff">("student");
  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState("query");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState("low");

  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [req, auth, rec, rel, students, staff] = await Promise.all([
        db.from("parent_official_access_requests").select("*").eq("school_id", schoolId).order("created_at",{ascending:false}).limit(250),
        db.from("child_collection_authorizations").select("*").eq("school_id", schoolId).order("created_at",{ascending:false}).limit(250),
        db.from("people_status_records").select("*").eq("school_id", schoolId).order("created_at",{ascending:false}).limit(250),
        db.from("child_collection_releases").select("*").eq("school_id", schoolId).order("release_time",{ascending:false}).limit(100),
        db.from("students").select("id,person_id,user_id,admission_number,status").eq("school_id", schoolId).order("admission_number"),
        db.from("staff").select("id,person_id,user_id,staff_number,job_title,status").eq("school_id", schoolId).order("staff_number"),
      ]);
      for (const result of [req,auth,rec,rel,students,staff]) if (result.error) throw result.error;
      const rows = [...(students.data??[]).map((p:Row)=>({...p,type:"student" as const,label:p.admission_number||"Student"})), ...(staff.data??[]).map((p:Row)=>({...p,type:"staff" as const,label:p.staff_number||p.job_title||"Staff"}))];
      const personIds = [...new Set(rows.map((p:Row)=>p.person_id).filter(Boolean))];
      const peopleResult = personIds.length ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",personIds) : {data:[],error:null};
      if (peopleResult.error) throw peopleResult.error;
      const names = new Map((peopleResult.data??[]).map((p:Row)=>[p.id,[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")]));
      setPeople(rows.map((p:Row)=>({id:p.id,user_id:p.user_id??null,type:p.type,label:names.get(p.person_id)||p.label})));
      setRequests(req.data??[]); setAuthorizations(auth.data??[]); setRecords(rec.data??[]); setReleases(rel.data??[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Smart Access records could not be loaded."); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(()=>{void load();},[load]);

  async function updateRequest(row:Row,status:"approved"|"rejected"|"revoked") {
    setSaving(row.id); setError(""); setNotice("");
    try {
      const db=getSupabaseClient() as any;
      const {error:e}=await db.from("parent_official_access_requests").update({request_status:status,reviewed_by:userId,reviewed_at:new Date().toISOString(),review_note:reviewNote[row.id]?.trim()||null}).eq("id",row.id).eq("school_id",schoolId).eq("request_status","pending");
      if(e) throw e;
      setNotice("Parent request decision saved and added to the audit trail."); await load();
    } catch(e){setError(e instanceof Error?e.message:"Could not update parent request.");}
    finally{setSaving("");}
  }

  async function updateAuthorization(row:Row,status:"approved"|"rejected"|"revoked") {
    setSaving(row.id); setError(""); setNotice("");
    try {
      const db=getSupabaseClient() as any;
      const {error:e}=await db.from("child_collection_authorizations").update({approval_status:status,reviewed_by:userId,reviewed_at:new Date().toISOString(),review_note:reviewNote[row.id]?.trim()||null}).eq("id",row.id).eq("school_id",schoolId).eq("approval_status","pending");
      if(e) throw e;
      setNotice("Collection authorization decision saved. The approval is still subject to identity verification at collection."); await load();
    } catch(e){setError(e instanceof Error?e.message:"Could not update collection authorization.");}
    finally{setSaving("");}
  }

  async function createRecord(event:FormEvent) {
    event.preventDefault(); if(!subjectId||!title.trim()||details.trim().length<5) return;
    setSaving("record");setError("");setNotice("");
    try {
      const person=people.find(p=>p.id===subjectId);
      if(!person||person.type!==subjectType) throw new Error("Select a valid person from this school.");
      const db=getSupabaseClient() as any;
      const {data,error:e}=await db.from("people_status_records").insert({
        school_id:schoolId,subject_type:subjectType,subject_record_id:subjectId,subject_user_id:person.user_id,
        record_category:category,record_title:title.trim(),record_details:details.trim(),record_status:"draft",
        severity:severity||null,issued_by:userId,
      }).select("id").single();
      if(e) throw e;
      setTitle("");setDetails("");setNotice("Confidential draft created. It is not visible to the subject until formally issued.");await load();
    } catch(e){setError(e instanceof Error?e.message:"Could not create the record.");}
    finally{setSaving("");}
  }

  async function updateRecord(row:Row,status:"pending_review"|"issued"|"under_appeal"|"upheld"|"reversed"|"closed"|"withdrawn") {
    setSaving(row.id);setError("");setNotice("");
    try {
      const db=getSupabaseClient() as any;
      const {error:e}=await db.from("people_status_records").update({record_status:status,reviewed_by:userId,decision_date:status==="issued"||status==="upheld"?new Date().toISOString():row.decision_date,updated_at:new Date().toISOString()}).eq("id",row.id).eq("school_id",schoolId);
      if(e) throw e;
      setNotice("Record status updated and an audit event recorded.");await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not update the record.");}
    finally{setSaving("");}
  }

  const selectedPeople=people.filter(p=>p.type===subjectType);
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Dashboard</Link>
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><ShieldCheck size={26}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA safeguarding and operations</p><h1 className="text-2xl font-extrabold sm:text-3xl">Smart Access & People Records</h1></div></div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100">Review parent permissions, record child collection evidence, and manage confidential student/staff decisions and recognition.</p>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <nav className="flex flex-wrap gap-2">{([["requests","Parent requests"],["pickup","Child pickup approvals"],["people","People records"],["releases","Collection register"]] as const).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab===key?"bg-emerald-900 text-white":"border bg-white text-slate-700"}`}>{label}</button>)}</nav>
      {error&&<p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      {loading?<p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading safeguarding records…</p>:null}
      {!loading&&tab==="requests"&&<section className="space-y-3">{requests.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No parent official-access requests have been submitted.</p>:requests.map(row=><article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-extrabold capitalize">{String(row.purpose).replaceAll("_"," ")}</h2><p className="mt-1 text-sm text-slate-600">Delegate: {row.delegate_full_name} · {row.delegate_phone} · {row.delegate_relationship||"Relationship not stated"}</p><p className="mt-1 text-xs text-slate-500">Visit: {dateLabel(row.requested_visit_at)} · Submitted: {dateLabel(row.created_at)}</p><p className="mt-3 whitespace-pre-wrap text-sm">{row.purpose_details}</p><p className="mt-2 text-xs text-slate-500">Department: {row.intended_department||"Not specified"} · Staff: {row.intended_staff_member||"Not specified"}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-900">{String(row.request_status).replaceAll("_"," ")}</span></div>{row.request_status==="pending"&&<div className="mt-4 border-t pt-4"><label className="block text-sm font-semibold">Review note<input className={field} value={reviewNote[row.id]||""} onChange={e=>setReviewNote(p=>({...p,[row.id]:e.target.value}))} placeholder="Optional decision note"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!saving} onClick={()=>void updateRequest(row,"approved")} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="mr-1 inline" size={16}/> Approve</button><button disabled={!!saving} onClick={()=>void updateRequest(row,"rejected")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50"><XCircle className="mr-1 inline" size={16}/> Reject</button></div></div>}</article>)}</section>}
      {!loading&&tab==="pickup"&&<section className="space-y-3">{authorizations.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No child collection authorizations have been submitted.</p>:authorizations.map(row=><article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-extrabold">{row.collector_full_name}</h2><p className="mt-1 text-sm text-slate-600">{row.collector_phone} · {row.relationship}</p><p className="mt-1 text-xs text-slate-500">Valid from {dateLabel(row.valid_from)} · Until {dateLabel(row.valid_until)}</p><p className="mt-2 text-xs text-slate-600">Student record: {row.student_id}</p>{row.consumed_at&&<p className="mt-2 text-xs font-bold text-emerald-800">Used for collection at {dateLabel(row.consumed_at)}</p>}</div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-900">{String(row.approval_status).replaceAll("_"," ")}</span></div>{row.approval_status==="pending"&&<div className="mt-4 border-t pt-4"><label className="block text-sm font-semibold">Review note<input className={field} value={reviewNote[row.id]||""} onChange={e=>setReviewNote(p=>({...p,[row.id]:e.target.value}))} placeholder="Optional decision note"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!saving} onClick={()=>void updateAuthorization(row,"approved")} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Approve pickup</button><button disabled={!!saving} onClick={()=>void updateAuthorization(row,"rejected")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">Reject</button></div></div>}</article>)}</section>}
      {!loading&&tab==="people"&&<div className="grid gap-5 lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]"><form onSubmit={createRecord} className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-extrabold">Create confidential record</h2><p className="mt-1 text-sm text-slate-600">New records begin as drafts and are not shown to the subject until formally issued.</p><label className="mt-4 block text-sm font-semibold">Person type<select className={field} value={subjectType} onChange={e=>{setSubjectType(e.target.value as any);setSubjectId("");}}><option value="student">Student</option><option value="staff">Teacher / staff</option></select></label><label className="mt-3 block text-sm font-semibold">Person<select className={field} value={subjectId} onChange={e=>setSubjectId(e.target.value)} required><option value="">Select person</option>{selectedPeople.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Record category<select className={field} value={category} onChange={e=>setCategory(e.target.value)}>{["query","investigation","warning","suspension","expulsion","termination","commendation","award","promotion","appointment","role_change","other"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Title<input className={field} value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={180} required/></label><label className="mt-3 block text-sm font-semibold">Details<textarea className={field} rows={4} value={details} onChange={e=>setDetails(e.target.value)} minLength={5} maxLength={5000} required/></label><label className="mt-3 block text-sm font-semibold">Severity<select className={field} value={severity} onChange={e=>setSeverity(e.target.value)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="serious">Serious</option><option value="critical">Critical</option></select></label><button disabled={saving==="record"} className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving==="record"?"Saving…":"Save as confidential draft"}</button></form><section className="space-y-3"><h2 className="text-lg font-extrabold">Student and staff records</h2>{records.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No people-status records yet.</p>:records.map(row=>{const person=peopleById.get(row.subject_record_id);return <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-extrabold">{row.record_title}</p><p className="mt-1 text-sm text-slate-600">{person?.label||row.subject_record_id} · {row.subject_type} · {row.record_category.replaceAll("_"," ")}</p><p className="mt-2 whitespace-pre-wrap text-sm">{row.record_details}</p><p className="mt-2 text-xs text-slate-500">Created {dateLabel(row.created_at)} · Effective {dateLabel(row.effective_from)}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{row.record_status.replaceAll("_"," ")}</span></div>{row.record_status==="draft"&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={!!saving} onClick={()=>void updateRecord(row,"pending_review")} className="rounded-xl border px-3 py-2 text-xs font-bold">Submit for review</button><button disabled={!!saving} onClick={()=>void updateRecord(row,"issued")} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Issue record</button></div>}{row.record_status==="under_appeal"&&<div className="mt-3 flex gap-2"><button disabled={!!saving} onClick={()=>void updateRecord(row,"upheld")} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Uphold</button><button disabled={!!saving} onClick={()=>void updateRecord(row,"reversed")} className="rounded-xl border px-3 py-2 text-xs font-bold">Reverse</button></div>}</article>})}</section></div>}
      {!loading&&tab==="releases"&&<section className="space-y-3">{releases.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No child collection releases have been recorded.</p>:releases.map(row=><article key={row.id} className="flex flex-wrap justify-between gap-3 rounded-2xl border bg-white p-4"><div><p className="font-bold">{row.collector_full_name}</p><p className="mt-1 text-xs text-slate-500">Student: {row.student_id} · {row.collector_relationship||"Relationship not stated"}</p><p className="mt-1 text-xs text-slate-500">{row.verification_method.replaceAll("_"," ")} · {dateLabel(row.release_time)}</p><p className="mt-2 text-sm">{row.verification_note}</p></div><span className="h-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Recorded</span></article>)}</section>}
      <div className="flex justify-end"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={15}/> Refresh records</button></div>
    </div>
  </main>;
}
