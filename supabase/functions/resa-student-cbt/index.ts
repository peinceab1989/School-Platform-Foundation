import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in to access examinations." });

  try {
    const token = authorization.slice(7).trim();
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return reply(401, { error: "Your session is invalid or expired. Sign in again." });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const { data: moduleControl, error: moduleControlError } = await admin.from("nexus_module_controls").select("is_enabled").eq("module_key", "student_cbt").maybeSingle();
  if (moduleControlError || !moduleControl) return reply(503, { error: "Could not verify student cbt availability." });
  if (!moduleControl.is_enabled) return reply(403, { error: "Student CBT is currently disabled by the system administrator." });

    const body = await req.json().catch(() => null) as null | {
      action?: string;
      exam_id?: string;
      attempt_id?: string;
      answers?: Array<{ question_id?: string; answer_text?: string }>;
    };
    if (!body || !["list", "start", "submit"].includes(String(body.action))) {
      return reply(400, { error: "Choose a valid CBT action." });
    }

    const { data: student, error: studentError } = await admin
      .from("students").select("id,school_id,status").eq("user_id", user.id).maybeSingle();
    if (studentError) {
      console.error("CBT student lookup failed", studentError.message);
      return reply(500, { error: "Could not verify your student record." });
    }
    if (!student || student.status !== "active") return reply(403, { error: "An active student record linked to this account is required." });

    const { data: memberships, error: membershipError } = await admin
      .from("school_memberships").select("id").eq("user_id", user.id)
      .eq("school_id", student.school_id).eq("role", "student").eq("status", "active").limit(1);
    if (membershipError || !memberships?.length) return reply(403, { error: "Your active student membership could not be verified." });

    const now = Date.now();
    if (body.action === "list") {
      const { data: enrollments, error: enrollmentError } = await admin
        .from("student_enrollments").select("class_id,academic_session_id")
        .eq("school_id", student.school_id).eq("student_id", student.id).eq("status", "active");
      if (enrollmentError) return reply(500, { error: "Could not load your current class enrollment." });
      const pairs = enrollments ?? [];
      if (!pairs.length) return reply(200, {
        exams: [],
        access_state: "no_active_enrollment",
        message: "Your student portal account is active, but no active class and academic-session enrolment is linked to it yet. Please contact the school office to complete your enrolment record."
      });

      const { data: exams, error: examsError } = await admin
        .from("online_exams")
        .select("id,title,instructions,duration_minutes,total_marks,start_at,end_at,class_id,subject_id,academic_session_id")
        .eq("school_id", student.school_id).eq("status", "published");
      if (examsError) return reply(500, { error: "Could not load available examinations." });

      const eligible = (exams ?? []).filter((exam) =>
        pairs.some((enrollment) => enrollment.class_id === exam.class_id && enrollment.academic_session_id === exam.academic_session_id) &&
        (!exam.start_at || new Date(exam.start_at).getTime() <= now) &&
        (!exam.end_at || new Date(exam.end_at).getTime() >= now)
      );

      const results = await Promise.all(eligible.map(async (exam) => {
        const [{ data: subject }, { data: schoolClass }, { data: attempts }] = await Promise.all([
          admin.from("subjects").select("name").eq("school_id", student.school_id).eq("id", exam.subject_id).maybeSingle(),
          admin.from("school_classes").select("name").eq("school_id", student.school_id).eq("id", exam.class_id).maybeSingle(),
          admin.from("online_exam_attempts").select("id,status,started_at,submitted_at,score")
            .eq("school_id", student.school_id).eq("exam_id", exam.id).eq("student_id", student.id)
            .order("started_at", { ascending: false }).limit(1),
        ]);
        const latest = attempts?.[0] ?? null;
        return {
          id: exam.id, title: exam.title, instructions: exam.instructions,
          duration_minutes: exam.duration_minutes, total_marks: exam.total_marks,
          start_at: exam.start_at, end_at: exam.end_at,
          class_id: exam.class_id, class_name: schoolClass?.name ?? "Class unavailable",
          subject_name: subject?.name ?? "Subject unavailable",
          attempt_id: latest?.id ?? null, attempt_status: latest?.status ?? null,
          score: latest?.status === "submitted" ? latest.score : null,
        };
      }));
      return reply(200, {
        exams: results,
        access_state: results.length ? "exams_available" : "no_published_exams",
        message: results.length
          ? `${results.length} published examination${results.length === 1 ? "" : "s"} are available for your enrolled class and academic session.`
          : "Your class enrolment is active, but there are no published examinations scheduled for your class and academic session right now."
      });
    }

    if (body.action === "start") {
      if (!body.exam_id) return reply(400, { error: "An examination is required." });
      const { data: exam, error: examError } = await admin.from("online_exams")
        .select("id,title,instructions,duration_minutes,total_marks,start_at,end_at,class_id,academic_session_id")
        .eq("id", body.exam_id).eq("school_id", student.school_id).eq("status", "published").maybeSingle();
      if (examError || !exam) return reply(404, { error: "This examination is not available." });
      if ((exam.start_at && new Date(exam.start_at).getTime() > now) ||
          (exam.end_at && new Date(exam.end_at).getTime() < now)) {
        return reply(403, { error: "This examination is outside its scheduled time." });
      }
      const { data: enrollment } = await admin.from("student_enrollments").select("id")
        .eq("school_id", student.school_id).eq("student_id", student.id)
        .eq("class_id", exam.class_id).eq("academic_session_id", exam.academic_session_id)
        .eq("status", "active").limit(1).maybeSingle();
      if (!enrollment) return reply(403, { error: "You are not enrolled in the class for this examination." });

      const { data: prior, error: priorError } = await admin.from("online_exam_attempts")
        .select("id,status,started_at,submitted_at,score").eq("school_id", student.school_id)
        .eq("exam_id", exam.id).eq("student_id", student.id).order("started_at", { ascending: false }).limit(1);
      if (priorError) return reply(500, { error: "Could not check your previous attempt." });
      const previous = prior?.[0];
      if (previous?.status === "submitted") return reply(409, { error: "You have already submitted this examination.", attempt_id: previous.id, score: previous.score });
      let attempt = previous;
      if (!attempt) {
        const { data: created, error: createError } = await admin.from("online_exam_attempts")
          .insert({ school_id: student.school_id, exam_id: exam.id, student_id: student.id, status: "in_progress" })
          .select("id,status,started_at,submitted_at,score").single();
        if (createError || !created) {
          console.error("CBT attempt creation failed", createError?.message);
          return reply(500, { error: "Could not start your examination. Please try again." });
        }
        attempt = created;
      }
      const deadline = new Date(attempt.started_at).getTime() + Math.max(1, Number(exam.duration_minutes) || 30) * 60_000;
      if (now > deadline) return reply(403, { error: "Your examination time has expired. Submit your answers if the exam screen is still open." });

      const { data: questions, error: questionsError } = await admin.from("online_exam_questions")
        .select("id,question_text,question_type,option_a,option_b,option_c,option_d,marks,sort_order")
        .eq("school_id", student.school_id).eq("exam_id", exam.id).order("sort_order").order("created_at");
      if (questionsError) return reply(500, { error: "Could not load examination questions." });
      return reply(200, {
        exam: { id: exam.id, title: exam.title, instructions: exam.instructions, duration_minutes: exam.duration_minutes, total_marks: exam.total_marks },
        attempt: { id: attempt.id, started_at: attempt.started_at, deadline: new Date(deadline).toISOString(), status: attempt.status },
        questions: questions ?? [],
      });
    }

    if (!body.attempt_id || !Array.isArray(body.answers)) return reply(400, { error: "The examination attempt and answers are required." });
    if (body.answers.length > 500) return reply(400, { error: "Too many submitted answers." });

    const { data: attempt, error: attemptError } = await admin.from("online_exam_attempts")
      .select("id,exam_id,student_id,school_id,started_at,submitted_at,status")
      .eq("id", body.attempt_id).eq("school_id", student.school_id)
      .eq("student_id", student.id).maybeSingle();
    if (attemptError || !attempt) return reply(404, { error: "Your examination attempt was not found." });
    if (attempt.status === "submitted" || attempt.submitted_at) return reply(409, { error: "This examination has already been submitted." });

    const { data: exam, error: examError } = await admin.from("online_exams")
      .select("id,duration_minutes,status,end_at,total_marks")
      .eq("id", attempt.exam_id).eq("school_id", student.school_id).maybeSingle();
    if (examError || !exam) return reply(404, { error: "The examination could not be found." });

    const deadline = new Date(attempt.started_at).getTime() + Math.max(1, Number(exam.duration_minutes) || 30) * 60_000;
    const forcedSubmit = now > deadline || (exam.end_at && new Date(exam.end_at).getTime() < now);
    const { data: questions, error: questionError } = await admin.from("online_exam_questions")
      .select("id,question_type,correct_answer,marks").eq("school_id", student.school_id).eq("exam_id", attempt.exam_id);
    if (questionError) return reply(500, { error: "Could not grade your answers." });

    const byId = new Map((questions ?? []).map(q => [q.id, q]));
    const seen = new Set<string>();
    const answerRows: Array<Record<string, unknown>> = [];
    let objectiveScore = 0;
    let manualMarkingRequired = false;
    for (const item of body.answers) {
      const questionId = typeof item?.question_id === "string" ? item.question_id : "";
      if (!questionId || seen.has(questionId) || !byId.has(questionId)) continue;
      seen.add(questionId);
      const question = byId.get(questionId)!;
      const answerText = typeof item.answer_text === "string" ? item.answer_text.slice(0, 10000) : "";
      const isObjective = question.question_type === "multiple_choice";
      const correct = isObjective ? normalized(answerText) === normalized(question.correct_answer) : null;
      const marks = isObjective && correct ? Number(question.marks) : 0;
      if (isObjective) objectiveScore += marks;
      else manualMarkingRequired = true;
      answerRows.push({
        school_id: student.school_id, attempt_id: attempt.id, question_id: questionId,
        answer_text: answerText, is_correct: correct, marks_awarded: isObjective ? marks : null,
      });
    }

    const { error: saveError } = await admin.from("online_exam_answers").insert(answerRows);
    if (saveError && answerRows.length) {
      console.error("CBT answer save failed", saveError.message);
      return reply(500, { error: "Your answers could not be saved. Please retry submission." });
    }
    const { error: updateError } = await admin.from("online_exam_attempts").update({
      submitted_at: new Date().toISOString(), score: objectiveScore, status: "submitted",
    }).eq("id", attempt.id).eq("school_id", student.school_id).eq("student_id", student.id).eq("status", "in_progress");
    if (updateError) {
      console.error("CBT attempt submission update failed", updateError.message);
      return reply(500, { error: "Answers were recorded but submission status could not be confirmed. Contact the school administrator before retrying." });
    }
    return reply(200, {
      success: true, status: "submitted", score: objectiveScore,
      total_marks: exam.total_marks, manual_marking_required: manualMarkingRequired,
      message: manualMarkingRequired
        ? "Your examination was submitted. Objective questions were graded automatically; written answers require teacher marking."
        : "Your examination was submitted and graded.",
      time_expired: Boolean(forcedSubmit),
    });
  } catch (error) {
    console.error("resa-student-cbt failed:", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "The CBT request could not be completed. Please try again." });
  }
});
