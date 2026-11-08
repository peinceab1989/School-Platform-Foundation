import { useCallback, useEffect, useState } from "react";
import { Printer, RefreshCw, Upload, ShieldCheck, UserRound, QrCode, Copy } from "lucide-react";
import QrCodeDisplay from "@/components/qr-code-display";
import { getSupabaseClient } from "@/lib/supabase/client";

type StudentRow = { id: string; person_id: string; admission_number: string; status: string; name: string; photoPath: string | null; canPrint: boolean; cardNumber: string };
type Props = { schoolId: string; userId: string; role: "admin" | "student" };

export default function StudentIdCardsPage({ schoolId, userId, role }: Props) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoUrls, setPhotoUrls] = useState<Record<string,string>>({});
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [qrPayloads, setQrPayloads] = useState<Record<string,string>>({});
  const [zoomQrFor, setZoomQrFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      let studentQuery = db.from("students").select("id,person_id,admission_number,status").eq("school_id", schoolId);
      if (role === "student") studentQuery = studentQuery.eq("user_id", userId);
      let { data: students, error: studentError } = await studentQuery.order("admission_number");
      if (studentError) throw studentError;
      if (role === "student" && !(students ?? []).length) {
        const { data: person, error: personError } = await db.from("people").select("id").eq("school_id", schoolId).eq("user_id", userId).limit(1).maybeSingle();
        if (personError) throw personError;
        if (person?.id) {
          const linked = await db.from("students").select("id,person_id,admission_number,status").eq("school_id", schoolId).eq("person_id", person.id).order("admission_number");
          if (linked.error) throw linked.error;
          students = linked.data;
        }
      }
      const studentRows = students ?? [];
      const ids = studentRows.map((s:any) => s.id);
      const personIds = studentRows.map((s:any) => s.person_id).filter(Boolean);
      const [peopleResult, cardsResult, permissionsResult] = await Promise.all([
        personIds.length ? db.from("people").select("id,first_name,middle_name,last_name").eq("school_id",schoolId).in("id",personIds) : Promise.resolve({data:[],error:null}),
        ids.length ? db.from("student_id_cards").select("student_id,card_number,photo_url,status").eq("school_id",schoolId).in("student_id",ids) : Promise.resolve({data:[],error:null}),
        ids.length ? db.from("student_document_permissions").select("student_id,can_print").eq("school_id",schoolId).eq("document_type","id_card").in("student_id",ids) : Promise.resolve({data:[],error:null}),
      ]);
      for (const result of [peopleResult,cardsResult,permissionsResult]) if(result.error) throw result.error;
      const people = new Map((peopleResult.data??[]).map((p:any)=>[p.id,[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")]));
      const cards = new Map((cardsResult.data??[]).map((c:any)=>[c.student_id,c]));
      const grants = new Map((permissionsResult.data??[]).map((p:any)=>[p.student_id,Boolean(p.can_print)]));
      const next: StudentRow[] = studentRows.map((s:any)=>{
        const card:any=cards.get(s.id);
        return {id:s.id,person_id:s.person_id,admission_number:s.admission_number,status:s.status,name:String(people.get(s.person_id)||"Student"),photoPath:card?.photo_url??null,canPrint:grants.get(s.id)??false,cardNumber:card?.card_number??("RESA-STU-"+String(s.admission_number||s.id).replace(/[^a-zA-Z0-9]/g,"").slice(-18))};
      });
      setRows(next);
      const urls:Record<string,string>={};
      for(const row of next) if(row.photoPath){
        const {data,error}=await db.storage.from("resa-profile-photos").createSignedUrl(row.photoPath,3600);
        if(error) throw error;
        if(data?.signedUrl) urls[row.id]=data.signedUrl;
      }
      setPhotoUrls(urls);
      if(role==="student") setSelected(next[0]??null);
    } catch(e){setError(e instanceof Error?e.message:"Student ID cards could not be loaded.");}
    finally{setLoading(false);}
  },[schoolId,userId,role]);

  useEffect(()=>{void load();},[load]);

  async function uploadPhoto(row:StudentRow,file:File){
    if(!file.type.startsWith("image/")||file.size>5*1024*1024){setError("Choose a JPG, PNG or WEBP passport photo up to 5 MB.");return;}
    setBusy(row.id);setError("");setNotice("");
    try{
      const db=getSupabaseClient() as any;
      const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";
      const path=schoolId+"/"+row.id+"/passport-"+Date.now()+"."+ext;
      const uploaded=await db.storage.from("resa-profile-photos").upload(path,file,{upsert:true,contentType:file.type});
      if(uploaded.error)throw uploaded.error;
      const saved=await db.from("student_id_cards").upsert({school_id:schoolId,student_id:row.id,card_number:row.cardNumber,photo_url:path,status:"active"},{onConflict:"student_id"}).select("student_id").single();
      if(saved.error)throw saved.error;
      setNotice("Passport photo saved for "+row.name+".");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Passport photo could not be uploaded.");}
    finally{setBusy(null);}
  }

  async function issueQr(row:StudentRow){
    setBusy(row.id);setError("");setNotice("");
    try{
      const bytes=crypto.getRandomValues(new Uint8Array(16));
      const token=btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
      const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
      const db=getSupabaseClient() as any;
      const {error:e}=await db.rpc("resa_issue_attendance_qr",{p_school_id:schoolId,p_person_type:"student",p_person_id:row.id,p_token_hash:hash});
      if(e)throw e;
      const payload="RESA1:"+token;
      setQrPayloads(previous=>({...previous,[row.id]:payload}));
      setSelected(row);
      setNotice("A new secure attendance QR was issued for "+row.name+". Any previous QR for this student is revoked. Print the ID card now; the raw QR is shown only in this session.");
    }catch(e){setError(e instanceof Error?e.message:"Student QR could not be issued.");}
    finally{setBusy(null);}
  }

  async function grant(row:StudentRow,canPrint:boolean){
    setBusy(row.id);setError("");setNotice("");
    try{
      const db=getSupabaseClient() as any;
      const result=await db.from("student_document_permissions").upsert({school_id:schoolId,student_id:row.id,document_type:"id_card",can_print:canPrint,granted_by:userId,granted_at:canPrint?new Date().toISOString():null},{onConflict:"school_id,student_id,document_type"});
      if(result.error)throw result.error;
      setNotice((canPrint?"ID-card printing granted to ":"ID-card printing revoked for ")+row.name+".");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"ID-card permission could not be updated.");}
    finally{setBusy(null);}
  }

  const card=(row:StudentRow, printTarget=false)=> <section id={printTarget || selected?.id === row.id ? "resa-student-id-card" : undefined} className="resa-student-id-card relative mx-auto flex aspect-[1.586/1] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border-2 border-emerald-900 bg-white p-3 text-slate-900 shadow print:shadow-none">
    <header className="flex items-center justify-between gap-2 border-b-2 border-amber-400 pb-1.5"><img src="/media/logo/resa-logo.jpg" alt="RESA crest" className="h-8 w-8 shrink-0 rounded-full object-contain"/><div className="min-w-0 flex-1 text-center"><p className="text-[10px] font-black leading-tight tracking-wide text-emerald-950">RHEMA EXPLOITS SCIENCE ACADEMY INT’L</p><p className="text-[8px] font-bold tracking-[0.16em] text-emerald-800">OFFICIAL STUDENT IDENTIFICATION</p></div><span className="text-[8px] font-black text-amber-700">RESA</span></header>
    <div className="flex min-h-0 flex-1 items-center gap-2.5 py-2"><div className="h-[76px] w-[60px] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100">{photoUrls[row.id]?<img src={photoUrls[row.id]} alt={"Passport photograph of "+row.name} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-slate-400"><UserRound size={25}/></div>}</div><div className="min-w-0 flex-1 leading-tight"><p className="line-clamp-2 break-words text-[11px] font-black text-slate-950">{row.name}</p><p className="mt-1 text-[8px] font-extrabold uppercase tracking-wide text-emerald-800">STUDENT</p><p className="mt-1 text-[9px] font-bold text-slate-800">ADM: {row.admission_number}</p><p className="text-[8px] text-slate-700">CARD: {row.cardNumber}</p><p className="text-[8px] text-slate-700">STATUS: {row.status}</p></div>{qrPayloads[row.id]?<div className="flex shrink-0 flex-col items-center gap-0.5"><QrCodeDisplay value={qrPayloads[row.id]} size={76}/><span className="text-[7px] font-black tracking-wide text-slate-700">SCAN TO VERIFY</span></div>:<div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-md border border-dashed border-slate-300 text-center text-[8px] font-bold text-slate-500">QR NOT<br/>ISSUED</div>}</div>
    <footer className="border-t border-amber-300 pt-1 text-center text-[7px] font-semibold text-emerald-950">PASSION • SKILLS • EXCELLENT SPIRIT · If found, return to RESA</footer>
    {qrPayloads[row.id]&&<div className="mt-2 text-center print:hidden"><button type="button" onClick={()=>setZoomQrFor(row.id)} className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-900">Enlarge QR code</button></div>}
  </section>;

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-950 p-5 text-white"><div><p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · Student Services</p><h1 className="mt-1 text-2xl font-extrabold">Student ID Cards</h1><p className="mt-1 text-sm text-emerald-100">{role==="admin"?"Upload passport photographs and control student ID-card printing.":"Your school identification card."}</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-bold"><RefreshCw size={15}/>Refresh</button></header>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    {loading?<p className="rounded-xl bg-white p-6 text-sm text-slate-600">Loading student cards…</p>:role==="student"?selected?(selected.canPrint?<div className="space-y-3">{card(selected,true)}<div className="text-center print:hidden"><button disabled={!qrPayloads[selected.id]} onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 font-bold text-white disabled:opacity-40"><Printer size={16}/>Print ID card</button>{!qrPayloads[selected.id]&&<p className="mt-2 text-xs text-amber-800">Your secure QR is not available in this session. Ask the administrator to issue or reissue your card with its QR code.</p>}</div></div>:<p className="rounded-xl border bg-white p-5 text-sm text-slate-700">Your student ID card has not yet been approved for printing. Please contact the school administrator.</p>):<p className="rounded-xl bg-white p-5 text-sm">No student record is linked to this login.</p>:<div className="grid gap-4 md:grid-cols-2">{rows.map(row=><article key={row.id} className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{row.name}</h2><p className="text-xs text-slate-500">{row.admission_number}</p></div><span className={"rounded-full px-2 py-1 text-xs font-bold "+(row.canPrint?"bg-green-100 text-green-800":"bg-amber-100 text-amber-800")}>{row.canPrint?"Printing enabled":"Not granted"}</span></div>{card(row)}<label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><Upload size={15}/>{busy===row.id?"Uploading…":"Upload passport photograph"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy!==null} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadPhoto(row,file);e.currentTarget.value="";}}/></label><div className="flex flex-wrap gap-2"><button disabled={busy!==null} onClick={()=>void issueQr(row)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40"><QrCode size={15}/>{busy===row.id?"Issuing…":"Issue / rotate QR"}</button><button disabled={!qrPayloads[row.id]} onClick={()=>void navigator.clipboard.writeText(qrPayloads[row.id]||"")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40"><Copy size={15}/>Copy QR</button><button disabled={busy!==null||!row.photoPath} onClick={()=>void grant(row,!row.canPrint)} className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">{row.canPrint?"Revoke ID-card printing":"Grant ID-card printing"}</button><button disabled={!row.canPrint||!row.photoPath||!qrPayloads[row.id]} onClick={()=>{setSelected(row);setTimeout(()=>window.print(),100);}} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40"><Printer size={15}/>Print</button></div></article>)}</div>}
  </div>{zoomQrFor&&qrPayloads[zoomQrFor]&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Enlarged student QR code" onClick={()=>setZoomQrFor(null)}><div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl" onClick={event=>event.stopPropagation()}><p className="font-extrabold text-emerald-950">Student secure QR credential</p><div className="my-4 flex justify-center"><QrCodeDisplay value={qrPayloads[zoomQrFor]} size={280}/></div><p className="mb-4 text-xs text-slate-600">Keep this code private. School staff must verify the student photograph.</p><button type="button" onClick={()=>setZoomQrFor(null)} className="rounded-lg bg-emerald-900 px-5 py-2 text-sm font-bold text-white">Close</button></div></div>}<style>{'@media print { @page { size: A4; margin: 0; } body * { visibility: hidden !important; } #resa-student-id-card, #resa-student-id-card * { visibility: visible !important; } #resa-student-id-card { position: fixed !important; left: 12mm !important; top: 12mm !important; width: 85.6mm !important; height: 54mm !important; max-height: 54mm !important; overflow: hidden !important; box-sizing: border-box !important; border: 0.35mm solid #164e36 !important; border-radius: 2mm !important; } }'}</style></main>;
}
