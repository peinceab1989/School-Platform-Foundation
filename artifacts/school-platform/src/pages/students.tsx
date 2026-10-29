
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Users,
  Pencil,
  X,
  UserPlus,
  ShieldCheck,
  KeyRound,
  MoreVertical,
  Eye,
} from "lucide-react";
import { useLocation } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Student = {
  id: string;
  school_id: string;
  person_id: string;
  admission_number: string;
  admission_date: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
};

type StudentForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  admission_number: string;
  admission_date: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  status: string;
};

const emptyForm: StudentForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  admission_number: "",
  admission_date: new Date().toISOString().slice(0, 10),
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  status: "active",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fullName(student: Student): string {
  return [
    student.first_name,
    student.middle_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizedStatus(status: string | null | undefined): string {
  return (status || "active").toLowerCase();
}

function displayStatus(status: string): string {
  const value = normalizedStatus(status);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

export default function StudentsPage({
  schoolId,
}: {
  schoolId: string;
}) {
  const [, setLocation] = useLocation();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingLoginId, setCreatingLoginId] = useState<string | null>(
    null,
  );
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openActionStudentId, setOpenActionStudentId] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    if (!schoolId) {
      setError("No school was selected. Please return to the dashboard.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      // Defense in depth: never load student records unless the current user
      // is an active administrator of this exact school.
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setStudents([]);
        setLocation("/portal");
        return;
      }

      const { data: adminMembership, error: membershipError } = await supabase
        .from("school_memberships")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", user.id)
        .eq("role", "admin")
        .eq("status", "active")
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!adminMembership) {
        setStudents([]);
        setError("Access denied. Student Management is available to active school administrators only.");
        setLocation("/teacher-dashboard");
        return;
      }

      const { data: studentRows, error: studentError } = await supabase
        .from("students")
        .select(
          "id, school_id, person_id, admission_number, admission_date, status, created_at, user_id",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (studentError) throw studentError;

      const rows = studentRows ?? [];

      if (rows.length === 0) {
        setStudents([]);
        return;
      }

      const personIds = rows.map((student) => student.person_id);

      const { data: peopleRows, error: peopleError } = await supabase
        .from("people")
        .select(
          "id, school_id, first_name, middle_name, last_name, phone, email, gender",
        )
        .eq("school_id", schoolId)
        .in("id", personIds);

      if (peopleError) throw peopleError;

      const peopleById = new Map(
        (peopleRows ?? []).map((person) => [person.id, person]),
      );

      setStudents(
        rows.map((student) => {
          const person = peopleById.get(student.person_id);

          return {
            id: student.id,
            school_id: student.school_id,
            person_id: student.person_id,
            admission_number: student.admission_number,
            admission_date: student.admission_date,
            status: student.status,
            created_at: student.created_at,
            user_id: student.user_id ?? null,
            first_name: person?.first_name ?? "",
            middle_name: person?.middle_name ?? null,
            last_name: person?.last_name ?? "",
            phone: person?.phone ?? null,
            email: person?.email ?? null,
            gender: person?.gender ?? null,
          };
        }),
      );
    } catch (err) {
      console.error("Unable to load students:", err);
      setError(errorMessage(err) || "Unable to load student records.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !term ||
        fullName(student).toLowerCase().includes(term) ||
        student.admission_number.toLowerCase().includes(term) ||
        (student.email ?? "").toLowerCase().includes(term) ||
        (student.phone ?? "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus(student.status) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const activeCount = students.filter(
    (student) => normalizedStatus(student.status) === "active",
  ).length;

  const otherCount = students.length - activeCount;

  function updateField(field: keyof StudentForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function openNewStudentForm() {
    setEditingStudent(null);
    setForm({
      ...emptyForm,
      admission_date: new Date().toISOString().slice(0, 10),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function openEditForm(student: Student) {
    setError("");
    setSuccess("");
    setEditingStudent(student);

    const supabase = getSupabaseClient();

    if (!supabase) {
      setError("Supabase is not configured.");
      setEditingStudent(null);
      return;
    }

    const { data: person, error: personError } = await supabase
      .from("people")
      .select("address, date_of_birth")
      .eq("id", student.person_id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (personError) {
      setError(
        `Could not load the student's full details: ${personError.message}`,
      );
      setEditingStudent(null);
      return;
    }

    setForm({
      first_name: student.first_name,
      middle_name: student.middle_name ?? "",
      last_name: student.last_name,
      admission_number: student.admission_number,
      admission_date: student.admission_date ?? "",
      date_of_birth: person?.date_of_birth ?? "",
      gender: student.gender ?? "",
      phone: student.phone ?? "",
      email: student.email ?? "",
      address: person?.address ?? "",
      status: student.status || "active",
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingStudent(null);
    setError("");
  }

  async function handleCreateStudentLogin(student: Student) {
    setError("");
    setSuccess("");

    if (creatingLoginId || saving) return;

    if (normalizedStatus(student.status) !== "active") {
      setError(
        "Only active students can receive a portal login. Update the student's status first.",
      );
      return;
    }

    if (student.user_id) {
      setSuccess(
        `${fullName(student)} already has a linked login account.`,
      );
      return;
    }

    const suggestedEmail = student.email?.trim() ?? "";
    const enteredEmail = window.prompt(
      `Enter the student's personal email address for the portal invitation.\n\nStudent: ${fullName(student)}\nAdmission number: ${student.admission_number}`,
      suggestedEmail,
    );

    if (enteredEmail === null) return;

    const email = enteredEmail.trim().toLowerCase();

    if (!email) {
      setError("An email address is required to create a student login.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setError("Enter a valid email address and try again.");
      return;
    }

    const confirmed = window.confirm(
      `Create a student portal login for ${fullName(student)} using ${email}?\n\nAn invitation will be sent to this address.`,
    );

    if (!confirmed) return;

    setCreatingLoginId(student.id);

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "Your administrator session has expired. Sign in again and retry.",
        );
      }

      const { data, error: functionError } =
        await supabase.functions.invoke("resa-create-student-login", {
          body: {
            student_id: student.id,
            email,
          },
        });

      if (functionError) {
        let details = functionError.message;

        try {
          const response = functionError.context;

          if (response && typeof response.json === "function") {
            const body = await response.json();

            if (typeof body?.error === "string") {
              details = body.error;
            } else if (typeof body?.message === "string") {
              details = body.message;
            }
          }
        } catch {
          // Keep the original function error if its response is not JSON.
        }

        throw new Error(details || "Unable to create the student login.");
      }

      if (data?.error) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The server could not create this student login.",
        );
      }

      setSuccess(
        `Login invitation processed for ${fullName(student)} (${email}). Check the invitation result and the student's linked-account status.`,
      );

      await loadStudents();
    } catch (err) {
      console.error("Unable to create student login:", err);
      setError(
        `Could not create the student login: ${errorMessage(err)}`,
      );
    } finally {
      setCreatingLoginId(null);
    }
  }


  async function handleResetStudentPassword(student: Student) {
    setError("");
    setSuccess("");
    if (resettingPasswordId || saving || creatingLoginId) return;
    if (!student.user_id) {
      setError("This student has no linked portal login. Create the login first.");
      return;
    }
    const confirmed = window.confirm(
      `Send a password-reset email for ${fullName(student)} (admission no. ${student.admission_number}) to the email linked to their portal account?`,
    );
    if (!confirmed) return;
    setResettingPasswordId(student.id);
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your administrator session has expired. Sign in again and retry.");
      const { data, error: lookupError } = await supabase.functions.invoke(
        "resa-admin-reset-student-password",
        { body: { student_id: student.id } },
      );
      if (lookupError) {
        let message = lookupError.message;
        try {
          const response = lookupError.context;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            if (typeof body?.error === "string") message = body.error;
          }
        } catch { /* Keep original function error. */ }
        throw new Error(message || "Could not verify the student's login email.");
      }
      const email = typeof data?.email === "string" ? data.email.trim() : "";
      if (!email) throw new Error("No email address is linked to this portal login.");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccess(`Password-reset email sent for ${fullName(student)} to the email registered to their portal login. Ask the student to check their inbox and spam folder.`);
    } catch (err) {
      console.error("Unable to request student password reset:", err);
      const details = errorMessage(err);
      const rateLimited = /rate limit|too many requests|email.*limit/i.test(details);
      setError(rateLimited
        ? "RESA email service has temporarily limited password-reset emails. Do not tap Reset Password again now. Wait for the email limit to clear, or ask the administrator to use the temporary-password option when it is enabled."
        : `Password reset could not be started: ${details}`);
    } finally {
      setResettingPasswordId(null);
    }
  }

  async function handleSetTemporaryPassword(student: Student) {
    setError("");
    setSuccess("");
    if (resettingPasswordId || saving || creatingLoginId) return;
    if (!student.user_id) {
      setError("This student has no linked portal login. Create the login first.");
      return;
    }
    if (normalizedStatus(student.status) !== "active") {
      setError("Only active students can receive a temporary password.");
      return;
    }
    const confirmed = window.confirm(
      "Set a temporary password for " + fullName(student) + "? Their current password will stop working. They must choose a new password at their next sign-in.",
    );
    if (!confirmed) return;
    setResettingPasswordId(student.id);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error: functionError } = await supabase.functions.invoke(
        "resa-admin-reset-student-password",
        { body: { action: "set_temporary_password", student_id: student.id } },
      );
      if (functionError) {
        let message = functionError.message;
        try {
          const response = functionError.context;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            if (typeof body?.error === "string") message = body.error;
          }
        } catch { /* Keep the original function error. */ }
        throw new Error(message || "Could not set a temporary password.");
      }
      if (data?.error) throw new Error(String(data.error));
      const temporaryPassword = typeof data?.temporary_password === "string" ? data.temporary_password : "";
      if (!temporaryPassword) throw new Error("The server did not return a temporary password. Contact support before retrying.");
      window.alert(
        "TEMPORARY PASSWORD — " + fullName(student) + "\n\n" + temporaryPassword + "\n\nCopy it now and give it privately to the student. It is shown only once. The student must change it after signing in.",
      );
      setSuccess("A temporary password was set for " + fullName(student) + ". Share it privately; the student must change it at first sign-in.");
    } catch (err) {
      console.error("Unable to set student temporary password:", err);
      setError("Temporary password could not be set: " + errorMessage(err));
    } finally {
      setResettingPasswordId(null);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!schoolId) {
      setError("The school ID is missing. Return to the dashboard.");
      return;
    }

    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const admissionNumber = form.admission_number.trim();

    if (!firstName || !lastName || !admissionNumber) {
      setError("First name, last name and admission number are required.");
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      let duplicateQuery = supabase
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("admission_number", admissionNumber);

      if (editingStudent) {
        duplicateQuery = duplicateQuery.neq("id", editingStudent.id);
      }

      const { data: duplicate, error: duplicateError } =
        await duplicateQuery.maybeSingle();

      if (duplicateError) throw duplicateError;

      if (duplicate) {
        throw new Error(
          "That admission number already belongs to another student. Please enter a different number.",
        );
      }

      if (editingStudent) {
        const { error: personError } = await supabase
          .from("people")
          .update({
            first_name: firstName,
            middle_name: form.middle_name.trim() || null,
            last_name: lastName,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            address: form.address.trim() || null,
            date_of_birth: form.date_of_birth || null,
            gender: form.gender || null,
          })
          .eq("id", editingStudent.person_id)
          .eq("school_id", schoolId);

        if (personError) throw personError;

        const { error: studentError } = await supabase
          .from("students")
          .update({
            admission_number: admissionNumber,
            admission_date: form.admission_date || null,
            status: form.status || "active",
          })
          .eq("id", editingStudent.id)
          .eq("school_id", schoolId);

        if (studentError) {
          throw new Error(
            `Personal details may have been saved, but admission details could not be updated: ${studentError.message}`,
          );
        }

        setSuccess(`${firstName} ${lastName}'s record has been updated.`);
      } else {
        const { data: person, error: personError } = await supabase
          .from("people")
          .insert({
            school_id: schoolId,
            first_name: firstName,
            middle_name: form.middle_name.trim() || null,
            last_name: lastName,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            address: form.address.trim() || null,
            date_of_birth: form.date_of_birth || null,
            gender: form.gender || null,
          })
          .select("id")
          .single();

        if (personError) throw personError;

        const { error: studentError } = await supabase
          .from("students")
          .insert({
            school_id: schoolId,
            person_id: person.id,
            admission_number: admissionNumber,
            admission_date: form.admission_date || null,
            status: form.status || "active",
          });

        if (studentError) {
          const { error: cleanupError } = await supabase
            .from("people")
            .delete()
            .eq("id", person.id)
            .eq("school_id", schoolId);

          if (cleanupError) {
            console.error(
              "Cleanup after registration failure:",
              cleanupError,
            );
          }

          throw studentError;
        }

        setSuccess(
          `${firstName} ${lastName} has been registered successfully. Use Create Login to invite the student to the portal.`,
        );
      }

      setShowForm(false);
      setEditingStudent(null);
      setForm(emptyForm);
      await loadStudents();
    } catch (err) {
      console.error("Unable to save student:", err);
      setError(
        errorMessage(err) ||
          "Unable to save the student record. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderStudentActions(student: Student) {
    const isOpen = openActionStudentId === student.id;
    const busy = creatingLoginId === student.id || resettingPasswordId === student.id;
    return (
      <div className="relative inline-flex justify-end">
        <button
          type="button"
          aria-label={`Actions for ${fullName(student)}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setOpenActionStudentId(isOpen ? null : student.id)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {isOpen && (
          <>
            <button type="button" aria-label="Close actions menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpenActionStudentId(null)} />
            <div role="menu" className="resa-action-menu absolute right-0 top-11 z-30">
              <button role="menuitem" type="button" onClick={() => { setOpenActionStudentId(null); void openEditForm(student); }}>
                <Pencil className="h-4 w-4" /> Edit student details
              </button>
              {student.user_id ? (
                <>
                  <button role="menuitem" type="button" disabled={busy || saving} onClick={() => { setOpenActionStudentId(null); void handleSetTemporaryPassword(student); }}>
                    <KeyRound className="h-4 w-4" /> Set temporary password
                  </button>
                  <button role="menuitem" type="button" disabled={busy || saving} onClick={() => { setOpenActionStudentId(null); void handleResetStudentPassword(student); }}>
                    <RefreshCw className="h-4 w-4" /> Reset password
                  </button>
                </>
              ) : (
                <button role="menuitem" type="button" disabled={busy || saving} onClick={() => { setOpenActionStudentId(null); void handleCreateStudentLogin(student); }}>
                  <UserPlus className="h-4 w-4" /> Create portal login
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderLoginAction(student: Student, mobile = false) {
    if (student.user_id) {
      const resetting = resettingPasswordId === student.id;
      return (
        <div className={`flex flex-col items-start gap-2 ${mobile ? "w-full" : ""}`}>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
            title="A user account is linked to this student"
          >
            <ShieldCheck className="h-4 w-4" />
            Login linked
          </span>
          <button
            type="button"
            onClick={() => void handleResetStudentPassword(student)}
            disabled={Boolean(resettingPasswordId) || saving || Boolean(creatingLoginId)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 ${mobile ? "w-full sm:w-auto" : ""}`}
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {resetting ? "Sending reset…" : "Reset Password"}
          </button>
          <button
            type="button"
            onClick={() => void handleSetTemporaryPassword(student)}
            disabled={Boolean(resettingPasswordId) || saving || Boolean(creatingLoginId)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 ${mobile ? "w-full sm:w-auto" : ""}`}
          >
            <KeyRound className="h-4 w-4" />
            Set Temporary Password
          </button>
        </div>
      );
    }

    const busy = creatingLoginId === student.id;

    return (
      <button
        type="button"
        onClick={() => void handleCreateStudentLogin(student)}
        disabled={Boolean(creatingLoginId) || Boolean(resettingPasswordId) || saving}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 ${
          mobile ? "w-full sm:w-auto" : ""
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {busy ? "Creating..." : "Create Login"}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">
                RESA School Portal
              </h1>
              <p className="text-sm text-slate-500">Student Management</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewStudentForm}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Register Student</span>
            <span className="sm:hidden">Register</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section>
          <h2 className="text-2xl font-bold">Students</h2>
          <p className="mt-1 text-sm text-slate-600">
            Register students, update records, and create secure student
            portal login invitations.
          </p>
        </section>

        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="break-words">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto"
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && !showForm && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="break-words">{error}</p>
            <button
              type="button"
              onClick={() => void loadStudents()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total students</p>
            <p className="mt-2 text-3xl font-bold">{students.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Active students</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Other statuses</p>
            <p className="mt-2 text-3xl font-bold">{otherCount}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, admission number, phone or email"
                className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700"
              aria-label="Filter students by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
            </select>

            <button
              type="button"
              onClick={() => void loadStudents()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <h3 className="font-bold">Student records</h3>
            <p className="mt-1 text-sm text-slate-500">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="mt-3 font-semibold">
                {students.length === 0
                  ? "No students registered yet"
                  : "No matching students"}
              </h4>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {students.length === 0
                  ? "Use Register Student to add the first student to RESA."
                  : "Try another search term or change the status filter."}
              </p>
              {students.length === 0 && (
                <button
                  type="button"
                  onClick={openNewStudentForm}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  <Plus className="h-4 w-4" />
                  Register first student
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">
                        Admission No.
                      </th>
                      <th className="px-5 py-3 font-semibold">Contact</th>
                      <th className="px-5 py-3 font-semibold">
                        Admission date
                      </th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Portal login</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {fullName(student) || "Name unavailable"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {student.gender || "Gender not specified"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {student.admission_number}
                        </td>
                        <td className="px-5 py-4">
                          <p>{student.phone || "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {student.email || "—"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {formatDate(student.admission_date)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              normalizedStatus(student.status) === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {displayStatus(student.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${student.user_id ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${student.user_id ? "bg-emerald-600" : "bg-amber-500"}`} />
                            {student.user_id ? "Login linked" : "Not linked"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {renderStudentActions(student)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {filteredStudents.map((student) => (
                  <article
                    key={student.id}
                    className="space-y-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">
                          {fullName(student) || "Name unavailable"}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Admission No: {student.admission_number}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          normalizedStatus(student.status) === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {displayStatus(student.status)}
                      </span>
                    </div>

                    {student.phone && (
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="h-4 w-4 shrink-0" />
                        {student.phone}
                      </p>
                    )}

                    {student.email && (
                      <p className="flex items-center gap-2 break-all text-sm text-slate-600">
                        <Mail className="h-4 w-4 shrink-0" />
                        {student.email}
                      </p>
                    )}

                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      Admitted: {formatDate(student.admission_date)}
                    </p>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {renderStudentActions(student)}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
          <div className="mx-auto my-4 max-w-3xl rounded-2xl bg-white shadow-xl sm:my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h3 className="text-xl font-bold">
                  {editingStudent
                    ? "Edit student record"
                    : "Register a student"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingStudent
                    ? "Correct the details below and save your changes."
                    : "Enter the student's personal and admission details."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <h4 className="mb-3 font-semibold">
                  Personal information
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    First name *
                    <input
                      required
                      value={form.first_name}
                      onChange={(event) =>
                        updateField("first_name", event.target.value)
                      }
                      autoComplete="given-name"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Last name *
                    <input
                      required
                      value={form.last_name}
                      onChange={(event) =>
                        updateField("last_name", event.target.value)
                      }
                      autoComplete="family-name"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Middle name
                    <input
                      value={form.middle_name}
                      onChange={(event) =>
                        updateField("middle_name", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Gender
                    <select
                      value={form.gender}
                      onChange={(event) =>
                        updateField("gender", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium">
                    Date of birth
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(event) =>
                        updateField("date_of_birth", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Phone number
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      autoComplete="tel"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium sm:col-span-2">
                    Email address
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      autoComplete="email"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Add the student's own accessible email if they will need
                      a portal login.
                    </span>
                  </label>

                  <label className="block text-sm font-medium sm:col-span-2">
                    Home address
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={(event) =>
                        updateField("address", event.target.value)
                      }
                      autoComplete="street-address"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h4 className="mb-3 font-semibold">
                  Admission information
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Admission number *
                    <input
                      required
                      value={form.admission_number}
                      onChange={(event) =>
                        updateField("admission_number", event.target.value)
                      }
                      placeholder="e.g. RESA/2026/001"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Admission date
                    <input
                      type="date"
                      value={form.admission_date}
                      onChange={(event) =>
                        updateField("admission_date", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Student status
                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateField("status", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-700"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="graduated">Graduated</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {saving
                    ? "Saving..."
                    : editingStudent
                      ? "Save changes"
                      : "Save student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
