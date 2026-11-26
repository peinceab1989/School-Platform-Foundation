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
  const { data: assignment } = await service.from("resa_customer_care_assignments")
    .select("admin_user_id").eq("school_id", SCHOOL_ID).eq("enabled", true)
    .in("duty_key", [duty, "all"]).order("duty_key", { ascending: true }).limit(1).maybeSingle();
  const candidate = assignment?.admin_user_id;
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
  const since = new Date(Date.now() - seconds * 1000).toISOString();
  const { count } = await service.from("resa_public_care_rate_limits").select("id", { count: "exact", head: true })
    .eq("fingerprint_hash", fingerprint).eq("action_key", action).gte("created_at", since);
  if ((count ?? 0) >= max) return false;
  await service.from("resa_public_care_rate_limits").insert({ fingerprint_hash: fingerprint, action_key: action });
  return true;
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
        visitor_token_hash: tokenHash, assigned_admin_id: admin, duty_key: duty,
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
      const tokenHash = await sha(token);
      const { data: conversation } = await service.from("resa_public_care_conversations")
        .select("id,status,visitor_token_hash").eq("id", id).eq("visitor_token_hash", tokenHash).maybeSingle();
      if (!conversation) return reply(404, { error: "Conversation not found." }, origin);
      if (action === "visitor_send") {
        if (!(await rateLimit(fingerprint, "message", 20, 600))) return reply(429, { error: "Please slow down before sending another message." }, origin);
        const message = cleanText(body.message, 5000);
        if (!message || conversation.status === "closed") return reply(400, { error: "This conversation cannot accept a new message." }, origin);
        const { error } = await service.from("resa_public_care_messages").insert({ conversation_id: id, sender_kind: "visitor", body: message });
        if (error) throw error;
        await service.from("resa_public_care_conversations").update({ status: "open", last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      }
      const { data: messages, error } = await service.from("resa_public_care_messages")
        .select("id,sender_kind,body,created_at").eq("conversation_id", id).order("created_at").limit(100);
      if (error) throw error;
      return reply(200, { messages, status: conversation.status }, origin);
    }
    if (action === "admin_list" || action === "admin_view" || action === "admin_reply" || action === "admin_close") {
      const adminId = await adminFrom(req);
      if (!adminId) return reply(401, { error: "An active RESA administrator account is required." }, origin);
      if (action === "admin_list") {
        const { data: settings } = await service.from("resa_customer_care_settings").select("chief_admin_user_id").eq("school_id",SCHOOL_ID).maybeSingle();
        let query = service.from("resa_public_care_conversations").select("id,visitor_name,visitor_email,duty_key,status,created_at,last_message_at").eq("school_id",SCHOOL_ID).neq("status","closed");
        if (settings?.chief_admin_user_id !== adminId) query = query.eq("assigned_admin_id",adminId);
        const { data, error } = await query.order("last_message_at",{ascending:false}).limit(100);
        if (error) throw error;
        return reply(200,{conversations:data},origin);
      }
      const id = cleanText(body.conversation_id, 100);
      const { data: conversation } = await service.from("resa_public_care_conversations")
        .select("id").eq("id", id).eq("assigned_admin_id", adminId).maybeSingle();
      if (!conversation) return reply(404, { error: "Assigned visitor conversation not found." }, origin);
      if (action === "admin_view") {
        const { data, error } = await service.from("resa_public_care_messages").select("id,sender_kind,sender_admin_id,body,created_at").eq("conversation_id",id).order("created_at").limit(100);
        if (error) throw error;
        return reply(200,{messages:data},origin);
      }
      if (action === "admin_close") {
        await service.from("resa_public_care_conversations").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", id);
        return reply(200, { ok: true }, origin);
      }
      const message = cleanText(body.message, 5000);
      if (!message) return reply(400, { error: "Enter a reply before sending." }, origin);
      const { error } = await service.from("resa_public_care_messages").insert({
        conversation_id: id, sender_kind: "admin", sender_admin_id: adminId, body: message,
      });
      if (error) throw error;
      await service.from("resa_public_care_conversations").update({ status: "waiting", last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      return reply(200, { ok: true }, origin);
    }
    return reply(400, { error: "Unknown action." }, origin);
  } catch (error) {
    console.error("resa-public-customer-care", error);
    return reply(500, { error: "Customer Care could not complete that request. Please try again." }, origin);
  }
});
