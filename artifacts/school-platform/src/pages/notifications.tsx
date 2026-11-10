import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, BellRing, CheckCheck, MessageSquare, Megaphone, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { enableResaPushNotifications, getResaPushRegistrationStatus, sendResaPushTestNotification } from "@/lib/notifications/push";

type Notice = {
  id: string;
  kind: "message" | "announcement" | "chat";
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  sender?: string;
  channel?: string;
};

export default function NotificationsPage({ schoolId, role }: { schoolId: string; role: "admin" | "teacher" | "student" | "parent" }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [pushStatus, setPushStatus] = useState({ registered: false, supported: typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window, detail: "Checking this device…" });
  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const uid = auth.user.id;
      setUserId(uid);
      void getResaPushRegistrationStatus(schoolId)
        .then(status => setPushStatus({ registered: status.registered, supported: status.supported, detail: status.detail }))
        .catch(() => setPushStatus({ registered: false, supported: true, detail: "Could not verify this phone's registration." }));
      const [messageResult, announcementResult, chatResult] = await Promise.all([
        db.from("school_messages").select("id,sender_id,recipient_id,subject,message,is_read,sent_at,channel").eq("school_id", schoolId).eq("recipient_id", uid).order("sent_at", { ascending: false }).limit(100),
        db.from("announcements").select("id,title,content,announcement_type,is_published,published_at,created_at,expires_at").eq("school_id", schoolId).eq("is_published", true).order("published_at", { ascending: false }).limit(50),
        db.from("resa_chat_messages").select("id,conversation_id,sender_id,body,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (messageResult.error && announcementResult.error) {
        throw new Error("Messages and announcements could not be loaded. " + messageResult.error.message + " / " + announcementResult.error.message);
      }
      if (messageResult.error) setNotice("Announcements are available, but the message inbox could not be loaded: " + messageResult.error.message);
      else if (announcementResult.error) setNotice("Your messages are available, but announcements could not be loaded: " + announcementResult.error.message);
      if (chatResult.error) setNotice(previous => previous ? previous + " Group chat updates could not be loaded: " + chatResult.error.message : "Group chat updates could not be loaded: " + chatResult.error.message);
      const chatRows = chatResult.data ?? [];
      const chatIds = chatRows.map((m: any) => m.id);
      const readResult = chatIds.length ? await db.from("resa_chat_message_reads").select("message_id").eq("user_id", uid).in("message_id", chatIds) : { data: [] };
      const readIds = new Set((readResult.data ?? []).map((r: any) => r.message_id));
      const conversationIds = [...new Set(chatRows.map((m: any) => m.conversation_id).filter(Boolean))];
      const conversationResult = conversationIds.length ? await db.from("resa_chat_conversations").select("id,subject").in("id", conversationIds) : { data: [] };
      const conversationNames = new Map((conversationResult.data ?? []).map((row: any) => [row.id, row.subject]));
      const now = Date.now();
      const messages: Notice[] = (messageResult.data ?? []).map((m: any) => ({
        id: m.id, kind: "message", title: m.subject, body: m.message, createdAt: m.sent_at,
        unread: !m.is_read, sender: m.sender_id, channel: m.channel,
      }));
      const announcements: Notice[] = (announcementResult.data ?? [])
        .filter((a: any) => {
          const publishedAt = a.published_at ? new Date(a.published_at).getTime() : 0;
          const expiresAt = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
          return Number.isFinite(publishedAt) && publishedAt <= now &&
            (expiresAt === Number.POSITIVE_INFINITY || (Number.isFinite(expiresAt) && expiresAt > now));
        })
        .map((a: any) => ({
          id: a.id, kind: "announcement", title: a.title, body: a.content,
          createdAt: a.published_at || a.created_at, unread: false, sender: a.announcement_type,
        }));
      const chatNotices: Notice[] = chatRows.filter((m: any) => m.sender_id !== uid).map((m: any) => ({ id: "chat-" + m.id, kind: "chat", title: conversationNames.get(m.conversation_id) || "RESA chat", body: m.body, createdAt: m.created_at, unread: !readIds.has(m.id), sender: m.sender_id, channel: "chat" }));
      setItems([...messages, ...announcements, ...chatNotices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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
            void load();
          }
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "resa_chat_messages", filter: "school_id=eq." + schoolId }, (payload: any) => {
          if (payload.new?.sender_id !== userId) void load();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements", filter: "school_id=eq." + schoolId }, (payload: any) => {
          // The authenticated app-level listener handles the phone alert once;
          // this page only refreshes the inbox to avoid duplicate notifications.
          void load();
        }).subscribe();
    } catch { /* Refresh remains available if Realtime is not configured. */ }
    return () => { if (db && channel) void db.removeChannel(channel); };
  }, [schoolId, userId, load]);

  async function markRead(item: Notice) {
    if (!item.unread) return;
    try {
      const db = getSupabaseClient() as any;
      if (item.kind === "chat") {
        const messageId = item.id.replace(/^chat-/, "");
        const { error: updateError } = await db.from("resa_chat_message_reads").upsert({ message_id: messageId, school_id: schoolId, user_id: userId }, { onConflict: "message_id,user_id", ignoreDuplicates: true });
        if (updateError) throw updateError;
      } else if (item.kind === "message") {
        const { error: updateError } = await db.from("school_messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", item.id).eq("recipient_id", userId);
        if (updateError) throw updateError;
      } else return;
      setItems(previous => previous.map(n => n.id === item.id ? { ...n, unread: false } : n));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not mark this notification as read."); }
  }

  async function enableBrowserAlerts() {
    setError("");
    try {
      await enableResaPushNotifications(schoolId, true);
      const status = await getResaPushRegistrationStatus(schoolId);
      setPushStatus({ registered: status.registered, supported: status.supported, detail: status.detail });
      if (!status.registered) throw new Error(status.detail);
      setNotice("This phone is registered with RESA's push service. Run the delivery test below to confirm that the phone can receive a background notification.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phone notifications could not be enabled.");
    }
  }

  async function testPhoneDelivery() {
    setError("");
    setNotice("");
    setTestBusy(true);
    try {
      const result = await sendResaPushTestNotification(schoolId);
      setNotice(`RESA's push service accepted the test notification for ${result.sent} device(s). Check your phone's notification shade; delivery can take a few seconds depending on Android and network settings.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The phone notification test failed.");
    } finally {
      setTestBusy(false);
    }
  }

  const unreadCount = items.filter(item => (item.kind === "message" || item.kind === "chat") && item.unread).length;
  const filteredItems = useMemo(() => items.filter(item => {
    const itemDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.createdAt));
    const matchesDate = itemDate === selectedDate;
    const matchesUnread = filter === "all" || (item.kind !== "announcement" && item.unread);
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${item.title} ${item.body} ${item.kind} ${item.channel ?? ""}`.toLocaleLowerCase().includes(query);
    return matchesDate && matchesUnread && matchesSearch;
  }), [items, selectedDate, filter, search]);
  const back = role === "admin" ? "/dashboard" : role === "teacher" ? "/teacher-dashboard" : role === "student" ? "/student-dashboard" : "/parent-dashboard";
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <Link href={back} className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><BellRing size={25}/></span><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA School Portal</p><h1 className="text-2xl font-extrabold">Notifications</h1><p className="mt-1 text-sm text-emerald-100">{unreadCount} unread message{unreadCount===1?"":"s"} · Updates for your school account</p></div></div>
    </div></header>
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="min-w-0"><p className="font-bold">Stay up to date</p><p className="text-sm text-slate-600">Messages and published school announcements appear here.</p><p className={`mt-1 text-xs font-semibold ${pushStatus.registered ? "text-emerald-700" : "text-amber-700"}`}>{pushStatus.registered ? "✓ Phone registered for background push" : pushStatus.detail}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void enableBrowserAlerts()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><Bell size={16}/>{pushStatus.registered ? "Re-register this phone" : "Register this phone"}</button>
          <button onClick={() => void testPhoneDelivery()} disabled={!pushStatus.registered || testBusy} className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><BellRing size={16}/>{testBusy ? "Sending test…" : "Test delivery"}</button>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15} className={loading?"animate-spin":""}/>Refresh</button>
          <Link href="/school-communication" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><MessageSquare size={15}/>Open Communication Centre</Link>
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {loading && <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading your notifications…</p>}
      {!loading && !items.length && <section className="rounded-2xl border border-dashed bg-white p-10 text-center"><Bell className="mx-auto text-slate-400" size={34}/><h2 className="mt-3 font-bold">You're all caught up</h2><p className="mt-1 text-sm text-slate-500">New messages and published announcements will appear here.</p></section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="text-xs font-bold text-slate-600">Search notifications
            <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search messages, announcements or chat" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"/>
          </label>
          <label className="text-xs font-bold text-slate-600">Day / date
            <input type="date" value={selectedDate} onChange={event=>setSelectedDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
          </label>
          <button type="button" onClick={()=>setSelectedDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-emerald-900">Today</button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-2"><button type="button" onClick={()=>setFilter("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter==="all"?"bg-emerald-900 text-white":"bg-slate-100 text-slate-700"}`}>All</button><button type="button" onClick={()=>setFilter("unread")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter==="unread"?"bg-emerald-900 text-white":"bg-slate-100 text-slate-700"}`}>Unread</button></div>
          <span className="text-xs text-slate-500">{filteredItems.length} shown · {items.length} loaded</span>
        </div>
      </section>
      {!loading && filteredItems.length===0 && items.length>0 && <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-600">No notifications match this date and search. Choose another date or clear the search to find older items.</p>}
      <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">{filteredItems.map(item => <article key={item.kind + item.id} className={`rounded-xl border bg-white p-3 shadow-sm ${item.unread ? "border-emerald-400 ring-1 ring-emerald-100" : "border-slate-200"}`}>
        <div className="flex items-start gap-3"><span className={`rounded-xl p-2 ${item.kind==="message"?"bg-blue-50 text-blue-800":"bg-amber-50 text-amber-800"}`}>{item.kind==="announcement"?<Megaphone size={20}/>:<MessageSquare size={20}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.title}</h2>{item.unread&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">Unread</span>}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.kind==="announcement"?"School announcement":item.kind==="chat"?"Group chat":item.channel==="announcement"?"School notification":item.channel==="customer_care"?"Customer Care":"Private message"}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{item.body}</p><p className="mt-2 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></div>{item.unread&&<button onClick={()=>void markRead(item)} aria-label="Mark message as read" title="Mark as read" className="rounded-lg border p-2"><CheckCheck size={17}/></button>}</div>
      </article>)}</div>
      <p className="text-xs leading-5 text-slate-500">Background phone alerts use RESA Web Push. Each person must register each phone/browser separately. Delivery depends on Android notification permission, battery/background restrictions and network availability; this page verifies registration and provides a real push-service test. Email and WhatsApp delivery are not claimed as connected.</p>
    </div>
  </main>;
}
