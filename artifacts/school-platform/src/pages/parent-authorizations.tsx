import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarClock, ShieldCheck, Send, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Child={id:string;label:string};
type RequestRow=Record<string,any>;
const field="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";
const stamp=(v?:string|null)=>v?new Date(v).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"—";

export default function ParentAuthorizationsPage({schoolId,userId}:{schoolId:string;userId:string}){
 const [parentId,setParentId]=useState("");
 const [parentName,setParentName]=useState("");
 const [children,setChildren]=useState<Child[]>([]);
 const [requests,setRequests]=useState<RequestRow[]>([]);
 const [purpose,setPurpose]=useState("child_pickup");
 const [studentId,setStudentId]=useState("");
 const [delegateName,setDelegateName]=useState("");
 const [delegatePhone,setDelegatePhone]=useState("");
 const [relationship,setRelationship]=useState("");
 const [identityRef,setIdentityRef]=useState("");
 const [department,setDepartment]=useState("");
 const [staffMember,setStaffMember]=useState("");
 const [details,setDetails]=useState("");
 const [visitDate,setVisitDate]=useState("");
 const [visitTime,setVisitTime]=useState("10:00");
 const [validDate,setValidDate]=useState("");
 const [validTime,setValidTime]=useState("18:00");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const db=getSupabaseClient() as any;
   const {data:account,error:accountError}=await db.from("parent_portal_accounts").select("parent_guardian_id").eq("school_id",schoolId).eq("user_id",userId).eq("is_active",true).maybeSingle();
   if(accountError)throw accountError;
   if(!account?.parent_guardian_id)throw new Error("Your active parent/guardian link could not be verified. Please contact the school office.");
   setParentId(account.parent_guardian_id);
   const {data:guardian,error:guardianError}=await db.from("parents_guardians").select("person_id").eq("id",account.parent_guardian_id).eq("school_id",schoolId).maybeSingle();
   if(guardianError)throw guardianError;
   if(guardian?.person_id){
    const {data:person,error:personError}=await db.from("people").select("first_name,middle_name,last_name").eq("id",guardian.person_id).eq("school_id",schoolId).maybeSingle();
    if(personError)throw personError;
    setParentName([person?.first_name,person?.middle_name,person?.last_name].filter(Boolean).join(" "));
   }
   const {data:links,error:linksError}=await db.from("parent_student_portal_access").select("student_id").eq("school_id",schoolId).eq("parent_guardian_id",account.parent_guardian_id).eq("is_active",true);
   if(linksError)throw linksError;
   const ids=(links??[]).map((x:any)=>x.student_id);
   const {data:students,error:studentsError}=ids.length?await db.from("students").select("id,person_id,admission_number").eq("school_id",schoolId).in("id",ids):{data:[],error:null};
   if(studentsError)throw studentsError;
   const personIds=(students??[]).map((x:any)=>x.person_id).filter(Boolean);
   const {data:people,error:peopleError}=personIds.length?await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",personIds):{data:[],error:null};
   if(peopleError)throw peopleError;
   const names=new Map((people??[]).map((x:any)=>[x.id,[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")]));
   setChildren((students??[]).map((x:any)=>({id:x.id,label:names.get(x.person_id)||x.admission_number||"Student"})));
   const {data:requestRows,error:requestError}=await db.from("parent_official_access_requests").select("*").eq("school_id",schoolId).eq("parent_guardian_id",account.parent_guardian_id).order("created_at",{ascending:false}).limit(100);
   if(requestError)throw requestError;
   setRequests(requestRows??[]);
  }catch(e){setError(e instanceof Error?e.message:"Parent authorization data could not be loaded.");}
  finally{setLoading(false);}
 },[schoolId,userId]);
 useEffect(()=>{void load();},[load]);

 async function submit(e:FormEvent){
  e.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   if(!parentId)throw new Error("Your parent account is not linked to this school.");
   if(purpose==="child_pickup"&&!studentId)throw new Error("Select the child this request concerns.");
   if(!visitDate||!visitTime)throw new Error("Select the intended visit date and time.");
   const visitAt=new Date(visitDate+"T"+visitTime+":00+01:00");
   if(Number.isNaN(visitAt.getTime())||visitAt.getTime()<Date.now()-60000)throw new Error("Choose a future visit time.");
   const validUntil=validDate?new Date(validDate+"T"+(validTime||"23:59")+":00+01:00").toISOString():null;
   if(validUntil&&new Date(validUntil)<=visitAt)throw new Error("The authorization expiry must be after the visit time.");
   const db=getSupabaseClient() as any;
   const {error:insertError}=await db.from("parent_official_access_requests").insert({
    school_id:schoolId,parent_guardian_id:parentId,purpose,student_id:studentId||null,
    delegate_full_name:delegateName.trim(),delegate_phone:delegatePhone.trim(),
    delegate_relationship:relationship.trim()||null,delegate_identity_reference:identityRef.trim()||null,
    intended_department:department.trim()||null,intended_staff_member:staffMember.trim()||null,
    purpose_details:details.trim(),requested_visit_at:visitAt.toISOString(),valid_until:validUntil,
    request_status:"pending",requested_by:userId,
   });
   if(insertError)throw insertError;
   setNotice("Your request has been sent to the school for approval. It is not permission to collect a child or enter restricted areas until the school confirms it.");
   setDelegateName("");setDelegatePhone("");setRelationship("");setIdentityRef("");setDepartment("");setStaffMember("");setDetails("");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Your request could not be submitted.");}
  finally{setSaving(false);}
 }

 return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="bg-emerald-950 text-white"><div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
  <Link href="/parent-dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Parent dashboard</Link>
  <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><ShieldCheck size={26}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA Parent Portal</p><h1 className="text-2xl font-extrabold">Parent Authorizations</h1></div></div>
  <p className="mt-2 text-sm text-emerald-100">Submit child-pickup permissions and requests for official school visits. {parentName? "Account: "+parentName:""}</p>
 </div></header>
 <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
  <form onSubmit={submit} className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-extrabold">Submit a request</h2>
   {error&&<p role="alert" className="mt-3 break-words rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
   <label className="mt-4 block text-sm font-semibold">Request purpose<select className={field} value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="child_pickup">Authorise someone to collect my child</option><option value="document_collection">Document collection</option><option value="meeting">Meeting</option><option value="payment_or_finance">Payment / finance</option><option value="academic_consultation">Academic consultation</option><option value="event_attendance">School event attendance</option><option value="other">Other official visit</option></select></label>
   {purpose==="child_pickup"&&<label className="mt-3 block text-sm font-semibold">Child<select className={field} value={studentId} onChange={e=>setStudentId(e.target.value)} required><option value="">Select your child</option>{children.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
   <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Delegate / visitor full name<input className={field} value={delegateName} onChange={e=>setDelegateName(e.target.value)} minLength={2} maxLength={160} required/></label><label className="block text-sm font-semibold">Phone number<input className={field} value={delegatePhone} onChange={e=>setDelegatePhone(e.target.value)} minLength={7} maxLength={30} required/></label><label className="block text-sm font-semibold">Relationship<input className={field} value={relationship} onChange={e=>setRelationship(e.target.value)} maxLength={80} placeholder="e.g. Aunt, uncle, family friend"/></label><label className="block text-sm font-semibold">ID type / reference<input className={field} value={identityRef} onChange={e=>setIdentityRef(e.target.value)} maxLength={120} placeholder="Reference only; do not upload sensitive ID here"/></label><label className="block text-sm font-semibold">Department<input className={field} value={department} onChange={e=>setDepartment(e.target.value)} maxLength={120} placeholder="e.g. Administration, Finance"/></label><label className="block text-sm font-semibold">Staff member to see<input className={field} value={staffMember} onChange={e=>setStaffMember(e.target.value)} maxLength={120}/></label></div>
   <label className="mt-3 block text-sm font-semibold">Purpose details<textarea className={field} rows={3} value={details} onChange={e=>setDetails(e.target.value)} minLength={5} maxLength={1200} required placeholder="Explain what the delegate needs to do."/></label>
   <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Visit date<input type="date" className={field} value={visitDate} onChange={e=>setVisitDate(e.target.value)} required/></label><label className="block text-sm font-semibold">Visit time<input type="time" className={field} value={visitTime} onChange={e=>setVisitTime(e.target.value)} required/></label><label className="block text-sm font-semibold">Authorization expiry date (optional)<input type="date" className={field} value={validDate} onChange={e=>setValidDate(e.target.value)}/></label><label className="block text-sm font-semibold">Expiry time<input type="time" className={field} value={validTime} onChange={e=>setValidTime(e.target.value)} disabled={!validDate}/></label></div>
   <button disabled={saving||loading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white disabled:opacity-50"><Send size={16}/>{saving?"Submitting…":"Submit for school approval"}</button>
   <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Important: a submitted request is pending, not approved. For child collection, school staff must verify the approved authorization and visually check the collector's identity before releasing the child.</p>
  </form>
  <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold">My requests</h2><button onClick={()=>void load()} className="rounded-lg border p-2" aria-label="Refresh requests"><RefreshCw size={16}/></button></div>
   {loading?<p className="mt-4 text-sm text-slate-500">Loading your parent account…</p>:requests.length===0?<p className="mt-4 text-sm text-slate-500">No requests submitted yet.</p>:<div className="mt-4 space-y-3">{requests.map(row=><article key={row.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-2"><p className="font-bold capitalize">{String(row.purpose).replaceAll("_"," ")}</p><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold capitalize">{String(row.request_status).replaceAll("_"," ")}</span></div><p className="mt-2 text-sm">{row.delegate_full_name} · {row.delegate_phone}</p><p className="mt-1 text-xs text-slate-500">Visit: {stamp(row.requested_visit_at)}</p>{row.review_note&&<p className="mt-2 text-sm text-slate-600">School note: {row.review_note}</p>}</article>)}</div>}
   <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><CalendarClock className="mr-1 inline" size={14}/> Requests are recorded in your parent dashboard. The school may contact you to confirm identity or details.</div>
  </section>
 </div>
 </main>;
}
