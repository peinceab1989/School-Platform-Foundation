import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { SchoolLogo } from "@/components/school-logo";

const pages = [
  { href: "/innovation-technology", label: "Innovation & technology" },
  { href: "/practical-skills", label: "Practical skills" },
  { href: "/wisdom-inspiration", label: "Wisdom & inspiration" },
  { href: "/activities-gallery", label: "Activities & gallery" },
  { href: "/admissions", label: "Admissions" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const isHome = location === "/";
  const anchor = (id: string) =>
    isHome ? `#${id}` : `${import.meta.env.BASE_URL}#${id}`;

  return (
    <header className="sticky top-0 z-50 border-b border-[#e7e1d3] bg-[#fbfaf5]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" data-testid="link-home-brand" className="flex min-w-0 items-center gap-3">
          <SchoolLogo alt="RESA crest" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#ddd5c3]" testId="img-resa-logo" />
          <span className="min-w-0 leading-tight">
            <span className="block font-bold tracking-[.04em] text-[#215641]">RHEMA EXPLOITS</span>
            <span className="block text-[10px] font-semibold tracking-[.13em] text-[#797869] sm:text-xs">SCIENCE ACADEMY INTERNATIONAL</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-4 2xl:flex">
          <a href={anchor("about")} className="text-sm font-semibold text-[#526258] hover:text-[#1e6845]" data-testid="link-nav-about">About</a>
          <a href={anchor("academics")} className="text-sm font-semibold text-[#526258] hover:text-[#1e6845]" data-testid="link-nav-academics">Academics</a>
          {pages.map((page) => <Link key={page.href} href={page.href} className="text-sm font-semibold text-[#526258] hover:text-[#1e6845]" data-testid={`link-nav-${page.href.slice(1)}`}>{page.label}</Link>)}
          <Link href="/dashboard" className="rounded-full bg-[#245b40] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17462f]" data-testid="link-portal-login">Portal login</Link>
        </nav>
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#ded8ca] text-[#245b40] 2xl:hidden" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} data-testid="button-mobile-menu">
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {open && <nav aria-label="Mobile navigation" className="border-t border-[#e7e1d3] bg-[#fbfaf5] px-4 py-3 2xl:hidden">
        <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
          <a href={anchor("about")} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#526258] hover:bg-[#f0eee4]" data-testid="mobile-nav-about">About</a>
          <a href={anchor("academics")} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#526258] hover:bg-[#f0eee4]" data-testid="mobile-nav-academics">Academics</a>
          {pages.map((page) => <Link key={page.href} href={page.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#526258] hover:bg-[#f0eee4]" data-testid={`mobile-nav-${page.href.slice(1)}`}>{page.label}</Link>)}
          <Link href="/dashboard" onClick={() => setOpen(false)} className="mt-1 rounded-lg bg-[#245b40] px-3 py-3 text-center text-sm font-bold text-white" data-testid="mobile-nav-portal">Portal login</Link>
        </div>
      </nav>}
    </header>
  );
}

export function PublicFooter() {
  return <footer className="bg-[#1f4836] text-[#f7f3e7]">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
      <div>
        <p className="text-sm font-bold tracking-[.12em] text-[#e4c879]">RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL</p>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#d6dfd1]">Passion, Skills and Excellent Spirit. A science academy in Benin City supporting academic learning, technology, practical skills, creativity and character development.</p>
      </div>
      <div>
        <h2 className="text-sm font-bold">Explore RESA</h2>
        <div className="mt-3 grid gap-2">
          {pages.map(page => <Link key={page.href} href={page.href} className="w-fit text-sm text-[#d6dfd1] hover:text-white" data-testid={`footer-link-${page.href.slice(1)}`}>{page.label}</Link>)}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold">Get in touch</h2>
        <p className="mt-3 text-sm leading-6 text-[#d6dfd1]">1, Smiling George Way, Opposite Winners&apos; Chapel,<br />Behind Matice, Sapele Road, Benin City.</p>
        <a href="tel:+2348058422691" className="mt-2 block w-fit text-sm text-[#e4c879] hover:text-white" data-testid="footer-phone">+234 805 842 2691</a>
        <a href="mailto:rhemaexploitsacademy@gmail.com" className="mt-1 block break-all text-sm text-[#e4c879] hover:text-white" data-testid="footer-email">rhemaexploitsacademy@gmail.com</a>
        <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white" data-testid="footer-portal">Portal login <ArrowRight size={15} /></Link>
      </div>
    </div>
    <div className="border-t border-white/15 px-5 py-4 text-center text-xs text-[#c3d0c5]">© {new Date().getFullYear()} Rhema Exploits Science Academy International. All rights reserved.</div>
  </footer>;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!targetId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  return <div className="min-h-[100dvh] bg-[#fbfaf5] text-[#283b30]"><PublicHeader />{children}<PublicFooter /></div>;
}
