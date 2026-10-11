
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ArrowRight, Facebook, Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { SchoolLogo } from "@/components/school-logo";

const FACEBOOK_URL = "https://www.facebook.com/share/1H2v8eruwR/";

const pages = [
  { href: "/about", label: "About RESA" },
  { href: "/academics", label: "Academics" },
  { href: "/innovation-technology", label: "Innovation & Technology" },
  { href: "/practical-skills", label: "Practical Skills" },
  { href: "/wisdom-inspiration", label: "Wisdom & Inspiration" },
  { href: "/activities-gallery", label: "Activities & Gallery" },
  { href: "/admissions", label: "Admissions" },
  { href: "/contact", label: "Contact Us" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#e7e1d3] bg-[#fbfaf5]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex min-w-0 items-center gap-3"
        >
          <SchoolLogo
            alt="RESA crest"
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#ddd5c3]"
            testId="img-resa-logo"
          />
          <span className="min-w-0 leading-tight">
            <span className="block font-bold tracking-[.04em] text-[#215641]">
              RHEMA EXPLOITS
            </span>
            <span className="block text-[10px] font-semibold tracking-[.08em] text-[#797869] sm:text-xs">
              SCIENCE ACADEMY INTERNATIONAL
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-3 xl:flex"
        >
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="text-sm font-semibold text-[#526258] hover:text-[#1e6845]"
            >
              {page.label}
            </Link>
          ))}

          <Link
            href="/portal"
            className="rounded-full bg-[#245b40] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17462f]"
          >
            Portal Login
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#ded8ca] text-[#245b40] xl:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[#e7e1d3] bg-[#fbfaf5] px-4 py-3 xl:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-semibold text-[#526258] hover:bg-[#f0eee4]"
              >
                {page.label}
              </Link>
            ))}

            <Link
              href="/portal"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg bg-[#245b40] px-3 py-3 text-center text-sm font-bold text-white"
            >
              Portal Login
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-[#1f4836] text-[#f7f3e7]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="text-sm font-bold tracking-[.12em] text-[#e4c879]">
            RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL
          </p>

          <p className="mt-3 max-w-sm text-sm leading-6 text-[#d6dfd1]">
            Passion, Skills and Excellent Spirit. A science academy in Benin
            City supporting academic learning, technology, practical skills,
            creativity and character development.
          </p>

          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit RESA on Facebook"
            title="Visit RESA on Facebook"
            className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/10"
          >
            <Facebook size={20} />
          </a>

          <p className="mt-2 text-xs text-[#d6dfd1]">
            Follow RESA on Facebook.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold">Explore RESA</h2>
          <div className="mt-3 grid gap-2">
            {pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="w-fit text-sm text-[#d6dfd1] hover:text-white"
              >
                {page.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold">Get in touch</h2>

          <p className="mt-3 text-sm leading-6 text-[#d6dfd1]">
            1, Smiling George Way, Opposite Winners&apos; Chapel,
            Behind Matice, Sapele Road, Benin City.
          </p>

          <a
            href="tel:+2348058422691"
            className="mt-2 block w-fit text-sm text-[#e4c879] hover:text-white"
          >
            +234 805 842 2691
          </a>

          <a
            href="mailto:rhemaexploitsacademy@gmail.com"
            className="mt-1 block break-all text-sm text-[#e4c879] hover:text-white"
          >
            rhemaexploitsacademy@gmail.com
          </a>

          <Link
            href="/portal"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white"
          >
            Portal Login <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="border-t border-white/15 px-5 py-4 text-center text-xs text-[#c3d0c5]">
        © {new Date().getFullYear()} Rhema Exploits Science Academy
        International. All rights reserved.
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return (
    <div className="min-h-[100dvh] bg-[#fbfaf5] text-[#283b30]">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
