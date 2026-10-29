import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ArrowLeft, MessageCircle, Send, RefreshCw, ShieldCheck, Users, LockKeyhole } from "lucide-react";

type Role = "admin" | "teacher" | "student";
type Contact = { user_id: string; role: string; display_name: string };
type Conversation = { id: string; participant_one: string; participant_two: string; subject: string; last_message_at: string; school_id: string };
type ChatMessage = { id: string; sender_id: string; body: string; created_at: string };
const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";

export default function ResaChatPage({ schoolId, userId, role }: { schoolId: string; userId: string; role: Role }) {
  const db = getSupabaseClient();
  const [enabled, setEnabled] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [subject, setSubject] = useState("Chat");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const settings = await (db as any).from("resa_chat_settings").select("chat_enabled").eq("school_id", schoolId).maybeSingle();
    if (settings.error) setError(settings.error.message);
    setEnabled(Boolean(settings.data?.chat_enabled));
    const conv = await (db as any).from("resa_chat_conversations").select("id,participant_one,participant_two,subject,last_message_at,school_id").eq("school_id", schoolId).order("last_message_at", { ascending: false });
    if (conv.error) setError(conv.error.message);
    const convRows = (conv.data ?? []) as Conversation[];
    setConversations(convRows);
    if (activeId && !convRows.some(c => c.id === activeId)) setActiveId("");
    const memberRole = role === "teacher" ? "student" : "teacher";
    let contactIds: string[] = [];
    if (isAdmin) {
      const members = await (db as any).from("school_memberships").select("user_id,role").eq("school_id", schoolId).eq("status", "active").in("role", ["teacher","student"]);
      contactIds = (members.data ?? []).map((m: any) => m.user_id).filter((id: string) => id !== userId);
    } else if (role === "teacher") {
      const staffRes = await (db as any).from("staff").select("id").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active");
      const staffIds = (staffRes.data ?? []).map((x: any) => x.id);
      if (staffIds.length) {
        const assignment = await (db as any).from("teacher_assignments").select("class_id").eq("school_id", schoolId).in("staff_id", staffIds);
        const classIds: string[] = [...new Set<string>((assignment.data ?? []).map((x: any) => String(x.class_id)).filter(Boolean))];
        if (classIds.length) {
          const enrollment = await (db as any).from("student_enrollments").select("student_id").eq("school_id", schoolId).eq("status", "active").in("class_id", classIds);
          const studentIds = [...new Set((enrollment.data ?? []).map((x: any) => x.student_id).filter(Boolean))];
          if (studentIds.length) {
            const students = await (db as any).from("students").select("user_id").eq("school_id", schoolId).in("id", studentIds);
            contactIds = [...new Set((students.data ?? []).map((x: any) => x.user_id).filter((id: string) => id && id !== userId))];
          }
        }
      }
    } else {
      const studentRes = await (db as any).from("students").select("id").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
      if (studentRes.data?.id) {
        const enrollments = await (db as any).from("student_enrollments").select("class_id").eq("school_id", schoolId).eq("student_id", studentRes.data.id).eq("status", "active");
        const classIds: string[] = [...new Set<string>((enrollments.data ?? []).map((x: any) => String(x.class_id)).filter(Boolean))];
        if (classIds.length) {
          const assignment = await (db as any).from("teacher_assignments").select("staff_id").eq("school_id", schoolId).in("class_id", classIds);
          const staffIds = [...new Set((assignment.data ?? []).map((x: any) => x.staff_id).filter(Boolean))];
          if (staffIds.length) {
            const staff = await (db as any).from("staff").select("user_id").eq("school_id", schoolId).eq("status", "active").in("id", staffIds);
            contactIds = [...new Set((staff.data ?? []).map((x: any) => x.user_id).filter((id: string) => id && id !== userId))];
          }
        }
      }
    }
    if (!isAdmin) {
      const admins = await (db as any).from("school_memberships").select("user_id").eq("school_id", schoolId).eq("status", "active").eq("role", "admin");
      contactIds = [...new Set<string>([...contactIds, ...(admins.data ?? []).map((x: any) => String(x.user_id)).filter((id: string) => id !== userId)])];
    }
    if (contactIds.length) {
      const members = await (db as any).from("school_memberships").select("user_id,role").eq("school_id", schoolId).eq("status", "active").in("user_id", contactIds);
      const ids = (members.data ?? []).map((x: any) => x.user_id);
      const profiles = ids.length ? await (db as any).from("profiles").select("id,display_name").in("id", ids) : { data: [] };
      const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p.display_name]));
      setContacts((members.data ?? []).map((m: any) => ({ user_id: m.user_id, role: m.role, display_name: profileMap.get(m.user_id) || (m.role === "teacher" ? "Teacher" : m.role === "student" ? "Student" : "School administrator") })));
    } else setContacts([]);
    setLoading(false);
  }, [db, schoolId, userId, role, isAdmin, activeId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    const fetchMessages = async () => {
      const result = await (db as any).from("resa_chat_messages").select("id,sender_id,body,created_at").eq("conversation_id", activeId).order("created_at", { ascending: true }).limit(500);
      if (!cancelled) {
        if (result.error) setError(result.error.message);
        else setMessages((result.data ?? []) as ChatMessage[]);
      }
    };
    void fetchMessages();
    const channel = db.channel("resa-chat-" + activeId).on("postgres_changes", { event: "*", schema: "public", table: "resa_chat_messages", filter: "conversation_id=eq." + activeId }, () => { void fetchMessages(); }).subscribe();
    return () => { cancelled = true; void db.removeChannel(channel); };
  }, [db, activeId]);

  const activeConversation = useMemo(() => conversations.find(c => c.id === activeId), [conversations, activeId]);
  const otherId = activeConversation ? (activeConversation.participant_one === userId ? activeConversation.participant_two : activeConversation.participant_one) : "";
  const otherContact = contacts.find(c => c.user_id === otherId);
  const sortedContacts = useMemo(() => [...contacts].sort((a,b)=>a.display_name.localeCompare(b.display_name)), [contacts]);

  async function toggleChat() {
    setError(""); setNotice("");
    const next = !enabled;
    const result = await (db as any).from("resa_chat_settings").upsert({ school_id: schoolId, chat_enabled: next, updated_by: userId, updated_at: new Date().toISOString() });
    if (result.error) setError(result.error.message);
    else { setEnabled(next); setNotice(next ? "Dashboard chat is now enabled." : "Dashboard chat is deactivated. Existing messages remain saved and readable by permitted participants."); }
  }

  async function startConversation(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    if (!enabled) { setError("Chat has been deactivated by the administrator."); return; }
    if (!selectedContact) { setError("Choose a teacher or student first."); return; }
    const existing = conversations.find(c => [c.participant_one,c.participant_two].includes(userId) && [c.participant_one,c.participant_two].includes(selectedContact));
    if (existing) { setActiveId(existing.id); return; }
    const target = contacts.find(c => c.user_id === selectedContact);
    const result = await (db as any).from("resa_chat_conversations").insert({
      school_id: schoolId, created_by: userId, participant_one: userId, participant_two: selectedContact,
      conversation_type: isAdmin ? "admin_support" : "direct", subject: subject.trim() || (target ? "Chat with " + target.display_name : "Chat")
    }).select("id").single();
    if (result.error) setError(result.error.message);
    else { setActiveId(result.data.id); setNotice("Conversation opened."); await load(); }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault(); if (!draft.trim() || !activeConversation) return;
    if (!enabled) { setError("Chat has been deactivated by the administrator."); return; }
    setSending(true); setError("");
    const result = await (db as any).from("resa_chat_messages").insert({ conversation_id: activeConversation.id, school_id: schoolId, sender_id: userId, body: draft.trim() });
    if (result.error) setError(result.error.message);
    else {
      setDraft("");
      await (db as any).from("resa_chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeConversation.id);
      const fresh = await (db as any).from("resa_chat_messages").select("id,sender_id,body,created_at").eq("conversation_id", activeConversation.id).order("created_at", { ascending: true }).limit(500);
      if (!fresh.error) setMessages((fresh.data ?? []) as ChatMessage[]);
      await load();
    }
    setSending(false);
  }

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <Link href={role === "student" ? "/student-dashboard" : role === "teacher" ? "/teacher-dashboard" : "/dashboard"} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to dashboard</Link>
    <header className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA communication</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">School Chat</h1><p className="mt-2 text-sm leading-6 text-emerald-50">Direct dashboard messaging between students and their assigned teachers, with administrator oversight and a school-wide activation switch.</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className={"rounded-full px-3 py-1 text-xs font-bold "+(enabled?"bg-emerald-100 text-emerald-950":"bg-amber-100 text-amber-950")}>{enabled?"Chat enabled":"Chat deactivated"}</span>{isAdmin&&<button onClick={()=>void toggleChat()} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950">{enabled?"Deactivate chat":"Activate chat"}</button>}</div></header>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {!enabled&&<div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><LockKeyhole size={20}/><div><strong>Messaging is currently disabled.</strong><p className="mt-1">An administrator must activate chat before anyone can start or send messages. Existing messages are preserved.</p></div></div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className={panel}><div className="flex items-center gap-2"><Users size={19}/><h2 className="font-extrabold">Start a conversation</h2></div><form onSubmit={e=>void startConversation(e)} className="mt-4 space-y-3"><label className="block text-sm font-semibold">Contact<select className={field+" mt-1"} value={selectedContact} onChange={e=>setSelectedContact(e.target.value)}><option value="">Choose contact…</option>{sortedContacts.map(c=><option key={c.user_id} value={c.user_id}>{c.display_name} · {c.role}</option>)}</select></label><label className="block text-sm font-semibold">Subject<input className={field+" mt-1"} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Mathematics homework"/></label><button disabled={!enabled||!selectedContact} className="w-full rounded-lg bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Open chat</button></form><div className="mt-6 flex items-center justify-between gap-2"><h2 className="font-extrabold">Recent chats</h2><button onClick={()=>void load()} className="rounded-lg border p-2" aria-label="Refresh chats"><RefreshCw size={15}/></button></div>{loading?<p className="py-4 text-sm text-slate-500">Loading…</p>:conversations.length===0?<p className="py-4 text-sm text-slate-500">No conversations yet.</p>:<div className="mt-2 space-y-2">{conversations.map(c=><button key={c.id} onClick={()=>setActiveId(c.id)} className={"w-full rounded-xl border p-3 text-left "+(activeId===c.id?"border-emerald-800 bg-emerald-50":"border-slate-200 bg-white")}><span className="block font-bold">{c.subject}</span><span className="mt-1 block text-xs text-slate-500">{new Date(c.last_message_at).toLocaleString()}</span></button>)}</div>}</section>
      <section className={panel+" min-h-[460px]"}><div className="flex items-center gap-3 border-b border-slate-200 pb-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><MessageCircle size={22}/></span><div><h2 className="font-extrabold">{activeConversation?.subject ?? "Your messages"}</h2><p className="text-xs text-slate-500">{activeConversation?(otherContact?.display_name??"Conversation participant"):"Choose a conversation or start a new one"}</p></div></div>
        <div className="flex max-h-[480px] min-h-[300px] flex-col gap-3 overflow-y-auto py-4">{!activeConversation?<div className="m-auto max-w-sm text-center text-sm text-slate-500"><ShieldCheck size={28} className="mx-auto mb-2 text-emerald-800"/><p>Messages are private to conversation participants and authorised school administrators.</p></div>:messages.length===0?<p className="m-auto text-sm text-slate-500">No messages yet. Say hello.</p>:messages.map(m=><div key={m.id} className={"max-w-[88%] rounded-2xl px-4 py-3 "+(m.sender_id===userId?"self-end bg-emerald-900 text-white":"self-start bg-slate-100 text-slate-900")}><p className="whitespace-pre-wrap break-words text-sm leading-6">{m.body}</p><time className={"mt-1 block text-[10px] "+(m.sender_id===userId?"text-emerald-100":"text-slate-500")}>{new Date(m.created_at).toLocaleString()}</time></div>)}</div>
        <form onSubmit={e=>void sendMessage(e)} className="flex items-end gap-2 border-t border-slate-200 pt-3"><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={5000} rows={2} placeholder={enabled?"Write a message…":"Chat is disabled by the administrator"} disabled={!enabled||!activeConversation} className={field+" min-h-[48px] resize-y"}/><button disabled={!enabled||!activeConversation||!draft.trim()||sending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Send size={16}/>{sending?"Sending":"Send"}</button></form>
      </section>
    </div>
    <p className="mt-4 text-center text-xs leading-5 text-slate-500">Use RESA chat for school-related communication. Do not share passwords or sensitive personal information.</p>
  </div></main>;
}
