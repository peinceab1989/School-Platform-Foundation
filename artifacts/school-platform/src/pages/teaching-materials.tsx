import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ArrowLeft, BookOpen, FileText, UploadCloud, Sparkles, Eye, EyeOff, ExternalLink, RefreshCw } from "lucide-react";

type Role = "admin" | "teacher" | "student";
type Material = {
  id: string; title: string; material_type: string; class_id: string | null;
  subject_id: string | null; topic: string | null; description: string | null;
  storage_path: string | null; extracted_text: string | null; uploaded_by: string;
  is_published: boolean; created_at: string;
};
type SchoolClass = { id: string; name: string; level: string | null };
type Subject = { id: string; name: string };

const materialLabels: Record<string, string> = {
  scheme_of_work: "Scheme of work", lesson_note: "Lesson note", worksheet: "Worksheet",
  revision_material: "Revision material", other: "Other",
};
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

export default function TeachingMaterialsPage({ schoolId, userId, role }: { schoolId: string; userId: string; role: Role }) {
  const client = getSupabaseClient();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [form, setForm] = useState({ title: "", type: "lesson_note", classId: "", subjectId: "", topic: "", description: "", extractedText: "" });
  const isStaff = role === "admin" || role === "teacher";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [materialResult, classResult, subjectResult] = await Promise.all([
      client.from("teaching_materials").select("id,title,material_type,class_id,subject_id,topic,description,storage_path,extracted_text,uploaded_by,is_published,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
      client.from("school_classes").select("id,name,level").eq("school_id", schoolId).order("name"),
      client.from("subjects").select("id,name").eq("school_id", schoolId).order("name"),
    ]);
    if (materialResult.error) setError(materialResult.error.message);
    else setMaterials((materialResult.data ?? []) as Material[]);
    if (!classResult.error) setClasses((classResult.data ?? []) as SchoolClass[]);
    if (!subjectResult.error) setSubjects((subjectResult.data ?? []) as Subject[]);
    setLoading(false);
  }, [client, schoolId]);

  useEffect(() => { void load(); }, [load]);

  const visibleMaterials = useMemo(() => materials.filter(m => filterSubject === "all" || m.subject_id === filterSubject), [materials, filterSubject]);
  const className = (id: string | null) => classes.find(c => c.id === id)?.name ?? "All classes";
  const subjectName = (id: string | null) => subjects.find(s => s.id === id)?.name ?? "General / all subjects";

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    let storagePath: string | null = null;
    try {
      if (!form.title.trim()) throw new Error("Enter a clear title for this material.");
      if (!form.extractedText.trim() && !form.description.trim()) throw new Error("Add a short description or paste the teaching content so the material is useful for AI question generation.");
      const recordId = crypto.randomUUID();
      const fileInput = document.getElementById("teaching-material-file") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      if (file) {
        const allowed = ["application/pdf","text/plain","text/markdown","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword"];
        if (!allowed.includes(file.type) && !/\.(pdf|txt|md|doc|docx)$/i.test(file.name)) throw new Error("Upload a PDF, Word document, Markdown or text file.");
        if (file.size > 15 * 1024 * 1024) throw new Error("File size must not exceed 15 MB.");
        storagePath = `${schoolId}/${recordId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const upload = await client.storage.from("resa-teaching-materials").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
        if (upload.error) throw upload.error;
      }
      const insert = await (client as any).from("teaching_materials").insert({
        id: recordId, school_id: schoolId, title: form.title.trim(), material_type: form.type,
        class_id: form.classId || null, subject_id: form.subjectId || null,
        topic: form.topic.trim() || null, description: form.description.trim() || null,
        extracted_text: form.extractedText.trim() || null, storage_path: storagePath,
        uploaded_by: userId, is_published: role === "admin",
      });
      if (insert.error) {
        if (storagePath) await client.storage.from("resa-teaching-materials").remove([storagePath]);
        throw insert.error;
      }
      setForm({ title: "", type: "lesson_note", classId: "", subjectId: "", topic: "", description: "", extractedText: "" });
      if (fileInput) fileInput.value = "";
      setNotice(role === "admin" ? "Material saved and published for students." : "Material saved as a draft. An administrator must publish it before students can access it.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save this material."); }
    finally { setSaving(false); }
  }

  async function togglePublish(item: Material) {
    setBusyId(item.id); setError(""); setNotice("");
    const result = await (client as any).from("teaching_materials").update({ is_published: !item.is_published, updated_at: new Date().toISOString() }).eq("id", item.id).eq("school_id", schoolId);
    if (result.error) setError(result.error.message);
    else { setNotice(item.is_published ? "Material unpublished." : "Material published for students."); await load(); }
    setBusyId("");
  }

  async function openFile(item: Material) {
    if (!item.storage_path) { setError("No uploaded file is attached to this material. The saved text/description is available below."); return; }
    setBusyId(item.id); setError("");
    const result = await client.storage.from("resa-teaching-materials").createSignedUrl(item.storage_path, 60);
    if (result.error || !result.data?.signedUrl) setError(result.error?.message ?? "Could not create a secure file link.");
    else window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
    setBusyId("");
  }

  async function generateFromMaterial(item: Material) {
    const source = [item.title, item.topic, item.description, item.extracted_text].filter(Boolean).join("\n\n").trim();
    if (source.length < 40) { setError("Add the teaching content or paste readable text from the document before generating questions."); return; }
    setBusyId(item.id); setError(""); setNotice("");
    try {
      const { data, error: invokeError } = await client.functions.invoke("resa-ai-practice", { body: { level: className(item.class_id), subject: subjectName(item.subject_id), topic: item.topic ?? item.title, count: 10, sourceText: source } });
      if (invokeError) throw invokeError;
      if (!Array.isArray(data?.questions) || data.questions.length === 0) throw new Error(data?.error ?? "AI did not return questions.");
      const lines = data.questions.map((q: any, i: number) => `${i + 1}. ${q.prompt}\nA. ${q.options?.[0]}\nB. ${q.options?.[1]}\nC. ${q.options?.[2]}\nD. ${q.options?.[3]}\nAnswer: ${["A","B","C","D"][q.answer] ?? "Review"}\nExplanation: ${q.explanation}`).join("\n\n");
      const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `RESA-${item.title.replace(/[^a-z0-9]+/gi,"-")}-AI-practice.txt`; anchor.click(); URL.revokeObjectURL(url);
      setNotice(`Generated ${data.questions.length} draft questions from “${item.title}” and downloaded them for teacher review. They have not been published to students.`);
    } catch (e) { setError(e instanceof Error ? e.message : "AI generation failed. Check the AI service configuration."); }
    finally { setBusyId(""); }
  }

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <Link href={role === "student" ? "/student-dashboard" : role === "teacher" ? "/teacher-dashboard" : "/dashboard"} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to dashboard</Link>
      <header className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA learning hub</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Teaching Materials & AI Test Drills</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">Store schemes of work, lesson notes and revision resources by class and subject. Generate a draft question set from readable teaching content, review it, then let an administrator control student access.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

      {isStaff && <section className={panelClass + " mt-5"}>
        <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><UploadCloud size={22}/></span><div><h2 className="text-lg font-extrabold">Add teaching material</h2><p className="text-sm text-slate-600">Maximum file size 15 MB. Uploaded files stay private.</p></div></div>
        <form onSubmit={e => void submit(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Material title<input required maxLength={180} className={inputClass} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. JSS 2 Basic Science — Energy"/></label>
          <label className="text-sm font-semibold">Type<select className={inputClass} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>{Object.entries(materialLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-sm font-semibold">Class<select className={inputClass} value={form.classId} onChange={e=>setForm(p=>({...p,classId:e.target.value}))}><option value="">All classes / general</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Subject<select className={inputClass} value={form.subjectId} onChange={e=>setForm(p=>({...p,subjectId:e.target.value}))}><option value="">General / all subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Topic or week<input maxLength={180} className={inputClass} value={form.topic} onChange={e=>setForm(p=>({...p,topic:e.target.value}))} placeholder="e.g. Week 4 — Energy"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Attach file (PDF, Word, TXT or MD)<input id="teaching-material-file" type="file" accept=".pdf,.doc,.docx,.txt,.md,application/pdf,text/plain" className={inputClass}/></label>
          <label className="text-sm font-semibold sm:col-span-2">Description<textarea rows={2} maxLength={3000} className={inputClass} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Short summary and learning objectives"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Readable teaching content for AI question generation<textarea rows={5} maxLength={12000} className={inputClass} value={form.extractedText} onChange={e=>setForm(p=>({...p,extractedText:e.target.value}))} placeholder="Paste the text from the uploaded scheme/notes here. The AI uses this text as the primary source; uploaded PDF/Word files are stored privately but are not automatically parsed yet."/></label>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-slate-500">For now, paste document text into the box to ground AI questions in the source. Automatic PDF/Word text extraction is not yet enabled.</p><button disabled={saving} className="rounded-lg bg-emerald-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save material"}</button></div>
        </form>
      </section>}

      <section className={panelClass + " mt-5"}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">{role === "student" ? "Published learning resources" : "Material library"}</h2><p className="text-sm text-slate-600">{visibleMaterials.length} resource(s) · private access controls</p></div><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Refresh</button></div>
        <label className="mt-4 block max-w-sm text-sm font-semibold">Filter by subject<select className={inputClass} value={filterSubject} onChange={e=>setFilterSubject(e.target.value)}><option value="all">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading resources…</p> : visibleMaterials.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No resources found. Published materials will appear here.</p> : <div className="mt-4 space-y-3">{visibleMaterials.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.title}</h3><span className={"rounded-full px-2 py-1 text-xs font-bold "+(item.is_published?"bg-emerald-100 text-emerald-900":"bg-amber-100 text-amber-900")}>{item.is_published?"Published":"Draft"}</span></div><p className="mt-1 text-xs text-slate-500">{materialLabels[item.material_type] ?? item.material_type} · {className(item.class_id)} · {subjectName(item.subject_id)}{item.topic ? " · "+item.topic : ""}</p>{item.description&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.description}</p>}</div></div>
          {item.extracted_text && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-emerald-900">View source text</summary><p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6">{item.extracted_text}</p></details>}
          <div className="mt-3 flex flex-wrap gap-2">{item.storage_path&&<button onClick={()=>void openFile(item)} disabled={busyId===item.id} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><ExternalLink size={15}/>{busyId===item.id?"Opening…":"Open file"}</button>}{isStaff&&item.extracted_text&&<button onClick={()=>void generateFromMaterial(item)} disabled={busyId===item.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-semibold text-white"><Sparkles size={15}/>{busyId===item.id?"Generating…":"Generate 10 AI questions"}</button>}{role==="admin"&&<button onClick={()=>void togglePublish(item)} disabled={busyId===item.id} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">{item.is_published?<EyeOff size={15}/>:<Eye size={15}/>} {item.is_published?"Unpublish":"Publish for students"}</button>}</div>
        </article>)}</div>}
      </section>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">AI questions are drafts and should be checked by a teacher before use. Current AI source support uses pasted text; automatic PDF/Word extraction and saved student drill attempts are separate follow-up steps.</p>
    </div>
  </main>;
}
