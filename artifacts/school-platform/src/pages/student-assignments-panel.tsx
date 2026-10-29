import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, CalendarClock, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Assignment = { id: string; title: string; description: string | null; instructions: string | null; due_date: string | null; max_score: number; class_name: string; subject_name: string; submission_status: string | null; score: number | null; feedback: string | null };

export default function StudentAssignmentsPanel({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emptyReason, setEmptyReason] = useState("No published assignments are available for your current enrolment yet.");
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
        db.from("assignments").select("id,title,description,instructions,due_date,max_score,subject_id").eq("school_id", schoolId).eq("class_id", enrollment.class_id).eq("academic_session_id", enrollment.academic_session_id).eq("status", "published").order("due_date", { ascending: true }),
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
        db.from("assignment_submissions").select("assignment_id,status,score,feedback").eq("school_id", schoolId).eq("student_id", student.data.id).in("assignment_id", assignmentIds),
      ]);
      if (subjectResult.error) throw subjectResult.error;
      if (submissionResult.error) setNotice("Assignments are loaded, but submission status is temporarily unavailable.");
      const subjectNames = new Map((subjectResult.data ?? []).map((item: any) => [item.id, item.name]));
      const submissions = new Map((submissionResult.data ?? []).map((item: any) => [item.assignment_id, item]));
      setItems(assignments.map((item: any) => {
        const submission: any = submissions.get(item.id);
        return { id: item.id, title: item.title, description: item.description, instructions: item.instructions, due_date: item.due_date, max_score: item.max_score, class_name: classResult.data?.name ?? "Class unavailable", subject_name: subjectNames.get(item.subject_id) ?? "Subject unavailable", submission_status: submission?.status ?? null, score: submission?.score ?? null, feedback: submission?.feedback ?? null };
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "Assignments could not be loaded. Refresh and try again."); }
    finally { setLoading(false); }
  }, [schoolId, userId]);
  useEffect(() => { void load(); }, [load]);
  return <section style={{ background: "#fff", border: "1px solid #e0e7e0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><BookOpenCheck size={23} color="#17623d" /><div><h2 style={{ margin: 0, fontSize: 21 }}>My Assignments</h2><p style={{ margin: "5px 0 0", color: "#536456", fontSize: 13 }}>Published work for your active class and academic session.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #d1ddd1", borderRadius: 8, padding: "8px 10px", color: "#17623d", background: "#fff", fontWeight: 600, fontSize: 13 }}><RefreshCw size={14}/>{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {loading ? <p style={{ display: "flex", alignItems: "center", gap: 8, color: "#536456", marginTop: 16 }}><Loader2 size={17}/> Loading assignments…</p> : error ? <p role="alert" style={{ color: "#9b2c2c", overflowWrap: "anywhere", marginTop: 16 }}>{error}</p> : !items.length ? <p style={{ color: "#536456", marginTop: 16 }}>{emptyReason}</p> :
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {notice && <p role="status" style={{ margin: 0, padding: 10, borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 13 }}>{notice}</p>}
        {items.map(item => <article key={item.id} style={{ border: "1px solid #dce5dc", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><h3 style={{ margin: 0, fontSize: 16 }}>{item.title}</h3><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: item.submission_status ? "#17623d" : "#8a6415" }}>{item.submission_status ? <CheckCircle2 size={14}/> : null}{item.submission_status ? item.submission_status.replaceAll("_", " ") : "Not submitted"}</span></div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#536456" }}><strong>Class:</strong> {item.class_name} · <strong>Subject:</strong> {item.subject_name}</p>
          <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, margin: "6px 0 0", fontSize: 13, color: "#536456" }}><strong>Maximum score:</strong> {item.max_score}{item.due_date ? <><span>·</span><CalendarClock size={14}/><strong>Due:</strong> {new Date(item.due_date).toLocaleString()}</> : null}</p>
          {item.description && <p style={{ margin: "9px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.description}</p>}
          {item.instructions && <p style={{ margin: "7px 0 0", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, color: "#536456" }}>{item.instructions}</p>}
          {item.score !== null && <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Score: {item.score} / {item.max_score}</p>}
          {item.feedback && <p style={{ margin: "6px 0 0", fontSize: 13 }}>Teacher feedback: {item.feedback}</p>}
        </article>)}
      </div>}
  </section>;
}
