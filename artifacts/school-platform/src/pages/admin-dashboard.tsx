
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
  UsersRound,
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
  icon: typeof BookOpen;
  path?: string;
  comingSoon?: boolean;
};

export default function AdminDashboard({
  schoolName = "RHEMA EXPLOITS SCIENCE ACADEMY",
  email,
  onSignOut,
}: AdminDashboardProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems: MenuItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Students", icon: Users, path: "/students" },
    {
      label: "Parent Management",
      icon: UsersRound,
      path: "/parents",
    },
    {
      label: "Teachers & Staff",
      icon: GraduationCap,
      comingSoon: true,
    },
    {
      label: "Classes",
      icon: BookOpen,
      path: "/classes",
    },
    {
      label: "Subjects",
      icon: ClipboardList,
      path: "/subjects",
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
    { label: "Results", icon: BarChart3, comingSoon: true },
    { label: "Announcements", icon: Bell, comingSoon: true },
    { label: "Settings", icon: Settings, comingSoon: true },
  ];

  function navigate(path: string) {
    setMobileMenuOpen(false);
    setLocation(path);
  }

  function handleComingSoon() {
    setMobileMenuOpen(false);
  }

  function renderMenuItem(item: MenuItem) {
    const Icon = item.icon;
    const active =
      item.path === location ||
      (item.path === "/parents" && location === "/parent-management");

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
          active
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{item.label}</span>

        {item.comingSoon && (
          <span className="text-[10px] font-semibold uppercase text-slate-400">
            Soon
          </span>
        )}

        {active && (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>
    );
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
          <button
            type="button"
            aria-label="Close menu backdrop"
            className="absolute inset-0 h-full w-full bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative flex h-full w-[85%] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  RESA
                </p>
                <h2 className="font-bold">School Portal</h2>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {menuItems.map(renderMenuItem)}
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

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  RESA
                </p>
                <h1 className="text-sm font-bold">
                  School Portal
                </h1>
              </div>
            </div>

            <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">
              {schoolName}
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {menuItems.map(renderMenuItem)}
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">
                  School Administration
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Dashboard
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Manage students, parents and guardians, staff, classes,
                  subjects, attendance, examinations and school operations.
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Administrator Access
              </div>
            </div>

            {/* Dashboard statistics */}
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
                value="16"
                description="Classes created"
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
                <p className="text-sm font-semibold text-blue-100">
                  Welcome to the RESA School Portal
                </p>
                <h3 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Your school management system
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                  Manage your school through the available portal modules.
                  Student Management, Parent Management, Class Management
                  and Subject Management are accessible from this dashboard.
                </p>
              </div>
            </section>

            {/* Quick actions */}
            <section className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold">Quick Actions</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Open a school administration module.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <QuickAction
                  title="Manage Students"
                  description="View and manage student records"
                  icon={<Users className="h-6 w-6" />}
                  onClick={() => navigate("/students")}
                />
                <QuickAction
                  title="Add Student"
                  description="Open student registration"
                  icon={<UserPlus className="h-6 w-6" />}
                  onClick={() => navigate("/students")}
                />
                <QuickAction
                  title="Parent Management"
                  description="Register parents and guardians and link them to students"
                  icon={<UsersRound className="h-6 w-6" />}
                  onClick={() => navigate("/parents")}
                />
                <QuickAction
                  title="Manage Classes"
                  description="Create and view school classes"
                  icon={<BookOpen className="h-6 w-6" />}
                  onClick={() => navigate("/classes")}
                />
                <QuickAction
                  title="Manage Subjects"
                  description="Assign subjects to school classes"
                  icon={<ClipboardList className="h-6 w-6" />}
                  onClick={() => navigate("/subjects")}
                />
              </div>
            </section>

            {/* Student, parent, class and subject management */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
              <ManagementCard
                title="Students Management"
                description="Open the existing student management page to manage student records."
                buttonText="Open Students"
                icon={<Users className="h-6 w-6" />}
                onClick={() => navigate("/students")}
              />

              <ManagementCard
                title="Parent Management"
                description="Register parents and guardians, record their contact details, and associate them with students."
                buttonText="Open Parent Management"
                icon={<UsersRound className="h-6 w-6" />}
                onClick={() => navigate("/parents")}
              />

              <ManagementCard
                title="Class Management"
                description="Manage Nursery, Primary, Junior Secondary and Senior Secondary classes."
                buttonText="Open Classes"
                icon={<BookOpen className="h-6 w-6" />}
                onClick={() => navigate("/classes")}
              />

              <ManagementCard
                title="Subject Management"
                description="Add subjects, select classes and manage each class's subject list."
                buttonText="Open Subjects"
                icon={<ClipboardList className="h-6 w-6" />}
                onClick={() => navigate("/subjects")}
              />
            </section>

            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold text-amber-900">
                Development status
              </h3>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Teachers and Staff, Attendance, Examinations / CBT, Results,
                Announcements and Settings remain under development.
                Student, staff and attendance statistics are placeholders
                until connected to live database queries. Parent Management
                navigation is available, but parent registration and student
                linking must be tested against the database.
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

function ManagementCard({
  title,
  description,
  buttonText,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  buttonText: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        {buttonText}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
