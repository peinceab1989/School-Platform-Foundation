import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Search,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  School,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type SchoolClass = {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
  created_at: string;
};

const CLASS_OPTIONS = [
  { level: "Nursery", name: "Playgroup" },
  { level: "Nursery", name: "Nursery 1" },
  { level: "Nursery", name: "Nursery 2" },
  { level: "Nursery", name: "Nursery 3" },
  { level: "Primary", name: "Primary 1" },
  { level: "Primary", name: "Primary 2" },
  { level: "Primary", name: "Primary 3" },
  { level: "Primary", name: "Primary 4" },
  { level: "Primary", name: "Primary 5" },
  { level: "Primary", name: "Primary 6" },
  { level: "Junior Secondary", name: "JSS 1" },
  { level: "Junior Secondary", name: "JSS 2" },
  { level: "Junior Secondary", name: "JSS 3" },
  { level: "Senior Secondary", name: "SS 1" },
  { level: "Senior Secondary", name: "SS 2" },
  { level: "Senior Secondary", name: "SS 3" },
];

const LEVELS = [
  "Nursery",
  "Primary",
  "Junior Secondary",
  "Senior Secondary",
];

export default function ClassManagementPage({ schoolId }: { schoolId: string }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("Primary 1");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("");

  const loadClasses = useCallback(async () => {
    if (!schoolId) {
      setError("The school ID is missing. Please return to the dashboard.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const client = getSupabaseClient() as any;
      const { data, error: queryError } = await client
        .from("school_classes")
        .select("id, school_id, name, level, created_at")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });
      if (queryError) throw queryError;
      setClasses((data ?? []) as SchoolClass[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load classes. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const option = CLASS_OPTIONS.find((item) => item.name === selectedClass);
    if (!option) {
      setError("Please select a valid class.");
      return;
    }
    if (classes.some((item) => item.name.trim().toLowerCase() === option.name.toLowerCase())) {
      setError(`${option.name} already exists in your school.`);
      return;
    }
    setSaving(true);
    try {
      const client = getSupabaseClient() as any;
      const { error: insertError } = await client.from("school_classes").insert({
        school_id: schoolId,
        name: option.name,
        level: option.level,
      });
      if (insertError) throw insertError;
      setMessage(`${option.name} was created successfully.`);
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this class. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: SchoolClass) {
    setEditingClass(item);
    setEditName(item.name);
    setEditLevel(item.level ?? "");
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingClass(null);
    setEditName("");
    setEditLevel("");
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingClass) return;
    const name = editName.trim();
    const level = editLevel.trim();
    setError("");
    setMessage("");
    if (!name) {
      setError("Enter a class name before saving.");
      return;
    }
    const duplicate = classes.some(
      (item) => item.id !== editingClass.id && item.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      setError(`A class named "${name}" already exists. Choose a different name.`);
      return;
    }
    setSaving(true);
    try {
      const client = getSupabaseClient() as any;
      const { data, error: updateError } = await client
        .from("school_classes")
        .update({ name, level: level || null })
        .eq("school_id", schoolId)
        .eq("id", editingClass.id)
        .select("id");
      if (updateError) throw updateError;
      if (!data?.length) {
        throw new Error("The class was not updated. Check that you have permission to manage classes, then refresh and try again.");
      }
      setMessage(`Class updated to "${name}". Existing enrolments and historical results were not changed.`);
      cancelEdit();
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this class. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleBackToDashboard() {
    window.location.assign("/dashboard");
  }

  const normalizedClassSearch = classSearch.trim().toLowerCase();
  const filteredClasses = classes.filter((item) =>
    [item.name, item.level].some((value) => String(value ?? "").toLowerCase().includes(normalizedClassSearch)),
  );
  const groupedLevels = useMemo(() => {
    const known = [...LEVELS];
    const additional = [...new Set(filteredClasses.map((item) => item.level?.trim()).filter((value): value is string => Boolean(value) && !known.includes(value!)))].sort();
    return [...known, ...additional, ...(filteredClasses.some((item) => !item.level) ? ["Uncategorised"] : [])];
  }, [filteredClasses]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button type="button" onClick={handleBackToDashboard} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        <header className="rounded-2xl bg-emerald-800 p-6 text-white sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-3"><School className="h-7 w-7" /></div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Class Management</h1>
              <p className="mt-1 text-sm text-emerald-100">Manage RESA Nursery, Primary and Secondary classes.</p>
            </div>
          </div>
        </header>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        {editingClass && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><Pencil className="h-5 w-5 text-emerald-700" /> Edit class</h2>
                <p className="mt-1 text-sm text-slate-500">Change the class label or academic level. Linked student and result records remain attached to this class.</p>
              </div>
              <button type="button" onClick={cancelEdit} aria-label="Cancel editing" className="rounded-lg border p-2 hover:bg-slate-50"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">Class name
                <input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} required className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Academic level
                <input value={editLevel} onChange={(event) => setEditLevel(event.target.value)} maxLength={80} placeholder="e.g. Primary" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button type="button" onClick={cancelEdit} disabled={saving} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 font-bold text-slate-900">
              <span className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-700" />Create a class</span>
              <span className="text-sm font-semibold text-emerald-800">Tap to open</span>
            </summary>
            <div className="pt-3">
              <p className="mt-1 text-sm text-slate-500">Choose a suggested class and add it to your school. Existing classes can be renamed below.</p>
              <form onSubmit={handleCreateClass} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm">
                  {LEVELS.map((level) => (
                    <optgroup key={level} label={level}>
                      {CLASS_OPTIONS.filter((item) => item.level === level).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? "Creating..." : "Create class"}
                </button>
              </form>
            </div>
          </details>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="h-5 w-5 text-emerald-700" />Existing classes</h2>
              <p className="mt-1 text-sm text-slate-500">Search, review and safely rename existing classes without moving enrolled students.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">{classes.length} classes</span>
              <button type="button" onClick={() => void loadClasses()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>

          <label className="relative mt-5 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Search class name or level…" aria-label="Search classes" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupedLevels.map((level) => {
              const levelClasses = filteredClasses.filter((item) => (item.level?.trim() || "Uncategorised") === level);
              return (
                <article key={level} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-800">{level}</h3>
                  <p className="mt-1 text-sm text-slate-500">{levelClasses.length} {levelClasses.length === 1 ? "class" : "classes"}</p>
                  {levelClasses.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {levelClasses.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2"><GraduationCap className="h-4 w-4 shrink-0 text-emerald-700" /><span className="truncate font-medium">{item.name}</span></span>
                          <button type="button" onClick={() => beginEdit(item)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" aria-label={`Edit ${item.name}`}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-slate-400">No classes added yet.</p>}
                </article>
              );
            })}
          </div>

          {!loading && filteredClasses.length === 0 && <p className="mt-5 rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">{classSearch.trim() ? "No classes match your search." : "No classes have been created yet. Select a class above to get started."}</p>}
          {loading && <p className="mt-5 text-center text-sm text-slate-500">Loading classes...</p>}
        </section>
      </div>
    </main>
  );
}
