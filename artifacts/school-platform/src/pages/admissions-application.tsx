import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type ClassOption={id:string;name:string;level:string|null};
type ApplicationResult={application_number:string;message:string};

export default function AdmissionsApplicationPage(){
  const [formNumber,setFormNumber]=useState("");
  const [classes,setClasses]=useState<ClassOption[]>([]);
  const [sessionName,setSessionName]=useState("");
  const [form,setForm]=useState({applicant_first_name:"",applicant_middle_name:"",applicant_last_name:"",date_of_birth:"",gender:"",phone:"",email:"",address:"",previous_school:"",class_applied_for:"",parent_name:"",parent_phone:"",parent_email:""});
  const [checked,setChecked]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[result,setResult]=useState<ApplicationResult|null>(null);

  async function verifyForm(){
    setError("");setChecked(false);setClasses([]);
    if(formNumber.trim().length<8){setError("Enter the admission form number issued by RESA.");return;}
    setLoading(true);
    try{
      const {data,error:invokeError}=await getSupabaseClient().functions.invoke("resa-admission-application-submit",{body:{action:"list_classes",form_number:formNumber.trim().toUpperCase()}});
      if(invokeError)throw invokeError;
      if(!data?.success)throw new Error(data?.error||"The form number could not be verified.");
      setClasses(Array.isArray(data.classes)?data.classes:[]);
      setSessionName(data.academic_session?.name||"Current session not yet configured");
      setChecked(true);
      if(!data.classes?.length)setError("The school has not configured any classes for admission yet. Please contact the school office.");
    }catch(e){setError(e instanceof Error?e.message:"The form number could not be verified.");}
    finally{setLoading(false);}
  }

  async function submit(event:FormEvent){
    event.preventDefault();setError("");
    if(!checked){setError("Verify your admission form number first.");return;}
    if(!form.class_applied_for){setError("Select the class being applied for.");return;}
    if(!form.parent_name.trim()||form.parent_phone.trim().length<7){setError("Enter the parent or guardian's name and phone number.");return;}
    setBusy(true);
    try{
      const {data,error:invokeError}=await getSupabaseClient().functions.invoke("resa-admission-application-submit",{
        body:{action:"submit",form_number:formNumber.trim().toUpperCase(),...form}
      });
      if(invokeError)throw invokeError;
      if(!data?.success)throw new Error(data?.error||"The application could not be submitted.");
      setResult({application_number:data.application_number,message:data.message});
      setFormNumber("");setChecked(false);setClasses([]);
    }catch(e){setError(e instanceof Error?e.message:"The application could not be submitted. Try again later.");}
    finally{setBusy(false);}
  }

  if(result)return <main className="min-h-screen bg-stone-50 px-4 py-10 text-slate-900"><section className="mx-auto max-w-xl rounded-3xl border bg-white p-7 text-center shadow-sm sm:p-10"><CheckCircle2 className="mx-auto text-emerald-700" size={48}/><h1 className="mt-4 text-2xl font-extrabold">Application received</h1><p className="mt-3 text-sm leading-6 text-slate-600">{result.message}</p><p className="mt-5 rounded-2xl bg-emerald-50 p-5 text-sm">Your application number<strong className="mt-2 block text-2xl tracking-wide text-emerald-950">{result.application_number}</strong></p><p className="mt-4 text-xs text-slate-500">Keep this number for all admission enquiries.</p><Link href="/admissions" className="mt-6 inline-flex rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white">Return to Admissions</Link></section></main>;

  return <main className="min-h-screen bg-stone-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-3xl">
    <Link href="/admissions" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-900"><ArrowLeft size={16}/> Back to Admissions</Link>
    <header className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-amber-200">RHEMA EXPLOITS SCIENCE ACADEMY</p><h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Online Admission Application</h1><p className="mt-2 text-sm leading-6 text-emerald-100">Complete this form using an admission form number issued and verified by the school. A submitted application remains pending until reviewed by RESA.</p></header>
    {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">Verified admission form number<input value={formNumber} onChange={e=>{setFormNumber(e.target.value.toUpperCase());setChecked(false);}} maxLength={40} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="RESA-ADM-…"/></label><button type="button" disabled={loading} onClick={()=>void verifyForm()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">{loading?<LoaderCircle size={17} className="animate-spin"/>:<ShieldCheck size={17}/>} Verify form</button></div>
      {checked&&<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Form verified. Academic session: {sessionName}. You may complete the application below.</p>}
    </section>
    {checked&&classes.length>0&&<form onSubmit={submit} className="mt-5 space-y-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
      <section><h2 className="text-lg font-extrabold">Applicant information</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">First name<input required maxLength={80} value={form.applicant_first_name} onChange={e=>setForm({...form,applicant_first_name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold">Last name<input required maxLength={80} value={form.applicant_last_name} onChange={e=>setForm({...form,applicant_last_name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold">Middle name (optional)<input maxLength={80} value={form.applicant_middle_name} onChange={e=>setForm({...form,applicant_middle_name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold">Date of birth<input type="date" value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold">Gender<select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Prefer not to say">Prefer not to say</option></select></label>
        <label className="text-sm font-semibold">Class applied for<select required value={form.class_applied_for} onChange={e=>setForm({...form,class_applied_for:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.level?" · "+c.level:""}</option>)}</select></label>
        <label className="text-sm font-semibold">Applicant phone<input type="tel" maxLength={40} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold">Applicant email<input type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold sm:col-span-2">Residential address<textarea maxLength={500} rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold sm:col-span-2">Previous school (optional)<input maxLength={180} value={form.previous_school} onChange={e=>setForm({...form,previous_school:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
      </div></section>
      <section><h2 className="text-lg font-extrabold">Parent or guardian information</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Parent/guardian full name<input required maxLength={160} value={form.parent_name} onChange={e=>setForm({...form,parent_name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold">Parent/guardian phone<input required type="tel" maxLength={40} value={form.parent_phone} onChange={e=>setForm({...form,parent_phone:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-semibold sm:col-span-2">Parent/guardian email (optional)<input type="email" maxLength={254} value={form.parent_email} onChange={e=>setForm({...form,parent_email:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
      </div></section>
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Submitting this application does not guarantee admission. The school will review the application and contact the parent or guardian. Do not submit sensitive identity documents through an unsecured channel.</p>
      <button disabled={busy} className="w-full rounded-xl bg-emerald-900 px-5 py-4 font-extrabold text-white disabled:opacity-50">{busy?"Submitting application…":"Submit admission application"}</button>
    </form>}
    <footer className="py-6 text-center text-xs text-slate-500">Designed & Powered by JETAB TECH</footer>
  </div></main>;
}
