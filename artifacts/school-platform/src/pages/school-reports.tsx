import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FileBarChart2, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Summary = { label: string; total: number; active: number; inactive: number };
const dateToday = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function csvCell(value: string | number) { return '"' + String(value).replace(/"/g,'""') + '"'; }

export default function SchoolReportsPage({ schoolId }: { schoolId: string }) {
  const [summary,setSummary] = useState<Summary[]>([]);
  const [attendance,setAttendance] = useState<{present:number;absent:number;late:number;excused:number;total:number}>({present:0,absent:0,late:0,excused:0,total:0});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [generatedAt,setGeneratedAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient();
      const today = dateToday();
      const [students,staff,classes,subjects,exams,announcements,attendanceTotal,presentCount,absentCount,lateCount,excusedCount] = await Promise.all([
        db.from("students").select("id",{count:"exact",head:true}).eq("school_id",schoolId),
        db.from("staff").select("id",{count:"exact",head:true}).eq("school_id",schoolId),
        db.from("school_classes").select("id",{count:"exact",head:true}).eq("school_id",schoolId),
        db.from("subjects").select("id",{count:"exact",head:true}).eq("school_id",schoolId),
        db.from("online_exams").select("id",{count:"exact",head:true}).eq("school_id",schoolId),
        db.from("announcements").select("id",{count:"exact",head:true}).eq("school_id",schoolId),
        db.from("student_attendance").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("attendance_date",today),
        db.from("student_attendance").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("attendance_date",today).eq("status","present"),
        db.from("student_attendance").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("attendance_date",today).eq("status","absent"),
        db.from("student_attendance").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("attendance_date",today).eq("status","late"),
        db.from("student_attendance").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("attendance_date",today).eq("status","excused"),
      ]);
      for (const result of [students,staff,classes,subjects,exams,announcements,attendanceTotal,presentCount,absentCount,lateCount,excusedCount]) {
        if (result.error) throw result.error;
      }
      const [studentsActive,studentsOther,staffActive,staffOther,examsPublished,examsOther,announcementsPublished,announcementsOther] = await Promise.all([
        db.from("students").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("status","active"),
        db.from("students").select("id",{count:"exact",head:true}).eq("school_id",schoolId).neq("status","active"),
        db.from("staff").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("status","active"),
        db.from("staff").select("id",{count:"exact",head:true}).eq("school_id",schoolId).neq("status","active"),
        db.from("online_exams").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("status","published"),
        db.from("online_exams").select("id",{count:"exact",head:true}).eq("school_id",schoolId).neq("status","published"),
        db.from("announcements").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("is_published",true),
        db.from("announcements").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("is_published",false),
      ]);
      for (const result of [studentsActive,studentsOther,staffActive,staffOther,examsPublished,examsOther,announcementsPublished,announcementsOther]) {
        if (result.error) throw result.error;
      }
      const count = (result: { count: number | null }) => result.count ?? 0;
      setSummary([
        {label:"Students",total:count(students),active:count(studentsActive),inactive:count(studentsOther)},
        {label:"Teachers & staff",total:count(staff),active:count(staffActive),inactive:count(staffOther)},
        {label:"Classes",total:count(classes),active:0,inactive:0},
        {label:"Subjects",total:count(subjects),active:0,inactive:0},
        {label:"Examinations & CBT",total:count(exams),active:count(examsPublished),inactive:count(examsOther)},
        {label:"Announcements",total:count(announcements),active:count(announcementsPublished),inactive:count(announcementsOther)},
      ]);
      setAttendance({present:count(presentCount),absent:count(absentCount),late:count(lateCount),excused:count(excusedCount),total:count(attendanceTotal)});
      setGeneratedAt(new Date().toLocaleString("en-NG",{timeZone:"Africa/Lagos"}));
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to load reports. Check table permissions and try again."); }
    finally { setLoading(false); }
  },[schoolId]);

  useEffect(()=>{void load();},[load]);

  function exportCsv() {
    const rows: (string|number)[][] = [
      ["RESA School Portal - School Summary Report"],["School ID",schoolId],["Generated (WAT)",generatedAt],
      [],["Area","Total records","Active / published","Inactive / suspended"],
      ...summary.map(s=>[s.label,s.total,s.active,s.inactive]),
      [],["Today's attendance",dateToday()],["Status","Count"],
      ["Present",attendance.present],["Absent",attendance.absent],["Late",attendance.late],["Excused",attendance.excused],["Total attendance records",attendance.total],
    ];
    const csv = rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"}));
    const a=document.createElement("a");a.href=url;a.download="RESA-school-report-"+dateToday()+".csv";a.click();URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <header className="rounded-2xl bg-green-950 p-5 text-white sm:p-7">
      <Link href="/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-green-100"><ArrowLeft size={17}/> Back to dashboard</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">RESA • Administration</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">School Reports</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-green-100">A live overview of school records and today's attendance. Export the summary as a CSV file for use in Excel or Google Sheets.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-green-700 px-4 py-3 text-sm font-bold hover:bg-green-900 disabled:opacity-50"><RefreshCw size={16}/>{loading?"Refreshing…":"Refresh"}</button><button onClick={exportCsv} disabled={loading||summary.length===0} className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-3 text-sm font-bold text-green-950 hover:bg-amber-200 disabled:opacity-50"><Download size={16}/> Export CSV</button></div></div>
    </header>
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(loading&&summary.length===0?[{label:"Students",total:0,active:0,inactive:0},{label:"Teachers & staff",total:0,active:0,inactive:0},{label:"Classes",total:0,active:0,inactive:0},{label:"Subjects",total:0,active:0,inactive:0},{label:"Examinations & CBT",total:0,active:0,inactive:0},{label:"Announcements",total:0,active:0,inactive:0}]:summary).map(s=><article key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-600">{s.label}</p><FileBarChart2 size={20} className="text-green-800"/></div><p className="mt-3 text-3xl font-extrabold text-green-950">{loading&&summary.length===0?"—":s.total}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{["Students","Teachers & staff","Examinations & CBT","Announcements"].includes(s.label) ? <><span>Active/published: {s.active}</span><span>Other statuses/unpublished: {s.inactive}</span></> : <span>Total records in this category</span>}</div></article>)}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Attendance today</h2><p className="mt-1 text-sm text-slate-500">{dateToday()} • West Africa Time</p></div><span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-900">{attendance.total} records</span></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[{label:"Present",value:attendance.present},{label:"Absent",value:attendance.absent},{label:"Late",value:attendance.late},{label:"Excused",value:attendance.excused}].map(s=><div key={s.label} className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">{s.label}</p><p className="mt-1 text-2xl font-extrabold">{loading?"—":s.value}</p></div>)}</div></section>
    <p className="text-xs leading-5 text-slate-500">{generatedAt ? "Last refreshed: " + generatedAt + " WAT." : "Reports have not been refreshed yet."} These are record counts, not financial totals or examination performance results. Only data readable by your signed-in school account is included.</p>
    <Link href="/dashboard" className="text-sm font-bold text-green-800 underline">Return to dashboard</Link>
  </div></main>;
}
