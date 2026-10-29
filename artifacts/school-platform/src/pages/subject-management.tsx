
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Filter,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
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
  name: string;
  code: string | null;
  created_at: string;
  department_id: string | null;
};

type ClassSubject = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  created_at: string;
};

type StreamPathway = "Science" | "Commercial" | "Arts/Humanities";

type StreamSubject = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  pathway: StreamPathway;
  created_at: string;
};

type Category =
  | "All subjects"
  | "Core"
  | "Science"
  | "Commercial"
  | "Arts/Humanities"
  | "Other";

const PATHWAYS: StreamPathway[] = [
  "Science",
  "Commercial",
  "Arts/Humanities",
];

const CATEGORIES: Category[] = [
  "All subjects",
  "Core",
  "Science",
  "Commercial",
  "Arts/Humanities",
  "Other",
];

const CORE_SUBJECTS = [
  "english language",
  "mathematics",
  "civic education",
  "digital literacy",
  "citizenship and heritage studies",
];

const SCIENCE_SUBJECTS = [
  "biology",
  "chemistry",
  "physics",
  "further mathematics",
  "agricultural science",
  "geography",
  "technical drawing",
  "computer studies",
  "computer science",
  "basic science",
  "basic technology",
  "health education",
  "physical and health education",
  "food and nutrition",
  "home economics",
  "animal husbandry",
  "data processing",
  "information technology",
  "science",
];

const COMMERCIAL_SUBJECTS = [
  "economics",
  "commerce",
  "financial accounting",
  "accounting",
  "marketing",
  "business studies",
  "entrepreneurship",
  "office practice",
  "insurance",
  "book keeping",
  "store management",
];

const ARTS_SUBJECTS = [
  "government",
  "literature in english",
  "history",
  "visual arts",
  "fine arts",
  "christian religious studies",
  "islamic religious studies",
  "nigerian languages",
  "french",
  "igbo",
  "yoruba",
  "edo",
  "music",
  "theatre arts",
  "cultural and creative arts",
  "citizenship and heritage studies",
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function categoriesForSubject(subject: SchoolSubject): Category[] {
  const name = normalize(subject.name);
  const categories: Category[] = [];

  if (CORE_SUBJECTS.includes(name)) categories.push("Core");
  if (SCIENCE_SUBJECTS.includes(name)) categories.push("Science");
  if (COMMERCIAL_SUBJECTS.includes(name)) categories.push("Commercial");
  if (ARTS_SUBJECTS.includes(name)) categories.push("Arts/Humanities");

  if (categories.length === 0) categories.push("Other");

  return categories;
}

function classSortOrder(schoolClass: SchoolClass) {
  const level = normalize(schoolClass.level);
  const name = normalize(schoolClass.name);

  if (level.includes("nursery") || name.includes("nursery")) return 1;
  if (level.includes("primary") || name.includes("primary")) return 2;
  if (
    level.includes("junior") ||
    level === "jss" ||
    /^jss\s*[123]$/.test(name)
  ) {
    return 3;
  }
  if (
    level.includes("senior") ||
    level === "ss" ||
    /^ss\s*[123]$/.test(name)
  ) {
    return 4;
  }

  return 5;
}

function isSeniorSecondaryClass(schoolClass: SchoolClass) {
  const name = normalize(schoolClass.name).replace(/[\s.-]+/g, "");
  const level = normalize(schoolClass.level);

  return (
    /^ss[123]$/.test(name) ||
    /^seniorsecondary[123]$/.test(name) ||
    (level.includes("senior secondary") && /[123]$/.test(name))
  );
}

function pathwayColor(pathway: StreamPathway) {
  switch (pathway) {
    case "Science":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "Commercial":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Arts/Humanities":
      return "border-purple-200 bg-purple-50 text-purple-800";
  }
}

export default function SubjectsPage({
  schoolId,
}: {
  schoolId: string;
}) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [assignments, setAssignments] = useState<ClassSubject[]>([]);
  const [streamAssignments, setStreamAssignments] = useState<StreamSubject[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStreamClassId, setSelectedStreamClassId] = useState("");
  const [selectedPathway, setSelectedPathway] =
    useState<StreamPathway>("Science");

  const [selectedCategory, setSelectedCategory] =
    useState<Category>("All subjects");
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingSubject, setSavingSubject] = useState(false);
  const [busySubjectIds, setBusySubjectIds] = useState<string[]>([]);
  const [busyStreamSubjectIds, setBusyStreamSubjectIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = getSupabaseClient() as any;

  const loadData = useCallback(async () => {
    if (!schoolId) {
      setError("The school ID is missing. Please return to the dashboard.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [
        classesResult,
        subjectsResult,
        assignmentsResult,
        streamAssignmentsResult,
      ] = await Promise.all([
        supabase
          .from("school_classes")
          .select("id, school_id, name, level")
          .eq("school_id", schoolId),

        supabase
          .from("subjects")
          .select("id, school_id, name, code, created_at, department_id")
          .eq("school_id", schoolId),

        supabase
          .from("class_subjects")
          .select("id, school_id, class_id, subject_id, created_at")
          .eq("school_id", schoolId),

        supabase
          .from("class_stream_subjects")
          .select("id, school_id, class_id, subject_id, pathway, created_at")
          .eq("school_id", schoolId),
      ]);

      if (classesResult.error) throw classesResult.error;
      if (subjectsResult.error) throw subjectsResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (streamAssignmentsResult.error) {
        throw new Error(
          `Pathway assignments could not be loaded: ${streamAssignmentsResult.error.message}`,
        );
      }

      const loadedClasses = (
        (classesResult.data ?? []) as SchoolClass[]
      ).slice().sort((a, b) => {
        const difference = classSortOrder(a) - classSortOrder(b);
        return difference || a.name.localeCompare(b.name);
      });

      const loadedSubjects = (
        (subjectsResult.data ?? []) as SchoolSubject[]
      ).slice().sort((a, b) => a.name.localeCompare(b.name));

      const loadedAssignments =
        (assignmentsResult.data ?? []) as ClassSubject[];

      const loadedStreamAssignments =
        (streamAssignmentsResult.data ?? []) as StreamSubject[];

      const seniorClasses = loadedClasses.filter(isSeniorSecondaryClass);

      setClasses(loadedClasses);
      setSubjects(loadedSubjects);
      setAssignments(loadedAssignments);
      setStreamAssignments(loadedStreamAssignments);

      setSelectedClassId((current) => {
        if (loadedClasses.some((item) => item.id === current)) {
          return current;
        }

        const ss1 = seniorClasses.find(
          (item) => normalize(item.name).replace(/\s+/g, "") === "ss1",
        );

        return ss1?.id ?? loadedClasses[0]?.id ?? "";
      });

      setSelectedStreamClassId((current) => {
        if (seniorClasses.some((item) => item.id === current)) {
          return current;
        }

        const ss1 = seniorClasses.find(
          (item) => normalize(item.name).replace(/\s+/g, "") === "ss1",
        );

        return ss1?.id ?? seniorClasses[0]?.id ?? "";
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The subject data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId),
    [classes, selectedClassId],
  );

  const seniorClasses = useMemo(
    () => classes.filter(isSeniorSecondaryClass),
    [classes],
  );

  const selectedStreamClass = useMemo(
    () => seniorClasses.find((item) => item.id === selectedStreamClassId),
    [seniorClasses, selectedStreamClassId],
  );

  const selectedClassAssignments = useMemo(
    () => assignments.filter((item) => item.class_id === selectedClassId),
    [assignments, selectedClassId],
  );

  const assignedSubjectIds = useMemo(
    () => new Set(selectedClassAssignments.map((item) => item.subject_id)),
    [selectedClassAssignments],
  );

  const selectedStreamAssignments = useMemo(
    () =>
      streamAssignments.filter(
        (item) =>
          item.class_id === selectedStreamClassId &&
          item.pathway === selectedPathway,
      ),
    [streamAssignments, selectedStreamClassId, selectedPathway],
  );

  const streamAssignedSubjectIds = useMemo(
    () => new Set(selectedStreamAssignments.map((item) => item.subject_id)),
    [selectedStreamAssignments],
  );

  const visibleSubjects = useMemo(() => {
    const search = normalize(searchTerm);

    return subjects.filter((subject) => {
      const matchesSearch =
        !search ||
        normalize(subject.name).includes(search) ||
        normalize(subject.code).includes(search);

      const matchesCategory =
        selectedCategory === "All subjects" ||
        categoriesForSubject(subject).includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [subjects, searchTerm, selectedCategory]);

  const handleAddSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = subjectName.trim();
    const code = subjectCode.trim();

    if (!name) {
      setError("Enter a subject name.");
      return;
    }

    if (
      subjects.some((subject) => normalize(subject.name) === normalize(name))
    ) {
      setError(
        "That subject is already in the central catalogue. Select it below to assign it.",
      );
      return;
    }

    setSavingSubject(true);
    setError("");
    setNotice("");

    try {
      const newSubject: {
        school_id: string;
        name: string;
        code?: string;
      } = {
        school_id: schoolId,
        name,
      };

      if (code) newSubject.code = code;

      const { data, error: insertError } = await supabase
        .from("subjects")
        .insert(newSubject)
        .select("id, school_id, name, code, created_at, department_id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error(
            "This subject or subject code already exists in the catalogue.",
          );
        }
        throw insertError;
      }

      setSubjects((current) =>
        [...current, data as SchoolSubject].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      setSubjectName("");
      setSubjectCode("");
      setNotice(
        `${name} was added to the catalogue. You can assign it to classes or pathways below.`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "The subject could not be added.",
      );
    } finally {
      setSavingSubject(false);
    }
  };

  const handleAssignmentChange = async (
    subject: SchoolSubject,
    shouldAssign: boolean,
  ) => {
    if (!selectedClassId || busySubjectIds.includes(subject.id)) return;

    setError("");
    setNotice("");
    setBusySubjectIds((current) => [...current, subject.id]);

    try {
      if (shouldAssign) {
        const { data, error: insertError } = await supabase
          .from("class_subjects")
          .insert({
            school_id: schoolId,
            class_id: selectedClassId,
            subject_id: subject.id,
          })
          .select("id, school_id, class_id, subject_id, created_at")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            setNotice(
              `${subject.name} is already assigned to ${selectedClass?.name ?? "this class"}.`,
            );
            return;
          }
          throw insertError;
        }

        setAssignments((current) =>
          current.some(
            (item) =>
              item.class_id === selectedClassId &&
              item.subject_id === subject.id,
          )
            ? current
            : [...current, data as ClassSubject],
        );

        setNotice(
          `${subject.name} assigned to ${selectedClass?.name ?? "the selected class"}.`,
        );
      } else {
        const { error: deleteError } = await supabase
          .from("class_subjects")
          .delete()
          .eq("school_id", schoolId)
          .eq("class_id", selectedClassId)
          .eq("subject_id", subject.id);

        if (deleteError) throw deleteError;

        setAssignments((current) =>
          current.filter(
            (item) =>
              !(
                item.class_id === selectedClassId &&
                item.subject_id === subject.id
              ),
          ),
        );

        setNotice(
          `${subject.name} removed from ${selectedClass?.name ?? "the selected class"}. The catalogue subject remains available.`,
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The class assignment could not be updated.",
      );
    } finally {
      setBusySubjectIds((current) =>
        current.filter((id) => id !== subject.id),
      );
    }
  };

  const handleStreamAssignmentChange = async (
    subject: SchoolSubject,
    shouldAssign: boolean,
  ) => {
    if (
      !selectedStreamClassId ||
      busyStreamSubjectIds.includes(subject.id)
    ) {
      return;
    }

    setError("");
    setNotice("");
    setBusyStreamSubjectIds((current) => [...current, subject.id]);

    try {
      if (shouldAssign) {
        const { data, error: insertError } = await supabase
          .from("class_stream_subjects")
          .insert({
            school_id: schoolId,
            class_id: selectedStreamClassId,
            subject_id: subject.id,
            pathway: selectedPathway,
          })
          .select("id, school_id, class_id, subject_id, pathway, created_at")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            setNotice(
              `${subject.name} is already assigned to ${selectedStreamClass?.name} ${selectedPathway}.`,
            );
            return;
          }
          throw insertError;
        }

        setStreamAssignments((current) =>
          current.some(
            (item) =>
              item.class_id === selectedStreamClassId &&
              item.pathway === selectedPathway &&
              item.subject_id === subject.id,
          )
            ? current
            : [...current, data as StreamSubject],
        );

        setNotice(
          `${subject.name} assigned to ${selectedStreamClass?.name} — ${selectedPathway}.`,
        );
      } else {
        const { error: deleteError } = await supabase
          .from("class_stream_subjects")
          .delete()
          .eq("school_id", schoolId)
          .eq("class_id", selectedStreamClassId)
          .eq("subject_id", subject.id)
          .eq("pathway", selectedPathway);

        if (deleteError) throw deleteError;

        setStreamAssignments((current) =>
          current.filter(
            (item) =>
              !(
                item.class_id === selectedStreamClassId &&
                item.pathway === selectedPathway &&
                item.subject_id === subject.id
              ),
          ),
        );

        setNotice(
          `${subject.name} removed from ${selectedStreamClass?.name} — ${selectedPathway}. Its catalogue record and ordinary class assignment are unchanged.`,
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The pathway assignment could not be updated.",
      );
    } finally {
      setBusyStreamSubjectIds((current) =>
        current.filter((id) => id !== subject.id),
      );
    }
  };

  const assignedVisibleCount = visibleSubjects.filter((subject) =>
    assignedSubjectIds.has(subject.id),
  ).length;

  const streamAssignedVisibleCount = visibleSubjects.filter((subject) =>
    streamAssignedSubjectIds.has(subject.id),
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold sm:text-xl">
                Subjects Management
              </h1>
              <p className="text-sm text-slate-500">RESA School Portal</p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-700 p-5 text-white shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="hidden rounded-xl bg-white/10 p-3 sm:block">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Central Subject Catalogue
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50 sm:text-base">
                Maintain one school-wide subject catalogue, assign subjects
                to individual classes, and create separate subject combinations
                for Science, Commercial and Arts/Humanities in SS 1, SS 2 and SS 3.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <ShieldCheck className="h-4 w-4" />
              School-scoped records
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Ordinary class assignments
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Independent SS pathways
            </span>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded p-1 hover:bg-red-100"
            >
              ×
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">{notice}</div>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
              className="rounded p-1 hover:bg-emerald-100"
            >
              ×
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Catalogue subjects</p>
            <p className="mt-2 text-3xl font-bold">{subjects.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              Subjects available for assignment
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Selected class assignments</p>
            <p className="mt-2 text-3xl font-bold">
              {selectedClassAssignments.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedClass?.name ?? "Choose a class"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Classes available</p>
            <p className="mt-2 text-3xl font-bold">{classes.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              Nursery through Senior Secondary
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <details>
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 font-bold text-slate-900">
              <span>1. Add a subject to the catalogue</span>
              <span className="text-sm font-semibold text-emerald-800">Tap to open</span>
            </summary>
            <p className="mt-3 mb-4 text-sm text-slate-500">
              Add each subject once, then assign it to any applicable class or
              senior-secondary pathway.
            </p>
          <form
            onSubmit={handleAddSubject}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
          >
            <div>
              <label
                htmlFor="subject-name"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Subject name
              </label>
              <input
                id="subject-name"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="e.g. Computer Science"
                maxLength={120}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="subject-code"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Subject code (optional)
              </label>
              <input
                id="subject-code"
                value={subjectCode}
                onChange={(event) => setSubjectCode(event.target.value)}
                placeholder="e.g. CSC101"
                maxLength={40}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={savingSubject || !subjectName.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {savingSubject ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add subject
              </button>
            </div>
          </form>
          </details>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <h2 className="text-lg font-bold">
              2. Assign subjects to ordinary classes
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              These assignments remain separate from senior-secondary pathway
              assignments. Changing a class only changes the records shown here.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="class-select"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Select class
                </label>
                <div className="relative">
                  <select
                    id="class-select"
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    disabled={loading || classes.length === 0}
                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-3 pr-10 text-sm font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                  >
                    {classes.length === 0 && (
                      <option value="">No classes available</option>
                    )}
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="subject-search"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Search catalogue
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="subject-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name or code..."
                    className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter className="h-4 w-4" />
                Filter by subject group
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => {
                  const active = selectedCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Categories help you find subjects. They do not restrict which
                subjects can be assigned.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
            <div className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {visibleSubjects.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {subjects.length}
              </span>{" "}
              subjects
              {selectedClass && (
                <>
                  {" · "}
                  <span className="font-semibold text-slate-900">
                    {assignedVisibleCount}
                  </span>{" "}
                  assigned in {selectedClass.name}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
              <p className="text-sm">Loading subjects and assignments...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="p-8 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-semibold">No classes found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add classes to this school before assigning subjects.
              </p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-semibold">The subject catalogue is empty</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add a subject using the form above to begin.
              </p>
            </div>
          ) : visibleSubjects.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 font-semibold">No matching subjects</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try another search term or choose a different group.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleSubjects.map((subject) => {
                const isAssigned = assignedSubjectIds.has(subject.id);
                const isBusy = busySubjectIds.includes(subject.id);
                const groups = categoriesForSubject(subject).filter(
                  (category) => category !== "Other",
                );

                return (
                  <label
                    key={subject.id}
                    className={`flex cursor-pointer items-start gap-3 px-5 py-4 transition hover:bg-emerald-50/50 sm:items-center sm:px-6 ${
                      isAssigned ? "bg-emerald-50/40" : "bg-white"
                    } ${isBusy ? "opacity-70" : ""}`}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                      {isBusy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          disabled={isBusy || !selectedClassId}
                          onChange={(event) =>
                            void handleAssignmentChange(
                              subject,
                              event.target.checked,
                            )
                          }
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-700 focus:ring-emerald-600"
                          aria-label={`${isAssigned ? "Remove" : "Assign"} ${subject.name} ${selectedClass?.name ?? "to selected class"}`}
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {subject.name}
                        </span>
                        {subject.code && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {subject.code}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {groups.length > 0 ? (
                          groups.map((group) => (
                            <span
                              key={group}
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500"
                            >
                              {group}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                            Other
                          </span>
                        )}
                      </span>
                    </span>

                    <span
                      className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isAssigned
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isAssigned && <Check className="h-3.5 w-3.5" />}
                      {isAssigned ? "Assigned" : "Not assigned"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              Removing an ordinary class assignment does not delete the
              catalogue subject, pathway assignments, or assignments in other
              classes.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 p-5 text-white sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">
                  3. Senior Secondary Pathway Management
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">
                  Build separate subject combinations for each senior-secondary
                  class and pathway. These assignments are stored independently
                  from ordinary class assignments.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {PATHWAYS.map((pathway) => (
                <span
                  key={pathway}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm"
                >
                  {pathway}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {seniorClasses.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                No SS 1, SS 2 or SS 3 class was recognised. Check the class names
                in Classes Management. This section recognises names such as
                SS 1, SS1, Senior Secondary 1, and their SS 2 and SS 3 equivalents.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="stream-class-select"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Select senior-secondary class
                    </label>
                    <div className="relative">
                      <select
                        id="stream-class-select"
                        value={selectedStreamClassId}
                        onChange={(event) =>
                          setSelectedStreamClassId(event.target.value)
                        }
                        disabled={loading}
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-3 pr-10 text-sm font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      >
                        {seniorClasses.map((schoolClass) => (
                          <option key={schoolClass.id} value={schoolClass.id}>
                            {schoolClass.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="pathway-select"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Select pathway
                    </label>
                    <div className="relative">
                      <select
                        id="pathway-select"
                        value={selectedPathway}
                        onChange={(event) =>
                          setSelectedPathway(event.target.value as StreamPathway)
                        }
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-3 pr-10 text-sm font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      >
                        {PATHWAYS.map((pathway) => (
                          <option key={pathway} value={pathway}>
                            {pathway}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Current pathway
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        {selectedStreamClass?.name ?? "Select a class"} —{" "}
                        {selectedPathway}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedStreamAssignments.length} subject
                        {selectedStreamAssignments.length === 1 ? "" : "s"} assigned
                        to this pathway.
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${pathwayColor(selectedPathway)}`}
                    >
                      {selectedPathway}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {PATHWAYS.map((pathway) => {
                      const count = streamAssignments.filter(
                        (item) =>
                          item.class_id === selectedStreamClassId &&
                          item.pathway === pathway,
                      ).length;

                      return (
                        <button
                          key={pathway}
                          type="button"
                          onClick={() => setSelectedPathway(pathway)}
                          aria-pressed={selectedPathway === pathway}
                          className={`rounded-xl border p-3 text-left transition ${
                            selectedPathway === pathway
                              ? "border-emerald-600 bg-white ring-2 ring-emerald-100"
                              : "border-slate-200 bg-white hover:border-emerald-300"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-slate-800">
                            {pathway}
                          </span>
                          <span className="mt-1 block text-2xl font-bold text-emerald-800">
                            {count}
                          </span>
                          <span className="text-xs text-slate-500">
                            assigned subjects
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900">
                      Assign subjects to this pathway
                    </h3>
                    <span className="text-sm text-slate-500">
                      {streamAssignedVisibleCount} of {visibleSubjects.length}{" "}
                      visible subjects assigned
                    </span>
                  </div>

                  <p className="mb-4 text-sm leading-6 text-slate-600">
                    Use the catalogue search and category filters above to find
                    subjects. Tick a subject to assign it to the selected
                    class and pathway. Untick it to remove only that pathway
                    assignment.
                  </p>

                  {loading ? (
                    <div className="flex min-h-32 items-center justify-center gap-3 text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
                      <span className="text-sm">Loading pathway assignments...</span>
                    </div>
                  ) : visibleSubjects.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                      No catalogue subjects match your current search and
                      category filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {visibleSubjects.map((subject) => {
                        const isAssigned = streamAssignedSubjectIds.has(subject.id);
                        const isBusy = busyStreamSubjectIds.includes(subject.id);
                        const groups = categoriesForSubject(subject).filter(
                          (category) => category !== "Other",
                        );

                        return (
                          <label
                            key={subject.id}
                            className={`flex cursor-pointer items-start gap-3 px-4 py-4 transition hover:bg-emerald-50/50 sm:items-center ${
                              isAssigned ? "bg-emerald-50/50" : "bg-white"
                            } ${isBusy ? "opacity-70" : ""}`}
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                              {isBusy ? (
                                <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  disabled={isBusy || !selectedStreamClassId}
                                  onChange={(event) =>
                                    void handleStreamAssignmentChange(
                                      subject,
                                      event.target.checked,
                                    )
                                  }
                                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-700 focus:ring-emerald-600"
                                  aria-label={`${isAssigned ? "Remove" : "Assign"} ${subject.name} ${selectedStreamClass?.name ?? "class"} ${selectedPathway}`}
                                />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {subject.name}
                                </span>
                                {subject.code && (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {subject.code}
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1.5">
                                {groups.length > 0 ? (
                                  groups.map((group) => (
                                    <span
                                      key={group}
                                      className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500"
                                    >
                                      {group}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                                    Other
                                  </span>
                                )}
                              </span>
                            </span>

                            <span
                              className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                isAssigned
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isAssigned && (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              {isAssigned ? "Assigned" : "Not assigned"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  <strong>Important:</strong> Each pathway has its own
                  assignments. For example, assigning Physics to SS 1 Science
                  does not automatically assign Physics to SS 1 Commercial,
                  SS 2 Science or SS 3 Science. Configure each combination
                  separately. These pathway records do not alter the ordinary
                  class assignments above.
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="pb-4 text-center text-xs text-slate-400">
          RESA School Portal · Ordinary class assignments and senior-secondary
          pathway assignments are stored separately.
        </footer>
      </main>
    </div>
  );
}
