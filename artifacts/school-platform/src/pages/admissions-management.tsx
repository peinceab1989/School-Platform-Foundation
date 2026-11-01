import { useCallback,useEffect,useMemo,useState,type FormEvent } from "react";
import { ArrowLeft,CheckCircle2,FilePlus2,Printer,RefreshCw,ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Row=Record<string,any>;
type Props={schoolId:string;userId:string};
const money=(v:unknown)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(v||0));
const when=(v:string|null|undefined)=>v?new Date(v).toLocaleDateString("en-GB"):"—";
const errorText=(e:unknown)=>e instanceof Error?e.message:"The request could not be completed.";

export default function AdmissionsManagementPage({schoolId,userId}:Props){
 const db=getSupabaseClient() as any;
 const [tab,setTab]=useState<"applications"|"forms">("applications");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [applications,setApplications]=useState<Row[]>([]),[classes,setClasses]=useState<Row[]>([]),[sessions,setSessions]=useState<Row[]>([]);
 const [payments,setPayments]=useState<Row[]>([]),[forms,setForms]=useState<Row[]>([]);
 const [search,setSearch]=useState("");
 const [form,setForm]=useState({amount_paid:"",payment_reference:"",paid_at:new Date().toISOString().slice(0,10)});
 const [printApplication,setPrintApplication]=useState<Row|null>(null);

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [a,c,s,p,f]=await Promise.all([
    db.from("admission_applications").select("*").eq("school_id",schoolId).order("created_at",{ascending:false}),
    db.from("school_classes").select("id,name,level").eq("school_id",schoolId).order("name"),
    db.from("academic_sessions").select("id,name").eq("school_id",schoolId).order("start_date",{ascending:false}),
    db.from("admission_payments").select("*").eq("school_id",schoolId).order("created_at",{ascending:false}),
    db.from("external_candidate_form_purchases").select("*").eq("school_id",schoolId).eq("form_type","admission").order("created_at",{ascending:false})
   ]);
   for(const x of [a,c,s,p,f])if(x.error)throw x.error;
   setApplications(a.data??[]);setClasses(c.data??[]);setSessions(s.data??[]);setPayments(p.data??[]);setForms(f.data??[]);
  }catch(e){setError(errorText(e));}
  finally{setLoading(false);}
 },[db,schoolId]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!printApplication)return;
  const after=()=>{delete document.body.dataset.resaAdmissionPrint;setPrintApplication(null);};
  document.body.dataset.resaAdmissionPrint="application";
  window.addEventListener("afterprint",after);
  const timer=window.setTimeout(()=>window.print(),150);
  return()=>{window.clearTimeout(timer);window.removeEventListener("afterprint",after);};
 },[printApplication]);

 const filtered=useMemo(()=>applications.filter(a=>[a.application_number,a.applicant_first_name,a.applicant_last_name,a.parent_name,a.parent_phone,a.email].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))),[applications,search]);
 const className=(id:string)=>classes.find(c=>c.id===id)?.name??"—";
 const sessionName=(id:string)=>sessions.find(s=>s.id===id)?.name??"—";
 const paid=(id:string)=>payments.filter(p=>p.application_id===id&&p.status==="paid").reduce((n,p)=>n+Number(p.amount||0),0);
 const pending=applications.filter(a=>a.status==="pending").length;

 async function issueForm(event:FormEvent){
  event.preventDefault();setError("");setNotice("");
  const amount=Number(form.amount_paid);
  if(!Number.isFinite(amount)||amount<=0){setError("Enter the verified admission form payment amount.");return;}
  const formNumber="RESA-ADM-F-"+new Date().getFullYear()+"-"+crypto.randomUUID().replaceAll("-","").slice(0,16).toUpperCase();
  setBusy(true);
  try{
   const {error:e}=await db.from("external_candidate_form_purchases").insert({
    school_id:schoolId,form_number:formNumber,form_type:"admission",amount_paid:amount,
    payment_reference:form.payment_reference.trim()||null,paid_at:form.paid_at||null,
    verification_status:"verified",verified_by:userId,created_by:userId
   });
   if(e)throw e;
   setNotice("Verified admission form issued: "+formNumber);
   setForm({amount_paid:"",payment_reference:"",paid_at:new Date().toISOString().slice(0,10)});
   await load();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }

 async function review(id:string,status:"approved"|"rejected"|"pending"){
  const note=window.prompt(status==="approved"?"Optional approval note:":status==="rejected"?"Reason for rejection:":"Optional review note:");
  if(status==="rejected"&&!note?.trim()){setError("Enter a reason before rejecting the application.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await db.from("admission_applications").update({status,reviewed_by:userId,reviewed_at:new Date().toISOString(),remarks:note?.trim()||null}).eq("id",id).eq("school_id",schoolId);
   if(e)throw e;
   setNotice("Application status updated to "+status+".");await load();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }

 return <main className="min-h-screen bg-stone-50 text-slate-900">
  <style>{`@media print{.no-print{display:none!important}body[data-resa-admission-print="application"] *{visibility:hidden!important}body[data-resa-admission-print="application"] #resa-admission-print,body[data-resa-admission-print="application"] #resa-admission-print *{visibility:visible!important}body[data-resa-admission-print="application"] #resa-admission-print{display:block!important;position:absolute;inset:0;width:100%;padding:28px;background:#fff}}`}</style>
  <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5"><Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to dashboard</Link><p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · Admissions office</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Admissions Management</h1><p className="mt-1 text-sm text-emerald-100">Issue verified application forms, review submissions and print application records</p></div></header>
  <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
   {printApplication&&<section id="resa-admission-print" className="hidden"><div className="mx-auto max-w-3xl border-2 border-emerald-900 p-8 text-slate-900"><div className="text-center"><p className="text-xs font-bold tracking-widest text-emerald-900">RHEMA EXPLOITS SCIENCE ACADEMY</p><h2 className="mt-2 text-2xl font-extrabold">ADMISSION APPLICATION RECORD</h2></div><div className="my-6 grid grid-cols-2 gap-4 border-y py-5 text-sm"><p><strong>Application No:</strong> {printApplication.application_number}</p><p><strong>Date:</strong> {when(printApplication.application_date)}</p><p><strong>Applicant:</strong> {[printApplication.applicant_first_name,printApplication.applicant_middle_name,printApplication.applicant_last_name].filter(Boolean).join(" ")}</p><p><strong>Class:</strong> {className(printApplication.class_applied_for)}</p><p><strong>Session:</strong> {sessionName(printApplication.academic_session_id)}</p><p><strong>Status:</strong> {printApplication.status}</p><p><strong>Date of birth:</strong> {when(printApplication.date_of_birth)}</p><p><strong>Gender:</strong> {printApplication.gender||"—"}</p><p><strong>Applicant phone:</strong> {printApplication.phone||"—"}</p><p><strong>Applicant email:</strong> {printApplication.email||"—"}</p><p><strong>Parent/guardian:</strong> {printApplication.parent_name}</p><p><strong>Parent phone:</strong> {printApplication.parent_phone}</p><p><strong>Parent email:</strong> {printApplication.parent_email||"—"}</p><p className="col-span-2"><strong>Address:</strong> {printApplication.address||"—"}</p><p className="col-span-2"><strong>Previous school:</strong> {printApplication.previous_school||"—"}</p></div><p className="text-center text-xs text-slate-500">Confidential school admission record · Designed & Powered by JETAB TECH</p></div></section>}
   {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
   {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
   <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Total applications</p><p className="mt-1 text-2xl font-extrabold">{applications.length}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Awaiting review</p><p className="mt-1 text-2xl font-extrabold">{pending}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Unused verified forms</p><p className="mt-1 text-2xl font-extrabold">{forms.filter(f=>!f.redeemed_at).length}</p></div></div>
   <nav className="no-print flex flex-wrap gap-2"><button onClick={()=>setTab("applications")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==="applications"?"bg-emerald-900 text-white":"border bg-white"}`}>Applications</button><button onClick={()=>setTab("forms")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==="forms"?"bg-emerald-900 text-white":"border bg-white"}`}>Issue admission forms</button><button onClick={()=>void load()} className="ml-auto inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> Refresh</button></nav>
   {loading?<div className="rounded-2xl border bg-white p-8 text-center"><RefreshCw className="mx-auto animate-spin"/>Loading admissions records…</div>:tab==="forms"?<div className="grid gap-5 lg:grid-cols-2">
    <form onSubmit={issueForm} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 font-extrabold"><FilePlus2 size={18}/> Issue admission application form</h2><p className="text-sm text-slate-600">Only issue a form after the finance office has confirmed payment. The form number can be redeemed once.</p><label className="block text-sm font-semibold">Verified amount received (₦)<input required type="number" min="0.01" step="0.01" value={form.amount_paid} onChange={e=>setForm({...form,amount_paid:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Payment reference<input value={form.payment_reference} onChange={e=>setForm({...form,payment_reference:e.target.value})} maxLength={100} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Payment date<input type="date" value={form.paid_at} onChange={e=>setForm({...form,paid_at:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white">Confirm payment & issue form</button></form>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Issued admission forms</h2>{forms.map(f=><div key={f.id} className="border-b py-3 text-sm"><p className="font-bold tracking-wide">{f.form_number}</p><p>{money(f.amount_paid)} · {f.payment_reference||"No reference"}</p><p className="text-xs text-slate-500">{f.redeemed_at?"Redeemed":"Unused"} · Issued {when(f.created_at?.slice(0,10))}</p></div>)}{!forms.length&&<p className="py-5 text-sm text-slate-500">No admission forms issued yet.</p>}</section>
   </div>:<section className="space-y-3 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-extrabold">Admission applications</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search applicant, parent, phone or application number" className="w-full max-w-md rounded-lg border p-2 text-sm"/></div>{filtered.map(a=><article key={a.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{[a.applicant_first_name,a.applicant_middle_name,a.applicant_last_name].filter(Boolean).join(" ")} · {a.application_number||"No application number"}</p><p className="mt-1 text-sm text-slate-600">{className(a.class_applied_for)} · {sessionName(a.academic_session_id)} · Parent: {a.parent_name} ({a.parent_phone})</p><p className="text-xs text-slate-500">Submitted {when(a.application_date)} · Verified form {forms.find(f=>f.id===a.form_purchase_id)?.form_number||"—"} · Form payment {money(paid(a.id))}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{a.status}</span></div><div className="no-print mt-3 flex flex-wrap gap-2"><button onClick={()=>setPrintApplication(a)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><Printer size={15}/> Print application</button>{a.status!=="approved"&&<button disabled={busy} onClick={()=>void review(a.id,"approved")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white"><CheckCircle2 size={15}/> Approve</button>}{a.status!=="rejected"&&<button disabled={busy} onClick={()=>void review(a.id,"rejected")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700">Reject</button>}</div></article>)}{!filtered.length&&<p className="py-8 text-center text-sm text-slate-500">No applications match your search.</p>}</section>}
   <footer className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500"><ShieldCheck size={14}/> Admission applications and payment records are restricted to school administrators.</footer>
  </div>
 </main>;
}
