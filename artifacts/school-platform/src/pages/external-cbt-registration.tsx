import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ExternalCbtRegistrationPage() {
  const [form, setForm] = useState({ form_number: "", full_name: "", email: "", phone: "", date_of_birth: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ candidate_number: string; message: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setResult(null);
    if (form.form_number.trim().length < 8 || form.full_name.trim().length < 3 || !form.email.includes("@")) {
      setError("Enter your verified form number, full name and valid email address."); return;
    }
    setBusy(true);
    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke("resa-external-candidate-register", {
        body: { ...form, form_number: form.form_number.trim().toUpperCase(), full_name: form.full_name.trim(), email: form.email.trim().toLowerCase() },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || "Registration could not be completed.");
      setResult({ candidate_number: data.candidate_number, message: data.message });
      setForm({ form_number: "", full_name: "", email: "", phone: "", date_of_birth: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Registration could not be completed. Try again later."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-stone-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-2xl">
      <header className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">RESA · External CBT</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">External Candidate Registration</h1>
        <p className="mt-2 text-sm leading-6 text-emerald-100">Register with a school-verified CBT form number. Each verified form number can only be used once.</p>
      </header>
      <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
        {result ? <div className="text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={42}/><h2 className="mt-3 text-xl font-extrabold">Registration received</h2><p className="mt-2 text-sm text-slate-600">{result.message}</p><p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm">Your candidate number: <strong className="block text-xl tracking-wider text-emerald-950">{result.candidate_number}</strong></p><button onClick={()=>setResult(null)} className="mt-5 rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white">Register another candidate</button></div> : <form onSubmit={submit} className="space-y-4">
          {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          <label className="block text-sm font-semibold">Verified CBT form number<input required minLength={8} maxLength={40} autoCapitalize="characters" value={form.form_number} onChange={e=>setForm({...form,form_number:e.target.value.toUpperCase()})} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Enter the form number issued by RESA"/></label>
          <label className="block text-sm font-semibold">Candidate's full name<input required minLength={3} maxLength={180} value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="block text-sm font-semibold">Email address<input required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="block text-sm font-semibold">Phone number<input type="tel" maxLength={40} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="block text-sm font-semibold">Date of birth<input type="date" value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <button disabled={busy} className="w-full rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"Submitting registration…":"Submit registration"}</button>
        </form>}
      </section>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0"/> Registration does not grant immediate exam access. The school must approve your candidate record and assign an examination. Never share your password or form number with another person.</p>
      <p className="mt-5 text-center text-sm"><Link href="/portal" className="font-bold text-emerald-900">Return to RESA portal</Link></p>
      <footer className="py-5 text-center text-xs text-slate-500">Designed & Powered by JETAB TECH</footer>
    </div>
  </main>;
}
