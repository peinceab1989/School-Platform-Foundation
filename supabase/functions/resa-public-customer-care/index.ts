import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const allowedOrigins = new Set([
  "https://school-platform-foundation.pages.dev",
  "https://resa-school-portal.netlify.app",
  "https://resa-digital-campus.pages.dev",
  "https://jetab-tech.pages.dev",
  "http://localhost:5173",
]);
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://school-platform-foundation.pages.dev",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
});
const reply = (status: number, data: unknown, origin: string | null) =>
  new Response(JSON.stringify(data), { status, headers: headers(origin) });
async function sha(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
async function adminFrom(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: membership } = await service.from("school_memberships")
    .select("user_id,role,status").eq("school_id", SCHOOL_ID).eq("user_id", user.id)
    .eq("status", "active").maybeSingle();
  if (!membership || membership.role !== "admin") return null;
  return user.id;
}
async function assignedAdmin(duty: string) {
  const exact = await service.from("resa_customer_care_assignments").select("admin_user_id")
    .eq("school_id",SCHOOL_ID).eq("enabled",true).eq("duty_key",duty).maybeSingle();
  const allAccess = exact.data ? null : await service.from("resa_customer_care_assignments").select("admin_user_id")
    .eq("school_id",SCHOOL_ID).eq("enabled",true).eq("duty_key","all").maybeSingle();
  const candidate = exact.data?.admin_user_id || allAccess?.data?.admin_user_id;
  if (candidate) {
    const { data: active } = await service.from("school_memberships").select("user_id")
      .eq("school_id", SCHOOL_ID).eq("user_id", candidate).eq("role", "admin").eq("status", "active").maybeSingle();
    if (active) return candidate;
  }
  const { data: settings } = await service.from("resa_customer_care_settings")
    .select("chief_admin_user_id").eq("school_id", SCHOOL_ID).maybeSingle();
  const chief = settings?.chief_admin_user_id;
  if (!chief) return null;
  const { data: activeChief } = await service.from("school_memberships").select("user_id")
    .eq("school_id", SCHOOL_ID).eq("user_id", chief).eq("role", "admin").eq("status", "active").maybeSingle();
  return activeChief?.user_id ?? null;
}
async function rateLimit(fingerprint: string, action: string, max: number, seconds: number) {
  const { data, error } = await service.rpc("resa_public_care_consume_rate_limit", {
    p_fingerprint_hash: fingerprint,
    p_action_key: action,
    p_max: max,
    p_window_seconds: seconds,
  });
  if (error) throw error;
  return data === true;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: "Origin not allowed" }, origin);
  try {
    const body = await req.json();
    const action = cleanText(body.action, 30);
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const fingerprint = await sha(ip + ":" + (req.headers.get("user-agent") || "unknown"));
    if (action === "visitor_start") {
      if (!(await rateLimit(fingerprint, "start", 5, 3600))) return reply(429, { error: "Please wait before starting another chat." }, origin);
      const name = cleanText(body.name, 100);
      const email = cleanText(body.email, 254);
      const message = cleanText(body.message, 5000);
      const token = cleanText(body.token, 100);
      const duty = ["general","fees","admissions","cbt","results","attendance","technical"].includes(body.duty) ? body.duty : "general";
      if (name.length < 2 || !message || !/^[0-9a-f-]{36}$/i.test(token)) return reply(400, { error: "Enter your name and message to start a chat." }, origin);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Enter a valid email address or leave it blank." }, origin);
      const admin = await assignedAdmin(duty);
      if (!admin) return reply(503, { error: "Customer Care is temporarily unavailable. Please use the school contact details." }, origin);
      const tokenHash = await sha(token);
      const { data: conversation, error } = await service.from("resa_public_care_conversations").insert({
        school_id: SCHOOL_ID, visitor_name: name, visitor_email: email || null,
        visitor_token_hash: tokenHash, assigned_admin_id: admin, duty_key: duty, last_message_sender_kind: "visitor",
      }).select("id").single();
      if (error) throw error;
      const { error: messageError } = await service.from("resa_public_care_messages").insert({
        conversation_id: conversation.id, sender_kind: "visitor", body: message,
      });
      if (messageError) throw messageError;
      await service.from("resa_public_care_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
      return reply(200, { conversation_id: conversation.id, token }, origin);
    }
    if (action === "visitor_send" || action === "visitor_poll") {
      const id = cleanText(body.conversation_id, 100);
      const token = cleanText(body.token, 100);
      if (!id || !/^[0-9a-f-]{36}$/i.test(token)) return reply(400, { error: "Invalid conversation credentials." }, origin);
      if (action === "visitor_poll" && !(await rateLimit(fingerprint,"poll",120,600))) return reply(429,{error:"Please wait a moment before refreshing the conversation."},origin);
      const tokenHash = await sha(token);
      const { data: conversation } = await service.from("resa_public_care_conversations")
        .select("id,status,visitor_token_hash").eq("id", id).eq("visitor_token_hash", tokenHash).maybeSingle();
      if (!conversation) return reply(404, { error: "Conversation not found." }, origin);
      let currentStatus = conversation.status;
      if (action === "visitor_send") {
        if (!(await rateLimit(fingerprint, "message", 20, 600))) return reply(429, { error: "Please slow down before sending another message." }, origin);
        const message = cleanText(body.message, 5000);
        if (!message || conversation.status === "closed") return reply(400, { error: "This conversation is closed. Start a new conversation with RESA Customer Care." }, origin);
        const { error } = await service.from("resa_public_care_messages").insert({ conversation_id: id, sender_kind: "visitor", body: message });
        if (error) throw error;
        const { error: updateError } = await service.from("resa_public_care_conversations").update({
          status: "open", last_message_sender_kind: "visitor",
          last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", id);
        if (updateError) throw updateError;
        currentStatus = "open";
      }
      const { data: messages, error } = await service.from("resa_public_care_messages")
        .select("id,sender_kind,body,created_at").eq("conversation_id", id).order("created_at").limit(100);
      if (error) throw error;
      return reply(200, { messages, status: currentStatus }, origin);
    }
    if (["admin_list","admin_view","admin_reply","admin_close","admin_reopen","admin_unread_count","admin_notifications"].includes(action)) {
      const adminId = await adminFrom(req);
      if (!adminId) return reply(401, { error: "An active RESA administrator account is required." }, origin);
      const { data: settings, error: settingsError } = await service.from("resa_customer_care_settings")
        .select("chief_admin_user_id").eq("school_id",SCHOOL_ID).maybeSingle();
      if (settingsError) throw settingsError;
      const isChief = settings?.chief_admin_user_id === adminId;

      const unreadQuery = async () => {
        let query = service.from("resa_public_care_conversations")
           .select("id,visitor_name,visitor_email,duty_key,status,created_at,last_message_at,last_admin_read_at,last_message_sender_kind,unread_visitor_count")
          .eq("school_id",SCHOOL_ID).neq("status","closed").eq("last_message_sender_kind","visitor");
        if (!isChief) query = query.eq("assigned_admin_id",adminId);
        const { data, error } = await query.order("last_message_at",{ascending:false}).limit(200);
        if (error) throw error;
        return (data || []).filter((row:any) => !row.last_admin_read_at || new Date(row.last_message_at).getTime() > new Date(row.last_admin_read_at).getTime());
      };

      if (action === "admin_unread_count") {
        const unread = await unreadQuery();
        const count = unread.reduce((total:any,row:any)=>total+Number(row.unread_visitor_count||0),0);
        return reply(200,{count},origin);
      }
      if (action === "admin_notifications") {
        const unread = await unreadQuery();
        return reply(200,{conversations:unread.slice(0,100)},origin);
      }
      if (action === "admin_list") {
        let query = service.from("resa_public_care_conversations")
          .select("id,visitor_name,visitor_email,duty_key,status,created_at,last_message_at,last_message_sender_kind,last_admin_read_at,unread_visitor_count")
          .eq("school_id",SCHOOL_ID);
        if (body.include_closed !== true) query = query.neq("status","closed");
        if (!isChief) query = query.eq("assigned_admin_id",adminId);
        const { data, error } = await query.order("last_message_at",{ascending:false}).limit(200);
        if (error) throw error;
        return reply(200,{conversations:data},origin);
      }

      const id = cleanText(body.conversation_id, 100);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(400,{error:"Invalid conversation reference."},origin);
      let conversationQuery = service.from("resa_public_care_conversations")
        .select("id,status,assigned_admin_id").eq("id",id).eq("school_id",SCHOOL_ID);
      if (!isChief) conversationQuery = conversationQuery.eq("assigned_admin_id",adminId);
      const { data: conversation, error: conversationError } = await conversationQuery.maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) return reply(404, { error: "Assigned visitor conversation not found." }, origin);

      if (action === "admin_view") {
        const { error: readError } = await service.from("resa_public_care_conversations")
          .update({last_admin_read_at:new Date().toISOString(),unread_visitor_count:0}).eq("id",id);
        if (readError) throw readError;
        const { data, error } = await service.from("resa_public_care_messages")
          .select("id,sender_kind,sender_admin_id,body,created_at").eq("conversation_id",id).order("created_at").limit(100);
        if (error) throw error;
        return reply(200,{messages:data,status:conversation.status},origin);
      }
      if (action === "admin_close" || action === "admin_reopen") {
        const nextStatus = action === "admin_close" ? "closed" : "open";
        const { error } = await service.from("resa_public_care_conversations")
          .update({status:nextStatus,updated_at:new Date().toISOString()}).eq("id",id);
        if (error) throw error;
        return reply(200,{ok:true,status:nextStatus},origin);
      }
      const message = cleanText(body.message, 5000);
      if (!message) return reply(400, { error: "Enter a reply before sending." }, origin);
      if (conversation.status === "closed") return reply(409,{error:"This conversation is closed. Reopen it before replying."},origin);
      const { error } = await service.from("resa_public_care_messages").insert({
        conversation_id: id, sender_kind: "admin", sender_admin_id: adminId, body: message,
      });
      if (error) throw error;
      const { error: updateError } = await service.from("resa_public_care_conversations").update({
        status: "waiting", last_message_sender_kind: "admin",
        last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (updateError) throw updateError;
      return reply(200, { ok: true }, origin);
    }
    return reply(400, { error: "Unknown action." }, origin);
  } catch (error) {
    console.error("resa-public-customer-care", error);
    return reply(500, { error: "Customer Care could not complete that request. Please try again." }, origin);
  }
});
