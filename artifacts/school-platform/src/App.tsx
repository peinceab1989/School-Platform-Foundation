
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { ErrorBoundary } from '@/components/error-boundary';

import {
  FoundationAppView,
  type FoundationAccessCheckState,
  type FoundationAuthState,
  type FoundationMembership,
} from '@/components/foundation/foundation-app-view';

import AdminPortalShell from '@/components/admin-portal-shell';
import AdminDashboard from '@/pages/admin-dashboard';
import ProfilePhotoCard from '@/components/profile-photo-card';
import StaffInvitationsPage from '@/pages/staff-invitations';
import TeachingAssignmentsPage from '@/pages/teaching-assignments';
import HrManagementPage from '@/pages/hr-management';
import SchoolReportsPage from '@/pages/school-reports';
import SchoolServicesPage from '@/pages/school-services';
import SchoolCommunicationPage from '@/pages/school-communication';
import StaffAttendancePage from '@/pages/staff-attendance';
import StudentsPage from '@/pages/students';
import AttendancePage from '@/pages/attendance';
import AnnouncementsPage from '@/pages/announcements';
import ResultsPage from '@/pages/results';
import ResultsManagementPage from '@/pages/results-management';
import MyPublishedResultsPage from '@/pages/my-published-results';
import FormTeacherAttendancePage from '@/pages/form-teacher-attendance';
import ExamsPage from '@/pages/examinations';
import SchoolSettingsPage from '@/pages/school-settings';
import ClassManagementPage from '@/pages/class-management';
import SubjectManagementPage from '@/pages/subject-management';
import ParentManagementPage from '@/pages/parent-management';
import TeacherDashboard from '@/pages/teacher-dashboard';
import AcceptInvitationPage from '@/pages/accept-invitation';
import ResetPasswordPage from '@/pages/reset-password';
import StudentCbtPage from '@/pages/student-cbt';
import StudentAssignmentsPanel from '@/pages/student-assignments-panel';
import Home from '@/pages/home';
import PortalOptionsPage from '@/pages/portal-options';
import StudentPracticeDrillsPage from '@/pages/student-practice-drills';
import TeachingMaterialsPage from '@/pages/teaching-materials';
import ResaChatPage from '@/pages/resa-chat';
import PublicationCentre from '@/pages/publication-centre';
import TestDataSetupPage from '@/pages/test-data-setup';
import SchoolCctvPage from '@/pages/school-cctv';
import NotificationsPage from '@/pages/notifications';
import UnreadMessageBadge from '@/components/unread-message-badge';
import NotFound from '@/pages/not-found';

import {
  AboutPage,
  AcademicsPage,
  ActivitiesGalleryPage,
  AdmissionsPage,
  ContactPage,
  InnovationTechnologyPage,
  PracticalSkillsPage,
  WisdomInspirationPage,
} from '@/pages/public-pages';

import {
  Link,
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
} from 'wouter';

import {
  confirmUnknownSchoolIsDenied,
  runMembershipAccessCheck,
} from '@/features/access/access-check';

import {
  getSupabaseClient,
  hasSupabaseConfig,
} from '@/lib/supabase/client';

const queryClient = new QueryClient();

type NexusModule = {
  id: string;
  module_key: string;
  display_name: string;
  is_enabled: boolean;
  updated_at: string;
};

type NexusAuditEntry = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type SecurityTestStatus =
  | 'idle'
  | 'running'
  | 'pass'
  | 'fail'
  | 'inconclusive';

function normalizePath(path: string): string {
  const pathname = path.split('?')[0].split('#')[0];
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

const ADMIN_SCHOOL_PATHS = [
  '/students',
  '/attendance',
  '/announcements',
  '/results',
  '/examinations',
  '/school-settings',
  '/classes',
  '/subjects',
  '/subject-management',
  '/parents',
  '/parent-management',
  '/staff-invitations',
  '/teaching-assignments',
  '/hr-management',
  '/school-reports',
  '/school-services',
  '/publication-centre',
  '/staff-attendance',
  '/school-cctv',
];

const PROTECTED_SCHOOL_PATHS = [
  '/dashboard',
  '/parent-dashboard',
  '/results-management',
  '/teaching-materials',
  '/resa-chat',
  ...ADMIN_SCHOOL_PATHS,
  '/form-teacher-attendance',
  '/teacher-dashboard',
  '/student-dashboard',
  '/my-results',
  '/student-cbt',
  '/student-assignments',
  '/school-communication',
  '/notifications',
  '/school-cctv',
];

const buttonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '11px 15px',
  background: '#e6c66b',
  color: '#17251b',
  fontWeight: 700,
  cursor: 'pointer',
};

const panelStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e0e7e0',
  borderRadius: 12,
  padding: 18,
  marginBottom: 18,
  overflowWrap: 'anywhere',
};

const statStyle: CSSProperties = {
  padding: 15,
  background: '#f1f6f1',
  borderRadius: 10,
};

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: '#536456',
};

const statNumberStyle: CSSProperties = {
  display: 'block',
  fontSize: 28,
  marginTop: 8,
};

function ParentDashboard({ schoolId, schoolName, userId, email, onSignOut }: { schoolId: string; schoolName: string; userId: string; email?: string; onSignOut: () => void }) {
  return <main className="min-h-screen bg-stone-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <header className="rounded-3xl bg-emerald-950 p-5 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA · Parent & Guardian Portal</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Your child's school connection</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Stay informed about school communication, published academic results and important updates for the learners linked to your account.</p>
        <p className="mt-3 break-words text-xs text-emerald-100">{schoolName} {email ? "· " + email : ""}</p>
        <button type="button" onClick={onSignOut} className="mt-5 min-h-11 rounded-xl bg-amber-200 px-4 py-2 text-sm font-bold text-emerald-950">Sign out</button>
      </header>
      <ProfilePhotoCard userId={userId} displayName={email} roleLabel="Parent / Guardian" />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/my-results" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-700"><h2 className="font-extrabold text-emerald-950">Published results</h2><p className="mt-2 text-sm leading-6 text-slate-600">View report cards for learners linked to your account.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">View results →</span></Link>
        <Link href="/school-communication" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-700"><h2 className="font-extrabold text-emerald-950">School messages</h2><p className="mt-2 text-sm leading-6 text-slate-600">Communicate with authorised school staff.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">Open messages →</span></Link>
        <Link href="/notifications" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-700"><h2 className="font-extrabold text-emerald-950">Notifications</h2><p className="mt-2 text-sm leading-6 text-slate-600">Check important school notices and account updates.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">View notifications →</span></Link>
        <Link href="/school-cctv" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-700"><h2 className="font-extrabold text-emerald-950">School monitoring</h2><p className="mt-2 text-sm leading-6 text-slate-600">Access monitoring services when enabled and authorised.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">Open service →</span></Link>
      </section>
      <footer className="py-3 text-center text-xs text-slate-500">Designed & Powered by JETAB TECH</footer>
    </div>
  </main>;
}

/* =========================================================
   STUDENT DASHBOARD
========================================================= */

type StudentAcademicSummary = {
  average_score: number | string | null;
  position: number | null;
  teacher_comment: string | null;
  principal_comment: string | null;
  created_at: string;
};

function StudentDashboard({
  schoolId,
  schoolName,
  userId,
  email,
  onSignOut,
}: {
  schoolId: string;
  schoolName: string;
  userId: string;
  email?: string;
  onSignOut: () => void;
}) {
  const [academicSummary, setAcademicSummary] = useState<StudentAcademicSummary | null>(null);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [academicError, setAcademicError] = useState<string | null>(null);
  const [publishedCbtCount, setPublishedCbtCount] = useState<number | null>(null);
  const [cbtNoticeError, setCbtNoticeError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSupabaseClient().functions.invoke("resa-student-cbt", { body: { action: "list" } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || data?.error) {
          setCbtNoticeError(error?.message || data?.error || "Published CBT status is temporarily unavailable.");
          setPublishedCbtCount(null);
          return;
        }
        setPublishedCbtCount(Array.isArray(data?.exams) ? data.exams.length : 0);
        setCbtNoticeError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCbtNoticeError(error instanceof Error ? error.message : "Published CBT status is temporarily unavailable.");
      });
    return () => { active = false; };
  }, [schoolId, userId]);

  useEffect(() => {
    let active = true;

    async function loadAcademicSummary() {
      setAcademicLoading(true);
      setAcademicError(null);

      try {
        const client = getSupabaseClient();
        const { data: student, error: studentError } = await (client as any)
          .from('students')
          .select('id')
          .eq('school_id', schoolId)
          .eq('user_id', userId)
          .maybeSingle();

        if (studentError) throw studentError;
        if (!student) {
          if (active) setAcademicSummary(null);
          return;
        }

        const { data, error } = await (client as any)
          .from('student_term_results')
          .select('average_score, position, teacher_comment, principal_comment, created_at')
          .eq('school_id', schoolId)
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (active) setAcademicSummary((data as StudentAcademicSummary | null) ?? null);
      } catch (error) {
        if (active) {
          setAcademicError(
            error instanceof Error ? error.message : 'Academic progress could not be loaded.',
          );
        }
      } finally {
        if (active) setAcademicLoading(false);
      }
    }

    void loadAcademicSummary();
    return () => {
      active = false;
    };
  }, [schoolId, userId]);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 16,
        boxSizing: 'border-box',
        background: '#f4f7f1',
        color: '#17251b',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1050, margin: '0 auto' }}>
        <header
          style={{
            background: '#123d2b',
            color: '#fff',
            borderRadius: 16,
            padding: '24px 20px',
            marginBottom: 22,
          }}
        >
          <div style={{ color: '#e6c66b', fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>
            RESA SCHOOL PORTAL
          </div>
          <h1 style={{ fontSize: 27, lineHeight: 1.3, margin: '12px 0' }}>Student Dashboard</h1>
          <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>Welcome to your learning portal.</p>
          <p style={{ margin: '0 0 18px', color: '#e8eee8', overflowWrap: 'anywhere' }}>
            {schoolName}
          </p>
          {email && (
            <p style={{ fontSize: 13, color: '#e8eee8', overflowWrap: 'anywhere', margin: '0 0 18px' }}>
              Signed in as: {email}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/notifications" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#fff', color: '#123d2b', fontWeight: 700, textDecoration: 'none' }}>Notifications <UnreadMessageBadge schoolId={schoolId} /></Link>
            <Link href="/my-results" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#e6c66b', color: '#17251b', fontWeight: 700, textDecoration: 'none' }}>My Report Cards</Link>
            <Link href="/school-communication" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#e6c66b', color: '#17251b', fontWeight: 700, textDecoration: 'none' }}>School messages</Link>
            <button type="button" onClick={onSignOut} style={buttonStyle}>Sign out</button>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
          <ProfilePhotoCard userId={userId} displayName={email} roleLabel="Student" />
          <section style={{ ...panelStyle, borderColor: publishedCbtCount ? '#d6b75a' : '#dce5dd', background: publishedCbtCount ? '#fffaf0' : '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>Published CBT examinations</h2>
                <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>
                  {publishedCbtCount === null ? (cbtNoticeError || 'Checking examinations assigned to your active class…') :
                    publishedCbtCount > 0 ? `${publishedCbtCount} published examination${publishedCbtCount === 1 ? '' : 's'} available for your class. Open CBT to begin.` :
                    'No published examination is currently assigned to your active class and academic session. This area checks automatically when you open the dashboard.'}
                </p>
              </div>
              <Link href="/student-cbt" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, padding: '12px 17px', background: '#123d2b', color: '#fff', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {publishedCbtCount ? 'Take published CBT' : 'Check CBT'}
              </Link>
            </div>
          </section>
        </div>

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 10px', fontSize: 21 }}>My Learning</h2>
          <p style={{ color: '#536456', lineHeight: 1.7, margin: 0 }}>
            Open your practice activities or take published examinations assigned to your enrolled class.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <Link href="/practice-drills" style={{ display: 'inline-block', borderRadius: 8, padding: '11px 15px', background: '#fff', color: '#123d2b', border: '1px solid #cdd8cd', fontWeight: 700, textDecoration: 'none' }}>Practice Drills</Link>
            <Link href="/teaching-materials" style={{ display: 'inline-block', borderRadius: 8, padding: '11px 15px', background: '#e6c66b', color: '#17251b', fontWeight: 700, textDecoration: 'none' }}>Learning Resources</Link>
            <Link href="/resa-chat" style={{ display: 'inline-block', borderRadius: 8, padding: '11px 15px', background: '#d9efe2', color: '#123d2b', border: '1px solid #cdd8cd', fontWeight: 700, textDecoration: 'none' }}>School Chat</Link>
            <Link href="/student-assignments" style={{ display: 'inline-block', borderRadius: 8, padding: '11px 15px', background: '#17623d', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Open Assignments</Link>
            <Link href="/student-cbt" style={{ display: 'inline-block', borderRadius: 8, padding: '11px 15px', background: '#123d2b', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Open Student CBT</Link>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <section style={panelStyle}>
            <div style={{ fontSize: 25, marginBottom: 10 }}>📚</div>
            <h3 style={{ margin: '0 0 8px' }}>Learning Resources</h3>
            <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>
              Practise your skills with the available learning drills.
            </p>
            <Link href="/practice-drills" style={{ display: 'inline-block', marginTop: 12, color: '#17623d', fontWeight: 700 }}>Open practice drills</Link>
          </section>

          <section style={panelStyle}>
            <div style={{ fontSize: 25, marginBottom: 10 }}>📝</div>
            <h3 style={{ margin: '0 0 8px' }}>Assignments</h3>
            <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>
              View published class assignments, instructions, due dates, submission status, scores and teacher feedback.
            </p>
            <Link href="/student-assignments" style={{ display: 'inline-block', marginTop: 12, color: '#17623d', fontWeight: 700 }}>Open assignments</Link>
          </section>
          <section style={panelStyle}>
            <div style={{ fontSize: 25, marginBottom: 10 }}>💻</div>
            <h3 style={{ margin: '0 0 8px' }}>Computer-Based Tests (CBT)</h3>
            <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>
              Take published computer-based tests in a separate assessment area.
            </p>
            <Link href="/student-cbt" style={{ display: 'inline-block', marginTop: 12, color: '#17623d', fontWeight: 700 }}>Open CBT</Link>
          </section>

          <section style={panelStyle}>
            <div style={{ fontSize: 25, marginBottom: 10 }}>📊</div>
            <h3 style={{ margin: '0 0 8px' }}>My Academic Progress</h3>
            {academicLoading ? (
              <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>Loading your latest published result…</p>
            ) : academicError ? (
              <p role="alert" style={{ color: '#9b2c2c', lineHeight: 1.6, margin: 0 }}>{academicError}</p>
            ) : academicSummary ? (
              <div style={{ color: '#536456', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px' }}>Latest average: <strong>{academicSummary.average_score === null ? 'Not recorded' : Number(academicSummary.average_score).toFixed(1)}%</strong></p>
                {academicSummary.position !== null && <p style={{ margin: '0 0 6px' }}>Class position: <strong>{academicSummary.position}</strong></p>}
                <p style={{ fontSize: 12, margin: '0 0 8px' }}>Updated {new Date(academicSummary.created_at).toLocaleDateString()}</p>
                {academicSummary.teacher_comment && <p style={{ margin: '8px 0 0' }}>Teacher: {academicSummary.teacher_comment}</p>}
                {academicSummary.principal_comment && <p style={{ margin: '8px 0 0' }}>Principal: {academicSummary.principal_comment}</p>}
              </div>
            ) : (
              <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>
                No published term result is available for this account yet. Check again after the school releases results.
              </p>
            )}
          </section>

          <section style={panelStyle}>
            <div style={{ fontSize: 25, marginBottom: 10 }}>📅</div>
            <h3 style={{ margin: '0 0 8px' }}>Attendance</h3>
            <p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>
              For your current attendance record, contact your class teacher or school office.
            </p>
            <Link href="/school-communication" style={{ display: 'inline-block', marginTop: 12, color: '#17623d', fontWeight: 700 }}>Message the school</Link>
          </section>
        </div>

        <footer style={{ textAlign: 'center', color: '#68766b', fontSize: 12, padding: '12px 0 20px' }}>
          RHEMA EXPLOITS SCIENCE ACADEMY (RESA)
          <br />
          PASSION • SKILLS • EXCELLENT SPIRIT
        </footer>
      </div>
    </main>
  );
}

/* =========================================================
   JETAB TECH PRIVATE ENGINE ROOM
========================================================= */

function NexusDashboard({
  email,
  onSignOut,
}: {
  email?: string;
  onSignOut: () => void;
}) {
  const [ownerCheck, setOwnerCheck] = useState<
    'checking' | 'owner' | 'denied' | 'error'
  >('checking');

  const [modules, setModules] = useState<NexusModule[]>([]);
  const [auditEntries, setAuditEntries] = useState<NexusAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyModule, setBusyModule] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const [securityTestStatus, setSecurityTestStatus] =
    useState<SecurityTestStatus>('idle');
  const [securityTestMessage, setSecurityTestMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyPrivateAccess() {
      setOwnerCheck('checking');

      try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('is_nexus_owner');

        if (!active) return;

        if (error) {
          setErrorText(error.message);
          setOwnerCheck('error');
          return;
        }

        if (data !== true) {
          setOwnerCheck('denied');
          return;
        }

        setOwnerCheck('owner');
      } catch (error) {
        if (!active) return;

        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not verify private system access.',
        );
        setOwnerCheck('error');
      }
    }

    void verifyPrivateAccess();

    return () => {
      active = false;
    };
  }, []);

  const testDatabaseProtection = useCallback(async () => {
    setSecurityTestStatus('running');
    setSecurityTestMessage(null);

    try {
      const client = getSupabaseClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user) {
        setSecurityTestStatus('inconclusive');
        setSecurityTestMessage(
          userError?.message ||
            'No authenticated user was available for this test. Sign in again.',
        );
        return;
      }

      const {
        data: ownerData,
        error: ownerError,
      } = await client.rpc('is_nexus_owner');

      if (ownerError) {
        setSecurityTestStatus('inconclusive');
        setSecurityTestMessage(
          `Could not verify the current account's owner status: ${ownerError.message}`,
        );
        return;
      }

      if (ownerData !== false) {
        setSecurityTestStatus('inconclusive');
        setSecurityTestMessage(
          'The current account was not confirmed as a non-owner. No protected test request was made.',
        );
        return;
      }

      const testModuleKey = '__jetab_security_test_nonexistent__';

      const { error: rpcError } = await client.rpc(
        'nexus_set_module_enabled',
        {
          p_module_key: testModuleKey,
          p_is_enabled: false,
        },
      );

      if (!rpcError) {
        setSecurityTestStatus('fail');
        setSecurityTestMessage(
          'The function returned successfully for a confirmed non-owner. Review the database authorization logic immediately.',
        );
        return;
      }

      const message = rpcError.message || 'Unknown database error';

      if (message.includes('Access denied: Nexus owner only')) {
        setSecurityTestStatus('pass');
        setSecurityTestMessage(
          'PASS: Supabase rejected the authenticated non-owner at the database function owner check. No real module was targeted.',
        );
        return;
      }

      if (message.includes(`Nexus module not found: ${testModuleKey}`)) {
        setSecurityTestStatus('fail');
        setSecurityTestMessage(
          'FAIL: The request reached the module lookup instead of being rejected by the owner check. Review the database function before further use.',
        );
        return;
      }

      setSecurityTestStatus('inconclusive');
      setSecurityTestMessage(
        `The request returned an unexpected error, so authorization could not be confirmed: ${message}`,
      );
    } catch (error) {
      setSecurityTestStatus('inconclusive');
      setSecurityTestMessage(
        error instanceof Error
          ? error.message
          : 'The security test could not be completed.',
      );
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorText(null);

    try {
      const client = getSupabaseClient();

      const [moduleResult, auditResult] = await Promise.all([
        client
          .from('nexus_module_controls')
          .select('id, module_key, display_name, is_enabled, updated_at')
          .order('display_name', { ascending: true }),

        client
          .from('nexus_audit_logs')
          .select('id, action, target_type, target_id, details, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (moduleResult.error) throw moduleResult.error;
      if (auditResult.error) throw auditResult.error;

      setModules((moduleResult.data ?? []) as NexusModule[]);
      setAuditEntries((auditResult.data ?? []) as NexusAuditEntry[]);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Could not load private settings and audit records.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ownerCheck === 'owner') {
      void loadData();
    }
  }, [ownerCheck, loadData]);

  const changeModuleStatus = useCallback(
    async (module: NexusModule) => {
      const nextStatus = !module.is_enabled;
      const action = nextStatus ? 'enable' : 'disable';

      if (
        !window.confirm(
          `Are you sure you want to ${action} "${module.display_name}"?`,
        )
      ) {
        return;
      }

      setBusyModule(module.module_key);
      setErrorText(null);
      setStatusText(null);

      try {
        const client = getSupabaseClient();

        const { error } = await client.rpc('nexus_set_module_enabled', {
          p_module_key: module.module_key,
          p_is_enabled: nextStatus,
        });

        if (error) throw error;

        setStatusText(`${module.display_name} settings have been updated.`);
        await loadData();
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The module setting could not be changed.',
        );
      } finally {
        setBusyModule(null);
      }
    },
    [loadData],
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 20,
        background: '#f4f7f4',
        color: '#17251b',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            background: '#123d2b',
            color: '#fff',
            borderRadius: 14,
            padding: 22,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              color: '#e6c66b',
            }}
          >
            JETAB TECH • PRIVATE SYSTEM
          </div>

          <h1 style={{ margin: '10px 0', fontSize: 28 }}>
            JETAB Engine Room
          </h1>

          <p style={{ margin: '0 0 16px', color: '#f0f3ef' }}>
            The private control centre.
          </p>

          <p style={{ margin: '0 0 16px', overflowWrap: 'anywhere' }}>
            Signed in as: {email || 'Authenticated account'}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={ownerCheck !== 'owner' || loading}
              style={buttonStyle}
            >
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>

            <button type="button" onClick={onSignOut} style={buttonStyle}>
              Sign out
            </button>
          </div>
        </header>

        {ownerCheck === 'checking' && (
          <section style={panelStyle}>
            Verifying private system access…
          </section>
        )}

        {ownerCheck === 'error' && (
          <section style={panelStyle}>
            <h2>Access verification failed</h2>
            <p>{errorText || 'The access check could not be completed.'}</p>
            <p>
              Check the Supabase connection and confirm that the existing
              private-access verification function is available.
            </p>
          </section>
        )}

        {ownerCheck === 'denied' && (
          <>
            <section style={panelStyle}>
              <h2>Access denied</h2>
              <p>
                This account has not been verified for the private system.
                These controls are unavailable to this account.
              </p>
            </section>

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>
                Database security verification
              </h2>

              <p>
                This test checks whether Supabase rejects a signed-in
                non-owner when calling the protected module-control function
                directly. It uses a deliberately nonexistent module key and
                does not intentionally change any real module.
              </p>

              <p style={{ fontSize: 13, color: '#536456' }}>
                Run this test only while signed in with the non-owner account.
                Do not share passwords, access tokens, or secret keys.
              </p>

              <button
                type="button"
                onClick={() => void testDatabaseProtection()}
                disabled={securityTestStatus === 'running'}
                style={{
                  ...buttonStyle,
                  background: '#123d2b',
                  color: '#fff',
                  opacity: securityTestStatus === 'running' ? 0.65 : 1,
                }}
              >
                {securityTestStatus === 'running'
                  ? 'Testing database protection…'
                  : 'Test database protection'}
              </button>

              {securityTestStatus !== 'idle' && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 8,
                    overflowWrap: 'anywhere',
                    background:
                      securityTestStatus === 'pass'
                        ? '#e3f4e7'
                        : securityTestStatus === 'fail'
                          ? '#fbe6e6'
                          : '#fff4d9',
                    color:
                      securityTestStatus === 'pass'
                        ? '#155b30'
                        : securityTestStatus === 'fail'
                          ? '#8b1e1e'
                          : '#704f0a',
                    border:
                      securityTestStatus === 'pass'
                        ? '1px solid #7eae8d'
                        : securityTestStatus === 'fail'
                          ? '1px solid #d68a8a'
                          : '1px solid #e5ca7a',
                  }}
                >
                  <strong>
                    {securityTestStatus === 'running'
                      ? 'Test running'
                      : securityTestStatus === 'pass'
                        ? 'PASS'
                        : securityTestStatus === 'fail'
                          ? 'FAIL'
                          : 'INCONCLUSIVE'}
                  </strong>

                  {securityTestMessage && (
                    <p style={{ marginBottom: 0 }}>
                      {securityTestMessage}
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {ownerCheck === 'owner' && (
          <>
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>System overview</h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={statStyle}>
                  <div style={statLabelStyle}>Registered modules</div>
                  <strong style={statNumberStyle}>{modules.length}</strong>
                </div>

                <div style={statStyle}>
                  <div style={statLabelStyle}>Enabled modules</div>
                  <strong style={statNumberStyle}>
                    {modules.filter((module) => module.is_enabled).length}
                  </strong>
                </div>

                <div style={statStyle}>
                  <div style={statLabelStyle}>Disabled modules</div>
                  <strong style={statNumberStyle}>
                    {modules.filter((module) => !module.is_enabled).length}
                  </strong>
                </div>
              </div>
            </section>

            {errorText && (
              <section
                role="alert"
                style={{
                  ...panelStyle,
                  border: '1px solid #d68a8a',
                  color: '#8b1e1e',
                }}
              >
                <strong>Error:</strong> {errorText}
              </section>
            )}

            {statusText && (
              <section
                role="status"
                style={{
                  ...panelStyle,
                  border: '1px solid #7eae8d',
                  color: '#155b30',
                }}
              >
                {statusText}
              </section>
            )}

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Module settings</h2>

              <p>
                These settings are stored in Supabase, and changes are
                recorded in the audit log. The enabled/disabled settings are
                not automatically enforced across every portal feature unless
                that feature has its own enforcement logic.
              </p>

              {loading && modules.length === 0 && <p>Loading modules…</p>}

              {!loading && modules.length === 0 && !errorText && (
                <p>No modules were returned by Supabase.</p>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                {modules.map((module) => (
                  <article
                    key={module.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                      flexWrap: 'wrap',
                      padding: 14,
                      border: '1px solid #dfe6df',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ minWidth: 180, flex: '1 1 220px' }}>
                      <strong>{module.display_name}</strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#68766b',
                          marginTop: 4,
                        }}
                      >
                        {module.module_key}
                      </div>

                      <div style={{ marginTop: 7 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            borderRadius: 20,
                            padding: '4px 9px',
                            fontSize: 12,
                            background: module.is_enabled
                              ? '#d9f1df'
                              : '#f8dddd',
                            color: module.is_enabled ? '#155b30' : '#8b1e1e',
                          }}
                        >
                          {module.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void changeModuleStatus(module)}
                      disabled={busyModule !== null || loading}
                      style={{
                        ...buttonStyle,
                        background: module.is_enabled ? '#8b2c2c' : '#17683b',
                        color: '#fff',
                        opacity: busyModule !== null || loading ? 0.65 : 1,
                      }}
                    >
                      {busyModule === module.module_key
                        ? 'Saving…'
                        : module.is_enabled
                          ? 'Disable'
                          : 'Enable'}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>System activity log</h2>
              <p>Recent recorded actions, newest first.</p>

              {auditEntries.length === 0 && !loading && (
                <p>No audit entries have been recorded yet.</p>
              )}

              <div style={{ display: 'grid', gap: 10 }}>
                {auditEntries.map((entry) => (
                  <article
                    key={entry.id}
                    style={{
                      padding: 12,
                      background: '#f7f9f7',
                      borderRadius: 8,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <strong>{entry.action.replaceAll('_', ' ')}</strong>

                    {entry.target_type && <div>Type: {entry.target_type}</div>}
                    {entry.target_id && <div>Target: {entry.target_id}</div>}

                    <div
                      style={{
                        fontSize: 12,
                        color: '#68766b',
                        marginTop: 5,
                      }}
                    >
                      {new Date(entry.created_at).toLocaleString()}
                    </div>

                    {entry.details &&
                      Object.keys(entry.details).length > 0 && (
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            fontSize: 12,
                          }}
                        >
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/* =========================================================
   SCHOOL PORTAL AND PRIVATE LOGIN
========================================================= */

const privateLabelStyle: CSSProperties = {
  display: 'block',
  margin: '0 0 7px',
  fontSize: 13,
  fontWeight: 700,
  color: '#263a2b',
};

const privateInputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  margin: '0 0 16px',
  padding: '12px 13px',
  border: '1px solid #cbd5cc',
  borderRadius: 8,
  background: '#fff',
  color: '#17251b',
  fontSize: 14,
  outlineColor: '#17683b',
};

const privateSubmitStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  border: 'none',
  borderRadius: 8,
  padding: '13px 12px',
  background: '#123d2b',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const privateCancelStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 10,
  border: '1px solid #d6ded7',
  borderRadius: 8,
  padding: '11px 12px',
  background: '#fff',
  color: '#34443a',
  fontSize: 14,
  cursor: 'pointer',
};

function FoundationPage() {
  const [location, setLocation] = useLocation();
  const currentPath = normalizePath(location);

  const [session, setSession] = useState<Session | null>(null);

  const [authState, setAuthState] = useState<FoundationAuthState>(
    hasSupabaseConfig ? 'loading' : 'needs-config',
  );

  const [memberships, setMemberships] = useState<FoundationMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);

  const [accessCheckState, setAccessCheckState] =
    useState<FoundationAccessCheckState>('idle');

  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const [privateLoginOpen, setPrivateLoginOpen] = useState(
    currentPath === '/jetab-engine-room' || currentPath === '/nexus',
  );
  const [privateUsername, setPrivateUsername] = useState('');
  const [privatePassword, setPrivatePassword] = useState('');
  const [privateLoginBusy, setPrivateLoginBusy] = useState(false);

  const adminMembership = memberships.find(
    (membership) =>
      membership.role === 'admin' && membership.status === 'active',
  );

  const teacherMembership = memberships.find(
    (membership) =>
      membership.role === 'teacher' && membership.status === 'active',
  );

  const studentMembership = memberships.find(
    (membership) =>
      membership.role === 'student' && membership.status === 'active',
  );

  const parentMembership = memberships.find(
    (membership) =>
      membership.role === 'parent' && membership.status === 'active',
  );

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthState('needs-config');
      return;
    }

    let active = true;
    const client = getSupabaseClient();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setAuthState(nextSession ? 'signed-in' : 'signed-out');
      if (nextSession?.user.app_metadata?.must_change_password === true) setLocation('/reset-password');
      setErrorText(null);
      setStatusText(null);
      setAccessCheckState('idle');

      if (!nextSession) {
        setMemberships([]);
        setMembershipsLoading(false);
      }
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setErrorText(error.message);
          setSession(null);
          setAuthState('signed-out');
          return;
        }

        setSession(data.session);
        setAuthState(data.session ? 'signed-in' : 'signed-out');
        if (data.session?.user.app_metadata?.must_change_password === true) setLocation('/reset-password');
      })
      .catch((error: unknown) => {
        if (!active) return;

        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not restore the saved sign-in session.',
        );

        setSession(null);
        setAuthState('signed-out');
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * Protected school routes:
   * - Active admins retain administrator access.
   * - Active teachers are directed to the teacher dashboard.
   * - Active students are directed to the student dashboard.
   * - Other accounts do not receive protected school-page access.
   *
   * Membership access verification remains required.
   */
  useEffect(() => {
    if (!PROTECTED_SCHOOL_PATHS.includes(currentPath)) {
      return;
    }

    if (authState === 'signed-out' || authState === 'needs-config') {
      setLocation('/portal');
      return;
    }

    if (
      authState !== 'signed-in' ||
      membershipsLoading ||
      accessCheckState === 'idle' ||
      accessCheckState === 'loading'
    ) {
      return;
    }

    if (accessCheckState !== 'success') {
      setLocation('/portal');
      return;
    }

    // A teacher account must never be routed into administrator pages,
    // even if an old or duplicate admin membership is also present.
    if (teacherMembership) {
      if (
        currentPath === '/dashboard' ||
        currentPath === '/student-dashboard' ||
        currentPath === '/student-cbt' ||
        ADMIN_SCHOOL_PATHS.includes(currentPath)
      ) {
        setLocation('/teacher-dashboard');
      }
      return;
    }

    // Only accounts without an active teacher membership may use admin routes.
    if (adminMembership) {
      if (
        currentPath === '/teacher-dashboard' ||
        currentPath === '/student-dashboard' ||
        currentPath === '/student-cbt'
      ) {
        setLocation('/dashboard');
      }
      return;
    }

    if (studentMembership) {
      if (currentPath !== '/student-dashboard' && currentPath !== '/student-cbt' && currentPath !== '/school-communication' && currentPath !== '/my-results' && currentPath !== '/teaching-materials' && currentPath !== '/resa-chat') {
        setLocation('/student-dashboard');
      }
      return;
    }

    if (parentMembership) {
      if (!['/school-cctv', '/notifications', '/school-communication', '/my-results'].includes(currentPath)) setLocation('/school-cctv');
      return;
    }

    setLocation('/portal');
  }, [
    authState,
    currentPath,
    membershipsLoading,
    accessCheckState,
    adminMembership,
    teacherMembership,
    studentMembership,
    parentMembership,
    setLocation,
  ]);

  /*
   * Route signed-in users from the portal landing page to
   * the dashboard matching their active membership.
   */
  useEffect(() => {
    if (
      currentPath !== '/portal' ||
      authState !== 'signed-in' ||
      membershipsLoading ||
      accessCheckState !== 'success'
    ) {
      return;
    }

    // Keep the portal landing redirect consistent with protected-route
    // handling: teacher membership takes priority over any stale admin row.
    if (teacherMembership) {
      setLocation('/teacher-dashboard');
    } else if (adminMembership) {
      setLocation('/dashboard');
    } else if (studentMembership) {
      setLocation('/student-dashboard');
    } else if (parentMembership) {
      setLocation('/school-cctv');
    }
  }, [
    currentPath,
    authState,
    membershipsLoading,
    accessCheckState,
    adminMembership,
    teacherMembership,
    studentMembership,
    parentMembership,
    setLocation,
  ]);

  useEffect(() => {
    if (
      (currentPath === '/jetab-engine-room' || currentPath === '/nexus') &&
      authState !== 'signed-in'
    ) {
      setPrivateLoginOpen(true);
    }
  }, [currentPath, authState]);

  useEffect(() => {
    if (!session || authState !== 'signed-in') {
      setMemberships([]);
      setMembershipsLoading(false);
      setAccessCheckState('idle');
      return;
    }

    let active = true;

    setMembershipsLoading(true);
    setAccessCheckState('loading');

    void runMembershipAccessCheck(getSupabaseClient(), session.user.id)
      .then(({ memberships: nextMemberships, result }) => {
        if (!active) return;

        if (!result.passed) {
          setMemberships([]);
          setAccessCheckState('error');
          setErrorText(result.message);
          return;
        }

        setMemberships(nextMemberships);
        setAccessCheckState('success');
        setStatusText(
          `${nextMemberships.length} school ${
            nextMemberships.length === 1 ? 'membership is' : 'memberships are'
          } visible to this account.`,
        );
      })
      .catch((error: unknown) => {
        if (!active) return;

        setMemberships([]);
        setAccessCheckState('error');
        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not load this account’s school memberships.',
        );
      })
      .finally(() => {
        if (active) setMembershipsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authState, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!hasSupabaseConfig) {
      setAuthState('needs-config');
      setErrorText('Supabase is not configured.');
      return false;
    }

    setAuthState('loading');
    setErrorText(null);
    setStatusText(null);

    try {
      const identifier = email.trim();
      const authEmail = identifier.includes('@')
        ? identifier.toLowerCase()
        : `${identifier.toLowerCase()}@accounts.resa.invalid`;

      if (!identifier.includes('@') && !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(identifier.toLowerCase())) {
        setAuthState('signed-out');
        setErrorText('Enter a valid username (3–40 letters, numbers, dots, underscores or hyphens) or email address.');
        return false;
      }

      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (error) {
        setAuthState('signed-out');
        setErrorText(error.message);
        return false;
      }

      return true;
    } catch (error) {
      setAuthState('signed-out');
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Could not reach the sign-in service.',
      );
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    setErrorText(null);
    setStatusText(null);

    // Clear protected UI state immediately so a slow network request cannot
    // leave the previous account's dashboard visible after Sign out is tapped.
    setSession(null);
    setMemberships([]);
    setMembershipsLoading(false);
    setAccessCheckState('idle');
    setAuthState(hasSupabaseConfig ? 'signed-out' : 'needs-config');
    setLocation('/portal');

    if (!hasSupabaseConfig) return;

    try {
      const { error } = await getSupabaseClient().auth.signOut({
        scope: 'local',
      });

      if (error) {
        // Keep the local UI signed out even if the server request fails.
        setErrorText(
          `You have been signed out on this device, but Supabase reported: ${error.message}`,
        );
      }
    } catch (error) {
      // The local state is already cleared; surface the connection problem.
      setErrorText(
        error instanceof Error
          ? `You have been signed out on this device. ${error.message}`
          : 'You have been signed out on this device, but the sign-out service could not be reached.',
      );
    }
  }, [setLocation]);

  const runAccessCheck = useCallback(async () => {
    if (!session) {
      setAccessCheckState('error');
      setErrorText('Sign in again before checking account access.');
      return;
    }

    setAccessCheckState('loading');
    setErrorText(null);
    setStatusText(null);

    try {
      const client = getSupabaseClient();

      const { memberships: checkedMemberships, result } =
        await runMembershipAccessCheck(client, session.user.id);

      if (!result.passed) {
        setMemberships([]);
        setAccessCheckState('error');
        setErrorText(result.message);
        return;
      }

      const unknownSchoolDenied = await confirmUnknownSchoolIsDenied(client);

      if (!unknownSchoolDenied) {
        setAccessCheckState('error');
        setErrorText(
          'The role helper did not deny access to an unrecognized school. Review the database policies before adding school records.',
        );
        return;
      }

      setMemberships(checkedMemberships);
      setAccessCheckState('success');
      setStatusText(
        `${result.message} The role helper also denied access to an unrecognized school.`,
      );
    } catch (error) {
      setAccessCheckState('error');
      setErrorText(
        error instanceof Error
          ? error.message
          : 'The account access check could not be completed.',
      );
    }
  }, [session]);

  const openPrivateLogin = () => {
    setErrorText(null);
    setPrivateLoginOpen(true);
  };

  const submitPrivateLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!privateUsername.trim() || !privatePassword) {
      setErrorText('Enter your account email and password.');
      return;
    }

    setPrivateLoginBusy(true);
    setErrorText(null);

    const succeeded = await signIn(privateUsername.trim(), privatePassword);

    setPrivateLoginBusy(false);

    if (succeeded) {
      setPrivateLoginOpen(false);
      setPrivatePassword('');
      setLocation('/jetab-engine-room');
    }
  };

  /*
   * Preserve the existing private JETAB Engine Room.
   * Its database owner verification remains in place.
   */
  if (
    (currentPath === '/nexus' || currentPath === '/jetab-engine-room') &&
    authState === 'signed-in' &&
    session
  ) {
    return (
      <NexusDashboard
        email={session.user.email}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    parentMembership &&
    !teacherMembership &&
    !adminMembership &&
    !studentMembership &&
    !membershipsLoading &&
    (currentPath === '/school-cctv' || currentPath === '/notifications' || currentPath === '/school-communication' || currentPath === '/my-results' || currentPath === '/dashboard' || currentPath === '/portal' || currentPath === '/parent-dashboard')
  ) {
    if (currentPath === '/dashboard' || currentPath === '/portal' || currentPath === '/parent-dashboard') return <ParentDashboard schoolId={parentMembership.schoolId} schoolName={parentMembership.schoolName} userId={session?.user.id ?? ''} email={session?.user.email} onSignOut={() => void signOut()} />;
    if (currentPath === '/my-results') return <MyPublishedResultsPage schoolId={parentMembership.schoolId} userId={session?.user.id ?? ''} role="parent" />;
    if (currentPath === '/notifications') return <NotificationsPage schoolId={parentMembership.schoolId} role="parent" />;
    if (currentPath === '/school-communication') return <SchoolCommunicationPage schoolId={parentMembership.schoolId} role="parent" />;
    return <SchoolCctvPage schoolId={parentMembership.schoolId} role="parent" />;
  }

  /* Shared presentation shell for all administrator routes; role checks remain above this UI layer. */
  const withAdminShell = (content: ReactNode) => adminMembership ? (
    <AdminPortalShell schoolId={adminMembership.schoolId} schoolName={adminMembership.schoolName} email={session?.user.email} onSignOut={() => void signOut()}>{content}</AdminPortalShell>
  ) : content;

  /*
   * Administrator pages remain available only to active admins.
   */
  if (
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    adminMembership &&
    !teacherMembership &&
    !membershipsLoading
  ) {
    if (currentPath === '/notifications') return withAdminShell(<NotificationsPage schoolId={adminMembership.schoolId} role="admin" />);
    if (currentPath === '/teaching-materials' && session) return withAdminShell(<TeachingMaterialsPage schoolId={adminMembership.schoolId} userId={session.user.id} role="admin" />);
    if (currentPath === '/resa-chat' && session) return withAdminShell(<ResaChatPage schoolId={adminMembership.schoolId} userId={session.user.id} role="admin" />);
    if (currentPath === '/publication-centre' && session) return withAdminShell(<PublicationCentre schoolId={adminMembership.schoolId} userId={session.user.id} />);

    if (currentPath === '/school-cctv') {
      return withAdminShell(<SchoolCctvPage schoolId={adminMembership.schoolId} role="admin" />);
    }

    if (currentPath === '/hr-management') {
      return withAdminShell(<HrManagementPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/school-reports') {
      return withAdminShell(<SchoolReportsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/school-services') {
      return withAdminShell(<SchoolServicesPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/school-communication') {
      return withAdminShell(<SchoolCommunicationPage schoolId={adminMembership.schoolId} role="admin" />);
    }

    if (currentPath === '/staff-attendance') {
      return withAdminShell(<StaffAttendancePage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/teaching-assignments') {
      return withAdminShell(<TeachingAssignmentsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/staff-invitations') {
      return withAdminShell(
        <StaffInvitationsPage
          schoolId={adminMembership.schoolId}
          schoolName={adminMembership.schoolName}
          onSignOut={() => void signOut()}
        />
      );
    }

    if (currentPath === '/students') {
      return withAdminShell(<StudentsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/attendance') {
      return withAdminShell(<AttendancePage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/form-teacher-attendance' && session) {
      return withAdminShell(<FormTeacherAttendancePage schoolId={adminMembership.schoolId} userId={session.user.id} role="admin" />);
    }

    if (currentPath === '/announcements') {
      return withAdminShell(<AnnouncementsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/results') {
      return withAdminShell(<ResultsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/results-management') {
      return withAdminShell(<ResultsManagementPage schoolId={adminMembership.schoolId} userId={session?.user.id ?? ''} role="admin" />);
    }

    if (currentPath === '/examinations') {
      return withAdminShell(<ExamsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/school-settings') {
      return withAdminShell(<SchoolSettingsPage schoolId={adminMembership.schoolId} />);
    }

    if (currentPath === '/classes') {
      return withAdminShell(<ClassManagementPage schoolId={adminMembership.schoolId} />);
    }

    if (
      currentPath === '/subjects' ||
      currentPath === '/subject-management'
    ) {
      return withAdminShell(<SubjectManagementPage schoolId={adminMembership.schoolId} />);
    }

    if (
      currentPath === '/parents' ||
      currentPath === '/parent-management'
    ) {
      return withAdminShell(<ParentManagementPage schoolId={adminMembership.schoolId} />);
    }

    return withAdminShell(
      <AdminDashboard
        schoolId={adminMembership.schoolId}
        schoolName={adminMembership.schoolName}
        email={session?.user.email}
        onSignOut={() => void signOut()}
      />
    );
  }

  /*
   * Active teachers receive the teacher dashboard.
   */
  if (
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    !membershipsLoading &&
    teacherMembership &&
    session &&
    [
      '/teacher-dashboard',
          '/form-teacher-attendance',
      '/dashboard',
      '/portal',
      '/notifications',
      '/school-communication',
      '/results-management',
      '/teaching-materials',
      '/resa-chat',
    ].includes(currentPath)
  ) {
    if (currentPath === '/results-management') return <ResultsManagementPage schoolId={teacherMembership.schoolId} userId={session.user.id} role="teacher" />;
    if (currentPath === '/teaching-materials') return <TeachingMaterialsPage schoolId={teacherMembership.schoolId} userId={session.user.id} role="teacher" />;
    if (currentPath === '/resa-chat') return <ResaChatPage schoolId={teacherMembership.schoolId} userId={session.user.id} role="teacher" />;
    if (currentPath === '/school-communication') return <SchoolCommunicationPage schoolId={teacherMembership.schoolId} role="teacher" />;
    if (currentPath === '/form-teacher-attendance') return <FormTeacherAttendancePage schoolId={teacherMembership.schoolId} userId={session.user.id} role="teacher" />;
    if (currentPath === '/notifications') return <NotificationsPage schoolId={teacherMembership.schoolId} role="teacher" />;
    return (
      <TeacherDashboard
        schoolId={teacherMembership.schoolId}
        schoolName={teacherMembership.schoolName}
        userId={session.user.id}
        email={session.user.email ?? undefined}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (authState === 'signed-in' && accessCheckState === 'success' && !membershipsLoading && !adminMembership && !teacherMembership && studentMembership && currentPath === '/school-communication') {
    return <SchoolCommunicationPage schoolId={studentMembership.schoolId} role="student" />;
  }

  if (authState === 'signed-in' && accessCheckState === 'success' && !membershipsLoading && !adminMembership && !teacherMembership && studentMembership && currentPath === '/resa-chat') {
    return <ResaChatPage schoolId={studentMembership.schoolId} userId={session?.user.id ?? ''} role="student" />;
  }

  if (authState === 'signed-in' && accessCheckState === 'success' && !membershipsLoading && !adminMembership && !teacherMembership && studentMembership && currentPath === '/teaching-materials') {
    return <TeachingMaterialsPage schoolId={studentMembership.schoolId} userId={session?.user.id ?? ''} role="student" />;
  }

  if (authState === 'signed-in' && accessCheckState === 'success' && !membershipsLoading && !adminMembership && !teacherMembership && studentMembership && currentPath === '/notifications') {
    return <NotificationsPage schoolId={studentMembership.schoolId} role="student" />;
  }

  /*
   * Active students receive the student dashboard.
   * This requires successful membership access verification.
   */
  if (authState === 'signed-in' && accessCheckState === 'success' && !membershipsLoading && !adminMembership && !teacherMembership && studentMembership && session && currentPath === '/my-results') {
    return <MyPublishedResultsPage schoolId={studentMembership.schoolId} userId={session.user.id} role="student" />;
  }

  if (
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    !membershipsLoading &&
    !adminMembership &&
    !teacherMembership &&
    studentMembership &&
    session &&
    currentPath === '/student-assignments'
  ) {
    return (
      <main style={{ minHeight: '100vh', padding: 16, boxSizing: 'border-box', background: '#f4f7f1', color: '#17251b', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ maxWidth: 1050, margin: '0 auto' }}>
          <header style={{ background: '#123d2b', color: '#fff', borderRadius: 16, padding: '22px 20px', marginBottom: 18 }}>
            <div style={{ color: '#e6c66b', fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>RESA STUDENT LEARNING</div>
            <h1 style={{ fontSize: 27, lineHeight: 1.3, margin: '10px 0' }}>My Assignments</h1>
            <p style={{ margin: '0 0 14px', lineHeight: 1.6, color: '#e8eee8' }}>Published assignments for your enrolled class. This area is separate from CBT examinations.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Link href="/student-dashboard" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '10px 14px', background: '#fff', color: '#123d2b', fontWeight: 700, textDecoration: 'none' }}>Back to dashboard</Link>
              <Link href="/student-cbt" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '10px 14px', background: '#e6c66b', color: '#17251b', fontWeight: 700, textDecoration: 'none' }}>Open CBT separately</Link>
            </div>
          </header>
          <StudentAssignmentsPanel schoolId={studentMembership.schoolId} userId={session.user.id} />
        </div>
      </main>
    );
  }

  if (
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    !membershipsLoading &&
    !adminMembership &&
    !teacherMembership &&
    studentMembership &&
    currentPath === '/student-cbt'
  ) {
    return <StudentCbtPage schoolId={studentMembership.schoolId} />;
  }

  if (
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    !membershipsLoading &&
    !adminMembership &&
    !teacherMembership &&
    studentMembership &&
    session &&
    currentPath === '/student-dashboard'
  ) {
    return (
      <StudentDashboard
        schoolId={studentMembership.schoolId}
        schoolName={studentMembership.schoolName}
        userId={session.user.id}
        email={session.user.email}
        onSignOut={() => void signOut()}
      />
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <FoundationAppView
        authState={authState}
        signedInEmail={session?.user.email}
        memberships={memberships}
        errorText={errorText}
        statusText={statusText}
        membershipsLoading={membershipsLoading}
        accessCheckState={accessCheckState}
        onSignIn={(email, password) => void signIn(email, password)}
        onSignOut={() => void signOut()}
        onRunAccessCheck={() => void runAccessCheck()}
      />

      <button
        type="button"
        onClick={openPrivateLogin}
        aria-label="Open private system sign-in"
        title="Private system"
        style={{
          position: 'fixed',
          right: 13,
          bottom: 58,
          zIndex: 1000,
          width: 35,
          height: 35,
          padding: 0,
          borderRadius: '50%',
          border: '1px solid rgba(230,198,107,0.55)',
          background: '#123d2b',
          color: '#e6c66b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" />
        </svg>
      </button>

      {privateLoginOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPrivateLoginOpen(false);
              setErrorText(null);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(9, 22, 15, 0.72)',
            boxSizing: 'border-box',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="jetab-private-heading"
            style={{
              width: '100%',
              maxWidth: 410,
              boxSizing: 'border-box',
              padding: 24,
              borderRadius: 16,
              background: '#fff',
              color: '#17251b',
              fontFamily: 'Arial, sans-serif',
              boxShadow: '0 18px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.7,
                color: '#8a6a19',
                marginBottom: 12,
              }}
            >
              JETAB TECH • PRIVATE SYSTEM
            </div>

            <h2
              id="jetab-private-heading"
              style={{
                margin: '0 0 8px',
                fontSize: 23,
                lineHeight: 1.3,
                color: '#123d2b',
              }}
            >
              Open JETAB Engine Room
            </h2>

            <p
              style={{
                margin: '0 0 22px',
                color: '#58645b',
                fontSize: 14,
              }}
            >
              The private control centre.
            </p>

            <form onSubmit={(event) => void submitPrivateLogin(event)}>
              <label htmlFor="jetab-private-username" style={privateLabelStyle}>
                Account email
              </label>

              <input
                id="jetab-private-username"
                name="username"
                type="email"
                autoComplete="username"
                value={privateUsername}
                onChange={(event) => setPrivateUsername(event.target.value)}
                placeholder="Enter your registered account email"
                required
                style={privateInputStyle}
              />

              <label htmlFor="jetab-private-password" style={privateLabelStyle}>
                Password
              </label>

              <input
                id="jetab-private-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={privatePassword}
                onChange={(event) => setPrivatePassword(event.target.value)}
                placeholder="Enter your password"
                required
                style={privateInputStyle}
              />

              {errorText && (
                <p
                  role="alert"
                  style={{
                    margin: '12px 0',
                    color: '#9b2424',
                    fontSize: 13,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {errorText}
                </p>
              )}

              <button
                type="submit"
                disabled={privateLoginBusy}
                style={{
                  ...privateSubmitStyle,
                  opacity: privateLoginBusy ? 0.7 : 1,
                }}
              >
                {privateLoginBusy ? 'Verifying…' : 'Open JETAB Engine Room'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrivateLoginOpen(false);
                  setErrorText(null);
                  setPrivatePassword('');
                }}
                style={privateCancelStyle}
              >
                Cancel
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PUBLIC WEBSITE ROUTES
========================================================= */

function PublicHome() {
  return <Home />;
}

/* =========================================================
   ERROR BOUNDARY
========================================================= */

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

/* =========================================================
   APPLICATION ROUTES
========================================================= */

function AppRoutes() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        {/* Public school website */}
        <Route path="/" component={PublicHome} />
        <Route path="/about" component={AboutPage} />
        <Route path="/academics" component={AcademicsPage} />
        <Route
          path="/innovation-technology"
          component={InnovationTechnologyPage}
        />
        <Route path="/practical-skills" component={PracticalSkillsPage} />
        <Route path="/wisdom-inspiration" component={WisdomInspirationPage} />
        <Route path="/activities-gallery" component={ActivitiesGalleryPage} />
        <Route path="/admissions" component={AdmissionsPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/portal-options" component={PortalOptionsPage} />
        <Route path="/practice-drills" component={StudentPracticeDrillsPage} />
        <Route path="/teaching-materials" component={FoundationPage} />
        <Route path="/resa-chat" component={FoundationPage} />

        {/* Staff invitation acceptance and password recovery */}
        <Route
          path="/accept-invitation"
          component={AcceptInvitationPage}
        />
        <Route path="/reset-password" component={ResetPasswordPage} />

        {/* School portal */}
        <Route path="/test-data-setup" component={TestDataSetupPage} />
        <Route path="/portal" component={FoundationPage} />
        <Route path="/dashboard" component={FoundationPage} />
        <Route path="/teacher-dashboard" component={FoundationPage} />
        <Route path="/student-dashboard" component={FoundationPage} />
        <Route path="/parent-dashboard" component={FoundationPage} />
        <Route path="/my-results" component={FoundationPage} />
        <Route path="/student-cbt" component={FoundationPage} />
        <Route path="/student-assignments" component={FoundationPage} />
        <Route path="/students" component={FoundationPage} />
        <Route path="/attendance" component={FoundationPage} />
        <Route path="/form-teacher-attendance" component={FoundationPage} />
        <Route path="/announcements" component={FoundationPage} />
        <Route path="/results" component={FoundationPage} />
        <Route path="/results-management" component={FoundationPage} />
        <Route path="/examinations" component={FoundationPage} />
        <Route path="/school-settings" component={FoundationPage} />
        <Route path="/classes" component={FoundationPage} />
        <Route path="/subjects" component={FoundationPage} />
        <Route path="/subject-management" component={FoundationPage} />
        <Route path="/parents" component={FoundationPage} />
        <Route path="/parent-management" component={FoundationPage} />
        <Route path="/staff-invitations" component={FoundationPage} />
        <Route path="/teaching-assignments" component={FoundationPage} />
        <Route path="/hr-management" component={FoundationPage} />
        <Route path="/school-reports" component={FoundationPage} />
        <Route path="/school-services" component={FoundationPage} />
        <Route path="/publication-centre" component={FoundationPage} />
        <Route path="/notifications" component={FoundationPage} />
        <Route path="/school-communication" component={FoundationPage} />
        <Route path="/staff-attendance" component={FoundationPage} />
        <Route path="/school-cctv" component={FoundationPage} />

        {/* Private control centre */}
        <Route path="/jetab-engine-room" component={FoundationPage} />
        <Route path="/nexus" component={FoundationPage} />

        {/* Not found */}
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <AppRoutes />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
