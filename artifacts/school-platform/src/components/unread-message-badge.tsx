import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { enableResaPushNotifications } from "@/lib/notifications/push";

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
    // Browser autoplay or device sound settings may prevent foreground audio.
  }
}

/** Unified unread direct/group-chat count and per-device RESA Web Push enrolment. */
export default function UnreadMessageBadge({ schoolId }: { schoolId: string }) {
  const [count, setCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");

  const registerPush = useCallback(async () => {
    await enableResaPushNotifications(schoolId, false);
    setPermission("granted");
  }, [schoolId]);

  const enableNotifications = useCallback(async () => {
    setSetupBusy(true);
    setSetupError("");
    try {
      await enableResaPushNotifications(schoolId, true);
      setPermission("granted");
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Phone notifications could not be enabled.");
    } finally {
      setSetupBusy(false);
    }
  }, [schoolId]);

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
    if ("Notification" in window && Notification.permission === "granted") {
      void registerPush().catch(error => console.warn("RESA push re-enrolment:", error));
    }
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
          title={setupError || (permission === "granted" ? "RESA phone notifications enabled" : permission === "denied" ? "Notifications blocked in browser settings" : "Enable RESA phone notifications")}
          aria-label={permission === "granted" ? "RESA phone notifications enabled" : "Enable RESA phone notifications"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-current hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {permission === "granted" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
      )}
      {setupError && <span role="status" className="max-w-36 text-[10px] leading-tight text-amber-700">{setupError}</span>}
    </span>
  );
}
