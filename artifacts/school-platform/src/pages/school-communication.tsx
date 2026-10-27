import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, Send, MessageSquare, Users, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Contact = { user_id: string; role: string; display_name: string };
type Message = { id: string; sender_id: string; recipient_id: string; subject: string; message: string; is_read: boolean; sent_at: string };
export default function SchoolCommunicationPage({ schoolId, role }: { schoolId: string; role: "admin" | "teacher" | "student" }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      setUserId(auth.user.id);
      const { data: contactsData, error: contactsError } = await db.rpc("get_school_message_contacts", { p_school_id: schoolId });
      if (contactsError) throw contactsError;
      setContacts((contactsData ?? []).filter((m: any) => m.user_id !== auth.user.id).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        display_name: m.display_name || (String(m.role).charAt(0).toUpperCase() + String(m.role).slice(1) + " member"),
      })));
      const { data: rows, error: messagesError } = await db.from("school_messages").select("id,sender_id,recipient_id,subject,message,is_read,sent_at").eq("school_id", schoolId).or(`sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`).order("sent_at", { ascending: false }).limit(150);
      if (messagesError) throw messagesError;
      setMessages((rows ?? []) as Message[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load school messages."); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!recipient || !subject.trim() || !body.trim()) { setError("Choose a recipient and enter a subject and message."); return; }
    setSending(true);
    try {
      const db = getSupabaseClient() as any;
      const { error: sendError } = await db.from("school_messages").insert({ school_id: schoolId, sender_id: userId, recipient_id: recipient, subject: subject.trim(), message: body.trim() });
      if (sendError) throw sendError;
      setSubject(""); setBody(""); setNotice("Message sent inside the RESA portal."); setTab("sent"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent. Check school messaging permissions."); }
    finally { setSending(false); }
  }

  async function markRead(message: Message) {
    if (message.recipient_id !== userId || message.is_read) return;
    try {
      const db = getSupabaseClient() as any;
      const { error: updateError } = await db.from("school_messages").update({ is_read: true, read_at: new Date().toISOString() } as any).eq("id", message.id).eq("recipient_id", userId);
      if (updateError) throw updateError;
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update message status."); }
  }

  const visible = messages.filter(m => tab === "inbox" ? m.recipient_id === userId : m.sender_id === userId);
  const nameFor = (id: string) => id === userId ? "You" : contacts.find(c => c.user_id === id)?.display_name || "School member";
  const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600";
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <Link href={role === "admin" ? "/dashboard" : role === "teacher" ? "/teacher-dashboard" : "/student-dashboard"} className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><MessageSquare size={25}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA School Portal</p><h1 className="text-2xl font-extrabold">School Messages</h1></div></div>
      <p className="mt-2 text-sm text-emerald-100">Private messages between authorised members of your school.</p>
    </div></header>
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Your messages</h2><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div>
        <div className="mt-4 flex gap-2"><button onClick={()=>setTab("inbox")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab==="inbox"?"bg-emerald-900 text-white":"bg-slate-100"}`}>Inbox ({messages.filter(m=>m.recipient_id===userId&&!m.is_read).length} unread)</button><button onClick={()=>setTab("sent")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab==="sent"?"bg-emerald-900 text-white":"bg-slate-100"}`}>Sent</button></div>
        {loading&&<p className="py-6 text-sm text-slate-500">Loading messages…</p>}
        {!loading&&visible.length===0&&<div className="mt-4 rounded-xl border border-dashed p-8 text-center"><MessageSquare className="mx-auto text-slate-400" size={30}/><p className="mt-2 font-semibold">No messages here yet</p><p className="mt-1 text-sm text-slate-500">Messages sent to you or by you will appear here.</p></div>}
        <div className="mt-4 space-y-3">{visible.map(m=><article key={m.id} onClick={()=>void markRead(m)} className={`rounded-xl border p-4 ${!m.is_read&&m.recipient_id===userId?"border-emerald-300 bg-emerald-50/50":"border-slate-200"}`}><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold">{m.subject}</h3>{!m.is_read&&m.recipient_id===userId&&<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">Unread</span>}</div><p className="mt-1 text-xs text-slate-500">{tab==="inbox"?"From: "+nameFor(m.sender_id):"To: "+nameFor(m.recipient_id)} · {new Date(m.sent_at).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{m.message}</p></article>)}</div>
      </section>
      <section className="h-fit rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><Send size={21}/></span><div><h2 className="text-lg font-bold">Compose message</h2><p className="text-sm text-slate-500">Send securely within RESA.</p></div></div>
        <form onSubmit={e=>void send(e)} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Recipient<select className={field} value={recipient} onChange={e=>setRecipient(e.target.value)} required><option value="">Select a school member</option>{contacts.filter(c=>role==="admin"||role==="teacher"?c.role!=="parent":c.role==="teacher"||c.role==="admin").map(c=><option key={c.user_id} value={c.user_id}>{c.display_name} · {c.role}</option>)}</select></label>
          <label className="block text-sm font-semibold">Subject<input className={field} value={subject} onChange={e=>setSubject(e.target.value)} maxLength={160} required placeholder="Message subject"/></label>
          <label className="block text-sm font-semibold">Message<textarea className={field} value={body} onChange={e=>setBody(e.target.value)} rows={6} maxLength={5000} required placeholder="Write your message…"/></label>
          <p className="text-xs text-slate-500">Messages are stored in the school portal. Do not include passwords or sensitive personal data.</p>
          <button disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50"><Send size={17}/>{sending?"Sending…":"Send message"}</button>
        </form>
        {error&&<p role="alert" className="mt-4 break-words rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice&&<p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mr-1 inline" size={16}/>{notice}</p>}
        <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Users size={14} className="mr-1 inline"/> Only active members of this school are offered as recipients. Database row-level security remains responsible for enforcing access.</div>
      </section>
    </div>
  </main>;
}