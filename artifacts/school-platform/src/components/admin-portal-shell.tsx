import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, GraduationCap, UserRound, School, BookOpen,
  ClipboardCheck, CalendarDays, FileText, ClipboardList, Sparkles,
  MessageSquare, Bell, Megaphone, BriefcaseBusiness, ChartNoAxesCombined,
  Settings, Database, Video, ShieldCheck, Menu, X, LogOut, ChevronRight, ChevronDown,
  MessageCircle, Wallet,
} from "lucide-react";
import UnreadMessageBadge from "@/components/unread-message-badge";
import ProfilePhotoCard from "@/components/profile-photo-card";
import { getSupabaseClient } from "@/lib/supabase/client";

type Props = {
  children: ReactNode;
  schoolId: string;
  schoolName: string;
  email?: string | null;
  userId: string;
  onSignOut: () => void;
};

const groups = [
  { label: "MAIN", items: [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["Students", "/students", Users],
    ["Student ID Cards", "/student-id-cards", GraduationCap],
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
    ["Academic Results", "/results", ChartNoAxesCombined],
    ["Examinations & CBT", "/examinations", ClipboardList],
    ["Teaching Assignments", "/teaching-assignments", BookOpen],
    ["Learning Materials", "/teaching-materials", BookOpen],
    ["Practice & Revision", "/practice-drills", Sparkles],
  ]},
  { label: "COMMUNICATION", items: [
    ["School Messages", "/school-communication", MessageSquare],
    ["Notifications", "/notifications", Bell],
    ["Announcements", "/announcements", Megaphone],
    ["School Chat", "/resa-chat", MessageSquare],
  ]},
  { label: "ADMINISTRATION", items: [
    ["HR & Employee Records", "/hr-management", BriefcaseBusiness],
    ["Reports", "/school-reports", ChartNoAxesCombined],
    ["Additional School Services", "/school-services", Database],
    ["Fees Management", "/fees-management", Wallet],
    ["Publication Centre", "/publication-centre", ShieldCheck],
    ["CCTV & Monitoring", "/school-cctv", Video],
    ["School Settings", "/school-settings", Settings],
    ["Portal Navigation Guide", "/portal-navigation-guide", BookOpen],
  ]},
];

const pageNames = groups.flatMap(group => group.items).reduce<Record<string,string>>((all,item) => {
  all[item[1] as string] = item[0] as string;
  return all;
}, {});

export default function AdminPortalShell({ children, schoolId, schoolName, email, userId, onSignOut }: Props) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [administratorName, setAdministratorName] = useState("");
  const activeGroup = groups.find(group => group.items.some(item => item[1] === location))?.label || "MAIN";
  const [openGroups, setOpenGroups] = useState<string[]>([activeGroup]);
  const title = pageNames[location] || "School Administration";

  useEffect(() => { setOpen(false); setOpenGroups(current => current.includes(activeGroup) ? current : [...current, activeGroup]); }, [location, activeGroup]);

  useEffect(() => {
    let active = true;
    async function loadName() {
      try {
        const db = getSupabaseClient() as any;
        const result = await db.from("people").select("first_name,middle_name,last_name").eq("school_id", schoolId).eq("user_id", userId).limit(1).maybeSingle();
        if (result.error) throw result.error;
        const name = [result.data?.first_name, result.data?.middle_name, result.data?.last_name].filter(Boolean).join(" ").trim();
        if (active) setAdministratorName(name);
      } catch { if (active) setAdministratorName(""); }
    }
    void loadName();
    return () => { active = false; };
  }, [schoolId, userId]);

  const toggleGroup = (label: string) => setOpenGroups(current => current.includes(label) ? current.filter(item => item !== label) : [...current, label]);

  const navigation = (mobile = false) => (
    <div className="resa-nav-inner">
      <div className="resa-sidebar-brand">
        <img src="/media/logo/resa-logo.jpg" alt="RESA crest" />
        <div><strong>RESA</strong><span>School Portal</span></div>
        {mobile && <button className="resa-icon-button resa-close-menu" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button>}
      </div>
      <div className="resa-school-label"><span className="resa-school-dot"/><span>{schoolName}</span></div>
      <nav aria-label="School administration navigation" className="resa-sidebar-nav">
        {groups.map(group => {
          const expanded = openGroups.includes(group.label);
          const containsActive = group.items.some(item => location === item[1] || (item[1] === "/subjects" && location === "/subject-management") || (item[1] === "/parent-management" && location === "/parents"));
          return <section key={group.label} className={`resa-nav-group ${expanded ? "is-expanded" : ""}`}>
            <button type="button" className={`resa-nav-group-toggle ${containsActive ? "has-active" : ""}`} aria-expanded={expanded} onClick={() => toggleGroup(group.label)}>
              <span>{group.label}</span><ChevronDown size={15} className={expanded ? "is-rotated" : ""}/>
            </button>
            {expanded && <div className="resa-nav-group-items">
              {group.items.map(([label, href, Icon]) => {
                const active = location === href || (href === "/subjects" && location === "/subject-management") || (href === "/parent-management" && location === "/parents");
                const ItemIcon = Icon as typeof LayoutDashboard;
                return <Link key={href as string} href={href as string} aria-current={active ? "page" : undefined} className={`resa-nav-link ${active ? "active" : ""}`}>
                  <ItemIcon size={18} strokeWidth={1.8}/><span>{label as string}</span>
                  {href === "/notifications" && <UnreadMessageBadge schoolId={schoolId}/>}
                </Link>;
              })}
            </div>}
          </section>;
        })}
      </nav>
      <div className="resa-sidebar-bottom">
        <a className="resa-help-note" href="https://wa.me/2348058422691?text=Hello%20RESA%20Customer%20Care.%20I%20need%20assistance%20with%20the%20school%20portal." target="_blank" rel="noopener noreferrer" aria-label="Contact RESA Customer Care on WhatsApp"><MessageCircle size={17}/><span><strong>RESA Customer Care</strong><small>Chat with our support team</small></span></a>
        <button type="button" className="resa-signout" onClick={onSignOut}><LogOut size={17}/> Sign out</button>
      </div>
    </div>
  );

  const visibleName = administratorName || (email ? email.split("@")[0].replace(/[._-]+/g, " ") : "Administrator");
  const initials = visibleName.split(/\\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join("").toUpperCase() || "AD";

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
          <div className="resa-user-profile"><span className="resa-avatar">{initials}</span><span className="resa-user-meta"><strong>{visibleName}</strong><small>School Administrator</small></span></div>
          <button type="button" className="resa-icon-button resa-top-signout" onClick={onSignOut} aria-label="Sign out"><LogOut size={18}/></button>
        </div>
      </header>
      <main className="resa-page-content"><div style={{ marginBottom: 10, borderRadius: 14, background: "#123d2b", padding: 8, maxWidth: 250 }}><ProfilePhotoCard userId={userId} displayName={visibleName} roleLabel="School Administrator" compact /></div>{children}</main>
      <footer className="resa-app-footer"><span>© {new Date().getFullYear()} {schoolName}</span><span>Designed &amp; Powered by <strong>JETAB TECH</strong></span><span>RESA Portal · v1.0</span></footer>
    </div>
  </div>;
}
