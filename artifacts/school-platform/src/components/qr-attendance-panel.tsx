import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Copy, QrCode, ShieldCheck, Square } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import QrCodeDisplay from "@/components/qr-code-display";

type Person={id:string;type:"student"|"staff";label:string};
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return hex(new Uint8Array(digest));}
export default function QrAttendancePanel({schoolId,stationId,onRecorded}:{schoolId:string;stationId:string;onRecorded?:()=>void}){
 const [people,setPeople]=useState<Person[]>([]),[personType,setPersonType]=useState<"student"|"staff">("student"),[personId,setPersonId]=useState(""),[payload,setPayload]=useState(""),[manualCode,setManualCode]=useState(""),[action,setAction]=useState<"check_in"|"check_out">("check_in"),[busy,setBusy]=useState(false),[scanning,setScanning]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[currentCaptured,setCurrentCaptured]=useState<{name:string;type:string;action:string;time:string}|null>(null),[captureSearch,setCaptureSearch]=useState(""),[captureHistory,setCaptureHistory]=useState<Array<{id:string;name:string;type:string;action:string;time:string}>>([]);
 const videoRef=useRef<HTMLVideoElement|null>(null),streamRef=useRef<MediaStream|null>(null),activeRef=useRef(false),busyRef=useRef(false),lastDecodedRef=useRef(""),onRecordedRef=useRef(onRecorded);
 useEffect(()=>{onRecordedRef.current=onRecorded;},[onRecorded]);
 const loadPeople=useCallback(async()=>{try{const db=getSupabaseClient() as any;const [s,st]=await Promise.all([db.from("students").select("id,person_id,admission_number").eq("school_id",schoolId).eq("status","active"),db.from("staff").select("id,person_id,staff_number,job_title").eq("school_id",schoolId).eq("status","active")]);if(s.error)throw s.error;if(st.error)throw st.error;const rows=[...(s.data??[]).map((x:any)=>({...x,type:"student" as const,fallback:x.admission_number})),...(st.data??[]).map((x:any)=>({...x,type:"staff" as const,fallback:x.staff_number||x.job_title}))];const ids=rows.map((x:any)=>x.person_id).filter(Boolean);const p=ids.length?await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",ids):{data:[],error:null};if(p.error)throw p.error;const names=new Map((p.data??[]).map((x:any)=>[x.id,[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")]));setPeople(rows.map((x:any)=>({id:x.id,type:x.type,label:names.get(x.person_id)||x.fallback||"School member"})));}catch(e){setError(e instanceof Error?e.message:"Could not load the school roster for QR credentials.");}},[schoolId]);
 useEffect(()=>{void loadPeople();},[loadPeople]);
 useEffect(()=>{if(!people.some(p=>p.id===personId&&p.type===personType))setPersonId(people.find(p=>p.type===personType)?.id||"");},[people,personId,personType]);
 const stopCamera=useCallback(()=>{activeRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;if(videoRef.current)videoRef.current.srcObject=null;setScanning(false);},[]);
 useEffect(()=>()=>{activeRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());},[]);
 async function recordPayload(value:string){
  if(busyRef.current)return;const raw=value.trim(),isCardId=raw.startsWith("RESA-ID:"),token=raw.startsWith("RESA1:")?raw.slice(6):raw;
  if(isCardId?!/^RESA-ID:[0-9a-fA-F-]{36}$/.test(raw):!/^[A-Za-z0-9_-]{22}$/.test(token))throw new Error("This is not a valid RESA QR credential.");
  if(!stationId)throw new Error("Select an active attendance station first.");
  busyRef.current=true;setBusy(true);setError("");setNotice("");
  const db=getSupabaseClient() as any;
  let tokenHash=isCardId?raw:token;
  try{tokenHash=isCardId?raw:await sha256(token);const {data,error:e}=await db.rpc("resa_record_qr_attendance",{p_token_hash:tokenHash,p_station_id:stationId,p_event_type:action});if(e)throw e;if(!data?.success)throw new Error("Attendance was not recorded.");const capturedAt=new Date(data.event_time||Date.now()).toLocaleString("en-NG",{timeZone:"Africa/Lagos",dateStyle:"medium",timeStyle:"short"});const captured={name:String(data.person_name||"School member"),type:String(data.person_type||"member"),action,time:capturedAt};setCurrentCaptured(captured);setCaptureHistory(previous=>[{...captured,id:`${data.person_id||raw}-${data.event_time||Date.now()}`},...previous].slice(0,100));setNotice(`${captured.name} (${captured.type}) ${action==="check_in"?"checked in":"checked out"} successfully at ${capturedAt}. Scanner remains ready for the next card.`);setManualCode("");onRecordedRef.current?.();}
  catch(e){
   const message=e instanceof Error?e.message:String((e as any)?.message||"");
   if(/already checked in today/i.test(message)||/already checked out today/i.test(message)||/no valid check-in is available/i.test(message)){
    try{
     const credentialQuery=await db.from("attendance_qr_credentials").select("school_id,person_type,student_id,staff_id").eq(isCardId?"id":"token_hash",isCardId?raw.slice(8):tokenHash).eq("is_active",true).maybeSingle();
     if(credentialQuery.error)throw credentialQuery.error;
     const credential=credentialQuery.data;
     if(credential?.person_type==="student"&&credential.student_id){
      const [studentResult,attendanceResult]=await Promise.all([
       db.from("students").select("id,person_id,admission_number").eq("id",credential.student_id).eq("school_id",credential.school_id).maybeSingle(),
       db.from("student_attendance").select("check_in_at,check_out_at").eq("school_id",credential.school_id).eq("student_id",credential.student_id).eq("attendance_date",new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())).maybeSingle()
      ]);
      if(studentResult.error)throw studentResult.error;if(attendanceResult.error)throw attendanceResult.error;
      const student=studentResult.data,attendance=attendanceResult.data;
      let name=student?.admission_number||"This learner";
      if(student?.person_id){const personResult=await db.from("people").select("first_name,middle_name,last_name").eq("id",student.person_id).eq("school_id",credential.school_id).maybeSingle();if(personResult.error)throw personResult.error;if(personResult.data)name=[personResult.data.first_name,personResult.data.middle_name,personResult.data.last_name].filter(Boolean).join(" ")||name;}
      const checkedInAt=attendance?.check_in_at?new Date(attendance.check_in_at).toLocaleTimeString("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit"}):"";
      const checkedOutAt=attendance?.check_out_at?new Date(attendance.check_out_at).toLocaleTimeString("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit"}):"";
      const status=attendance?.check_out_at?"already checked out":attendance?.check_in_at?"already checked in":"has no completed attendance action";
      const statusLine=attendance?.check_out_at?`Checked in at ${checkedInAt} and checked out at ${checkedOutAt}.`:attendance?.check_in_at?`Checked in at ${checkedInAt}; still on the school premises according to today's attendance record.`:"Please check the attendance record.";
      const now=new Date().toLocaleString("en-NG",{timeZone:"Africa/Lagos",dateStyle:"medium",timeStyle:"short"});
      setNotice(`${name} has ${status} today. ${statusLine} No duplicate attendance entry was created.`);
      setManualCode("");return;
     }
    }catch(statusError){console.warn("Could not retrieve the existing attendance state after a duplicate scan.",statusError);}
   }
   throw e;
  }finally{busyRef.current=false;setBusy(false);}
 }
 async function issueCredential(){setBusy(true);setError("");setNotice("");setPayload("");try{if(!personId)throw new Error("Select a student or staff member.");const bytes=crypto.getRandomValues(new Uint8Array(16)),token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""),tokenHash=await sha256(token),db=getSupabaseClient() as any;const {data,error:e}=await db.rpc("resa_issue_attendance_qr",{p_school_id:schoolId,p_person_type:personType,p_person_id:personId,p_token_hash:tokenHash});if(e)throw e;if(!data?.credential_id)throw new Error("The ID-card QR reference was not issued.");setPayload("RESA-ID:"+data.credential_id);setNotice(`A stable ${personType} ID-card QR was issued. It remains the same when the card is reopened; it changes only when an administrator explicitly rotates the credential.`);}catch(e){setError(e instanceof Error?e.message:"Could not issue the QR credential.");}finally{setBusy(false);}}
 async function loadJsQr():Promise<any>{
  const w=window as any;if(typeof w.jsQR==="function")return w.jsQR;
  const existing=document.querySelector<HTMLScriptElement>('script[data-resa-jsqr="true"]');
  await new Promise<void>((resolve,reject)=>{const script=existing||document.createElement("script");const timeout=window.setTimeout(()=>reject(new Error("QR decoder download timed out. Check your internet connection and try again.")),15000);const done=()=>{window.clearTimeout(timeout);if(typeof (window as any).jsQR==="function")resolve();else reject(new Error("QR decoder could not be loaded. Please reload the page and try again."));};script.addEventListener("load",done,{once:true});script.addEventListener("error",()=>{window.clearTimeout(timeout);reject(new Error("QR decoder could not be downloaded. Check your internet connection."));},{once:true});if(!existing){script.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";script.async=true;script.dataset.resaJsqr="true";document.head.appendChild(script);}else if(typeof w.jsQR==="function"){window.clearTimeout(timeout);resolve();}});
  return (window as any).jsQR;
 }
 async function startCamera(){
  setError("");setNotice("");
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable. Open RESA in Chrome using its HTTPS address.");
   if(!videoRef.current)throw new Error("Camera preview element is unavailable. Reload the page and try again.");
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
   streamRef.current=stream;videoRef.current.srcObject=stream;await videoRef.current.play();
   let detector:any=null;const Detector=(window as any).BarcodeDetector;
   if(typeof Detector==="function"){try{detector=new Detector({formats:["qr_code"]});}catch{detector=null;}}
   let jsQR:any=null,canvas:HTMLCanvasElement|null=null,context:CanvasRenderingContext2D|null=null;
   try{jsQR=await loadJsQr();canvas=document.createElement("canvas");context=canvas.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("This browser could not initialise the QR image decoder.");}catch(e){if(!detector)throw e;}
   activeRef.current=true;setScanning(true);
   const loop=async()=>{
    if(!activeRef.current||!videoRef.current)return;
    const video=videoRef.current;
    let value="";
    if(video.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&video.videoWidth>0){
     try{
      if(detector){const codes=await detector.detect(video);value=codes?.find((c:any)=>typeof c.rawValue==="string"&&c.rawValue.trim())?.rawValue||"";}
      if(!value&&jsQR&&canvas&&context){const width=video.videoWidth,height=video.videoHeight;canvas.width=width;canvas.height=height;context.drawImage(video,0,0,width,height);const frame=context.getImageData(0,0,width,height);const decoded=jsQR(frame.data,width,height,{inversionAttempts:"attemptBoth"});if(decoded?.data)value=decoded.data;}
     }catch{/* A blurred frame is normal while the camera is moving; retry the next frame. */}
     if(value&&activeRef.current&&value!==lastDecodedRef.current&&!busyRef.current){
      lastDecodedRef.current=value;
      try{await recordPayload(value);setError("");}
      catch(e){setError(e instanceof Error?e.message:"QR detected, but attendance could not be recorded.");}
     }
    }
    if(!value) lastDecodedRef.current="";
    if(activeRef.current)window.setTimeout(()=>{if(activeRef.current)void loop();},220);
   };
   void loop();
  }catch(e){stopCamera();const err=e as any;const message=err?.name==="NotAllowedError"?"Camera permission was denied or blocked. Allow camera access for this website in Chrome site settings, then try again.":err?.name==="NotFoundError"?"No camera was found on this device.":err?.name==="NotReadableError"?"The camera is busy in another app. Close other camera apps and try again.":e instanceof Error?e.message:"Could not start the camera.";setError(message);}
 }
 const filtered=people.filter(p=>p.type===personType);
 return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><QrCode size={22}/></span><div><h2 className="text-lg font-extrabold">QR attendance & credential control</h2><p className="text-sm text-slate-600">Issue unique ID-card QR references and scan them at the selected station.</p></div></div><ShieldCheck className="text-emerald-800" size={22}/></div>
 {error&&<p role="alert" className="mt-3 break-words rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
 <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border p-4"><h3 className="font-bold">Issue / rotate an ID-card QR</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Person type<select className="mt-1 w-full rounded-lg border px-3 py-2.5" value={personType} onChange={e=>setPersonType(e.target.value as any)}><option value="student">Student</option><option value="staff">Teacher / staff</option></select></label><label className="text-sm font-semibold">Person<select className="mt-1 w-full rounded-lg border px-3 py-2.5" value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Select person</option>{filtered.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></div><button type="button" onClick={()=>void issueCredential()} disabled={busy||!personId} className="mt-3 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Working…":"Issue new secure credential"}</button>{payload&&<div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">Unique RESA ID-card QR reference</p><div className="mt-2 flex flex-wrap items-center gap-3"><QrCodeDisplay value={payload} size={220}/><div className="min-w-0 flex-1"><p className="text-xs leading-5 text-slate-600">This QR contains a unique database reference, not personal details. It remains stable across sessions until an administrator deliberately rotates it.</p><textarea readOnly value={payload} rows={3} className="mt-2 w-full break-all rounded-lg border bg-white p-2 font-mono text-xs"/></div></div><button type="button" onClick={()=>void navigator.clipboard.writeText(payload)} className="mt-2 inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Copy size={14}/> Copy credential</button><p className="mt-2 text-xs leading-5 text-amber-800">Do not alter or reuse this QR for another person. Attendance still requires an authorised operator and visual photo verification. Legacy RESA1 cards remain supported when their original credential is still active.</p></div>}</div>
 <div className="rounded-xl border p-4"><h3 className="font-bold">Scan attendance QR</h3><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setAction("check_in")} disabled={busy||scanning} className={`rounded-lg px-3 py-2 text-sm font-bold ${action==="check_in"?"bg-emerald-900 text-white":"border"}`}>Check in</button><button type="button" onClick={()=>setAction("check_out")} disabled={busy||scanning} className={`rounded-lg px-3 py-2 text-sm font-bold ${action==="check_out"?"bg-emerald-900 text-white":"border"}`}>Check out</button></div><video ref={videoRef} muted playsInline className={`mt-3 aspect-video w-full rounded-xl bg-slate-950 object-cover ${scanning?"block":"hidden"}`}/>{currentCaptured&&<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3" aria-live="polite"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Latest successful capture</p><p className="mt-1 text-lg font-extrabold text-emerald-950">{currentCaptured.name}</p><p className="text-xs text-emerald-800">{currentCaptured.type} · {currentCaptured.action==="check_in"?"Checked in":"Checked out"} · {currentCaptured.time}</p></div>}{captureHistory.length>0&&<div className="mt-3 rounded-xl border p-3"><label className="block text-sm font-semibold">Search captured names<input value={captureSearch} onChange={e=>setCaptureSearch(e.target.value)} placeholder="Search learner or staff name" className="mt-1 w-full rounded-lg border px-3 py-2.5"/></label><div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{captureHistory.filter(row=>row.name.toLowerCase().includes(captureSearch.trim().toLowerCase())).map(row=><div key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold">{row.name}</span><span className="shrink-0 text-xs text-slate-500">{row.action==="check_in"?"In":"Out"} · {row.time}</span></div>)}</div></div>}<div className="mt-3 flex flex-wrap gap-2">{!scanning?<button type="button" onClick={()=>void startCamera()} disabled={busy||!stationId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Camera size={16}/> Start camera scanner</button>:<button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold"><Square size={15}/> Stop scanner</button>}</div><label className="mt-3 block text-sm font-semibold">Manual credential fallback<input className="mt-1 w-full rounded-lg border px-3 py-2.5 font-mono text-xs" value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="Paste RESA-ID:… or legacy RESA1:… code"/></label><button type="button" onClick={()=>void recordPayload(manualCode).catch(e=>setError(e instanceof Error?e.message:"Invalid QR credential."))} disabled={busy||!manualCode.trim()||!stationId} className="mt-2 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50">Record verified scan</button></div></div>
 <p className="mt-3 text-xs leading-5 text-slate-500">The camera reads the credential; it does not prove who is holding the card. Staff must visually verify the passport photo. Child pickup is handled separately and requires an approved authorization or verified parent identity.</p></section>;
}
