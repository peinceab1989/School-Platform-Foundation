import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarDays, Clock3, Plus, RefreshCw, Save, ShieldCheck, XCircle } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Row = Record<string, any>;
type Day = { enabled: boolean; opens_at: string; closes_at: string };
const DAYS = [{id:1,name:"Monday"},{id:2,name:"Tuesday"},{id:3,name:"Wednesday"},{id:4,name:"Thursday"},{id:5,name:"Friday"},{id:6,name:"Saturday"},{id:7,name:"Sunday"}];
const DEFAULT_DAY: Day = { enabled:false, opens_at:"08:00", closes_at:"15:00" };
const formatDate = (v:string) => v ? new Date(v).toLocaleString("en-GB",{timeZone:"Africa/Lagos"}) : "—";
const errorText = (e:unknown) => e instanceof Error ? e.message : "The calendar request could not be completed.";

export default function SchoolCalendarPage({schoolId,userId}:{schoolId:string;userId:string}) {
  const db = getSupabaseClient() as any;
  const [days,setDays] = useState<Record<string,Day>>({});
  const [configured,setConfigured] = useState(false);
  const [rules,setRules] = useState<Row[]>([]);
  const [staffSchedules,setStaffSchedules] = useState<Row[]>([]);
  const [staff,setStaff] = useState<Array<{id:string;name:string;role:string}>>([]);
  const [preview,setPreview] = useState<Row|null>(null);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [rule,setRule] = useState({title:"",description:"",type:"closure",startDate:"",startTime:"08:00",endDate:"",endTime:"15:00",scope:"all",attendanceAllowed:false});
  const [staffForm,setStaffForm] = useState({userId:"",day:"1",start:"08:00",end:"15:00",from:new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Lagos"}),until:"",notes:""});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [scheduleResult,ruleResult,staffResult,membershipResult] = await Promise.all([
        db.from("school_operating_schedules").select("*").eq("school_id",schoolId).maybeSingle(),
        db.from("school_calendar_rules").select("*").eq("school_id",schoolId).order("starts_at",{ascending:false}).limit(100),
        db.from("school_staff_work_schedules").select("*").eq("school_id",schoolId).order("day_of_week").order("starts_at"),
        db.from("school_memberships").select("user_id,role").eq("school_id",schoolId).eq("status","active").in("role",["teacher","staff","admin"])
      ]);
      for (const r of [scheduleResult,ruleResult,staffResult,membershipResult]) if (r.error) throw r.error;
      const schedule = scheduleResult.data;
      setConfigured(Boolean(schedule?.configured_at));
      setDays(schedule?.weekly_schedule ?? {});
      setRules(ruleResult.data ?? []);
      setStaffSchedules(staffResult.data ?? []);
      const ids = [...new Set((membershipResult.data ?? []).map((x:Row)=>String(x.user_id)))];
      const profilesResult = ids.length ? await db.from("profiles").select("id,display_name").in("id",ids) : {data:[],error:null};
      if (profilesResult.error) throw profilesResult.error;
      const names = new Map((profilesResult.data ?? []).map((x:Row)=>[String(x.id),String(x.display_name||"Staff account")]));
      setStaff((membershipResult.data ?? []).map((x:Row)=>({id:String(x.user_id),name:names.get(String(x.user_id))||"Staff account",role:String(x.role)})));
      const status = await db.rpc("school_calendar_effective_status",{p_school_id:schoolId,p_at:new Date().toISOString(),p_scope:"attendance"});
      if (!status.error) setPreview(Array.isArray(status.data) ? status.data[0] ?? null : status.data);
    } catch(e) { setError(errorText(e)); }
    finally { setLoading(false); }
  },[db,schoolId]);

  useEffect(()=>{void load();},[load]);

  const setDay = (id:number, patch:Partial<Day>) => setDays(current=>({
    ...current,[String(id)]:{...DEFAULT_DAY,...(current[String(id)]||{}),...patch}
  }));
  const activeDays = useMemo(()=>DAYS.filter(d=>days[String(d.id)]?.enabled),[days]);

  async function saveWeeklySchedule(event:FormEvent) {
    event.preventDefault(); setBusy(true);setError("");setNotice("");
    try {
      if (!activeDays.length) throw new Error("Enable at least one working day before saving the school schedule.");
      for (const d of activeDays) {
        const value = {...DEFAULT_DAY,...days[String(d.id)]};
        if (!value.opens_at || !value.closes_at || value.closes_at <= value.opens_at) throw new Error(d.name+": closing time must be later than opening time.");
      }
      const {error:e} = await db.from("school_operating_schedules").upsert({
        school_id:schoolId,timezone:"Africa/Lagos",weekly_schedule:days,configured_at:new Date().toISOString(),updated_by:userId,updated_at:new Date().toISOString()
      },{onConflict:"school_id"});
      if(e) throw e;
      setNotice("Weekly school operating schedule saved. Disabled weekdays remain closed unless an approved special opening applies.");
      await load();
    } catch(e) {setError(errorText(e));} finally {setBusy(false);}
  }

  async function addRule(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      if(!rule.title.trim()||!rule.startDate||!rule.endDate) throw new Error("Enter a title and both dates.");
      const startsAt = new Date(rule.startDate+"T"+rule.startTime+":00+01:00");
      const endsAt = new Date(rule.endDate+"T"+rule.endTime+":00+01:00");
      if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt) throw new Error("The end date and time must be later than the start.");
      if(rule.type==="special_opening" && rule.scope==="attendance" && !rule.attendanceAllowed) throw new Error("Confirm attendance is allowed before opening attendance for a special activity.");
      const scopes = rule.scope==="all" ? ["all"] : [rule.scope];
      const {error:e}=await db.from("school_calendar_rules").insert({
        school_id:schoolId,title:rule.title.trim(),description:rule.description.trim()||null,rule_type:rule.type,
        starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),scopes,attendance_allowed:rule.attendanceAllowed,
        created_by:userId,updated_by:userId
      });
      if(e) throw e;
      setNotice(rule.type==="closure"?"Closure saved. It takes priority over the weekly schedule.":"Special opening saved. Any overlapping closure must be explicitly resolved.");
      setRule({title:"",description:"",type:"closure",startDate:"",startTime:"08:00",endDate:"",endTime:"15:00",scope:"all",attendanceAllowed:false});
      await load();
    } catch(e) {setError(errorText(e));} finally {setBusy(false);}
  }

  async function cancelRule(id:string) {
    if(!window.confirm("Cancel this calendar rule? Historical records and the audit trail will be preserved.")) return;
    setBusy(true);setError("");setNotice("");
    try {const {error:e}=await db.from("school_calendar_rules").update({status:"cancelled",updated_by:userId,updated_at:new Date().toISOString()}).eq("id",id).eq("school_id",schoolId);if(e)throw e;setNotice("Calendar rule cancelled.");await load();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }

  async function addStaffSchedule(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      if(!staffForm.userId||!staffForm.from) throw new Error("Select a staff member and effective start date.");
      if(staffForm.end<=staffForm.start) throw new Error("Staff schedule closing time must be later than opening time.");
      const {error:e}=await db.from("school_staff_work_schedules").insert({
        school_id:schoolId,staff_user_id:staffForm.userId,day_of_week:Number(staffForm.day),starts_at:staffForm.start,
        ends_at:staffForm.end,effective_from:staffForm.from,effective_until:staffForm.until||null,
        notes:staffForm.notes.trim()||null,created_by:userId,updated_by:userId
      });
      if(e)throw e;
      setNotice("Staff schedule added.");setStaffForm(current=>({...current,notes:""}));await load();
    } catch(e){setError(errorText(e));}finally{setBusy(false);}
  }

  async function pauseStaffSchedule(id:string) {
    setBusy(true);setError("");setNotice("");
    try {const {error:e}=await db.from("school_staff_work_schedules").update({status:"paused",updated_by:userId,updated_at:new Date().toISOString()}).eq("id",id).eq("school_id",schoolId);if(e)throw e;setNotice("Staff schedule paused.");await load();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to dashboard</Link>
      <p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · School operations</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">School Calendar & Staff Schedules</h1>
      <p className="mt-1 text-sm text-emerald-100">Authoritative working days, operating hours, holidays, closures and approved special activities · Africa/Lagos</p>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
      <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><CalendarDays/></div><div><h2 className="font-bold">Effective school status</h2><p className="text-xs text-slate-500">Live policy result for attendance</p></div></div>
          <div className="mt-4 flex items-center gap-2"><span className={"rounded-full px-3 py-1 text-sm font-bold "+(preview?.status==="open"||preview?.status==="special_activity"||preview?.status==="open_override"?"bg-emerald-100 text-emerald-900":"bg-amber-100 text-amber-900")}>{String(preview?.status||"Checking").replaceAll("_"," ").toUpperCase()}</span><span className="text-xs text-slate-500">Africa/Lagos</span></div>
          <p className="mt-3 text-sm text-slate-700">{preview?.reason||"Status will appear after the calendar is configured."}</p>
          {preview?.opens_at&&<p className="mt-2 text-sm text-slate-600">Hours: {String(preview.opens_at).slice(0,5)} – {String(preview.closes_at).slice(0,5)}</p>}
          <p className="mt-3 text-xs text-slate-500">{configured?"Weekly schedule configured.":"Not configured: no weekday pattern has been assumed."}</p>
          <button onClick={()=>void load()} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Refresh status</button>
        </article>
        <form onSubmit={saveWeeklySchedule} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold">Weekly working days & hours</h2><p className="text-xs text-slate-500">Every day starts disabled until an administrator enables it.</p></div><Clock3 className="text-emerald-800"/></div>
          <div className="space-y-3">{DAYS.map(day=>{const value={...DEFAULT_DAY,...(days[String(day.id)]||{})};return <div key={day.id} className="grid grid-cols-[minmax(88px,1fr)_auto_auto] items-center gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[minmax(110px,1fr)_auto_1fr_1fr]">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(value.enabled)} onChange={e=>setDay(day.id,{enabled:e.target.checked})} className="h-4 w-4 accent-emerald-800"/>{day.name}</label>
            <span className="text-xs text-slate-400">{value.enabled?"Open":"Closed"}</span>
            <label className="text-xs text-slate-500">Opens<input aria-label={day.name+" opening time"} type="time" disabled={!value.enabled} value={value.opens_at} onChange={e=>setDay(day.id,{opens_at:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100"/></label>
            <label className="text-xs text-slate-500">Closes<input aria-label={day.name+" closing time"} type="time" disabled={!value.enabled} value={value.closes_at} onChange={e=>setDay(day.id,{closes_at:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100"/></label>
          </div>})}</div>
          <button disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/> Save weekly schedule</button>
        </form>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={addRule} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Add holiday, closure or special opening</h2><p className="mt-1 text-xs text-slate-500">Closures override normal hours. A special opening never silently overrides a closure.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">Title<input required maxLength={160} value={rule.title} onChange={e=>setRule({...rule,title:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
            <label className="text-sm font-semibold">Rule type<select value={rule.type} onChange={e=>setRule({...rule,type:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"><option value="closure">Holiday / closure</option><option value="special_opening">Special opening / activity</option></select></label>
            <label className="text-sm font-semibold">Applies to<select value={rule.scope} onChange={e=>setRule({...rule,scope:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"><option value="all">Whole school</option><option value="attendance">Attendance</option><option value="timetable">Timetable / lessons</option><option value="examinations">Examinations</option><option value="staff">Staff operations</option><option value="public_events">Public events</option><option value="notifications">Notifications</option></select></label>
            <label className="text-sm font-semibold">Starts<input required type="date" value={rule.startDate} onChange={e=>setRule({...rule,startDate:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/><input aria-label="Start time" type="time" value={rule.startTime} onChange={e=>setRule({...rule,startTime:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
            <label className="text-sm font-semibold">Ends<input required type="date" value={rule.endDate} onChange={e=>setRule({...rule,endDate:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/><input aria-label="End time" type="time" value={rule.endTime} onChange={e=>setRule({...rule,endTime:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
            <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={rule.attendanceAllowed} onChange={e=>setRule({...rule,attendanceAllowed:e.target.checked})} className="mt-1 h-4 w-4 accent-emerald-800"/><span>Allow attendance for this special activity (only applies to special openings)</span></label>
            <label className="text-sm font-semibold sm:col-span-2">Description (optional)<textarea maxLength={1000} value={rule.description} onChange={e=>setRule({...rule,description:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
          </div>
          <button disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus size={16}/> Add calendar rule</button>
        </form>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Dated calendar rules</h2><p className="mt-1 text-xs text-slate-500">Cancelled rules remain in the audit history.</p>
          <div className="mt-4 space-y-3">{rules.length===0?<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No calendar exceptions have been added.</p>:rules.map(item=><div key={item.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{String(item.rule_type).replaceAll("_"," ")} · {formatDate(item.starts_at)} – {formatDate(item.ends_at)}</p><p className="mt-1 text-xs text-slate-500">Scope: {(item.scopes||[]).join(", ")} · {item.status}</p></div>{item.status==="active"&&<button type="button" onClick={()=>void cancelRule(item.id)} disabled={busy} title="Cancel rule" className="rounded-lg border border-red-200 p-2 text-red-700"><XCircle size={17}/></button>}</div>
          </div>)}</div>
        </article>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-800"/><h2 className="font-bold">Individual staff work schedules</h2></div>
        <p className="mt-1 text-xs text-slate-500">Only active RESA staff/teacher/admin memberships are selectable. Staff can read their own schedule; school administrators manage all schedules.</p>
        <form onSubmit={addStaffSchedule} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold lg:col-span-2">Staff member<select required value={staffForm.userId} onChange={e=>setStaffForm({...staffForm,userId:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"><option value="">Select staff</option>{staff.map(x=><option key={x.id} value={x.id}>{x.name} · {x.role}</option>)}</select></label>
          <label className="text-sm font-semibold">Weekday<select value={staffForm.day} onChange={e=>setStaffForm({...staffForm,day:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal">{DAYS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Effective from<input required type="date" value={staffForm.from} onChange={e=>setStaffForm({...staffForm,from:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Opens<input required type="time" value={staffForm.start} onChange={e=>setStaffForm({...staffForm,start:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Closes<input required type="time" value={staffForm.end} onChange={e=>setStaffForm({...staffForm,end:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Effective until (optional)<input type="date" value={staffForm.until} onChange={e=>setStaffForm({...staffForm,until:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Notes<input maxLength={500} value={staffForm.notes} onChange={e=>setStaffForm({...staffForm,notes:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>
          <div className="flex items-end"><button disabled={busy||staff.length===0} className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus size={16}/> Add staff schedule</button></div>
        </form>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{staffSchedules.length===0?<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No individual staff schedules have been recorded.</p>:staffSchedules.map(item=>{const person=staff.find(x=>x.id===item.staff_user_id);return <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-semibold">{person?.name||"Staff account"}</p><p className="text-xs text-slate-500">{DAYS.find(d=>d.id===Number(item.day_of_week))?.name} · {String(item.starts_at).slice(0,5)}–{String(item.ends_at).slice(0,5)} · {item.effective_from}{item.effective_until?" to "+item.effective_until:""}</p><p className="text-xs text-slate-500">Status: {item.status}</p></div>{item.status==="active"&&<button type="button" onClick={()=>void pauseStaffSchedule(item.id)} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Pause</button>}</div>})}</div>
      </section>
      <p className="text-xs leading-5 text-slate-500">Calendar administration is protected by Supabase row-level security. Public school information, authentication, records access and emergency communications remain available during closures. Attendance restrictions must be enabled only after the school calendar and attendance workflow acceptance tests are passed.</p>
    </div>
  </main>;
}
