
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Search,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type StaffInvitationsPageProps = {
  schoolId: string;
  schoolName?: string;
  onSignOut?: () => void;
};

type StaffMember = {
  user_id: string;
  staff_number: string | null;
  job_title: string | null;
  department: string | null;
  staff_status: string;
  membership_status: string;
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof err.message === "string"
  ) {
    return err.message;
  }

  return fallback;
}

export default function StaffInvitationsPage({
  schoolId,
  schoolName = "RHEMA EXPLOITS SCIENCE ACADEMY (RESA)",
  onSignOut,
}: StaffInvitationsPageProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("Teacher");
  const [department, setDepartment] = useState("ICT");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffPage, setStaffPage] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStaff = useCallback(async () => {
    if (!schoolId) {
      setError("The school account could not be identified.");
      setStaffMembers([]);
      setLoadingStaff(false);
      return;
    }

    setLoadingStaff(true);

    try {
      const client = getSupabaseClient();

      const { data: memberships, error: membershipError } = await client
        .from("school_memberships")
        .select("user_id, status")
        .eq("school_id", schoolId)
        .eq("role", "teacher")
        .in("status", ["invited", "active", "suspended"]);

      if (membershipError) {
        throw membershipError;
      }

      const membershipByUserId = new Map<string, string>();

      for (const membership of memberships ?? []) {
        if (membership.user_id) {
          membershipByUserId.set(
            membership.user_id,
            membership.status ?? "invited",
          );
        }
      }

      const userIds = Array.from(membershipByUserId.keys());

      if (userIds.length === 0) {
        setStaffMembers([]);
        setError("");
        return;
      }

      const { data: staffRows, error: staffError } = await client
        .from("staff")
        .select("user_id, staff_number, job_title, department, status")
        .eq("school_id", schoolId)
        .in("user_id", userIds);

      if (staffError) {
        throw staffError;
      }

      const members: StaffMember[] = (staffRows ?? [])
        .filter(
          (staff) =>
            Boolean(staff.user_id) &&
            membershipByUserId.has(staff.user_id as string),
        )
        .map((staff) => {
          const userId = staff.user_id as string;

          return {
            user_id: userId,
            staff_number: staff.staff_number ?? null,
            job_title: staff.job_title ?? null,
            department: staff.department ?? null,
            staff_status: staff.status ?? "pending",
            membership_status:
              membershipByUserId.get(userId) ?? "invited",
          };
        });

      setStaffMembers(members);
      setError("");
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "Unable to load the school staff directory."),
      );
    } finally {
      setLoadingStaff(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function handleExistingInvitation(action: "remove" | "resend") {
    const targetEmail = recoveryEmail.trim().toLowerCase();
    if (!targetEmail) { setError("Enter the teacher's email address first."); return; }
    const confirmed = window.confirm(action === "remove"
      ? `Remove only the incomplete RESA invitation for ${targetEmail}? Active and suspended teacher records are protected. The global sign-in account, if any, will not be deleted.`
      : `Send a password setup/recovery email to ${targetEmail}? This only works for a linked existing account.`);
    if (!confirmed) return;
    setError(""); setMessage(""); setSubmitting(true);
    try {
      const client = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");
      const { data, error: functionError } = await client.functions.invoke("resa-manage-staff-invitation", {
        body: { action, school_id: schoolId, email: targetEmail },
      });
      if (functionError) {
        let details = functionError.message;
        try {
          const response = functionError.context;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            details = body?.error || body?.message || details;
          }
        } catch { /* retain original function error */ }
        throw new Error(details || "The request could not be completed.");
      }
      if (data?.error) throw new Error(String(data.error));
      if (action === "remove") {
        setMessage("Incomplete invitation removed from this school. The global sign-in account was retained. You can now use Invite a Teacher below to send a fresh invitation.");
      } else {
        const { error: resetError } = await client.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: "https://resa-school-portal.netlify.app/accept-invitation",
        });
        if (resetError) throw resetError;
        setMessage("Password setup/recovery email requested for " + targetEmail + ". Ask the teacher to check their inbox and spam folder. If no email arrives, remove the incomplete school invitation and send a fresh invitation below.");
      }
      await loadStaff();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "The invitation action failed. Please try again."));
    } finally { setSubmitting(false); }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!schoolId) {
      setError("The school account could not be identified.");
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("Please enter the teacher's first name, last name, and email.");
      return;
    }

    setSubmitting(true);

    try {
      const client = getSupabaseClient();

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data, error: functionError } =
        await client.functions.invoke("resa-invite-staff", {
          body: {
            school_id: schoolId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            job_title: jobTitle.trim() || "Teacher",
            department: department.trim(),
          },
        });

      if (functionError) {
        let details = functionError.message;

        try {
          const response = functionError.context;

          if (response && typeof response.json === "function") {
            const body = await response.json();
            details = body?.error || body?.message || details;
          }
        } catch {
          // Retain the original Supabase function error.
        }

        throw new Error(details || "The invitation could not be sent.");
      }

      if (data?.error) {
        throw new Error(String(data.error));
      }

      setMessage(
        `Invitation processed successfully for ${normalizedEmail}. The teacher must complete the invitation process and be approved by an administrator before receiving active school access.`,
      );

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setJobTitle("Teacher");
      setDepartment("ICT");

      await loadStaff();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "The invitation could not be sent. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(userId: string) {
    setError("");
    setMessage("");
    setProcessingUser(userId);

    try {
      const client = getSupabaseClient();

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Please sign in again before approving staff.");
      }

      const { data, error: approvalError } = await client.rpc(
        "approve_invited_staff",
        {
          p_school_id: schoolId,
          p_user_id: userId,
        },
      );

      if (approvalError) throw approvalError;

      if (data !== true) {
        throw new Error(
          "Approval was not completed. Verify the invitation and your administrator permissions.",
        );
      }

      setMessage("The teacher has been approved and activated.");
      await loadStaff();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "The teacher could not be approved."));
    } finally {
      setProcessingUser(null);
    }
  }

  async function handleSuspend(staff: StaffMember) {
    if (staff.membership_status !== "active") {
      setError("Only active teachers can be suspended.");
      return;
    }

    const confirmed = window.confirm(
      `Suspend ${staff.staff_number || "this teacher"}?\n\n` +
        "Their school membership will be marked as suspended. " +
        "They should no longer have access to protected teacher features. " +
        "Their staff record will be retained.",
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setProcessingUser(staff.user_id);

    try {
      const client = getSupabaseClient();

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Please sign in again before suspending staff.");
      }

      const { data, error: suspensionError } = await client.rpc(
        "suspend_school_teacher",
        {
          p_school_id: schoolId,
          p_user_id: staff.user_id,
        },
      );

      if (suspensionError) throw suspensionError;

      if (data !== true) {
        throw new Error(
          "The teacher was not suspended. Verify your administrator permissions and try again.",
        );
      }

      setMessage(
        `${staff.staff_number || "The teacher"} has been suspended. Their staff record has been retained.`,
      );

      await loadStaff();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "The teacher could not be suspended."));
    } finally {
      setProcessingUser(null);
    }
  }

  async function handleUnsuspend(staff: StaffMember) {
    if (staff.membership_status !== "suspended") {
      setError("Only suspended teachers can be unsuspended.");
      return;
    }

    const confirmed = window.confirm(
      `Unsuspend ${staff.staff_number || "this teacher"}?\n\n` +
        "Their school membership and staff record will be restored to active. " +
        "The teacher will regain access only where the portal's authentication " +
        "and access rules permit it.",
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setProcessingUser(staff.user_id);

    try {
      const client = getSupabaseClient();

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error("Please sign in again before restoring staff access.");
      }

      const { data, error: unsuspensionError } = await client.rpc(
        "unsuspend_school_teacher",
        {
          p_school_id: schoolId,
          p_user_id: staff.user_id,
        },
      );

      if (unsuspensionError) throw unsuspensionError;

      if (data !== true) {
        throw new Error(
          "The teacher was not unsuspended. Verify your administrator permissions and try again.",
        );
      }

      setMessage(
        `${staff.staff_number || "The teacher"} has been unsuspended. Their membership and staff status are now active.`,
      );

      await loadStaff();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "The teacher could not be unsuspended. Please try again.",
        ),
      );
    } finally {
      setProcessingUser(null);
    }
  }

  const pendingStaff = staffMembers.filter(
    (staff) => staff.membership_status === "invited",
  );

  const activeStaff = staffMembers.filter(
    (staff) => staff.membership_status === "active",
  );

  const suspendedStaff = staffMembers.filter(
    (staff) => staff.membership_status === "suspended",
  );

  const directoryStaff = [...activeStaff, ...suspendedStaff].filter((staff) => {
    const query = staffSearch.trim().toLowerCase();
    if (!query) return true;
    return [staff.staff_number, staff.job_title, staff.department, staff.staff_status, staff.membership_status, staff.user_id]
      .some((value) => String(value ?? "").toLowerCase().includes(query));
  });
  const staffPageSize = 8;
  const staffPageCount = Math.max(1, Math.ceil(directoryStaff.length / staffPageSize));
  const visibleDirectoryStaff = directoryStaff.slice((staffPage - 1) * staffPageSize, staffPage * staffPageSize);

  function renderStaffCard(staff: StaffMember) {
    const isProcessing = processingUser === staff.user_id;
    const isInvited = staff.membership_status === "invited";
    const isActive = staff.membership_status === "active";
    const isSuspended = staff.membership_status === "suspended";

    return (
      <article
        key={staff.user_id}
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Users className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="break-all font-bold text-slate-900">
              {staff.staff_number || "Staff number pending"}
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {staff.job_title || "Teacher"}
              {staff.department ? ` · ${staff.department}` : ""}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                  isActive
                    ? "bg-green-100 text-green-800"
                    : isSuspended
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {isActive
                  ? "Active"
                  : isSuspended
                    ? "Suspended"
                    : "Awaiting approval"}
              </span>

              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Staff record: {staff.staff_status}
              </span>
            </div>
          </div>
        </div>

        {isInvited && (
          <button
            type="button"
            onClick={() => void handleApprove(staff.user_id)}
            disabled={processingUser !== null}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            {isProcessing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {isProcessing ? "Approving…" : "Approve Teacher"}
          </button>
        )}

        {isActive && (
          <button
            type="button"
            onClick={() => void handleSuspend(staff)}
            disabled={processingUser !== null}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            {isProcessing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {isProcessing ? "Suspending…" : "Suspend Teacher"}
          </button>
        )}

        {isSuspended && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-700">
              This teacher is suspended. Their staff record remains available
              for administrative reference, and protected teacher access should
              remain blocked until access is restored.
            </p>

            <button
              type="button"
              onClick={() => void handleUnsuspend(staff)}
              disabled={processingUser !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              {isProcessing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {isProcessing ? "Restoring access…" : "Unsuspend Teacher"}
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-green-700">
              RESA SCHOOL PORTAL
            </p>
            <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">
              Staff Management
            </h1>
            <p className="mt-1 text-sm text-slate-600">{schoolName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void loadStaff()}
              disabled={loadingStaff}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingStaff ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-2xl bg-gradient-to-r from-green-800 to-green-700 p-6 text-white shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-white/15 p-3">
              <ShieldCheck className="h-7 w-7" />
            </span>

            <div>
              <h2 className="text-xl font-extrabold sm:text-2xl">
                Teacher Registration, Approval and Access
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-green-50">
                Invite teachers, approve eligible staff, review active
                memberships, and suspend or restore access when necessary.
                Administrative actions are checked by Supabase.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="break-words">{message}</p>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock3 className="h-6 w-6 text-amber-600" />
              <p className="text-sm font-semibold text-slate-600">
                Pending approval
              </p>
            </div>
            <p className="mt-3 text-3xl font-extrabold">
              {pendingStaff.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-green-700" />
              <p className="text-sm font-semibold text-slate-600">
                Active teachers
              </p>
            </div>
            <p className="mt-3 text-3xl font-extrabold">
              {activeStaff.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Ban className="h-6 w-6 text-red-600" />
              <p className="text-sm font-semibold text-slate-600">
                Suspended teachers
              </p>
            </div>
            <p className="mt-3 text-3xl font-extrabold">
              {suspendedStaff.length}
            </p>
          </div>
        </section>

        <details className="group rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6"><span className="flex items-center gap-3"><AlertCircle className="h-5 w-5 text-amber-700" /><span><span className="block font-bold text-slate-900">Recover an Existing Invitation</span><span className="block text-sm text-slate-600">Password setup or remove an incomplete invitation</span></span></span><ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary>
          <div className="border-t border-amber-200 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recover an Existing Invitation</h2>
              <p className="mt-1 text-sm text-slate-600">Use this when the email already exists but the teacher is missing from Pending Approval. Active or suspended staff accounts are protected.</p>
            </div>
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Teacher email address
            <input type="email" required value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" placeholder="teacher@example.com" />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void handleExistingInvitation("resend")} disabled={submitting || !recoveryEmail.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-3 text-sm font-bold text-white hover:bg-green-900 disabled:opacity-60">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resend Password Setup
            </button>
            <button type="button" onClick={() => void handleExistingInvitation("remove")} disabled={submitting || !recoveryEmail.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Remove Incomplete Invitation
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Removal affects only pending invitation records for this school. It never deletes the global authentication account or active/suspended staff.</p>
                  </div>
        </details>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6"><span className="flex items-center gap-3"><span className="rounded-xl bg-green-50 p-3 text-green-800"><Mail className="h-6 w-6" /></span><span><span className="block font-bold">Invite a Teacher</span><span className="block text-sm text-slate-500">Tap to enter a new staff member</span></span></span><ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary>
            <div className="border-t border-slate-200 p-5 sm:p-6">
<div className="flex items-center gap-3">
              <span className="rounded-xl bg-green-50 p-3 text-green-800">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold">Invite a Teacher</h2>
                <p className="text-sm text-slate-500">
                  Enter the staff member's details.
                </p>
              </div>
            </div>

            <form onSubmit={handleInvite} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  First name *
                  <input
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="First name"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Last name *
                  <input
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="Last name"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold">
                Email address *
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="teacher@example.com"
                />
              </label>

              <label className="block text-sm font-semibold">
                Phone number
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Optional"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Job title *
                  <input
                    required
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Department
                  <input
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="e.g. ICT"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-3 font-bold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                {submitting ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {submitting ? "Sending invitation…" : "Send Staff Invitation"}
              </button>
            </form>
                      </div>
          </details>
          <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6"><span className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-700"><Clock3 className="h-6 w-6" /></span><span><span className="block font-bold">Pending Approval</span><span className="block text-sm text-slate-500">{pendingStaff.length} invitations awaiting review</span></span></span><ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary>
            <div className="border-t border-slate-200 p-5 sm:p-6">
<div className="flex items-center gap-3">
              <span className="rounded-xl bg-amber-50 p-3 text-amber-700">
                <Clock3 className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold">Pending Approval</h2>
                <p className="text-sm text-slate-500">
                  Invitations awaiting administrator approval.
                </p>
              </div>
            </div>

            {loadingStaff ? (
              <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Loading pending staff…
              </div>
            ) : pendingStaff.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">
                  No pending teachers
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  New invitations awaiting approval will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {pendingStaff.map(renderStaffCard)}
              </div>
            )}
                      </div>
          </details>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Staff Directory</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review active and suspended teacher memberships.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {activeStaff.length + suspendedStaff.length} staff
            </span>
          </div>

          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={staffSearch} onChange={(event) => { setStaffSearch(event.target.value); setStaffPage(1); }} placeholder="Search staff number, job title, department, status or user ID…" aria-label="Search staff directory" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
          </label>
          {loadingStaff ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading staff directory…
            </div>
          ) : directoryStaff.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">
                {staffSearch.trim() ? "No matching staff found" : "No active or suspended teachers"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Approved teachers will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {visibleDirectoryStaff.map(renderStaffCard)}
            </div>
          )}
          {!loadingStaff && directoryStaff.length > staffPageSize && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">Showing {(staffPage - 1) * staffPageSize + 1}–{Math.min(staffPage * staffPageSize, directoryStaff.length)} of {directoryStaff.length}</p><div className="flex items-center gap-2"><button type="button" onClick={() => setStaffPage((page) => Math.max(1, page - 1))} disabled={staffPage <= 1} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="text-sm text-slate-600">Page {staffPage}/{staffPageCount}</span><button type="button" onClick={() => setStaffPage((page) => Math.min(staffPageCount, page + 1))} disabled={staffPage >= staffPageCount} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div></div>}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Staff membership changes are processed through secured Supabase
          database functions. Suspension retains the staff record. Unsuspension
          restores the membership and staff record to active. All protected
          teacher features must enforce active membership checks so suspended
          accounts remain blocked.
        </p>
      </main>
    </div>
  );
}
