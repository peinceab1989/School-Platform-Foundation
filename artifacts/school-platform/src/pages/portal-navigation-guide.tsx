import { Link } from "wouter";
import { ArrowLeft, BookOpen, GraduationCap, Users, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "Administrator",
    icon: ShieldCheck,
    items: [
      ["Students", "/students", "Register, search and update learners; check account links."],
      ["Class Enrolments", "/student-enrolments", "Assign each active student to the correct class and academic session; previous placements are recorded in enrolment history."],
      ["Student ID Cards", "/student-id-cards", "Upload passport photos, grant printing and print approved cards."],
      ["Teachers & Staff", "/staff-invitations", "Invite staff, approve access and manage active staff records."],
      ["Parents & Guardians", "/parent-management", "Manage parent records and approved learner links."],
      ["Classes & Subjects", "/classes", "Maintain classes, subjects and academic sessions."],
      ["Attendance", "/attendance", "Review daily learner attendance."],
      ["Teaching Assignments", "/teaching-assignments", "Assign each teacher to the correct class, subject and academic session."],
      ["Examinations & CBT", "/examinations", "Manage online examinations and attempts."],
      ["Results Management", "/results-management", "Enter, review and publish academic results."],
      ["Fees Management", "/fees-management", "Manage fee charges, verified payments and receipts."],
      ["RESA Drive", "/school-services", "Upload, preview, organize and securely download school media and files."],
      ["School Settings", "/school-settings", "Manage school defaults and settings."],
    ],
  },
  {
    title: "Teacher",
    icon: BookOpen,
    items: [
      ["Assignments & Practical Centre", "/teacher-dashboard", "Create homework, practical examinations or projects for assigned classes and subjects. Add an optional visual/demo link and a practical marking rubric."],
      ["Marking", "/teacher-dashboard", "Review written responses and student photo, video or document evidence; record marks and feedback. Import graded practical averages into CA / 40 from Results Management."],
      ["Online CBT", "/teacher-dashboard", "Create and publish a separate computer-based examination."],
      ["Learning Materials", "/teaching-materials", "Share approved learning resources."],
      ["School Messages", "/school-communication", "Communicate with authorised school members."],
    ],
  },
  {
    title: "Student",
    icon: GraduationCap,
    items: [
      ["Assignments", "/student-assignments", "Open published work for your active class and academic session."],
      ["Practical evidence", "/student-assignments", "Attach a photo, video or document and submit it with your explanation. Use Student CBT separately for any published computer-based practical activity."],
      ["Student CBT", "/student-cbt", "Take an examination after it has been published for your class."],
      ["My Report Cards", "/my-results", "View results released by the school."],
      ["My ID Card", "/student-id-card", "View and print your ID card after administrator approval."],
      ["School Messages", "/school-communication", "Read and send permitted school messages."],
    ],
  },
  {
    title: "Parent / Guardian",
    icon: Users,
    items: [
      ["Parent Dashboard", "/parent-dashboard", "Review information for learners formally linked to your account."],
      ["Fees & Payments", "/parent-dashboard", "Review fee information and payment history."],
      ["Results & Attendance", "/parent-dashboard", "View released results and available attendance information."],
      ["School Messages", "/school-communication", "Contact the school through approved communication tools."],
    ],
  },
];

export default function PortalNavigationGuidePage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl bg-emerald-950 p-5 text-white sm:p-7">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA School Portal</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Portal Navigation Guide</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100">A practical guide to the main tasks available to administrators, teachers, students and parents. Menu visibility depends on your active role and permissions.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(section => {
          const Icon = section.icon;
          return <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-950"><Icon size={20}/>{section.title}</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {section.items.map(([label, href, description]) => <div key={label} className="py-3">
                <Link href={href} className="font-bold text-emerald-800 underline decoration-emerald-200 underline-offset-4">{label}</Link>
                <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
              </div>)}
            </div>
          </section>;
        })}
      </div>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <h2 className="font-extrabold">Important practical notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Teachers must select only classes and subjects assigned to them.</li>
          <li>Students can only see published work matching their active class and academic session.</li>
          <li>Practical evidence is private. Only the submitting student, assigned teacher and authorised school administrators can open it.</li>
          <li>RESA Drive stores files in the school's own secure storage. Google Drive is not required to upload or preview RESA Drive files.</li>
          <li>All existing portal records remain test/demo data until the school authorises the official data transition.</li>
        </ul>
      </section>
    </div>
  </main>;
}
