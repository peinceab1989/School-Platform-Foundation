import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { MessageCircle, RefreshCw, Send, CheckCircle2, RotateCcw, Inbox } from "lucide-react";

type Thread = {
  id:string; visitor_name:string; visitor_email:string|null; duty_key:string;
  status:"open"|"waiting"|"closed"; created_at:string; last_message_at:string;
  last_message_sender_kind:"visitor"|"admin"; last_admin_read_at:string|null;
};
type Message = {id:string;sender_kind:"visitor"|"admin";sender_admin_id?:string|null;body:string;created_at:string};

export default function PublicVisitorCareInbox() {
  const [threads,setThreads]=useState<Thread[]>([]);
  const [activeId,setActiveId]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [showClosed,setShowClosed]=useState(false);

  const loadThreads=useCallback(async()=>{
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{
      body:{action:"admin_list",include_closed:showClosed}
    });
    if(result.error)throw result.error;
    setThreads((result.data?.conversations||[]) as Thread[]);
    setError("");
  },[showClosed]);

  const loadMessages=useCallback(async(id:string)=>{
    if(!id)return;
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{
      body:{action:"admin_view",conversation_id:id}
    });
    if(result.error)throw result.error;
    setMessages((result.data?.messages||[]) as Message[]);
    setThreads(rows=>rows.map(row=>row.id===id?{...row,last_admin_read_at:new Date().toISOString()}:row));
  },[]);

  useEffect(()=>{
    let alive=true;
    void loadThreads().catch(e=>{if(alive)setError(e.message||"Could not load public enquiries.");}).finally(()=>{if(alive)setLoading(false);});
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void loadThreads().catch(e=>{if(alive)setError(e.message||"Refresh failed.");});},5000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[loadThreads]);

  useEffect(()=>{
    if(!activeId){setMessages([]);return;}
    let alive=true;
    const refresh=()=>void loadMessages(activeId).catch(e=>{if(alive)setError(e.message||"Could not refresh this conversation.");});
    refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")refresh();},3000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[activeId,loadMessages]);

  const active=useMemo(()=>threads.find(thread=>thread.id===activeId),[threads,activeId]);

  async function sendReply(event:FormEvent){
    event.preventDefault();
    if(!draft.trim()||!activeId||busy)return;
    setBusy(true);setError("");
    try{
      const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{
        body:{action:"admin_reply",conversation_id:activeId,message:draft}
      });
      if(result.error)throw result.error;
      setDraft("");
      await loadMessages(activeId);
      await loadThreads();
    }catch(e){setError(e instanceof Error?e.message:"The reply could not be sent.");}
    finally{setBusy(false);}
  }

  async function changeStatus(){
    if(!active||busy)return;
    setBusy(true);setError("");
    try{
      const action=active.status==="closed"?"admin_reopen":"admin_close";
      const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{
        body:{action,conversation_id:active.id}
      });
      if(result.error)throw result.error;
      await loadThreads();
      setActiveId("");
      setMessages([]);
    }catch(e){setError(e instanceof Error?e.message:"The conversation status could not be changed.");}
    finally{setBusy(false);}
  }

  const unread=threads.filter(t=>t.status!=="closed"&&t.last_message_sender_kind==="visitor"&&(!t.last_admin_read_at||new Date(t.last_message_at)>new Date(t.last_admin_read_at))).length;

  return <section className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-950"><MessageCircle size={19}/> Public website enquiries</h2>
        <p className="mt-1 text-xs text-slate-500">Visitors can contact RESA without a portal account. Conversations are restricted to the assigned administrator and Chief Administrator.</p>
      </div>
      <button type="button" onClick={()=>void loadThreads().catch(e=>setError(e.message))} className="rounded-lg border p-2" aria-label="Refresh public enquiries"><RefreshCw size={15}/></button>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={()=>{setShowClosed(false);setActiveId("");}} className={"rounded-full px-3 py-2 text-xs font-bold "+(!showClosed?"bg-emerald-900 text-white":"border text-slate-700")}>Active enquiries</button>
      <button type="button" onClick={()=>{setShowClosed(true);setActiveId("");}} className={"rounded-full px-3 py-2 text-xs font-bold "+(showClosed?"bg-emerald-900 text-white":"border text-slate-700")}>Closed history</button>
      {!showClosed&&<span className="self-center text-xs text-slate-500">{unread} awaiting your reply</span>}
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.5fr)]">
      <div className="max-h-[440px] space-y-2 overflow-y-auto">
        {loading?<p className="text-sm text-slate-500">Loading enquiries…</p>:threads.length===0?<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{showClosed?"No closed conversations are available.":"No open public enquiries assigned to you."}</p>:threads.map(thread=>{
          const needsReply=thread.status!=="closed"&&thread.last_message_sender_kind==="visitor"&&(!thread.last_admin_read_at||new Date(thread.last_message_at)>new Date(thread.last_admin_read_at));
          return <button key={thread.id} type="button" onClick={()=>setActiveId(thread.id)} className={"w-full rounded-xl border p-3 text-left "+(activeId===thread.id?"border-emerald-800 bg-emerald-50":"border-slate-200")}>
            <span className="flex items-center justify-between gap-2"><strong className="text-slate-900">{thread.visitor_name}</strong>{needsReply&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">New</span>}</span>
            <span className="mt-1 block text-xs text-slate-500">{thread.duty_key.replaceAll("_"," ")} · {thread.status}</span>
            <span className="mt-1 block text-[10px] text-slate-400">{new Date(thread.last_message_at).toLocaleString()}</span>
          </button>;
        })}
      </div>
      <div className="flex min-h-[320px] flex-col rounded-xl border border-slate-200 p-3">
        {!active?<p className="m-auto flex items-center gap-2 text-sm text-slate-500"><Inbox size={18}/>Select an enquiry to read and reply.</p>:<>
          <div className="flex items-start justify-between gap-2 border-b pb-3">
            <div><h3 className="font-bold">{active.visitor_name}</h3><p className="text-xs text-slate-500">{active.visitor_email||"Visitor did not provide an email"} · {active.duty_key}</p><p className="mt-1 text-[10px] text-slate-500">Status: {active.status}</p></div>
            <button type="button" disabled={busy} onClick={()=>void changeStatus()} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold">
              {active.status==="closed"?<RotateCcw size={14}/>:<CheckCircle2 size={14}/>}
              {active.status==="closed"?"Reopen":"Close"}
            </button>
          </div>
          <div className="flex max-h-[340px] flex-1 flex-col gap-2 overflow-y-auto py-3">
            {messages.map(message=><div key={message.id} className={"max-w-[88%] rounded-xl p-3 text-sm "+(message.sender_kind==="admin"?"self-end bg-emerald-900 text-white":"self-start bg-slate-100 text-slate-900")}>
              <p className="mb-1 text-[10px] font-bold uppercase opacity-70">{message.sender_kind==="admin"?"RESA administrator":"Website visitor"}</p>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <time className="mt-1 block text-[10px] opacity-60">{new Date(message.created_at).toLocaleString()}</time>
            </div>)}
          </div>
          {active.status==="closed"?<p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">This conversation is closed. Reopen it before sending another reply.</p>:<form onSubmit={sendReply} className="flex gap-2 border-t pt-3">
            <input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={5000} placeholder="Reply to visitor…" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
            <button type="submit" disabled={!draft.trim()||busy} className="rounded-lg bg-emerald-900 px-3 text-white disabled:opacity-50"><Send size={16}/></button>
          </form>}
        </>}
      </div>
    </div>
  </section>;
}
