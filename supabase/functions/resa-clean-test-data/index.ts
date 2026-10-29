import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Only these explicitly tracked tables can be deleted. School settings, classes,
// subjects, school records, owner records and administrator accounts are excluded.
const DELETE_ORDER = [
  "online_exam_answers", "online_exam_attempts", "online_exam_questions",
  "student_subject_results", "student_term_results", "assessment_scores",
  "student_attendance", "student_enrollments", "student_portal_accounts",
  "teacher_assignments", "assignment_submissions", "student_parent_guardians",
  "parent_student_portal_access", "parent_portal_accounts",
  "biometric_parent_notifications", "biometric_attendance_events",
  "school_event_participants", "school_events", "school_messages", "announcements",
  "online_exams", "assignments", "assessments", "academic_terms",
  "staff_attendance", "biometric_devices", "parents_guardians",
  "staff", "students", "people", "school_memberships", "profiles",
];
const ALLOWED_TABLES = new Set(DELETE_ORDER);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST required." });
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return reply(401, { error: "Sign in as a RESA administrator first." });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: bearer } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(bearer.slice(7));
  const user = userData?.user;
  if (userError || !user?.id) return reply(401, { error: "Your session is invalid. Sign in again." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership, error: membershipError } = await admin.from("school_memberships")
    .select("role,status").eq("school_id", SCHOOL_ID).eq("user_id", user.id)
    .eq("role", "admin").eq("status", "active").maybeSingle();
  if (membershipError || !membership) return reply(403, { error: "Only an active RESA school administrator can clean up test data." });

  let body: { dry_run?: unknown; confirmation?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const dryRun = body.dry_run !== false;
  if (!dryRun && body.confirmation !== "CLEAN RESA TEST DATA") {
    return reply(400, { error: "Explicit confirmation is required. No records were deleted." });
  }

  const { data: markers, error: markerError } = await admin.from("resa_test_data_records")
    .select("id,entity_table,entity_id,entity_type")
    .eq("school_id", SCHOOL_ID);
  if (markerError) return reply(500, { error: "Could not read the test-data cleanup register. No records were deleted." });
  const rows = markers ?? [];
  const countIds: Record<string, Set<string>> = {};
  for (const row of rows) {
    if (row.entity_type === "test_run_created_by") continue;
    if (!countIds[row.entity_table]) countIds[row.entity_table] = new Set<string>();
    countIds[row.entity_table].add(row.entity_id);
  }
  const counts: Record<string, number> = Object.fromEntries(
    Object.entries(countIds).map(([table, ids]) => [table, ids.size]),
  );
  const uniqueAuthIds = [...new Set(rows
    .filter((row: any) => row.entity_table === "auth.users" && ["test_auth_user", "legacy_test_auth_user"].includes(row.entity_type))
    .map((row: any) => row.entity_id))];
  if (dryRun) {
    return reply(200, {
      success: true, dry_run: true,
      message: "Preview only. No data has been deleted. The cleanup targets tracked test records and preserves RESA classes, subjects, settings, school/owner records, and administrator accounts.",
      trackedMarkerRows: rows.length,
      uniqueTestLoginAccounts: uniqueAuthIds.length,
      counts,
      requiredConfirmation: "CLEAN RESA TEST DATA",
    });
  }

  const errors: string[] = [];
  const deletedCounts: Record<string, number> = {};
  for (const table of DELETE_ORDER) {
    const ids = [...new Set(rows.filter((row: any) => row.entity_table === table && row.entity_type !== "test_run_created_by").map((row: any) => row.entity_id))];
    if (!ids.length) continue;
    const { data, error } = await admin.from(table).delete().in("id", ids).select("id");
    if (error) {
      errors.push(`${table}: ${error.message}`);
    } else {
      deletedCounts[table] = data?.length ?? 0;
    }
  }

  for (const id of uniqueAuthIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found|does not exist|user not found/i.test(error.message)) errors.push(`auth.users: ${error.message}`);
  }

  if (errors.length) {
    console.error("RESA test cleanup had errors:", errors);
    return reply(500, {
      success: false, partial: true,
      message: "Some tracked test records may remain. The cleanup register was retained so the administrator can safely retry.",
      deletedCounts, errors,
    });
  }

  const { error: clearMarkersError } = await admin.from("resa_test_data_records").delete().eq("school_id", SCHOOL_ID);
  if (clearMarkersError) {
    return reply(500, { success: false, partial: true, message: "Test records were deleted, but cleanup markers remain. Retrying is safe.", deletedCounts });
  }

  return reply(200, {
    success: true, dry_run: false,
    message: "Tracked test data has been removed. RESA classes, subjects, settings, school/owner records and administrator accounts were preserved.",
    deletedCounts, deletedLoginAccounts: uniqueAuthIds.length,
  });
});
