import { useEffect, useState } from "react";
import { CalendarClock, ClipboardList, LifeBuoy, RefreshCw, Wrench } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type WorkOrder={id:string;title:string;description:string|null;maintenance_type:string;location:string|null;scheduled_start:string;scheduled_end:string|null;status:string;completion_notes:string|null;completed_at:string|null;asset_id:string|null};
const when=(value:string)=>new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"});
export default function TechnicalAssignmentsPage(){
 const [rows,setRows]=useState<WorkOrder[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [schoolName,setSchoolName]=useState("RESA");
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setError("");
   const db=getSupabaseClient() as any;
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)throw new Error("Please sign in to view assigned technical work.");
   const {data:members,error:memberError}=await db.from("school_memberships").select("school_id,role,status").eq("user_id",user.id).eq("status","active");
   if(memberError)throw memberError;
   const membership=(members||[]).find((m:any)=>m.role==="teacher"||m.role==="admin");
   if(!membership)throw new Error("An active school staff membership is required.");
   const {data,error:queryError}=await db.from("resa_maintenance_schedules").select("id,title,description,maintenance_type,location,scheduled_start,scheduled_end,status,completion_notes,completed_at,asset_id").eq("school_id",membership.school_id).eq("assigned_to",user.id).order("scheduled_start",{ascending:true});
   if(queryError)throw queryError;
   if(active){setRows((data||[]) as WorkOrder[]);setSchoolName("RESA School");}
  };
  void load().catch(e=>{if(active)setError(e.message||"Could not load assigned work.");}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
  <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-6 text-white shadow-lg"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">{schoolName} · Technical Team</p><h1 className="mt-2 text-2xl font-black">My Technical Assignments</h1><p className="mt-2 text-sm text-emerald-50/90">Maintenance and inspection work assigned to your account by the school administrator.</p></section>
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-extrabold">Assigned work orders</h2><Link href="/technical-support" className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-bold"><LifeBuoy size={16}/>Report an issue</Link></div>
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
  {loading?<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading assigned work…</div>:rows.length===0?<div className="rounded-2xl border bg-white p-8 text-center"><ClipboardList className="mx-auto text-slate-400" size={32}/><p className="mt-3 font-bold">No technical work assigned</p><p className="mt-1 text-sm text-slate-500">New assignments from the school administrator will appear here.</p></div>:<div className="grid gap-3 md:grid-cols-2">{rows.map(row=><article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-emerald-800">{row.maintenance_type.replaceAll("_"," ")}</p><h3 className="mt-1 font-extrabold">{row.title}</h3></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{row.status.replaceAll("_"," ")}</span></div><p className="mt-3 flex items-center gap-2 text-xs text-slate-600"><CalendarClock size={14}/>{when(row.scheduled_start)}{row.scheduled_end?" – "+when(row.scheduled_end):""}</p><p className="mt-2 flex items-center gap-2 text-xs text-slate-600"><Wrench size={14}/>{row.location||"Location not specified"}</p>{row.description&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.description}</p>}{row.completion_notes&&<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">Completion note: {row.completion_notes}</p>}</article>)}</div>}
  <p className="text-xs text-slate-500">This page only displays work orders assigned to your signed-in account. Contact the administrator if an assignment needs to be changed.</p>
 </main>;
}
