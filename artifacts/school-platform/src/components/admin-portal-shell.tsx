import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, GraduationCap, UserRound, School, BookOpen,
  ClipboardCheck, CalendarDays, FileText, ClipboardList, MessageSquare,
  Bell, Megaphone, BriefcaseBusiness, ChartNoAxesCombined,
  Settings, Database, ShieldCheck, Menu, X, LogOut, ChevronRight,
  CircleHelp,
} from "lucide-react";
import UnreadMessageBadge from "@/components/unread-message-badge";

type Props = {
  children: ReactNode;
  schoolId: string;
  schoolName: string;
  email?: string | null;
  onSignOut: () => void;
};

const groups = [
  { label: "MAIN", items: [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["Students", "/students", Users],
    ["Class Enrolments", "/student-enrolments", Users],
    ["Teachers & Staff", "/staff-invitations", GraduationCap],
    ["Parents & Guardians", "/parent-management", UserRound],
    ["Classes", "/classes", School],
    ["Subjects", "/subjects", BookOpen],
  ]},
  { label: "ACADEMICS", items: [
    ["Attendance", "/attendance", CalendarDays],
    ["Class Teacher Attendance", "/form-teacher-attendance", ClipboardCheck],
    ["Staff Attendance", "/staff-attendance", CalendarDays],
    ["Enter & Publish Results", "/results-management", FileText],
    ["Examinations & CBT", "/examinations", ClipboardList],
    ["Teaching Assignments", "/teaching-assignments", BookOpen],
    ["Learning Materials", "/teaching-materials", BookOpen],
  ]},
  { label: "COMMUNICATION", items: [
    ["School Messages", "/school-communication", MessageSquare],
    ["Notifications", "/notifications", Bell],
    ["Announcements", "/announcements", Megaphone],
  ]},
  { label: "ADMINISTRATION", items: [
    ["HR & Employee Records", "/hr-management", BriefcaseBusiness],
    ["Reports", "/school-reports", ChartNoAxesCombined],
    ["RESA Drive", "/school-services", Database],
    ["Publication Centre", "/publication-centre", ShieldCheck],
    ["School Settings", "/school-settings", Settings],
  ]},
];

const pageNames = groups.flatMap(group => group.items).reduce<Record<string,string>>((all,item) => {
  all[item[1] as string] = item[0] as string;
  return all;
}, {});

export default function AdminPortalShell({ children, schoolId, schoolName, email, onSignOut }: Props) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const title = pageNames[location] || "School Administration";

  useEffect(() => { setOpen(false); }, [location]);

  const navigation = (mobile = false) => (
    <div className="resa-nav-inner">
      <div className="resa-sidebar-brand">
        <img src="/media/logo/resa-logo.jpg" alt="RESA crest" />
        <div><strong>RESA</strong><span>School Portal</span></div>
        {mobile && <button className="resa-icon-button resa-close-menu" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button>}
      </div>
      <div className="resa-school-label"><span className="resa-school-dot"/><span>{schoolName}</span></div>
      <nav aria-label="School administration navigation" className="resa-sidebar-nav">
        {groups.map(group => <section key={group.label} className="resa-nav-group">
          <p className="resa-nav-label">{group.label}</p>
          {group.items.map(([label, href, Icon]) => {
            const active = location === href || (href === "/subjects" && location === "/subject-management") || (href === "/parent-management" && location === "/parents");
            const ItemIcon = Icon as typeof LayoutDashboard;
            return <Link key={href as string} href={href as string} aria-current={active ? "page" : undefined} className={`resa-nav-link ${active ? "active" : ""}`}>
              <ItemIcon size={18} strokeWidth={1.8}/><span>{label as string}</span>
              {href === "/notifications" && <UnreadMessageBadge schoolId={schoolId}/>}
            </Link>;
          })}
        </section>)}
      </nav>
      <div className="resa-sidebar-bottom">
        <div className="resa-help-note"><CircleHelp size={17}/><span>Need help? Contact your portal administrator.</span></div>
        <button type="button" className="resa-signout" onClick={onSignOut}><LogOut size={17}/> Sign out</button>
      </div>
    </div>
  );

  const initials = (email || "Admin").slice(0,2).toUpperCase();

  return <div className="resa-portal">
    <aside className="resa-sidebar-desktop">{navigation()}</aside>
    {open && <div className="resa-mobile-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside className="resa-sidebar-mobile">{navigation(true)}</aside>
    </div>}
    <div className="resa-workspace">
      <header className="resa-topbar">
        <div className="resa-topbar-left">
          <button type="button" className="resa-icon-button resa-mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21}/></button>
          <div className="resa-breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{title}</strong></div>
        </div>
        <div className="resa-topbar-actions">
          <Link href="/notifications" className="resa-notification-link" aria-label="Open notifications"><Bell size={19}/><span className="resa-notification-dot"/></Link>
          <div className="resa-user-profile"><span className="resa-avatar">{initials}</span><span className="resa-user-meta"><strong>{email || "Administrator"}</strong><small>School Administrator</small></span></div>
          <button type="button" className="resa-icon-button resa-top-signout" onClick={onSignOut} aria-label="Sign out"><LogOut size={18}/></button>
        </div>
      </header>
      <main className="resa-page-content">{children}</main>
      <footer className="resa-app-footer"><span>© {new Date().getFullYear()} {schoolName}</span><span>Designed &amp; Powered by <strong>JETAB TECH</strong></span><span>RESA Portal · v1.0</span></footer>
    </div>
  </div>;
}
