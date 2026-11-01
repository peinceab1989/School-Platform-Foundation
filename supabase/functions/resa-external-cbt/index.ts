import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://resa-school-portal.netlify.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
const asString = (v: unknown) => typeof v === "string" ? v.trim() : "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "POST required." });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return reply(500, { error: "CBT service is not configured." });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in with your external candidate account." });

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
    if (authError || !user) return reply(401, { error: "Your session is invalid or expired. Sign in again." });

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { error: "A JSON object is required." });
      body = parsed as Record<string, unknown>;
    } catch { return reply(400, { error: "A valid JSON request body is required." }); }

    const action = asString(body.action);
    const { data: candidate, error: candidateError } = await admin
      .from("external_candidate_registrations")
      .select("id,school_id,candidate_number,full_name,email,status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (candidateError) throw new Error("Could not verify the external candidate account.");
    if (!candidate) return reply(403, { error: "This account is not registered as an external CBT candidate." });

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
        });
      }
      const { data: assignments, error: assignmentError } = await admin
        .from("external_candidate_exam_assignments")
        .select("id,exam_id,max_attempts,available_from,available_until,status")
        .eq("school_id", candidate.school_id)
        .eq("candidate_id", candidate.id)
        .eq("status", "assigned");
      if (assignmentError) throw new Error("Could not load your assigned examinations.");
      const examIds = (assignments ?? []).map((a) => a.exam_id);
      if (!examIds.length) return reply(200, { candidate: { candidate_number: candidate.candidate_number, full_name: candidate.full_name, status: candidate.status }, exams: [] });
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
          is_open: (!opens || now >= opens) && (!closes || now <= closes),
          result: history.find((a) => a.result_published && a.status === "graded")
            ? history.find((a) => a.result_published && a.status === "graded")
            : null,
        };
      });
      return reply(200, { candidate: { candidate_number: candidate.candidate_number, full_name: candidate.full_name, status: candidate.status }, exams: output });
    }

    if (candidate.status !== "approved") return reply(403, { error: "Your registration must be approved before you can take an examination." });

    if (action === "start") {
      const examId = asString(body.exam_id);
      if (!examId) return reply(400, { error: "An exam_id is required." });
      const { data: assignment, error: assignmentError } = await admin
        .from("external_candidate_exam_assignments")
        .select("id,exam_id,max_attempts,available_from,available_until,status")
        .eq("school_id", candidate.school_id).eq("candidate_id", candidate.id).eq("exam_id", examId).eq("status", "assigned").maybeSingle();
      if (assignmentError) throw new Error("Could not verify your exam assignment.");
      if (!assignment) return reply(403, { error: "This examination has not been assigned to your candidate account." });
      const { data: exam, error: examError } = await admin
        .from("online_exams")
        .select("id,title,instructions,duration_minutes,total_marks,start_at,end_at,status")
        .eq("school_id", candidate.school_id).eq("id", examId).maybeSingle();
      if (examError) throw new Error("Could not load the examination.");
      if (!exam || exam.status !== "published") return reply(404, { error: "This examination is not published." });
      const now = Date.now();
      const opens = assignment.available_from ? new Date(assignment.available_from).getTime() : exam.start_at ? new Date(exam.start_at).getTime() : null;
      const closes = assignment.available_until ? new Date(assignment.available_until).getTime() : exam.end_at ? new Date(exam.end_at).getTime() : null;
      if (opens && now < opens) return reply(403, { error: "This examination has not opened yet." });
      if (closes && now > closes) return reply(403, { error: "The examination window has closed." });

      const { data: activeAttempt, error: activeError } = await admin
        .from("external_candidate_exam_attempts")
        .select("id,attempt_number,started_at,ends_at")
        .eq("candidate_id", candidate.id).eq("exam_id", examId).eq("status", "in_progress").maybeSingle();
      if (activeError) throw new Error("Could not check your current examination attempt.");

      let attempt = activeAttempt;
      if (!attempt) {
        const { count, error: countError } = await admin.from("external_candidate_exam_attempts")
          .select("id", { count: "exact", head: true })
          .eq("candidate_id", candidate.id).eq("exam_id", examId);
        if (countError) throw new Error("Could not check the number of attempts used.");
        const attemptNumber = (count ?? 0) + 1;
        if (attemptNumber > assignment.max_attempts) return reply(403, { error: "You have used all permitted attempts for this examination." });
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
        if (createError || !created) throw new Error("Could not start the examination. Refresh and try again.");
        attempt = created;
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
      return reply(200, { attempt, exam: { id: exam.id, title: exam.title, instructions: exam.instructions, total_marks: exam.total_marks }, questions: questions ?? [], saved_answers: savedAnswers ?? [] });
    }

    if (action === "save") {
      const attemptId = asString(body.attempt_id);
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (!attemptId) return reply(400, { error: "An attempt_id is required." });
      const { data: attempt, error: attemptError } = await admin
        .from("external_candidate_exam_attempts")
        .select("id,school_id,candidate_id,exam_id,ends_at,status")
        .eq("id", attemptId).eq("candidate_id", candidate.id).maybeSingle();
      if (attemptError) throw new Error("Could not verify the examination attempt.");
      if (!attempt || attempt.status !== "in_progress") return reply(409, { error: "This examination attempt is no longer active." });
      if (Date.now() >= new Date(attempt.ends_at).getTime()) return reply(409, { error: "The examination time has expired. Submit your saved answers now." });
      const { data: questions, error: questionsError } = await admin
        .from("online_exam_questions").select("id")
        .eq("school_id", candidate.school_id).eq("exam_id", attempt.exam_id);
      if (questionsError) throw new Error("Could not verify the examination questions.");
      const validIds = new Set((questions ?? []).map((q) => q.id));
      const rows = answers.slice(0, 300).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const questionId = asString((item as Record<string, unknown>).question_id);
        if (!validIds.has(questionId)) return [];
        const answerText = typeof (item as Record<string, unknown>).answer === "string"
          ? (item as Record<string, unknown>).answer.trim().slice(0, 5000)
          : "";
        return [{ school_id: candidate.school_id, attempt_id: attempt.id, question_id: questionId, answer_text: answerText || null, marks_awarded: 0 }];
      });
      if (rows.length) {
        const { error: saveError } = await admin.from("external_candidate_exam_answers")
          .upsert(rows, { onConflict: "attempt_id,question_id" });
        if (saveError) throw new Error("Could not save your answers.");
      }
      return reply(200, { success: true, saved: rows.length });
    }

    if (action === "submit") {
      const attemptId = asString(body.attempt_id);
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (!attemptId) return reply(400, { error: "An attempt_id is required." });
      const { data: attempt, error: attemptError } = await admin
        .from("external_candidate_exam_attempts")
        .select("id,school_id,candidate_id,exam_id,ends_at,status")
        .eq("id", attemptId).eq("candidate_id", candidate.id).maybeSingle();
      if (attemptError) throw new Error("Could not verify the examination attempt.");
      if (!attempt || attempt.status !== "in_progress") return reply(409, { error: "This examination attempt is no longer active." });
      const now = Date.now();
      const autoSubmitted = now >= new Date(attempt.ends_at).getTime();

      // Before the deadline, persist the final client state. After the deadline,
      // grade only answers already saved by the server before expiry. This prevents
      // changing answers in a modified browser after the timer has elapsed.
      if (!autoSubmitted) {
        const { data: validQuestions, error: validQuestionsError } = await admin
          .from("online_exam_questions").select("id")
          .eq("school_id", candidate.school_id).eq("exam_id", attempt.exam_id);
        if (validQuestionsError) throw new Error("Could not verify examination questions.");
        const validIds = new Set((validQuestions ?? []).map((q) => q.id));
        const finalRows = answers.slice(0, 300).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const questionId = asString((item as Record<string, unknown>).question_id);
          if (!validIds.has(questionId)) return [];
          const answerText = typeof (item as Record<string, unknown>).answer === "string"
            ? (item as Record<string, unknown>).answer.trim().slice(0, 5000)
            : "";
          return [{ school_id: candidate.school_id, attempt_id: attempt.id, question_id: questionId, answer_text: answerText || null, marks_awarded: 0 }];
        });
        if (finalRows.length) {
          const { error: finalSaveError } = await admin.from("external_candidate_exam_answers")
            .upsert(finalRows, { onConflict: "attempt_id,question_id" });
          if (finalSaveError) throw new Error("Could not save your final answers. Your attempt remains open; try again.");
        }
      }

      const { data: savedAnswers, error: savedAnswersError } = await admin
        .from("external_candidate_exam_answers")
        .select("question_id,answer_text")
        .eq("school_id", candidate.school_id).eq("attempt_id", attempt.id);
      if (savedAnswersError) throw new Error("Could not load your saved answers for marking.");

      const { data: questions, error: questionsError } = await admin
        .from("online_exam_questions")
        .select("id,question_type,correct_answer,marks")
        .eq("school_id", candidate.school_id).eq("exam_id", attempt.exam_id);
      if (questionsError) throw new Error("Could not load the grading key.");
      const questionMap = new Map((questions ?? []).map((q) => [q.id, q]));
      const answerRows = [];
      let score = 0;
      const totalMarks = (questions ?? []).reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
      for (const item of (savedAnswers ?? [])) {
        const questionId = item.question_id;
        const answerText = typeof item.answer_text === "string" ? item.answer_text.trim().slice(0, 5000) : "";
        const question = questionMap.get(questionId);
        if (!question) continue;
        const marks = Number(question.marks) || 0;
        const type = String(question.question_type || "").toLowerCase();
        const isChoice = ["multiple_choice","mcq","objective"].includes(type);
        const correct = isChoice && answerText.toUpperCase() === String(question.correct_answer ?? "").trim().toUpperCase();
        const awarded = correct ? marks : 0;
        score += awarded;
        answerRows.push({
          school_id: candidate.school_id, attempt_id: attempt.id, question_id: questionId,
          answer_text: answerText || null, marks_awarded: awarded,
        });
      }
      if (answerRows.length) {
        const { error: answerError } = await admin.from("external_candidate_exam_answers")
          .upsert(answerRows, { onConflict: "attempt_id,question_id" });
        if (answerError) throw new Error("Could not save your answers. Your attempt remains open; try submitting again.");
      }
      const { error: updateError } = await admin.from("external_candidate_exam_attempts")
        .update({ status: "submitted", submitted_at: new Date(now).toISOString(), score, total_marks: totalMarks })
        .eq("id", attempt.id).eq("candidate_id", candidate.id).eq("status", "in_progress");
      if (updateError) throw new Error("Answers were saved but submission could not be finalised. Contact the school office.");
      return reply(200, { success: true, status: "submitted", auto_submitted: autoSubmitted, message: "Your examination has been submitted. Results will be released by the school after review." });
    }

    return reply(400, { error: "Unsupported CBT action." });
  } catch (error) {
    console.error("resa-external-cbt failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "The external CBT service could not complete the request. Try again or contact the school office." });
  }
});
