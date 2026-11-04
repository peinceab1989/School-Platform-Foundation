import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, CalendarClock, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Assignment = { id: string; assignment_type?: string; practical_rubric?: Array<{ criterion?: string } | string> | null; title: string; description: string | null; instructions: string | null; due_date: string | null; max_score: number; attachment_url: string | null; class_name: string; subject_name: string; submission_status: string | null; submission_text: string | null; submission_attachment_url: string | null; submitted_at: string | null; score: number | null; feedback: string | null };

export default function StudentAssignmentsPanel({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emptyReason, setEmptyReason] = useState("No published assignments are available for your current enrolment yet.");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const student = await db.from("students").select("id").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
      if (student.error) throw student.error;
      if (!student.data) { setItems([]); setEmptyReason("Your student profile is not linked to this login yet. Ask the school administrator to check your account link."); return; }
      const enrollmentResult = await db.from("student_enrollments").select("class_id,academic_session_id,enrollment_date").eq("school_id", schoolId).eq("student_id", student.data.id).eq("status", "active").order("enrollment_date", { ascending: false }).limit(1).maybeSingle();
      if (enrollmentResult.error) throw enrollmentResult.error;
      const enrollment = enrollmentResult.data;
      if (!enrollment?.class_id || !enrollment?.academic_session_id) { setItems([]); setEmptyReason("No active class enrolment with an academic session was found. Ask the school administrator to verify your enrolment."); return; }
      const [assignmentResult, classResult] = await Promise.all([
        db.from("assignments").select("id,title,description,instructions,due_date,max_score,subject_id,attachment_url,assignment_type,practical_rubric").eq("school_id", schoolId).eq("class_id", enrollment.class_id).eq("academic_session_id", enrollment.academic_session_id).eq("status", "published").order("due_date", { ascending: true }),
        db.from("school_classes").select("id,name").eq("school_id", schoolId).eq("id", enrollment.class_id).maybeSingle(),
      ]);
      if (assignmentResult.error) throw assignmentResult.error;
      if (classResult.error) throw classResult.error;
      const assignments = assignmentResult.data ?? [];
      if (!assignments.length) { setItems([]); setEmptyReason("No published assignments were returned for your active class and academic session. If your teacher has published one, the live portal may be outdated or the assignment may be attached to a different class/session."); return; }
      const assignmentIds = assignments.map((item: any) => item.id);
      const subjectIds = [...new Set(assignments.map((item: any) => item.subject_id).filter(Boolean))];
      const [subjectResult, submissionResult] = await Promise.all([
        subjectIds.length ? db.from("subjects").select("id,name").eq("school_id", schoolId).in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
        db.from("assignment_submissions").select("assignment_id,status,submission_text,attachment_url,submitted_at,score,feedback").eq("school_id", schoolId).eq("student_id", student.data.id).in("assignment_id", assignmentIds),
      ]);
      if (subjectResult.error) throw subjectResult.error;
      if (submissionResult.error) setNotice("Assignments are loaded, but submission status is temporarily unavailable.");
      const subjectNames = new Map((subjectResult.data ?? []).map((item: any) => [item.id, item.name]));
      const submissions = new Map((submissionResult.data ?? []).map((item: any) => [item.assignment_id, item]));
      setItems(assignments.map((item: any) => {
        const submission: any = submissions.get(item.id);
        return { id: item.id, assignment_type: item.assignment_type ?? "homework", practical_rubric: item.practical_rubric ?? [], title: item.title, description: item.description, instructions: item.instructions, due_date: item.due_date, max_score: item.max_score, attachment_url: item.attachment_url ?? null, class_name: classResult.data?.name ?? "Class unavailable", subject_name: subjectNames.get(item.subject_id) ?? "Subject unavailable", submission_status: submission?.status ?? null, submission_text: submission?.submission_text ?? null, submission_attachment_url: submission?.attachment_url ?? null, submitted_at: submission?.submitted_at ?? null, score: submission?.score ?? null, feedback: submission?.feedback ?? null };
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "Assignments could not be loaded. Refresh and try again."); }
    finally { setLoading(false); }
  }, [schoolId, userId]);
  useEffect(() => { void load(); }, [load]);

  const openAssignment = (item: Assignment) => {
    setSelectedId(item.id);
    setSubmissionText(item.submission_text ?? "");
    setEvidenceFile(null);
    setNotice("");
  };

  const submitAssignment = async (item: Assignment) => {
    if (!submissionText.trim() && !(item.assignment_type === "practical" && evidenceFile)) { setError(item.assignment_type === "practical" ? "Write a short explanation or attach photo, video or document evidence before submitting." : "Write your answer before submitting."); return; }
    if (evidenceFile && evidenceFile.size > 100 * 1024 * 1024) { setError("Evidence files must be 100 MB or smaller."); return; }
    if (item.due_date && new Date(item.due_date).getTime() < Date.now()) { setError("The submission deadline has passed. Please contact your teacher."); return; }
    setSubmitting(true); setError(""); setNotice("");
    try {
      const db = getSupabaseClient() as any;
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user || auth.user.id !== userId) throw new Error("Your student session could not be verified. Sign in again.");
      const student = await db.from("students").select("id").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active").maybeSingle();
      if (student.error) throw student.error;
      if (!student.data) throw new Error("Your active student record could not be verified.");
      if (item.submission_status) throw new Error("This assignment has already been submitted. Contact your teacher if a correction is required.");
      let evidencePath: string | null = null;
      if (evidenceFile) {
        const cleanName = evidenceFile.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "evidence-file";
        evidencePath = `${schoolId}/${student.data.id}/${item.id}/${crypto.randomUUID()}-${cleanName}`;
        const upload = await db.storage.from("resa-practical-evidence").upload(evidencePath, evidenceFile, { contentType: evidenceFile.type || "application/octet-stream", upsert: false });
        if (upload.error) throw upload.error;
      }
      const { error: saveError } = await db.from("assignment_submissions").insert({
        school_id: schoolId, assignment_id: item.id, student_id: student.data.id,
        submission_text: submissionText.trim() || null, attachment_url: evidencePath, submitted_at: new Date().toISOString(), status: "submitted",
      });
      if (saveError) { if (evidencePath) await db.storage.from("resa-practical-evidence").remove([evidencePath]); throw saveError; }
      setEvidenceFile(null);
      await load();
      setSelectedId(item.id);
      setNotice("Your assignment has been submitted successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Your assignment could not be submitted. Please try again."); }
    finally { setSubmitting(false); }
  };

  const openEvidence = async (path: string) => {
    try {
      const { data, error } = await (getSupabaseClient() as any).storage.from("resa-practical-evidence").createSignedUrl(path, 120);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Evidence preview link could not be created.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e instanceof Error ? e.message : "Evidence could not be opened."); }
  };

  return <section style={{ background: "#fff", border: "1px solid #e0e7e0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><BookOpenCheck size={23} color="#17623d" /><div><h2 style={{ margin: 0, fontSize: 21 }}>My Assignments</h2><p style={{ margin: "5px 0 0", color: "#536456", fontSize: 13 }}>Published work for your active class and academic session.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #d1ddd1", borderRadius: 8, padding: "8px 10px", color: "#17623d", background: "#fff", fontWeight: 600, fontSize: 13 }}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {loading ? <p style={{ display: "flex", alignItems: "center", gap: 8, color: "#536456", marginTop: 16 }}><Loader2 size={17}/> Loading assignments…</p> : error ? <p role="alert" style={{ color: "#9b2c2c", overflowWrap: "anywhere", marginTop: 16 }}>{error}</p> : !items.length ? <p style={{ color: "#536456", marginTop: 16 }}>{emptyReason}</p> :
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {notice && <p role="status" style={{ margin: 0, padding: 10, borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 13 }}>{notice}</p>}
        {items.map(item => <article key={item.id} style={{ border: "1px solid #dce5dc", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><button type="button" onClick={() => openAssignment(item)} aria-expanded={selectedId === item.id} style={{ margin: 0, padding: 0, border: 0, background: "transparent", color: "#123d2b", fontSize: 16, fontWeight: 800, textAlign: "left", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>{item.title}</button><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: item.submission_status ? "#17623d" : "#8a6415" }}>{item.submission_status ? <CheckCircle2 size={14}/> : null}{item.submission_status ? item.submission_status.replaceAll("_", " ") : "Not submitted"}</span></div>
          {item.assignment_type === "practical" && <p style={{ display: "inline-block", margin: "8px 0 0", borderRadius: 999, padding: "4px 9px", background: "#fff3d6", color: "#815500", fontSize: 11, fontWeight: 800 }}>PRACTICAL EXAMINATION · PHOTO / VIDEO / DOCUMENT EVIDENCE</p>}
          {item.assignment_type === "project" && <p style={{ display: "inline-block", margin: "8px 0 0", borderRadius: 999, padding: "4px 9px", background: "#e7efff", color: "#234b87", fontSize: 11, fontWeight: 800 }}>PROJECT WORK</p>}
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#536456" }}><strong>Class:</strong> {item.class_name} · <strong>Subject:</strong> {item.subject_name}</p>
          <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, margin: "6px 0 0", fontSize: 13, color: "#536456" }}><strong>Maximum score:</strong> {item.max_score}{item.due_date ? <><span>·</span><CalendarClock size={14}/><strong>Due:</strong> {new Date(item.due_date).toLocaleString()}</> : null}</p>
          {item.description && <p style={{ margin: "9px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.description}</p>}
          {item.score !== null && <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Score: {item.score} / {item.max_score}</p>}
          {item.feedback && <p style={{ margin: "6px 0 0", fontSize: 13 }}>Teacher feedback: {item.feedback}</p>}
          <button type="button" onClick={() => openAssignment(item)} aria-expanded={selectedId === item.id} style={{ marginTop: 12, border: 0, borderRadius: 8, padding: "10px 14px", background: "#17623d", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{selectedId === item.id ? "Assignment opened" : "Open assignment"}</button>
          {selectedId === item.id && <div style={{ marginTop: 14, padding: 14, borderRadius: 9, background: "#f5f8f4", border: "1px solid #dce5dc" }}>
            {item.instructions && <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", lineHeight: 1.6 }}><strong>Instructions:</strong>{"\n"}{item.instructions}</p>}
            {Array.isArray(item.practical_rubric) && item.practical_rubric.length > 0 && <div style={{ margin: "0 0 12px", padding: 12, borderRadius: 8, background: "#fff8e8" }}><strong>Teacher marking criteria</strong><ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{item.practical_rubric.map((criterion, index) => <li key={index}>{typeof criterion === "string" ? criterion : criterion.criterion}</li>)}</ul></div>}
            {item.attachment_url && <p style={{ margin: "0 0 12px" }}><a href={item.attachment_url} target="_blank" rel="noreferrer" style={{ color: "#17623d", fontWeight: 700, textDecoration: "underline" }}>Open / download teacher attachment</a></p>}
            {item.submission_status ? <div><p style={{ fontWeight: 700 }}>Your submitted answer</p><p style={{ whiteSpace: "pre-wrap" }}>{item.submission_text || "No written response was stored for this submission."}</p>{item.submission_attachment_url && <button type="button" onClick={()=>void openEvidence(item.submission_attachment_url!)} style={{ marginTop: 8, border: "1px solid #cbd5cb", borderRadius: 8, padding: "8px 11px", color: "#17623d", fontWeight: 700 }}>Open submitted evidence</button>}{item.submitted_at && <p style={{ marginTop: 8, fontSize: 12, color: "#536456" }}>Submitted: {new Date(item.submitted_at).toLocaleString()}</p>}{item.score !== null && <p style={{ marginTop: 8, fontWeight: 700 }}>Teacher score: {item.score} / {item.max_score}</p>}{item.feedback && <p style={{ marginTop: 6 }}>Teacher feedback: {item.feedback}</p>}</div> : <form onSubmit={event => { event.preventDefault(); void submitAssignment(item); }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 14 }} htmlFor={`assignment-answer-${item.id}`}>Your answer</label>
              <textarea id={`assignment-answer-${item.id}`} value={submissionText} onChange={event => setSubmissionText(event.target.value)} rows={7} maxLength={20000} required={item.assignment_type !== "practical" || !evidenceFile} placeholder={item.assignment_type === "practical" ? "Describe what you did, your observations and your conclusion (or attach evidence below)…" : "Type your answer here…"} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, border: "1px solid #cbd5cb", borderRadius: 8, padding: 12, font: "inherit", resize: "vertical" }} />
              {item.assignment_type === "practical" && <label style={{ display: "block", marginTop: 12, fontSize: 13, fontWeight: 700 }}>Attach practical evidence (photo, video or document; max 100 MB)<input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt" onChange={event=>setEvidenceFile(event.target.files?.[0] ?? null)} style={{ display: "block", width: "100%", marginTop: 7, border: "1px solid #cbd5cb", borderRadius: 8, padding: 9, background: "#fff" }} /></label>}
              {evidenceFile && <p style={{ margin: "7px 0 0", fontSize: 12, color: "#536456", overflowWrap: "anywhere" }}>Selected evidence: {evidenceFile.name} · {(evidenceFile.size / (1024 * 1024)).toFixed(1)} MB</p>}
              <button type="submit" disabled={submitting} style={{ marginTop: 10, border: 0, borderRadius: 8, padding: "11px 16px", background: "#17623d", color: "#fff", fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.65 : 1 }}>{submitting ? "Submitting…" : item.submission_status ? "Update submission" : "Submit assignment"}</button>
            </form>}
          </div>}
        </article>)}
      </div>}
  </section>;
}
