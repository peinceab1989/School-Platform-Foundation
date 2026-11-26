import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, BellRing, CheckCheck, MessageSquare, Megaphone, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { enableResaPushNotifications, getResaPushRegistrationStatus, sendResaPushTestNotification } from "@/lib/notifications/push";

type Notice = {
  id: string;
  kind: "message" | "announcement" | "chat" | "attendance";
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  sender?: string;
  senderName?: string;
  channel?: string;
  targetUrl?: string;
  category: string;
  source?: "biometric_parent_notifications" | "attendance_checkpoint_alerts";
  sourceId?: string;
};

export default function NotificationsPage({ schoolId, role }: { schoolId: string; role: "admin" | "teacher" | "student" | "parent" }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pushStatus, setPushStatus] = useState({ registered: false, supported: typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window, detail: "Checking this device…" });
  const [testBusy, setTestBusy] = useState(false);
  const notificationCategories = [
    ["messages", "Private messages"], ["group_messages", "Group messages"], ["announcements", "School announcements"],
    ["attendance", "Attendance updates"], ["academics", "Academics and assignments"], ["results", "Results"],
    ["fees", "Fees and payments"], ["admissions", "Admissions"], ["cbt", "CBT and examinations"],
    ["school_activities", "School activities and events"], ["system_alerts", "System and security alerts"],
  ] as const;
  const soundOptions = [
    ["resa_chime", "RESA Signature Chime"], ["classic_bell", "Classic Bell"], ["digital_ping", "Digital Ping"],
    ["soft_tone", "Soft Tone"], ["gentle_melody", "Gentle Melody"], ["crystal_drop", "Crystal Drop"],
    ["double_beep", "Double Beep"], ["alert_tone", "Alert Tone"], ["message_pop", "Message Pop"],
    ["school_bell", "School Bell"], ["vibrant_ring", "Vibrant Ring"], ["silent", "Silent"],
  ] as const;
  const [preferences, setPreferences] = useState({
    enabled: true, phone_notifications_enabled: false, vibration_enabled: true,
    show_notification_preview: true, in_app_sound_enabled: true, quiet_hours_enabled: false,
    quiet_hours_start: "21:00", quiet_hours_end: "07:00",
    category_preferences: Object.fromEntries(notificationCategories.map(([key]) => [key, true])) as Record<string, boolean>,
    category_sounds: Object.fromEntries(notificationCategories.map(([key]) => [key, "resa_chime"])) as Record<string, string>,
  });
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [preferencesNotice, setPreferencesNotice] = useState("");


  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const uid = auth.user.id;
      setUserId(uid);
      setPreferencesLoading(true);
      const preferenceResult = await db.from("resa_notification_preferences")
        .select("enabled,phone_notifications_enabled,vibration_enabled,show_notification_preview,in_app_sound_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,category_preferences,category_sounds")
        .eq("school_id", schoolId).eq("user_id", uid).maybeSingle();
      if (preferenceResult.error) throw preferenceResult.error;
      if (preferenceResult.data) {
        const saved = preferenceResult.data;
        setPreferences(current => ({
          ...current, ...saved,
          quiet_hours_start: String(saved.quiet_hours_start || "21:00").slice(0, 5),
          quiet_hours_end: String(saved.quiet_hours_end || "07:00").slice(0, 5),
          category_preferences: { ...current.category_preferences, ...(saved.category_preferences || {}) },
          category_sounds: { ...current.category_sounds, ...(saved.category_sounds || {}) },
        }));
      }
      setPreferencesLoading(false);
      void getResaPushRegistrationStatus(schoolId)
        .then(status => setPushStatus({ registered: status.registered, supported: status.supported, detail: status.detail }))
        .catch(() => setPushStatus({ registered: false, supported: true, detail: "Could not verify this phone's registration." }));
      const [messageResult, announcementResult, chatResult, directUnreadResult, chatUnreadResult] = await Promise.all([
        db.from("school_messages").select("id,sender_id,recipient_id,subject,message,is_read,sent_at,channel").eq("school_id", schoolId).eq("recipient_id", uid).order("sent_at", { ascending: false }).limit(100),
        db.from("announcements").select("id,title,content,announcement_type,is_published,published_at,created_at,expires_at").eq("school_id", schoolId).eq("is_published", true).order("published_at", { ascending: false }).limit(50),
        db.from("resa_chat_messages").select("id,conversation_id,sender_id,body,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
        db.from("school_messages").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("recipient_id", uid).eq("is_read", false),
        db.rpc("resa_get_unread_chat_count", { p_school_id: schoolId }),
      ]);
      const attendanceResult = role === "parent"
        ? await db.from("biometric_parent_notifications").select("id,notification_type,message,status,sent_at,created_at,read_at,student_id").eq("school_id", schoolId).order("created_at", {ascending:false}).limit(100)
        : role === "admin"
          ? await db.from("attendance_checkpoint_alerts").select("id,attendance_date,person_type,alert_status,first_detected_at,reminder_count,student_id,staff_id").eq("school_id", schoolId).neq("alert_status","acknowledged").order("first_detected_at",{ascending:false}).limit(100)
          : {data:[],error:null};
      if (attendanceResult.error) setNotice("Some attendance alerts could not be loaded: " + attendanceResult.error.message);
      const attendanceUnread = (attendanceResult.data ?? []).filter((row:any)=>role==="parent" ? !row.read_at : row.alert_status!=="acknowledged").length;
      if (!directUnreadResult.error && !chatUnreadResult.error) {
        setUnreadCount((directUnreadResult.count ?? 0) + Number(chatUnreadResult.data || 0) + attendanceUnread);
      } else {
        setNotice("The inbox is loaded, but the full unread count could not be verified. Refresh or reconnect to retry.");
      }
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
      const conversationResult = conversationIds.length ? await db.from("resa_chat_conversations").select("id,subject,conversation_type,customer_care_duty").in("id", conversationIds) : { data: [] };
      const conversationNames = new Map((conversationResult.data ?? []).map((row: any) => [row.id, row.subject]));
      const conversationDetails = new Map((conversationResult.data ?? []).map((row: any) => [row.id, row]));
      const senderIds = [...new Set([...(messageResult.data ?? []).map((m: any) => m.sender_id), ...chatRows.map((m: any) => m.sender_id)].filter(Boolean))];
      const senderProfiles = senderIds.length ? await db.from("profiles").select("id,display_name").in("id", senderIds) : { data: [], error: null };
      const senderNames = new Map((senderProfiles.data ?? []).map((profile: any) => [profile.id, profile.display_name || "School member"]));
      const senderMemberships = senderIds.length ? await db.from("school_memberships").select("user_id,role").eq("school_id",schoolId).eq("status","active").in("user_id",senderIds) : {data:[]};
      const senderRoles = new Map((senderMemberships.data ?? []).map((membership:any)=>[membership.user_id,membership.role]));
      const now = Date.now();
      const messages: Notice[] = (messageResult.data ?? []).map((m: any) => ({
        id: m.id, kind: "message", title: m.subject, body: m.message, createdAt: m.sent_at,
        unread: !m.is_read, sender: m.sender_id, senderName: senderNames.get(m.sender_id) || "School member",
        channel: m.channel, targetUrl: "/school-communication?message_id=" + encodeURIComponent(m.id),
        category: m.channel === "customer_care" ? "customer_care" : m.channel === "announcement" ? "announcements" : m.channel === "attendance" ? "attendance" : m.channel === "fees" ? "fees" : m.channel === "admissions" ? "admissions" : m.channel === "cbt" ? "cbt" : m.channel === "results" ? "results" : m.channel === "admin" || senderRoles.get(m.sender_id) === "admin" ? "administration" : "messages",
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
          createdAt: a.published_at || a.created_at, unread: false, sender: a.announcement_type, category: "announcements",
        }));
      const chatNotices: Notice[] = chatRows.filter((m: any) => m.sender_id !== uid).map((m: any) => {
        const conversation = conversationDetails.get(m.conversation_id) as any;
        const duty = String(conversation?.customer_care_duty || "general");
        const category = conversation?.conversation_type === "admin_support"
          ? (["fees","admissions","cbt","results","attendance","technical"].includes(duty) ? duty : "customer_care")
          : conversation?.conversation_type === "group" ? "group_messages" : "messages";
        return { id: "chat-" + m.id, kind: "chat", title: conversationNames.get(m.conversation_id) || "RESA chat", body: m.body, createdAt: m.created_at, unread: !readIds.has(m.id), sender: m.sender_id, senderName: senderNames.get(m.sender_id) || "School member", channel: "chat", category, targetUrl: "/resa-chat?conversation_id=" + encodeURIComponent(m.conversation_id) + "&message_id=" + encodeURIComponent(m.id) };
      });
      const attendanceNotices: Notice[] = (attendanceResult.data ?? []).map((row:any) => ({
        id: "attendance-" + row.id, kind: "attendance", category: "attendance",
        title: role === "parent" ? (row.notification_type || "Student attendance update") : "Attendance checkpoint alert",
        body: row.message || (row.person_type === "student" ? "A student attendance checkpoint needs attention." : "A staff attendance checkpoint needs attention."),
        createdAt: row.created_at || row.first_detected_at || row.sent_at || new Date().toISOString(),
        unread: role === "parent" ? !row.read_at : row.alert_status !== "acknowledged",
        source: role === "parent" ? "biometric_parent_notifications" : "attendance_checkpoint_alerts",
        sourceId: row.id, targetUrl: "/attendance",
      }));
      setItems([...messages, ...announcements, ...chatNotices, ...attendanceNotices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) { setError(e instanceof Error ? e.message : "Notifications could not be loaded."); setPreferencesLoading(false); }
    finally { if (!quiet) setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let db: any;
    let channel: any;
    try {
      db = getSupabaseClient();
      channel = db.channel("resa-notifications-" + schoolId)
        .on("postgres_changes", { event: "*", schema: "public", table: "school_messages", filter: "school_id=eq." + schoolId }, (payload: any) => {
          if (payload.new?.recipient_id === userId || payload.old?.recipient_id === userId) {
            void load(true);
          }
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "resa_chat_messages", filter: "school_id=eq." + schoolId }, (payload: any) => {
          if (payload.new?.sender_id !== userId) void load(true);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "resa_chat_message_reads", filter: "school_id=eq." + schoolId }, (payload: any) => {
          if (payload.new?.user_id === userId || payload.old?.user_id === userId) void load(true);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements", filter: "school_id=eq." + schoolId }, (payload: any) => {
          // The authenticated app-level listener handles the phone alert once;
          // this page only refreshes the inbox to avoid duplicate notifications.
          void load(true);
        }).subscribe();
    } catch { /* Refresh remains available if Realtime is not configured. */ }
    return () => { if (db && channel) void db.removeChannel(channel); };
  }, [schoolId, userId, load]);

  useEffect(() => {
    const refreshQuietly = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void load(true);
    };
    const timer = window.setInterval(refreshQuietly, 20000);
    window.addEventListener("focus", refreshQuietly);
    window.addEventListener("online", refreshQuietly);
    document.addEventListener("visibilitychange", refreshQuietly);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshQuietly);
      window.removeEventListener("online", refreshQuietly);
      document.removeEventListener("visibilitychange", refreshQuietly);
    };
  }, [load]);

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
      } else if (item.kind === "attendance" && item.source === "biometric_parent_notifications" && item.sourceId) {
        const { error: updateError } = await db.from("biometric_parent_notifications").update({ read_at: new Date().toISOString() }).eq("id", item.sourceId).eq("school_id", schoolId);
        if (updateError) throw updateError;
      } else return;
      setItems(previous => previous.map(n => n.id === item.id ? { ...n, unread: false } : n));
      setUnreadCount(previous => Math.max(0, previous - 1));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not mark this notification as read."); }
  }

  async function saveNotificationPreferences() {
    setPreferencesSaving(true); setPreferencesError(""); setPreferencesNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await db.from("resa_notification_preferences").upsert({
        school_id: schoolId, user_id: auth.user.id, enabled: preferences.enabled,
        phone_notifications_enabled: preferences.phone_notifications_enabled,
        vibration_enabled: preferences.vibration_enabled,
        show_notification_preview: preferences.show_notification_preview,
        in_app_sound_enabled: preferences.in_app_sound_enabled,
        quiet_hours_enabled: preferences.quiet_hours_enabled,
        quiet_hours_start: preferences.quiet_hours_start,
        quiet_hours_end: preferences.quiet_hours_end,
        category_preferences: preferences.category_preferences,
        category_sounds: preferences.category_sounds,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,user_id" });
      if (saveError) throw saveError;
      setPreferencesNotice("Your RESA notification preferences have been saved.");
    } catch (e) { setPreferencesError(e instanceof Error ? e.message : "Preferences could not be saved."); }
    finally { setPreferencesSaving(false); }
  }

  function previewNotificationSound(soundId: string) {
    if (soundId === "silent") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audio = new AudioContextClass();
      const patterns: Record<string, number[]> = {
        resa_chime: [784, 988], classic_bell: [1046, 784], digital_ping: [1175],
        soft_tone: [523], gentle_melody: [659, 784, 988], crystal_drop: [1318, 1046],
        double_beep: [880, 880], alert_tone: [988, 784, 988], message_pop: [740],
        school_bell: [659, 784, 659], vibrant_ring: [880, 1046, 1318],
      };
      (patterns[soundId] || patterns.resa_chime).forEach((frequency, index) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const start = audio.currentTime + index * 0.16;
        oscillator.frequency.value = frequency; oscillator.type = "sine";
        gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + 0.15);
      });
      window.setTimeout(() => void audio.close(), 900);
    } catch { setPreferencesError("This device or browser blocked the sound preview."); }
  }

  async function markAllRead() {
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const directIds = items.filter(item => item.kind === "message" && item.unread).map(item => item.id);
      const chatIds = items.filter(item => item.kind === "chat" && item.unread).map(item => item.id.replace(/^chat-/, ""));
      const attendanceIds = items.filter(item => item.kind === "attendance" && item.source === "biometric_parent_notifications" && item.unread && item.sourceId).map(item => item.sourceId as string);
      if (directIds.length) {
        const { error: directError } = await db.from("school_messages").update({ is_read: true, read_at: new Date().toISOString() }).in("id", directIds).eq("recipient_id", userId);
        if (directError) throw directError;
      }
      if (attendanceIds.length) { const { error: attendanceError } = await db.from("biometric_parent_notifications").update({ read_at: new Date().toISOString() }).in("id", attendanceIds).eq("school_id", schoolId); if (attendanceError) throw attendanceError; }
      if (chatIds.length) {
        const { error: chatError } = await db.from("resa_chat_message_reads").upsert(
          chatIds.map(message_id => ({ message_id, school_id: schoolId, user_id: userId })),
          { onConflict: "message_id,user_id", ignoreDuplicates: true },
        );
        if (chatError) throw chatError;
      }
      setItems(previous => previous.map(item => item.kind === "attendance" && item.source === "attendance_checkpoint_alerts" ? item : ({ ...item, unread: false })));
      await load(true);
      setNotice("All currently loaded private and group messages have been marked as read. Older unread items will remain counted until they are loaded and marked read.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not mark all messages as read."); }
  }

  async function enableBrowserAlerts() {
    setError("");
    try {
      await enableResaPushNotifications(schoolId, true);
      const status = await getResaPushRegistrationStatus(schoolId);
      setPushStatus({ registered: status.registered, supported: status.supported, detail: status.detail });
      if (!status.registered) throw new Error(status.detail);
      setPreferences(current => ({ ...current, enabled: true, phone_notifications_enabled: true }));
      setNotice("This phone is registered with RESA's push service and phone alerts are enabled for this account. Run the delivery test below to confirm background delivery.");
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

  const categoryLabels: Record<string,string> = { all:"All categories", attendance:"Attendance", administration:"Administration", customer_care:"Customer Care", fees:"Fees & payments", admissions:"Admissions", cbt:"CBT & examinations", results:"Results", academics:"Academics", announcements:"Announcements", messages:"Private messages", group_messages:"Group chats", technical:"Technical support" };
  const categoryCounts = useMemo(() => items.reduce<Record<string,{total:number;unread:number}>>((counts,item) => { const key=item.category || "messages"; counts[key] ||= {total:0,unread:0}; counts[key].total++; if(item.unread) counts[key].unread++; return counts; },{}),[items]);
  const filteredItems = useMemo(() => items.filter(item => {
    const itemDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.createdAt));
    const matchesDate = itemDate === selectedDate;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesUnread = filter === "all" || (item.kind !== "announcement" && item.unread);
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${item.title} ${item.body} ${item.kind} ${item.channel ?? ""}`.toLocaleLowerCase().includes(query);
    return matchesDate && matchesUnread && matchesSearch && matchesCategory;
  }), [items, selectedDate, filter, search, categoryFilter]);
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
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-extrabold">My notification preferences</h2><p className="mt-1 text-sm text-slate-600">Choose which RESA updates reach you and how they sound on this device.</p></div>
          <button type="button" onClick={() => void saveNotificationPreferences()} disabled={preferencesLoading || preferencesSaving} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{preferencesSaving ? "Saving…" : "Save preferences"}</button>
        </div>
        {preferencesLoading ? <p className="mt-3 text-sm text-slate-500">Loading your preferences…</p> : <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["enabled","All RESA notifications"],["phone_notifications_enabled","Phone push notifications"],
              ["in_app_sound_enabled","Sound while using the portal"],["vibration_enabled","Vibration (device support required)"],
              ["show_notification_preview","Show message previews"],["quiet_hours_enabled","Enable quiet hours"],
            ].map(([key,label]) => <label key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
              <span>{label}</span><input type="checkbox" checked={Boolean((preferences as any)[key])} onChange={e=>setPreferences(p=>({...p,[key]:e.target.checked}))} className="h-5 w-5 accent-emerald-800"/>
            </label>)}
          </div>
          {preferences.quiet_hours_enabled && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Quiet hours start<input type="time" value={preferences.quiet_hours_start} onChange={e=>setPreferences(p=>({...p,quiet_hours_start:e.target.value}))} className="mt-1 block w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs font-bold text-slate-600">Quiet hours end<input type="time" value={preferences.quiet_hours_end} onChange={e=>setPreferences(p=>({...p,quiet_hours_end:e.target.value}))} className="mt-1 block w-full rounded-lg border p-2 text-sm"/></label></div>}
          <div className="mt-4 border-t pt-4"><h3 className="font-bold">Choose notification categories</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">
            {notificationCategories.map(([key,label]) => <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <label className="flex min-w-0 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={preferences.category_preferences[key] !== false} onChange={e=>setPreferences(p=>({...p,category_preferences:{...p.category_preferences,[key]:e.target.checked}}))} className="h-4 w-4 accent-emerald-800"/>{label}</label>
              <div className="flex items-center gap-1"><select aria-label={label+" sound"} value={preferences.category_sounds[key] || "resa_chime"} onChange={e=>setPreferences(p=>({...p,category_sounds:{...p.category_sounds,[key]:e.target.value}}))} className="max-w-36 rounded-lg border bg-white px-2 py-1.5 text-xs">{soundOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><button type="button" onClick={()=>previewNotificationSound(preferences.category_sounds[key] || "resa_chime")} className="rounded-lg border bg-white px-2 py-1.5 text-xs font-bold" aria-label={"Preview "+label+" sound"}>▶</button></div>
            </div>)}
          </div></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Phone push requires browser permission and a registered device. Quiet hours are enforced for ordinary server-delivered push and foreground alerts; urgent attendance alerts bypass quiet hours. Background sound and vibration are ultimately controlled by Android and the browser notification channel, while sound previews work only while this page is open.</p>
        </>}
        {preferencesError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{preferencesError}</p>}
        {preferencesNotice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{preferencesNotice}</p>}
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
          <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{filteredItems.length} shown · {items.length} loaded</span>{unreadCount > 0 && <button type="button" onClick={()=>void markAllRead()} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-emerald-900">Mark all read</button>}</div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto border-t border-slate-100 pt-3 pb-1">
          {Object.entries(categoryLabels).filter(([key])=>key==="all"||categoryCounts[key]).map(([key,label])=>{
            const count=categoryCounts[key]?.unread||0;
            const total=categoryCounts[key]?.total||0;
            return <button key={key} type="button" onClick={()=>setCategoryFilter(key)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${categoryFilter===key?"border-emerald-900 bg-emerald-900 text-white":"border-slate-200 bg-white text-slate-700"}`}>
              {label}{key!=="all"&&<span className="ml-1 opacity-75">{count>0?count:total}</span>}
            </button>;
          })}
        </div>
      </section>
      {!loading && filteredItems.length===0 && items.length>0 && <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-600">No notifications match this date and search. Choose another date or clear the search to find older items.</p>}
      <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">{filteredItems.map(item => <article key={item.kind + item.id} className={`rounded-xl border bg-white p-3 shadow-sm ${item.unread ? "border-emerald-400 ring-1 ring-emerald-100" : "border-slate-200"}`}>
        <div className="flex items-start gap-3"><span className={`rounded-xl p-2 ${item.kind==="message"?"bg-blue-50 text-blue-800":"bg-amber-50 text-amber-800"}`}>{item.kind==="announcement"?<Megaphone size={20}/>:<MessageSquare size={20}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.title}</h2>{item.unread&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">Unread</span>}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{categoryLabels[item.category] || (item.kind==="announcement"?"School announcement":item.kind==="chat"?"Chat message":"Private message")}</span></div>{item.senderName&&<p className="mt-1 text-xs font-semibold text-emerald-800">From: {item.senderName}</p>}<p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{item.body}</p>{item.targetUrl&&<a href={item.targetUrl} onClick={()=>{if(item.unread)void markRead(item);}} className="mt-2 inline-block text-xs font-bold text-emerald-800 underline underline-offset-2">Open conversation →</a>}<p className="mt-2 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></div>{item.unread&&<button onClick={()=>void markRead(item)} aria-label="Mark message as read" title="Mark as read" className="rounded-lg border p-2"><CheckCheck size={17}/></button>}</div>
      </article>)}</div>
      <p className="text-xs leading-5 text-slate-500">Background phone alerts use RESA Web Push. Each person must register each phone/browser separately. Delivery depends on Android notification permission, battery/background restrictions and network availability; this page verifies registration and provides a real push-service test. Email and WhatsApp delivery are not claimed as connected.</p>
    </div>
  </main>;
}
