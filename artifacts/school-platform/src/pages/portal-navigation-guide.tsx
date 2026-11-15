import { useMemo, useState } from "react";
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

type TaskGuide = {
  title: string;
  role: string;
  keywords: string[];
  steps: string[];
  href: string;
  linkLabel: string;
};

const taskGuides: TaskGuide[] = [
  {
    title: "Admit a student and place the student in a class",
    role: "Administrator",
    keywords: ["admit", "admission", "register student", "new student", "enrol", "enroll", "class placement", "assign class", "student class"],
    steps: [
      "Open Admissions Management and review the application. Verify the learner's details and required documents before approving it.",
      "After approval, open Students and confirm that the learner's student record exists. Do not create a second record to work around a linking problem.",
      "Open Class Enrolments. Select the learner, the current academic session and the correct class, then save the enrolment.",
      "Return to the learner's record and confirm the class and session are correct. If the class is missing, check that the class and academic session have been created.",
    ],
    href: "/student-enrolments",
    linkLabel: "Open Class Enrolments",
  },
  {
    title: "Invite a teacher and assign classes or subjects",
    role: "Administrator",
    keywords: ["teacher", "staff", "invite", "approve teacher", "assign teacher", "teaching assignment", "subject teacher", "form teacher", "class teacher"],
    steps: [
      "Open Staff Invitations and invite the teacher using the correct email address and staff role.",
      "Verify the person's identity and role before approving access. Do not approve an unfamiliar or unverified account.",
      "Open Classes & Subjects and confirm the required class, subject and academic session exist.",
      "Open Teaching Assignments. Select the teacher, class, subject and session, then save the assignment. Repeat only for the classes and subjects that teacher is authorised to handle.",
      "Ask the teacher to sign in and confirm that the assigned class and subject appear on the teacher dashboard.",
    ],
    href: "/teaching-assignments",
    linkLabel: "Open Teaching Assignments",
  },
  {
    title: "Take and review daily attendance",
    role: "Administrator / authorised teacher",
    keywords: ["attendance", "mark attendance", "take attendance", "clock in", "clock out", "check in", "check out", "biometric", "present", "absent"],
    steps: [
      "Open Attendance from the portal menu. Choose the correct date, class or staff view where those filters are available.",
      "Use the approved attendance method available at the school. Check each learner or staff member before saving; do not create a second record when a scan fails.",
      "Save or submit the attendance and wait for the success confirmation.",
      "Refresh the attendance register and verify the saved entries. Report missing or duplicate entries to an administrator for review.",
    ],
    href: "/attendance",
    linkLabel: "Open Attendance",
  },
  {
    title: "Enter and publish student results",
    role: "Administrator / authorised results staff",
    keywords: ["result", "results", "report card", "publish result", "exam scores", "grades", "marks", "academic result"],
    steps: [
      "Open Results Management and choose the correct academic session, term, class and subject.",
      "Enter or import the marks for the correct learners. Check the assessment components and totals before saving.",
      "Save the results and review the class entries for missing marks, incorrect learner records or calculation errors.",
      "Use the publish action only after the results have been checked and approved. Students and parents can view results only after publication.",
      "Sign in through a student or parent test account to confirm that the published result is visible to the correct linked learner.",
    ],
    href: "/results-management",
    linkLabel: "Open Results Management",
  },
  {
    title: "Create a fee charge and verify a payment",
    role: "Administrator / Finance",
    keywords: ["fee", "fees", "school fees", "payment", "receipt", "finance", "verify payment", "fee charge"],
    steps: [
      "Open Fees Management and select the correct session, term, learner and fee item.",
      "Create or review the itemised fee assignment. Confirm the amount and due details before saving.",
      "When payment is made, locate the learner's payment record and verify the amount and payment evidence using the school's finance procedure.",
      "Only an authorised finance user should confirm a payment. A receipt should be issued only after verification; do not treat an unverified transfer screenshot as proof of settlement.",
      "Reopen the learner's fee record and confirm the balance and receipt status.",
    ],
    href: "/fees-management",
    linkLabel: "Open Fees Management",
  },
  {
    title: "Create and publish a CBT examination",
    role: "Administrator / authorised teacher",
    keywords: ["cbt", "exam", "examination", "online test", "computer based test", "publish exam", "student test"],
    steps: [
      "Open Examinations and create the examination with the correct title, subject, instructions and timing.",
      "Add and review the questions, answers, marks and duration. Check the exam before making it available to students.",
      "Set the intended class, academic session and availability window, then publish the examination.",
      "Open Student CBT using an authorised student test account and confirm that the published examination appears for the intended class.",
      "Do not share a live examination with an unintended class or publish it before the questions have been checked.",
    ],
    href: "/examinations",
    linkLabel: "Open Examinations",
  },
  {
    title: "Upload, share and find a file in RESA Drive",
    role: "Administrator",
    keywords: ["drive", "upload", "file", "files", "photo", "photos", "picture", "pictures", "image", "images", "video", "document", "pdf", "share file", "folder"],
    steps: [
      "Open School Services, then choose RESA Drive from the module list.",
      "Enter a folder name, choose whether the file is for authorised RESA portal members or administrators only, and select the file.",
      "Wait until the selected file name appears beside the file picker. Press Upload file once and keep the page open until the upload finishes.",
      "Wait for the success message, then check the file list. Use Refresh if needed. Do not repeatedly upload the same file while the first upload is processing.",
      "Use Preview or Download to test the saved file. If sharing is required, confirm the visibility is set for authorised school members.",
    ],
    href: "/school-services",
    linkLabel: "Open RESA Drive",
  },
  {
    title: "Link a parent or guardian to a student",
    role: "Administrator",
    keywords: ["parent", "guardian", "link child", "link student", "parent account", "family", "add parent"],
    steps: [
      "Open Parent Management and find or create the correct parent or guardian record.",
      "Verify the adult's identity and the relationship to the learner using the school's approved records.",
      "Find the correct student and create or activate the parent-to-student portal link. Check that you selected the right learner.",
      "Confirm the parent's portal access is enabled. Ask the parent to sign in and verify that only the linked learner appears on the dashboard.",
    ],
    href: "/parent-management",
    linkLabel: "Open Parent Management",
  },
  {
    title: "Create an assignment and receive student work",
    role: "Teacher / Student",
    keywords: ["assignment", "assignments", "homework", "classwork", "project", "practical", "submit work", "upload assignment"],
    steps: [
      "Teacher: open the Teacher Dashboard and start a new assignment or practical task for a class and subject assigned to you.",
      "Enter a clear title, instructions, due date and any marking guidance. Attach learning material if needed, then publish the task to the intended class.",
      "Student: open Student Assignments and select the published task for your active class and session.",
      "Read the instructions, attach the requested work or evidence and submit. Wait for the submission confirmation.",
      "Teacher: return to the assignment area to review submissions and provide marks or feedback.",
    ],
    href: "/teacher-dashboard",
    linkLabel: "Open Teacher Dashboard",
  },
  {
    title: "Print a student identity card",
    role: "Administrator",
    keywords: ["id card", "identity card", "student card", "passport photo", "print card", "photo card"],
    steps: [
      "Open Student ID Cards and search for the correct learner.",
      "Check the learner's name, admission number, class and other displayed details.",
      "Upload or confirm the correct passport photograph, then save the card details.",
      "Preview the card carefully before printing. Correct any wrong details before issuing it.",
    ],
    href: "/student-id-cards",
    linkLabel: "Open Student ID Cards",
  },
];

const STOP_WORDS = new Set(["a", "an", "and", "are", "do", "does", "for", "how", "i", "in", "is", "me", "my", "of", "on", "the", "to", "what", "where", "who", "with", "would", "you", "can", "please"]);

function tokensFor(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreText(queryTokens: string[], text: string) {
  const haystack = text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export default function PortalNavigationGuidePage() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);
  const results = useMemo(() => {
    const tokens = tokensFor(question);
    if (!tokens.length) return { tasks: [] as TaskGuide[], links: [] as { role: string; label: string; href: string; description: string; score: number }[] };
    const tasks = taskGuides
      .map(item => ({ item, score: scoreText(tokens, [item.title, item.role, ...item.keywords, ...item.steps].join(" ")) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(result => result.item);
    const links = sections.flatMap(section =>
      section.items
        .map(([label, href, description]) => ({
          role: section.title,
          label,
          href,
          description,
          score: scoreText(tokens, [label, description, section.title].join(" ")),
        }))
        .filter(item => item.score > 0),
    ).sort((a, b) => b.score - a.score).slice(0, 5);
    return { tasks, links };
  }, [question]);

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl bg-emerald-950 p-5 text-white sm:p-7">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA School Portal</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Portal Navigation Guide</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100">Choose a task or search using everyday words. The guide gives practical steps and takes you directly to the relevant portal page. Menu visibility depends on your active role and permissions.</p>
      </header>
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-emerald-900"><BookOpen size={20}/><h2 className="text-lg font-extrabold">What do you want to do?</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Try “how do I assign a teacher?”, “take attendance”, “upload photos”, “link a parent”, “publish results” or “print an ID card”. You do not need to type the exact menu name.</p>
        <form onSubmit={event => { event.preventDefault(); setAsked(true); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={question} onChange={event => { setQuestion(event.target.value); setAsked(false); }} placeholder="e.g. How do I upload a photo?" aria-label="Search portal instructions" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"/>
          <button type="submit" className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">Show me how</button>
        </form>
        {asked && <div className="mt-5 space-y-4" aria-live="polite">
          {results.tasks.length > 0 ? results.tasks.map(item => <article key={item.title} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{item.role}</p>
            <h3 className="mt-1 text-base font-extrabold text-slate-900">{item.title}</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{item.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            <Link href={item.href} className="mt-4 inline-flex rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">{item.linkLabel} →</Link>
          </article>) : <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">I could not find a close match in the approved guide. Try one or two key words, such as “attendance”, “teacher”, “fees”, “upload” or “parent”.</p>}
          {results.links.length > 0 && <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Related portal areas</h3><div className="mt-2 flex flex-wrap gap-2">{results.links.map(item => <Link key={item.role + item.label} href={item.href} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">{item.label} · {item.role}</Link>)}</div></div>}
        </div>}
      </section>
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
