import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Copy, QrCode, RefreshCw, ShieldCheck, Square } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import QrCodeDisplay from "@/components/qr-code-display";

type Person={id:string;type:"student"|"staff";label:string};
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return hex(new Uint8Array(digest));}

export default function QrAttendancePanel({schoolId,stationId}:{schoolId:string;stationId:string}){
 const [people,setPeople]=useState<Person[]>([]);
 const [personType,setPersonType]=useState<"student"|"staff">("student");
 const [personId,setPersonId]=useState("");
 const [payload,setPayload]=useState("");
 const [manualCode,setManualCode]=useState("");
 const [action,setAction]=useState<"check_in"|"check_out">("check_in");
 const [busy,setBusy]=useState(false);
 const [scanning,setScanning]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const activeRef=useRef(false);

 const loadPeople=useCallback(async()=>{
  try{
   const db=getSupabaseClient() as any;
   const [s,st]=await Promise.all([
    db.from("students").select("id,person_id,admission_number").eq("school_id",schoolId).eq("status","active"),
    db.from("staff").select("id,person_id,staff_number,job_title").eq("school_id",schoolId).eq("status","active"),
   ]);
   if(s.error)throw s.error;if(st.error)throw st.error;
   const rows=[...(s.data??[]).map((x:any)=>({...x,type:"student" as const, fallback:x.admission_number})),...(st.data??[]).map((x:any)=>({...x,type:"staff" as const,fallback:x.staff_number||x.job_title}))];
   const ids=rows.map((x:any)=>x.person_id).filter(Boolean);
   const p=ids.length?await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",ids):{data:[],error:null};
   if(p.error)throw p.error;
   const names=new Map((p.data??[]).map((x:any)=>[x.id,[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")]));
   setPeople(rows.map((x:any)=>({id:x.id,type:x.type,label:names.get(x.person_id)||x.fallback||"School member"})));
  }catch(e){setError(e instanceof Error?e.message:"Could not load the school roster for QR credentials.");}
 },[schoolId]);
 useEffect(()=>{void loadPeople();},[loadPeople]);
 useEffect(()=>{if(!people.some(p=>p.id===personId&&p.type===personType)){setPersonId(people.find(p=>p.type===personType)?.id||"");}},[people,personId,personType]);

 const stopCamera=useCallback(()=>{
  activeRef.current=false;
  streamRef.current?.getTracks().forEach(track=>track.stop());
  streamRef.current=null;
  if(videoRef.current)videoRef.current.srcObject=null;
  setScanning(false);
 },[]);
 useEffect(()=>()=>{activeRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());},[]);

 async function recordPayload(value:string){
  const raw=value.trim();
  const token=raw.startsWith("RESA1:")?raw.slice(6):raw;
  if(!/^[A-Za-z0-9_-]{22}$/.test(token))throw new Error("This is not a valid RESA QR credential.");
  if(!stationId)throw new Error("Select an active attendance station first.");
  setBusy(true);setError("");setNotice("");
  try{
   const tokenHash=await sha256(token);
   const db=getSupabaseClient() as any;
   const {data,error:e}=await db.rpc("resa_record_qr_attendance",{p_token_hash:tokenHash,p_station_id:stationId,p_event_type:action});
   if(e)throw e;
   if(!data?.success)throw new Error("Attendance was not recorded.");
   setNotice(`${data.person_name||"School member"} (${data.person_type}) ${action==="check_in"?"checked in":"checked out"} successfully at ${new Date(data.event_time).toLocaleTimeString("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit"})}.`);
   setManualCode("");
   stopCamera();
  }catch(e){stopCamera();setError(e instanceof Error?e.message:"The QR attendance event could not be recorded.");}
  finally{setBusy(false);}
 }

 async function issueCredential(){
  setBusy(true);setError("");setNotice("");setPayload("");
  try{
   if(!personId)throw new Error("Select a student or staff member.");
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const token=hex(bytes);
   const tokenHash=await sha256(token);
   const db=getSupabaseClient() as any;
   const {data,error:e}=await db.rpc("resa_issue_attendance_qr",{p_school_id:schoolId,p_person_type:personType,p_person_id:personId,p_token_hash:tokenHash});
   if(e)throw e;
   setPayload("RESA1:"+token);
   setNotice(`A new ${personType} credential was issued. Any previous credential for this person has been revoked. Save this value now; the raw token cannot be retrieved later.`);
  }catch(e){setError(e instanceof Error?e.message:"Could not issue the QR credential.");}
  finally{setBusy(false);}
 }

 async function startCamera(){
  setError("");setNotice("");
  try{
   const Detector=(window as any).BarcodeDetector;
   if(!Detector)throw new Error("This browser does not support built-in QR scanning. Use the manual credential field below or a supported Android Chrome browser.");
   if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable. Open the secure HTTPS portal and allow camera permission.");
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
   streamRef.current=stream;
   if(!videoRef.current)throw new Error("Camera preview is unavailable.");
   videoRef.current.srcObject=stream;
   await videoRef.current.play();
   const detector=new Detector({formats:["qr_code"]});
   activeRef.current=true;setScanning(true);
   const loop=async()=>{
    if(!activeRef.current||!videoRef.current)return;
    try{
     const codes=await detector.detect(videoRef.current);
     const value=codes?.[0]?.rawValue;
     if(value){activeRef.current=false;await recordPayload(value);return;}
    }catch(e){setError(e instanceof Error?e.message:"Camera scan failed.");}
    if(activeRef.current)window.requestAnimationFrame(()=>void loop());
   };
   window.requestAnimationFrame(()=>void loop());
  }catch(e){stopCamera();setError(e instanceof Error?e.message:"Could not start the camera.");}
 }

 const filtered=people.filter(p=>p.type===personType);
 return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><QrCode size={22}/></span><div><h2 className="text-lg font-extrabold">QR attendance & credential control</h2><p className="text-sm text-slate-600">Issue revocable credentials and scan them at the selected station.</p></div></div><ShieldCheck className="text-emerald-800" size={22}/></div>
  {error&&<p role="alert" className="mt-3 break-words rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
   <div className="rounded-xl border p-4"><h3 className="font-bold">Issue / rotate a credential</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Person type<select className="mt-1 w-full rounded-lg border px-3 py-2.5" value={personType} onChange={e=>setPersonType(e.target.value as any)}><option value="student">Student</option><option value="staff">Teacher / staff</option></select></label><label className="text-sm font-semibold">Person<select className="mt-1 w-full rounded-lg border px-3 py-2.5" value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Select person</option>{filtered.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></div><button type="button" onClick={()=>void issueCredential()} disabled={busy||!personId} className="mt-3 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Working…":"Issue new secure credential"}</button>{payload&&<div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">One-time RESA QR credential</p><div className="mt-2 flex flex-wrap items-center gap-3"><QrCodeDisplay value={payload} size={180}/><div className="min-w-0 flex-1"><p className="text-xs leading-5 text-slate-600">This QR is generated locally in the browser. The raw credential is never sent to a QR website.</p><textarea readOnly value={payload} rows={3} className="mt-2 w-full break-all rounded-lg border bg-white p-2 font-mono text-xs"/></div></div><button type="button" onClick={()=>void navigator.clipboard.writeText(payload)} className="mt-2 inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Copy size={14}/> Copy credential</button><p className="mt-2 text-xs leading-5 text-amber-800">Treat this as a password. Do not send it in a public message or use a third-party QR generator that uploads the token.</p></div>}</div>
   <div className="rounded-xl border p-4"><h3 className="font-bold">Scan attendance QR</h3><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setAction("check_in")} className={`rounded-lg px-3 py-2 text-sm font-bold ${action==="check_in"?"bg-emerald-900 text-white":"border"}`}>Check in</button><button type="button" onClick={()=>setAction("check_out")} className={`rounded-lg px-3 py-2 text-sm font-bold ${action==="check_out"?"bg-emerald-900 text-white":"border"}`}>Check out</button></div><video ref={videoRef} muted playsInline className={`mt-3 aspect-video w-full rounded-xl bg-slate-950 object-cover ${scanning?"block":"hidden"}`}/><div className="mt-3 flex flex-wrap gap-2">{!scanning?<button type="button" onClick={()=>void startCamera()} disabled={busy||!stationId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Camera size={16}/> Start camera scanner</button>:<button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold"><Square size={15}/> Stop scanner</button>}</div><label className="mt-3 block text-sm font-semibold">Manual credential fallback<input className="mt-1 w-full rounded-lg border px-3 py-2.5 font-mono text-xs" value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="Paste RESA1:… code"/></label><button type="button" onClick={()=>void recordPayload(manualCode)} disabled={busy||!manualCode.trim()||!stationId} className="mt-2 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50">Record verified scan</button></div>
  </div>
  <p className="mt-3 text-xs leading-5 text-slate-500">The camera reads the credential; it does not prove who is holding the card. Staff must visually verify the passport photo. Child pickup is handled separately and requires an approved authorization or verified parent identity.</p>
 </section>;
}
