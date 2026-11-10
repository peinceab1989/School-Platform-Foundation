import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushRecord = Record<string, unknown>;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function uniqueIds(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

async function resolveRecipients(eventType: string, row: PushRecord): Promise<string[]> {
  const schoolId = String(row.school_id || "");
  if (!schoolId) return [];

  if (eventType === "school_message") {
    return uniqueIds([row.recipient_id]);
  }

  if (eventType === "attendance") {
    const { data, error } = await admin
      .from("parent_portal_accounts")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("parent_guardian_id", String(row.parent_guardian_id || ""))
      .eq("is_active", true);
    if (error) throw error;
    return uniqueIds((data || []).map((item) => item.user_id));
  }

  if (eventType === "announcement") {
    const { data, error } = await admin
      .from("school_memberships")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("status", "active");
    if (error) throw error;
    return uniqueIds((data || []).map((item) => item.user_id));
  }

  if (eventType === "chat_message") {
    const { data: conversation, error: conversationError } = await admin
      .from("resa_chat_conversations")
      .select("id,conversation_type,participant_one,participant_two")
      .eq("id", String(row.conversation_id || ""))
      .eq("school_id", schoolId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return [];
    let ids: string[] = [];
    if (conversation.conversation_type === "group") {
      const { data, error } = await admin
        .from("resa_chat_group_members")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("conversation_id", conversation.id);
      if (error) throw error;
      ids = uniqueIds((data || []).map((item) => item.user_id));
    } else {
      ids = uniqueIds([conversation.participant_one, conversation.participant_two]);
    }
    return ids.filter((id) => id !== String(row.sender_id || ""));
  }

  return [];
}

function makeNotification(eventType: string, row: PushRecord) {
  const id = String(row.id || crypto.randomUUID());
  if (eventType === "school_message") {
    return {
      title: String(row.subject || "").trim() || "New RESA message",
      body: String(row.message || "You have received a new school message.").slice(0, 180),
      url: "/notifications",
      tag: "resa-message-" + id,
    };
  }
  if (eventType === "chat_message") {
    return {
      title: "New RESA chat message",
      body: String(row.body || "You have received a new chat message.").slice(0, 180),
      url: "/resa-chat",
      tag: "resa-chat-" + id,
    };
  }
  if (eventType === "attendance") {
    return {
      title: "RESA · Attendance update",
      body: String(row.message || "A linked learner's attendance was updated.").slice(0, 180),
      url: "/parent-dashboard",
      tag: "resa-attendance-" + id,
    };
  }
  return {
    title: String(row.title || "RESA school announcement").slice(0, 120),
    body: String(row.content || "A new school announcement is available.").slice(0, 180),
    url: "/notifications",
    tag: "resa-announcement-" + id,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Push service is not configured" }, 503);

  try {
    const event = await request.json();
    const eventType = String(event?.event_type || "");
    const row = (event?.record || {}) as PushRecord;

    // A test request is authenticated as the signed-in user and can only target
    // that user's own registered device(s) in an active school membership.
    if (eventType === "test") {
      const authorization = request.headers.get("authorization") || "";
      const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
      if (!accessToken) return json({ error: "Sign in before testing phone notifications." }, 401);
      const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
      if (authError || !authData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);
      const schoolId = String(event?.school_id || "");
      if (!schoolId) return json({ error: "School ID is required." }, 400);

      const { data: membership, error: membershipError } = await admin
        .from("school_memberships")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("user_id", authData.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Active school membership is required." }, 403);

      const { data: preference, error: preferenceError } = await admin
        .from("resa_notification_preferences")
        .select("enabled,phone_notifications_enabled")
        .eq("school_id", schoolId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (preferenceError) throw preferenceError;
      if (!preference?.enabled || !preference?.phone_notifications_enabled) {
        return json({ error: "Enable phone notifications for this account before running the test." }, 409);
      }

      const { data: subscriptions, error: subscriptionError } = await admin
        .from("resa_push_subscriptions")
        .select("id,endpoint,p256dh,auth_key")
        .eq("school_id", schoolId)
        .eq("user_id", authData.user.id);
      if (subscriptionError) throw subscriptionError;
      if (!subscriptions?.length) return json({ error: "No phone is registered to this account yet. Register this device first." }, 409);

      const { data: testSecrets, error: testSecretError } = await admin.rpc("resa_get_push_secrets");
      if (testSecretError) throw testSecretError;
      const testPublicKey = String(testSecrets?.resa_push_vapid_public_key || "");
      const testPrivateKey = String(testSecrets?.resa_push_vapid_private_key || "");
      if (!testPublicKey || !testPrivateKey) return json({ error: "VAPID keys are not configured." }, 503);
      webpush.setVapidDetails("mailto:rhemaexploitsacademy@gmail.com", testPublicKey, testPrivateKey);
      const testPayload = JSON.stringify({
        title: "RESA · Phone notification test",
        body: "Your phone is registered. RESA push notifications are reaching this device.",
        url: "/notifications",
        tag: "resa-push-test-" + crypto.randomUUID(),
        icon: "/media/logo/resa-logo.jpg",
        badge: "/favicon.ico",
        vibrate: [180, 90, 180],
      });
      let sent = 0;
      let expired = 0;
      const testResults = await Promise.allSettled(subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          }, testPayload, { TTL: 300, urgency: "high" });
          sent += 1;
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("resa_push_subscriptions").delete().eq("id", subscription.id);
            expired += 1;
            return;
          }
          throw error;
        }
      }));
      const failures = testResults.filter((result) => result.status === "rejected").length;
      return json({ accepted: true, sent, devices: subscriptions.length, expired, failures });
    }

    if (!["school_message", "chat_message", "attendance", "announcement"].includes(eventType)) {
      return json({ error: "Unsupported notification event" }, 400);
    }

    const { data: secrets, error: secretError } = await admin.rpc("resa_get_push_secrets");
    if (secretError) throw secretError;
    const expectedToken = String(secrets?.resa_push_webhook_token || "");
    const suppliedToken = request.headers.get("x-resa-push-token") || "";
    if (!expectedToken || suppliedToken.length !== expectedToken.length || suppliedToken !== expectedToken) {
      return json({ error: "Unauthorised notification event" }, 401);
    }

    const publicKey = String(secrets?.resa_push_vapid_public_key || "");
    const privateKey = String(secrets?.resa_push_vapid_private_key || "");
    if (!publicKey || !privateKey) return json({ error: "VAPID keys are not configured" }, 503);

    const recipientIds = await resolveRecipients(eventType, row);
    if (!recipientIds.length) return json({ accepted: true, recipients: 0, sent: 0 });

    const schoolId = String(row.school_id || "");
    const { data: preferences, error: preferenceError } = await admin
      .from("resa_notification_preferences")
      .select("user_id,enabled,phone_notifications_enabled")
      .eq("school_id", schoolId)
      .in("user_id", recipientIds)
      .eq("enabled", true)
      .eq("phone_notifications_enabled", true);
    if (preferenceError) throw preferenceError;
    const optedIn = uniqueIds((preferences || []).map((item) => item.user_id));
    if (!optedIn.length) return json({ accepted: true, recipients: recipientIds.length, devices: 0, sent: 0 });

    const { data: subscriptions, error: subscriptionError } = await admin
      .from("resa_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth_key")
      .eq("school_id", schoolId)
      .in("user_id", optedIn);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ accepted: true, recipients: optedIn.length, devices: 0, sent: 0 });

    webpush.setVapidDetails("mailto:rhemaexploitsacademy@gmail.com", publicKey, privateKey);
    const notice = makeNotification(eventType, row);
    const payload = JSON.stringify({
      ...notice,
      icon: "/media/logo/resa-logo.jpg",
      badge: "/favicon.ico",
      vibrate: [180, 90, 180],
    });

    let sent = 0;
    let expired = 0;
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
        }, payload, { TTL: 3600, urgency: "high" });
        sent += 1;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("resa_push_subscriptions").delete().eq("id", subscription.id);
          expired += 1;
          return;
        }
        throw error;
      }
    }));
    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures) console.error("RESA push delivery failures:", failures);
    return json({ accepted: true, recipients: optedIn.length, devices: subscriptions.length, sent, expired, failures });
  } catch (error) {
    console.error("RESA push dispatch failed:", error);
    return json({ error: error instanceof Error ? error.message : "Push dispatch failed" }, 500);
  }
});
