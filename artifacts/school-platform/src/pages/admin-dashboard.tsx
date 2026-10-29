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
  Sparkles,
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
  { label: "Form Teacher & Attendance Comparison", href: "/form-teacher-attendance", icon: ClipboardCheck },
  { label: "Staff Attendance", href: "/staff-attendance", icon: CalendarCheck },
  { label: "School Messages", href: "/school-communication", icon: BellRing },
  { label: "Notifications", href: "/notifications", icon: BellRing },
  { label: "HR & Employee Records", href: "/hr-management", icon: UserCog },
  { label: "School Reports", href: "/school-reports", icon: FileText },
  { label: "Additional School Services", href: "/school-services", icon: Database },
  { label: "Announcements", href: "/announcements", icon: BellRing },
  { label: "Examinations & CBT", href: "/examinations", icon: ClipboardList },
  { label: "Academic Results", href: "/results", icon: FileText },
  { label: "Results Entry & Publication", href: "/results-management", icon: FileText },
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
  { label: "Teaching Assignments", href: "/teaching-assignments", icon: Users },
  { label: "AI Learning & Practice", href: "/practice-drills", icon: Sparkles },
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
      title: "RESA Test Accounts & Results",
      description: "TESTING ONLY: create sample teacher/student logins, attendance, CA marks, CBT attempts and published sample results.",
      href: "/test-data-setup",
      icon: Database,
    },
    {
      title: "AI Learning & Practice",
      description: "Create extra practice questions with answer explanations, revise subjects, and prepare for class tests and entrance examinations.",
      href: "/practice-drills",
      icon: Sparkles,
    },
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
    {
      title: "Teaching Assignments",
      description: "Assign teachers to classes and subjects and review teaching allocations.",
      href: "/teaching-assignments",
      icon: ClipboardCheck,
    },
  ];

  function Sidebar() {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-950 to-emerald-800 px-5 py-7 text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-amber-300/40 bg-white p-1 shadow-inner"><img src="/media/logo/resa-logo.jpg" alt="RESA school crest" className="h-full w-full rounded-xl object-contain" /></div>
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
          className="flex-1 space-y-5 overflow-y-auto px-3 py-5"
        >
          {[
            { label: "WORKSPACE", items: navigation.filter((item) => item.href === "/dashboard") },
            { label: "PEOPLE", items: navigation.filter((item) => ["/students", "/staff-invitations", "/parent-management", "/hr-management"].includes(item.href)) },
            { label: "ACADEMICS", items: navigation.filter((item) => ["/attendance", "/classes", "/subjects", "/examinations", "/results", "/results-management", "/practice-drills"].includes(item.href)) },
            { label: "COMMUNICATION", items: navigation.filter((item) => ["/school-communication", "/notifications", "/announcements"].includes(item.href)) },
            { label: "OPERATIONS", items: navigation.filter((item) => ["/staff-attendance", "/school-reports", "/school-services", "/school-cctv", "/school-settings"].includes(item.href)) },
          ].map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-extrabold tracking-[0.2em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition duration-200 ${
                        active
                          ? "border-emerald-100 bg-gradient-to-r from-emerald-50 to-white text-emerald-900 shadow-[0_5px_14px_rgba(6,78,59,0.08)]"
                          : "border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                        active ? "bg-emerald-800 text-white shadow-md" : "bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-800"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-50 via-[#f4f7f1] to-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[286px] shrink-0 border-r border-emerald-950/10 bg-white shadow-[8px_0_28px_rgba(6,78,59,0.06)] lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/80 bg-white/90 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="flex min-h-[82px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
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

          <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
            <section className="group relative isolate overflow-hidden rounded-[2rem] border border-emerald-700/30 bg-gradient-to-br from-[#092e22] via-[#0d5a3d] to-[#148153] p-6 text-white shadow-[0_24px_60px_-20px_rgba(6,78,59,0.65)] ring-1 ring-white/40 transition duration-300 hover:shadow-[0_30px_75px_-22px_rgba(6,78,59,0.7)] sm:p-8 lg:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-amber-200/20" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-amber-200/20" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute right-8 top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
              <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_230px]">
                <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">
                School Administration
              </p>

              <h2 className="relative mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Welcome to RESA
              </h2>

              <p className="relative mt-3 max-w-3xl text-sm leading-7 text-emerald-50 sm:text-base">
                Manage your school records, classes, parents, and
                daily school operations from one place.
              </p>

              <p className="mt-5 inline-flex max-w-full break-words items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-50 shadow-inner backdrop-blur">
                <School className="h-4 w-4 shrink-0 text-amber-200" /> {schoolName}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/students" className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-emerald-950 shadow-[0_8px_0_rgba(120,83,12,0.25)] transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Manage students <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/practice-drills" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Sparkles className="h-4 w-4 text-amber-200" /> AI Learning & Practice</Link>
              </div>
                </div>
                <div className="relative mx-auto hidden w-full max-w-[210px] lg:block">
                  <div className="absolute inset-3 rounded-[2rem] bg-amber-300/20 blur-2xl" />
                  <div className="relative rounded-[2rem] border border-white/25 bg-gradient-to-br from-white/25 to-white/5 p-3 shadow-[0_22px_45px_rgba(0,0,0,0.25)] backdrop-blur-md transition duration-300 group-hover:-translate-y-1 group-hover:rotate-1">
                    <div className="rounded-[1.5rem] border border-amber-200/40 bg-white p-3 shadow-inner"><img src="/media/logo/resa-logo.jpg" alt="RESA official school crest" className="aspect-square w-full rounded-2xl object-contain" /></div>
                    <p className="mt-3 text-center text-xs font-extrabold tracking-[0.18em] text-amber-100">PASSION • SKILLS</p>
                    <p className="mt-1 text-center text-[10px] font-semibold tracking-[0.12em] text-white/75">EXCELLENT SPIRIT</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
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
                {statCards.map((card, index) => {
                  const Icon = card.icon;

                  return (
                    <article
                      key={card.title}
                      className={`group relative overflow-hidden rounded-2xl border border-white/90 bg-gradient-to-br ${["from-sky-50 via-white to-sky-100/80", "from-violet-50 via-white to-violet-100/80", "from-amber-50 via-white to-amber-100/80", "from-emerald-50 via-white to-emerald-100/80"][index % 4]} p-5 shadow-[0_12px_28px_-14px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_-16px_rgba(6,78,59,0.25)]` }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-600">
                          {card.title}
                        </h3>

                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-1 ring-black/[0.03] transition duration-300 group-hover:rotate-3 group-hover:scale-105 ${card.iconStyle}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>

                      <p className="mt-4 break-words text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
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

            <section className="resa-surface mt-8 p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Quick Actions</h2>

              <p className="mt-1 text-sm text-slate-600">Your most-used school tools, one tap away.</p></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Admin workspace</span></div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[
                  { title: "Students", description: "View and manage student records.", href: "/students", icon: Users },
                  { title: "Teachers & Staff", description: "Invite staff and manage approvals.", href: "/staff-invitations", icon: GraduationCap },
                  { title: "Parent Management", description: "Manage parent accounts and access.", href: "/parent-management", icon: UserCog },
                  { title: "Classes", description: "View and manage school classes.", href: "/classes", icon: School },
                  { title: "Subjects", description: "Manage subjects and class assignments.", href: "/subjects", icon: BookOpen },
                ].map((card) => {
                  const Icon = card.icon;

                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group flex min-h-[116px] items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-[0_18px_32px_-18px_rgba(6,78,59,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 p-2.5 text-emerald-800 shadow-inner ring-1 ring-emerald-900/5 transition group-hover:scale-105">
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

                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">School Management</h2>

              <p className="mt-1 text-sm text-slate-600">All available modules and administration tools.</p></div><span className="text-xs font-semibold text-slate-500">Choose a module to open it</span></div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {managementCards.filter((card) => !["/students", "/staff-invitations", "/parent-management", "/classes", "/subjects"].includes(card.href)).map((card) => {
                  const Icon = card.icon;

                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group relative overflow-hidden rounded-2xl border border-white bg-gradient-to-br from-white via-white to-emerald-50/60 p-5 shadow-[0_14px_30px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/[0.04] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_42px_-20px_rgba(6,78,59,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-white text-emerald-800 shadow-[inset_0_1px_2px_rgba(6,78,59,0.08),0_5px_12px_rgba(6,78,59,0.08)] ring-1 ring-emerald-900/5 transition duration-300 group-hover:-rotate-3 group-hover:scale-105">
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


            <footer className="mt-10 border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-600">RESA School Portal · {new Date().getFullYear()}</p>
              <p className="mt-1">Designed &amp; Powered by <span className="font-extrabold tracking-wide text-emerald-800">JETAB TECH</span></p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}