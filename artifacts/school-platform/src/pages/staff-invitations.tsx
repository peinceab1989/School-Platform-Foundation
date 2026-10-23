
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  AlertCircle,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type StaffInvitationsPageProps = {
  schoolId: string;
  schoolName?: string;
  onSignOut?: () => void;
};

type PendingStaff = {
  user_id: string;
  staff_number: string | null;
  job_title: string | null;
  department: string | null;
  status: string;
};

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
  const [submitting, setSubmitting] = useState(false);
  const [loadingPending, setLoadingPending] = useState(true);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [pendingStaff, setPendingStaff] = useState<PendingStaff[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPendingStaff = useCallback(async () => {
    if (!schoolId) {
      setError("The school account could not be identified.");
      setLoadingPending(false);
      return;
    }

    setLoadingPending(true);

    try {
      const client = getSupabaseClient();

      const { data: memberships, error: membershipError } = await client
        .from("school_memberships")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("role", "teacher")
        .eq("status", "invited");

      if (membershipError) {
        throw membershipError;
      }

      const invitedUserIds = (memberships ?? [])
        .map((membership) => membership.user_id)
        .filter((userId): userId is string => Boolean(userId));

      if (invitedUserIds.length === 0) {
        setPendingStaff([]);
        setError("");
        return;
      }

      const { data: staffRows, error: staffError } = await client
        .from("staff")
        .select("user_id, staff_number, job_title, department, status")
        .eq("school_id", schoolId)
        .in("user_id", invitedUserIds);

      if (staffError) {
        throw staffError;
      }

      setPendingStaff(
        (staffRows ?? []).map((staff) => ({
          user_id: staff.user_id,
          staff_number: staff.staff_number ?? null,
          job_title: staff.job_title ?? null,
          department: staff.department ?? null,
          status: staff.status ?? "pending",
        })),
      );
      setError("");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pending staff invitations.",
      );
    } finally {
      setLoadingPending(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadPendingStaff();
  }, [loadPendingStaff]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!schoolId) {
      setError("The school account could not be identified.");
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

      const { data, error: functionError } =
        await client.functions.invoke("resa-invite-staff", {
          body: {
            school_id: schoolId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            job_title: jobTitle.trim(),
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
          // Keep the original Supabase function error.
        }

        throw new Error(details || "The invitation could not be sent.");
      }

      if (data?.error) {
        throw new Error(String(data.error));
      }

      setMessage(
        `Invitation processed successfully for ${email.trim()}. The staff record will remain pending until an administrator approves it.`,
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setJobTitle("Teacher");
      setDepartment("ICT");

      await loadPendingStaff();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The invitation could not be sent. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(userId: string) {
    setError("");
    setMessage("");
    setApprovingUser(userId);

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
      await loadPendingStaff();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The teacher could not be approved.",
      );
    } finally {
      setApprovingUser(null);
    }
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
              Staff Invitations
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
                Teacher Registration and Approval
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-green-50">
                Invite teachers through Supabase. New staff remain pending
                until an authorised school administrator approves them.
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
            <p>{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-amber-50 p-3 text-amber-700">
                  <Clock3 className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Pending Approval</h2>
                  <p className="text-sm text-slate-500">
                    {pendingStaff.length} pending teacher
                    {pendingStaff.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadPendingStaff()}
                disabled={loadingPending}
                aria-label="Refresh pending staff"
                className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingPending ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {loadingPending ? (
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
                {pendingStaff.map((staff) => (
                  <article
                    key={staff.user_id}
                    className="rounded-xl border border-slate-200 p-4"
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
                        <p className="mt-1 text-xs text-slate-500">
                          Status: {staff.status}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleApprove(staff.user_id)}
                      disabled={approvingUser !== null}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approvingUser === staff.user_id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      {approvingUser === staff.user_id
                        ? "Approving…"
                        : "Approve Teacher"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Approval is processed by the secured Supabase database function.
          Only an authenticated administrator authorised for this school can
          approve an invited teacher.
        </p>
      </main>
    </div>
  );
}
