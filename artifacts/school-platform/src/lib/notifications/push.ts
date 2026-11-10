import { getSupabaseClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = "BCjHECfHzjgPihfTIT1Va3AVT42ti1oF46TocpL6bvQ_FzSV2bFHOrkLJpPguMcuI3wa920XL34GPwM_ylecJIQ";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export type ResaPushRegistrationStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  registered: boolean;
  detail: string;
};

export async function getResaPushRegistrationStatus(schoolId: string): Promise<ResaPushRegistrationStatus> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { supported: false, permission: "unsupported", registered: false, detail: "Use Chrome on Android to register this phone." };
  }
  const permission = Notification.permission;
  if (permission !== "granted") {
    return { supported: true, permission, registered: false, detail: permission === "denied" ? "Notifications are blocked in browser or Android settings." : "Notification permission has not been granted." };
  }

  const db = getSupabaseClient() as any;
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) {
    return { supported: true, permission, registered: false, detail: "Sign in to check this device's registration." };
  }
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription?.endpoint) {
    return { supported: true, permission, registered: false, detail: "This browser has permission, but no push subscription is registered." };
  }
  const { data, error } = await db.from("resa_push_subscriptions")
    .select("id,last_seen_at")
    .eq("school_id", schoolId)
    .eq("user_id", auth.user.id)
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { supported: true, permission, registered: true, detail: "This phone is registered for RESA push notifications." }
    : { supported: true, permission, registered: false, detail: "The browser subscription exists but is not registered to this RESA account." };
}

export async function sendResaPushTestNotification(schoolId: string) {
  const db = getSupabaseClient() as any;
  const { data, error } = await db.functions.invoke("resa-push-dispatch", {
    body: { event_type: "test", school_id: schoolId },
  });
  if (error) throw new Error(error.message || "The RESA push test could not be sent.");
  if (data?.error) throw new Error(String(data.error));
  if (!data?.sent) throw new Error("The push service did not confirm delivery to a registered device.");
  return data as { accepted: boolean; sent: number; devices: number };
}

export async function enableResaPushNotifications(schoolId: string, requestPermission = true) {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support RESA phone push notifications. Use Chrome on Android.");
  }
  const permission = Notification.permission === "granted"
    ? "granted"
    : requestPermission ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") {
    throw new Error("Allow notifications for RESA in Chrome or Android settings to receive phone alerts.");
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
  if (!serialized.endpoint || !p256dh || !authKey) {
    throw new Error("The phone did not return a complete push subscription. Try enabling notifications again.");
  }

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

  return { userId: auth.user.id, endpoint: serialized.endpoint };
}
