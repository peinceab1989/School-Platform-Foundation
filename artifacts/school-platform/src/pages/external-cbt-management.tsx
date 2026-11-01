import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, BadgeCheck, ClipboardList, FilePlus2, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Row = Record<string, any>;
type Props = { schoolId: string; userId: string };
const money = (v: unknown) => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(v||0));
const dateTime = (v: string|null|undefined) => v ? new Date(v).toLocaleString("en-GB") : "—";
const message = (e: unknown) => e instanceof Error ? e.message : "The request could not be completed.";

export default function ExternalCbtManagementPage({schoolId,userId}:Props) {
  const db=getSupabaseClient() as any;
  const [tab,setTab]=useState<"candidates"|"forms"|"assignments"|"marking">("candidates");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [candidates,setCandidates]=useState<Row[]>([]),[purchases,setPurchases]=useState<Row[]>([]);
  const [exams,setExams]=useState<Row[]>([]),[assignments,setAssignments]=useState<Row[]>([]);
  const [attempts,setAttempts]=useState<Row[]>([]),[answers,setAnswers]=useState<Row[]>([]);
  const [form,setForm]=useState({amount_paid:"",payment_reference:"",paid_at:new Date().toISOString().slice(0,10)});
  const [assignment,setAssignment]=useState({candidate_id:"",exam_id:"",max_attempts:"1",available_from:"",available_until:""});
  const [selectedAttempt,setSelectedAttempt]=useState("");
  const [marks,setMarks]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const [c,p,e,a,t]=await Promise.all([
        db.from("external_candidate_registrations").select("*").eq("school_id",schoolId).order("created_at",{ascending:false}),
        db.from("external_candidate_form_purchases").select("*").eq("school_id",schoolId).order("created_at",{ascending:false}),
        db.from("online_exams").select("id,title,status,total_marks,duration_minutes,start_at,end_at").eq("school_id",schoolId).order("created_at",{ascending:false}),
        db.from("external_candidate_exam_assignments").select("*").eq("school_id",schoolId).order("created_at",{ascending:false}),
        db.from("external_candidate_exam_attempts").select("*").eq("school_id",schoolId).order("created_at",{ascending:false})
      ]);
      for(const r of [c,p,e,a,t])if(r.error)throw r.error;
      const candidateRows=c.data??[],attemptRows=t.data??[];
      setCandidates(candidateRows);setPurchases(p.data??[]);setExams(e.data??[]);setAssignments(a.data??[]);setAttempts(attemptRows);
      if(attemptRows.length){
        const {data:answerRows,error:answerError}=await db.from("external_candidate_exam_answers").select("*").eq("school_id",schoolId).in("attempt_id",attemptRows.map((x:Row)=>x.id));
        if(answerError)throw answerError;
        const questionIds=[...new Set((answerRows??[]).map((x:Row)=>x.question_id))];
        const {data:questions,error:questionError}=questionIds.length?await db.from("online_exam_questions").select("id,question_text,question_type,marks,option_a,option_b,option_c,option_d").eq("school_id",schoolId).in("id",questionIds):{data:[],error:null};
        if(questionError)throw questionError;
        const qmap=new Map((questions??[]).map((q:Row)=>[q.id,q]));
        setAnswers((answerRows??[]).map((x:Row)=>({...x,question:qmap.get(x.question_id)})));
      }else setAnswers([]);
    }catch(e){setError(message(e));}
    finally{setLoading(false);}
  },[db,schoolId]);
  useEffect(()=>{void load();},[load]);

  const candidateName=(id:string)=>candidates.find(c=>c.id===id)?.full_name??"Candidate";
  const examName=(id:string)=>exams.find(e=>e.id===id)?.title??"Examination";
  const activeAttempt=attempts.find(a=>a.id===selectedAttempt);
  const selectedAnswers=useMemo(()=>answers.filter(a=>a.attempt_id===selectedAttempt),[answers,selectedAttempt]);

  async function issueForm(event:FormEvent){
    event.preventDefault();setError("");setNotice("");
    const amount=Number(form.amount_paid);
    if(!Number.isFinite(amount)||amount<=0){setError("Enter a verified payment amount greater than zero.");return;}
    const formNumber="RESA-EXT-"+new Date().getFullYear()+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
    setBusy(true);
    try{
      const {error:e}=await db.from("external_candidate_form_purchases").insert({
        school_id:schoolId,form_number:formNumber,form_type:"external_cbt",amount_paid:amount,
        payment_reference:form.payment_reference.trim()||null,paid_at:form.paid_at||null,
        verification_status:"verified",verified_by:userId,created_by:userId
      });
      if(e)throw e;
      setNotice("Verified CBT form issued: "+formNumber);
      setForm({amount_paid:"",payment_reference:"",paid_at:new Date().toISOString().slice(0,10)});
      await load();
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }

  async function updateCandidate(id:string,status:"approved"|"rejected"|"suspended"){
    setBusy(true);setError("");setNotice("");
    try{
      const {error:e}=await db.from("external_candidate_registrations").update({status,reviewed_by:userId,reviewed_at:new Date().toISOString()}).eq("id",id).eq("school_id",schoolId);
      if(e)throw e;
      setNotice("Candidate status updated: "+status.replaceAll("_"," ")+".");await load();
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }

  async function assignExam(event:FormEvent){
    event.preventDefault();setError("");setNotice("");
    if(!assignment.candidate_id||!assignment.exam_id){setError("Select a candidate and a published examination.");return;}
    const max=Math.max(1,Math.min(10,Number(assignment.max_attempts)||1));
    setBusy(true);
    try{
      const {error:e}=await db.from("external_candidate_exam_assignments").upsert({
        school_id:schoolId,candidate_id:assignment.candidate_id,exam_id:assignment.exam_id,max_attempts:max,
        available_from:assignment.available_from?new Date(assignment.available_from).toISOString():null,
        available_until:assignment.available_until?new Date(assignment.available_until).toISOString():null,
        status:"assigned",assigned_by:userId
      },{onConflict:"candidate_id,exam_id"});
      if(e)throw e;
      setNotice("Examination assigned to "+candidateName(assignment.candidate_id)+".");
      setAssignment({candidate_id:"",exam_id:"",max_attempts:"1",available_from:"",available_until:""});await load();
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }

  async function publishMarkedResult(){
    if(!activeAttempt){return;}
    setBusy(true);setError("");setNotice("");
    try{
      for(const answer of selectedAnswers){
        if(String(answer.question?.question_type||"").toLowerCase()!=="multiple_choice"&&String(answer.question?.question_type||"").toLowerCase()!=="mcq"&&String(answer.question?.question_type||"").toLowerCase()!=="objective"){
          const value=marks[answer.id]??String(answer.marks_awarded??0);
          const n=Number(value);
          if(!Number.isFinite(n)||n<0||n>Number(answer.question?.marks||0))throw new Error("Each written answer mark must be between zero and the question's maximum marks.");
          const {error:e}=await db.from("external_candidate_exam_answers").update({marks_awarded:n,marked_by:userId,marked_at:new Date().toISOString()}).eq("id",answer.id).eq("school_id",schoolId);
          if(e)throw e;
        }
      }
      const total=selectedAnswers.reduce((sum,a)=>{
        const type=String(a.question?.question_type||"").toLowerCase();
        const written=!["multiple_choice","mcq","objective"].includes(type);
        return sum+(written?Number(marks[a.id]??a.marks_awarded??0):Number(a.marks_awarded||0));
      },0);
      const {error:e}=await db.from("external_candidate_exam_attempts").update({score:total,status:"graded",marked_by:userId,marked_at:new Date().toISOString(),result_published:true}).eq("id",selectedAttempt).eq("school_id",schoolId);
      if(e)throw e;
      setNotice("Answers marked and result published. Score: "+total+".");setSelectedAttempt("");setMarks({});await load();
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }

  const pending=candidates.filter(c=>c.status==="pending_review").length;
  const unused=purchases.filter(p=>p.form_type==="external_cbt"&&p.verification_status==="verified"&&!p.redeemed_at).length;

  return <main className="min-h-screen bg-stone-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to dashboard</Link>
      <p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · External examinations</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">External CBT Management</h1><p className="mt-1 text-sm text-emerald-100">Verified form purchases, candidate approvals, exam assignments and marking</p>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Candidates awaiting review</p><p className="mt-1 text-2xl font-extrabold">{pending}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Approved candidates</p><p className="mt-1 text-2xl font-extrabold">{candidates.filter(c=>c.status==="approved").length}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Unused verified forms</p><p className="mt-1 text-2xl font-extrabold">{unused}</p></div></div>
      <nav className="no-print flex flex-wrap gap-2">{(["candidates","forms","assignments","marking"] as const).map(k=><button key={k} onClick={()=>setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===k?"bg-emerald-900 text-white":"border bg-white"}`}>{k==="candidates"?"Candidates":k==="forms"?"Issue CBT forms":k==="assignments"?"Exam assignments":"Mark & publish results"}</button>)}<button onClick={()=>void load()} className="ml-auto inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> Refresh</button></nav>
      {loading?<div className="rounded-2xl border bg-white p-8 text-center"><RefreshCw className="mx-auto animate-spin"/>Loading external CBT records…</div>:<>
        {tab==="candidates"&&<section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">External candidate registrations</h2>{candidates.map(c=><article key={c.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{c.full_name} · {c.candidate_number}</p><p className="text-sm text-slate-600">{c.email} · {c.phone||"No phone"}</p><p className="text-xs text-slate-500">Registered {dateTime(c.created_at)} · Form purchase {purchases.find(p=>p.id===c.form_purchase_id)?.form_number||"—"}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{c.status?.replaceAll("_"," ")}</span></div>{c.status==="pending_review"&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void updateCandidate(c.id,"approved")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white"><UserCheck size={15}/> Approve</button><button disabled={busy} onClick={()=>void updateCandidate(c.id,"rejected")} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700"><UserX size={15}/> Reject</button></div>}{c.status==="approved"&&<button disabled={busy} onClick={()=>void updateCandidate(c.id,"suspended")} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold">Suspend candidate</button>}{c.status==="suspended"&&<button disabled={busy} onClick={()=>void updateCandidate(c.id,"approved")} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold">Re-approve candidate</button>}</article>)}{!candidates.length&&<p className="py-8 text-center text-sm text-slate-500">No external candidate registrations yet.</p>}</section>}
        {tab==="forms"&&<div className="grid gap-5 lg:grid-cols-2"><form onSubmit={issueForm} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 font-extrabold"><FilePlus2 size={18}/> Issue a verified CBT form</h2><p className="text-sm text-slate-600">Only issue this form after the school has confirmed receipt of the application fee. The generated form number can be redeemed once.</p><label className="block text-sm font-semibold">Verified amount received (₦)<input required type="number" min="0.01" step="0.01" value={form.amount_paid} onChange={e=>setForm({...form,amount_paid:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Payment reference<input value={form.payment_reference} onChange={e=>setForm({...form,payment_reference:e.target.value})} maxLength={100} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Payment date<input type="date" value={form.paid_at} onChange={e=>setForm({...form,paid_at:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">Confirm payment & issue form</button></form><section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Issued forms</h2>{purchases.filter(p=>p.form_type==="external_cbt").map(p=><div key={p.id} className="border-b py-3 text-sm"><p className="font-bold tracking-wide">{p.form_number}</p><p>{money(p.amount_paid)} · {p.payment_reference||"No reference"}</p><p className="text-xs text-slate-500">{p.redeemed_at?"Redeemed":"Unused"} · {dateTime(p.created_at)}</p></div>)}</section></div>}
        {tab==="assignments"&&<div className="grid gap-5 lg:grid-cols-2"><form onSubmit={assignExam} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 font-extrabold"><ClipboardList size={18}/> Assign published examination</h2><label className="block text-sm font-semibold">Approved candidate<select required value={assignment.candidate_id} onChange={e=>setAssignment({...assignment,candidate_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select candidate</option>{candidates.filter(c=>c.status==="approved").map(c=><option key={c.id} value={c.id}>{c.full_name} · {c.candidate_number}</option>)}</select></label><label className="block text-sm font-semibold">Published examination<select required value={assignment.exam_id} onChange={e=>setAssignment({...assignment,exam_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select exam</option>{exams.filter(e=>e.status==="published").map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><label className="block text-sm font-semibold">Maximum attempts<input type="number" min="1" max="10" value={assignment.max_attempts} onChange={e=>setAssignment({...assignment,max_attempts:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Available from (optional)<input type="datetime-local" value={assignment.available_from} onChange={e=>setAssignment({...assignment,available_from:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Available until (optional)<input type="datetime-local" value={assignment.available_until} onChange={e=>setAssignment({...assignment,available_until:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white">Save assignment</button></form><section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Current assignments</h2>{assignments.map(a=><div key={a.id} className="border-b py-3 text-sm"><p className="font-bold">{candidateName(a.candidate_id)} · {examName(a.exam_id)}</p><p>{a.max_attempts} attempt(s) · {a.status}</p><p className="text-xs text-slate-500">{dateTime(a.available_from)} – {dateTime(a.available_until)}</p></div>)}</section></div>}
        {tab==="marking"&&<section className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Review attempts and publish results</h2><label className="block max-w-2xl text-sm font-semibold">Submitted attempt<select value={selectedAttempt} onChange={e=>{setSelectedAttempt(e.target.value);setMarks({});}} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select an attempt</option>{attempts.filter(a=>["submitted","graded"].includes(a.status)).map(a=><option key={a.id} value={a.id}>{candidateName(a.candidate_id)} · {examName(a.exam_id)} · Attempt {a.attempt_number} · {a.status} · {money(a.score)}</option>)}</select></label>{activeAttempt&&<><p className="text-sm text-slate-600">Candidate: {candidateName(activeAttempt.candidate_id)} · Submitted: {dateTime(activeAttempt.submitted_at)} · Objective marks already graded automatically.</p>{selectedAnswers.map(a=>{const q=a.question??{};const type=String(q.question_type||"").toLowerCase();const written=!["multiple_choice","mcq","objective"].includes(type);return <article key={a.id} className="rounded-xl border p-4"><p className="font-bold">{q.question_text||"Question"} <span className="text-xs font-normal text-slate-500">({q.marks} marks)</span></p><p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{a.answer_text||"No answer supplied"}</p>{written?<label className="mt-3 block text-sm font-semibold">Marks awarded<input type="number" min="0" max={q.marks||0} step="0.5" value={marks[a.id]??String(a.marks_awarded??0)} onChange={e=>setMarks({...marks,[a.id]:e.target.value})} className="mt-1 w-36 rounded-lg border p-2 font-normal"/></label>:<p className="mt-2 text-sm text-emerald-800">Automatically marked: {a.marks_awarded} / {q.marks}</p>}</article>})}<button disabled={busy} onClick={()=>void publishMarkedResult()} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">Save marks & publish result</button></>}</section>}
      </>}
      <footer className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500"><ShieldCheck size={14}/> External candidates remain separate from enrolled RESA students.</footer>
    </div>
  </main>;
}
