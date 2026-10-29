import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

/** Live unread count plus opt-in browser notifications for new inbox messages. */
export default function UnreadMessageBadge({ schoolId }: { schoolId: string }) {
  const [count, setCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      setPermission("denied");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const db = getSupabaseClient() as any;
    let channel: any;
    let userId = "";

    const refresh = async () => {
      const { data } = await db.auth.getUser();
      userId = data?.user?.id ?? "";
      if (!userId || !active) return;
      const result = await db.from("school_messages")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId).eq("recipient_id", userId).eq("is_read", false);
      if (active && !result.error) setCount(result.count ?? 0);
    };

    void refresh();
    channel = db.channel("resa-unread-badge-" + schoolId + "-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "school_messages", filter: "school_id=eq." + schoolId }, async (payload: any) => {
        const message = payload.new;
        if (message?.recipient_id === userId || payload.old?.recipient_id === userId) {
          if (payload.eventType === "INSERT" && message?.recipient_id === userId &&
              "Notification" in window && Notification.permission === "granted") {
            const title = typeof message.subject === "string" && message.subject.trim()
              ? message.subject.trim()
              : "New RESA message";
            const body = typeof message.message === "string"
              ? message.message.trim().slice(0, 160)
              : "You have received a new message in your school portal.";
            try {
              if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, {
                  body,
                  icon: "/media/logo/resa-logo.jpg",
                  badge: "/media/logo/resa-logo.jpg",
                  tag: "resa-message-" + String(message.id ?? Date.now()),
                  data: { url: "/notifications" },
                });
              } else {
                new Notification(title, { body, icon: "/media/logo/resa-logo.jpg" });
              }
            } catch (error) {
              console.error("RESA browser notification failed:", error);
            }
          }
          void refresh();
        }
      }).subscribe();

    return () => {
      active = false;
      if (channel) void db.removeChannel(channel);
    };
  }, [schoolId]);

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
          onClick={() => void enableNotifications()}
          title={permission === "granted" ? "Browser notifications enabled" : permission === "denied" ? "Notifications blocked in browser settings" : "Enable RESA message notifications"}
          aria-label={permission === "granted" ? "Browser notifications enabled" : "Enable RESA message notifications"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-current hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {permission === "granted" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
      )}
    </span>
  );
}
