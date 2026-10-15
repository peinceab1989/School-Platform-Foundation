
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  School,
  Trash2,
  ListPlus,
} from "lucide-react";
import { useLocation } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type SchoolClass = {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
};

type SchoolSubject = {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  created_at: string;
};

const SUBJECT_SUGGESTIONS: Record<string, string[]> = {
  Playgroup: [
    "Language and Communication",
    "Early Literacy",
    "Early Numeracy",
    "Rhymes, Songs and Stories",
    "Creative Arts and Crafts",
    "Social Habits",
    "Environmental Awareness",
    "Physical Development",
    "Practical Life Skills",
    "Bible Stories and Christian Values",
  ],
  Nursery: [
    "Literacy",
    "Numeracy",
    "Phonics",
    "Rhymes and Songs",
    "Creative Arts",
    "Social Habits",
    "Basic Science",
    "Physical Development",
    "Environmental Awareness",
    "Bible Stories and Christian Values",
  ],
  "Primary Lower": [
    "English Studies",
    "Mathematics",
    "Basic Science",
    "Basic Technology",
    "Nigerian History",
    "Social Studies",
    "Civic Education",
    "Cultural and Creative Arts",
    "Physical and Health Education",
    "Christian Religious Studies",
    "Nigerian Language",
    "Digital Technologies",
    "Agriculture",
    "Practical Skills",
  ],
  "Primary Upper": [
    "English Language",
    "Mathematics",
    "Basic Science",
    "Basic Technology",
    "Nigerian History",
    "Social Studies",
    "Civic Education",
    "Cultural and Creative Arts",
    "Physical and Health Education",
    "Christian Religious Studies",
    "Nigerian Language",
    "Digital Technologies",
    "Agriculture",
    "Home Economics",
    "Entrepreneurship",
    "French",
  ],
  "Junior Secondary": [
    "English Language",
    "Mathematics",
    "Basic Science",
    "Basic Technology",
    "Business Studies",
    "Civic Education",
    "Computer Studies",
    "Social Studies",
    "Nigerian History",
    "Agricultural Science",
    "Christian Religious Studies",
    "Physical and Health Education",
    "Cultural and Creative Arts",
    "Nigerian Language",
    "French",
    "Home Economics",
    "Entrepreneurship",
    "Security Education",
  ],
  "Senior Secondary": [
    "English Language",
    "Mathematics",
    "Citizenship and Heritage Studies",
    "Digital Technologies",
    "Christian Religious Studies",
    "Biology",
    "Chemistry",
    "Physics",
    "Further Mathematics",
    "Agricultural Science",
    "Economics",
    "Government",
    "Literature in English",
    "Geography",
    "Commerce",
    "Financial Accounting",
    "Marketing",
    "Technical Drawing",
    "Computer Studies",
    "Food and Nutrition",
    "Entrepreneurship",
  ],
};

function getSuggestions(schoolClass: SchoolClass): string[] {
  const className = schoolClass.name.toLowerCase();
  const level = (schoolClass.level ?? "").toLowerCase();

  if (className.includes("playgroup")) {
    return SUBJECT_SUGGESTIONS.Playgroup;
  }

  if (level.includes("nursery")) {
    return SUBJECT_SUGGESTIONS.Nursery;
  }

  if (level.includes("primary")) {
    const primaryNumber = Number(
      className.match(/\d+/)?.[0] ?? "0",
    );

    return primaryNumber >= 4
      ? SUBJECT_SUGGESTIONS["Primary Upper"]
      : SUBJECT_SUGGESTIONS["Primary Lower"];
  }

  if (level.includes("junior") || /^jss/i.test(schoolClass.name)) {
    return SUBJECT_SUGGESTIONS["Junior Secondary"];
  }

  if (level.includes("senior") || /^ss/i.test(schoolClass.name)) {
    return SUBJECT_SUGGESTIONS["Senior Secondary"];
  }

  return [];
}

export default function SubjectManagementPage({
  schoolId,
}: {
  schoolId: string;
}) {
  const [, setLocation] = useLocation();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [filterClassId, setFilterClassId] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const client = getSupabaseClient() as any;

      const [classResult, subjectResult] = await Promise.all([
        client
          .from("school_classes")
          .select("id, school_id, name, level")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),

        client
          .from("school_subjects")
          .select("id, school_id, class_id, name, created_at")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
      ]);

      if (classResult.error) throw classResult.error;
      if (subjectResult.error) throw subjectResult.error;

      const loadedClasses = (classResult.data ?? []) as SchoolClass[];
      setClasses(loadedClasses);
      setSubjects((subjectResult.data ?? []) as SchoolSubject[]);

      setSelectedClassId((current) =>
        loadedClasses.some((item) => item.id === current)
          ? current
          : loadedClasses[0]?.id ?? "",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load classes and subjects.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedClass = classes.find(
    (item) => item.id === selectedClassId,
  );

  const suggestions = selectedClass
    ? getSuggestions(selectedClass)
    : [];

  const existingNames = useMemo(
    () =>
      new Set(
        subjects
          .filter((subject) => subject.class_id === selectedClassId)
          .map((subject) => subject.name.trim().toLowerCase()),
      ),
    [subjects, selectedClassId],
  );

  const missingSuggestions = suggestions.filter(
    (suggestion) => !existingNames.has(suggestion.toLowerCase()),
  );

  const visibleSubjects = subjects.filter(
    (subject) =>
      filterClassId === "all" ||
      subject.class_id === filterClassId,
  );

  async function handleCreateSubject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanedName = subjectName.trim();

    if (!selectedClassId) {
      setError("Please create or select a class first.");
      return;
    }

    if (!cleanedName) {
      setError("Enter a subject name.");
      return;
    }

    const duplicate = subjects.some(
      (subject) =>
        subject.class_id === selectedClassId &&
        subject.name.trim().toLowerCase() === cleanedName.toLowerCase(),
    );

    if (duplicate) {
      setError(`${cleanedName} already exists in this class.`);
      return;
    }

    setSaving(true);

    try {
      const client = getSupabaseClient() as any;

      const { error: insertError } = await client
        .from("school_subjects")
        .insert({
          school_id: schoolId,
          class_id: selectedClassId,
          name: cleanedName,
        });

      if (insertError) throw insertError;

      setSubjectName("");
      setMessage(
        `${cleanedName} was added to ${selectedClass?.name ?? "the class"}.`,
      );
      setFilterClassId(selectedClassId);

      await loadData();
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "Could not save the subject.";

      setError(
        messageText.toLowerCase().includes("duplicate") ||
          messageText.includes("school_subjects_unique_per_class")
          ? `${cleanedName} already exists in this class.`
          : messageText,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAllSuggestions() {
    if (!selectedClass || missingSuggestions.length === 0) return;

    setError("");
    setMessage("");
    setAddingAll(true);

    try {
      const client = getSupabaseClient() as any;

      const rows = missingSuggestions.map((name) => ({
        school_id: schoolId,
        class_id: selectedClass.id,
        name,
      }));

      const { error: insertError } = await client
        .from("school_subjects")
        .insert(rows);

      if (insertError) throw insertError;

      const addedCount = missingSuggestions.length;

      setFilterClassId(selectedClass.id);
      setMessage(
        `Successfully added ${addedCount} suggested ${
          addedCount === 1 ? "subject" : "subjects"
        } to ${selectedClass.name}. Existing subjects were kept.`,
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add the suggested subjects.",
      );
    } finally {
      setAddingAll(false);
    }
  }

  async function handleDeleteSubject(subject: SchoolSubject) {
    const className =
      classes.find((item) => item.id === subject.class_id)?.name ??
      "this class";

    const confirmed = window.confirm(
      `Remove ${subject.name} from ${className}?`,
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const client = getSupabaseClient() as any;

      const { error: deleteError } = await client
        .from("school_subjects")
        .delete()
        .eq("id", subject.id)
        .eq("school_id", schoolId);

      if (deleteError) throw deleteError;

      setMessage(`${subject.name} was removed.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not remove this subject.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>

        <header className="rounded-2xl bg-emerald-800 p-6 text-white sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <School className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Subject Management
              </h1>
              <p className="mt-1 text-sm text-emerald-100">
                Organize academic subjects by class at RESA.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Plus className="h-5 w-5 text-emerald-700" />
            Add a subject
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Select a class and enter a subject, or choose a suggestion.
          </p>

          <form
            onSubmit={handleCreateSubject}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="subject-class"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                School class
              </label>
              <select
                id="subject-class"
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setError("");
                  setMessage("");
                }}
                disabled={loading || classes.length === 0}
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
              >
                <option value="">Select a class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.level ?? "Other"}
                  </option>
                ))}
              </select>
            </div>

            {suggestions.length > 0 && (
              <div>
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Suggested subjects for {selectedClass?.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {missingSuggestions.length} not yet registered for this class.
                    These are suggestions; confirm the subjects appropriate to
                    your curriculum and school programme.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => {
                    const alreadyAdded = existingNames.has(
                      suggestion.toLowerCase(),
                    );

                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setSubjectName(suggestion);
                          setError("");
                          setMessage("");
                        }}
                        className={`rounded-full border px-3 py-2 text-xs font-medium ${
                          alreadyAdded
                            ? "border-slate-200 bg-slate-100 text-slate-500"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {alreadyAdded ? "✓ " : ""}
                        {suggestion}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void handleAddAllSuggestions()}
                  disabled={
                    loading ||
                    saving ||
                    addingAll ||
                    missingSuggestions.length === 0
                  }
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {addingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ListPlus className="h-4 w-4" />
                  )}
                  {addingAll
                    ? "Adding subjects..."
                    : missingSuggestions.length === 0
                      ? "All suggestions already added"
                      : `Add All ${missingSuggestions.length} Missing Suggestions`}
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor="subject-name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Subject name
              </label>
              <input
                id="subject-name"
                type="text"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="e.g. Robotics or Mathematics"
                maxLength={100}
                className="min-h-12 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={saving || addingAll || loading || classes.length === 0}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {saving ? "Saving..." : "Add subject"}
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-4 break-words rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              {message}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <BookOpen className="h-5 w-5 text-emerald-700" />
                Registered subjects
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {subjects.length}{" "}
                {subjects.length === 1 ? "subject" : "subjects"} registered
                across all classes.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                aria-label="Filter subjects by class"
                value={filterClassId}
                onChange={(event) => setFilterClassId(event.target.value)}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All classes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              Loading subjects...
            </p>
          ) : visibleSubjects.length > 0 ? (
            <div className="mt-5 space-y-3">
              {visibleSubjects.map((subject) => {
                const classItem = classes.find(
                  (item) => item.id === subject.class_id,
                );

                return (
                  <article
                    key={subject.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <GraduationCap className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold text-slate-800">
                        {subject.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {classItem?.name ?? "Class unavailable"}
                        {classItem?.level ? ` · ${classItem.level}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeleteSubject(subject)}
                      aria-label={`Remove ${subject.name}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">
              {classes.length === 0
                ? "No classes were found. Create your classes first."
                : "No subjects found for this selection. Add a subject above to get started."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
