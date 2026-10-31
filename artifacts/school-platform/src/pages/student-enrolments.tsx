import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, RefreshCw, Search, Users } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Student = { id:string; person_id:string; admission_number:string; first_name:string; last_name:string };
type ClassRow = { id:string; name:string };
type SessionRow = { id:string; name:string; is_current?:boolean; start_date?:string|null };
type Enrollment = { id:string; student_id:string; class_id:string; academic_session_id:string; enrollment_date:string; status:string };

export default function StudentEnrolmentsPage({ schoolId }:{schoolId:string}) {
  const [students,setStudents]=useState<Student[]>([]);
  const [classes,setClasses]=useState<ClassRow[]>([]);
  const [sessions,setSessions]=useState<SessionRow[]>([]);
  const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
  const [drafts,setDrafts]=useState<Record<string,{class_id:string;academic_session_id:string}>>({});
  const [loading,setLoading]=useState(true);
  const [savingId,setSavingId]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const db=getSupabaseClient();
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError||!user)throw new Error("Your administrator session has expired. Sign in again.");
      const {data:membership,error:membershipError}=await db.from("school_memberships").select("id")
        .eq("school_id",schoolId).eq("user_id",user.id).eq("role","admin").eq("status","active").maybeSingle();
      if(membershipError)throw membershipError;
      if(!membership)throw new Error("Access denied. Only active school administrators can manage student enrolments.");
      const [st,cl,se,en]=await Promise.all([
        db.from("students").select("id,person_id,admission_number").eq("school_id",schoolId).eq("status","active").order("admission_number"),
        db.from("school_classes").select("id,name").eq("school_id",schoolId).order("name"),
        db.from("academic_sessions").select("id,name,is_current,start_date").eq("school_id",schoolId).order("start_date",{ascending:false}),
        db.from("student_enrollments").select("id,student_id,class_id,academic_session_id,enrollment_date,status").eq("school_id",schoolId).eq("status","active").order("enrollment_date",{ascending:false})
      ]);
      for(const x of [st,cl,se,en])if(x.error)throw x.error;
      const rows=st.data??[];
      const personIds=[...new Set(rows.map(x=>x.person_id).filter(Boolean))];
      const people=personIds.length?await db.from("people").select("id,first_name,last_name").eq("school_id",schoolId).in("id",personIds):{data:[],error:null};
      if(people.error)throw people.error;
      const byPerson=new Map((people.data??[]).map(p=>[p.id,p]));
      const nextStudents=rows.map(s=>({id:s.id,person_id:s.person_id,admission_number:s.admission_number||"—",first_name:byPerson.get(s.person_id)?.first_name||"",last_name:byPerson.get(s.person_id)?.last_name||""}));
      const nextClasses=cl.data??[],nextSessions=se.data??[],nextEnrollments=en.data??[];
      setStudents(nextStudents);setClasses(nextClasses);setSessions(nextSessions);setEnrollments(nextEnrollments);
      setDrafts(previous=>{
        const next={...previous};
        for(const s of nextStudents){
          const current=nextEnrollments.find(e=>e.student_id===s.id);
          if(!next[s.id])next[s.id]={class_id:current?.class_id||nextClasses[0]?.id||"",academic_session_id:current?.academic_session_id||nextSessions.find(x=>x.is_current)?.id||nextSessions[0]?.id||""};
        }
        return next;
      });
    }catch(e){setError(e instanceof Error?e.message:"Could not load student enrolments.");}
    finally{setLoading(false);}
  },[schoolId]);

  useEffect(()=>{void load();},[load]);

  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return students.filter(s=>!term||[s.first_name,s.last_name,s.admission_number].join(" ").toLowerCase().includes(term));
  },[students,search]);

  async function assign(student:Student){
    if(savingId)return;
    const draft=drafts[student.id];
    if(!draft?.class_id||!draft?.academic_session_id){setError("Choose both a class and an academic session.");return;}
    const db=getSupabaseClient();
    const {data:{user}}=await db.auth.getUser();
    if(!user){setError("Your session has expired. Sign in again.");return;}
    setSavingId(student.id);setError("");setNotice("");
    const today=new Date().toISOString().slice(0,10);
    const previous=enrollments.filter(e=>e.student_id===student.id);
    const same=previous.find(e=>e.class_id===draft.class_id&&e.academic_session_id===draft.academic_session_id);
    if(same){setNotice(student.first_name+" "+student.last_name+" is already enrolled in the selected class and session.");setSavingId(null);return;}
    try{
      if(previous.length){
        const ids=previous.map(e=>e.id);
        const closed=await db.from("student_enrollments").update({status:"completed"}).eq("school_id",schoolId).in("id",ids);
        if(closed.error)throw closed.error;
      }
      const created=await db.from("student_enrollments").insert({
        school_id:schoolId,student_id:student.id,class_id:draft.class_id,
        academic_session_id:draft.academic_session_id,enrollment_date:today,status:"active"
      }).select("id").single();
      if(created.error){
        if(previous.length)await db.from("student_enrollments").update({status:"active"}).eq("school_id",schoolId).in("id",previous.map(e=>e.id));
        throw created.error;
      }
      const oldClass=previous[0]?.class_id||null;
      const historyRows=[
        ...previous.map(e=>({school_id:schoolId,student_id:student.id,academic_session_id:e.academic_session_id,class_id:e.class_id,enrollment_date:e.enrollment_date,exit_date:today,status:"completed",reason:"Class/session reassignment",recorded_by:user.id})),
        {school_id:schoolId,student_id:student.id,academic_session_id:draft.academic_session_id,class_id:draft.class_id,enrollment_date:today,status:"active",reason:oldClass?"New class/session assignment":"Initial class assignment",recorded_by:user.id}
      ];
      const history=await (db as any).from("student_enrollment_history").insert(historyRows);
      if(history.error){
        setNotice("Enrolment saved, but the history log could not be written. Please alert the administrator: "+history.error.message);
      }else{
        const className=classes.find(x=>x.id===draft.class_id)?.name||"selected class";
        const sessionName=sessions.find(x=>x.id===draft.academic_session_id)?.name||"selected session";
        setNotice(student.first_name+" "+student.last_name+" is now enrolled in "+className+" for "+sessionName+".");
      }
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not save the enrolment.");}
    finally{setSavingId(null);}
  }

  return <main className="resa-page-content min-h-screen bg-slate-50 text-slate-900">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-950 via-green-900 to-emerald-800 p-5 text-white shadow-lg">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-200">RESA Academic Administration</p><h1 className="mt-1 text-2xl font-extrabold">Student Class Enrolments</h1><p className="mt-1 text-sm text-emerald-100">Assign each active student to the correct class and academic session.</p></div>
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft size={16}/> Dashboard</Link>
    </header>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><Users className="mb-2 text-emerald-800"/><p className="text-sm text-slate-500">Active students</p><p className="text-2xl font-extrabold">{students.length}</p></section>
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><BookOpenCheck className="mb-2 text-emerald-800"/><p className="text-sm text-slate-500">Currently enrolled</p><p className="text-2xl font-extrabold">{new Set(enrollments.map(e=>e.student_id)).size}</p></section>
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><CheckCircle2 className="mb-2 text-amber-600"/><p className="text-sm text-slate-500">Awaiting enrolment</p><p className="text-2xl font-extrabold">{Math.max(0,students.length-new Set(enrollments.map(e=>e.student_id)).size)}</p></section>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5"><div><h2 className="font-bold">Enrolment register</h2><p className="mt-1 text-sm text-slate-500">The student's class and session determine which published examinations they can access.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15}/> Refresh</button></div>
      <div className="border-b p-4"><label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student name or admission number" className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none focus:border-emerald-700"/></label></div>
      {loading?<p className="p-10 text-center text-slate-500">Loading enrolment records…</p>:!classes.length||!sessions.length?<p className="p-8 text-center text-amber-800">Create at least one class and one academic session before assigning students.</p>:!filtered.length?<p className="p-8 text-center text-slate-500">No active students match your search.</p>:<div className="divide-y">
        {filtered.map(student=>{
          const current=enrollments.find(e=>e.student_id===student.id);
          const draft=drafts[student.id]||{class_id:"",academic_session_id:""};
          return <article key={student.id} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(180px,1.2fr)_1fr_1fr_auto] lg:items-center">
            <div><p className="font-bold">{student.first_name} {student.last_name}</p><p className="mt-1 text-xs text-slate-500">Admission no. {student.admission_number}</p><p className="mt-2 text-xs font-semibold">{current?<span className="text-emerald-800">Enrolled · {classes.find(c=>c.id===current.class_id)?.name||"Class"}</span>:<span className="text-amber-800">No active class enrolment</span>}</p>{current&&<p className="text-xs text-slate-500">{sessions.find(s=>s.id===current.academic_session_id)?.name||"Session not found"}</p>}</div>
            <label className="text-xs font-semibold text-slate-600">Class<select value={draft.class_id} onChange={e=>setDrafts(p=>({...p,[student.id]:{...draft,class_id:e.target.value}}))} className="mt-1 w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900"><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Academic session<select value={draft.academic_session_id} onChange={e=>setDrafts(p=>({...p,[student.id]:{...draft,academic_session_id:e.target.value}}))} className="mt-1 w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900"><option value="">Select session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_current?" · Current":""}</option>)}</select></label>
            <button type="button" disabled={savingId!==null} onClick={()=>void assign(student)} className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-900 disabled:opacity-50">{savingId===student.id?"Saving…":current?"Update enrolment":"Assign class"}</button>
          </article>;
        })}
      </div>}
    </section>
    <p className="mt-4 text-xs leading-6 text-slate-500">Enrolments are restricted to this school. When a class/session is changed, the previous active enrolment is marked completed and the change is recorded in the enrolment history.</p>
  </main>;
}
