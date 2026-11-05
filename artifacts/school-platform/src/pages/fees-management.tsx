import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, PlusCircle, ReceiptText, Printer, Wallet } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type FeeType = { id: string; name: string; description: string | null; amount: number; is_active: boolean };
type StudentOption = { id: string; name: string; admission_number: string; className: string };
type SessionOption = { id: string; name: string };
type FeeAssignment = { id: string; student_id: string; fee_type_id: string; academic_session_id: string; amount_due: number; due_date: string | null; status: string; studentName: string; admissionNumber: string; feeName: string; paid: number };
type PaymentRow = { id: string; receipt_number: string; studentName: string; admissionNumber: string; amount: number; payment_method: string; payment_date: string; feeName: string; description: string };

export default function FeesManagementPage({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feeForm, setFeeForm] = useState({ name: "", amount: "", description: "" });
  const [assignForm, setAssignForm] = useState({ fee_type_id: "", student_id: "", academic_session_id: "", amount_due: "", due_date: "" });
  const [paymentForm, setPaymentForm] = useState({ assignment_id: "", amount: "", payment_method: "cash", reference_number: "", remarks: "" });
  const [printedReceipt, setPrintedReceipt] = useState<PaymentRow | null>(null);

  const money = (value: number) => "₦" + value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseClient() as any;
      const [feeResult, studentResult, sessionResult, assignmentResult, paymentResult, enrollmentResult] = await Promise.all([
        db.from("fee_types").select("id,name,description,amount,is_active").eq("school_id", schoolId).order("created_at", { ascending: false }),
        db.from("students").select("id,person_id,admission_number,status").eq("school_id", schoolId).eq("status", "active").order("admission_number"),
        db.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("start_date", { ascending: false }),
        db.from("student_fee_assignments").select("id,student_id,fee_type_id,academic_session_id,amount_due,due_date,status").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
        db.from("student_fee_payments").select("id,student_fee_assignment_id,student_id,amount_paid,payment_method,payment_date,receipt_number").eq("school_id", schoolId).order("payment_date", { ascending: false }).limit(500),
        db.from("student_enrollments").select("student_id,class_id,academic_session_id,status").eq("school_id", schoolId).eq("status", "active"),
      ]);
      for (const result of [feeResult, studentResult, sessionResult, assignmentResult, paymentResult, enrollmentResult]) if (result.error) throw result.error;
      const personIds = [...new Set((studentResult.data ?? []).map((row: any) => row.person_id).filter(Boolean))];
      const classIds = [...new Set((enrollmentResult.data ?? []).map((row: any) => row.class_id).filter(Boolean))];
      const [peopleResult, classResult, receiptResult] = await Promise.all([
        personIds.length ? db.from("people").select("id,first_name,middle_name,last_name").eq("school_id", schoolId).in("id", personIds) : { data: [], error: null },
        classIds.length ? db.from("school_classes").select("id,name").eq("school_id", schoolId).in("id", classIds) : { data: [], error: null },
        db.from("student_payment_receipts").select("id,payment_id,receipt_number,issued_to_student_id,amount,payment_method,receipt_date,description").eq("school_id", schoolId).order("receipt_date", { ascending: false }).limit(500),
      ]);
      for (const result of [peopleResult, classResult, receiptResult]) if (result.error) throw result.error;
      const people = new Map<string, string>((peopleResult.data ?? []).map((p: any): [string, string] => [String(p.id), [p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")]));
      const classes = new Map<string, string>((classResult.data ?? []).map((c: any): [string, string] => [String(c.id), String(c.name)]));
      const enrollmentByStudent = new Map<string, any>();
      for (const e of enrollmentResult.data ?? []) if (!enrollmentByStudent.has(String(e.student_id))) enrollmentByStudent.set(String(e.student_id), e);
      const studentById = new Map<string, StudentOption>();
      const studentRows: StudentOption[] = (studentResult.data ?? []).map((s: any) => {
        const enrollment = enrollmentByStudent.get(String(s.id));
        const row = { id: String(s.id), name: people.get(String(s.person_id)) || "Student", admission_number: String(s.admission_number || ""), className: classes.get(String(enrollment?.class_id)) || "Class not assigned" };
        studentById.set(row.id, row);
        return row;
      });
      const feeById = new Map<string, FeeType>((feeResult.data ?? []).map((f: any): [string, FeeType] => [String(f.id), { ...f, amount: Number(f.amount) }]));
      const paidByAssignment = new Map<string, number>();
      for (const p of paymentResult.data ?? []) paidByAssignment.set(String(p.student_fee_assignment_id), (paidByAssignment.get(String(p.student_fee_assignment_id)) || 0) + Number(p.amount_paid || 0));
      const assignmentRows: FeeAssignment[] = (assignmentResult.data ?? []).map((a: any) => {
        const student = studentById.get(String(a.student_id));
        const fee = feeById.get(String(a.fee_type_id));
        return { ...a, amount_due: Number(a.amount_due), paid: paidByAssignment.get(String(a.id)) || 0, studentName: student?.name || "Student", admissionNumber: student?.admission_number || "", feeName: fee?.name || "School fee" };
      });
      const paymentById = new Map<string, any>((paymentResult.data ?? []).map((p: any) => [String(p.id), p]));
      const feeByAssignment = new Map<string, FeeAssignment>(assignmentRows.map((a) => [a.id, a]));
      const paymentRows: PaymentRow[] = (receiptResult.data ?? []).map((r: any) => {
        const payment = paymentById.get(String(r.payment_id));
        const assignment = payment ? feeByAssignment.get(String(payment.student_fee_assignment_id)) : null;
        const student = studentById.get(String(r.issued_to_student_id));
        return { id: String(r.id), receipt_number: String(r.receipt_number), studentName: student?.name || "Student", admissionNumber: student?.admission_number || "", amount: Number(r.amount), payment_method: String(r.payment_method || "Payment"), payment_date: String(r.receipt_date), feeName: assignment?.feeName || "School fee", description: String(r.description || "") };
      });
      setFeeTypes((feeResult.data ?? []).map((f: any) => ({ ...f, amount: Number(f.amount) })));
      setStudents(studentRows);
      setSessions((sessionResult.data ?? []) as SessionOption[]);
      setAssignments(assignmentRows);
      setPayments(paymentRows);
      if (sessionResult.data?.length) setAssignForm((v) => v.academic_session_id ? v : ({ ...v, academic_session_id: String(sessionResult.data[0].id) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fee records could not be loaded.");
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const selectedFee = feeTypes.find((fee) => fee.id === assignForm.fee_type_id);
  const selectedAssignment = assignments.find((item) => item.id === paymentForm.assignment_id);
  const balanceFor = (item: FeeAssignment) => Math.max(0, item.amount_due - item.paid);
  const totalOutstanding = useMemo(() => assignments.reduce((sum, item) => sum + balanceFor(item), 0), [assignments]);

  async function createFeeType() {
    setSaving(true); setError(""); setNotice("");
    try {
      const amount = Number(feeForm.amount);
      if (!feeForm.name.trim() || !Number.isFinite(amount) || amount <= 0) throw new Error("Enter a fee name and a valid amount greater than zero.");
      const db = getSupabaseClient() as any;
      const result = await db.from("fee_types").insert({ school_id: schoolId, name: feeForm.name.trim(), description: feeForm.description.trim() || null, amount, is_active: true });
      if (result.error) throw result.error;
      setFeeForm({ name: "", amount: "", description: "" });
      setNotice("Fee type created. You can now assign it to a learner.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Fee type could not be created."); }
    finally { setSaving(false); }
  }

  async function assignFee() {
    setSaving(true); setError(""); setNotice("");
    try {
      const fee = feeTypes.find((item) => item.id === assignForm.fee_type_id);
      const student = students.find((item) => item.id === assignForm.student_id);
      const session = sessions.find((item) => item.id === assignForm.academic_session_id);
      const amount = Number(assignForm.amount_due || fee?.amount);
      if (!fee || !student || !session || !Number.isFinite(amount) || amount <= 0) throw new Error("Select a fee type, learner, academic session and valid amount.");
      const db = getSupabaseClient() as any;
      const duplicate = await db.from("student_fee_assignments").select("id").eq("school_id", schoolId)
        .eq("student_id", student.id).eq("fee_type_id", fee.id).eq("academic_session_id", session.id).limit(1);
      if (duplicate.error) throw duplicate.error;
      if (duplicate.data?.length) throw new Error("This fee has already been assigned to this learner for the selected academic session.");
      const inserted = await db.from("student_fee_assignments").insert({
        school_id: schoolId, student_id: student.id, fee_type_id: fee.id,
        academic_session_id: session.id, amount_due: amount,
        due_date: assignForm.due_date || null, status: "unpaid",
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      const links = await db.from("parent_student_portal_access").select("parent_guardian_id").eq("school_id", schoolId).eq("student_id", student.id).eq("is_active", true);
      let visibilityNotice = "Parent visibility was updated where an active parent-child link exists.";
      if (links.error) {
        visibilityNotice = "The fee was saved, but parent visibility could not be checked: " + links.error.message;
      } else if (links.data?.length) {
        const views = links.data.map((link: any) => ({ school_id: schoolId, parent_guardian_id: link.parent_guardian_id, student_id: student.id, student_fee_assignment_id: inserted.data.id, can_view: true }));
        const viewResult = await db.from("parent_fee_portal_views").upsert(views, { onConflict: "parent_guardian_id,student_fee_assignment_id" });
        if (viewResult.error) visibilityNotice = "Parent visibility could not be updated: " + viewResult.error.message;
      } else {
        visibilityNotice = "No active parent-child portal link exists yet, so the fee will not appear in a parent dashboard until a parent link is activated.";
      }
      setAssignForm((v) => ({ ...v, fee_type_id: "", student_id: "", amount_due: "", due_date: "" }));
      setNotice("Fee successfully assigned to " + student.name + ". " + visibilityNotice);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Fee could not be assigned."); }
    finally { setSaving(false); }
  }

  async function recordPayment() {
    setSaving(true); setError(""); setNotice("");
    try {
      const assignment = assignments.find((item) => item.id === paymentForm.assignment_id);
      const amount = Number(paymentForm.amount);
      if (!assignment || !Number.isFinite(amount) || amount <= 0) throw new Error("Select an outstanding fee and enter a valid payment amount.");
      if (amount > balanceFor(assignment) + 0.001) throw new Error("The payment cannot exceed the outstanding balance of " + money(balanceFor(assignment)) + ".");
      const db = getSupabaseClient() as any;
      const receiptNumber = "RESA-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + crypto.randomUUID().slice(0,8).toUpperCase();
      const payment = await db.from("student_fee_payments").insert({
        school_id: schoolId, student_fee_assignment_id: assignment.id, student_id: assignment.student_id,
        amount_paid: amount, payment_date: new Date().toISOString().slice(0,10),
        payment_method: paymentForm.payment_method, reference_number: paymentForm.reference_number.trim() || null,
        remarks: paymentForm.remarks.trim() || null, receipt_number: receiptNumber,
      }).select("id").single();
      if (payment.error) throw payment.error;
      const receipt = await db.from("student_payment_receipts").insert({
        school_id: schoolId, payment_id: payment.data.id, receipt_number: receiptNumber,
        receipt_date: new Date().toISOString().slice(0,10), issued_to_student_id: assignment.student_id,
        amount, payment_method: paymentForm.payment_method, description: assignment.feeName,
        issued_by: userId,
      });
      if (receipt.error) {
        const rollback = await db.from("student_fee_payments").delete().eq("id", payment.data.id).eq("school_id", schoolId);
        if (rollback.error) {
          throw new Error("Receipt issuance failed, and the payment record could not be rolled back. Do not record this payment again. Payment reference: " + payment.data.id + ". Ask the administrator to reconcile it. Receipt error: " + receipt.error.message + "; rollback error: " + rollback.error.message);
        }
        throw new Error("Payment was rolled back because the receipt could not be issued: " + receipt.error.message);
      }
      const newPaid = assignment.paid + amount;
      const statusUpdate = await db.from("student_fee_assignments").update({ status: newPaid >= assignment.amount_due ? "paid" : "partial" }).eq("id", assignment.id).eq("school_id", schoolId);
      const row: PaymentRow = { id: payment.data.id, receipt_number: receiptNumber, studentName: assignment.studentName, admissionNumber: assignment.admissionNumber, amount, payment_method: paymentForm.payment_method, payment_date: new Date().toISOString().slice(0,10), feeName: assignment.feeName, description: paymentForm.remarks };
      setPrintedReceipt(row);
      setPaymentForm({ assignment_id: "", amount: "", payment_method: "cash", reference_number: "", remarks: "" });
      setNotice("Payment recorded and receipt " + receiptNumber + " issued. " + (statusUpdate.error ? "The payment is saved, but the fee balance status could not be refreshed; refresh the register and reconcile before recording another payment. " + statusUpdate.error.message + " " : "") + "This records a payment already received by the school; it does not process online checkout.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment could not be recorded."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-emerald-950 text-white"><div className="mx-auto max-w-7xl px-4 py-5">
      <Link href="/school-services" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-100"><ArrowLeft size={16}/> Back to school services</Link>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-emerald-200">RESA · Administration</p><h1 className="text-2xl font-extrabold sm:text-3xl">Fees & Payments</h1><p className="mt-2 text-sm text-emerald-100">Create fee types, assign charges, record verified payments and issue receipts.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Refresh</button></div>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Important:</strong> This page records payments that the school has already verified. It does not accept card or bank payments online. Never enter a payment until Finance has confirmed that funds were actually received.</div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {printedReceipt && <section className="rounded-2xl border-2 border-emerald-900 bg-white p-5 print:mb-0 print:border-black" id="resa-fee-receipt">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">RHEMA EXPLOITS SCIENCE ACADEMY INT'L</p><h2 className="mt-1 text-xl font-extrabold">Payment receipt</h2><p className="mt-1 text-sm text-slate-600">Receipt no: {printedReceipt.receipt_number}</p></div><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-bold text-white print:hidden"><Printer size={16}/> Print receipt</button></div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><strong>Student:</strong> {printedReceipt.studentName}</p><p><strong>Admission no:</strong> {printedReceipt.admissionNumber}</p><p><strong>Fee:</strong> {printedReceipt.feeName}</p><p><strong>Date:</strong> {printedReceipt.payment_date}</p><p><strong>Payment method:</strong> {printedReceipt.payment_method}</p><p><strong>Amount received:</strong> {money(printedReceipt.amount)}</p></div>
        {printedReceipt.description && <p className="mt-3 text-sm"><strong>Remarks:</strong> {printedReceipt.description}</p>}
        <p className="mt-5 border-t pt-3 text-xs text-slate-500">Keep this receipt for your records. RESA Finance should verify all real payments before issuing receipts.</p>
      </section>}
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-extrabold"><PlusCircle size={18}/> Create fee type</h2><div className="mt-3 space-y-3"><label className="block text-sm font-semibold">Fee name<input value={feeForm.name} onChange={e=>setFeeForm(v=>({...v,name:e.target.value}))} placeholder="e.g. Tuition fee" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Standard amount (₦)<input type="number" min="0.01" step="0.01" value={feeForm.amount} onChange={e=>setFeeForm(v=>({...v,amount:e.target.value}))} placeholder="e.g. 50000" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Description<textarea value={feeForm.description} onChange={e=>setFeeForm(v=>({...v,description:e.target.value}))} rows={2} placeholder="What does this fee cover?" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><button disabled={saving} onClick={()=>void createFeeType()} className="w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save fee type</button></div></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-extrabold">Assign fee to a learner</h2><div className="mt-3 space-y-3"><label className="block text-sm font-semibold">Fee type<select value={assignForm.fee_type_id} onChange={e=>{const fee=feeTypes.find(f=>f.id===e.target.value);setAssignForm(v=>({...v,fee_type_id:e.target.value,amount_due:fee?String(fee.amount):v.amount_due}));}} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Select fee</option>{feeTypes.filter(f=>f.is_active).map(f=><option key={f.id} value={f.id}>{f.name} · {money(f.amount)}</option>)}</select></label><label className="block text-sm font-semibold">Student<select value={assignForm.student_id} onChange={e=>setAssignForm(v=>({...v,student_id:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Select learner</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.admission_number} · {s.className}</option>)}</select></label><label className="block text-sm font-semibold">Academic session<select value={assignForm.academic_session_id} onChange={e=>setAssignForm(v=>({...v,academic_session_id:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Select session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="block text-sm font-semibold">Amount due (₦)<input type="number" min="0.01" step="0.01" value={assignForm.amount_due} onChange={e=>setAssignForm(v=>({...v,amount_due:e.target.value}))} placeholder={selectedFee?String(selectedFee.amount):"Fee amount"} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Due date<input type="date" value={assignForm.due_date} onChange={e=>setAssignForm(v=>({...v,due_date:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><button disabled={saving} onClick={()=>void assignFee()} className="w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Assign fee</button></div></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-extrabold"><Wallet size={18}/> Record verified payment</h2><div className="mt-3 space-y-3"><label className="block text-sm font-semibold">Outstanding fee<select value={paymentForm.assignment_id} onChange={e=>setPaymentForm(v=>({...v,assignment_id:e.target.value,amount:""}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Select fee balance</option>{assignments.filter(a=>balanceFor(a)>0).map(a=><option key={a.id} value={a.id}>{a.studentName} · {a.feeName} · Balance {money(balanceFor(a))}</option>)}</select></label>{selectedAssignment&&<p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Outstanding: {money(balanceFor(selectedAssignment))}</p>}<label className="block text-sm font-semibold">Amount received (₦)<input type="number" min="0.01" step="0.01" max={selectedAssignment?balanceFor(selectedAssignment):undefined} value={paymentForm.amount} onChange={e=>setPaymentForm(v=>({...v,amount:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Payment method<select value={paymentForm.payment_method} onChange={e=>setPaymentForm(v=>({...v,payment_method:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="pos">POS</option><option value="other">Other verified method</option></select></label><label className="block text-sm font-semibold">Reference number (optional)<input value={paymentForm.reference_number} onChange={e=>setPaymentForm(v=>({...v,reference_number:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Remarks (optional)<textarea value={paymentForm.remarks} onChange={e=>setPaymentForm(v=>({...v,remarks:e.target.value}))} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label><button disabled={saving} onClick={()=>void recordPayment()} className="w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Record payment & issue receipt</button></div></article>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Fee register</h2><p className="text-sm text-slate-600">Outstanding balance across loaded student fee assignments: {money(totalOutstanding)}</p></div><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold print:hidden"><Printer size={16}/> Print fee register</button></div>{loading?<p className="mt-3 text-sm text-slate-500">Loading fees…</p>:assignments.length===0?<p className="mt-3 text-sm text-slate-500">No student fees have been assigned yet.</p>:<div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Fee</th><th className="px-3 py-3">Due</th><th className="px-3 py-3">Paid</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{assignments.map(a=><tr key={a.id} className="border-t"><td className="px-3 py-3"><p className="font-semibold">{a.studentName}</p><p className="text-xs text-slate-500">{a.admissionNumber}</p></td><td className="px-3 py-3">{a.feeName}</td><td className="px-3 py-3">{money(a.amount_due)}</td><td className="px-3 py-3">{money(a.paid)}</td><td className="px-3 py-3 font-bold">{money(balanceFor(a))}</td><td className="px-3 py-3">{balanceFor(a)<=0?"Paid":a.paid>0?"Part-paid":"Unpaid"}</td></tr>)}</tbody></table></div>}</section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-extrabold"><ReceiptText size={18}/> Issued receipts</h2>{payments.length===0?<p className="mt-3 text-sm text-slate-500">No receipts have been issued yet.</p>:<div className="mt-3 divide-y">{payments.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold">{p.receipt_number}</p><p className="text-slate-600">{p.studentName} · {p.feeName} · {p.payment_date}</p></div><div className="flex items-center gap-3"><span className="font-bold">{money(p.amount)}</span><button onClick={()=>setPrintedReceipt(p)} className="rounded-lg border px-3 py-2 text-xs font-bold">View / print</button></div></div>)}</div>}</section>
    </div>
  </main>;
}
