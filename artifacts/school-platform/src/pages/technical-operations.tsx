import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, HardDrive, Plus, RefreshCw, ShieldAlert, Wrench } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Ticket = { id:string; ticket_number:number; school_id:string; reporter_user_id:string; reporter_role:string; category:string; title:string; description:string; priority:string; status:string; assigned_to:string|null; created_at:string; updated_at:string; escalated_at?:string|null; escalation_level?:number };
type Reply = { ticket_id:string; author_user_id:string; created_at:string };
type Person = { user_id:string; name:string; role:string };
type Asset = { id:string; asset_tag:string; asset_name:string; category:string; location:string|null; condition:string; warranty_until:string|null; notes:string|null };
type Schedule = { id:string; title:string; description:string|null; maintenance_type:string; location:string|null; scheduled_start:string; scheduled_end:string|null; assigned_to:string|null; status:string; completion_notes:string|null; completed_at:string|null; asset_id:string|null };
type Event = { id:string; ticket_id:string|null; event_type:string; summary:string; details:Record<string,unknown>; created_at:string };
type Tab = "overview"|"incidents"|"maintenance"|"assets"|"history";
const slaMinutes:Record<string,number>={urgent:15,high:60,normal:480,low:1440};
const fmt=(v:string)=>new Date(v).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"});
const localInput=(d:Date)=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,16);};
const tabs:{id:Tab;label:string;icon:any}[]=[{id:"overview",label:"Overview",icon:Activity},{id:"incidents",label:"Incidents",icon:ShieldAlert},{id:"maintenance",label:"Maintenance",icon:CalendarClock},{id:"assets",label:"Asset register",icon:HardDrive},{id:"history",label:"Activity history",icon:ClipboardList}];

export default function TechnicalOperationsPage(){
 const db=getSupabaseClient() as any;
 const [userId,setUserId]=useState(""); const [schoolId,setSchoolId]=useState(""); const [adminUserIds,setAdminUserIds]=useState<string[]>([]);
 const [tickets,setTickets]=useState<Ticket[]>([]); const [replies,setReplies]=useState<Reply[]>([]);
 const [people,setPeople]=useState<Person[]>([]); const [assets,setAssets]=useState<Asset[]>([]);
 const [schedules,setSchedules]=useState<Schedule[]>([]); const [events,setEvents]=useState<Event[]>([]);
 const [tab,setTab]=useState<Tab>("overview"); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
 const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 const [showSchedule,setShowSchedule]=useState(false); const [showAsset,setShowAsset]=useState(false);
 const [scheduleTitle,setScheduleTitle]=useState(""); const [scheduleDescription,setScheduleDescription]=useState("");
 const [scheduleType,setScheduleType]=useState("preventive"); const [scheduleLocation,setScheduleLocation]=useState("");
 const [scheduleStart,setScheduleStart]=useState(localInput(new Date(Date.now()+86400000)));
 const [scheduleEnd,setScheduleEnd]=useState(""); const [scheduleAssignee,setScheduleAssignee]=useState(""); const [scheduleAsset,setScheduleAsset]=useState("");
 const [assetTag,setAssetTag]=useState(""); const [assetName,setAssetName]=useState(""); const [assetCategory,setAssetCategory]=useState("computer");
 const [assetLocation,setAssetLocation]=useState(""); const [assetWarranty,setAssetWarranty]=useState(""); const [assetNotes,setAssetNotes]=useState("");
 const [selectedTicket,setSelectedTicket]=useState("");
 const [completionNotes,setCompletionNotes]=useState("");
 const [ticketFilter,setTicketFilter]=useState("all");
 const [search,setSearch]=useState("");

 const load=useCallback(async()=>{
  setError("");
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw new Error("Sign in with an active RESA administrator account.");
  const {data:members,error:membershipError}=await db.from("school_memberships").select("school_id,role,status,user_id").eq("user_id",user.id).eq("status","active");
  if(membershipError)throw membershipError;
  const adminMembership=(members||[]).find((m:any)=>m.role==="admin");
  if(!adminMembership)throw new Error("The Technical Operations Centre is restricted to active school administrators.");
  setUserId(user.id);setSchoolId(adminMembership.school_id);
  const [ticketResult,replyResult,assetResult,scheduleResult,eventResult,staffResult]=await Promise.all([
   db.from("resa_support_tickets").select("*").eq("school_id",adminMembership.school_id).order("created_at",{ascending:false}).limit(300),
   db.from("resa_support_ticket_replies").select("ticket_id,author_user_id,created_at").eq("school_id",adminMembership.school_id).order("created_at",{ascending:true}).limit(2000),
   db.from("resa_technical_assets").select("*").eq("school_id",adminMembership.school_id).order("asset_name"),
   db.from("resa_maintenance_schedules").select("*").eq("school_id",adminMembership.school_id).order("scheduled_start",{ascending:true}).limit(300),
   db.from("resa_technical_operations_events").select("*").eq("school_id",adminMembership.school_id).order("created_at",{ascending:false}).limit(300),
   db.from("school_memberships").select("user_id,role").eq("school_id",adminMembership.school_id).eq("status","active").in("role",["admin","teacher"])
  ]);
  for(const result of [ticketResult,replyResult,assetResult,scheduleResult,eventResult,staffResult])if(result.error)throw result.error;
  const staffIds=(staffResult.data||[]).map((m:any)=>m.user_id);
  setAdminUserIds((staffResult.data||[]).filter((m:any)=>m.role==="admin").map((m:any)=>m.user_id));
  const peopleResult=staffIds.length?await db.from("people").select("user_id,first_name,middle_name,last_name").eq("school_id",adminMembership.school_id).in("user_id",staffIds):{data:[],error:null};
  if(peopleResult.error)throw peopleResult.error;
  const names=new Map((peopleResult.data||[]).map((p:any)=>[p.user_id,[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")]));
  setPeople((staffResult.data||[]).map((m:any)=>({user_id:m.user_id,role:m.role,name:String(names.get(m.user_id)||m.role+" · "+m.user_id.slice(0,8))})));
  setTickets((ticketResult.data||[]) as Ticket[]);setReplies((replyResult.data||[]) as Reply[]);
  setAssets((assetResult.data||[]) as Asset[]);setSchedules((scheduleResult.data||[]) as Schedule[]);setEvents((eventResult.data||[]) as Event[]);
 },[db]);

 useEffect(()=>{let active=true;setLoading(true);load().catch(e=>{if(active)setError(e.message||"Could not load Technical Operations.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[load]);
 useEffect(()=>{const timer=window.setInterval(()=>void load().catch(e=>setError(e.message||"Refresh failed.")),30000);return()=>window.clearInterval(timer);},[load]);

 const firstResponse=useMemo(()=>{const map=new Map<string,string>();for(const r of replies){const ticket=tickets.find(t=>t.id===r.ticket_id);if(ticket&&adminUserIds.includes(r.author_user_id)&&!map.has(r.ticket_id))map.set(r.ticket_id,r.created_at);}return map;},[replies,tickets,adminUserIds]);
 const openTickets=tickets.filter(t=>!["resolved","closed"].includes(t.status));
 const overdueTickets=openTickets.filter(t=>!firstResponse.has(t.id)&&Date.now()-new Date(t.created_at).getTime()>((slaMinutes[t.priority]||480)*60000));
 const escalatedTickets=openTickets.filter(t=>Boolean(t.escalated_at)||Number(t.escalation_level||0)>0);
 const upcoming=schedules.filter(s=>!["completed","cancelled"].includes(s.status)&&new Date(s.scheduled_start).getTime()>=Date.now()).slice(0,6);
 const filteredTickets=tickets.filter(t=>(ticketFilter==="all"||t.status===ticketFilter||ticketFilter==="open"&&!["resolved","closed"].includes(t.status))&&(!search||[t.title,t.description,String(t.ticket_number),t.category].join(" ").toLowerCase().includes(search.toLowerCase())));
 const selected= tickets.find(t=>t.id===selectedTicket)||filteredTickets[0]||null;

 const logEvent=async(ticketId:string|null,eventType:string,summary:string,details:Record<string,unknown>={})=>{
  const {error:e}=await db.from("resa_technical_operations_events").insert({school_id:schoolId,ticket_id:ticketId,actor_user_id:userId,event_type:eventType,summary,details});
  if(e)throw e;
 };
 const updateTicket=async(ticket:Ticket,patch:Record<string,unknown>,eventType:string,summary:string)=>{
  setBusy(true);setError("");setNotice("");
  try{const {data,error:e}=await db.from("resa_support_tickets").update({...patch,updated_at:new Date().toISOString()}).eq("id",ticket.id).eq("school_id",schoolId).select("*").single();if(e)throw e;
   await logEvent(ticket.id,eventType,summary,{ticket_number:ticket.ticket_number,...patch});
   setTickets(rows=>rows.map(t=>t.id===ticket.id?data:t));setNotice("Incident record updated.");
  }catch(e:any){setError(e.message||"Could not update incident.");}finally{setBusy(false);}
 };
 const createSchedule=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   const payload={school_id:schoolId,title:scheduleTitle.trim(),description:scheduleDescription.trim()||null,maintenance_type:scheduleType,location:scheduleLocation.trim()||null,scheduled_start:new Date(scheduleStart).toISOString(),scheduled_end:scheduleEnd?new Date(scheduleEnd).toISOString():null,assigned_to:scheduleAssignee||null,asset_id:scheduleAsset||null,created_by:userId};
   const {data,error:e}=await db.from("resa_maintenance_schedules").insert(payload).select("*").single();if(e)throw e;
   await logEvent(null,"maintenance_created","Maintenance activity scheduled: "+data.title,{schedule_id:data.id,maintenance_type:scheduleType,scheduled_start:data.scheduled_start});
   setSchedules(rows=>[...rows,data].sort((a,b)=>a.scheduled_start.localeCompare(b.scheduled_start)));
   setShowSchedule(false);setScheduleTitle("");setScheduleDescription("");setNotice("Maintenance activity scheduled.");
  }catch(e:any){setError(e.message||"Could not schedule maintenance.");}finally{setBusy(false);}
 };
 const createAsset=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   const {data,error:e}=await db.from("resa_technical_assets").insert({school_id:schoolId,asset_tag:assetTag.trim(),asset_name:assetName.trim(),category:assetCategory,location:assetLocation.trim()||null,warranty_until:assetWarranty||null,notes:assetNotes.trim()||null,created_by:userId}).select("*").single();if(e)throw e;
   await logEvent(null,"asset_created","Asset registered: "+data.asset_name,{asset_id:data.id,asset_tag:data.asset_tag});
   setAssets(rows=>[...rows,data]);setShowAsset(false);setAssetTag("");setAssetName("");setAssetLocation("");setAssetWarranty("");setAssetNotes("");setNotice("Asset registered.");
  }catch(e:any){setError(e.message||"Could not register asset. Check that the asset tag is unique.");}finally{setBusy(false);}
 };
 const updateSchedule=async(schedule:Schedule,status:string)=>{
  setBusy(true);setError("");setNotice("");
  try{
   const patch={status,updated_at:new Date().toISOString(),...(status==="completed"?{completed_at:new Date().toISOString(),completion_notes:completionNotes.trim()||"Completed and recorded by the school administrator."}:{})};
   const {data,error:e}=await db.from("resa_maintenance_schedules").update(patch).eq("id",schedule.id).eq("school_id",schoolId).select("*").single();if(e)throw e;
   await logEvent(null,status==="completed"?"maintenance_completed":"maintenance_updated",(status==="completed"?"Maintenance completed: ":"Maintenance status updated: ")+schedule.title,{schedule_id:schedule.id,asset_id:schedule.asset_id,status,completion_notes:completionNotes.trim()});
   setSchedules(rows=>rows.map(s=>s.id===schedule.id?data:s));setCompletionNotes("");setNotice("Maintenance record updated.");
  }catch(e:any){setError(e.message||"Could not update maintenance record.");}finally{setBusy(false);}
 };
 const updateAsset=async(asset:Asset,condition:string)=>{
  setBusy(true);setError("");try{const {data,error:e}=await db.from("resa_technical_assets").update({condition,updated_at:new Date().toISOString()}).eq("id",asset.id).eq("school_id",schoolId).select("*").single();if(e)throw e;
   await logEvent(null,"repair_recorded","Asset condition updated: "+asset.asset_name,{asset_id:asset.id,previous_condition:asset.condition,new_condition:condition});
   setAssets(rows=>rows.map(a=>a.id===asset.id?data:a));setNotice("Asset condition and repair history updated.");
  }catch(e:any){setError(e.message||"Could not update asset.");}finally{setBusy(false);}
 };

 return <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
  <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-6 text-white shadow-xl sm:p-8">
   <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-200">RESA · Operations & Service Assurance</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Technical Operations Centre</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">One command view for incidents, maintenance planning, equipment records, response performance and service history.</p></div><Wrench className="h-14 w-14 text-amber-300"/></div>
   <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-emerald-100"><span className="rounded-full border border-white/20 px-3 py-1">School operations</span><span className="rounded-full border border-white/20 px-3 py-1">SLA monitoring every 5 minutes</span><span className="rounded-full border border-white/20 px-3 py-1">Africa/Lagos display</span></div>
  </section>
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{tabs.map(t=>{const Icon=t.icon;return <button key={t.id} onClick={()=>setTab(t.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${tab===t.id?"bg-emerald-950 text-white":"border bg-white text-slate-700 hover:bg-emerald-50"}`}><Icon size={16}/>{t.label}</button>;})}</div><button onClick={()=>void load().catch(e=>setError(e.message))} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-bold"><RefreshCw size={16}/>Refresh</button></div>
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}{notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
  {loading?<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading operations data…</div>:<>
   {tab==="overview"&&<>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
     {[[ "Open incidents",openTickets.length,ShieldAlert ],["Awaiting first response",overdueTickets.length,AlertTriangle],["Escalated",escalatedTickets.length,Activity],["Upcoming maintenance",upcoming.length,CalendarClock],["Registered assets",assets.length,HardDrive]].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{label}</span><Icon size={17}/></div><p className="mt-2 text-3xl font-black tabular-nums text-slate-950">{value}</p></div>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
     <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-extrabold">Priority incidents</h2><button onClick={()=>setTab("incidents")} className="text-xs font-bold text-emerald-800">View all</button></div>
      {openTickets.filter(t=>t.priority==="urgent"||t.priority==="high"||overdueTickets.some(o=>o.id===t.id)).slice(0,6).map(t=><button key={t.id} onClick={()=>{setSelectedTicket(t.id);setTab("incidents");}} className="mt-3 flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left hover:bg-emerald-50"><span><span className="text-xs font-black text-emerald-900">RESA-{t.ticket_number}</span><span className="mt-1 block text-sm font-bold">{t.title}</span><span className="mt-1 block text-xs text-slate-500">{t.priority.toUpperCase()} · {t.status.replaceAll("_"," ")}</span></span>{overdueTickets.some(o=>o.id===t.id)?<span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900">SLA OVERDUE</span>:null}</button>)}
      {openTickets.length===0&&<p className="mt-4 text-sm text-slate-500">No open incidents at the moment.</p>}
     </section>
     <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-extrabold">Next maintenance activities</h2><button onClick={()=>setTab("maintenance")} className="text-xs font-bold text-emerald-800">Manage schedule</button></div>
      {upcoming.map(s=><div key={s.id} className="mt-3 flex items-start justify-between gap-3 rounded-xl border p-3"><span><strong className="block text-sm">{s.title}</strong><span className="mt-1 block text-xs text-slate-500">{fmt(s.scheduled_start)} · {s.location||"Location not set"}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{s.status}</span></div>)}
      {upcoming.length===0&&<p className="mt-4 text-sm text-slate-500">No upcoming maintenance has been scheduled.</p>}
     </section>
    </div>
   </>}
   {tab==="incidents"&&<section className="rounded-2xl border bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Incident and support queue</h2><p className="text-xs text-slate-500">Prioritise, assign, respond and follow service targets.</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets…" className="rounded-xl border px-3 py-2 text-sm"/><select value={ticketFilter} onChange={e=>setTicketFilter(e.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="all">All statuses</option><option value="open">Open / active</option><option value="in_progress">In progress</option><option value="waiting_for_reporter">Awaiting reporter</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]"><div className="max-h-[680px] space-y-2 overflow-auto">{filteredTickets.map(t=><button key={t.id} onClick={()=>setSelectedTicket(t.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id===t.id?"border-emerald-700 bg-emerald-50":"hover:bg-slate-50"}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-emerald-900">RESA-{t.ticket_number}</strong><span className="text-[10px] font-black uppercase text-slate-500">{t.priority} · {t.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-sm font-bold">{t.title}</p><p className="mt-1 text-xs text-slate-500">{t.reporter_role} · {fmt(t.created_at)}</p>{overdueTickets.some(o=>o.id===t.id)&&<span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">First response overdue</span>}</button>)}</div>
     <div className="rounded-xl bg-slate-50 p-4">{!selected?<p className="text-sm text-slate-500">Select an incident.</p>:<><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black text-emerald-900">RESA-{selected.ticket_number}</p><h3 className="mt-1 font-extrabold">{selected.title}</h3></div>{selected.escalated_at&&<span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900">ESCALATED</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{selected.description}</p><p className="mt-2 text-xs text-slate-500">Submitted {fmt(selected.created_at)} · Reporter role: {selected.reporter_role}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Priority<select disabled={busy} value={selected.priority} onChange={e=>void updateTicket(selected,{priority:e.target.value},"ticket_priority_changed","Priority changed to "+e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="text-xs font-bold">Status<select disabled={busy} value={selected.status} onChange={e=>void updateTicket(selected,{status:e.target.value,...(e.target.value==="resolved"?{resolved_at:new Date().toISOString()}:{})},"ticket_status_changed","Status changed to "+e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2">{["open","acknowledged","in_progress","waiting_for_reporter","resolved","closed"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label className="text-xs font-bold sm:col-span-2">Assigned technical officer<select disabled={busy} value={selected.assigned_to||""} onChange={e=>void updateTicket(selected,{assigned_to:e.target.value||null},"ticket_assigned","Technical officer assignment updated")} className="mt-1 w-full rounded-lg border bg-white p-2"><option value="">Unassigned</option>{people.map(p=><option key={p.user_id} value={p.user_id}>{p.name} ({p.role})</option>)}</select></label></div>
      <div className="mt-4 rounded-xl border bg-white p-3"><p className="text-xs font-bold text-slate-600">Service response target</p><p className="mt-1 text-sm">{firstResponse.has(selected.id)?"First response: "+fmt(firstResponse.get(selected.id)!):"Target: "+(slaMinutes[selected.priority]||480)+" minutes from submission"}</p>{overdueTickets.some(t=>t.id===selected.id)&&<p className="mt-1 text-xs font-bold text-amber-800">Automatic escalation has been scheduled by the SLA monitor.</p>}</div>
     </>}</div></div>
   </section>}
   {tab==="maintenance"&&<section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Maintenance calendar & work orders</h2><p className="text-xs text-slate-500">Plan preventive servicing, inspections, repairs and safety checks.</p></div><button onClick={()=>setShowSchedule(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-2 text-sm font-bold text-white"><Plus size={16}/>Schedule maintenance</button></div>
    {showSchedule&&<form onSubmit={createSchedule} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"><label className="text-xs font-bold sm:col-span-2">Activity title<input required minLength={3} maxLength={160} value={scheduleTitle} onChange={e=>setScheduleTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="e.g. Inspect computer laboratory workstations"/></label><label className="text-xs font-bold">Type<select value={scheduleType} onChange={e=>setScheduleType(e.target.value)} className="mt-1 w-full rounded-lg border p-2">{["preventive","inspection","repair","upgrade","safety_check","other"].map(v=><option key={v}>{v}</option>)}</select></label><label className="text-xs font-bold">Asset (optional)<select value={scheduleAsset} onChange={e=>setScheduleAsset(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">Not linked to an asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.asset_tag} · {a.asset_name}</option>)}</select></label><label className="text-xs font-bold">Start date & time<input required type="datetime-local" value={scheduleStart} onChange={e=>setScheduleStart(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-xs font-bold">End date & time<input type="datetime-local" value={scheduleEnd} onChange={e=>setScheduleEnd(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-xs font-bold">Location<input value={scheduleLocation} onChange={e=>setScheduleLocation(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="ICT laboratory, office…"/></label><label className="text-xs font-bold">Responsible officer<select value={scheduleAssignee} onChange={e=>setScheduleAssignee(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">To be assigned</option>{people.map(p=><option key={p.user_id} value={p.user_id}>{p.name} ({p.role})</option>)}</select></label><label className="text-xs font-bold sm:col-span-2">Work details<textarea rows={3} value={scheduleDescription} onChange={e=>setScheduleDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={()=>setShowSchedule(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-lg bg-emerald-950 px-4 py-2 text-sm font-bold text-white">Save schedule</button></div></form>}
    <div className="grid gap-3 md:grid-cols-2">{schedules.map(s=><article key={s.id} className="rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-2"><div><span className="text-[10px] font-black uppercase tracking-wide text-emerald-800">{s.maintenance_type.replaceAll("_"," ")}</span><h3 className="mt-1 font-extrabold">{s.title}</h3></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{s.status}</span></div><p className="mt-2 text-xs text-slate-500">{fmt(s.scheduled_start)} · {s.location||"Location not set"}</p>{s.description&&<p className="mt-2 text-sm text-slate-700">{s.description}</p>}<p className="mt-2 text-xs text-slate-500">Officer: {people.find(p=>p.user_id===s.assigned_to)?.name||"Not assigned"}{s.asset_id?" · Asset: "+(assets.find(a=>a.id===s.asset_id)?.asset_tag||"Linked asset"):""}</p>{s.status!=="completed"&&s.status!=="cancelled"&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void updateSchedule(s,"in_progress")} className="rounded-lg border px-3 py-2 text-xs font-bold">Start work</button><button disabled={busy} onClick={()=>void updateSchedule(s,"completed")} className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white">Mark completed</button><button disabled={busy} onClick={()=>void updateSchedule(s,"cancelled")} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-600">Cancel</button></div>}{s.completion_notes&&<p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">Completion note: {s.completion_notes}</p>}</article>)}</div>
    {schedules.length===0&&<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">No maintenance activities yet. Schedule the first inspection or service task.</div>}
    <div className="rounded-xl border bg-white p-4"><label className="text-xs font-bold">Completion note for the next task you mark complete<textarea value={completionNotes} onChange={e=>setCompletionNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border p-2" placeholder="Work completed, parts replaced, follow-up required…"/></label></div>
   </section>}
   {tab==="assets"&&<section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">School technical asset register</h2><p className="text-xs text-slate-500">Maintain a simple inventory of devices, infrastructure and equipment.</p></div><button onClick={()=>setShowAsset(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-2 text-sm font-bold text-white"><Plus size={16}/>Register asset</button></div>
    {showAsset&&<form onSubmit={createAsset} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"><label className="text-xs font-bold">Asset tag<input required maxLength={60} value={assetTag} onChange={e=>setAssetTag(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="RESA-ICT-001"/></label><label className="text-xs font-bold">Asset name<input required minLength={2} maxLength={160} value={assetName} onChange={e=>setAssetName(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="HP desktop workstation"/></label><label className="text-xs font-bold">Category<select value={assetCategory} onChange={e=>setAssetCategory(e.target.value)} className="mt-1 w-full rounded-lg border p-2">{["computer","printer","network","projector","power","security","biometric","furniture","building","other"].map(v=><option key={v}>{v}</option>)}</select></label><label className="text-xs font-bold">Location<input value={assetLocation} onChange={e=>setAssetLocation(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-xs font-bold">Warranty expiry<input type="date" value={assetWarranty} onChange={e=>setAssetWarranty(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-xs font-bold">Notes<input value={assetNotes} onChange={e=>setAssetNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><div className="flex justify-end sm:col-span-2"><button disabled={busy} className="rounded-lg bg-emerald-950 px-4 py-2 text-sm font-bold text-white">Save asset</button></div></form>}
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Asset</th><th className="p-3">Category</th><th className="p-3">Location</th><th className="p-3">Condition</th><th className="p-3">Warranty</th><th className="p-3">Update condition</th></tr></thead><tbody>{assets.map(a=><tr key={a.id} className="border-t"><td className="p-3"><strong>{a.asset_name}</strong><span className="block text-xs text-slate-500">{a.asset_tag}</span></td><td className="p-3">{a.category}</td><td className="p-3">{a.location||"—"}</td><td className="p-3">{a.condition.replaceAll("_"," ")}</td><td className="p-3">{a.warranty_until||"—"}</td><td className="p-3"><select value={a.condition} onChange={e=>void updateAsset(a,e.target.value)} className="rounded-lg border p-2 text-xs"><option value="operational">Operational</option><option value="needs_attention">Needs attention</option><option value="under_repair">Under repair</option><option value="retired">Retired</option></select></td></tr>)}</tbody></table></div>
    {assets.length===0&&<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">No assets registered yet.</div>}
   </section>}
   {tab==="history"&&<section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Technical activity and repair history</h2><p className="mt-1 text-xs text-slate-500">A dated record of incident escalations, assignment/status changes, maintenance and asset condition updates.</p><div className="mt-4 space-y-3">{events.map(ev=><div key={ev.id} className="flex gap-3 border-b pb-3"><span className="mt-1 rounded-full bg-emerald-50 p-2 text-emerald-900"><Activity size={15}/></span><div><p className="text-sm font-bold">{ev.summary}</p><p className="mt-1 text-xs text-slate-500">{fmt(ev.created_at)} · {ev.event_type.replaceAll("_"," ")}{ev.ticket_id?" · Ticket "+(tickets.find(t=>t.id===ev.ticket_id)?.ticket_number||""):""}</p></div></div>)}{events.length===0&&<p className="text-sm text-slate-500">No activity has been recorded yet.</p>}</div></section>}
  </>}
 </main>;
}
