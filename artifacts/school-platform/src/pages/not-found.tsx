import { Link } from "wouter";
import { ArrowLeft, BookOpen, Home, School } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4e9] px-4 py-10 text-[#183d2b]">
      <section className="w-full max-w-xl rounded-3xl border border-[#d8d0b6] bg-white p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f0e8] text-[#1d6845]">
          <School className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a7628]">
          RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL
        </p>
        <p className="mt-5 text-6xl font-black tracking-tight text-[#1d6845]">404</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">This page could not be found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          The link may be outdated or the address may have been entered incorrectly. Choose a safe route below to continue using the RESA website.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d6845] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#155337]">
            <Home className="h-4 w-4" aria-hidden="true" /> School homepage
          </Link>
          <Link href="/admissions" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8d0b6] bg-[#fffdf7] px-5 py-3 text-sm font-bold text-[#183d2b] transition hover:bg-[#f5f0df]">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Admissions
          </Link>
          <button type="button" onClick={() => window.history.back()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Go back
          </button>
        </div>
      </section>
    </main>
  );
}
