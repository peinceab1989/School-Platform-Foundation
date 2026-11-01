import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, Banknote, CheckCircle2, Clock3, FileText, Printer, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type AnyRow = Record<string, any>;
type Props = { schoolId: string; userId: string; role: "admin" | "parent"; schoolName?: string };

const naira = (value: unknown) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(value ?? 0));
const shortDate = (value: string | null | undefined) => value ? new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB") : "—";
const errText = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed. Please try again.";

export default function FeesManagementPage({ schoolId, userId, role, schoolName = "RHEMA EXPLOITS SCIENCE ACADEMY" }: Props) {
  const db = getSupabaseClient() as any;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"overview" | "setup" | "submissions">("overview");
  const [students, setStudents] = useState<AnyRow[]>([]);
  const [feeTypes, setFeeTypes] = useState<AnyRow[]>([]);
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [terms, setTerms] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [payments, setPayments] = useState<AnyRow[]>([]);
  const [discounts, setDiscounts] = useState<AnyRow[]>([]);
  const [receipts, setReceipts] = useState<AnyRow[]>([]);
  const [submissions, setSubmissions] = useState<AnyRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<AnyRow[]>([]);
  const [parentGuardianId, setParentGuardianId] = useState("");
  const [parentLinks, setParentLinks] = useState<AnyRow[]>([]);
  const [feeForm, setFeeForm] = useState({ name: "", description: "", amount: "" });
  const [assignmentForm, setAssignmentForm] = useState({ student_id: "", fee_type_id: "", academic_session_id: "", academic_term_id: "", amount_due: "", due_date: "" });
  const [bankForm, setBankForm] = useState({ bank_name: "", account_name: "", account_number: "", payment_instructions: "" });
  const [discountForm, setDiscountForm] = useState({ student_id: "", fee_type_id: "", academic_session_id: "", discount_type: "amount", discount_value: "", reason: "" });
  const [paymentForm, setPaymentForm] = useState({ assignment_id: "", amount: "", payment_date: new Date().toISOString().slice(0, 10), reference_number: "", parent_note: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (role === "admin") {
        const [studentRes, feeRes, sessionRes, termRes, assignmentRes, bankRes, submissionRes, discountRes] = await Promise.all([
          db.from("students").select("id,person_id,admission_number,status").eq("school_id", schoolId).order("admission_number"),
          db.from("fee_types").select("*").eq("school_id", schoolId).order("name"),
          db.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("start_date", { ascending: false }),
          db.from("academic_terms").select("id,name,academic_session_id,term_number,is_current").eq("school_id", schoolId).order("term_number"),
          db.from("student_fee_assignments").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
          db.from("school_bank_accounts").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
          db.from("student_fee_payment_submissions").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(300),
          db.from("student_fee_discounts").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
        ]);
        for (const result of [studentRes, feeRes, sessionRes, termRes, assignmentRes, bankRes, submissionRes, discountRes]) if (result.error) throw result.error;
        const studentRows = studentRes.data ?? [];
        const personIds = studentRows.map((s: AnyRow) => s.person_id).filter(Boolean);
        const peopleRes = personIds.length ? await db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds) : { data: [], error: null };
        if (peopleRes.error) throw peopleRes.error;
        const people = new Map((peopleRes.data ?? []).map((p: AnyRow) => [p.id, p]));
        setStudents(studentRows.map((s: AnyRow) => ({ ...s, person: people.get(s.person_id) })));
        setFeeTypes(feeRes.data ?? []); setSessions(sessionRes.data ?? []); setTerms(termRes.data ?? []);
        setAssignments(assignmentRes.data ?? []); setBankAccounts(bankRes.data ?? []); setSubmissions(submissionRes.data ?? []); setDiscounts(discountRes.data ?? []);
        const ids = (assignmentRes.data ?? []).map((a: AnyRow) => a.id);
        if (ids.length) {
          const [payRes, receiptRes] = await Promise.all([
            db.from("student_fee_payments").select("*").eq("school_id", schoolId).in("student_fee_assignment_id", ids),
            db.from("student_payment_receipts").select("*").eq("school_id", schoolId).order("receipt_date", { ascending: false }).limit(500),
          ]);
          if (payRes.error) throw payRes.error; if (receiptRes.error) throw receiptRes.error;
          setPayments(payRes.data ?? []); setReceipts(receiptRes.data ?? []);
        } else { setPayments([]); setReceipts([]); }
      } else {
        const { data: person, error: personError } = await db.from("people").select("id").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
        if (personError) throw personError;
        if (!person) throw new Error("Your parent identity is not linked to this account. Contact the school office.");
        const { data: guardian, error: guardianError } = await db.from("parents_guardians").select("id").eq("school_id", schoolId).eq("person_id", person.id).eq("portal_enabled", true).maybeSingle();
        if (guardianError) throw guardianError;
        if (!guardian) throw new Error("Your parent portal is not active yet. Please contact the school office.");
        setParentGuardianId(guardian.id);
        const [linkRes, bankRes] = await Promise.all([
          db.from("parent_student_portal_access").select("student_id").eq("school_id", schoolId).eq("parent_guardian_id", guardian.id).eq("is_active", true),
          db.from("school_bank_accounts").select("id,bank_name,account_name,account_number,payment_instructions").eq("school_id", schoolId).eq("is_active", true).order("created_at"),
        ]);
        if (linkRes.error) throw linkRes.error; if (bankRes.error) throw bankRes.error;
        const linkedIds = (linkRes.data ?? []).map((x: AnyRow) => x.student_id);
        setParentLinks(linkRes.data ?? []); setBankAccounts(bankRes.data ?? []);
        if (!linkedIds.length) { setAssignments([]); setPayments([]); setReceipts([]); setSubmissions([]); return; }
        const [viewRes, studentRes] = await Promise.all([
          db.from("parent_fee_portal_views").select("student_id,student_fee_assignment_id").eq("school_id", schoolId).eq("parent_guardian_id", guardian.id).eq("can_view", true),
          db.from("students").select("id,admission_number,person_id").eq("school_id", schoolId).in("id", linkedIds),
        ]);
        if (viewRes.error) throw viewRes.error; if (studentRes.error) throw studentRes.error;
        const visibleIds = (viewRes.data ?? []).map((v: AnyRow) => v.student_fee_assignment_id);
        const pids = (studentRes.data ?? []).map((s: AnyRow) => s.person_id);
        const peopleRes = pids.length ? await db.from("people").select("id,first_name,last_name").eq("school_id", schoolId).in("id", pids) : { data: [], error: null };
        if (peopleRes.error) throw peopleRes.error;
        const personMap = new Map((peopleRes.data ?? []).map((p: AnyRow) => [p.id, p]));
        setStudents((studentRes.data ?? []).map((s: AnyRow) => ({ ...s, person: personMap.get(s.person_id) })));
        if (!visibleIds.length) { setAssignments([]); setPayments([]); setReceipts([]); setSubmissions([]); return; }
        const [aRes, fRes, tRes, termRes, payRes, recRes, subRes, discountRes] = await Promise.all([
          db.from("student_fee_assignments").select("*").eq("school_id", schoolId).in("id", visibleIds).order("created_at", { ascending: false }),
          db.from("fee_types").select("id,name,description").eq("school_id", schoolId),
          db.from("academic_sessions").select("id,name").eq("school_id", schoolId),
          db.from("academic_terms").select("id,name").eq("school_id", schoolId),
          db.from("student_fee_payments").select("*").eq("school_id", schoolId).in("student_fee_assignment_id", visibleIds),
          db.from("student_payment_receipts").select("*").eq("school_id", schoolId).order("receipt_date", { ascending: false }).limit(300),
          db.from("student_fee_payment_submissions").select("*").eq("school_id", schoolId).eq("parent_guardian_id", guardian.id).order("created_at", { ascending: false }),
          db.from("student_fee_discounts").select("*").eq("school_id", schoolId).eq("status", "active"),
        ]);
        for (const result of [aRes,fRes,tRes,termRes,payRes,recRes,subRes,discountRes]) if (result.error) throw result.error;
        setAssignments((aRes.data ?? []).map((a: AnyRow) => ({ ...a, fee: (fRes.data ?? []).find((f: AnyRow) => f.id === a.fee_type_id), session: (tRes.data ?? []).find((s: AnyRow) => s.id === a.academic_session_id), term: (termRes.data ?? []).find((t: AnyRow) => t.id === a.academic_term_id) })));
        setPayments(payRes.data ?? []); setReceipts((recRes.data ?? []).filter((r: AnyRow) => linkedIds.includes(r.issued_to_student_id))); setSubmissions(subRes.data ?? []); setDiscounts(discountRes.data ?? []);
      }
    } catch (e) { setError(errText(e)); }
    finally { setLoading(false); }
  }, [db, role, schoolId, userId]);

  useEffect(() => { void load(); }, [load]);

  const studentName = (id: string) => {
    const student = students.find((s) => s.id === id);
    const p = student?.person;
    return p ? [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") : student?.admission_number ?? "Student";
  };
  const feeName = (id: string) => feeTypes.find((f) => f.id === id)?.name ?? assignments.find((a) => a.fee_type_id === id)?.fee?.name ?? "School fee";
  const totalPaid = (id: string) => payments.filter((p) => p.student_fee_assignment_id === id).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const effectiveDue = (a: AnyRow) => { const today = new Date().toISOString().slice(0,10); const discount = discounts.filter((d) => d.student_id === a.student_id && (!d.fee_type_id || d.fee_type_id === a.fee_type_id) && (!d.academic_session_id || d.academic_session_id === a.academic_session_id) && d.status === "active" && (!d.start_date || d.start_date <= today) && (!d.end_date || d.end_date >= today)).reduce((sum, d) => sum + (["percentage","percent"].includes(String(d.discount_type).toLowerCase()) ? Number(a.amount_due || 0) * Math.min(Number(d.discount_value || 0),100) / 100 : Number(d.discount_value || 0)), 0); return Math.max(0, Number(a.amount_due || 0) - Math.min(discount, Number(a.amount_due || 0))); };
  const balance = (a: AnyRow) => Math.max(0, effectiveDue(a) - totalPaid(a.id));
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const totalOutstanding = assignments.reduce((sum, a) => sum + balance(a), 0);

  async function createFeeType(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const amount = Number(feeForm.amount);
    if (!feeForm.name.trim() || !Number.isFinite(amount) || amount <= 0) { setError("Enter a fee name and a valid amount greater than zero."); return; }
    setBusy(true);
    try {
      const { error: insertError } = await db.from("fee_types").insert({ school_id: schoolId, name: feeForm.name.trim(), description: feeForm.description.trim() || null, amount });
      if (insertError) throw insertError;
      setFeeForm({ name: "", description: "", amount: "" }); setNotice("Fee type created."); await load();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function createAssignment(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!assignmentForm.student_id || !assignmentForm.fee_type_id || !assignmentForm.academic_session_id) { setError("Select a student, fee type and academic session."); return; }
    const fee = feeTypes.find((f) => f.id === assignmentForm.fee_type_id);
    const amount = Number(assignmentForm.amount_due || fee?.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a valid fee amount."); return; }
    setBusy(true);
    try {
      const { error: insertError } = await db.from("student_fee_assignments").insert({
        school_id: schoolId, student_id: assignmentForm.student_id, fee_type_id: assignmentForm.fee_type_id,
        academic_session_id: assignmentForm.academic_session_id, academic_term_id: assignmentForm.academic_term_id || null,
        amount_due: amount, due_date: assignmentForm.due_date || null, status: "unpaid",
      });
      if (insertError) throw insertError;
      setAssignmentForm({ student_id: "", fee_type_id: "", academic_session_id: "", academic_term_id: "", amount_due: "", due_date: "" });
      setNotice("Fee assigned. Linked parent portals will receive visibility automatically."); await load();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function saveDiscount(event: FormEvent) {\n    event.preventDefault(); setError(""); setNotice("");\n    const value = Number(discountForm.discount_value);\n    if (!discountForm.student_id || !Number.isFinite(value) || value <= 0 || (discountForm.discount_type === "percentage" && value > 100)) { setError("Choose a student and enter a valid discount value. Percentage discounts cannot exceed 100%."); return; }\n    setBusy(true);\n    try { const { error: insertError } = await db.from("student_fee_discounts").insert({ school_id: schoolId, student_id: discountForm.student_id, fee_type_id: discountForm.fee_type_id || null, academic_session_id: discountForm.academic_session_id || null, discount_type: discountForm.discount_type, discount_value: value, reason: discountForm.reason.trim() || "Approved school fee concession", status: "active", approved_by: userId }); if (insertError) throw insertError; setDiscountForm({ student_id: "", fee_type_id: "", academic_session_id: "", discount_type: "amount", discount_value: "", reason: "" }); setNotice("Fee discount saved and applied to matching assignments."); await load(); } catch (e) { setError(errText(e)); } finally { setBusy(false); }\n  }\n\n  async function saveBankAccount(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!bankForm.bank_name.trim() || !bankForm.account_name.trim() || !/^[0-9]{8,20}$/.test(bankForm.account_number.trim())) { setError("Enter a bank name, account name and valid account number."); return; }
    setBusy(true);
    try {
      const { error: insertError } = await db.from("school_bank_accounts").insert({ school_id: schoolId, ...bankForm, created_by: userId });
      if (insertError) throw insertError;
      setBankForm({ bank_name: "", account_name: "", account_number: "", payment_instructions: "" }); setNotice("Bank account saved. Parents can now see it for transfers."); await load();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function reviewSubmission(id: string, decision: "verify" | "reject") {
    const note = window.prompt(decision === "verify" ? "Optional verification note:" : "Reason for rejecting this transfer:");
    if (decision === "reject" && !note?.trim()) { setError("Enter a reason before rejecting a payment."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: rpcError } = await db.rpc("review_student_fee_payment_submission", { p_submission_id: id, p_decision: decision, p_admin_note: note || null });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error("The payment review did not complete.");
      setNotice(decision === "verify" ? `Payment verified. Receipt ${data.receipt_number} has been issued.` : "Payment submission rejected.");
      await load();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function submitTransfer(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const assignment = assignments.find((a) => a.id === paymentForm.assignment_id);
    const amount = Number(paymentForm.amount);
    if (!assignment || !Number.isFinite(amount) || amount <= 0 || amount > balance(assignment)) { setError("Select a fee and enter an amount within the outstanding balance."); return; }
    if (paymentForm.reference_number.trim().length < 4) { setError("Enter the bank transfer reference or session ID."); return; }
    setBusy(true);
    try {
      const { error: insertError } = await db.from("student_fee_payment_submissions").insert({
        school_id: schoolId, student_fee_assignment_id: assignment.id, student_id: assignment.student_id,
        parent_guardian_id: parentGuardianId, amount, payment_date: paymentForm.payment_date,
        payment_method: "bank_transfer", reference_number: paymentForm.reference_number.trim(),
        parent_note: paymentForm.parent_note.trim() || null, submitted_by: userId, status: "pending",
      });
      if (insertError) throw insertError;
      setPaymentForm({ assignment_id: "", amount: "", payment_date: new Date().toISOString().slice(0, 10), reference_number: "", parent_note: "" });
      setNotice("Transfer submitted for school verification. It is not marked as paid and no receipt is issued until the finance office confirms it.");
      await load();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  const visibleAssignments = useMemo(() => assignments.filter((a) => role === "admin" || parentLinks.some((l) => l.student_id === a.student_id)), [assignments, parentLinks, role]);
  const printableReceipts = receipts.filter((r) => role === "admin" || students.some((s) => s.id === r.issued_to_student_id));

  return <main className="min-h-screen bg-stone-50 text-slate-900">
    <style>{`@media print { .no-print { display:none!important } body { background:#fff!important } .print-area { display:block!important; box-shadow:none!important; border:0!important } }`}</style>
    <header className="no-print bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <Link href={role === "admin" ? "/dashboard" : "/parent-dashboard"} className="mb-3 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to portal</Link>
      <p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · Finance</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{role === "admin" ? "Fees & Payment Management" : "My Child's Fees & Payments"}</h1>
      <p className="mt-1 text-sm text-emerald-100">{schoolName}</p>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <section className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">{role === "admin" ? "Fee assignments" : "Visible fee items"}</p><p className="mt-1 text-2xl font-bold">{visibleAssignments.length}</p></section>
        <section className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">{role === "admin" ? "Pending verification" : "Pending submissions"}</p><p className="mt-1 text-2xl font-bold">{role === "admin" ? pendingCount : submissions.filter((s) => s.status === "pending").length}</p></section>
        <section className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Outstanding balance</p><p className="mt-1 text-2xl font-bold">{naira(totalOutstanding)}</p></section>
      </div>
      {role === "admin" ? <nav className="no-print flex flex-wrap gap-2">{(["overview","setup","submissions"] as const).map((key) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===key?"bg-emerald-900 text-white":"border bg-white"}`}>{key === "overview" ? "Overview" : key === "setup" ? "Fee setup" : `Payment review (${pendingCount})`}</button>)}</nav> : null}
      {loading ? <div className="rounded-2xl border bg-white p-8 text-center text-slate-600"><RefreshCw className="mx-auto mb-2 animate-spin"/>Loading finance records…</div> : <>
        {(role === "parent" || tab === "overview") && <section className="print-area rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Fee statement</h2><p className="text-sm text-slate-500">Only fee records authorised for this account are shown.</p></div><button className="no-print inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold" onClick={() => window.print()}><Printer size={16}/> Print statement</button></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Student</th><th className="p-3">Fee</th><th className="p-3">Session / term</th><th className="p-3 text-right">Due</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th><th className="p-3">Status</th></tr></thead><tbody>{visibleAssignments.map((a) => <tr key={a.id} className="border-t"><td className="p-3">{studentName(a.student_id)}</td><td className="p-3">{a.fee?.name ?? feeName(a.fee_type_id)}</td><td className="p-3">{a.session?.name ?? sessions.find((s) => s.id === a.academic_session_id)?.name ?? "—"}{a.term?.name ? " · " + a.term.name : ""}</td><td className="p-3 text-right">{naira(effectiveDue(a))}</td><td className="p-3 text-right">{naira(totalPaid(a.id))}</td><td className="p-3 text-right font-bold">{naira(balance(a))}</td><td className="p-3 capitalize">{balance(a) <= 0 ? "Paid" : totalPaid(a.id) > 0 ? "Part-paid" : "Unpaid"}</td></tr>)}</tbody></table>{visibleAssignments.length===0&&<p className="p-6 text-center text-sm text-slate-500">No fee assignments are available for this account.</p>}</div>
        </section>}
        {role === "admin" && tab === "setup" && <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={createFeeType} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Create fee type</h2><label className="block text-sm font-semibold">Fee name<input required value={feeForm.name} onChange={(e)=>setFeeForm({...feeForm,name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Description<input value={feeForm.description} onChange={(e)=>setFeeForm({...feeForm,description:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Default amount (₦)<input required type="number" min="1" step="0.01" value={feeForm.amount} onChange={(e)=>setFeeForm({...feeForm,amount:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">Save fee type</button></form>
          <form onSubmit={createAssignment} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Assign fee to student</h2><label className="block text-sm font-semibold">Student<select required value={assignmentForm.student_id} onChange={(e)=>setAssignmentForm({...assignmentForm,student_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select student</option>{students.map((s)=><option key={s.id} value={s.id}>{studentName(s.id)} · {s.admission_number}</option>)}</select></label><label className="block text-sm font-semibold">Fee type<select required value={assignmentForm.fee_type_id} onChange={(e)=>{const f=feeTypes.find(x=>x.id===e.target.value);setAssignmentForm({...assignmentForm,fee_type_id:e.target.value,amount_due:f?String(f.amount):""})}} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select fee</option>{feeTypes.map((f)=><option key={f.id} value={f.id}>{f.name} · {naira(f.amount)}</option>)}</select></label><label className="block text-sm font-semibold">Academic session<select required value={assignmentForm.academic_session_id} onChange={(e)=>setAssignmentForm({...assignmentForm,academic_session_id:e.target.value,academic_term_id:""})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select session</option>{sessions.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="block text-sm font-semibold">Term (optional)<select value={assignmentForm.academic_term_id} onChange={(e)=>setAssignmentForm({...assignmentForm,academic_term_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Session-wide fee</option>{terms.filter(t=>!assignmentForm.academic_session_id||t.academic_session_id===assignmentForm.academic_session_id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="block text-sm font-semibold">Amount due (₦)<input required type="number" min="1" step="0.01" value={assignmentForm.amount_due} onChange={(e)=>setAssignmentForm({...assignmentForm,amount_due:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-semibold">Due date<input type="date" value={assignmentForm.due_date} onChange={(e)=>setAssignmentForm({...assignmentForm,due_date:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">Assign fee</button></form>
          <form onSubmit={saveDiscount} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Apply approved discount or waiver</h2><p className="text-sm text-slate-500">Discounts can be limited to one fee type and session, or apply to all fees for the learner.</p><label className="block text-sm font-semibold">Student<select required value={discountForm.student_id} onChange={(e)=>setDiscountForm({...discountForm,student_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{studentName(s.id)}</option>)}</select></label><label className="block text-sm font-semibold">Fee type (optional)<select value={discountForm.fee_type_id} onChange={(e)=>setDiscountForm({...discountForm,fee_type_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">All fee types</option>{feeTypes.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="block text-sm font-semibold">Session (optional)<select value={discountForm.academic_session_id} onChange={(e)=>setDiscountForm({...discountForm,academic_session_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">All sessions</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm font-semibold">Discount type<select value={discountForm.discount_type} onChange={(e)=>setDiscountForm({...discountForm,discount_type:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="amount">Fixed amount</option><option value="percentage">Percentage</option></select></label><label className="text-sm font-semibold">Value<input required type="number" min="0.01" max={discountForm.discount_type==="percentage"?100:undefined} step="0.01" value={discountForm.discount_value} onChange={(e)=>setDiscountForm({...discountForm,discount_value:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label></div><label className="block text-sm font-semibold">Reason<input value={discountForm.reason} onChange={(e)=>setDiscountForm({...discountForm,reason:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">Save discount</button></form>
          <form onSubmit={saveBankAccount} className="space-y-3 rounded-2xl border bg-white p-5 lg:col-span-2"><h2 className="font-extrabold">School bank account for transfers</h2><p className="text-sm text-slate-500">Only active school accounts are shown to authorised parents. Verify account details before enabling them.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Bank<input required value={bankForm.bank_name} onChange={(e)=>setBankForm({...bankForm,bank_name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-semibold">Account name<input required value={bankForm.account_name} onChange={(e)=>setBankForm({...bankForm,account_name:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-semibold">Account number<input required inputMode="numeric" maxLength={20} value={bankForm.account_number} onChange={(e)=>setBankForm({...bankForm,account_number:e.target.value.replace(/\D/g,"")})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-semibold">Transfer instructions<input value={bankForm.payment_instructions} onChange={(e)=>setBankForm({...bankForm,payment_instructions:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label></div><button disabled={busy} className="rounded-lg border px-4 py-3 font-bold disabled:opacity-50">Save bank details</button><div className="grid gap-2 sm:grid-cols-2">{bankAccounts.map(b=><div key={b.id} className="rounded-xl border p-3 text-sm"><p className="font-bold">{b.bank_name} · {b.account_name}</p><p>{b.account_number}</p><p className="text-xs text-slate-500">{b.is_active?"Visible to parents":"Inactive"}</p></div>)}</div></form>
        </div>}
        {role === "admin" && tab === "submissions" && <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Parent transfer submissions</h2><p className="text-sm text-slate-500">A transfer is not recorded as paid until the finance office verifies it. Verification creates the payment record and printable receipt atomically.</p>{submissions.map((s)=><article key={s.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{studentName(s.student_id)} · {naira(s.amount)}</p><p className="text-sm text-slate-600">Reference: {s.reference_number} · Date: {shortDate(s.payment_date)}</p><p className="text-xs text-slate-500">Submitted {shortDate(s.created_at?.slice(0,10))} · {s.parent_note||"No parent note"}</p></div><span className="h-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize">{s.status}</span></div>{s.status==="pending"&&<div className="no-print mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void reviewSubmission(s.id,"verify")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white"><CheckCircle2 size={15}/> Verify & issue receipt</button><button disabled={busy} onClick={()=>void reviewSubmission(s.id,"reject")} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700"><XCircle size={15}/> Reject</button></div>}</article>)}{submissions.length===0&&<p className="py-6 text-center text-sm text-slate-500">No payment submissions yet.</p>}</section>}
        {role === "parent" && <section className="space-y-4 rounded-2xl border bg-white p-5"><div><h2 className="font-extrabold">Submit a bank transfer</h2><p className="text-sm text-slate-500">Transfer to one of the verified school accounts below, then enter the transaction reference. Your submission remains pending until the school confirms it.</p></div><div className="grid gap-3 sm:grid-cols-2">{bankAccounts.map(b=><div key={b.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"><p className="font-bold">{b.bank_name}</p><p>{b.account_name}</p><p className="text-lg font-extrabold tracking-wider">{b.account_number}</p><p className="mt-1 text-xs text-slate-600">{b.payment_instructions}</p></div>)}</div>{bankAccounts.length===0&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The school has not published bank transfer details yet. Contact the school office before making a payment.</p>}<form onSubmit={submitTransfer} className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Fee assignment<select required value={paymentForm.assignment_id} onChange={(e)=>setPaymentForm({...paymentForm,assignment_id:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"><option value="">Select fee and learner</option>{visibleAssignments.filter(a=>balance(a)>0).map(a=><option key={a.id} value={a.id}>{studentName(a.student_id)} · {a.fee?.name??feeName(a.fee_type_id)} · Balance {naira(balance(a))}</option>)}</select></label><label className="text-sm font-semibold">Amount transferred (₦)<input required type="number" min="1" step="0.01" value={paymentForm.amount} onChange={(e)=>setPaymentForm({...paymentForm,amount:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-semibold">Transfer date<input required type="date" value={paymentForm.payment_date} onChange={(e)=>setPaymentForm({...paymentForm,payment_date:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-semibold sm:col-span-2">Bank transaction reference<input required minLength={4} maxLength={100} value={paymentForm.reference_number} onChange={(e)=>setPaymentForm({...paymentForm,reference_number:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-semibold sm:col-span-2">Note (optional)<input maxLength={500} value={paymentForm.parent_note} onChange={(e)=>setPaymentForm({...paymentForm,parent_note:e.target.value})} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy||bankAccounts.length===0} className="rounded-lg bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2">Submit for verification</button></form></section>}
        {(role === "parent" || role === "admin" && tab === "overview") && <section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Payment history & receipts</h2>{payments.map(p=>{const receipt=printableReceipts.find(r=>r.payment_id===p.id);return <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm"><div><p className="font-bold">{studentName(p.student_id)} · {naira(p.amount_paid)}</p><p className="text-slate-500">{shortDate(p.payment_date)} · {p.reference_number||"—"}</p>{receipt&&<p className="text-xs text-emerald-800">Receipt: {receipt.receipt_number}</p>}</div>{receipt&&<button onClick={()=>window.print()} className="no-print inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-bold"><Printer size={15}/> Print</button>}</div>})}{payments.length===0&&<p className="py-5 text-sm text-slate-500">No verified payments recorded yet.</p>}</section>}
        {role === "parent" && <section className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Your submissions</h2>{submissions.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm"><div><p className="font-bold">{naira(s.amount)} · {s.reference_number}</p><p className="text-slate-500">{shortDate(s.payment_date)} · {s.admin_note||"Awaiting finance review"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 font-bold capitalize">{s.status}</span></div>)}{submissions.length===0&&<p className="py-4 text-sm text-slate-500">No transfer submissions yet.</p>}</section>}
      </>}
      <footer className="no-print flex items-center justify-center gap-2 py-4 text-xs text-slate-500"><ShieldCheck size={14}/> Private school finance records · Designed & Powered by JETAB TECH</footer>
    </div>
  </main>;
}
