import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = "BCjHECfHzjgPihfTIT1Va3AVT42ti1oF46TocpL6bvQ_FzSV2bFHOrkLJpPguMcuI3wa920XL34GPwM_ylecJIQ";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

function playResaChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    gain.connect(context.destination);
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1174.66, context.currentTime + 0.14);
    oscillator.connect(gain);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.44);
    oscillator.onended = () => { void context.close(); };
  } catch {
    // Device/browser sound settings may prevent foreground audio.
  }
}

/** Unified unread direct/group-chat count and per-device RESA Web Push enrolment. */
export default function UnreadMessageBadge({ schoolId }: { schoolId: string }) {
  const [count, setCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [setupBusy, setSetupBusy] = useState(false);

  const registerPush = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      throw new Error("This browser does not support RESA phone push notifications. Use Chrome on Android.");
    }
    if (Notification.permission !== "granted") {
      throw new Error("Allow notifications for RESA in your browser or Android settings first.");
    }
    const db = getSupabaseClient() as any;
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) throw new Error("Please sign in again to enable phone notifications.");
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
      });
    const serialized = subscription.toJSON();
    const p256dh = serialized.keys?.p256dh;
    const authKey = serialized.keys?.auth;
    if (!serialized.endpoint || !p256dh || !authKey) throw new Error("The phone did not return a complete push subscription.");
    const { error: subscriptionError } = await db.from("resa_push_subscriptions").upsert({
      school_id: schoolId,
      user_id: auth.user.id,
      endpoint: serialized.endpoint,
      p256dh,
      auth_key: authKey,
      user_agent: navigator.userAgent.slice(0, 500),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (subscriptionError) throw subscriptionError;
    const { error: preferenceError } = await db.from("resa_notification_preferences").upsert({
      school_id: schoolId,
      user_id: auth.user.id,
      enabled: true,
      sound_choice: "chime",
      phone_notifications_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "school_id,user_id" });
    if (preferenceError) throw preferenceError;
    setPermission("granted");
  }, [schoolId]);

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setSetupBusy(true);
    try {
      const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Notification permission was not granted. Enable it in Android app or Chrome site settings.");
      await registerPush();
    } catch (error) {
      console.error("RESA phone notification setup failed:", error);
      if (error instanceof Error) window.alert(error.message);
    } finally {
      setSetupBusy(false);
    }
  }, [registerPush]);

  useEffect(() => {
    let active = true;
    const db = getSupabaseClient() as any;
    let channel: any;
    let userId = "";

    const refresh = async () => {
      const { data } = await db.auth.getUser();
      userId = data?.user?.id ?? "";
      if (!userId || !active) return;
      const [direct, chat] = await Promise.all([
        db.from("school_messages")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId).eq("recipient_id", userId).eq("is_read", false),
        db.from("resa_chat_messages")
          .select("id,sender_id")
          .eq("school_id", schoolId).neq("sender_id", userId)
          .order("created_at", { ascending: false }).limit(500),
      ]);
      let unreadChat = 0;
      if (!chat.error && (chat.data ?? []).length) {
        const ids = chat.data.map((message: any) => message.id);
        const reads = await db.from("resa_chat_message_reads")
          .select("message_id").eq("school_id", schoolId).eq("user_id", userId).in("message_id", ids);
        if (!reads.error) {
          const readIds = new Set((reads.data ?? []).map((item: any) => item.message_id));
          unreadChat = chat.data.filter((message: any) => !readIds.has(message.id)).length;
        }
      }
      if (active) setCount((direct.error ? 0 : direct.count ?? 0) + unreadChat);
    };

    const notify = async (title: string, body: string, tag: string, url: string) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      playResaChime();
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: "/media/logo/resa-logo.jpg",
          badge: "/favicon.ico",
          tag,
          renotify: true,
          vibrate: [180, 90, 180],
          data: { url },
        });
      } catch (error) {
        console.warn("RESA foreground notification could not be displayed:", error);
      }
    };

    void refresh();
    if (Notification.permission === "granted") void registerPush().catch(error => console.warn("RESA push re-enrolment:", error));
    channel = db.channel("resa-unread-badge-" + schoolId)
      .on("postgres_changes", { event: "*", schema: "public", table: "school_messages", filter: "school_id=eq." + schoolId }, async (payload: any) => {
        const message = payload.new;
        if (message?.recipient_id === userId || payload.old?.recipient_id === userId) {
          if (payload.eventType === "INSERT" && message?.recipient_id === userId) {
            await notify(
              String(message.subject || "New RESA message"),
              String(message.message || "You have received a new school message.").slice(0, 160),
              "resa-message-" + String(message.id),
              "/notifications",
            );
          }
          void refresh();
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "resa_chat_messages", filter: "school_id=eq." + schoolId }, async (payload: any) => {
        if (payload.new?.sender_id && payload.new.sender_id !== userId) {
          await notify(
            "New RESA chat message",
            String(payload.new.body || "You have received a new chat message.").slice(0, 160),
            "resa-chat-" + String(payload.new.id),
            "/resa-chat",
          );
          void refresh();
        }
      })
      .subscribe();

    return () => {
      active = false;
      if (channel) void db.removeChannel(channel);
    };
  }, [schoolId, registerPush]);

  return (
    <span className="ml-2 inline-flex items-center gap-1">
      {count > 0 && (
        <span aria-label={count + " unread messages"} title={count + " unread messages"} className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
      {permission !== "unsupported" && (
        <button
          type="button"
          disabled={setupBusy}
          onClick={() => void enableNotifications()}
          title={permission === "granted" ? "RESA phone notifications enabled" : permission === "denied" ? "Notifications blocked in browser settings" : "Enable RESA phone notifications"}
          aria-label={permission === "granted" ? "RESA phone notifications enabled" : "Enable RESA phone notifications"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-current hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {permission === "granted" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
      )}
    </span>
  );
}
