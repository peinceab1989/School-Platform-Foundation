import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, BriefcaseBusiness, RefreshCw, Search, UserPlus, Users, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type DocumentPermission = { staff_id: string; document_type: "id_card" | "admission_letter"; can_print: boolean };

type Employee = {
  id: string; person_id: string; user_id: string | null; staff_number: string | null;
  job_title: string | null; department: string | null; status: string; created_at: string;
  first_name: string; middle_name: string | null; last_name: string;
  email: string | null; phone: string | null; address: string | null;
};

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-3 text-sm font-bold text-white hover:bg-green-900 disabled:opacity-50";

export default function HrManagementPage({ schoolId }: { schoolId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentPermissions, setDocumentPermissions] = useState<Record<string, { id_card: boolean; admission_letter: boolean }>>({});
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("active");

  const loadEmployees = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const client = getSupabaseClient();
      const { data: staffRows, error: staffError } = await client.from("staff")
        .select("id, person_id, user_id, staff_number, job_title, department, status, created_at")
        .eq("school_id", schoolId).order("created_at", { ascending: false });
      if (staffError) throw staffError;
      const rows = staffRows ?? [];
      if (!rows.length) { setEmployees([]); setDocumentPermissions({}); return; }
      const { data: permissionRows, error: permissionError } = await client.from("staff_document_permissions")
        .select("staff_id,document_type,can_print").eq("school_id", schoolId);
      if (permissionError) throw permissionError;
      const permissionMap: Record<string, { id_card: boolean; admission_letter: boolean }> = {};
      for (const permission of (permissionRows ?? []) as DocumentPermission[]) {
        permissionMap[permission.staff_id] ??= { id_card: false, admission_letter: false };
        permissionMap[permission.staff_id][permission.document_type] = permission.can_print;
      }
      setDocumentPermissions(permissionMap);
      const personIds = [...new Set(rows.map((r) => r.person_id).filter(Boolean))];
      const { data: people, error: peopleError } = await client.from("people")
        .select("id, first_name, middle_name, last_name, email, phone, address")
        .eq("school_id", schoolId).in("id", personIds);
      if (peopleError) throw peopleError;
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      setEmployees(rows.flatMap((r) => {
        const p = peopleById.get(r.person_id);
        if (!p) return [];
        return [{ ...r, first_name: p.first_name, middle_name: p.middle_name, last_name: p.last_name,
          email: p.email, phone: p.phone, address: p.address }] as Employee[];
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load staff records. Check the staff/people table permissions.");
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesStatus = statusFilter === "all" || e.status.toLowerCase() === statusFilter;
      const text = [e.first_name, e.middle_name, e.last_name, e.staff_number, e.job_title, e.department, e.email, e.phone].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!q || text.includes(q));
    });
  }, [employees, search, statusFilter]);

  async function setDocumentPermission(employee: Employee, documentType: "id_card" | "admission_letter", canPrint: boolean) {
    setSaving(true); setError(""); setNotice("");
    try {
      const client = getSupabaseClient();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Please sign in again.");
      const { error: permissionError } = await client.from("staff_document_permissions").upsert({
        school_id: schoolId,
        staff_id: employee.id,
        document_type: documentType,
        can_print: canPrint,
        granted_by: canPrint ? user.id : null,
        granted_at: canPrint ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,staff_id,document_type" });
      if (permissionError) throw permissionError;
      setNotice(`${documentType === "id_card" ? "Staff ID card" : "Staff admission letter"} print permission ${canPrint ? "granted" : "revoked"} for ${employee.first_name} ${employee.last_name}.`);
      await loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update staff document permission.");
    } finally { setSaving(false); }
  }

  async function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const client = getSupabaseClient();
      const { data: person, error: personError } = await client.from("people").insert({
        school_id: schoolId, first_name: firstName.trim(), middle_name: middleName.trim() || null,
        last_name: lastName.trim(), email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null, address: address.trim() || null,
      }).select("id").single();
      if (personError) throw personError;
      const staffNumber = `RESA-STAFF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const { error: staffError } = await client.from("staff").insert({
        school_id: schoolId, person_id: person.id, staff_number: staffNumber,
        job_title: jobTitle.trim(), department: department.trim() || null, status,
      });
      if (staffError) {
        // Roll back the newly created person if the linked staff record cannot be created.
        await client.from("people").delete().eq("id", person.id).eq("school_id", schoolId);
        throw staffError;
      }
      setNotice(`Employee record created. Staff ID: ${staffNumber}`);
      setFirstName(""); setMiddleName(""); setLastName(""); setEmail(""); setPhone(""); setAddress(""); setJobTitle(""); setDepartment(""); setStatus("active"); setShowForm(false);
      await loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this employee record.");
    } finally { setSaving(false); }
  }

  async function changeStatus(employee: Employee, nextStatus: string) {
    const action = nextStatus === "suspended" ? "suspend" : nextStatus === "active" ? "activate" : "mark as left";
    if (!window.confirm(`Are you sure you want to ${action} ${employee.first_name} ${employee.last_name}?`)) return;
    setError(""); setNotice("");
    const { error: updateError } = await getSupabaseClient().from("staff").update({ status: nextStatus }).eq("id", employee.id).eq("school_id", schoolId);
    if (updateError) { setError(updateError.message); return; }
    setNotice(`Updated ${employee.first_name} ${employee.last_name} to ${nextStatus}.`);
    await loadEmployees();
  }

  const active = employees.filter((e) => e.status.toLowerCase() === "active").length;
  const suspended = employees.filter((e) => e.status.toLowerCase() === "suspended").length;
  const left = employees.filter((e) => ["left", "inactive", "terminated"].includes(e.status.toLowerCase())).length;

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-2xl bg-green-950 p-5 text-white sm:p-7">
        <Link href="/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-green-100 hover:text-white"><ArrowLeft size={17}/> Back to dashboard</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">RESA • Human Resources</p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">HR & Staff Records</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-green-100">Maintain employee details, staff IDs, departments, job titles and employment status. Creating an HR record does not create a login account or grant portal access.</p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setError(""); }} className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-3 text-sm font-bold text-green-950 hover:bg-amber-200">{showForm ? <X size={18}/> : <UserPlus size={18}/>} {showForm ? "Close form" : "Add employee"}</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{label:"Total staff",value:employees.length},{label:"Active",value:active},{label:"Suspended",value:suspended},{label:"Left / inactive",value:left}].map((s) => <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{s.label}</p><p className="mt-2 text-3xl font-extrabold text-green-950">{s.value}</p></div>)}
      </section>

      {showForm && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">New employee record</h2><p className="mt-1 text-sm text-slate-500">Use this for employees who do not yet need a portal account. Existing teacher invitations remain under Staff Invitations.</p>
        <form onSubmit={addEmployee} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold">First name *<input required value={firstName} onChange={e=>setFirstName(e.target.value)} className={fieldClass} autoComplete="given-name"/></label>
          <label className="text-sm font-semibold">Middle name<input value={middleName} onChange={e=>setMiddleName(e.target.value)} className={fieldClass}/></label>
          <label className="text-sm font-semibold">Last name *<input required value={lastName} onChange={e=>setLastName(e.target.value)} className={fieldClass} autoComplete="family-name"/></label>
          <label className="text-sm font-semibold">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={fieldClass}/></label>
          <label className="text-sm font-semibold">Phone<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={fieldClass}/></label>
          <label className="text-sm font-semibold">Job title *<input required value={jobTitle} onChange={e=>setJobTitle(e.target.value)} className={fieldClass} placeholder="e.g. Bursar, Teacher"/></label>
          <label className="text-sm font-semibold">Department<input value={department} onChange={e=>setDepartment(e.target.value)} className={fieldClass} placeholder="e.g. Administration"/></label>
          <label className="text-sm font-semibold">Employment status<select value={status} onChange={e=>setStatus(e.target.value)} className={fieldClass}><option value="active">Active</option><option value="pending">Pending</option></select></label>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">Address<textarea value={address} onChange={e=>setAddress(e.target.value)} className={fieldClass} rows={2}/></label>
          <div className="sm:col-span-2 lg:col-span-3"><button type="submit" disabled={saving} className={buttonClass}>{saving ? "Saving record…" : "Save employee record"}</button></div>
        </form>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search size={18} className="absolute left-3 top-3.5 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm" placeholder="Search name, staff ID, job, department, email or phone"/></label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option><option value="left">Left</option></select>
          <button onClick={()=>void loadEmployees()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50"><RefreshCw size={16}/> Refresh</button>
        </div>
        <div className="mt-5 flex items-center gap-2"><Users size={19} className="text-green-800"/><h2 className="font-bold">Employee directory</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{filtered.length}</span></div>
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading employee records…</p> : filtered.length === 0 ? <div className="py-12 text-center"><BriefcaseBusiness className="mx-auto text-slate-300" size={36}/><p className="mt-3 font-semibold">No employee records found</p><p className="mt-1 text-sm text-slate-500">Add an employee or change your search filters.</p></div> : <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {filtered.map(e=><article key={e.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{e.first_name} {e.middle_name ? e.middle_name+" " : ""}{e.last_name}</h3><p className="mt-1 text-xs font-semibold text-green-800">{e.staff_number || "No staff ID assigned"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${e.status.toLowerCase()==="active"?"bg-green-100 text-green-800":e.status.toLowerCase()==="suspended"?"bg-red-100 text-red-800":"bg-amber-100 text-amber-800"}`}>{e.status}</span></div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2"><p><span className="font-semibold text-slate-800">Job:</span> {e.job_title || "Not set"}</p><p><span className="font-semibold text-slate-800">Department:</span> {e.department || "Not set"}</p><p className="break-all"><span className="font-semibold text-slate-800">Email:</span> {e.email || "Not provided"}</p><p><span className="font-semibold text-slate-800">Phone:</span> {e.phone || "Not provided"}</p><p className="sm:col-span-2"><span className="font-semibold text-slate-800">Record created:</span> {new Date(e.created_at).toLocaleDateString()}</p></div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">Teacher document permissions</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={() => void setDocumentPermission(e, "id_card", !(documentPermissions[e.id]?.id_card ?? false))} className={`rounded-lg border px-3 py-2 text-xs font-bold ${documentPermissions[e.id]?.id_card ? "border-green-300 bg-green-50 text-green-800" : "border-slate-300 bg-white text-slate-700"}`}>{documentPermissions[e.id]?.id_card ? "Revoke ID card printing" : "Grant ID card printing"}</button>
                <button type="button" disabled={saving} onClick={() => void setDocumentPermission(e, "admission_letter", !(documentPermissions[e.id]?.admission_letter ?? false))} className={`rounded-lg border px-3 py-2 text-xs font-bold ${documentPermissions[e.id]?.admission_letter ? "border-green-300 bg-green-50 text-green-800" : "border-slate-300 bg-white text-slate-700"}`}>{documentPermissions[e.id]?.admission_letter ? "Revoke admission letter" : "Grant admission letter"}</button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Teachers can print only documents explicitly enabled here.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{e.status.toLowerCase()!=="active" && <button onClick={()=>void changeStatus(e,"active")} className="rounded-lg border border-green-200 px-3 py-2 text-xs font-bold text-green-800 hover:bg-green-50">Set active</button>}{e.status.toLowerCase()!=="suspended" && <button onClick={()=>void changeStatus(e,"suspended")} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50">Suspend</button>}{!["left","inactive","terminated"].includes(e.status.toLowerCase()) && <button onClick={()=>void changeStatus(e,"left")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50">Mark as left</button>}</div>
          </article>)}
        </div>}
      </section>
      <div className="flex flex-wrap gap-3 text-sm"><Link href="/staff-invitations" className="font-bold text-green-800 underline">Manage teacher invitations and access</Link><Link href="/dashboard" className="font-bold text-green-800 underline">Return to school dashboard</Link></div>
    </div>
  </main>;
}
