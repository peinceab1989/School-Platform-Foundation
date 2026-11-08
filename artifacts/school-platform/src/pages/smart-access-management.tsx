import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, ShieldCheck, ClipboardList, UserRound, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import SmartAccessIdCards from "@/components/smart-access-id-cards";

type Row = Record<string, any>;
type PersonOption = { id: string; user_id: string | null; label: string; type: "student" | "staff"; is_active: boolean };
const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function SmartAccessManagementPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [tab, setTab] = useState<"requests" | "pickup" | "people" | "releases" | "events">("requests");
  const [requests, setRequests] = useState<Row[]>([]);
  const [authorizations, setAuthorizations] = useState<Row[]>([]);
  const [records, setRecords] = useState<Row[]>([]);
  const [releases, setReleases] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row>({student_qr_enabled:false,staff_qr_enabled:false,parent_qr_enabled:false,child_pickup_enabled:false,parent_events_enabled:false});
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
  const [devices,setDevices] = useState<Array<{id:string;device_name:string}>>([]);
  const [releaseStudentId,setReleaseStudentId] = useState("");
  const [releaseAuthorizationId,setReleaseAuthorizationId] = useState("");
  const [releaseCollector,setReleaseCollector] = useState("");
  const [releaseRelationship,setReleaseRelationship] = useState("");
  const [releaseMethod,setReleaseMethod] = useState<"approved_collector"|"parent_qr"|"manual_verified">("approved_collector");
  const [releaseNote,setReleaseNote] = useState("");
  const [parentQrCode,setParentQrCode] = useState("");
  const [releaseStationId,setReleaseStationId] = useState("");
  const [parentOptions,setParentOptions] = useState<Array<{id:string;label:string;userId:string|null}>>([]);
  const parentVideoRef=useRef<HTMLVideoElement|null>(null);
  const parentStreamRef=useRef<MediaStream|null>(null);
  const parentScanActive=useRef(false);
  const [parentQrScanning,setParentQrScanning]=useState(false);
  const [accessEvents,setAccessEvents]=useState<Row[]>([]);
  const [eventAttendance,setEventAttendance]=useState<Row[]>([]);
  const [eventName,setEventName]=useState("");
  const [eventDescription,setEventDescription]=useState("");
  const [eventStart,setEventStart]=useState("");
  const [eventEnd,setEventEnd]=useState("");
  const [selectedEventId,setSelectedEventId]=useState("");
  const [eventParentQr,setEventParentQr]=useState("");




  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [req, auth, rec, rel, students, staff, settingsResult, devicesResult, parentAccountsResult, eventsResult, eventAttendanceResult] = await Promise.all([
        db.from("parent_official_access_requests").select("*").eq("school_id", schoolId).order("created_at",{ascending:false}).limit(250),
        db.from("child_collection_authorizations").select("*").eq("school_id", schoolId).order("created_at",{ascending:false}).limit(250),
        db.from("people_status_records").select("*").eq("school_id", schoolId).order("created_at",{ascending:false}).limit(250),
        db.from("child_collection_releases").select("*").eq("school_id", schoolId).order("release_time",{ascending:false}).limit(100),
        db.from("students").select("id,person_id,user_id,admission_number,status").eq("school_id", schoolId).order("admission_number"),
        db.from("staff").select("id,person_id,user_id,staff_number,job_title,status").eq("school_id", schoolId).order("staff_number"),
        db.from("smart_access_settings").select("*").eq("school_id",schoolId).maybeSingle(),
        db.from("biometric_devices").select("id,device_name").eq("school_id",schoolId).eq("is_active",true).order("device_name"),
        db.from("parent_portal_accounts").select("parent_guardian_id,user_id").eq("school_id",schoolId).eq("is_active",true),
        db.from("school_access_events").select("*").eq("school_id",schoolId).order("starts_at",{ascending:false}).limit(100),
        db.from("school_access_event_attendance").select("*").eq("school_id",schoolId).order("checked_in_at",{ascending:false}).limit(200),
      ]);
      for (const result of [req,auth,rec,rel,students,staff,settingsResult,devicesResult,parentAccountsResult,eventsResult,eventAttendanceResult]) if (result.error) throw result.error;
      const rows = [...(students.data??[]).map((p:Row)=>({...p,type:"student" as const,label:p.admission_number||"Student"})), ...(staff.data??[]).map((p:Row)=>({...p,type:"staff" as const,label:p.staff_number||p.job_title||"Staff"}))];
      const personIds = [...new Set(rows.map((p:Row)=>p.person_id).filter(Boolean))];
      const peopleResult = personIds.length ? await db.from("people").select("id,user_id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",personIds) : {data:[],error:null};
      if (peopleResult.error) throw peopleResult.error;
      const names = new Map((peopleResult.data??[]).map((p:Row)=>[p.id,[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")]));
      const personUsers = new Map((peopleResult.data??[]).map((p:Row)=>[p.id,p.user_id??null]));
      setPeople(rows.map((p:Row)=>({id:p.id,user_id:p.user_id??personUsers.get(p.person_id)??null,type:p.type,label:names.get(p.person_id)||p.label,is_active:p.status==="active"})));
      setRequests(req.data??[]); setAuthorizations(auth.data??[]); setRecords(rec.data??[]); setReleases(rel.data??[]); setSettings(settingsResult.data??{student_qr_enabled:false,staff_qr_enabled:false,parent_qr_enabled:false,child_pickup_enabled:false,parent_events_enabled:false});
      setDevices(devicesResult.data??[]);
      setReleaseStationId((current:string)=>current||devicesResult.data?.[0]?.id||"");
      const parentIds=[...new Set((parentAccountsResult.data??[]).map((x:any)=>x.parent_guardian_id).filter(Boolean))];
      const guardianResult=parentIds.length?await db.from("parents_guardians").select("id,person_id").eq("school_id",schoolId).eq("portal_enabled",true).in("id",parentIds):{data:[],error:null};
      if(guardianResult.error)throw guardianResult.error;
      const guardianPersonIds=(guardianResult.data??[]).map((x:any)=>x.person_id).filter(Boolean);
      const guardianPeople=guardianPersonIds.length?await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",guardianPersonIds):{data:[],error:null};
      if(guardianPeople.error)throw guardianPeople.error;
      const guardianNames=new Map((guardianPeople.data??[]).map((x:any)=>[x.id,[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")]));
      const activeParentAccounts = parentAccountsResult.data ?? [];
      const activeParentIds = new Set(activeParentAccounts.map((account:any)=>account.parent_guardian_id));
      setParentOptions((guardianResult.data??[]).filter((x:any)=>activeParentIds.has(x.id)).map((x:any)=>({id:x.id,label:guardianNames.get(x.person_id)||"Parent / guardian",userId:activeParentAccounts.find((account:any)=>account.parent_guardian_id===x.id)?.user_id??null})));
      setAccessEvents(eventsResult.data??[]);
      setEventAttendance(eventAttendanceResult.data??[]);
      setSelectedEventId((current:string)=>current||eventsResult.data?.find((x:any)=>x.is_open_for_registration)?.id||"");
    } catch (e) { setError(e instanceof Error ? e.message : "Smart Access records could not be loaded."); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>()=>{parentScanActive.current=false;parentStreamRef.current?.getTracks().forEach(t=>t.stop());},[]);
  function stopParentQrScan(){
    parentScanActive.current=false;
    parentStreamRef.current?.getTracks().forEach(t=>t.stop());
    parentStreamRef.current=null;
    if(parentVideoRef.current)parentVideoRef.current.srcObject=null;
    setParentQrScanning(false);
  }
  async function startParentQrScan(){
    setError("");setNotice("");
    try{
      const Detector=(window as any).BarcodeDetector;
      if(!Detector)throw new Error("This browser does not support built-in QR scanning. Use a supported Android Chrome browser or paste the credential.");
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      parentStreamRef.current=stream;
      if(!parentVideoRef.current)throw new Error("Camera preview is unavailable.");
      parentVideoRef.current.srcObject=stream;await parentVideoRef.current.play();
      const detector=new Detector({formats:["qr_code"]});
      parentScanActive.current=true;setParentQrScanning(true);
      const scan=async()=>{
        if(!parentScanActive.current||!parentVideoRef.current)return;
        try{
          const found=await detector.detect(parentVideoRef.current);
          const value=found?.[0]?.rawValue;
          if(value){setParentQrCode(value);setEventParentQr(value);stopParentQrScan();setNotice("Parent QR read. Visually verify identity before recording collection or event attendance.");return;}
        }catch(e){setError(e instanceof Error?e.message:"Parent QR scan failed.");}
        if(parentScanActive.current)window.requestAnimationFrame(()=>void scan());
      };
      window.requestAnimationFrame(()=>void scan());
    }catch(e){stopParentQrScan();setError(e instanceof Error?e.message:"Could not start the parent QR scanner.");}
  }


  async function saveSettings(next:Row) {
    setSaving("settings");setError("");setNotice("");
    try {
      const db=getSupabaseClient() as any;
      const {error:e}=await db.from("smart_access_settings").upsert({...next,school_id:schoolId,updated_by:userId,updated_at:new Date().toISOString()},{onConflict:"school_id"});
      if(e)throw e;
      setSettings(next);setNotice("Smart Access settings saved. New QR and pickup actions now follow these school controls.");
    }catch(e){setError(e instanceof Error?e.message:"Could not save Smart Access settings.");}
    finally{setSaving("");}
  }

  async function updateRequest(row:Row,status:"approved"|"rejected"|"revoked") {
    setSaving(row.id); setError(""); setNotice("");
    try {
      const db=getSupabaseClient() as any;
      const {data,error:e}=await db.rpc("resa_review_parent_access_request",{
        p_school_id:schoolId,p_request_id:row.id,p_decision:status,p_review_note:reviewNote[row.id]?.trim()||null,
      });
      if(e) throw e;
      if(!data?.success)throw new Error("Parent request decision was not saved.");
      setNotice("Parent request decision saved. Any linked child-pickup authorization was updated in the same transaction."); await load();
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

  async function createAccessEvent(event:FormEvent){
    event.preventDefault();setSaving("event");setError("");setNotice("");
    try{
      if(eventName.trim().length<2||!eventStart)throw new Error("Enter the event name and start time.");
      const startsAt=new Date(eventStart+":00+01:00");
      const endsAt=eventEnd?new Date(eventEnd+":00+01:00"):null;
      if(Number.isNaN(startsAt.getTime())||(endsAt&&endsAt<=startsAt))throw new Error("Check the event date and end time.");
      const db=getSupabaseClient() as any;
      const {data,error:e}=await db.from("school_access_events").insert({
        school_id:schoolId,event_name:eventName.trim(),event_description:eventDescription.trim(),
        starts_at:startsAt.toISOString(),ends_at:endsAt?.toISOString()||null,is_open_for_registration:true,created_by:userId,
      }).select("*").single();
      if(e)throw e;
      setAccessEvents(previous=>[data,...previous]);setSelectedEventId(data.id);
      setEventName("");setEventDescription("");setEventStart("");setEventEnd("");
      setNotice("School event created. Parent event check-in is separate from child collection.");
    }catch(e){setError(e instanceof Error?e.message:"Could not create school event.");}
    finally{setSaving("");}
  }

  async function checkinParentEvent(event:FormEvent){
    event.preventDefault();setSaving("event-checkin");setError("");setNotice("");
    try{
      if(!selectedEventId)throw new Error("Select an event that is open for check-in.");
      const raw=eventParentQr.trim().replace(/^RESA1:/i,"");
      if(!/^[A-Za-z0-9_-]{22}$/.test(raw))throw new Error("Enter a valid parent QR credential.");
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
      const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
      const db=getSupabaseClient() as any;
      const {data,error:e}=await db.rpc("resa_record_parent_event_checkin",{
        p_school_id:schoolId,p_event_id:selectedEventId,p_parent_qr_hash:hash,p_station_id:releaseStationId||null,
      });
      if(e)throw e;if(!data?.success)throw new Error("Parent event check-in was not recorded.");
      setEventParentQr("");setNotice("Parent checked in for the school event. This does not release any child.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Parent event check-in failed.");}
    finally{setSaving("");}
  }

  async function recordChildRelease(event:FormEvent) {
    event.preventDefault();setSaving("release");setError("");setNotice("");
    try {
      if(!releaseStudentId)throw new Error("Select the student being collected.");
      if(releaseCollector.trim().length<2||releaseNote.trim().length<3)throw new Error("Enter the collector name and identity-verification note.");
      let authorizationId:string|null=null;
      let parentHash:string|null=null;
      if(releaseMethod==="approved_collector"){
        if(!releaseAuthorizationId)throw new Error("Select an approved, unused collection authorization.");
        authorizationId=releaseAuthorizationId;
      } else if(releaseMethod==="parent_qr"){
        const raw=parentQrCode.trim().replace(/^RESA1:/i,"");
        if(!/^[A-Za-z0-9_-]{22}$/.test(raw))throw new Error("Enter a valid parent QR credential.");
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
        parentHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
      }
      const db=getSupabaseClient() as any;
      const {data,error:e}=await db.rpc("resa_record_child_collection_release",{
        p_school_id:schoolId,p_student_id:releaseStudentId,p_collector_full_name:releaseCollector.trim(),
        p_collector_relationship:releaseRelationship.trim()||null,p_verification_method:releaseMethod,
        p_verification_note:releaseNote.trim(),p_authorization_id:authorizationId,p_parent_qr_hash:parentHash,
        p_station_id:releaseStationId||null,
      });
      if(e)throw e;if(!data?.success)throw new Error("The child release was not recorded.");
      setReleaseCollector("");setReleaseRelationship("");setReleaseNote("");setParentQrCode("");setReleaseAuthorizationId("");
      setNotice("Child collection recorded successfully. The approved authorization was consumed where applicable.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Child collection could not be recorded.");}
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
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">School feature controls</h2><p className="text-sm text-slate-600">All sensitive access features start disabled and require an administrator to enable them.</p></div><ShieldCheck className="text-emerald-800"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([["student_qr_enabled","Student QR attendance"],["staff_qr_enabled","Staff QR attendance"],["parent_qr_enabled","Parent QR identity"],["child_pickup_enabled","Child pickup authorization"],["parent_events_enabled","Parent event check-in"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(settings[key])} disabled={!!saving} onChange={e=>void saveSettings({...settings,[key]:e.target.checked})}/>{label}</label>)}</div></section>
      <SmartAccessIdCards schoolId={schoolId} people={people} parentOptions={parentOptions} staffQrEnabled={Boolean(settings.staff_qr_enabled)} parentQrEnabled={Boolean(settings.parent_qr_enabled)} />
      <nav className="flex flex-wrap gap-2">{([["requests","Parent requests"],["pickup","Child pickup approvals"],["people","People records"],["releases","Collection register"],["events","School events"]] as const).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab===key?"bg-emerald-900 text-white":"border bg-white text-slate-700"}`}>{label}</button>)}</nav>
      {error&&<p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      {loading?<p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading safeguarding records…</p>:null}
      {!loading&&tab==="requests"&&<section className="space-y-3">{requests.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No parent official-access requests have been submitted.</p>:requests.map(row=><article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-extrabold capitalize">{String(row.purpose).replaceAll("_"," ")}</h2><p className="mt-1 text-sm text-slate-600">Delegate: {row.delegate_full_name} · {row.delegate_phone} · {row.delegate_relationship||"Relationship not stated"}</p><p className="mt-1 text-xs text-slate-500">Visit: {dateLabel(row.requested_visit_at)} · Submitted: {dateLabel(row.created_at)}</p><p className="mt-3 whitespace-pre-wrap text-sm">{row.purpose_details}</p><p className="mt-2 text-xs text-slate-500">Department: {row.intended_department||"Not specified"} · Staff: {row.intended_staff_member||"Not specified"}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-900">{String(row.request_status).replaceAll("_"," ")}</span></div>{row.request_status==="pending"&&<div className="mt-4 border-t pt-4"><label className="block text-sm font-semibold">Review note<input className={field} value={reviewNote[row.id]||""} onChange={e=>setReviewNote(p=>({...p,[row.id]:e.target.value}))} placeholder="Optional decision note"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!saving} onClick={()=>void updateRequest(row,"approved")} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="mr-1 inline" size={16}/> Approve</button><button disabled={!!saving} onClick={()=>void updateRequest(row,"rejected")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50"><XCircle className="mr-1 inline" size={16}/> Reject</button></div></div>}</article>)}</section>}
      {!loading&&tab==="pickup"&&<section className="space-y-3">{authorizations.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No child collection authorizations have been submitted.</p>:authorizations.map(row=><article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-extrabold">{row.collector_full_name}</h2><p className="mt-1 text-sm text-slate-600">{row.collector_phone} · {row.relationship}</p><p className="mt-1 text-xs text-slate-500">Valid from {dateLabel(row.valid_from)} · Until {dateLabel(row.valid_until)}</p><p className="mt-2 text-xs text-slate-600">Student record: {row.student_id}</p>{row.consumed_at&&<p className="mt-2 text-xs font-bold text-emerald-800">Used for collection at {dateLabel(row.consumed_at)}</p>}</div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-900">{String(row.approval_status).replaceAll("_"," ")}</span></div>{row.approval_status==="pending"&&<div className="mt-4 border-t pt-4"><label className="block text-sm font-semibold">Review note<input className={field} value={reviewNote[row.id]||""} onChange={e=>setReviewNote(p=>({...p,[row.id]:e.target.value}))} placeholder="Optional decision note"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!saving} onClick={()=>void updateAuthorization(row,"approved")} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Approve pickup</button><button disabled={!!saving} onClick={()=>void updateAuthorization(row,"rejected")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">Reject</button></div></div>}</article>)}</section>}
      {!loading&&tab==="people"&&<div className="grid gap-5 lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]"><form onSubmit={createRecord} className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-extrabold">Create confidential record</h2><p className="mt-1 text-sm text-slate-600">New records begin as drafts and are not shown to the subject until formally issued.</p><label className="mt-4 block text-sm font-semibold">Person type<select className={field} value={subjectType} onChange={e=>{setSubjectType(e.target.value as any);setSubjectId("");}}><option value="student">Student</option><option value="staff">Teacher / staff</option></select></label><label className="mt-3 block text-sm font-semibold">Person<select className={field} value={subjectId} onChange={e=>setSubjectId(e.target.value)} required><option value="">Select person</option>{selectedPeople.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Record category<select className={field} value={category} onChange={e=>setCategory(e.target.value)}>{["query","investigation","warning","suspension","expulsion","termination","commendation","award","promotion","appointment","role_change","other"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Title<input className={field} value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={180} required/></label><label className="mt-3 block text-sm font-semibold">Details<textarea className={field} rows={4} value={details} onChange={e=>setDetails(e.target.value)} minLength={5} maxLength={5000} required/></label><label className="mt-3 block text-sm font-semibold">Severity<select className={field} value={severity} onChange={e=>setSeverity(e.target.value)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="serious">Serious</option><option value="critical">Critical</option></select></label><button disabled={saving==="record"} className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving==="record"?"Saving…":"Save as confidential draft"}</button></form><section className="space-y-3"><h2 className="text-lg font-extrabold">Student and staff records</h2>{records.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No people-status records yet.</p>:records.map(row=>{const person=peopleById.get(row.subject_record_id);return <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-extrabold">{row.record_title}</p><p className="mt-1 text-sm text-slate-600">{person?.label||row.subject_record_id} · {row.subject_type} · {row.record_category.replaceAll("_"," ")}</p><p className="mt-2 whitespace-pre-wrap text-sm">{row.record_details}</p><p className="mt-2 text-xs text-slate-500">Created {dateLabel(row.created_at)} · Effective {dateLabel(row.effective_from)}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{row.record_status.replaceAll("_"," ")}</span></div>{row.record_status==="draft"&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={!!saving} onClick={()=>void updateRecord(row,"pending_review")} className="rounded-xl border px-3 py-2 text-xs font-bold">Submit for review</button><button disabled={!!saving} onClick={()=>void updateRecord(row,"issued")} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Issue record</button></div>}{row.record_status==="under_appeal"&&<div className="mt-3 flex gap-2"><button disabled={!!saving} onClick={()=>void updateRecord(row,"upheld")} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Uphold</button><button disabled={!!saving} onClick={()=>void updateRecord(row,"reversed")} className="rounded-xl border px-3 py-2 text-xs font-bold">Reverse</button></div>}</article>})}</section></div>}
      {!loading&&tab==="events"&&<div className="grid gap-4 lg:grid-cols-2">
       <form onSubmit={createAccessEvent} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Create school event</h2>
        <p className="mt-1 text-sm text-slate-600">For PTA meetings, parent meetings, school events and visitor attendance. This register is separate from student pickup.</p>
        <label className="mt-3 block text-sm font-semibold">Event name<input className={field} value={eventName} onChange={e=>setEventName(e.target.value)} minLength={2} maxLength={160} required/></label>
        <label className="mt-3 block text-sm font-semibold">Description<textarea className={field} value={eventDescription} onChange={e=>setEventDescription(e.target.value)} maxLength={1000}/></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Starts<input type="datetime-local" className={field} value={eventStart} onChange={e=>setEventStart(e.target.value)} required/></label><label className="text-sm font-semibold">Ends (optional)<input type="datetime-local" className={field} value={eventEnd} onChange={e=>setEventEnd(e.target.value)}/></label></div>
        <button disabled={saving==="event"} className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving==="event"?"Creating…":"Create event"}</button>
       </form>
       <form onSubmit={checkinParentEvent} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Parent event check-in</h2>
        <p className="mt-1 text-sm text-slate-600">Enter the parent's school-issued QR credential after visually verifying identity.</p>
        <label className="mt-3 block text-sm font-semibold">Event<select className={field} value={selectedEventId} onChange={e=>setSelectedEventId(e.target.value)} required><option value="">Select event</option>{accessEvents.filter(e=>e.is_open_for_registration).map(e=><option key={e.id} value={e.id}>{e.event_name} · {dateLabel(e.starts_at)}</option>)}</select></label>
        <label className="mt-3 block text-sm font-semibold">Parent QR credential<input className={field+" font-mono"} value={eventParentQr} onChange={e=>setEventParentQr(e.target.value)} placeholder="RESA1:…"/></label><video ref={parentVideoRef} muted playsInline className={parentQrScanning?"mt-2 aspect-video w-full rounded-xl bg-slate-950 object-cover":"hidden"}/><div className="mt-2 flex gap-2"><button type="button" onClick={()=>void startParentQrScan()} disabled={parentQrScanning} className="rounded-lg border px-3 py-2 text-xs font-bold">Scan parent QR with camera</button>{parentQrScanning&&<button type="button" onClick={stopParentQrScan} className="rounded-lg border px-3 py-2 text-xs font-bold">Stop camera</button>}</div>
        <label className="mt-3 block text-sm font-semibold">Station (optional)<select className={field} value={releaseStationId} onChange={e=>setReleaseStationId(e.target.value)}><option value="">No station selected</option>{devices.map(d=><option key={d.id} value={d.id}>{d.device_name}</option>)}</select></label>
        <button disabled={saving==="event-checkin"||!settings.parent_events_enabled||!settings.parent_qr_enabled} className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving==="event-checkin"?"Recording…":"Record parent event check-in"}</button>
       </form>
       <section className="rounded-2xl border bg-white p-5 shadow-sm lg:col-span-2"><h2 className="text-lg font-extrabold">Recent event attendance</h2>{eventAttendance.length===0?<p className="mt-3 text-sm text-slate-500">No parent event check-ins recorded.</p>:<div className="mt-3 divide-y">{eventAttendance.map(row=><div key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{accessEvents.find(e=>e.id===row.event_id)?.event_name||"School event"} · Parent record {row.parent_guardian_id}</span><span className="text-slate-500">{dateLabel(row.checked_in_at)}</span></div>)}</div>}</section>
      </div>}
      {!loading&&tab==="releases"&&<section className="space-y-4">
       <form onSubmit={recordChildRelease} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Verify and record child collection</h2>
        <p className="mt-1 text-sm text-slate-600">A QR scan alone never releases a child. Staff must check the approved permission and visually verify the collector.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
         <label className="text-sm font-semibold">Student<select className={field} value={releaseStudentId} onChange={e=>setReleaseStudentId(e.target.value)} required><option value="">Select student</option>{people.filter(p=>p.type==="student").map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
         <label className="text-sm font-semibold">Verification method<select className={field} value={releaseMethod} onChange={e=>setReleaseMethod(e.target.value as any)}><option value="approved_collector">Approved delegate authorization</option><option value="parent_qr">Verified parent QR</option><option value="manual_verified">Manual identity verification</option></select></label>
         <label className="text-sm font-semibold">Collector full name<input className={field} value={releaseCollector} onChange={e=>setReleaseCollector(e.target.value)} minLength={2} maxLength={160} required/></label>
         <label className="text-sm font-semibold">Relationship<input className={field} value={releaseRelationship} onChange={e=>setReleaseRelationship(e.target.value)} maxLength={80}/></label>
         {releaseMethod==="approved_collector"&&<label className="text-sm font-semibold sm:col-span-2">Approved, unused authorization<select className={field} value={releaseAuthorizationId} onChange={e=>{setReleaseAuthorizationId(e.target.value);const a=authorizations.find(x=>x.id===e.target.value);if(a){setReleaseStudentId(a.student_id);setReleaseCollector(a.collector_full_name);setReleaseRelationship(a.relationship||"");}}} required><option value="">Select approved authorization</option>{authorizations.filter(a=>a.approval_status==="approved"&&!a.consumed_at&&(!a.valid_until||new Date(a.valid_until)>new Date())).map(a=><option key={a.id} value={a.id}>{a.collector_full_name} · {a.student_id} · expires {dateLabel(a.valid_until)}</option>)}</select></label>}
         {releaseMethod==="parent_qr"&&<div className="sm:col-span-2"><label className="text-sm font-semibold">Parent QR credential<input className={field+" font-mono"} value={parentQrCode} onChange={e=>setParentQrCode(e.target.value)} placeholder="Scan or paste RESA1:… parent credential" required/></label><video ref={parentVideoRef} muted playsInline className={parentQrScanning?"mt-2 aspect-video w-full rounded-xl bg-slate-950 object-cover":"hidden"}/><div className="mt-2 flex gap-2"><button type="button" onClick={()=>void startParentQrScan()} disabled={parentQrScanning} className="rounded-lg border px-3 py-2 text-xs font-bold">Scan parent QR with camera</button>{parentQrScanning&&<button type="button" onClick={stopParentQrScan} className="rounded-lg border px-3 py-2 text-xs font-bold">Stop camera</button>}</div></div>}
         <label className="text-sm font-semibold">Attendance station (optional)<select className={field} value={releaseStationId} onChange={e=>setReleaseStationId(e.target.value)}><option value="">No station selected</option>{devices.map(d=><option key={d.id} value={d.id}>{d.device_name}</option>)}</select></label>
         <label className="text-sm font-semibold sm:col-span-2">Identity verification note<textarea className={field} value={releaseNote} onChange={e=>setReleaseNote(e.target.value)} minLength={3} maxLength={1000} required placeholder="Record how the collector's identity and authorization were checked."/></label>
        </div>
        <button disabled={saving==="release"} className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving==="release"?"Recording…":"Confirm verified child release"}</button>
       </form>
       {releases.length===0?<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No child collection releases have been recorded.</p>:releases.map(row=><article key={row.id} className="flex flex-wrap justify-between gap-3 rounded-2xl border bg-white p-4"><div><p className="font-bold">{row.collector_full_name}</p><p className="mt-1 text-xs text-slate-500">Student: {row.student_id} · {row.collector_relationship||"Relationship not stated"}</p><p className="mt-1 text-xs text-slate-500">{row.verification_method.replaceAll("_"," ")} · {dateLabel(row.release_time)}</p><p className="mt-2 text-sm">{row.verification_note}</p></div><span className="h-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Recorded</span></article>)}
      </section>}
      <div className="flex justify-end"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={15}/> Refresh records</button></div>
    </div>
  </main>;
}
