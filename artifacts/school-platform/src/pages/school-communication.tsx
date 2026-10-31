import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, Send, MessageSquare, Users, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Contact = { user_id: string; role: string; display_name: string };
type Message = { id: string; sender_id: string; recipient_id: string; subject: string; message: string; is_read: boolean; sent_at: string; channel?: "private" | "customer_care"; conversation_id?: string | null };
export default function SchoolCommunicationPage({ schoolId, role }: { schoolId: string; role: "admin" | "teacher" | "student" | "parent" }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [composeChannel, setComposeChannel] = useState<"private" | "customer_care">("private");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [allowAllStudents, setAllowAllStudents] = useState(false);
  const [allowedStudentIds, setAllowedStudentIds] = useState<string[]>([]);
  const [accessSaving, setAccessSaving] = useState(false);
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
      // Load the inbox independently of the recipient directory. If the contacts
      // RPC is unavailable, users must still be able to read existing messages.
      const [contactsResult, messagesResult] = await Promise.all([
        db.rpc("get_school_message_contacts", { p_school_id: schoolId }),
        db.from("school_messages").select("id,sender_id,recipient_id,subject,message,is_read,sent_at,channel,conversation_id")
          .eq("school_id", schoolId)
          .or(`sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`)
          .order("sent_at", { ascending: false }).limit(150),
      ]);
      if (contactsResult.error) {
        setContacts([]);
        setNotice("Your message inbox loaded, but the recipient directory is unavailable. An administrator should check the school messaging contacts permission.");
      } else {
        setContacts((contactsResult.data ?? []).filter((m: any) => m.user_id !== auth.user.id).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          display_name: m.display_name || (String(m.role).charAt(0).toUpperCase() + String(m.role).slice(1) + " member"),
        })));
      }
      if (messagesResult.error) throw messagesResult.error;
      setMessages((messagesResult.data ?? []) as Message[]);
      if (role === "admin") {
        const { data: access, error: accessError } = await db.from("school_messaging_access")
          .select("allow_all_students,allowed_student_ids").eq("school_id", schoolId).maybeSingle();
        if (accessError) throw accessError;
        setAllowAllStudents(Boolean(access?.allow_all_students));
        setAllowedStudentIds((access?.allowed_student_ids ?? []) as string[]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load school messages."); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!recipient || !subject.trim() || !body.trim()) { setError("Choose a recipient and enter a subject and message."); return; }
    if (composeChannel === "customer_care" && role !== "admin" && !contacts.some(c => c.user_id === recipient && c.role === "admin")) { setError("Customer Care messages must go to an authorised school administrator."); return; }
    setSending(true);
    try {
      const db = getSupabaseClient() as any;
      const { error: sendError } = await db.from("school_messages").insert({
        school_id: schoolId, sender_id: userId, recipient_id: recipient,
        subject: subject.trim(), message: body.trim(),
        channel: composeChannel,
        conversation_id: conversationId || crypto.randomUUID(),
      });
      if (sendError) throw sendError;
      setSubject(""); setBody(""); setConversationId(null); setNotice(composeChannel === "customer_care" ? "Customer Care message sent. Replies will stay linked to this conversation." : "Message sent inside the RESA portal."); setTab("sent"); await load();
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


  async function saveStudentMessagingAccess() {
    if (role !== "admin") return;
    setAccessSaving(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await db.from("school_messaging_access").upsert({
        school_id: schoolId,
        allow_all_students: allowAllStudents,
        allowed_student_ids: allowAllStudents ? [] : allowedStudentIds,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id" });
      if (saveError) throw saveError;
      setNotice(allowAllStudents ? "Private messaging is enabled for all active students." : allowedStudentIds.length ? "Private messaging access saved for selected students." : "Student private messaging is disabled until you select students or enable all.");
    } catch (e) { setError(e instanceof Error ? e.message : "Messaging access settings could not be saved."); }
    finally { setAccessSaving(false); }
  }

  function replyToCustomerCare(message: Message) {
    setComposeChannel(message.channel === "customer_care" ? "customer_care" : "private");
    setRecipient(message.sender_id);
    setSubject(message.subject);
    setConversationId(message.conversation_id || message.id);
    setTab("inbox");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  const visible = messages.filter(m => tab === "inbox" ? m.recipient_id === userId : m.sender_id === userId);
  const nameFor = (id: string) => id === userId ? "You" : contacts.find(c => c.user_id === id)?.display_name || "School member";
  const field = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600";
  return <main className={`${role === "student" ? "resa-student-portal" : role === "parent" ? "resa-parent-portal" : role === "teacher" ? "resa-teacher-portal" : "resa-page-content"} min-h-screen bg-slate-50 text-slate-900`}>
    <header className={`${role === "student" ? "resa-student-hero" : role === "parent" ? "resa-parent-hero" : ""} bg-emerald-950 text-white`}><div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <Link href={role === "admin" ? "/dashboard" : role === "teacher" ? "/teacher-dashboard" : role === "parent" ? "/school-cctv" : "/student-dashboard"} className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><MessageSquare size={25}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA School Portal</p><h1 className="text-2xl font-extrabold">School Messages</h1></div></div>
      <p className="mt-2 text-sm text-emerald-100">Private school messages and Customer Care conversations in one secure inbox.</p>
      <Link href="/notifications" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white">Open notifications</Link>
    </div></header>
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Your messages</h2><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button></div>
        <div className="mt-4 flex gap-2"><button onClick={()=>setTab("inbox")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab==="inbox"?"bg-emerald-900 text-white":"bg-slate-100"}`}>Inbox ({messages.filter(m=>m.recipient_id===userId&&!m.is_read).length} unread)</button><button onClick={()=>setTab("sent")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab==="sent"?"bg-emerald-900 text-white":"bg-slate-100"}`}>Sent</button></div>
        {loading&&<p className="py-6 text-sm text-slate-500">Loading messages…</p>}
        {!loading&&visible.length===0&&<div className="mt-4 rounded-xl border border-dashed p-8 text-center"><MessageSquare className="mx-auto text-slate-400" size={30}/><p className="mt-2 font-semibold">No messages here yet</p><p className="mt-1 text-sm text-slate-500">Messages sent to you or by you will appear here.</p></div>}
        <div className="mt-4 space-y-3">{visible.map(m=><article key={m.id} onClick={()=>void markRead(m)} className={`rounded-xl border p-4 ${!m.is_read&&m.recipient_id===userId?"border-emerald-300 bg-emerald-50/50":"border-slate-200"}`}><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold">{m.subject}</h3><div className="flex gap-2">{m.channel==="customer_care"&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">Customer Care</span>}{!m.is_read&&m.recipient_id===userId&&<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">Unread</span>}</div></div><p className="mt-1 text-xs text-slate-500">{tab==="inbox"?"From: "+nameFor(m.sender_id):"To: "+nameFor(m.recipient_id)} · {new Date(m.sent_at).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{m.message}</p>{m.channel==="customer_care"&&m.recipient_id===userId&&<button type="button" onClick={e=>{e.stopPropagation();replyToCustomerCare(m)}} className="mt-3 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white">Reply in this conversation</button>}</article>)}</div>
      </section>
      {role === "admin" && <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-bold">Student messaging access</h2><p className="mt-1 text-sm text-slate-600">Choose which active students can use private school messages. This setting is also enforced by the database.</p><label className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold"><input type="checkbox" checked={allowAllStudents} onChange={e=>setAllowAllStudents(e.target.checked)} /> Enable private messaging for all active students</label>{!allowAllStudents && <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">{contacts.filter(c=>c.role==="student").map(s=><label key={s.user_id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowedStudentIds.includes(s.user_id)} onChange={e=>setAllowedStudentIds(old=>e.target.checked?[...old,s.user_id]:old.filter(id=>id!==s.user_id))}/>{s.display_name} · student</label>)}{!contacts.some(c=>c.role==="student")&&<p className="text-sm text-slate-500">No active student accounts were returned by the school directory.</p>}</div>}<button type="button" onClick={()=>void saveStudentMessagingAccess()} disabled={accessSaving} className="mt-3 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{accessSaving?"Saving…":"Save student access"}</button></section>}
      <section className="h-fit rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><Send size={21}/></span><div><h2 className="text-lg font-bold">Compose message</h2><p className="text-sm text-slate-500">Send securely within RESA.</p></div></div>
        <form onSubmit={e=>void send(e)} className="mt-5 space-y-4">
          <fieldset className="space-y-2"><legend className="text-sm font-semibold">Message type</legend><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={composeChannel==="private"} onClick={()=>{setComposeChannel("private");setConversationId(null);setRecipient("");}} className={`rounded-lg border px-3 py-2.5 text-sm font-bold ${composeChannel==="private"?"border-emerald-900 bg-emerald-900 text-white":"border-slate-300 bg-white text-slate-700"}`}>Private message</button><button type="button" aria-pressed={composeChannel==="customer_care"} onClick={()=>{setComposeChannel("customer_care");setConversationId(null);setRecipient("");}} className={`rounded-lg border px-3 py-2.5 text-sm font-bold ${composeChannel==="customer_care"?"border-amber-700 bg-amber-100 text-amber-950":"border-slate-300 bg-white text-slate-700"}`}>Customer Care</button></div><p className="text-xs text-slate-500">{composeChannel==="customer_care"?"Contact the school administration or reply to an existing support conversation.":"Send a private message to an authorised school member."}</p></fieldset>
          <label className="block text-sm font-semibold">Recipient<select className={field} value={recipient} onChange={e=>setRecipient(e.target.value)} required><option value="">{composeChannel==="customer_care"?"Select school Customer Care administrator":"Select a school member"}</option>{contacts.filter(c=>composeChannel==="customer_care" ? (role==="admin" || c.role==="admin" || (conversationId !== null && c.user_id===recipient)) : role==="admin"||role==="teacher" ? c.role!=="parent" : c.role==="teacher"||c.role==="admin").map(c=><option key={c.user_id} value={c.user_id}>{c.display_name} · {c.role}</option>)}</select></label>
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