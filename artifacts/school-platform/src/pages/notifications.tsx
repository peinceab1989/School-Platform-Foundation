import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, BellRing, CheckCheck, MessageSquare, Megaphone, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Notice = {
  id: string;
  kind: "message" | "announcement";
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  sender?: string;
};

export default function NotificationsPage({ schoolId, role }: { schoolId: string; role: "admin" | "teacher" | "student" | "parent" }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pushEnabled, setPushEnabled] = useState(typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const uid = auth.user.id;
      setUserId(uid);
      const [messageResult, announcementResult] = await Promise.all([
        db.from("school_messages").select("id,sender_id,recipient_id,subject,message,is_read,sent_at").eq("school_id", schoolId).eq("recipient_id", uid).order("sent_at", { ascending: false }).limit(100),
        db.from("announcements").select("id,title,content,announcement_type,is_published,published_at,created_at,expires_at").eq("school_id", schoolId).eq("is_published", true).order("published_at", { ascending: false }).limit(50),
      ]);
      if (messageResult.error && announcementResult.error) {
        throw new Error("Messages and announcements could not be loaded. " + messageResult.error.message + " / " + announcementResult.error.message);
      }
      if (messageResult.error) setNotice("Announcements are available, but the message inbox could not be loaded: " + messageResult.error.message);
      else if (announcementResult.error) setNotice("Your messages are available, but announcements could not be loaded: " + announcementResult.error.message);
      const now = Date.now();
      const messages: Notice[] = (messageResult.data ?? []).map((m: any) => ({
        id: m.id, kind: "message", title: m.subject, body: m.message, createdAt: m.sent_at,
        unread: !m.is_read, sender: m.sender_id,
      }));
      const announcements: Notice[] = (announcementResult.data ?? [])
        .filter((a: any) => !a.expires_at || new Date(a.expires_at).getTime() >= now)
        .map((a: any) => ({
          id: a.id, kind: "announcement", title: a.title, body: a.content,
          createdAt: a.published_at || a.created_at, unread: false, sender: a.announcement_type,
        }));
      setItems([...messages, ...announcements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) { setError(e instanceof Error ? e.message : "Notifications could not be loaded."); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let db: any;
    let channel: any;
    try {
      db = getSupabaseClient();
      channel = db.channel("resa-notifications-" + schoolId)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "school_messages", filter: "school_id=eq." + schoolId }, (payload: any) => {
          if (payload.new?.recipient_id === userId) {
            const title = payload.new.subject || "New school message";
            if ("Notification" in window && Notification.permission === "granted") new Notification("RESA: " + title, { body: payload.new.message || "You received a new message." });
            void load();
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements", filter: "school_id=eq." + schoolId }, (payload: any) => {
          if (payload.new?.is_published) {
            if ("Notification" in window && Notification.permission === "granted") new Notification("RESA announcement: " + payload.new.title, { body: payload.new.content || "A new school announcement is available." });
            void load();
          }
        }).subscribe();
    } catch { /* Refresh remains available if Realtime is not configured. */ }
    return () => { if (db && channel) void db.removeChannel(channel); };
  }, [schoolId, userId, load]);

  async function markRead(item: Notice) {
    if (item.kind !== "message" || !item.unread) return;
    try {
      const db = getSupabaseClient() as any;
      const { error: updateError } = await db.from("school_messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", item.id).eq("recipient_id", userId);
      if (updateError) throw updateError;
      setItems(previous => previous.map(n => n.id === item.id ? { ...n, unread: false } : n));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not mark this notification as read."); }
  }

  async function enableBrowserAlerts() {
    if (!("Notification" in window)) { setError("This browser does not support browser notifications. You can still use the in-app notification centre."); return; }
    const permission = await Notification.requestPermission();
    setPushEnabled(permission === "granted");
    setNotice(permission === "granted" ? "Browser notifications enabled on this device while RESA is open." : "Browser notifications were not enabled. In-app notifications remain available.");
  }

  const unreadCount = items.filter(item => item.kind === "message" && item.unread).length;
  const back = role === "admin" ? "/dashboard" : role === "teacher" ? "/teacher-dashboard" : role === "student" ? "/student-dashboard" : "/school-cctv";
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <Link href={back} className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><BellRing size={25}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA School Portal</p><h1 className="text-2xl font-extrabold">Notifications</h1><p className="mt-1 text-sm text-emerald-100">{unreadCount} unread message{unreadCount===1?"":"s"} · Updates for your school account</p></div></div>
    </div></header>
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div><p className="font-bold">Stay up to date</p><p className="text-sm text-slate-600">Messages and published school announcements appear here.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void enableBrowserAlerts()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><Bell size={16}/>{pushEnabled ? "Browser alerts enabled" : "Enable browser alerts"}</button>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading?"animate-spin":""}/>Refresh</button>
          <Link href="/school-communication" className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-semibold text-white"><MessageSquare size={15}/>Open messages</Link>
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {loading && <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading your notifications…</p>}
      {!loading && !items.length && <section className="rounded-2xl border border-dashed bg-white p-10 text-center"><Bell className="mx-auto text-slate-400" size={34}/><h2 className="mt-3 font-bold">You're all caught up</h2><p className="mt-1 text-sm text-slate-500">New messages and published announcements will appear here.</p></section>}
      <div className="space-y-3">{items.map(item => <article key={item.kind + item.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${item.unread ? "border-emerald-400 ring-1 ring-emerald-100" : "border-slate-200"}`}>
        <div className="flex items-start gap-3"><span className={`rounded-xl p-2 ${item.kind==="message"?"bg-blue-50 text-blue-800":"bg-amber-50 text-amber-800"}`}>{item.kind==="message"?<MessageSquare size={20}/>:<Megaphone size={20}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.title}</h2>{item.unread&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">Unread</span>}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.kind==="message"?"Private message":"Announcement"}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.body}</p><p className="mt-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></div>{item.unread&&<button onClick={()=>void markRead(item)} aria-label="Mark message as read" title="Mark as read" className="rounded-lg border p-2"><CheckCheck size={17}/></button>}</div>
      </article>)}</div>
      <p className="text-xs leading-5 text-slate-500">Browser alerts require your permission and work while the portal is open. Reliable background push, email, and WhatsApp delivery require a configured notification service; this page does not claim those external channels are connected.</p>
    </div>
  </main>;
}
