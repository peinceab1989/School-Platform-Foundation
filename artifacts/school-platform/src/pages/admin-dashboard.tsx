import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  getSupabaseClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  UserCog,
  School,
  BookOpen,
  ClipboardCheck,
  CalendarCheck,
  BellRing,
  ClipboardList,
  FileText,
  Settings2,
  LogOut,
  Menu,
  X,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Database,
  Video,
} from "lucide-react";

type AdminDashboardProps = {
  schoolId: string;
  schoolName?: string;
  email?: string | null;
  onSignOut: () => void;
};

type Stat = {
  loading: boolean;
  count: number | null;
  error: string | null;
};

type Stats = {
  students: Stat;
  staff: Stat;
  classes: Stat;
  attendance: Stat;
};

const emptyStat = (): Stat => ({
  loading: true,
  count: null,
  error: null,
});

const initialStats = (): Stats => ({
  students: emptyStat(),
  staff: emptyStat(),
  classes: emptyStat(),
  attendance: emptyStat(),
});

function lagosDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Staff Attendance", href: "/staff-attendance", icon: CalendarCheck },
  { label: "School Messages", href: "/school-communication", icon: BellRing },
  { label: "HR & Employee Records", href: "/hr-management", icon: UserCog },
  { label: "School Reports", href: "/school-reports", icon: FileText },
  { label: "Additional School Services", href: "/school-services", icon: Database },
  { label: "Announcements", href: "/announcements", icon: BellRing },
  { label: "Examinations & CBT", href: "/examinations", icon: ClipboardList },
  { label: "Academic Results", href: "/results", icon: FileText },
  { label: "School Settings", href: "/school-settings", icon: Settings2 },
  {
    label: "Teachers & Staff",
    href: "/staff-invitations",
    icon: GraduationCap,
  },
  {
    label: "Parent Management",
    href: "/parent-management",
    icon: UserCog,
  },
  {
    label: "CCTV & Live Monitoring",
    href: "/school-cctv",
    icon: Video,
  },
  { label: "Classes", href: "/classes", icon: School },
  { label: "Subjects", href: "/subjects", icon: BookOpen },
];

export default function AdminDashboard({
  schoolId,
  schoolName = "RHEMA EXPLOITS SCIENCE ACADEMY (RESA)",
  email,
  onSignOut,
}: AdminDashboardProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<Stats>(initialStats);
  const requestIdRef = useRef(0);

  const loadStatistics = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    const setUnavailable = (message: string) => {
      if (requestId !== requestIdRef.current) return;

      const unavailable: Stat = {
        loading: false,
        count: null,
        error: message,
      };

      setStats({
        students: { ...unavailable },
        staff: { ...unavailable },
        classes: { ...unavailable },
        attendance: { ...unavailable },
      });
    };

    if (!hasSupabaseConfig) {
      setUnavailable("Supabase is not configured.");
      return;
    }

    if (!schoolId) {
      setUnavailable("The school account could not be identified.");
      return;
    }

    setStats((previous) => ({
      students: { ...previous.students, loading: true, error: null },
      staff: { ...previous.staff, loading: true, error: null },
      classes: { ...previous.classes, loading: true, error: null },
      attendance: { ...previous.attendance, loading: true, error: null },
    }));

    try {
      const client = getSupabaseClient();

      if (!client) {
        throw new Error("Unable to connect to the Supabase client.");
      }

      const today = lagosDate();

      const [
        studentsResult,
        staffResult,
        classesResult,
        attendanceResult,
      ] = await Promise.all([
        client
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),

        client
          .from("staff")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),

        client
          .from("school_classes")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),

        client
          .from("student_attendance")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("attendance_date", today),
      ]);

      if (requestId !== requestIdRef.current) return;

      setStats({
        students: {
          loading: false,
          count: studentsResult.error
            ? null
            : studentsResult.count ?? 0,
          error: studentsResult.error?.message ?? null,
        },
        staff: {
          loading: false,
          count: staffResult.error ? null : staffResult.count ?? 0,
          error: staffResult.error?.message ?? null,
        },
        classes: {
          loading: false,
          count: classesResult.error
            ? null
            : classesResult.count ?? 0,
          error: classesResult.error?.message ?? null,
        },
        attendance: {
          loading: false,
          count: attendanceResult.error
            ? null
            : attendanceResult.count ?? 0,
          error: attendanceResult.error?.message ?? null,
        },
      });
    } catch (error: unknown) {
      if (requestId !== requestIdRef.current) return;

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load school statistics.";

      console.error("RESA dashboard statistics error:", error);

      setUnavailable(message);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadStatistics();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadStatistics]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const formatCount = (stat: Stat) => {
    if (stat.loading) return "Loading…";
    if (stat.count === null) return "Unavailable";
    return stat.count.toLocaleString();
  };

  const isRefreshing = Object.values(stats).some(
    (stat) => stat.loading,
  );

  const hasErrors = Object.values(stats).some(
    (stat) => Boolean(stat.error),
  );

  const statCards = [
    {
      title: "Total Students",
      stat: stats.students,
      description: "Student records",
      icon: Users,
      iconStyle: "bg-green-50 text-green-700",
    },
    {
      title: "Teachers & Staff",
      stat: stats.staff,
      description: "Staff records",
      icon: GraduationCap,
      iconStyle: "bg-blue-50 text-blue-700",
    },
    {
      title: "Total Classes",
      stat: stats.classes,
      description: "All school class records",
      icon: School,
      iconStyle: "bg-amber-50 text-amber-700",
    },
    {
      title: "Attendance Today",
      stat: stats.attendance,
      description: "Student attendance records today",
      icon: ClipboardCheck,
      iconStyle: "bg-violet-50 text-violet-700",
    },
  ];

  const managementCards = [
    {
      title: "Additional School Services",
      description: "Open fees, timetables, library, inventory, transport, admissions, payroll, RESA Drive and biometric record modules.",
      href: "/school-services",
      icon: Database,
    },
    {
      title: "Staff Attendance",
      description: "Record staff presence, late arrivals, absences and check-in/check-out times.",
      href: "/staff-attendance",
      icon: CalendarCheck,
    },
    {
      title: "School Messages",
      description: "Send and receive private messages with authorised school members.",
      href: "/school-communication",
      icon: BellRing,
    },
    {
      title: "School Reports",
      description: "View school record summaries and export attendance and module counts.",
      href: "/school-reports",
      icon: FileText,
    },
    {
      title: "HR & Employee Records",
      description: "Maintain employee records, staff IDs, departments and employment status.",
      href: "/hr-management",
      icon: UserCog,
    },
    {
      title: "Students",
      description: "View and manage student records.",
      href: "/students",
      icon: Users,
    },
    {
      title: "Attendance",
      description: "Record and review daily student attendance by class.",
      href: "/attendance",
      icon: CalendarCheck,
    },
    {
      title: "Announcements",
      description: "Create, publish and manage school notices.",
      href: "/announcements",
      icon: BellRing,
    },
    {
      title: "Examinations & CBT",
      description: "Create online examinations and manage draft and published status.",
      href: "/examinations",
      icon: ClipboardList,
    },
    {
      title: "Academic Results",
      description: "Review student term results by class, session and term.",
      href: "/results",
      icon: FileText,
    },
    {
      title: "School Settings",
      description: "Manage school contact details and academic defaults.",
      href: "/school-settings",
      icon: Settings2,
    },
    {
      title: "Teachers & Staff",
      description:
        "Invite staff, review registrations, and manage staff approvals.",
      href: "/staff-invitations",
      icon: GraduationCap,
    },
    {
      title: "Parent Management",
      description: "Access parent management.",
      href: "/parent-management",
      icon: UserCog,
    },
    {
      title: "CCTV & Live Monitoring",
      description: "Register school camera locations and approve or revoke individual parent viewing access. Live video requires camera installation and a secure streaming connection.",
      href: "/school-cctv",
      icon: Video,
    },
    {
      title: "Classes",
      description: "View and manage school classes.",
      href: "/classes",
      icon: School,
    },
    {
      title: "Subjects",
      description: "Access subject management.",
      href: "/subjects",
      icon: BookOpen,
    },
  ];

  function Sidebar() {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-950 to-emerald-800 px-5 py-7 text-white">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/40 bg-white/10 text-xl font-black tracking-tight text-amber-200 shadow-inner">R</div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-200">
            RESA SCHOOL PORTAL
          </p>

          <h2 className="mt-2 text-base font-bold text-white">
            School Administration
          </h2>

          <p className="mt-2 break-all text-xs text-emerald-100/80">
            {email || "Administrator"}
          </p>
        </div>

        <nav
          aria-label="Administrator navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-green-50 text-green-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f1] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[270px] shrink-0 border-r border-emerald-950/10 bg-white lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur">
            <div className="flex min-h-[76px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label={
                    mobileMenuOpen ? "Close menu" : "Open menu"
                  }
                  aria-expanded={mobileMenuOpen}
                  onClick={() =>
                    setMobileMenuOpen((open) => !open)
                  }
                  className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 lg:hidden"
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>

                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-800 sm:text-sm">
                    RESA SCHOOL PORTAL
                  </p>

                  <h1 className="mt-1 truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                    Administrator Dashboard
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="hidden shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 sm:flex"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute inset-0 bg-slate-900/40"
              />

              <div className="absolute inset-y-0 left-0 w-[min(19rem,85vw)] overflow-y-auto shadow-xl">
                <Sidebar />
              </div>
            </div>
          )}

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8 lg:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-amber-200/20" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-amber-200/20" />
              <p className="relative text-sm font-bold uppercase tracking-[0.18em] text-amber-200">
                School Administration
              </p>

              <h2 className="relative mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Welcome to RESA
              </h2>

              <p className="relative mt-3 max-w-3xl text-sm leading-7 text-emerald-50 sm:text-base">
                Manage your school records, classes, parents, and
                daily school operations from one place.
              </p>

              <p className="relative mt-5 inline-flex max-w-full break-words rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-emerald-50">
                {schoolName}
              </p>
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                    School Overview
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Your school statistics and current portal status.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadStatistics()}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`h-4 w-4 ${
                      isRefreshing ? "animate-spin" : ""
                    }`}
                  />

                  {isRefreshing
                    ? "Refreshing…"
                    : "Refresh Statistics"}
                </button>
              </div>

              <div
                className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
                aria-live="polite"
                aria-busy={isRefreshing}
              >
                {statCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <article
                      key={card.title}
                      className="group rounded-2xl border border-white bg-white p-5 shadow-md shadow-emerald-950/[0.04] ring-1 ring-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-600">
                          {card.title}
                        </h3>

                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconStyle}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>

                      <p className="mt-4 break-words text-3xl font-extrabold text-slate-900">
                        {formatCount(card.stat)}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        {card.stat.error
                          ? "Could not load this statistic"
                          : card.description}
                      </p>
                    </article>
                  );
                })}
              </div>

              {hasErrors && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

                    <div>
                      <p className="font-semibold">
                        Some statistics could not be loaded.
                      </p>

                      <p className="mt-1">
                        Check the relevant Supabase tables, school
                        records, and database permissions.
                      </p>

                      <ul className="mt-2 list-inside list-disc space-y-1">
                        {statCards
                          .filter((card) => card.stat.error)
                          .map((card) => (
                            <li key={card.title}>
                              <span className="font-semibold">
                                {card.title}:
                              </span>{" "}
                              {card.stat.error}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {!hasErrors && !isRefreshing && (
                <div className="mt-4 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    All four dashboard statistics loaded successfully.
                  </span>
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-bold">Quick Actions</h2>

              <p className="mt-1 text-sm text-slate-600">
                Quickly open the main management areas.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {managementCards.slice(0, 2).map((card) => {
                  const Icon = card.icon;

                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-green-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="rounded-lg bg-green-100 p-2 text-green-800">
                          <Icon className="h-5 w-5" />
                        </span>

                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900">
                            {card.title}
                          </span>

                          <span className="mt-1 block text-xs text-slate-500">
                            {card.description}
                          </span>
                        </span>
                      </span>

                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-bold">Management</h2>

              <p className="mt-1 text-sm text-slate-600">
                Access the available school management sections.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {managementCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-800">
                        <Icon className="h-5 w-5" />
                      </span>

                      <h3 className="mt-4 font-extrabold text-slate-900">
                        {card.title}
                      </h3>

                      <p className="mt-2 text-sm leading-5 text-slate-600">
                        {card.description}
                      </p>

                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-green-800">
                        Open section
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>


            <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
              RESA School Portal · {new Date().getFullYear()}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}