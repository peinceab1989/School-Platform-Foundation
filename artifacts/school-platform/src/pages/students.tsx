import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  UserX,
  Mail,
  Phone,
  CalendarDays,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Student = {
  id: string;
  school_id: string;
  person_id: string;
  admission_number: string | null;
  admission_date: string | null;
  status: string | null;
  created_at: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFullName(student: Student) {
  return [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
}

function normalizeStatus(status: string | null) {
  return status?.toLowerCase().trim() || "unknown";
}

export default function StudentsPage() {
  const [, setLocation] = useLocation();
  const supabase = getSupabaseClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadStudents = useCallback(
    async (isRefresh = false) => {
      try {
        setError(null);

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const { data: studentRows, error: studentError } =
          await supabase
            .from("students")
            .select(
              "id, school_id, person_id, admission_number, admission_date, status, created_at"
            )
            .order("created_at", { ascending: false });

        if (studentError) {
          throw new Error(studentError.message);
        }

        const rows = studentRows ?? [];

        if (rows.length === 0) {
          setStudents([]);
          return;
        }

        const personIds = rows
          .map((student) => student.person_id)
          .filter(Boolean);

        const { data: peopleRows, error: peopleError } =
          await supabase
            .from("people")
            .select(
              "id, first_name, middle_name, last_name, phone, email, gender"
            )
            .in("id", personIds);

        if (peopleError) {
          throw new Error(peopleError.message);
        }

        const peopleMap = new Map(
          (peopleRows ?? []).map((person) => [person.id, person])
        );

        const merged: Student[] = rows.map((student) => {
          const person = peopleMap.get(student.person_id);

          return {
            ...student,
            first_name: person?.first_name ?? "",
            middle_name: person?.middle_name ?? null,
            last_name: person?.last_name ?? "",
            phone: person?.phone ?? null,
            email: person?.email ?? null,
            gender: person?.gender ?? null,
          };
        });

        setStudents(merged);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load students."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase().trim();

    return students.filter((student) => {
      const status = normalizeStatus(student.status);

      if (
        statusFilter !== "all" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!term) return true;

      const text = [
        getFullName(student),
        student.admission_number ?? "",
        student.phone ?? "",
        student.email ?? "",
        student.gender ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [students, search, statusFilter]);

  const totalStudents = students.length;

  const activeStudents = students.filter((student) => {
    const status = normalizeStatus(student.status);

    return (
      status === "active" ||
      status === "enrolled" ||
      status === "current"
    );
  }).length;

  const otherStudents = totalStudents - activeStudents;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white text-slate-600 hover:bg-slate-50"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                RESA School Portal
              </p>

              <h1 className="truncate text-xl font-bold sm:text-2xl">
                Students Management
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadStudents(true)}
            disabled={refreshing}
            className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section>
          <h2 className="text-lg font-semibold">
            Student Records
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            View student information stored in the school database.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Students"
            value={totalStudents}
            icon={<Users className="h-6 w-6" />}
          />

          <StatCard
            title="Active Students"
            value={activeStudents}
            icon={<UserCheck className="h-6 w-6" />}
          />

          <StatCard
            title="Other Status"
            value={otherStudents}
            icon={<UserX className="h-6 w-6" />}
          />
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, admission number, phone or email..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="enrolled">Enrolled</option>
              <option value="current">Current</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h3 className="font-semibold text-red-800">
              Unable to load students
            </h3>

            <p className="mt-1 break-words text-sm text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadStudents()}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Students</h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredStudents.length} of {totalStudents}
            </p>
          </div>

          {loading ? (
            <div className="space-y-4 p-5">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Users className="h-8 w-8" />
              </div>

              <h3 className="mt-4 font-semibold">
                {students.length === 0
                  ? "No students found"
                  : "No matching students"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {students.length === 0
                  ? "There are currently no student records available in the school database."
                  : "Try changing your search or status filter."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">
                        Admission No.
                      </th>
                      <th className="px-5 py-3">Contact</th>
                      <th className="px-5 py-3">
                        Admission Date
                      </th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filteredStudents.map((student) => (
                      <StudentTableRow
                        key={student.id}
                        student={student}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y md:hidden">
                {filteredStudents.map((student) => (
                  <StudentMobileCard
                    key={student.id}
                    student={student}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="font-semibold text-blue-900">
            Students module — Stage 1
          </h3>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            This stage connects the portal to your existing student
            records. No database tables were created or modified.
            The next stage will add student registration, editing,
            class assignment, parent information and other student
            management functions.
          </p>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StudentTableRow({
  student,
}: {
  student: Student;
}) {
  const status = normalizeStatus(student.status);

  const isActive =
    status === "active" ||
    status === "enrolled" ||
    status === "current";

  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-700">
            {student.first_name?.charAt(0)?.toUpperCase() || "S"}
          </div>

          <div>
            <p className="font-semibold">
              {getFullName(student) || "Unnamed student"}
            </p>

            <p className="text-xs text-slate-500">
              {student.gender || "Gender not specified"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 text-sm font-medium">
        {student.admission_number || "—"}
      </td>

      <td className="px-5 py-4">
        <div className="space-y-1 text-xs text-slate-500">
          {student.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              {student.phone}
            </div>
          )}

          {student.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              <span className="max-w-[220px] truncate">
                {student.email}
              </span>
            </div>
          )}

          {!student.phone && !student.email && "—"}
        </div>
      </td>

      <td className="px-5 py-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          {formatDate(student.admission_date)}
        </div>
      </td>

      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            isActive
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {student.status || "Unknown"}
        </span>
      </td>
    </tr>
  );
}

function StudentMobileCard({
  student,
}: {
  student: Student;
}) {
  const status = normalizeStatus(student.status);

  const isActive =
    status === "active" ||
    status === "enrolled" ||
    status === "current";

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-700">
          {student.first_name?.charAt(0)?.toUpperCase() || "S"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {getFullName(student) || "Unnamed student"}
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Admission No.:{" "}
                {student.admission_number || "—"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {student.status || "Unknown"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Admission: {formatDate(student.admission_date)}
            </div>

            {student.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {student.phone}
              </div>
            )}

            {student.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="truncate">
                  {student.email}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}