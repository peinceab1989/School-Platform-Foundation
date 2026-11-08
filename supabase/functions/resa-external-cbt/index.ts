import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PRIMARY_ORIGIN = "https://school-platform-foundation.pages.dev";
const LEGACY_ORIGIN = "https://resa-school-portal.netlify.app";
function isAllowedOrigin(origin: string) {
  return origin === PRIMARY_ORIGIN || origin === LEGACY_ORIGIN ||
    /^https:\/\/[a-f0-9]{8,40}\.school-platform-foundation\.pages\.dev$/.test(origin);
}
function corsHeaders(origin: string) {
  return {
    ...(isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}
function reply(status: number, body: Record<string, unknown>, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}
const asString = (v: unknown) => typeof v === "string" ? v.trim() : "";

Deno.serve(async (req: Request) => {
  const requestOrigin = req.headers.get("origin") ?? "";
  if (requestOrigin && !isAllowedOrigin(requestOrigin)) return reply(403, { error: "This website is not authorised to access external CBT." }, requestOrigin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(requestOrigin) });
  if (req.method !== "POST") return reply(405, { error: "POST required." }, requestOrigin);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return reply(500, { error: "CBT service is not configured." }, requestOrigin);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in with your external candidate account." }, requestOrigin);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return reply(401, { error: "Your session is invalid or expired. Sign in again." }, requestOrigin);

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { error: "A JSON object is required." }, requestOrigin);
      body = parsed as Record<string, unknown>;
    } catch { return reply(400, { error: "A valid JSON request body is required." }, requestOrigin); }

    const action = asString(body.action);
    const { data: candidate, error: candidateError } = await admin
      .from("external_candidate_registrations")
      .select("id,school_id,candidate_number,full_name,email,status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (candidateError) throw new Error("Could not verify the external candidate account.");
    if (!candidate) return reply(403, { error: "This account is not registered as an external CBT candidate." }, requestOrigin);

    if (action === "list") {
      if (candidate.status !== "approved") {
        return reply(200, {
          candidate: { candidate_number: candidate.candidate_number, full_name: candidate.full_name, status: candidate.status },
          exams: [],
          message: candidate.status === "pending_review"
            ? "Your registration is awaiting school approval."
            : candidate.status === "rejected"
              ? "Your registration was not approved. Contact the school office."
              : "Your candidate access is currently suspended.",
        }, requestOrigin);
      }
      const { data: assignments, error: assignmentError } = await admin
        .from("external_candidate_exam_assignments")
        .select("id,exam_id,max_attempts,available_from,available_until,status")
        .eq("school_id", candidate.school_id)
        .eq("candidate_id", candidate.id)
        .eq("status", "assigned");
      if (assignmentError) throw new Error("Could not load your assigned examinations.");
      const examIds = (assignments ?? []).map((a) => a.exam_id);
      if (!examIds.length) return reply(200, { candidate: { candidate_number: candidate.candidate_number, full_name: candidate.full_name, status: candidate.status }, exams: [] }, requestOrigin);
      const { data: exams, error: examError } = await admin
        .from("online_exams")
        .select("id,title,instructions,duration_minutes,total_marks,start_at,end_at,status")
        .eq("school_id", candidate.school_id)
        .in("id", examIds)
        .eq("status", "published");
      if (examError) throw new Error("Could not load published examinations.");
      const { data: attempts, error: attemptsError } = await admin
        .from("external_candidate_exam_attempts")
        .select("exam_id,attempt_number,status,score,total_marks,result_published")
        .eq("candidate_id", candidate.id);
      if (attemptsError) throw new Error("Could not load examination attempt history.");
      const now = Date.now();
      const output = (exams ?? []).map((exam) => {
        const assignment = (assignments ?? []).find((a) => a.exam_id === exam.id);
        const history = (attempts ?? []).filter((a) => a.exam_id === exam.id);
        const activeAttempt = history.find((a) => a.status === "in_progress");
        const completed = history.filter((a) => a.status !== "in_progress").length;
        const opens = assignment?.available_from ? new Date(assignment.available_from).getTime() : exam.start_at ? new Date(exam.start_at).getTime() : null;
        const closes = assignment?.available_until ? new Date(assignment.available_until).getTime() : exam.end_at ? new Date(exam.end_at).getTime() : null;
        return {
          id: exam.id, title: exam.title, instructions: exam.instructions,
          duration_minutes: exam.duration_minutes, total_marks: exam.total_marks,
          start_at: exam.start_at, end_at: exam.end_at,
          assignment_id: assignment?.id, max_attempts: assignment?.max_attempts ?? 1,
          attempts_used: completed, attempts_remaining: Math.max(0, (assignment?.max_attempts ?? 1) - completed),
          active_attempt: activeAttempt ? { attempt_number: activeAttempt.attempt_number } : null,
          is_open: Boolean(activeAttempt) || ((!opens || now >= opens) && (!closes || now <= closes)),
          result: history.find((a) => a.result_published && a.status === "graded")
            ? history.find((a) => a.result_published && a.status === "graded")
            : null,
        };
      });
      return reply(200, { candidate: { candidate_number: candidate.candidate_number, full_name: candidate.full_name, status: candidate.status }, exams: output }, requestOrigin);
    }

    if (candidate.status !== "approved") return reply(403, { error: "Your registration must be approved before you can take an examination." }, requestOrigin);

    if (action === "start") {
      const examId = asString(body.exam_id);
      if (!examId) return reply(400, { error: "An exam_id is required." }, requestOrigin);
      const { data: assignment, error: assignmentError } = await admin
        .from("external_candidate_exam_assignments")
        .select("id,exam_id,max_attempts,available_from,available_until,status")
        .eq("school_id", candidate.school_id).eq("candidate_id", candidate.id).eq("exam_id", examId).eq("status", "assigned").maybeSingle();
      if (assignmentError) throw new Error("Could not verify your exam assignment.");
      if (!assignment) return reply(403, { error: "This examination has not been assigned to your candidate account." }, requestOrigin);
      const { data: exam, error: examError } = await admin
        .from("online_exams")
        .select("id,title,instructions,duration_minutes,total_marks,start_at,end_at,status")
        .eq("school_id", candidate.school_id).eq("id", examId).maybeSingle();
      if (examError) throw new Error("Could not load the examination.");
      if (!exam || exam.status !== "published") return reply(404, { error: "This examination is not published." }, requestOrigin);
      const now = Date.now();
      const opens = assignment.available_from ? new Date(assignment.available_from).getTime() : exam.start_at ? new Date(exam.start_at).getTime() : null;
      const closes = assignment.available_until ? new Date(assignment.available_until).getTime() : exam.end_at ? new Date(exam.end_at).getTime() : null;
      const { data: activeAttempt, error: activeError } = await admin
        .from("external_candidate_exam_attempts")
        .select("id,attempt_number,started_at,ends_at")
        .eq("candidate_id", candidate.id).eq("exam_id", examId).eq("status", "in_progress").maybeSingle();
      if (activeError) throw new Error("Could not check your current examination attempt.");

      let attempt = activeAttempt;
      if (!attempt) {
        if (opens && now < opens) return reply(403, { error: "This examination has not opened yet." }, requestOrigin);
        if (closes && now > closes) return reply(403, { error: "The examination window has closed." }, requestOrigin);
        const { count, error: countError } = await admin.from("external_candidate_exam_attempts")
          .select("id", { count: "exact", head: true })
          .eq("candidate_id", candidate.id).eq("exam_id", examId);
        if (countError) throw new Error("Could not check the number of attempts used.");
        const attemptNumber = (count ?? 0) + 1;
        if (attemptNumber > assignment.max_attempts) return reply(403, { error: "You have used all permitted attempts for this examination." }, requestOrigin);
        const duration = Math.min(Math.max(Number(exam.duration_minutes) || 60, 1), 360);
        const ends = Math.min(
          now + duration * 60 * 1000,
          closes ?? Number.POSITIVE_INFINITY,
        );
        const { data: created, error: createError } = await admin
          .from("external_candidate_exam_attempts")
          .insert({
            school_id: candidate.school_id, candidate_id: candidate.id, exam_id: exam.id,
            assignment_id: assignment.id, attempt_number: attemptNumber,
            started_at: new Date(now).toISOString(), ends_at: new Date(ends).toISOString(),
            total_marks: exam.total_marks,
          })
          .select("id,attempt_number,started_at,ends_at")
          .single();
        if (createError?.code === "23505") {
          // Concurrent starts are serialized by the one-active-attempt index.
          const { data: racedAttempt, error: racedError } = await admin
            .from("external_candidate_exam_attempts")
            .select("id,attempt_number,started_at,ends_at")
            .eq("candidate_id", candidate.id).eq("exam_id", examId).eq("status", "in_progress")
            .maybeSingle();
          if (racedError || !racedAttempt) throw new Error("Could not safely resume the examination. Refresh and try again.");
          attempt = racedAttempt;
        } else {
          if (createError || !created) throw new Error("Could not start the examination. Refresh and try again.");
          attempt = created;
        }
      }

      const { data: questions, error: questionsError } = await admin
        .from("online_exam_questions")
        .select("id,question_text,question_type,option_a,option_b,option_c,option_d,marks,sort_order")
        .eq("school_id", candidate.school_id).eq("exam_id", exam.id).order("sort_order");
      if (questionsError) throw new Error("Could not load examination questions.");
      const { data: savedAnswers, error: savedAnswersError } = await admin
        .from("external_candidate_exam_answers")
        .select("question_id,answer_text")
        .eq("school_id", candidate.school_id).eq("attempt_id", attempt.id);
      if (savedAnswersError) throw new Error("Could not restore your saved answers.");
      return reply(200, { attempt, exam: { id: exam.id, title: exam.title, instructions: exam.instructions, total_marks: exam.total_marks }, questions: questions ?? [], saved_answers: savedAnswers ?? [] }, requestOrigin);
    }

    if (action === "save") {
      const attemptId = asString(body.attempt_id);
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (answers.length > 300) return reply(400, { error: "A maximum of 300 answers can be submitted at once." }, requestOrigin);
      if (!attemptId) return reply(400, { error: "An attempt_id is required." }, requestOrigin);
      const { data, error } = await admin.rpc("resa_external_candidate_cbt_save", {
        p_candidate_id: candidate.id,
        p_attempt_id: attemptId,
        p_answers: answers,
      });
      if (error) throw new Error("Could not save your answers. Refresh and try again.");
      if (!data?.success) return reply(Number(data?.status) || 409, { error: data?.error || "The answers could not be saved." }, requestOrigin);
      return reply(200, data, requestOrigin);
    }

    if (action === "submit") {
      const attemptId = asString(body.attempt_id);
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (answers.length > 300) return reply(400, { error: "A maximum of 300 answers can be submitted at once." }, requestOrigin);
      if (!attemptId) return reply(400, { error: "An attempt_id is required." }, requestOrigin);
      const { data, error } = await admin.rpc("resa_external_candidate_cbt_submit", {
        p_candidate_id: candidate.id,
        p_attempt_id: attemptId,
        p_answers: answers,
      });
      if (error) throw new Error("Could not finalise your examination. Refresh once and contact the school if the problem continues.");
      if (!data?.success) return reply(Number(data?.status) || 409, { error: data?.error || "This examination attempt could not be submitted." }, requestOrigin);
      return reply(200, {
        ...data,
        message: "Your examination has been submitted. Results will be released by the school after review.",
      }, requestOrigin);
    }

    return reply(400, { error: "Unsupported CBT action." }, requestOrigin);
  } catch (error) {
    console.error("resa-external-cbt failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "The external CBT service could not complete the request. Try again or contact the school office." }, requestOrigin);
  }
});
