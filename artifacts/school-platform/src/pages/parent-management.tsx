
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Users,
  Plus,
  RefreshCw,
  Search,
  Loader2,
  UserRound,
  Link2,
  Mail,
  Save,
} from "lucide-react";
import { useLocation } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";

type Person = {
  id: string;
  school_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type Parent = {
  id: string;
  school_id: string;
  person_id: string;
  relationship: string | null;
  occupation: string | null;
  portal_enabled: boolean;
  created_at: string;
};

type Student = {
  id: string;
  person_id: string;
  admission_number: string | null;
  status: string | null;
  person?: Person;
};

type ParentLink = {
  id: string;
  student_id: string;
  parent_guardian_id: string;
  is_primary: boolean;
};

type ParentRecord = {
  parent: Parent;
  person: Person;
  studentNames: string[];
  portalStatus: "active" | "pending" | "not_invited";
};

const emptyForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  phone: "",
  email: "",
  address: "",
  relationship: "Mother",
  occupation: "",
  student_id: "",
  is_primary: false,
  portal_enabled: false,
};

export default function ParentManagementPage({
  schoolId,
}: {
  schoolId: string;
}) {
  const [, setLocation] = useLocation();
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [editingPersonId, setEditingPersonId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState("");
  const [invitingParentId, setInvitingParentId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const client = getSupabaseClient() as any;

      const [
        { data: parentData, error: parentError },
        { data: studentData, error: studentError },
      ] = await Promise.all([
        client
          .from("parents_guardians")
          .select("id, school_id, person_id, relationship, occupation, portal_enabled, created_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false }),
        client
          .from("students")
          .select("id, school_id, person_id, admission_number, status")
          .eq("school_id", schoolId)
          .order("admission_number", { ascending: true }),
      ]);

      if (parentError) throw parentError;
      if (studentError) throw studentError;

      const allParentRows = (parentData ?? []) as Parent[];
      const allStudentRows = (studentData ?? []) as Student[];

      const { data: portalAccounts, error: portalAccountsError } = await client
        .from("parent_portal_accounts")
        .select("parent_guardian_id, user_id, is_active")
        .eq("school_id", schoolId);
      if (portalAccountsError) throw portalAccountsError;

      const parentUserIds = [...new Set((portalAccounts ?? []).map((row: any) => row.user_id).filter(Boolean))];
      const { data: parentMemberships, error: parentMembershipsError } = parentUserIds.length
        ? await client
            .from("school_memberships")
            .select("user_id, status")
            .eq("school_id", schoolId)
            .eq("role", "parent")
            .in("user_id", parentUserIds)
        : { data: [], error: null };
      if (parentMembershipsError) throw parentMembershipsError;

      const portalAccountByParent = new Map((portalAccounts ?? []).map((row: any) => [row.parent_guardian_id, row]));
      const membershipStatusByUser = new Map((parentMemberships ?? []).map((row: any) => [row.user_id, row.status]));

      const personIds = [
        ...new Set([
          ...allParentRows.map((item) => item.person_id),
          ...allStudentRows.map((item) => item.person_id),
        ]),
      ];

      let people: Person[] = [];

      if (personIds.length > 0) {
        const { data, error: peopleError } = await client
          .from("people")
          .select("id, school_id, first_name, middle_name, last_name, phone, email, address")
          .eq("school_id", schoolId)
          .in("id", personIds);

        if (peopleError) throw peopleError;
        people = (data ?? []) as Person[];
      }

      const peopleById = new Map(people.map((person) => [person.id, person]));

      const studentRows = allStudentRows.map((student) => ({
        ...student,
        person: peopleById.get(student.person_id),
      }));

      const { data: linkData, error: linkError } = await client
        .from("student_parent_guardians")
        .select("id, student_id, parent_guardian_id, is_primary")
        .eq("school_id", schoolId);

      if (linkError) throw linkError;

      const links = (linkData ?? []) as ParentLink[];

      const records: ParentRecord[] = allParentRows.flatMap((parent) => {
        const person = peopleById.get(parent.person_id);
        if (!person) return [];

        const studentNames = links
          .filter((link) => link.parent_guardian_id === parent.id)
          .map((link) => {
            const student = studentRows.find(
              (item) => item.id === link.student_id,
            );
            if (!student?.person) return "";
            return `${student.person.first_name} ${student.person.last_name}`;
          })
          .filter(Boolean);

        const portalAccount = portalAccountByParent.get(parent.id) as any;
        const membershipStatus = portalAccount?.user_id
          ? membershipStatusByUser.get(portalAccount.user_id)
          : null;
        const portalStatus: ParentRecord["portalStatus"] =
          portalAccount?.is_active && membershipStatus === "active"
            ? "active"
            : portalAccount
              ? "pending"
              : "not_invited";

        return [{ parent, person, studentNames, portalStatus }];
      });

      setParents(records);
      setStudents(studentRows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load parent records. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredParents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return parents;

    return parents.filter(({ person, parent, studentNames }) =>
      [
        person.first_name,
        person.middle_name,
        person.last_name,
        person.phone,
        person.email,
        parent.relationship,
        parent.occupation,
        ...studentNames,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [parents, search]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredParents.length / pageSize));
  const paginatedParents = filteredParents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateField(
    field: keyof typeof emptyForm,
    value: string | boolean,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
    setEditingPersonId("");
  }

  function startEdit(record: ParentRecord) {
    setError("");
    setMessage("");
    setEditingId(record.parent.id);
    setEditingPersonId(record.person.id);
    setForm({
      first_name: record.person.first_name ?? "",
      middle_name: record.person.middle_name ?? "",
      last_name: record.person.last_name ?? "",
      phone: record.person.phone ?? "",
      email: record.person.email ?? "",
      address: record.person.address ?? "",
      relationship: record.parent.relationship ?? "Guardian",
      occupation: record.parent.occupation ?? "",
      student_id: "",
      is_primary: false,
      portal_enabled: record.parent.portal_enabled,
    });
    setLinkingId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleInviteParent(parentId: string) {
    setError("");
    setMessage("");
    const record = parents.find((item) => item.parent.id === parentId);
    if (!record) {
      setError("The parent record could not be found. Refresh and try again.");
      return;
    }
    if (!record.person.email?.trim()) {
      setError("Add the parent's real email address before sending a portal invitation.");
      return;
    }
    if (!record.studentNames.length) {
      setError("Link this parent to at least one student before sending an invitation.");
      return;
    }
    if (record.portalStatus !== "not_invited") {
      setError(record.portalStatus === "active"
        ? "This parent already has active portal access."
        : "An invitation already exists for this parent. Resolve the pending invitation before sending another.");
      return;
    }

    const email = record.person.email.trim().toLowerCase();
    const confirmed = window.confirm(
      "Send a secure RESA Parent Portal invitation to " + email + "? The parent will set their own password from the invitation email.",
    );
    if (!confirmed) return;

    setInvitingParentId(parentId);
    try {
      const client = getSupabaseClient();
      const { data, error: functionError } = await client.functions.invoke("resa-invite-parent", {
        body: { school_id: schoolId, parent_guardian_id: parentId },
      });
      if (functionError) {
        let details = functionError.message;
        try {
          const response = functionError.context;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            details = body?.error || body?.message || details;
          }
        } catch { /* Keep the original function error. */ }
        throw new Error(details || "The parent invitation could not be sent.");
      }
      if (data?.error || data?.success !== true) {
        throw new Error(String(data?.error || "The parent invitation could not be completed."));
      }
      setMessage("Parent invitation sent to " + email + ". Portal access activates only after the parent verifies the email and creates a password.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The parent invitation could not be sent.");
    } finally {
      setInvitingParentId("");
    }
  }

  async function ensureParentPortalAccessLink(
    client: any,
    parentId: string,
    studentId: string,
    relationship: string | null,
    isPrimary: boolean,
  ) {
    const { data: existing, error: lookupError } = await client
      .from("parent_student_portal_access")
      .select("id")
      .eq("school_id", schoolId)
      .eq("parent_guardian_id", parentId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      const { error: updateError } = await client
        .from("parent_student_portal_access")
        .update({ relationship, is_primary: isPrimary, is_active: true })
        .eq("id", existing.id)
        .eq("school_id", schoolId);
      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await client
      .from("parent_student_portal_access")
      .insert({
        school_id: schoolId,
        parent_guardian_id: parentId,
        student_id: studentId,
        relationship,
        is_primary: isPrimary,
        is_active: true,
      });
    if (insertError) throw insertError;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Enter the parent's first name and last name.");
      return;
    }

    setSaving(true);

    try {
      const client = getSupabaseClient() as any;
      const personValues = {
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      };

      let personId = editingPersonId;
      let parentId = editingId;

      if (editingId) {
        const { error: personError } = await client
          .from("people")
          .update(personValues)
          .eq("id", editingPersonId)
          .eq("school_id", schoolId);

        if (personError) throw personError;

        const { error: parentError } = await client
          .from("parents_guardians")
          .update({
            relationship: form.relationship,
            occupation: form.occupation.trim() || null,
            portal_enabled: form.portal_enabled,
          })
          .eq("id", editingId)
          .eq("school_id", schoolId);

        if (parentError) throw parentError;
      } else {
        const { data: newPerson, error: personError } = await client
          .from("people")
          .insert({ school_id: schoolId, ...personValues })
          .select("id")
          .single();

        if (personError) throw personError;
        personId = newPerson.id;

        const { data: newParent, error: parentError } = await client
          .from("parents_guardians")
          .insert({
            school_id: schoolId,
            person_id: personId,
            relationship: form.relationship,
            occupation: form.occupation.trim() || null,
            portal_enabled: form.portal_enabled,
          })
          .select("id")
          .single();

        if (parentError) throw parentError;
        parentId = newParent.id;
      }

      if (form.student_id && parentId) {
        const { data: existingLink, error: existingError } = await client
          .from("student_parent_guardians")
          .select("id")
          .eq("school_id", schoolId)
          .eq("student_id", form.student_id)
          .eq("parent_guardian_id", parentId)
          .maybeSingle();

        if (existingError) throw existingError;

        if (!existingLink) {
          const { error: linkError } = await client
            .from("student_parent_guardians")
            .insert({
              school_id: schoolId,
              student_id: form.student_id,
              parent_guardian_id: parentId,
              is_primary: form.is_primary,
            });

          if (linkError) throw linkError;
        }

        await ensureParentPortalAccessLink(
          client,
          parentId,
          form.student_id,
          form.relationship,
          form.is_primary,
        );
      }

      setMessage(
        editingId
          ? "Parent record updated successfully."
          : "Parent registered successfully.",
      );
      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the parent record. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkStudent(
    event: FormEvent<HTMLFormElement>,
    parentId: string,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.student_id) {
      setError("Select a student before linking.");
      return;
    }

    setSaving(true);

    try {
      const client = getSupabaseClient() as any;
      const { data: existing, error: checkError } = await client
        .from("student_parent_guardians")
        .select("id")
        .eq("school_id", schoolId)
        .eq("student_id", form.student_id)
        .eq("parent_guardian_id", parentId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setMessage("This parent is already linked to that student.");
      } else {
        const { error: insertError } = await client
          .from("student_parent_guardians")
          .insert({
            school_id: schoolId,
            student_id: form.student_id,
            parent_guardian_id: parentId,
            is_primary: form.is_primary,
          });

        if (insertError) throw insertError;
        setMessage("Parent linked to student successfully.");
      }

      const parentRecord = parents.find((item) => item.parent.id === parentId);
      await ensureParentPortalAccessLink(
        client,
        parentId,
        form.student_id,
        parentRecord?.parent.relationship ?? null,
        form.is_primary,
      );

      setForm((current) => ({
        ...current,
        student_id: "",
        is_primary: false,
      }));
      setLinkingId("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not link the parent to this student.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
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
              <Users className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Parent Management
              </h1>
              <p className="mt-1 text-sm text-emerald-100">
                Register parents and guardians and link them to RESA students.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-white/10 px-3 py-2">
              {parents.length} registered parent{parents.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-lg bg-white/10 px-3 py-2">
              {students.length} student{students.length === 1 ? "" : "s"} available
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {editingId ? (
              <Save className="h-5 w-5 text-emerald-700" />
            ) : (
              <Plus className="h-5 w-5 text-emerald-700" />
            )}
            {editingId ? "Edit parent or guardian" : "Register a parent or guardian"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the parent's contact details. Linking a student is optional.
          </p>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                First name *
                <input
                  required
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="First name"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Middle name
                <input
                  value={form.middle_name}
                  onChange={(e) => updateField("middle_name", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Middle name"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Last name *
                <input
                  required
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Last name"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone number
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="e.g. 080..."
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Email address
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="parent@example.com"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Relationship to student
                <select
                  value={form.relationship}
                  onChange={(e) => updateField("relationship", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                >
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Guardian</option>
                  <option>Grandparent</option>
                  <option>Aunt</option>
                  <option>Uncle</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Home address
                <input
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Residential address"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Occupation
                <input
                  value={form.occupation}
                  onChange={(e) => updateField("occupation", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Occupation"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                <Link2 className="h-4 w-4 text-emerald-700" />
                Link to a student (optional)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Select student
                  <select
                    value={form.student_id}
                    onChange={(e) => updateField("student_id", e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                  >
                    <option value="">No student selected</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.person
                          ? `${student.person.first_name} ${student.person.last_name}`
                          : "Student"}{" "}
                        {student.admission_number
                          ? `(${student.admission_number})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_primary}
                    onChange={(e) => updateField("is_primary", e.target.checked)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  Primary parent/guardian for this student
                </label>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={form.portal_enabled}
                onChange={(e) => updateField("portal_enabled", e.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-700"
              />
              <span>
                <strong>Enable parent portal status</strong>
                <span className="mt-1 block">
                  This changes the database flag only. It does not create a login
                  account or grant authenticated portal access by itself.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving..." : editingId ? "Save changes" : "Register parent"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="min-h-12 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        {(error || message) && (
          <div
            role={error ? "alert" : "status"}
            className={`rounded-lg p-3 text-sm ${
              error
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <UserRound className="h-5 w-5 text-emerald-700" />
                Registered parents and guardians
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search, edit, and link parents to their children.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search name, phone, email, relationship or student..."
              className="w-full border-0 bg-transparent py-2 text-sm outline-none"
            />
          </label>

          {loading ? (
            <p className="mt-5 text-center text-sm text-slate-500">
              Loading parent records...
            </p>
          ) : filteredParents.length === 0 ? (
            <p className="mt-5 rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">
              {parents.length === 0
                ? "No parents have been registered yet."
                : "No parents match your search."}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {paginatedParents.map(({ parent, person, studentNames, portalStatus }) => (
                <article
                  key={parent.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {person.first_name} {person.middle_name ? `${person.middle_name} ` : ""}
                        {person.last_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {parent.relationship || "Relationship not specified"}
                        {parent.occupation ? ` · ${parent.occupation}` : ""}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {person.phone || "No phone number"}
                        {person.email ? ` · ${person.email}` : ""}
                      </p>
                      {person.address && (
                        <p className="mt-1 text-sm text-slate-500">
                          {person.address}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-600">
                        <strong>Linked student(s):</strong>{" "}
                        {studentNames.length ? studentNames.join(", ") : "None linked"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2 py-1 ${
                          portalStatus === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : portalStatus === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          Parent login: {portalStatus === "active" ? "Active" : portalStatus === "pending" ? "Invitation pending" : "Not invited"}
                        </span>
                        <span className={`rounded-full px-2 py-1 ${
                          parent.portal_enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          Portal access: {parent.portal_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={invitingParentId === parent.id || portalStatus !== "not_invited" || !person.email || !studentNames.length}
                        onClick={() => void handleInviteParent(parent.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {invitingParentId === parent.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {portalStatus === "active" ? "Portal active" : portalStatus === "pending" ? "Invitation pending" : "Invite to Parent Portal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit({ parent, person, studentNames, portalStatus })}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setMessage("");
                          setLinkingId(linkingId === parent.id ? "" : parent.id);
                          setForm((current) => ({
                            ...current,
                            student_id: "",
                            is_primary: false,
                          }));
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        <Link2 className="h-4 w-4" />
                        Link student
                      </button>
                    </div>
                  </div>

                  {linkingId === parent.id && (
                    <form
                      onSubmit={(event) => void handleLinkStudent(event, parent.id)}
                      className="mt-4 rounded-lg bg-slate-50 p-3"
                    >
                      <label className="block text-sm font-medium text-slate-700">
                        Select a student
                        <select
                          required
                          value={form.student_id}
                          onChange={(e) => updateField("student_id", e.target.value)}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                        >
                          <option value="">Choose student</option>
                          {students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.person
                                ? `${student.person.first_name} ${student.person.last_name}`
                                : "Student"}{" "}
                              {student.admission_number
                                ? `(${student.admission_number})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.is_primary}
                          onChange={(e) => updateField("is_primary", e.target.checked)}
                          className="h-4 w-4 accent-emerald-700"
                        />
                        Primary parent/guardian
                      </label>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {saving ? "Linking..." : "Save link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkingId("")}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
          {!loading && filteredParents.length > pageSize && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredParents.length)} of {filteredParents.length} parents</p><div className="flex items-center gap-2"><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="text-sm text-slate-600">Page {currentPage}/{pageCount}</span><button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage >= pageCount} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div></div>}
        </section>
      </div>
    </main>
  );
}
