import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

type AdminDashboardProps = {
  schoolName?: string;
  email?: string | null;
  onSignOut: () => void;
};

type MenuItem = {
  label: string;
  icon: React.ElementType;
  path?: string;
  comingSoon?: boolean;
};

export default function AdminDashboard({
  schoolName = "RHEMA EXPLOITS SCIENCE ACADEMY",
  email,
  onSignOut,
}: AdminDashboardProps) {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems: MenuItem[] = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "Students",
      icon: Users,
      path: "/students",
    },
    {
      label: "Teachers & Staff",
      icon: GraduationCap,
      comingSoon: true,
    },
    {
      label: "Classes & Subjects",
      icon: BookOpen,
      comingSoon: true,
    },
    {
      label: "Attendance",
      icon: CalendarCheck,
      comingSoon: true,
    },
    {
      label: "Examinations / CBT",
      icon: ClipboardList,
      comingSoon: true,
    },
    {
      label: "Results",
      icon: BarChart3,
      comingSoon: true,
    },
    {
      label: "Announcements",
      icon: Bell,
      comingSoon: true,
    },
    {
      label: "Settings",
      icon: Settings,
      comingSoon: true,
    },
  ];

  function navigate(path?: string) {
    if (!path) return;

    setMobileMenuOpen(false);
    setLocation(path);
  }

  function handleComingSoon() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b bg-white lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              RESA SCHOOL PORTAL
            </p>

            <h1 className="truncate text-base font-bold">
              {schoolName}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative flex h-full w-[85%] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  RESA
                </p>

                <h2 className="truncate font-bold">
                  School Portal
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {menuItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() =>
                      item.path
                        ? navigate(item.path)
                        : handleComingSoon()
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-slate-500" />

                    <span className="flex-1">
                      {item.label}
                    </span>

                    {item.comingSoon && (
                      <span className="text-[10px] font-semibold uppercase text-slate-400">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t p-4">
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 border-r bg-white lg:flex lg:flex-col">
          <div className="border-b p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  RESA
                </p>

                <h1 className="truncate text-sm font-bold">
                  School Portal
                </h1>
              </div>
            </div>

            <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">
              {schoolName}
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() =>
                    item.path
                      ? navigate(item.path)
                      : handleComingSoon()
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    item.label === "Dashboard"
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />

                  <span className="flex-1">
                    {item.label}
                  </span>

                  {item.comingSoon && (
                    <span className="text-[10px] font-semibold uppercase text-slate-400">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t p-4">
            <div className="mb-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                Signed in as
              </p>

              <p className="mt-1 truncate text-sm font-semibold">
                {email || "Administrator"}
              </p>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* Page heading */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">
                  School Administration
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Dashboard
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Manage students, staff, academics, attendance,
                  examinations and school operations.
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Administrator Access
              </div>
            </div>

            {/* Statistics */}
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardStat
                title="Total Students"
                value="0"
                description="Student records"
                icon={<Users className="h-6 w-6" />}
              />

              <DashboardStat
                title="Teachers & Staff"
                value="0"
                description="Staff records"
                icon={<GraduationCap className="h-6 w-6" />}
              />

              <DashboardStat
                title="Active Classes"
                value="0"
                description="School classes"
                icon={<BookOpen className="h-6 w-6" />}
              />

              <DashboardStat
                title="Attendance Today"
                value="0%"
                description="Daily attendance"
                icon={<CalendarCheck className="h-6 w-6" />}
              />
            </section>

            {/* Welcome card */}
            <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-6 text-white sm:p-8">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold text-blue-100">
                    Welcome to the RESA School Portal
                  </p>

                  <h3 className="mt-2 text-2xl font-bold sm:text-3xl">
                    Your school management system is taking shape.
                  </h3>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                    The portal is connected to your Supabase school
                    database. We are building each major school
                    management module carefully so the system can
                    grow without damaging the foundation.
                  </p>
                </div>
              </div>
            </section>

            {/* Quick actions */}
            <section className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold">
                  Quick Actions
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Start with the most common school administration
                  tasks.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <QuickAction
                  title="Manage Students"
                  description="View and manage student records"
                  icon={<Users className="h-6 w-6" />}
                  onClick={() => navigate("/students")}
                />

                <QuickAction
                  title="Add Student"
                  description="Register a new student"
                  icon={<UserPlus className="h-6 w-6" />}
                  onClick={() => navigate("/students")}
                />

                <QuickAction
                  title="Take Attendance"
                  description="Record today's attendance"
                  icon={<CalendarCheck className="h-6 w-6" />}
                  onClick={handleComingSoon}
                />

                <QuickAction
                  title="Examinations / CBT"
                  description="Manage school examinations"
                  icon={<ClipboardList className="h-6 w-6" />}
                  onClick={handleComingSoon}
                />
              </div>
            </section>

            {/* Current development status */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Users className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="font-bold">
                      Students Management
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      The first student-management stage is connected
                      to the existing student and people records in
                      your database.
                    </p>

                    <button
                      type="button"
                      onClick={() => navigate("/students")}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Open Students
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600">
                    <ShieldCheck className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="font-bold text-blue-900">
                      Development Roadmap
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-blue-800">
                      Next modules will include student registration,
                      classes, teachers, attendance, CBT,
                      examinations, results, parents, finance and
                      other school operations.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Important note */}
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold text-amber-900">
                Current development stage
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Some menu items are intentionally marked
                <strong> Soon</strong>. They are placeholders for
                modules we will build next. No database changes are
                required for this dashboard update.
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardStat({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>

        <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
      </div>

      <h3 className="mt-4 font-bold">{title}</h3>

      <p className="mt-1 text-sm leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}