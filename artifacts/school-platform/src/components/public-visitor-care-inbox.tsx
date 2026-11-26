import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { MessageCircle, RefreshCw, Send, CheckCircle2 } from "lucide-react";

type Thread = {id:string;visitor_name:string;visitor_email:string|null;duty_key:string;status:string;created_at:string;last_message_at:string};
type Message = {id:string;sender_kind:"visitor"|"admin";body:string;created_at:string};

export default function PublicVisitorCareInbox() {
  const [threads,setThreads]=useState<Thread[]>([]);
  const [activeId,setActiveId]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const loadThreads=useCallback(async()=>{
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"admin_list"}});
    if(result.error){setError(result.error.message);return;}
    setThreads((result.data?.conversations||[]) as Thread[]);
    setError("");
  },[]);
  const loadMessages=useCallback(async(id:string)=>{
    if(!id)return;
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"admin_view",conversation_id:id}});
    if(result.error){setError(result.error.message);return;}
    setMessages((result.data?.messages||[]) as Message[]);
  },[]);
  useEffect(()=>{void loadThreads().finally(()=>setLoading(false));const timer=window.setInterval(()=>void loadThreads(),15000);return()=>window.clearInterval(timer);},[loadThreads]);
  useEffect(()=>{if(!activeId){setMessages([]);return;}void loadMessages(activeId);const timer=window.setInterval(()=>void loadMessages(activeId),5000);return()=>window.clearInterval(timer);},[activeId,loadMessages]);
  async function sendReply(event:FormEvent){
    event.preventDefault();if(!draft.trim()||!activeId)return;
    setBusy(true);setError("");
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"admin_reply",conversation_id:activeId,message:draft}});
    if(result.error)setError(result.error.message);else{setDraft("");await loadMessages(activeId);await loadThreads();}
    setBusy(false);
  }
  async function closeThread(){
    if(!activeId)return;
    setBusy(true);
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"admin_close",conversation_id:activeId}});
    if(result.error)setError(result.error.message);else{setActiveId("");await loadThreads();}
    setBusy(false);
  }
  const active=threads.find(thread=>thread.id===activeId);
  return <section className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-950"><MessageCircle size={19}/> Public website enquiries</h2><p className="mt-1 text-xs text-slate-500">Visitors can contact RESA here without a portal account. Only assigned administrators and the Chief Administrator can access these conversations.</p></div><button type="button" onClick={()=>void loadThreads()} className="rounded-lg border p-2" aria-label="Refresh public enquiries"><RefreshCw size={15}/></button></div>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.5fr)]">
      <div className="max-h-[420px] space-y-2 overflow-y-auto">{loading?<p className="text-sm text-slate-500">Loading enquiries…</p>:threads.length===0?<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No open public enquiries assigned to you.</p>:threads.map(thread=><button key={thread.id} type="button" onClick={()=>setActiveId(thread.id)} className={"w-full rounded-xl border p-3 text-left "+(activeId===thread.id?"border-emerald-800 bg-emerald-50":"border-slate-200")}><span className="block font-bold text-slate-900">{thread.visitor_name}</span><span className="mt-1 block text-xs text-slate-500">{thread.duty_key} · {thread.visitor_email||"No email provided"}</span><span className="mt-1 block text-[10px] text-slate-400">{new Date(thread.last_message_at).toLocaleString()}</span></button>)}</div>
      <div className="flex min-h-[300px] flex-col rounded-xl border border-slate-200 p-3">{!active?<p className="m-auto text-sm text-slate-500">Select a visitor enquiry to read and reply.</p>:<><div className="flex items-start justify-between gap-2 border-b pb-3"><div><h3 className="font-bold">{active.visitor_name}</h3><p className="text-xs text-slate-500">{active.visitor_email||"Visitor did not provide an email"} · {active.duty_key}</p></div><button type="button" disabled={busy} onClick={()=>void closeThread()} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold"><CheckCircle2 size={14}/> Close</button></div><div className="flex max-h-[300px] flex-1 flex-col gap-2 overflow-y-auto py-3">{messages.map(message=><div key={message.id} className={"max-w-[88%] rounded-xl p-3 text-sm "+(message.sender_kind==="admin"?"self-end bg-emerald-900 text-white":"self-start bg-slate-100 text-slate-900")}><p className="mb-1 text-[10px] font-bold uppercase opacity-70">{message.sender_kind==="admin"?"RESA administrator":"Website visitor"}</p><p className="whitespace-pre-wrap break-words">{message.body}</p><time className="mt-1 block text-[10px] opacity-60">{new Date(message.created_at).toLocaleString()}</time></div>)}</div><form onSubmit={sendReply} className="flex gap-2 border-t pt-3"><input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={5000} placeholder="Reply to visitor…" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/><button type="submit" disabled={!draft.trim()||busy} className="rounded-lg bg-emerald-900 px-3 text-white disabled:opacity-50"><Send size={16}/></button></form></>}</div>
    </div>
  </section>;
}
