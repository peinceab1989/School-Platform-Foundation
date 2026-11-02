import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Attempt = {
  id: string;
  exam_id: string;
  student_id: string;
  score: number | null;
  submitted_at: string | null;
  title: string;
  student: string;
  transferred: boolean;
  transferBlockReason: string | null;
};

type Answer = {
  id: string;
  question_id: string;
  answer_text: string | null;
  marks_awarded: number | null;
  question_text: string;
  question_type: string;
  maximum: number;
};

export default function CbtResultsPanel({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const attemptQuery = await db
        .from("online_exam_attempts")
        .select("id,exam_id,student_id,score,submitted_at")
        .eq("school_id", schoolId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
      if (attemptQuery.error) throw attemptQuery.error;

      const attempts = attemptQuery.data ?? [];
      if (!attempts.length) {
        setRows([]);
        return;
      }

      const examIds = [...new Set(attempts.map((item: any) => item.exam_id))];
      const studentIds = [...new Set(attempts.map((item: any) => item.student_id))];
      const [examQuery, studentQuery, transferQuery] = await Promise.all([
        db.from("online_exams")
          .select("id,title,term_id,academic_session_id,class_id,subject_id")
          .eq("school_id", schoolId).in("id", examIds),
        db.from("students")
          .select("id,person_id,admission_number")
          .eq("school_id", schoolId).in("id", studentIds),
        db.from("cbt_result_transfers")
          .select("attempt_id")
          .eq("school_id", schoolId)
          .in("attempt_id", attempts.map((item: any) => item.id)),
      ]);
      for (const query of [examQuery, studentQuery, transferQuery]) {
        if (query.error) throw query.error;
      }

      const exams = examQuery.data ?? [];
      const students = studentQuery.data ?? [];
      const examById = new Map(exams.map((exam: any) => [exam.id, exam]));
      const transferredIds = new Set((transferQuery.data ?? []).map((item: any) => item.attempt_id));

      const personIds = [...new Set(students.map((student: any) => student.person_id).filter(Boolean))];
      const peopleQuery = personIds.length
        ? await db.from("people").select("id,first_name,middle_name,last_name")
            .eq("school_id", schoolId).in("id", personIds)
        : { data: [], error: null };
      if (peopleQuery.error) throw peopleQuery.error;
      const names = new Map((peopleQuery.data ?? []).map((person: any) => [
        person.id,
        [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" "),
      ]));
      const studentLabels = new Map(students.map((student: any) => [
        student.id,
        (names.get(student.person_id) || "Student") + " · " + (student.admission_number || "No admission number"),
      ]));

      const termIds = [...new Set(exams.map((exam: any) => exam.term_id).filter(Boolean))];
      const subjectIds = [...new Set(exams.map((exam: any) => exam.subject_id).filter(Boolean))];
      const termResultsQuery = termIds.length
        ? await db.from("student_term_results")
            .select("id,student_id,academic_session_id,term_id,class_id,workflow_status")
            .eq("school_id", schoolId).in("student_id", studentIds).in("term_id", termIds)
        : { data: [], error: null };
      if (termResultsQuery.error) throw termResultsQuery.error;
      const termResults = termResultsQuery.data ?? [];
      const resultIds = termResults.map((result: any) => result.id);
      const subjectResultsQuery = resultIds.length && subjectIds.length
        ? await db.from("student_subject_results")
            .select("term_result_id,subject_id,exam_score")
            .eq("school_id", schoolId).in("term_result_id", resultIds).in("subject_id", subjectIds)
        : { data: [], error: null };
      if (subjectResultsQuery.error) throw subjectResultsQuery.error;

      const resultByKey = new Map(termResults.map((result: any) => [
        [result.student_id, result.academic_session_id, result.term_id, result.class_id].join(":"),
        result,
      ]));
      const subjectScoreByKey = new Map<string, number>(
        (subjectResultsQuery.data ?? []).map((result: any) => [
          [result.term_result_id, result.subject_id].join(":"),
          Number(result.exam_score) || 0,
        ] as [string, number]),
      );

      setRows(attempts.map((attempt: any) => {
        const exam = examById.get(attempt.exam_id) as any;
        const termResult = exam?.term_id
          ? resultByKey.get([attempt.student_id, exam.academic_session_id, exam.term_id, exam.class_id].join(":")) as any
          : null;
        const existingExamScore: number = termResult && exam?.subject_id
          ? subjectScoreByKey.get([termResult.id, exam.subject_id].join(":")) ?? 0
          : 0;
        let transferBlockReason: string | null = null;
        if (!transferredIds.has(attempt.id)) {
          if (!exam?.term_id) {
            transferBlockReason = "Assign this examination to an academic term first.";
          } else if (termResult && ["approved", "published"].includes(termResult.workflow_status)) {
            transferBlockReason = "The term result is approved or published. Reopen it through Results Management before transferring.";
          } else if (existingExamScore > 0) {
            transferBlockReason = "An exam score is already recorded for this subject. The transfer will not overwrite it.";
          }
        }
        return {
          ...attempt,
          title: exam?.title || "Examination",
          student: studentLabels.get(attempt.student_id) || "Student record unavailable",
          transferred: transferredIds.has(attempt.id),
          transferBlockReason,
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load CBT submissions.");
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string) {
    setSelected(id);
    setAnswers([]);
    setError("");
    try {
      const db = getSupabaseClient() as any;
      const answerQuery = await db.from("online_exam_answers")
        .select("id,question_id,answer_text,marks_awarded")
        .eq("school_id", schoolId).eq("attempt_id", id);
      if (answerQuery.error) throw answerQuery.error;
      const answerRows = answerQuery.data ?? [];
      const questionQuery = answerRows.length
        ? await db.from("online_exam_questions")
            .select("id,question_text,question_type,marks")
            .eq("school_id", schoolId)
            .in("id", answerRows.map((item: any) => item.question_id))
        : { data: [], error: null };
      if (questionQuery.error) throw questionQuery.error;
      const questionById = new Map((questionQuery.data ?? []).map((item: any) => [item.id, item]));
      const merged = answerRows.map((item: any) => {
        const question = questionById.get(item.question_id) as any;
        return {
          ...item,
          question_text: question?.question_text || "Question unavailable",
          question_type: question?.question_type || "",
          maximum: Number(question?.marks) || 0,
        };
      });
      setAnswers(merged);
      setDrafts(Object.fromEntries(merged.map((item: any) => [
        item.id,
        item.marks_awarded == null ? "" : String(item.marks_awarded),
      ])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submitted answers.");
    }
  }

  async function mark(answer: Answer) {
    setBusy(true);
    setError("");
    try {
      const score = Number(drafts[answer.id]);
      if (!Number.isFinite(score) || score < 0 || score > answer.maximum) {
        throw new Error("Marks must be between zero and " + answer.maximum + ".");
      }
      const result = await (getSupabaseClient() as any).rpc("resa_mark_cbt_answer", {
        p_answer_id: answer.id,
        p_marks: score,
      });
      if (result.error) throw result.error;
      setNotice("Written answer marked.");
      await review(selected);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Marking failed.");
    } finally {
      setBusy(false);
    }
  }

  async function transfer(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await (getSupabaseClient() as any).rpc("resa_transfer_cbt_attempt", {
        p_attempt_id: id,
      });
      if (result.error) throw result.error;
      setNotice(result.data?.already_transferred
        ? "This attempt was already transferred."
        : "Score transferred to the correct term as Exam / 60. Existing CA marks were preserved. The result still requires normal approval and publication.");
      setSelected("");
      setAnswers([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed. Review the attempt and result workflow.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">CBT submissions & result transfer</h2>
          <p className="text-sm text-slate-600">Review written answers, save marks and transfer complete attempts to the academic broadsheet.</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm">Refresh submissions</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {!rows.length ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No submitted CBT attempts found.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((attempt) => (
            <article key={attempt.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{attempt.student}</p>
                  <p className="text-sm text-slate-600">
                    {attempt.title} · Objective score {attempt.score ?? 0} · {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Date unavailable"}
                  </p>
                  <p className={`mt-1 text-xs font-medium ${attempt.transferred ? "text-emerald-700" : attempt.transferBlockReason ? "text-amber-800" : "text-slate-500"}`}>
                    {attempt.transferred ? "Transferred to broadsheet" : attempt.transferBlockReason ? "Transfer blocked: " + attempt.transferBlockReason : "Ready for review and transfer"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy || attempt.transferred} onClick={() => void review(attempt.id)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Review / mark</button>
                  <button disabled={busy || attempt.transferred || Boolean(attempt.transferBlockReason)} onClick={() => void transfer(attempt.id)} className="rounded-lg bg-green-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Transfer to broadsheet</button>
                </div>
              </div>
              {selected === attempt.id && (
                <div className="mt-4 space-y-3 border-t pt-3">
                  {answers.map((answer, index) => (
                    <div key={answer.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-semibold">{index + 1}. {answer.question_text}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">Student answer: {answer.answer_text || "No answer"}</p>
                      {answer.question_type === "multiple_choice" ? (
                        <p className="mt-2 text-xs text-green-800">Auto-marked: {answer.marks_awarded ?? 0} / {answer.maximum}</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <label className="text-xs font-semibold">
                            Marks (maximum {answer.maximum})
                            <input type="number" min="0" max={answer.maximum} step="0.5" className="mt-1 block w-28 rounded border px-2 py-2 text-sm" value={drafts[answer.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [answer.id]: event.target.value }))} />
                          </label>
                          <button disabled={busy} onClick={() => void mark(answer)} className="rounded-lg border border-green-800 px-3 py-2 text-xs font-bold text-green-900">Save mark</button>
                          <span className="text-xs text-slate-500">Saved: {answer.marks_awarded ?? "Not marked"}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-amber-800">Transfer is blocked until every written answer is marked and every question has an answer. Transfers are one-time and never overwrite an existing exam score.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
