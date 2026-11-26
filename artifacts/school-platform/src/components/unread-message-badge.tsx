import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Volume2, VolumeX } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { enableResaPushNotifications, getResaPushRegistrationStatus } from "@/lib/notifications/push";

type ResaChatSound = "default" | "soft-pop" | "classic" | "gentle-bell" | "silent";

async function playResaChime(sound: ResaChatSound) {
  if (sound === "silent") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    if (context.state === "suspended") await context.resume();
    const notes: Record<Exclude<ResaChatSound, "silent">, { frequencies: number[]; type: OscillatorType; duration: number; volume: number }> = {
      default: { frequencies: [880, 1174.66], type: "sine", duration: 0.44, volume: 0.12 },
      "soft-pop": { frequencies: [660, 880], type: "sine", duration: 0.22, volume: 0.075 },
      classic: { frequencies: [784, 988, 784], type: "triangle", duration: 0.34, volume: 0.09 },
      "gentle-bell": { frequencies: [1046.5, 1318.5], type: "sine", duration: 0.62, volume: 0.08 },
    };
    const selected = notes[sound];
    const start = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(selected.volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + selected.duration);
    gain.connect(context.destination);
    const oscillator = context.createOscillator();
    oscillator.type = selected.type;
    selected.frequencies.forEach((frequency, index) => {
      oscillator.frequency.setValueAtTime(frequency, start + index * (selected.duration / selected.frequencies.length) * 0.62);
    });
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + selected.duration + 0.02);
    oscillator.onended = () => { void context.close(); };
  } catch {
    // Browser autoplay or device sound settings may prevent foreground audio.
  }
}

/**
 * Unified unread direct/group-chat count and per-device RESA Web Push enrolment.
 * Realtime is the fast path; focus/reconnect and a low-frequency poll are the
 * recovery path so a dropped socket cannot leave the badge stale indefinitely.
 */
export default function UnreadMessageBadge({ schoolId }: { schoolId: string }) {
  const [count, setCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window ? Notification.permission : "unsupported",
  );
  const [registered, setRegistered] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [chatSound, setChatSound] = useState<ResaChatSound>(() => {
    try {
      const saved = window.localStorage.getItem("resa-chat-sound-choice");
      return saved === "soft-pop" || saved === "classic" || saved === "gentle-bell" || saved === "silent" ? saved : "default";
    } catch { return "default"; }
  });
  const refreshSequence = useRef(0);

  const registerPush = useCallback(async () => {
    await enableResaPushNotifications(schoolId, false);
    setPermission("granted");
    setRegistered(true);
  }, [schoolId]);

  const enableNotifications = useCallback(async () => {
    setSetupBusy(true);
    setSetupError("");
    try {
      await enableResaPushNotifications(schoolId, true);
      setPermission("granted");
      setRegistered(true);
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
      const sequence = ++refreshSequence.current;
      try {
        const { data, error: authError } = await db.auth.getUser();
        if (authError) throw authError;
        userId = data?.user?.id ?? "";
        if (!userId || !active) {
          if (active && sequence === refreshSequence.current) setCount(0);
          return;
        }
        const [direct, chatCount] = await Promise.all([
          db.from("school_messages")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId).eq("recipient_id", userId).eq("is_read", false),
          db.rpc("resa_get_unread_chat_count", { p_school_id: schoolId }),
        ]);
        if (direct.error) throw direct.error;
        if (chatCount.error) throw chatCount.error;
        const nextCount = (direct.count ?? 0) + Number(chatCount.data || 0);
        // Ignore slower, older requests that finish after a newer Realtime refresh.
        if (active && sequence === refreshSequence.current) setCount(nextCount);
      } catch (error) {
        // Keep the last known count during a transient network/RLS failure.
        console.warn("RESA unread count refresh failed; retaining last known count:", error);
      }
    };

    const notify = async (title: string, body: string, tag: string, url: string, playSound = false) => {
      // Play the in-app chat chime independently of Web Push permission.
      // When the page is backgrounded, let the OS push notification provide the alert.
      if (playSound && document.visibilityState === "visible") void playResaChime(chatSound);
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: "/media/logo/resa-logo.jpg",
          badge: "/media/logo/resa-logo.jpg?v=20261125",
          tag,
          data: { url },
        });
      } catch (error) {
        console.warn("RESA foreground notification could not be displayed:", error);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const refreshWhenOnline = () => { void refresh(); };

    void refresh();
    if ("Notification" in window && Notification.permission === "granted") {
      void registerPush().catch(error => {
        setRegistered(false);
        console.warn("RESA push re-enrolment:", error);
      });
    } else {
      void getResaPushRegistrationStatus(schoolId)
        .then(status => { if (active) setRegistered(status.registered); })
        .catch(() => { if (active) setRegistered(false); });
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
              true,
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
            true,
          );
          void refresh();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "resa_chat_message_reads", filter: "school_id=eq." + schoolId }, (payload: any) => {
        if (payload.new?.user_id === userId || payload.old?.user_id === userId) void refresh();
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") void refresh();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("RESA unread-count Realtime channel status:", status, "— recovery refresh remains active.");
        }
      });

    // Realtime normally updates within seconds. Polling is a safety net for
    // mobile browsers that suspend sockets or temporarily lose connectivity.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh();
    }, 20000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenOnline);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenOnline);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (channel) void db.removeChannel(channel);
    };
  }, [schoolId, registerPush, chatSound]);

  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <label className="inline-flex items-center gap-1" title="Choose the sound for incoming RESA messages">
        {chatSound === "silent" ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        <span className="sr-only">Chat notification sound</span>
        <select
          aria-label="Chat notification sound"
          value={chatSound}
          onChange={event => {
            const next = event.target.value as ResaChatSound;
            setChatSound(next);
            try { window.localStorage.setItem("resa-chat-sound-choice", next); } catch { /* Device storage may be unavailable. */ }
            if (next !== "silent") void playResaChime(next);
          }}
          className="max-w-28 rounded-md border border-input bg-background px-1.5 py-1 text-xs text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="default">RESA Chime</option>
          <option value="soft-pop">Soft Pop</option>
          <option value="classic">Classic Message</option>
          <option value="gentle-bell">Gentle Bell</option>
          <option value="silent">Silent</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => void playResaChime(chatSound)}
        disabled={chatSound === "silent"}
        title={chatSound === "silent" ? "Sound is set to silent" : "Preview selected chat sound"}
        aria-label="Preview selected chat sound"
        className="inline-flex items-center justify-center rounded-md px-2 py-1 text-current hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        <span className="text-[10px] font-semibold">Test</span>
      </button>
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
          title={setupError || (registered ? "This phone is registered for RESA push notifications" : permission === "denied" ? "Notifications blocked in browser settings" : "Register this phone for RESA push notifications")}
          aria-label={registered ? "RESA phone device registered" : "Register RESA phone notifications"}
          className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-current hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {registered ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}<span className="text-[10px] font-semibold">{registered ? "Device registered" : permission === "denied" ? "Alerts blocked" : "Set up phone alerts"}</span>
        </button>
      )}
      {setupError && <span role="status" className="max-w-36 text-[10px] leading-tight text-amber-700">{setupError}</span>}
    </span>
  );
}
