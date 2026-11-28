import { createClient, type User } from "npm:@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "npm:@simplewebauthn/server@13.3.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://school-platform-foundation.pages.dev";
const RP_NAME = "RESA School Portal";
const RP_ID = "school-platform-foundation.pages.dev";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type IdentityType = "student" | "teacher" | "staff" | "parent" | "admin" | "proprietor";
type Activity = "school_arrival" | "school_departure" | "work_arrival" | "work_departure" | "school_visit" | "school_visit_exit";
type EventType = "check_in" | "check_out";
type Identity = { person_type: IdentityType; person_id: string | null; display_label: string; allowed_activities: Activity[] };

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function reply(status: number, body: Record<string, unknown>, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedUser(req: Request): Promise<User> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Sign in to your RESA account first.");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Your RESA session is invalid or has expired. Sign in again.");
  return data.user;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function ipHash(req: Request): Promise<string | null> {
  const raw = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!raw) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function enforceRateLimit(admin: ReturnType<typeof adminClient>, req: Request, purpose: string, userId?: string) {
  const hash = await ipHash(req);
  if (!hash) return;
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let query = admin.from("resa_passkey_challenges")
    .select("id", { count: "exact", head: true })
    .eq("purpose", purpose)
    .eq("request_ip_hash", hash)
    .gt("created_at", since);
  if (userId) query = query.eq("user_id", userId);
  const { count, error } = await query;
  if (error) throw new Error("Passkey security checks are temporarily unavailable.");
  if ((count ?? 0) >= 12) throw new Error("Too many passkey attempts. Wait a few minutes and try again.");
}

async function saveChallenge(
  admin: ReturnType<typeof adminClient>,
  values: {
    user_id?: string | null;
    purpose: "registration" | "authentication" | "attendance";
    challenge: string;
    school_id?: string | null;
    person_type?: IdentityType | null;
    person_id?: string | null;
    activity?: Activity | null;
    event_type?: EventType | null;
    request_ip_hash?: string | null;
  },
) {
  const { data, error } = await admin.from("resa_passkey_challenges").insert({
    ...values,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  }).select("id").single();
  if (error || !data?.id) throw new Error("A secure passkey challenge could not be created.");
  return data.id as string;
}

async function consumeChallenge(
  admin: ReturnType<typeof adminClient>,
  id: unknown,
  purpose: "registration" | "authentication" | "attendance",
  userId?: string,
) {
  if (!isUuid(id)) throw new Error("The passkey request has expired. Start again.");
  const now = new Date().toISOString();
  let query = admin.from("resa_passkey_challenges")
    .update({ consumed_at: now })
    .eq("id", id)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .gt("expires_at", now);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) throw new Error("The passkey request has expired or has already been used. Start again.");
  return data as Record<string, any>;
}

function allowedActivities(type: IdentityType): Activity[] {
  if (type === "student") return ["school_arrival", "school_departure"];
  if (type === "parent") return ["school_visit", "school_visit_exit"];
  return ["work_arrival", "work_departure"];
}

function expectedEvent(activity: Activity): EventType {
  return activity === "school_arrival" || activity === "work_arrival" || activity === "school_visit"
    ? "check_in"
    : "check_out";
}

async function resolveIdentities(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  schoolId: string,
): Promise<Identity[]> {
  const identities: Identity[] = [];
  const add = (identity: Identity) => {
    if (!identities.some((item) => item.person_type === identity.person_type && item.person_id === identity.person_id)) {
      identities.push(identity);
    }
  };

  const [memberships, proprietor, studentAccounts, directStudents, staffRows, parentAccounts, people] = await Promise.all([
    admin.from("school_memberships").select("role").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active"),
    admin.from("school_payment_gateway_proprietors").select("user_id").eq("school_id", schoolId).eq("user_id", userId).maybeSingle(),
    admin.from("student_portal_accounts").select("student_id").eq("school_id", schoolId).eq("user_id", userId).eq("is_active", true),
    admin.from("students").select("id").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active"),
    admin.from("staff").select("id,staff_category").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active"),
    admin.from("parent_portal_accounts").select("parent_guardian_id").eq("school_id", schoolId).eq("user_id", userId).eq("is_active", true),
    admin.from("people").select("id,first_name,last_name").eq("school_id", schoolId).eq("user_id", userId).limit(10),
  ]);
  for (const result of [memberships, proprietor, studentAccounts, directStudents, staffRows, parentAccounts, people]) {
    if (result.error) throw new Error("RESA could not verify the account's school identity.");
  }

  const roles = new Set((memberships.data ?? []).map((row: any) => row.role));
  if (proprietor.data) add({ person_type: "proprietor", person_id: null, display_label: "School proprietor", allowed_activities: allowedActivities("proprietor") });
  if (roles.has("admin")) add({ person_type: "admin", person_id: null, display_label: "School administrator", allowed_activities: allowedActivities("admin") });

  const studentIds = new Set<string>();
  for (const row of studentAccounts.data ?? []) studentIds.add(row.student_id);
  for (const row of directStudents.data ?? []) studentIds.add(row.id);

  const staffById = new Map<string, string>();
  for (const row of staffRows.data ?? []) staffById.set(row.id, row.staff_category ?? "unclassified");

  for (const person of people.data ?? []) {
    const [studentsByPerson, staffByPerson, guardiansByPerson] = await Promise.all([
      admin.from("students").select("id").eq("school_id", schoolId).eq("person_id", person.id).eq("status", "active"),
      admin.from("staff").select("id,staff_category").eq("school_id", schoolId).eq("person_id", person.id).eq("status", "active"),
      admin.from("parents_guardians").select("id").eq("school_id", schoolId).eq("person_id", person.id),
    ]);
    if (studentsByPerson.error || staffByPerson.error || guardiansByPerson.error) throw new Error("RESA could not verify the linked school identity.");
    for (const row of studentsByPerson.data ?? []) studentIds.add(row.id);
    for (const row of staffByPerson.data ?? []) staffById.set(row.id, row.staff_category ?? "unclassified");
    for (const guardian of guardiansByPerson.data ?? []) {
      const linked = (parentAccounts.data ?? []).some((row: any) => row.parent_guardian_id === guardian.id);
      if (linked) add({ person_type: "parent", person_id: guardian.id, display_label: "Parent / guardian", allowed_activities: allowedActivities("parent") });
    }
  }

  for (const studentId of studentIds) {
    add({ person_type: "student", person_id: studentId, display_label: "Student attendance", allowed_activities: allowedActivities("student") });
  }
  for (const [staffId, category] of staffById) {
    const type: IdentityType = category === "academic" ? "teacher" : "staff";
    add({ person_type: type, person_id: staffId, display_label: type === "teacher" ? "Teacher attendance" : "Staff attendance", allowed_activities: allowedActivities(type) });
  }
  for (const row of parentAccounts.data ?? []) {
    add({ person_type: "parent", person_id: row.parent_guardian_id, display_label: "Parent / guardian", allowed_activities: allowedActivities("parent") });
  }

  return identities;
}

function attendanceDateInNigeria(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const configuredDevOrigins = (Deno.env.get("RESA_PASSKEY_DEV_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const allowedOrigins = new Set([APP_ORIGIN, ...configuredDevOrigins]);
  if (!origin || !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "This RESA sign-in origin is not authorised." }), {
      status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required." }), { status: 405, headers });
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 512_000) return new Response(JSON.stringify({ error: "Passkey response is too large." }), { status: 413, headers });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "The RESA passkey service is not configured." }), { status: 503, headers });
  }

  const admin = adminClient();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== "string") return new Response(JSON.stringify({ error: "A valid passkey action is required." }), { status: 400, headers });
    const action = body.action as string;
    const requestOrigin = origin;
    const rpId = new URL(origin).hostname;
    if (rpId !== RP_ID && !configuredDevOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: "This passkey domain is not authorised." }), { status: 403, headers });
    }

    if (action === "authentication-options") {
      await enforceRateLimit(admin, req, "authentication");
      const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: "required", timeout: 60_000 });
      const challengeId = await saveChallenge(admin, {
        purpose: "authentication", challenge: options.challenge, request_ip_hash: await ipHash(req),
      });
      return new Response(JSON.stringify({ options, challenge_id: challengeId }), { status: 200, headers });
    }

    if (action === "authentication-verify") {
      const challenge = await consumeChallenge(admin, body.challenge_id, "authentication");
      if (!body.response || typeof body.response.id !== "string") throw new Error("The passkey response is incomplete.");
      const { data: credential, error: credentialError } = await admin.from("resa_passkey_credentials")
        .select("id,user_id,credential_id,public_key,signature_counter,transports")
        .eq("credential_id", body.response.id).is("revoked_at", null).maybeSingle();
      if (credentialError || !credential) throw new Error("This passkey is not registered or has been revoked.");
      const verification = await verifyAuthenticationResponse({
        response: body.response as AuthenticationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: requestOrigin,
        expectedRPID: rpId,
        credential: {
          id: credential.credential_id,
          publicKey: base64UrlDecode(credential.public_key),
          counter: Number(credential.signature_counter),
          transports: credential.transports ?? [],
        },
        requireUserVerification: true,
      });
      if (!verification.verified) throw new Error("Passkey verification failed.");
      const { error: updateError } = await admin.from("resa_passkey_credentials").update({
        signature_counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      }).eq("id", credential.id).eq("user_id", credential.user_id).is("revoked_at", null);
      if (updateError) throw new Error("The verified passkey could not be updated.");

      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(credential.user_id);
      if (authUserError || !authUser.user?.email) throw new Error("This RESA account needs a registered email address before passkey sign-in can be used.");
      const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink", email: authUser.user.email,
      });
      const tokenHash = (generated as any)?.properties?.hashed_token;
      if (linkError || typeof tokenHash !== "string" || !tokenHash) throw new Error("Passkey verified, but a secure RESA session could not be created. Use your password and contact the administrator.");
      return new Response(JSON.stringify({ success: true, token_hash: tokenHash }), { status: 200, headers });
    }

    if (action === "register-options" || action === "list" || action === "revoke" || action === "identity" || action === "attendance-options" || action === "attendance-verify") {
      const user = await authenticatedUser(req);

      if (action === "list") {
        const { data, error } = await admin.from("resa_passkey_credentials")
          .select("id,label,device_type,backed_up,created_at,last_used_at,revoked_at")
          .eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw new Error("Your registered passkeys could not be loaded.");
        return new Response(JSON.stringify({ credentials: data ?? [] }), { status: 200, headers });
      }

      if (action === "revoke") {
        if (!isUuid(body.credential_record_id)) throw new Error("Choose a valid passkey to revoke.");
        const { data, error } = await admin.from("resa_passkey_credentials").update({ revoked_at: new Date().toISOString() })
          .eq("id", body.credential_record_id).eq("user_id", user.id).is("revoked_at", null)
          .select("id").maybeSingle();
        if (error || !data) throw new Error("This passkey could not be revoked. Refresh the list and try again.");
        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
      }

      if (action === "register-options") {
        await enforceRateLimit(admin, req, "registration", user.id);
        const { data: credentials, error } = await admin.from("resa_passkey_credentials")
          .select("credential_id,transports").eq("user_id", user.id).is("revoked_at", null);
        if (error) throw new Error("Your existing passkeys could not be checked.");
        const displayName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "RESA user").slice(0, 80);
        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID: rpId,
          userID: new TextEncoder().encode(user.id),
          userName: user.email ?? user.id,
          userDisplayName: displayName,
          attestationType: "none",
          timeout: 60_000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "required",
            userVerification: "required",
          },
          excludeCredentials: (credentials ?? []).map((item: any) => ({
            id: item.credential_id,
            transports: item.transports ?? [],
          })),
        });
        const challengeId = await saveChallenge(admin, {
          user_id: user.id, purpose: "registration", challenge: options.challenge,
          request_ip_hash: await ipHash(req),
        });
        return new Response(JSON.stringify({ options, challenge_id: challengeId }), { status: 200, headers });
      }

      if (action === "identity") {
        if (!isUuid(body.school_id)) throw new Error("Choose a valid RESA school.");
        const identities = await resolveIdentities(admin, user.id, body.school_id);
        return new Response(JSON.stringify({ identities }), { status: 200, headers });
      }

      if (action === "attendance-options") {
        if (!isUuid(body.school_id) || typeof body.person_type !== "string" || typeof body.activity !== "string" || typeof body.event_type !== "string") {
          throw new Error("Choose your school identity and attendance action.");
        }
        const identities = await resolveIdentities(admin, user.id, body.school_id);
        const identity = identities.find((item) =>
          item.person_type === body.person_type && item.person_id === (isUuid(body.person_id) ? body.person_id : null)
        );
        if (!identity) throw new Error("This identity is not linked to your active RESA account.");
        const activity = body.activity as Activity;
        if (!identity.allowed_activities.includes(activity) || expectedEvent(activity) !== body.event_type) {
          throw new Error("That attendance action is not permitted for this account category.");
        }
        const { data: credentials, error } = await admin.from("resa_passkey_credentials")
          .select("credential_id,transports").eq("user_id", user.id).is("revoked_at", null);
        if (error || !credentials?.length) throw new Error("Register a passkey before recording attendance.");
        const options = await generateAuthenticationOptions({
          rpID: rpId,
          userVerification: "required",
          timeout: 60_000,
          allowCredentials: credentials.map((item: any) => ({ id: item.credential_id, transports: item.transports ?? [] })),
        });
        const challengeId = await saveChallenge(admin, {
          user_id: user.id, purpose: "attendance", challenge: options.challenge,
          school_id: body.school_id, person_type: identity.person_type, person_id: identity.person_id,
          activity, event_type: body.event_type as EventType, request_ip_hash: await ipHash(req),
        });
        return new Response(JSON.stringify({ options, challenge_id: challengeId }), { status: 200, headers });
      }

      if (action === "attendance-verify") {
        const challenge = await consumeChallenge(admin, body.challenge_id, "attendance", user.id);
        if (!body.response || typeof body.response.id !== "string") throw new Error("The attendance passkey response is incomplete.");
        const { data: credential, error: credentialError } = await admin.from("resa_passkey_credentials")
          .select("id,user_id,credential_id,public_key,signature_counter,transports")
          .eq("user_id", user.id).eq("credential_id", body.response.id).is("revoked_at", null).maybeSingle();
        if (credentialError || !credential) throw new Error("This passkey is not registered or has been revoked.");
        const verification = await verifyAuthenticationResponse({
          response: body.response as AuthenticationResponseJSON,
          expectedChallenge: challenge.challenge,
          expectedOrigin: requestOrigin,
          expectedRPID: rpId,
          credential: {
            id: credential.credential_id,
            publicKey: base64UrlDecode(credential.public_key),
            counter: Number(credential.signature_counter),
            transports: credential.transports ?? [],
          },
          requireUserVerification: true,
        });
        if (!verification.verified) throw new Error("Passkey verification failed.");
        const { error: updateError } = await admin.from("resa_passkey_credentials").update({
          signature_counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        }).eq("id", credential.id).eq("user_id", user.id).is("revoked_at", null);
        if (updateError) throw new Error("The verified passkey could not be updated.");

        const { data: recorded, error: recordError } = await admin.rpc("resa_record_passkey_attendance", {
          p_school_id: challenge.school_id,
          p_user_id: user.id,
          p_person_type: challenge.person_type,
          p_person_id: challenge.person_id,
          p_activity: challenge.activity,
          p_event_type: challenge.event_type,
          p_credential_id: credential.credential_id,
          p_device_label: String(body.device_label ?? "").slice(0, 80),
        });
        if (recordError) throw new Error(recordError.message || "RESA could not record this attendance action.");
        return new Response(JSON.stringify({ success: true, attendance: recorded }), { status: 200, headers });
      }
    }

    if (action === "registration-verify") {
      const user = await authenticatedUser(req);
      const challenge = await consumeChallenge(admin, body.challenge_id, "registration", user.id);
      if (!body.response || typeof body.response.id !== "string") throw new Error("The registration response is incomplete.");
      const verification = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: requestOrigin,
        expectedRPID: rpId,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) throw new Error("The passkey could not be verified.");
      const info = verification.registrationInfo;
      const credential = info.credential;
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "My device";
      const { data, error } = await admin.from("resa_passkey_credentials").insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: base64UrlEncode(credential.publicKey),
        signature_counter: credential.counter,
        transports: credential.transports ?? [],
        device_type: info.credentialDeviceType,
        backed_up: info.credentialBackedUp,
        label: label || "My device",
      }).select("id").single();
      if (error || !data) throw new Error("This passkey could not be saved. It may already be registered.");
      return new Response(JSON.stringify({ success: true, credential_record_id: data.id }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unsupported passkey action." }), { status: 400, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The passkey request could not be completed.";
    const status = /too many passkey attempts/i.test(message) ? 429
      : /sign in|session is invalid/i.test(message) ? 401
      : /expired|already been used/i.test(message) ? 410
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
