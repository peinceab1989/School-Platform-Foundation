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
const passwordFor = (kind: string) => `${kind}!${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}9A`;

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
  if (membershipError || !membership) return reply(403, { error: "Only an active RESA school administrator can create test accounts." });

  const { data: existing, error: existingError } = await admin.from("resa_test_data_records")
    .select("id").eq("school_id", SCHOOL_ID).eq("entity_type", "demo_account").limit(1);
  if (existingError) return reply(500, { error: "Could not check existing test data. No changes were made." });
  if (existing?.length) return reply(409, { error: "The RESA test dataset has already been created. Do not run the setup again; use the displayed credentials from the first run or the test-data cleanup process before reseeding." });

  const created: Array<{ table: string; id: string }> = [];
  const authIds: string[] = [];
  const updatedParentPeople: string[] = [];
  const updatedParentGuardians: string[] = [];
  const credentials: Array<{ role: string; name: string; username: string; password: string }> = [];
  const runId = crypto.randomUUID();

  async function insertTracked(table: string, payload: Record<string, unknown>, type: string) {
    const { data, error } = await admin.from(table).insert(payload).select("id").single();
    if (error || !data?.id) throw new Error(`Could not create ${type}: ${error?.message ?? "missing id"}`);
    created.push({ table, id: data.id });
    const { error: markerError } = await admin.from("resa_test_data_records").insert({
      school_id: SCHOOL_ID, run_id: runId, entity_table: table, entity_id: data.id, entity_type: type,
    });
    if (markerError) throw new Error(`Could not tag test record ${type}: ${markerError.message}`);
    return data.id as string;
  }

  async function makeAccount(role: "teacher" | "student", n: number, classId: string, sessionId: string, subjectIds: string[]) {
    const username = `resa.${role}${String(n).padStart(2, "0")}`;
    const password = passwordFor(role === "teacher" ? "Teach" : "Learn");
    const email = `${username}@accounts.resa.invalid`;
    const displayName = `TEST ${role === "teacher" ? "Teacher" : "Student"} ${String(n).padStart(2, "0")}`;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: displayName, account_kind: "resa_test_account" },
      app_metadata: { must_change_password: false, resa_test_account: true },
    });
    if (authError || !authData.user) throw new Error(`Could not create ${role} login ${username}: ${authError?.message ?? "missing user"}`);
    const authId = authData.user.id;
    authIds.push(authId);
    const { error: authMarkerError } = await admin.from("resa_test_data_records").insert({
      school_id: SCHOOL_ID, run_id: runId, entity_table: "auth.users", entity_id: authId, entity_type: "demo_auth_user",
    });
    if (authMarkerError) throw new Error(`Could not tag test login ${username}: ${authMarkerError.message}`);

    await insertTracked("profiles", { id: authId, display_name: displayName }, "demo_profile");

    const personId = await insertTracked("people", {
      school_id: SCHOOL_ID, user_id: authId,
      first_name: "TEST", last_name: `${role === "teacher" ? "Teacher" : "Student"} ${String(n).padStart(2, "0")}`,
      email: null, phone: null, address: "TEST DATA ONLY",
    }, "demo_person");

    await insertTracked("school_memberships", {
      school_id: SCHOOL_ID, user_id: authId, role, status: "active",
    }, "demo_account");

    if (role === "teacher") {
      const staffId = await insertTracked("staff", {
        school_id: SCHOOL_ID, person_id: personId, user_id: authId,
        staff_number: `TEST-${runId.slice(0, 4).toUpperCase()}-STAFF-${String(n).padStart(3, "0")}`,
        job_title: "Teacher (TEST)", department: "Testing", status: "active",
      }, "demo_staff");
      await insertTracked("teacher_assignments", {
        school_id: SCHOOL_ID, staff_id: staffId, academic_session_id: sessionId,
        class_id: classId, subject_id: subjectIds[(n - 1) % subjectIds.length],
      }, "demo_teacher_assignment");
    } else {
      const studentId = await insertTracked("students", {
        school_id: SCHOOL_ID, person_id: personId, user_id: authId,
        admission_number: `TEST-${runId.slice(0, 4).toUpperCase()}-${String(n).padStart(3, "0")}`,
        admission_date: new Date().toISOString().slice(0, 10), status: "active",
      }, "demo_student");
      await insertTracked("student_enrollments", {
        school_id: SCHOOL_ID, student_id: studentId, academic_session_id: sessionId,
        class_id: classId, enrollment_date: new Date().toISOString().slice(0, 10), status: "active",
      }, "demo_enrollment");
      await insertTracked("student_portal_accounts", {
        school_id: SCHOOL_ID, student_id: studentId, user_id: authId, is_active: true,
      }, "demo_student_portal_account");
      credentials.push({ role, name: displayName, username: email, password });
      return studentId;
    }
    credentials.push({ role, name: displayName, username: email, password });
    return null;
  }

  try {
    const { data: session, error: sessionError } = await admin.from("academic_sessions")
      .select("id").eq("school_id", SCHOOL_ID).eq("is_current", true).maybeSingle();
    if (sessionError || !session) throw new Error("A current academic session is required before creating test accounts.");

    const { data: primaryClass, error: classError } = await admin.from("school_classes")
      .select("id").eq("school_id", SCHOOL_ID).eq("name", "Primary 1").maybeSingle();
    if (classError || !primaryClass) throw new Error("Primary 1 class was not found.");

    const { data: classSubjectRows, error: classSubjectError } = await admin.from("class_subjects")
      .select("subject_id, subjects(id,name)").eq("class_id", primaryClass.id);
    if (classSubjectError) throw new Error("Could not load subjects assigned to Primary 1.");
    const subjects = (classSubjectRows ?? []).map((row: any) => row.subjects).filter(Boolean);
    const selectedSubjects = ["Mathematics", "English Studies"].map(name => subjects.find((s: any) => s.name === name)).filter(Boolean);
    if (selectedSubjects.length !== 2) throw new Error("Primary 1 must have Mathematics and English Studies assigned.");
    const subjectIds = selectedSubjects.map((s: any) => s.id);

    let { data: term, error: termLookupError } = await admin.from("academic_terms")
      .select("id").eq("school_id", SCHOOL_ID).eq("academic_session_id", session.id).eq("name", "Test Term (DEMO ONLY)").maybeSingle();
    if (termLookupError) throw new Error("Could not check for the test term.");
    if (!term) {
      const termId = await insertTracked("academic_terms", {
        school_id: SCHOOL_ID, academic_session_id: session.id,
        name: "Test Term (DEMO ONLY)", term_number: 2, is_current: false,
      }, "demo_term");
      term = { id: termId };
    }

    const teachers: string[] = [];
    for (let i = 1; i <= 10; i++) {
      await makeAccount("teacher", i, primaryClass.id, session.id, subjectIds);
      const staff = created.filter(x => x.table === "staff").at(-1);
      if (staff) teachers.push(staff.id);
    }

    const students: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const studentId = await makeAccount("student", i, primaryClass.id, session.id, subjectIds);
      if (studentId) students.push(studentId);
    }


    // Create isolated demo parent logins for the six explicitly labelled demo guardians.
    // The non-deliverable .invalid addresses are confirmed internally for demo sign-in only.
    const { data: parentRows, error: parentRowsError } = await admin.from("parents_guardians")
      .select("id,person_id,relationship")
      .eq("school_id", SCHOOL_ID);
    if (parentRowsError) throw new Error("Could not load demo parent records.");
    const demoPersonIds = (parentRows ?? []).map((row: any) => row.person_id);
    const { data: parentPeople, error: parentPeopleError } = demoPersonIds.length
      ? await admin.from("people").select("id,first_name,last_name,user_id")
          .eq("school_id", SCHOOL_ID).in("id", demoPersonIds)
      : { data: [], error: null };
    if (parentPeopleError) throw new Error("Could not load demo parent identity records.");
    const parentPeopleById = new Map((parentPeople ?? []).map((person: any) => [person.id, person]));
    const demoParents = (parentRows ?? [])
      .map((parent: any) => ({ ...parent, person: parentPeopleById.get(parent.person_id) }))
      .filter((parent: any) => String(parent.person?.first_name ?? "").startsWith("DEMO Parent"))
      .sort((a: any, b: any) => String(a.person.last_name).localeCompare(String(b.person.last_name)));
    if (!demoParents.length) throw new Error("No clearly labelled demo parent records were found.");
    for (let i = 0; i < demoParents.length; i++) {
      const parent = demoParents[i];
      if (parent.person.user_id) throw new Error("A demo parent record is already linked to a login. Run tracked demo cleanup before reseeding.");
      const { data: existingPortal, error: portalLookupError } = await admin.from("parent_portal_accounts")
        .select("id").eq("parent_guardian_id", parent.id).maybeSingle();
      if (portalLookupError) throw new Error("Could not verify existing demo parent portal accounts.");
      if (existingPortal) throw new Error("A demo parent portal account already exists. Run tracked demo cleanup before reseeding.");
      const { data: links, error: linksError } = await admin.from("student_parent_guardians")
        .select("student_id,is_primary").eq("school_id", SCHOOL_ID).eq("parent_guardian_id", parent.id);
      if (linksError || !links?.length) throw new Error("A demo parent has no linked demo student.");
      const email = `resa.parent${String(i + 1).padStart(2, "0")}@accounts.resa.invalid`;
      const password = passwordFor("Parent");
      const displayName = `TEST Parent ${String(i + 1).padStart(2, "0")}`;
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name: displayName, account_kind: "resa_test_account" },
        app_metadata: { must_change_password: false, resa_test_account: true },
      });
      if (authError || !authData.user) throw new Error(`Could not create demo parent login ${i + 1}: ${authError?.message ?? "missing user"}`);
      const authId = authData.user.id;
      authIds.push(authId);
      const { error: authMarkerError } = await admin.from("resa_test_data_records").insert({
        school_id: SCHOOL_ID, run_id: runId, entity_table: "auth.users",
        entity_id: authId, entity_type: "demo_auth_user",
      });
      if (authMarkerError) throw new Error("Could not register the demo parent login for safe cleanup.");
      await insertTracked("profiles", { id: authId, display_name: displayName }, "demo_profile");
      const { data: personUpdate, error: personUpdateError } = await admin.from("people")
        .update({ user_id: authId }).eq("id", parent.person_id).eq("school_id", SCHOOL_ID)
        .is("user_id", null).select("id").maybeSingle();
      if (personUpdateError || !personUpdate) throw new Error("Could not link the demo parent identity to its test login.");
      updatedParentPeople.push(parent.person_id);
      await insertTracked("school_memberships", {
        school_id: SCHOOL_ID, user_id: authId, role: "parent", status: "active",
      }, "demo_account");
      await insertTracked("parent_portal_accounts", {
        school_id: SCHOOL_ID, parent_guardian_id: parent.id, user_id: authId, is_active: true,
      }, "demo_parent_portal_account");
      const { error: guardianUpdateError } = await admin.from("parents_guardians")
        .update({ portal_enabled: true }).eq("id", parent.id).eq("school_id", SCHOOL_ID);
      if (guardianUpdateError) throw new Error("Could not enable the demo parent portal record.");
      updatedParentGuardians.push(parent.id);
      for (const link of links) {
        const { data: existingAccess, error: accessLookupError } = await admin.from("parent_student_portal_access")
          .select("id,is_active").eq("school_id", SCHOOL_ID)
          .eq("parent_guardian_id", parent.id).eq("student_id", link.student_id).maybeSingle();
        if (accessLookupError) throw new Error("Could not verify the demo parent-to-student portal link.");
        if (!existingAccess) {
          await insertTracked("parent_student_portal_access", {
            school_id: SCHOOL_ID, parent_guardian_id: parent.id, student_id: link.student_id,
            relationship: parent.relationship, is_primary: link.is_primary, is_active: true,
          }, "demo_parent_portal_access");
        } else if (!existingAccess.is_active) {
          const { error: accessUpdateError } = await admin.from("parent_student_portal_access")
            .update({ is_active: true }).eq("id", existingAccess.id);
          if (accessUpdateError) throw new Error("Could not enable the demo parent-to-student portal link.");
        }
      }
      credentials.push({ role: "parent", name: displayName, username: email, password });
    }

    const today = new Date().toISOString().slice(0, 10);
    const assessmentIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      assessmentIds.push(await insertTracked("assessments", {
        school_id: SCHOOL_ID, academic_session_id: session.id, class_id: primaryClass.id,
        subject_id: subjectIds[i], title: `TEST CA 1 - ${selectedSubjects[i].name}`,
        assessment_type: "continuous_assessment", max_score: 20, assessment_date: today,
      }, "demo_assessment"));
    }

    const studentScores: Array<{ studentId: string; ca: number[]; exam: number[] }> = [];
    for (let i = 0; i < students.length; i++) {
      const ca = [12 + (i % 9), 13 + ((i * 2) % 8)];
      const examScores = [55 + ((i * 3) % 26), 54 + ((i * 5) % 27)];
      studentScores.push({ studentId: students[i], ca, exam: examScores });
      for (let j = 0; j < assessmentIds.length; j++) {
        await insertTracked("assessment_scores", {
          school_id: SCHOOL_ID, assessment_id: assessmentIds[j], student_id: students[i],
          score: ca[j], remarks: "TEST MARK - not an official school record",
        }, "demo_assessment_score");
      }
      const attendanceStatus = i % 10 === 0 ? "absent" : "present";
      await insertTracked("student_attendance", {
        school_id: SCHOOL_ID, student_id: students[i], academic_session_id: session.id,
        class_id: primaryClass.id, attendance_date: today, status: attendanceStatus,
        remarks: "TEST DATA ONLY",
      }, "demo_attendance");
    }

    const examId = await insertTracked("online_exams", {
      school_id: SCHOOL_ID, academic_session_id: session.id, class_id: primaryClass.id,
      subject_id: subjectIds[0], title: "TEST CBT - Primary 1 Mathematics",
      instructions: "TEST ONLY. This examination and its scores are simulated records.",
      duration_minutes: 15, total_marks: 5,
      start_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      end_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "published", created_by: user.id,
    }, "demo_exam");

    const questions = [
      ["What is 2 + 3?", "4", "5", "6", "7", "B"],
      ["Which number comes after 9?", "8", "10", "11", "12", "B"],
      ["What is 4 + 4?", "6", "7", "8", "9", "C"],
      ["Which is an even number?", "3", "5", "6", "7", "C"],
      ["What is 10 - 2?", "6", "7", "8", "9", "C"],
    ];
    const questionIds: Array<{ id: string; answer: string }> = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const id = await insertTracked("online_exam_questions", {
        school_id: SCHOOL_ID, exam_id: examId, question_text: q[0],
        question_type: "multiple_choice", option_a: q[1], option_b: q[2],
        option_c: q[3], option_d: q[4], correct_answer: q[5], marks: 1, sort_order: i + 1,
      }, "demo_exam_question");
      questionIds.push({ id, answer: q[5] });
    }

    for (let i = 0; i < students.length; i++) {
      const score = i % 5 === 0 ? 3 : i % 3 === 0 ? 4 : 5;
      const attemptId = await insertTracked("online_exam_attempts", {
        school_id: SCHOOL_ID, exam_id: examId, student_id: students[i],
        started_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        submitted_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        score, status: "submitted",
      }, "demo_exam_attempt");
      for (let j = 0; j < questionIds.length; j++) {
        const correct = j < score;
        await insertTracked("online_exam_answers", {
          school_id: SCHOOL_ID, attempt_id: attemptId, question_id: questionIds[j].id,
          answer_text: correct ? questionIds[j].answer : "A",
          is_correct: correct, marks_awarded: correct ? 1 : 0,
        }, "demo_exam_answer");
      }
    }

    for (let i = 0; i < studentScores.length; i++) {
      const row = studentScores[i];
      const totals = row.ca.map((ca, j) => ca + row.exam[j]);
      const totalScore = totals.reduce((a, b) => a + b, 0);
      const average = totalScore / totals.length;
      const resultId = await insertTracked("student_term_results", {
        school_id: SCHOOL_ID, student_id: row.studentId, academic_session_id: session.id,
        term_id: term.id, class_id: primaryClass.id, total_score: totalScore,
        average_score: average, position: i + 1,
        teacher_comment: "TEST RESULT ONLY - not an official result",
        principal_comment: "SIMULATED RESULT - excluded from official school records",
        workflow_status: "published", submitted_at: new Date().toISOString(),
        approved_by: user.id, approved_at: new Date().toISOString(),
        published_by: user.id, published_at: new Date().toISOString(),
      }, "demo_term_result");
      for (let j = 0; j < 2; j++) {
        const total = row.ca[j] + row.exam[j];
        const grade = total >= 80 ? "A" : total >= 70 ? "B" : total >= 60 ? "C" : total >= 50 ? "D" : "F";
        await insertTracked("student_subject_results", {
          school_id: SCHOOL_ID, term_result_id: resultId, student_id: row.studentId,
          subject_id: subjectIds[j], ca_score: row.ca[j], exam_score: row.exam[j],
          total_score: total, grade, position: i + 1,
          teacher_comment: "TEST MARK - not an official school record",
        }, "demo_subject_result");
      }
    }

    return reply(200, {
      success: true, run_id: runId,
      message: "Created clearly labelled RESA test accounts and simulated attendance, CA scores, submitted CBT attempts, and published test results. Credentials are shown once; copy them now.",
      counts: { teachers: 10, students: 20, parents: demoParents.length, cbtAttempts: students.length, caScores: students.length * 2, publishedResults: students.length },
      credentials,
    });
  } catch (error) {
    console.error("RESA test data seed failed:", error instanceof Error ? error.message : "Unknown error");
    for (const id of updatedParentGuardians) await admin.from("parents_guardians").update({ portal_enabled: false }).eq("id", id).eq("school_id", SCHOOL_ID);
    for (const id of updatedParentPeople) await admin.from("people").update({ user_id: null }).eq("id", id).eq("school_id", SCHOOL_ID);
    for (const row of created.reverse()) {
      try { await admin.from(row.table).delete().eq("id", row.id); } catch { /* best-effort rollback */ }
    }
    await admin.from("resa_test_data_records").delete().eq("run_id", runId);
    for (const id of authIds.reverse()) {
      try { await admin.auth.admin.deleteUser(id); } catch { /* best-effort rollback */ }
    }
    return reply(500, { error: error instanceof Error ? error.message : "Test data setup failed. Any partial inserts were rolled back where possible." });
  }
});
