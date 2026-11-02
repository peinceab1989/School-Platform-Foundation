import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Printer, RefreshCw, GraduationCap, CalendarDays, Award } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type TermResult = { id:string; student_id:string; academic_session_id:string; term_id:string; class_id:string; total_score:number; average_score:number; position:number|null; teacher_comment:string|null; principal_comment:string|null; created_at:string };
type SubjectResult = { term_result_id:string; subject_id:string; ca_score:number; exam_score:number; total_score:number; grade:string|null; position:number|null; teacher_comment:string|null };
type StudentInfo = { id:string; person_id:string; admission_number:string; name:string; gender:string; date_of_birth:string };
type AttendanceSummary = { present:number; absent:number; late:number; excused:number; total:number };
type SchoolInfo = { motto:string|null; address:string|null; phone:string|null; email:string|null; website:string|null; logo_url:string|null };
type TermInfo = { id:string; name:string; start_date:string|null; end_date:string|null };
type Props = { schoolId:string; userId:string; role:"student"|"parent" };
const dash = "—";
const fmtDate = (value?:string|null) => value ? new Date(value+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : dash;
const ordinal = (value:number|null) => { if(!value) return dash; const n=value%100; return value+(n>=11&&n<=13?"th":value%10===1?"st":value%10===2?"nd":value%10===3?"rd":"th"); };
const emptyAttendance:AttendanceSummary={present:0,absent:0,late:0,excused:0,total:0};

export default function MyPublishedResultsPage({schoolId,userId,role}:Props){
 const [results,setResults]=useState<TermResult[]>([]);
 const [subjects,setSubjects]=useState<Record<string,string>>({});
 const [subjectRows,setSubjectRows]=useState<SubjectResult[]>([]);
 const [students,setStudents]=useState<StudentInfo[]>([]);
 const [classes,setClasses]=useState<Record<string,string>>({});
 const [sessions,setSessions]=useState<Record<string,string>>({});
 const [terms,setTerms]=useState<Record<string,TermInfo>>({});
 const [school,setSchool]=useState<SchoolInfo|null>(null);
 const [attendance,setAttendance]=useState<Record<string,AttendanceSummary>>({});
 const [selectedStudent,setSelectedStudent]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const db=getSupabaseClient() as any;
   let studentIds:string[]=[];
   if(role==="student"){
    const st=await db.from("students").select("id").eq("school_id",schoolId).eq("user_id",userId);
    if(st.error)throw st.error;
    studentIds=(st.data||[]).map((x:any)=>String(x.id));
   }else{
    const pa=await db.from("parent_portal_accounts").select("parent_guardian_id").eq("school_id",schoolId).eq("user_id",userId).eq("is_active",true);
    if(pa.error)throw pa.error;
    const parentIds=(pa.data||[]).map((x:any)=>x.parent_guardian_id);
    if(parentIds.length){
     const links=await db.from("parent_student_portal_access").select("student_id").eq("school_id",schoolId).eq("is_active",true).in("parent_guardian_id",parentIds);
     if(links.error)throw links.error;
     studentIds=[...new Set<string>((links.data||[]).map((x:any)=>String(x.student_id)))];
    }
   }
   const settings=await db.from("school_settings").select("motto,address,phone,email,website,logo_url").eq("school_id",schoolId).maybeSingle();
   if(settings.error)throw settings.error;
   setSchool(settings.data||null);
   if(!studentIds.length){setResults([]);setSubjectRows([]);setStudents([]);setAttendance({});return;}
   const [r,st,c,s,t]=await Promise.all([
    db.from("student_term_results").select("id,student_id,academic_session_id,term_id,class_id,total_score,average_score,position,teacher_comment,principal_comment,created_at").eq("school_id",schoolId).eq("workflow_status","published").in("student_id",studentIds).order("created_at",{ascending:false}),
    db.from("students").select("id,person_id,admission_number").eq("school_id",schoolId).in("id",studentIds),
    db.from("school_classes").select("id,name").eq("school_id",schoolId),
    db.from("academic_sessions").select("id,name").eq("school_id",schoolId),
    db.from("academic_terms").select("id,name,start_date,end_date").eq("school_id",schoolId)
   ]);
   for(const x of [r,st,c,s,t])if(x.error)throw x.error;
   const personIds=[...new Set<string>((st.data||[]).map((x:any)=>String(x.person_id)).filter(Boolean))];
   const people=personIds.length?await db.from("people").select("id,first_name,middle_name,last_name,gender,date_of_birth").eq("school_id",schoolId).in("id",personIds):{data:[],error:null};
   if(people.error)throw people.error;
   const peopleById=new Map<string,any>((people.data||[]).map((x:any)=>[String(x.id),x]));
   const studentInfo:StudentInfo[]=(st.data||[]).map((x:any)=>{
    const person=peopleById.get(String(x.person_id));
    return {id:String(x.id),person_id:String(x.person_id||""),admission_number:String(x.admission_number||""),name:person?[person.first_name,person.middle_name,person.last_name].filter(Boolean).join(" "):x.admission_number||"Student",gender:person?.gender||"",date_of_birth:person?.date_of_birth||""};
   });
   setStudents(studentInfo);
   setClasses(Object.fromEntries((c.data||[]).map((x:any)=>[x.id,x.name])));
   setSessions(Object.fromEntries((s.data||[]).map((x:any)=>[x.id,x.name])));
   setTerms(Object.fromEntries((t.data||[]).map((x:any)=>[x.id,{id:x.id,name:x.name,start_date:x.start_date,end_date:x.end_date}])));
   const published=(r.data||[]) as TermResult[];
   setResults(published);
   const resultIds=published.map(x=>x.id);
   const sr=resultIds.length?await db.from("student_subject_results").select("term_result_id,subject_id,ca_score,exam_score,total_score,grade,position,teacher_comment").eq("school_id",schoolId).in("term_result_id",resultIds):{data:[],error:null};
   if(sr.error)throw sr.error;
   const subjectResults=(sr.data||[]) as SubjectResult[];
   setSubjectRows(subjectResults);
   const subjectIds=[...new Set<string>(subjectResults.map(x=>String(x.subject_id)))];
   const sub=subjectIds.length?await db.from("subjects").select("id,name").eq("school_id",schoolId).in("id",subjectIds):{data:[],error:null};
   if(sub.error)throw sub.error;
   setSubjects(Object.fromEntries((sub.data||[]).map((x:any)=>[x.id,x.name])));
   const attendanceByStudent:Record<string,AttendanceSummary>={};
   await Promise.all(published.map(async(result)=>{
    const ar=await db.from("student_attendance").select("status").eq("school_id",schoolId).eq("student_id",result.student_id).eq("academic_session_id",result.academic_session_id);
    if(ar.error)throw ar.error;
    const summary={...emptyAttendance};
    for(const row of ar.data||[]){
     summary.total++;
     const status=String(row.status||"").toLowerCase();
     if(status==="present")summary.present++;
     else if(status==="absent")summary.absent++;
     else if(status==="late")summary.late++;
     else if(status==="excused")summary.excused++;
    }
    attendanceByStudent[result.id]=summary;
   }));
   setAttendance(attendanceByStudent);
   setSelectedStudent(prev=>studentIds.includes(prev)?prev:studentIds[0]||"");
  }catch(e){setError(e instanceof Error?e.message:"Published results could not be loaded.");}
  finally{setLoading(false);}
 },[schoolId,userId,role]);

 useEffect(()=>{void load();},[load]);
 const visible=useMemo(()=>results.filter(r=>!selectedStudent||r.student_id===selectedStudent),[results,selectedStudent]);
 const selectedName=students.find(s=>s.id===selectedStudent)?.name||"Student";
 const logo=(school?.logo_url||`${import.meta.env.BASE_URL}media/logo/resa-logo.jpg`);
 const printReport=()=>window.print();

 return <main className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">
  <header className="bg-emerald-950 text-white print:hidden">
   <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
    <div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">RESA School Portal</p><h1 className="text-xl font-extrabold sm:text-2xl">Published Report Cards</h1><p className="text-sm text-emerald-100">Official academic performance reports</p></div>
    <Link href={role==="student"?"/student-dashboard":"/dashboard"} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm"><ArrowLeft size={16}/> Dashboard</Link>
   </div>
  </header>
  <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-5">
   {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
    <div>{role==="parent"&&<label className="text-sm font-bold">Select child <select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.name} ({s.admission_number})</option>)}</select></label>}</div>
    <div className="flex gap-2"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15}/> Refresh</button><button onClick={printReport} disabled={!visible.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Printer size={15}/> Print report card</button></div>
   </div>
   {loading?<div className="rounded-2xl border bg-white p-10 text-center text-slate-600">Preparing published report cards…</div>:!visible.length?<div className="rounded-2xl border bg-white p-10 text-center"><GraduationCap className="mx-auto mb-3 text-slate-400" size={34}/><h2 className="font-bold">No published results available</h2><p className="mt-1 text-sm text-slate-500">Your report card will appear here after the school completes its checks, approves and publishes the result.</p></div>:visible.map(result=>{
    const student=students.find(s=>s.id===result.student_id);
    const rows=subjectRows.filter(x=>x.term_result_id===result.id).sort((a,b)=>(subjects[a.subject_id]||"").localeCompare(subjects[b.subject_id]||""));
    const attendanceForResult=attendance[result.id]||emptyAttendance;
    const term=terms[result.term_id];
    const maxTotal=rows.length*100;
    const computedTotal=rows.reduce((sum,row)=>sum+Number(row.total_score||0),0);
    const average=Number(result.average_score||0);
    const gradeLabel=average>=80?"A":average>=70?"B":average>=60?"C":average>=50?"D":average>=40?"E":"F";
    return <article key={result.id} className="report-sheet mx-auto w-full max-w-[900px] overflow-hidden border border-slate-300 bg-white shadow-xl print:max-w-none print:border-0 print:shadow-none">
     <div className="h-2 bg-gradient-to-r from-emerald-900 via-emerald-600 to-amber-400 print:bg-emerald-900"/>
     <div className="p-5 sm:p-8">
      <div className="flex items-center gap-4 border-b-2 border-emerald-900 pb-4">
       <img src={logo} alt="RESA official crest" className="h-20 w-20 shrink-0 rounded-full border border-slate-200 object-contain p-1 sm:h-24 sm:w-24" onError={e=>{(e.currentTarget as HTMLImageElement).style.visibility="hidden";}}/>
       <div className="min-w-0 flex-1 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-emerald-800 sm:text-xs">RHEMA EXPLOITS SCIENCE ACADEMY INT’L</p>
        <h2 className="mt-1 text-lg font-black leading-tight text-emerald-950 sm:text-2xl">STUDENT ACADEMIC REPORT</h2>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 sm:text-xs">{school?.motto||"PASSION • SKILLS • EXCELLENT SPIRIT"}</p>
        <p className="mx-auto mt-2 max-w-2xl text-[9px] leading-relaxed text-slate-600 sm:text-[11px]">{school?.address||"Benin City, Edo State, Nigeria"}{school?.phone? ` | ${school.phone}`:""}{school?.email? ` | ${school.email}`:""}</p>
       </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
       <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-900">Term report card</p><p className="mt-1 text-[10px] text-slate-500">Official school record • Published</p></div>
       <div className="rounded-lg border border-emerald-800 px-3 py-2 text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-emerald-800">Academic session</p><p className="text-sm font-extrabold text-emerald-950">{sessions[result.academic_session_id]||dash}</p></div>
      </div>
      <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
       <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-900"><GraduationCap size={15}/> Student information</div>
       <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-4">
        <div><p className="text-[10px] uppercase text-slate-500">Full name</p><p className="mt-1 font-extrabold">{student?.name||"Student"}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Admission number</p><p className="mt-1 font-bold">{student?.admission_number||dash}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Class</p><p className="mt-1 font-bold">{classes[result.class_id]||dash}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Gender</p><p className="mt-1 font-bold capitalize">{student?.gender||dash}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Date of birth</p><p className="mt-1 font-bold">{fmtDate(student?.date_of_birth)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Term</p><p className="mt-1 font-bold">{term?.name||dash}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Term begins</p><p className="mt-1 font-bold">{fmtDate(term?.start_date)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Term ends</p><p className="mt-1 font-bold">{fmtDate(term?.end_date)}</p></div>
       </div>
      </section>
      <section className="mt-5">
       <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">Academic performance</h3><span className="text-[10px] text-slate-500">Continuous assessment + examination</span></div>
       <div className="overflow-hidden rounded-lg border border-slate-300">
        <table className="w-full border-collapse text-left text-[10px] sm:text-xs">
         <thead><tr className="bg-emerald-950 text-white"><th className="px-2 py-2.5">S/N</th><th className="px-2 py-2.5">Subject</th><th className="px-2 py-2.5 text-center">CA<br/>40</th><th className="px-2 py-2.5 text-center">Exam<br/>60</th><th className="px-2 py-2.5 text-center">Total<br/>100</th><th className="px-2 py-2.5 text-center">Grade</th><th className="px-2 py-2.5 text-center">Position</th></tr></thead>
         <tbody>{rows.map((row,index)=><tr key={row.term_result_id+row.subject_id} className={index%2===0?"bg-white":"bg-slate-50"}><td className="border-t border-slate-200 px-2 py-2">{index+1}</td><td className="border-t border-slate-200 px-2 py-2 font-semibold">{subjects[row.subject_id]||"Subject"}{row.teacher_comment&&<p className="mt-0.5 text-[9px] font-normal italic text-slate-500">Teacher: {row.teacher_comment}</p>}</td><td className="border-t border-slate-200 px-2 py-2 text-center tabular-nums">{Number(row.ca_score).toFixed(1)}</td><td className="border-t border-slate-200 px-2 py-2 text-center tabular-nums">{Number(row.exam_score).toFixed(1)}</td><td className="border-t border-slate-200 px-2 py-2 text-center font-extrabold tabular-nums">{Number(row.total_score).toFixed(1)}</td><td className="border-t border-slate-200 px-2 py-2 text-center font-bold">{row.grade||dash}</td><td className="border-t border-slate-200 px-2 py-2 text-center">{ordinal(row.position)}</td></tr>)}</tbody>
         {rows.length>0&&<tfoot><tr className="bg-emerald-50 font-extrabold text-emerald-950"><td colSpan={2} className="border-t border-emerald-200 px-2 py-2">Overall total ({rows.length} subjects)</td><td className="border-t border-emerald-200 px-2 py-2 text-center">{rows.reduce((sum,row)=>sum+Number(row.ca_score||0),0).toFixed(1)}</td><td className="border-t border-emerald-200 px-2 py-2 text-center">{rows.reduce((sum,row)=>sum+Number(row.exam_score||0),0).toFixed(1)}</td><td className="border-t border-emerald-200 px-2 py-2 text-center">{computedTotal.toFixed(1)} / {maxTotal}</td><td colSpan={2} className="border-t border-emerald-200 px-2 py-2 text-center">—</td></tr></tfoot>}
        </table>
       </div>
       {rows.length===0&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">No subject scores are attached to this published report yet. Please contact the school office.</p>}
      </section>
      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
       <div className="rounded-lg border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total score</p><p className="mt-1 text-lg font-black text-emerald-950">{Number(result.total_score).toFixed(1)}</p><p className="text-[9px] text-slate-500">Across all subjects</p></div>
       <div className="rounded-lg border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Average</p><p className="mt-1 text-lg font-black text-emerald-950">{average.toFixed(2)}%</p><p className="text-[9px] text-slate-500">Overall performance</p></div>
       <div className="rounded-lg border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Class position</p><p className="mt-1 text-lg font-black text-emerald-950">{ordinal(result.position)}</p><p className="text-[9px] text-slate-500">In class</p></div>
       <div className="rounded-lg border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Performance grade</p><p className="mt-1 inline-flex items-center gap-1 text-lg font-black text-emerald-950"><Award size={17}/>{gradeLabel}</p><p className="text-[9px] text-slate-500">Based on average</p></div>
      </section>
      <section className="mt-4 rounded-lg border border-slate-200 p-3">
       <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-950"><CalendarDays size={14}/> Attendance summary</div>
       <div className="grid grid-cols-5 gap-1 text-center">
        {[["Present",attendanceForResult.present],["Absent",attendanceForResult.absent],["Late",attendanceForResult.late],["Excused",attendanceForResult.excused],["Recorded",attendanceForResult.total]].map(([label,value])=><div key={String(label)} className="rounded-md bg-slate-50 px-1 py-2"><p className="text-[9px] text-slate-500">{label}</p><p className="text-sm font-extrabold">{value}</p></div>)}
       </div>
       <p className="mt-2 text-[9px] text-slate-500">Attendance figures are based on records entered for this student during the academic session.</p>
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2">
       <div className="min-h-[92px] rounded-lg border border-slate-300 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Form teacher’s comment</p><p className="mt-2 text-xs leading-relaxed">{result.teacher_comment||"No form teacher comment recorded."}</p></div>
       <div className="min-h-[92px] rounded-lg border border-slate-300 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Principal’s comment</p><p className="mt-2 text-xs leading-relaxed">{result.principal_comment||"No principal comment recorded."}</p></div>
      </section>
      <section className="mt-4 rounded-lg border border-slate-200 p-3">
       <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-emerald-900">Grading guide</p>
       <div className="grid grid-cols-3 gap-2 text-[9px] sm:grid-cols-6">{[["A","80–100","Excellent"],["B","70–79","Very Good"],["C","60–69","Good"],["D","50–59","Credit"],["E","40–49","Pass"],["F","0–39","Fail"]].map(([g,range,meaning])=><div key={g} className="rounded-md bg-slate-50 p-2 text-center"><p className="font-black text-emerald-950">{g}</p><p>{range}</p><p className="text-slate-500">{meaning}</p></div>)}</div>
      </section>
      <div className="mt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
       <div className="border-t border-slate-400 pt-2"><p className="font-bold">Form Teacher</p><p className="mt-0.5 text-slate-500">Signature / Date</p></div>
       <div className="border-t border-slate-400 pt-2"><p className="font-bold">Principal</p><p className="mt-0.5 text-slate-500">Signature / Date</p></div>
      </div>
      <footer className="mt-5 border-t border-slate-200 pt-3 text-center text-[9px] text-slate-500">
       <p className="font-bold text-emerald-900">PASSION • SKILLS • EXCELLENT SPIRIT</p>
       <p className="mt-1">This is an official electronic report card published by RESA School Portal.</p>
       <p>Designed &amp; Powered by JETAB TECH</p>
      </footer>
     </div>
    </article>;
   })}
  </div>
  <style>{`@page { size:A4 portrait; margin:10mm; } @media print { html,body,#root { background:#fff!important; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } header, .print\\:hidden { display:none!important; } main { background:#fff!important; } .report-sheet { width:100%!important; max-width:none!important; margin:0!important; border:0!important; box-shadow:none!important; page-break-after:always; break-after:page; } .report-sheet:last-child { page-break-after:auto; break-after:auto; } button,a,select { display:none!important; } table { page-break-inside:avoid; } }`}</style>
 </main>;
}
