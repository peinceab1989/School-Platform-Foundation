
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { Bell } from 'lucide-react';
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
import FeesManagementPage from '@/pages/fees-management';
import SchoolCommunicationPage from '@/pages/school-communication';
import StaffAttendancePage from '@/pages/staff-attendance';
import StudentsPage from '@/pages/students';
import StudentIdCardsPage from '@/pages/student-id-cards';
import AttendancePage from '@/pages/attendance';
import BiometricAttendancePage from '@/pages/biometric-attendance';
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
import PortalNavigationGuidePage from '@/pages/portal-navigation-guide';
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

type NexusReadinessMetrics = {
  activeParentAccounts: number | null;
  portalEnabledGuardians: number | null;
  assignedFormTeachers: number | null;
  trackedTestRecords: number | null;
  publishedTermResults: number | null;
  subjectResultRows: number | null;
  schoolMessages: number | null;
  targetedNotifications: number | null;
};

function normalizePath(path: string): string {
  const pathname = path.split('?')[0].split('#')[0];
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

const ADMIN_SCHOOL_PATHS = [
  '/students',
  '/student-id-cards',
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
  '/fees-management',
  '/publication-centre',
  '/staff-attendance',
  '/biometric-attendance',
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
  '/student-id-card',
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

function playParentAttendanceSound(choice: "chime"|"bell"|"soft"|"none") {
  if(choice==="none"||typeof window==="undefined") return;
  try {
    const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;
    if(!AudioContextClass) return;
    const audio=new AudioContextClass();
    const frequencies=choice==="bell"?[1046,784]:choice==="soft"?[523]:[784,988];
    frequencies.forEach((frequency,index)=>{
      const oscillator=audio.createOscillator(); const gain=audio.createGain();
      oscillator.type="sine"; oscillator.frequency.value=frequency;
      const start=audio.currentTime+index*0.13;
      gain.gain.setValueAtTime(0.0001,start); gain.gain.exponentialRampToValueAtTime(0.12,start+0.02); gain.gain.exponentialRampToValueAtTime(0.0001,start+0.18);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start+0.2);
    });
    setTimeout(()=>void audio.close(),600);
  } catch { /* Browser audio can be blocked by device settings. */ }
}

function ParentDashboard({ schoolId, schoolName, userId, email, onSignOut }: { schoolId: string; schoolName: string; userId: string; email?: string; onSignOut: () => void }) {
  const [parentDisplayName, setParentDisplayName] = useState("");
  const [feeRows, setFeeRows] = useState<Array<Record<string, any>>>([]);
  const [feeTypeNames, setFeeTypeNames] = useState<Record<string, string>>({});
  const [paymentRows, setPaymentRows] = useState<Array<Record<string, any>>>([]);
  const [receiptRows, setReceiptRows] = useState<Array<Record<string, any>>>([]);
  const [children, setChildren] = useState<Array<{ id: string; name: string }>>([]);
  const [attendanceRows, setAttendanceRows] = useState<Array<Record<string, any>>>([]);
  const [attendanceAlerts, setAttendanceAlerts] = useState<Array<Record<string, any>>>([]);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(false);
  const [soundChoice, setSoundChoice] = useState<"chime" | "bell" | "soft" | "none">("chime");
  const [phoneNotificationsEnabled, setPhoneNotificationsEnabled] = useState(false);
  const phoneNotificationsRef = useRef(false);
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = useState(true);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread">("all");
  const soundAlertsRef = useRef(false);
  const soundChoiceRef = useRef<"chime" | "bell" | "soft" | "none">("chime");
  useEffect(() => { soundAlertsRef.current = soundAlertsEnabled; }, [soundAlertsEnabled]);
  useEffect(() => { soundChoiceRef.current = soundChoice; }, [soundChoice]);
  useEffect(() => { phoneNotificationsRef.current = phoneNotificationsEnabled; }, [phoneNotificationsEnabled]);
  const [announcements, setAnnouncements] = useState<Array<Record<string, any>>>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  useEffect(() => {
    let active = true;
    let attendanceChannel: any = null;
    async function loadParentOverview() {
      setOverviewLoading(true);
      setOverviewError("");
      try {
        const db = getSupabaseClient() as any;
        const { data: parentPerson, error: parentPersonError } = await db.from("people").select("first_name,middle_name,last_name").eq("school_id", schoolId).eq("user_id", userId).limit(1).maybeSingle();
        if (parentPersonError) throw parentPersonError;
        const parentName = [parentPerson?.first_name,parentPerson?.middle_name,parentPerson?.last_name].filter(Boolean).join(" ").trim();
        if (active) setParentDisplayName(parentName);
        const { data: accounts, error: accountError } = await db
          .from("parent_portal_accounts")
          .select("parent_guardian_id")
          .eq("school_id", schoolId)
          .eq("user_id", userId)
          .eq("is_active", true);
        if (accountError) throw accountError;
        const parentIds = [...new Set<string>((accounts ?? []).map((row: any) => String(row.parent_guardian_id)))];
        if (!parentIds.length) throw new Error("No active parent portal account is linked to this sign-in.");
        const { data: savedPreferences, error: preferencesError } = await db
          .from("parent_attendance_notification_preferences")
          .select("enabled,sound_choice,phone_notifications_enabled")
          .eq("school_id", schoolId).eq("user_id", userId)
          .in("parent_guardian_id", parentIds);
        if (preferencesError) throw preferencesError;
        const preference = savedPreferences?.[0];
        if (active) {
          setSoundAlertsEnabled(Boolean(preference?.enabled));
          setSoundChoice((preference?.sound_choice || "chime") as "chime" | "bell" | "soft" | "none");
          setPhoneNotificationsEnabled(Boolean(preference?.phone_notifications_enabled));
          setNotificationPreferencesLoading(false);
        }
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
        }

        const { data: initialAttendanceAlerts, error: attendanceAlertsError } = await db
          .from("biometric_parent_notifications")
          .select("id,student_id,message,status,created_at,read_at")
          .eq("school_id", schoolId)
          .in("parent_guardian_id", parentIds)
          .order("created_at", { ascending: false })
          .limit(100);
        if (attendanceAlertsError) throw attendanceAlertsError;
        if (active) setAttendanceAlerts(initialAttendanceAlerts ?? []);

        attendanceChannel = db.channel(`parent-attendance-alerts-${schoolId}-${userId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "biometric_parent_notifications", filter: `school_id=eq.${schoolId}` }, (payload: any) => {
            const incoming = payload.new as Record<string, any>;
            if (!parentIds.includes(String(incoming.parent_guardian_id))) return;
            setAttendanceAlerts(previous => [incoming, ...previous.filter(row => String(row.id) !== String(incoming.id))].slice(0, 100));
            if (soundAlertsRef.current && soundChoiceRef.current !== "none" && typeof window !== "undefined") {
              playParentAttendanceSound(soundChoiceRef.current);
            }
            if (phoneNotificationsRef.current && "Notification" in window && Notification.permission === "granted") {
              const title = "RESA · Attendance update";
              const body = String(incoming.message || "A linked learner's attendance was updated.");
              void navigator.serviceWorker?.ready.then(registration => registration.showNotification(title, {
                body, icon: "/favicon.ico", badge: "/favicon.ico",
                tag: String(incoming.id), data: { url: "/parent-dashboard" },
              })).catch(() => { new Notification(title, { body }); });
            }
          })
          .subscribe();

        const { data: links, error: linksError } = await db
          .from("parent_student_portal_access")
          .select("student_id")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .in("parent_guardian_id", parentIds);
        if (linksError) throw linksError;
        const studentIds = [...new Set<string>((links ?? []).map((row: any) => String(row.student_id)))];

        let childRows: Array<{ id: string; name: string }> = [];
        if (studentIds.length) {
          const { data: students, error: studentsError } = await db
            .from("students")
            .select("id,person_id,admission_number")
            .eq("school_id", schoolId)
            .in("id", studentIds);
          if (studentsError) throw studentsError;
          const personIds = [...new Set<string>((students ?? []).map((row: any) => row.person_id).filter(Boolean))];
          const peopleResult = personIds.length
            ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds)
            : { data: [], error: null };
          if (peopleResult.error) throw peopleResult.error;
          const people = new Map<string, string>((peopleResult.data ?? []).map((row: any) => [
            String(row.id), [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
          ]));
          childRows = (students ?? []).map((row: any) => ({
            id: String(row.id),
            name: people.get(String(row.person_id)) || String(row.admission_number || "Linked learner"),
          }));

          const [feesResult, paymentsResult, receiptsResult, attendanceResult] = await Promise.all([
            db.from("student_fee_assignments").select("id,student_id,fee_type_id,academic_session_id,amount_due,due_date,status,created_at")
              .eq("school_id", schoolId).in("student_id", studentIds).order("due_date", { ascending: true }),
            db.from("student_fee_payments").select("id,student_fee_assignment_id,student_id,amount_paid,payment_date,payment_method,reference_number,receipt_number")
              .eq("school_id", schoolId).in("student_id", studentIds).order("payment_date", { ascending: false }),
            db.from("student_payment_receipts").select("id,issued_to_student_id,receipt_number,receipt_date,amount,payment_method,description")
              .eq("school_id", schoolId).in("issued_to_student_id", studentIds).order("receipt_date", { ascending: false }),
            db.from("student_attendance").select("id,student_id,attendance_date,status")
              .eq("school_id", schoolId).in("student_id", studentIds)
              .gte("attendance_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
              .order("attendance_date", { ascending: false }).limit(200),
          ]);
          for (const result of [feesResult, paymentsResult, receiptsResult, attendanceResult]) {
            if (result.error) throw result.error;
          }
          const feeTypeIds = [...new Set((feesResult.data ?? []).map((row: any) => String(row.fee_type_id)).filter(Boolean))];
          const feeTypesResult = feeTypeIds.length
            ? await db.from("fee_types").select("id,name").eq("school_id", schoolId).in("id", feeTypeIds)
            : { data: [], error: null };
          if (feeTypesResult.error) throw feeTypesResult.error;
          const nextFeeTypeNames = Object.fromEntries((feeTypesResult.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
          if (active) {
            setFeeRows((feesResult.data ?? []) as Array<Record<string, any>>);
            setFeeTypeNames(nextFeeTypeNames);
            setPaymentRows((paymentsResult.data ?? []) as Array<Record<string, any>>);
            setReceiptRows((receiptsResult.data ?? []) as Array<Record<string, any>>);
            setAttendanceRows((attendanceResult.data ?? []) as Array<Record<string, any>>);
          }
        } else if (active) {
          setFeeRows([]); setFeeTypeNames({}); setPaymentRows([]); setReceiptRows([]); setAttendanceRows([]);
        }

        const { data: noticeRows, error: noticeError } = await db
          .from("announcements")
          .select("id,title,content,announcement_type,published_at,expires_at")
          .eq("school_id", schoolId)
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(10);
        if (noticeError) throw noticeError;
        const now = Date.now();
        const currentNotices = (noticeRows ?? []).filter((row: any) => !row.expires_at || new Date(row.expires_at).getTime() >= now);
        if (active) {
          setChildren(childRows);
          setAnnouncements(currentNotices);
        }
      } catch (error) {
        if (active) setOverviewError(error instanceof Error ? error.message : "Parent information could not be loaded.");
      } finally {
        if (active) {
          setNotificationPreferencesLoading(false);
          setOverviewLoading(false);
        }
      }
    }
    void loadParentOverview();
    return () => { active = false; if (attendanceChannel) void getSupabaseClient().removeChannel(attendanceChannel); };
  }, [schoolId, userId]);


  async function saveParentNotificationPreferences(enabled: boolean, sound: "chime"|"bell"|"soft"|"none", phoneEnabled: boolean) {
    setNotificationBusy(true);
    try {
      const db=getSupabaseClient() as any;
      const {data:accounts,error}=await db.from("parent_portal_accounts").select("parent_guardian_id").eq("school_id",schoolId).eq("user_id",userId).eq("is_active",true);
      if(error) throw error;
      const ids=[...new Set<string>((accounts??[]).map((x:any)=>String(x.parent_guardian_id)))];
      if(!ids.length) throw new Error("No active parent account is linked.");
      const rows=ids.map(parent_guardian_id=>({school_id:schoolId,parent_guardian_id,user_id:userId,enabled,sound_choice:sound,phone_notifications_enabled:phoneEnabled,updated_at:new Date().toISOString()}));
      const {error:saveError}=await db.from("parent_attendance_notification_preferences").upsert(rows,{onConflict:"school_id,parent_guardian_id,user_id"});
      if(saveError) throw saveError;
      setSoundAlertsEnabled(enabled); setSoundChoice(sound); setPhoneNotificationsEnabled(phoneEnabled);
      if(enabled&&sound!=="none") playParentAttendanceSound(sound);
    } catch(error) { setOverviewError(error instanceof Error?error.message:"Notification preferences could not be saved."); }
    finally { setNotificationBusy(false); }
  }

  async function enableParentPhoneNotifications() {
    if(!("Notification" in window)) { setOverviewError("This browser does not support phone notifications. Try installing/opening RESA in Chrome on Android."); return; }
    setNotificationBusy(true);
    try {
      const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
      if(permission!=="granted") throw new Error("Phone notification permission was not granted. Enable notifications for Chrome/RESA in Android settings.");
      if("serviceWorker" in navigator) {
        const registration=await navigator.serviceWorker.register("/sw.js");
        await registration.showNotification("RESA notifications enabled",{body:"Attendance updates for your linked learners will appear here.",icon:"/favicon.ico",tag:"resa-notification-test"});
      } else {
        new Notification("RESA notifications enabled",{body:"Attendance updates will appear while the portal is open."});
      }
      await saveParentNotificationPreferences(soundAlertsEnabled,soundChoice,true);
    } catch(error) { setOverviewError(error instanceof Error?error.message:"Phone notifications could not be enabled."); }
    finally { setNotificationBusy(false); }
  }

  async function markParentAlertsRead(ids: string[]) {
    if(!ids.length) return;
    const db=getSupabaseClient() as any;
    const {error}=await db.from("biometric_parent_notifications").update({read_at:new Date().toISOString()}).in("id",ids);
    if(error) { setOverviewError(error.message); return; }
    setAttendanceAlerts(previous=>previous.map((row:any)=>ids.includes(String(row.id))?{...row,read_at:new Date().toISOString()}:row));
  }

  const childName = (id: string) => children.find((child) => child.id === id)?.name || "Linked learner";
  const paidByAssignment = paymentRows.reduce<Record<string, number>>((totals, row) => {
    const key = String(row.student_fee_assignment_id);
    totals[key] = (totals[key] || 0) + Number(row.amount_paid || 0);
    return totals;
  }, {});
  const totalDue = feeRows.reduce((sum, row) => sum + Number(row.amount_due || 0), 0);
  const totalPaid = paymentRows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
  const totalBalance = feeRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount_due || 0) - (paidByAssignment[String(row.id)] || 0)), 0);
  const money = (value: number) => "₦" + value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Short, presentation-only identifier. The real Supabase user ID and login remain unchanged.
  const parentDisplayId = "RESA-PARENT-" + userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

  return <main className="min-h-screen bg-[#f4f7f4] px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="overflow-hidden rounded-3xl bg-emerald-950 p-5 text-white shadow-sm sm:p-8">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(230px,280px)] sm:items-start">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA · Parent & Guardian Portal</p>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Parent Dashboard</h1>
            <p className="mt-1 text-sm font-semibold text-amber-200">{parentDisplayName ? "Welcome, " + parentDisplayName : "Welcome to your parent portal"}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Your family's school connection. Follow your linked learners’ fees, attendance, results and school updates from one place.</p>
            <p className="mt-3 max-w-full break-words text-xs text-emerald-100">{schoolName}</p>
            <Link href="/portal-navigation-guide" className="mt-4 mr-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/40 px-4 py-2 text-sm font-bold text-white">Portal Navigation Guide</Link>
            <button type="button" onClick={onSignOut} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-200 px-4 py-2 text-sm font-extrabold text-emerald-950 shadow-sm hover:bg-amber-100">↪ Sign out</button>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-3">
            <ProfilePhotoCard userId={userId} displayName={parentDisplayName || "Parent profile"} roleLabel="Parent / Guardian" compact />
            <div className="mt-3 min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Parent account ID</p>
              <p className="mt-1 break-all font-mono text-xs font-bold tracking-wide text-white" title={userId}>{parentDisplayId}</p>
            </div>
          </div>
        </div>
        <nav aria-label="Parent quick links" className="mt-6 flex flex-wrap gap-2">
          <Link href="/my-results" className="rounded-xl bg-amber-200 px-4 py-2.5 text-sm font-bold text-emerald-950 hover:bg-amber-100">My learners’ results</Link>
          <Link href="/school-communication" className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">School messages</Link>
          <Link href="/notifications" className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">Notifications</Link>
          <Link href="/reset-password" className="rounded-xl border border-amber-200 bg-amber-200 px-4 py-2.5 text-sm font-bold text-emerald-950 hover:bg-amber-100">Password & Security</Link>
          <a href="https://wa.me/2348058422691?text=Hello%20RESA%20Customer%20Care.%20I%20need%20assistance%20with%20the%20parent%20portal." target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">Customer Care</a>
        </nav>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total fees assigned</p><p className="mt-2 text-xl font-extrabold text-emerald-950">{overviewLoading ? "Loading…" : money(totalDue)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments recorded</p><p className="mt-2 text-xl font-extrabold text-slate-900">{overviewLoading ? "Loading…" : money(totalPaid)}</p></article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Outstanding balance</p><p className="mt-2 text-xl font-extrabold text-amber-950">{overviewLoading ? "Loading…" : money(totalBalance)}</p></article>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Linked learners</p><p className="mt-2 text-2xl font-extrabold text-emerald-950">{overviewLoading ? "…" : children.length}</p><p className="mt-1 text-sm text-slate-600">Learners connected to this parent account</p></div>
      </section>

      {overviewError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{overviewError}</p>}

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-extrabold text-emerald-950">RESA Family Notifications</h2><p className="mt-1 text-sm text-slate-600">A message inbox for every attendance update about your linked learners.</p></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900">{attendanceAlerts.filter((a:any)=>!a.read_at).length} unread</span>
        </div>
        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block text-xs font-bold text-slate-700">Attendance notifications
            <select disabled={notificationPreferencesLoading||notificationBusy} value={soundAlertsEnabled?"on":"off"} onChange={e=>void saveParentNotificationPreferences(e.target.value==="on",soundChoice,phoneNotificationsEnabled)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
              <option value="on">Enabled — keep on until I disable it</option><option value="off">Disabled</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">In-app alert sound
            <select disabled={notificationPreferencesLoading||notificationBusy} value={soundChoice} onChange={e=>void saveParentNotificationPreferences(soundAlertsEnabled,e.target.value as any,phoneNotificationsEnabled)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
              <option value="chime">RESA Chime</option><option value="bell">Bell</option><option value="soft">Soft tone</option><option value="none">Silent</option>
            </select>
          </label>
          <button type="button" disabled={notificationBusy||notificationPreferencesLoading} onClick={()=>void enableParentPhoneNotifications()} className="rounded-xl bg-emerald-900 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">{phoneNotificationsEnabled?"Phone alerts allowed":"Allow phone notification banners"}</button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Your choices are saved to your parent account and remain in effect after signing out. Phone notification permission is controlled by Android/browser settings. Alerts while the portal is open can appear in the phone notification shade; delivery when the portal is fully closed still needs a secure Web Push sender and VAPID keys.</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex gap-2">
            <button type="button" onClick={()=>setNotificationFilter("all")} className={`rounded-full px-3 py-2 text-xs font-bold ${notificationFilter==="all"?"bg-emerald-900 text-white":"bg-slate-100 text-slate-700"}`}>All messages</button>
            <button type="button" onClick={()=>setNotificationFilter("unread")} className={`rounded-full px-3 py-2 text-xs font-bold ${notificationFilter==="unread"?"bg-emerald-900 text-white":"bg-slate-100 text-slate-700"}`}>Unread</button>
          </div>
          <button type="button" onClick={()=>void markParentAlertsRead(attendanceAlerts.filter((a:any)=>!a.read_at).map((a:any)=>String(a.id)))} className="text-xs font-bold text-emerald-800 underline">Mark all as read</button>
        </div>
        {attendanceAlerts.filter((a:any)=>notificationFilter==="all"||!a.read_at).length===0
          ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No {notificationFilter==="unread"?"unread ":""}attendance messages yet. New arrival and departure alerts will appear here and remain available until cleared by the school retention policy.</p>
          : <div className="mt-3 divide-y">{attendanceAlerts.filter((a:any)=>notificationFilter==="all"||!a.read_at).map((alert:any)=><article key={String(alert.id)} className={`flex items-start gap-3 rounded-xl p-3 ${alert.read_at?"bg-white":"bg-emerald-50"}`}>
            <span className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-900"><Bell size={16}/></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{String(alert.message||"Attendance update")}</p><p className="mt-1 text-xs text-slate-500">{new Date(String(alert.created_at)).toLocaleString("en-NG",{timeZone:"Africa/Lagos"})}</p></div>
            {!alert.read_at&&<button type="button" onClick={()=>void markParentAlertsRead([String(alert.id)])} className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-900">Read</button>}
          </article>)}</div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-extrabold text-emerald-950">School fees & payments</h2><p className="mt-1 text-sm text-slate-600">Charges, due dates and balances for your linked learners.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Parent view</span></div>
          {overviewLoading ? <p className="mt-4 text-sm text-slate-500">Loading fee information…</p> : feeRows.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-4 text-sm leading-6 text-slate-600">No fee charges have been published to your parent account yet. For payment instructions, contact the school through <Link href="/school-communication" className="font-bold text-emerald-800 underline">School Messages</Link>.</p> : <div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3">Learner</th><th className="px-3 py-3">Amount due</th><th className="px-3 py-3">Paid</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Due date</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{feeRows.map((row) => { const paid = paidByAssignment[String(row.id)] || 0; const due = Number(row.amount_due || 0); const balance = Math.max(0, due - paid); return <tr key={String(row.id)} className="border-t"><td className="px-3 py-3"><p className="font-semibold">{childName(String(row.student_id))}</p><p className="mt-1 text-xs text-slate-500">{feeTypeNames[String(row.fee_type_id)] || "School fee"}</p></td><td className="px-3 py-3">{money(due)}</td><td className="px-3 py-3">{money(paid)}</td><td className="px-3 py-3 font-bold">{money(balance)}</td><td className="px-3 py-3">{row.due_date ? new Date(String(row.due_date) + "T00:00:00").toLocaleDateString("en-NG") : "—"}</td><td className="px-3 py-3">{balance <= 0 ? "Paid" : paid > 0 ? "Part-paid" : String(row.status || "Outstanding")}</td></tr>; })}</tbody></table></div>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Online card/bank checkout is not enabled. Confirm payment instructions directly with RESA Finance before making any payment.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-emerald-950">Payment history & receipts</h2>
          {overviewLoading ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : receiptRows.length === 0 && paymentRows.length === 0 ? <p className="mt-3 text-sm leading-6 text-slate-600">No payment or receipt has been recorded for your linked learners yet.</p> : <div className="mt-3 space-y-3">{receiptRows.map((row) => <div key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"><div><p className="font-bold">{String(row.receipt_number || "Payment receipt")}</p><p className="text-xs text-slate-500">{childName(String(row.issued_to_student_id))} · {row.receipt_date || ""} · {String(row.payment_method || "Payment")}</p></div><span className="font-bold">{money(Number(row.amount || 0))}</span></div>)}</div>}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-emerald-950">My linked learners · Attendance</h2>
          {overviewLoading ? <p className="mt-3 text-sm text-slate-500">Loading attendance…</p> : children.length === 0 ? <p className="mt-3 text-sm text-slate-600">No learners are currently linked to this account. Contact the school office if this is unexpected.</p> : <div className="mt-3 space-y-2">{children.map((child) => { const rows = attendanceRows.filter((row) => String(row.student_id) === child.id); const present = rows.filter((row) => String(row.status).toLowerCase() === "present").length; return <div key={child.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold text-emerald-950">{child.name}</p><p className="mt-1 text-slate-600">{present} present · {rows.length - present} other entries · {rows.length} recorded in the last 30 days</p></div>; })}</div>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-emerald-950">School announcements</h2>
          {overviewLoading ? <p className="mt-3 text-sm text-slate-500">Loading notices…</p> : announcements.length === 0 ? <p className="mt-3 text-sm text-slate-600">There are no current published announcements.</p> : <div className="mt-3 space-y-3">{announcements.map((notice) => <article key={String(notice.id)} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">{String(notice.announcement_type || "General")} {notice.published_at ? "· " + new Date(String(notice.published_at)).toLocaleDateString("en-NG") : ""}</p><h3 className="mt-1 font-bold text-emerald-950">{String(notice.title)}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(notice.content)}</p></article>)}</div>}
        </article>
      </section>

      <section>
        <div className="mb-3"><h2 className="text-lg font-extrabold text-emerald-950">Parent services</h2><p className="mt-1 text-sm text-slate-600">Quick access to your family’s school services.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/my-results" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700"><span className="text-xs font-bold uppercase tracking-wide text-amber-700">Academics</span><h3 className="mt-2 font-extrabold text-emerald-950">Published results</h3><p className="mt-2 text-sm leading-6 text-slate-600">View and print report cards for your linked learners.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">View results →</span></Link>
          <Link href="/school-communication" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700"><span className="text-xs font-bold uppercase tracking-wide text-amber-700">Communication</span><h3 className="mt-2 font-extrabold text-emerald-950">School messages</h3><p className="mt-2 text-sm leading-6 text-slate-600">Contact authorised school staff about fees and learner progress.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">Open messages →</span></Link>
          <Link href="/notifications" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700"><span className="text-xs font-bold uppercase tracking-wide text-amber-700">Updates</span><h3 className="mt-2 font-extrabold text-emerald-950">Notifications</h3><p className="mt-2 text-sm leading-6 text-slate-600">See important notices and account updates.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">View notifications →</span></Link>
          <Link href="/school-cctv" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700"><span className="text-xs font-bold uppercase tracking-wide text-amber-700">If authorised</span><h3 className="mt-2 font-extrabold text-emerald-950">School monitoring</h3><p className="mt-2 text-sm leading-6 text-slate-600">Open monitoring services only when enabled for your account.</p><span className="mt-4 inline-block text-sm font-bold text-emerald-800">Open service →</span></Link>
        </div>
      </section>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">Designed &amp; Powered by <strong>JETAB TECH</strong></footer>
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
  const [studentDisplayName, setStudentDisplayName] = useState("");
  const [academicSummary, setAcademicSummary] = useState<StudentAcademicSummary | null>(null);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [academicError, setAcademicError] = useState<string | null>(null);
  const [publishedCbtCount, setPublishedCbtCount] = useState<number | null>(null);
  const [cbtNoticeError, setCbtNoticeError] = useState<string | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, any> | null>(null);
  const [studentAttendanceLoading, setStudentAttendanceLoading] = useState(true);
  const [studentAttendanceError, setStudentAttendanceError] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    let active = true;
    let channel: any = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let currentStudentId = "";
    const lagosDate = () => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    };
    async function loadStudentAttendance() {
      try {
        const db = getSupabaseClient() as any;
        if (!currentStudentId) {
          const { data: student, error: studentError } = await db.from("students").select("id").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
          if (studentError) throw studentError;
          if (!student) throw new Error("This sign-in is not yet linked to a student record.");
          currentStudentId = String(student.id);
        }
        const { data, error } = await db.from("student_attendance")
          .select("id,attendance_date,status,check_in_at,check_out_at,remarks")
          .eq("school_id", schoolId).eq("student_id", currentStudentId).eq("attendance_date", lagosDate())
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (active) { setStudentAttendance(data ?? null); setStudentAttendanceError(null); }
      } catch (error) {
        if (active) setStudentAttendanceError(error instanceof Error ? error.message : "Attendance could not be loaded.");
      } finally { if (active) setStudentAttendanceLoading(false); }
    }
    async function initialise() {
      await loadStudentAttendance();
      if (!active || !currentStudentId) return;
      const db = getSupabaseClient() as any;
      channel = db.channel(`student-own-attendance-${schoolId}-${currentStudentId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "student_attendance", filter: `student_id=eq.${currentStudentId}` }, () => { void loadStudentAttendance(); })
        .subscribe();
      refreshTimer = setInterval(() => { void loadStudentAttendance(); }, 30000);
    }
    void initialise();
    return () => { active = false; if (refreshTimer) clearInterval(refreshTimer); if (channel) void getSupabaseClient().removeChannel(channel); };
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
          .select('id, person_id')
          .eq('school_id', schoolId)
          .eq('user_id', userId)
          .maybeSingle();

        if (studentError) throw studentError;
        if (!student) {
          if (active) setAcademicSummary(null);
          return;
        }

        if (student.person_id) {
          const { data: person, error: personError } = await (client as any).from('people')
            .select('first_name, middle_name, last_name').eq('school_id', schoolId).eq('id', student.person_id).maybeSingle();
          if (personError) throw personError;
          const fullName = [person?.first_name, person?.middle_name, person?.last_name].filter(Boolean).join(' ').trim();
          if (active) setStudentDisplayName(fullName);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#e6c66b', fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>
                RESA SCHOOL PORTAL
              </div>
              <h1 style={{ fontSize: 27, lineHeight: 1.3, margin: '12px 0' }}>Student Dashboard</h1>
              <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{studentDisplayName ? `Welcome, ${studentDisplayName}.` : 'Welcome to your learning portal.'}</p>
              <p style={{ margin: '0 0 18px', color: '#e8eee8', overflowWrap: 'anywhere' }}>{schoolName}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/notifications" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#fff', color: '#123d2b', fontWeight: 700, textDecoration: 'none' }}>Notifications <UnreadMessageBadge schoolId={schoolId} /></Link>
            <Link href="/portal-navigation-guide" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#fff', color: '#123d2b', fontWeight: 700, textDecoration: 'none' }}>Portal Guide</Link>
            <Link href="/my-results" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#e6c66b', color: '#17251b', fontWeight: 700, textDecoration: 'none' }}>My Report Cards</Link>
            <Link href="/student-id-card" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#fff', color: '#123d2b', fontWeight: 700, textDecoration: 'none' }}>My ID Card</Link>
            <Link href="/reset-password" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#d9efe2', color: '#123d2b', fontWeight: 700, textDecoration: 'none' }}>Password & Security</Link>
            <Link href="/school-communication" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#e6c66b', color: '#17251b', fontWeight: 700, textDecoration: 'none' }}>School messages</Link>
              <button type="button" onClick={onSignOut} style={buttonStyle}>Sign out</button>
              </div>
            </div>
            <div style={{ minWidth: 0, borderRadius: 14, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.10)', padding: 12 }}>
              <ProfilePhotoCard userId={userId} displayName={studentDisplayName || "Student profile"} roleLabel="Student" compact />
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
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

          <section style={{ ...panelStyle, borderColor: studentAttendance?.status ? '#b7d9c1' : '#e0e7e0', background: studentAttendance?.status ? '#f7fcf8' : '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 25, marginBottom: 8 }}>📅</div><h3 style={{ margin: '0 0 6px', fontSize: 19 }}>My Attendance Today</h3><p style={{ color: '#536456', lineHeight: 1.6, margin: 0 }}>Your attendance updates automatically when the school records your arrival or departure.</p></div>
              <span style={{ borderRadius: 999, padding: '7px 12px', background: studentAttendance?.status ? '#dff3e5' : '#edf1ed', color: '#174b35', fontSize: 12, fontWeight: 800 }}>{studentAttendanceLoading ? 'Checking…' : studentAttendance?.status ? String(studentAttendance.status).replace(/_/g, ' ').toUpperCase() : 'NOT YET RECORDED'}</span>
            </div>
            {studentAttendanceError ? <p role="alert" style={{ color: '#9b2c2c', margin: '12px 0 0', fontSize: 13 }}>{studentAttendanceError}</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10, marginTop: 16 }}>
              <div style={{ borderRadius: 10, background: '#eef6f0', padding: 12 }}><span style={{ display: 'block', color: '#536456', fontSize: 12 }}>Date</span><strong>{studentAttendance?.attendance_date ? new Date(studentAttendance.attendance_date + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
              <div style={{ borderRadius: 10, background: '#eef6f0', padding: 12 }}><span style={{ display: 'block', color: '#536456', fontSize: 12 }}>Arrival / Clock-in</span><strong>{studentAttendance?.check_in_at ? new Date(studentAttendance.check_in_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'}</strong></div>
              <div style={{ borderRadius: 10, background: '#eef6f0', padding: 12 }}><span style={{ display: 'block', color: '#536456', fontSize: 12 }}>Departure / Clock-out</span><strong>{studentAttendance?.check_out_at ? new Date(studentAttendance.check_out_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }) : 'Not yet checked out'}</strong></div>
            </div>}
            {studentAttendance?.remarks && <p style={{ color: '#536456', margin: '12px 0 0', fontSize: 13 }}>School note: {studentAttendance.remarks}</p>}
            <p style={{ color: '#647268', fontSize: 11, margin: '12px 0 0' }}>This card refreshes automatically when attendance is updated by an authorised school staff member.</p>
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
  const [readiness, setReadiness] = useState<NexusReadinessMetrics | null>(null);
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

      const [
        moduleResult,
        auditResult,
        parentAccountsResult,
        parentGuardiansResult,
        formTeachersResult,
        publishedResultsResult,
        subjectResultsResult,
        schoolMessagesResult,
        targetedNotificationsResult,
      ] = await Promise.all([
        client
          .from('nexus_module_controls')
          .select('id, module_key, display_name, is_enabled, updated_at')
          .order('display_name', { ascending: true }),

        client
          .from('nexus_audit_logs')
          .select('id, action, target_type, target_id, details, created_at')
          .order('created_at', { ascending: false })
          .limit(30),

        client
          .from('parent_portal_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),

        client
          .from('parents_guardians')
          .select('id', { count: 'exact', head: true })
          .eq('portal_enabled', true),

        client
          .from('class_form_teachers')
          .select('id', { count: 'exact', head: true }),

        client
          .from('student_term_results')
          .select('id', { count: 'exact', head: true })
          .eq('workflow_status', 'published'),

        client
          .from('student_subject_results')
          .select('id', { count: 'exact', head: true }),

        client
          .from('school_messages')
          .select('id', { count: 'exact', head: true }),

        client
          .from('school_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel', 'announcement'),
      ]);

      if (moduleResult.error) throw moduleResult.error;
      if (auditResult.error) throw auditResult.error;

      setModules((moduleResult.data ?? []) as NexusModule[]);
      setAuditEntries((auditResult.data ?? []) as NexusAuditEntry[]);
      setReadiness({
        activeParentAccounts: parentAccountsResult.error ? null : parentAccountsResult.count ?? 0,
        portalEnabledGuardians: parentGuardiansResult.error ? null : parentGuardiansResult.count ?? 0,
        assignedFormTeachers: formTeachersResult.error ? null : formTeachersResult.count ?? 0,
        trackedTestRecords: null,
        publishedTermResults: publishedResultsResult.error ? null : publishedResultsResult.count ?? 0,
        subjectResultRows: subjectResultsResult.error ? null : subjectResultsResult.count ?? 0,
        schoolMessages: schoolMessagesResult.error ? null : schoolMessagesResult.count ?? 0,
        targetedNotifications: targetedNotificationsResult.error ? null : targetedNotificationsResult.count ?? 0,
      });
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

  const readinessChecks = [
    {
      label: 'Active parent portal accounts',
      value: readiness?.activeParentAccounts ?? null,
      detail: 'Parent access records that are currently active.',
      good: (readiness?.activeParentAccounts ?? 0) > 0,
      action: 'Activate parent accounts and verify each linked learner.',
    },
    {
      label: 'Guardians enabled for portal access',
      value: readiness?.portalEnabledGuardians ?? null,
      detail: 'Guardian records with portal access enabled.',
      good: (readiness?.portalEnabledGuardians ?? 0) > 0,
      action: 'Enable portal access only after confirming guardian identity and links.',
    },
    {
      label: 'Form-teacher assignments',
      value: readiness?.assignedFormTeachers ?? null,
      detail: 'Classes with an assigned form teacher.',
      good: (readiness?.assignedFormTeachers ?? 0) > 0,
      action: 'Assign and verify form teachers for the active academic session.',
    },
    {
      label: 'Tracked test/demo records',
      value: readiness?.trackedTestRecords ?? null,
      detail: 'Records explicitly registered by the RESA test-data process.',
      good: readiness?.trackedTestRecords === 0,
      action: 'Review and clean demo data before real school operations.',
    },
    {
      label: 'Published term results',
      value: readiness?.publishedTermResults ?? null,
      detail: 'Term result records currently marked published.',
      good: (readiness?.publishedTermResults ?? 0) > 0,
      action: 'Complete score entry, approval and publication for each real class.',
    },
    {
      label: 'Subject score records',
      value: readiness?.subjectResultRows ?? null,
      detail: 'Subject-level score rows available for report generation.',
      good: (readiness?.subjectResultRows ?? 0) > 0,
      action: 'Check that scores belong to the correct learners, subjects and term.',
    },
    {
      label: 'School communication messages',
      value: readiness?.schoolMessages ?? null,
      detail: 'Private and customer-care messages recorded in the school communication centre.',
      good: (readiness?.schoolMessages ?? 0) > 0,
      action: 'Verify teacher, student, parent and administrator inbox access with test accounts.',
    },
    {
      label: 'Role-targeted notifications',
      value: readiness?.targetedNotifications ?? null,
      detail: 'Recipient-specific school announcements sent through the notification channel.',
      good: (readiness?.targetedNotifications ?? 0) > 0,
      action: 'Test general, teacher, student, parent and individual-recipient delivery.',
    },
  ];

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

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Operational readiness checks</h2>
              <p style={{ color: '#536456', lineHeight: 1.6 }}>
                Live counts from the connected RESA database. These checks show setup gaps; they do not replace role-based workflow testing.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {readinessChecks.map((check) => {
                  const verified = check.value !== null;
                  const passed = verified && check.good;
                  return (
                    <article
                      key={check.label}
                      style={{
                        border: '1px solid ' + (passed ? '#b9d9c1' : '#e5c66b'),
                        borderRadius: 10,
                        padding: 14,
                        background: passed ? '#f1f8f2' : '#fffaf0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <strong style={{ fontSize: 14 }}>{check.label}</strong>
                        <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: passed ? '#155b30' : '#76550c' }}>
                          {!verified ? 'NOT VERIFIED' : passed ? 'CHECKED' : 'ACTION REQUIRED'}
                        </span>
                      </div>
                      <strong style={{ display: 'block', fontSize: 27, marginTop: 10 }}>
                        {verified ? check.value : '—'}
                      </strong>
                      <p style={{ margin: '7px 0', fontSize: 12, color: '#536456', lineHeight: 1.5 }}>
                        {check.detail}
                      </p>
                      {!passed && (
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#76550c', lineHeight: 1.5 }}>
                          Next: {check.action}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
              <p style={{ marginBottom: 0, marginTop: 14, fontSize: 12, color: '#68766b' }}>
                Latest recorded Engine Room action: {auditEntries[0]?.created_at ? new Date(auditEntries[0].created_at).toLocaleString() : 'No audit activity found'}.
              </p>
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

              <div role="note" style={{ margin: '12px 0 16px', padding: 14, borderRadius: 10, border: '1px solid #e5c66b', background: '#fff9e8', color: '#614b12' }}>
                <strong>Control scope: configuration and audit only</strong>
                <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                  A module marked Enabled is not automatically proven operational. A Disabled setting blocks access only where that feature checks the Nexus control. Each module must pass its own access, workflow and data-isolation tests before it can be marked launch-ready.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 16 }}>
                <div style={{ ...statStyle, background: '#eef5ef' }}>
                  <div style={statLabelStyle}>Owner verification</div>
                  <strong style={{ display: 'block', marginTop: 7, color: '#155b30' }}>Verified for this session</strong>
                </div>
                <div style={{ ...statStyle, background: '#eef5ef' }}>
                  <div style={statLabelStyle}>Configuration source</div>
                  <strong style={{ display: 'block', marginTop: 7 }}>Supabase database</strong>
                </div>
                <div style={{ ...statStyle, background: '#fff9e8' }}>
                  <div style={statLabelStyle}>Audit history displayed</div>
                  <strong style={{ display: 'block', marginTop: 7 }}>Latest 30 entries</strong>
                </div>
              </div>
              <p style={{ color: '#536456', lineHeight: 1.6 }}>
                Changes are recorded in the database audit log. Before relying on a switch to restrict a feature, confirm that the feature checks the corresponding module key on the server or through a protected database policy. UI-only hiding is not sufficient security.
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
        currentPath === '/student-assignments' ||
        currentPath === '/student-id-card' ||
        currentPath === '/my-results' ||
        currentPath === '/parent-dashboard' ||
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
        currentPath === '/student-cbt' ||
        currentPath === '/student-assignments' ||
        currentPath === '/student-id-card' ||
        currentPath === '/my-results' ||
        currentPath === '/parent-dashboard'
      ) {
        setLocation('/dashboard');
      }
      return;
    }

    if (studentMembership) {
      if (currentPath !== '/student-dashboard' && currentPath !== '/student-cbt' && currentPath !== '/student-assignments' && currentPath !== '/student-id-card' && currentPath !== '/school-communication' && currentPath !== '/notifications' && currentPath !== '/my-results' && currentPath !== '/teaching-materials' && currentPath !== '/resa-chat') {
        setLocation('/student-dashboard');
      }
      return;
    }

    if (parentMembership) {
      if (!['/parent-dashboard', '/school-cctv', '/notifications', '/school-communication', '/my-results'].includes(currentPath)) {
        setLocation('/parent-dashboard');
      }
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
      setLocation('/parent-dashboard');
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
      const supabase = getSupabaseClient();

      // Try a real Auth email first (invited parents and staff use this path).
      // If it is not an Auth email, resolve it as a parent's current contact email;
      // this keeps edited parent emails usable for internally-created RESA accounts.
      if (identifier.includes('@') && !identifier.toLowerCase().endsWith('@resa.com')) {
        const { error: emailError } = await supabase.auth.signInWithPassword({
          email: identifier.toLowerCase(),
          password,
        });
        if (!emailError) return true;

        const { data, error } = await supabase.functions.invoke('resa-login-by-id', {
          body: { login_id: identifier, password },
        });
        if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
          setAuthState('signed-out');
          setErrorText(data?.error || 'The email or password is incorrect, or this parent portal account is not active.');
          return false;
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) {
          setAuthState('signed-out');
          setErrorText('Your credentials were accepted, but the secure session could not be started. Please try again.');
          return false;
        }
        return true;
      }

      if (!identifier.toLowerCase().endsWith('@resa.com') && !/^(?:[a-zA-Z0-9][a-zA-Z0-9+(). /_-]{2,39}|\+\d[\d ().-]{7,20})$/.test(identifier)) {
        setAuthState('signed-out');
        setErrorText('Enter your registered email, student admission number, teacher staff ID, or parent phone number.');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('resa-login-by-id', {
        body: { login_id: identifier, password },
      });
      if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
        setAuthState('signed-out');
        setErrorText(data?.error || error?.message || 'The login ID or password is incorrect, or this portal account is not active.');
        return false;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) {
        setAuthState('signed-out');
        setErrorText('Your credentials were accepted, but the secure session could not be started. Please try again.');
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

  if (
    currentPath === '/portal-navigation-guide' &&
    authState === 'signed-in' &&
    accessCheckState === 'success' &&
    !membershipsLoading &&
    (adminMembership || teacherMembership || studentMembership || parentMembership)
  ) {
    return <PortalNavigationGuidePage />;
  }

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

  // Self-service password changes are available to every signed-in portal role.
  // Keep this route ahead of role-specific dashboard redirects so it never falls
  // through to an unrelated page such as Fees & Finance.
  if (authState === 'signed-in' && session && currentPath === '/reset-password') {
    return <ResetPasswordPage />;
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
    <AdminPortalShell schoolId={adminMembership.schoolId} schoolName={adminMembership.schoolName} email={session?.user.email} userId={session?.user.id || ""} onSignOut={() => void signOut()}>{content}</AdminPortalShell>
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

    if (currentPath === '/biometric-attendance') {
      return withAdminShell(<BiometricAttendancePage schoolId={adminMembership.schoolId} />);
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

    if (currentPath === '/student-id-cards') {
      return withAdminShell(<StudentIdCardsPage schoolId={adminMembership.schoolId} userId={session?.user.id ?? ''} role="admin" />);
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

    if (currentPath === '/fees-management') {
      return withAdminShell(<FeesManagementPage schoolId={adminMembership.schoolId} userId={session?.user.id ?? ''} />);
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

  if (authState === 'signed-in' && accessCheckState === 'success' && !membershipsLoading && !adminMembership && !teacherMembership && studentMembership && session && currentPath === '/student-id-card') {
    return <StudentIdCardsPage schoolId={studentMembership.schoolId} userId={session.user.id} role="student" />;
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
        <Route path="/portal-navigation-guide" component={FoundationPage} />
        <Route path="/dashboard" component={FoundationPage} />
        <Route path="/teacher-dashboard" component={FoundationPage} />
        <Route path="/student-dashboard" component={FoundationPage} />
        <Route path="/parent-dashboard" component={FoundationPage} />
        <Route path="/my-results" component={FoundationPage} />
        <Route path="/student-cbt" component={FoundationPage} />
        <Route path="/student-assignments" component={FoundationPage} />
        <Route path="/students" component={FoundationPage} />
        <Route path="/student-id-cards" component={FoundationPage} />
        <Route path="/student-id-card" component={FoundationPage} />
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
        <Route path="/fees-management" component={FoundationPage} />
        <Route path="/publication-centre" component={FoundationPage} />
        <Route path="/notifications" component={FoundationPage} />
        <Route path="/school-communication" component={FoundationPage} />
        <Route path="/staff-attendance" component={FoundationPage} />
        <Route path="/biometric-attendance" component={FoundationPage} />
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
