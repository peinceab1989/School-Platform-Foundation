import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
ArrowRight,
Facebook,
Menu,
X,
MessageCircle,
ExternalLink,
} from "lucide-react";
import type { ReactNode } from "react";
import { SchoolLogo } from "@/components/school-logo";

const FACEBOOK_URL = "https://www.facebook.com/share/1H2v8eruwR/";
const SCHOOL_EMAIL = "Resainternational2024@gmail.com";
const SCHOOL_PHONE = "+2348058422691";
const SCHOOL_WHATSAPP = "https://wa.me/2347010945774";
const PORTAL_PATH = "/portal";

const JETAB_WHATSAPP =
"https://wa.me/2347054078988?text=Hello%20JETAB%20TECH%2C%20I%20would%20like%20to%20request%20a%20service%20or%20training.";

const pages = [
{ href: "/about", label: "About RESA" },
{ href: "/academics", label: "Academics & Development" },
{ href: "/innovation-technology", label: "Innovation & Technology" },
{
href: "/practical-skills",
label: "Practical Skills & Entrepreneurship",
},
{ href: "/wisdom-inspiration", label: "Wisdom & Inspiration" },
{ href: "/activities-gallery", label: "School Activities & Gallery" },
{ href: "/admissions", label: "Admissions" },
{ href: "/contact", label: "Contact Us" },
];

const jetabServices = [
"Website design and development",
"School portals and management systems",
"Mobile and web applications",
"Business software and automation",
"Graphics design and brand identity",
"Computer repairs and maintenance",
"IT support and networking",
"Robotics, coding and digital skills",
"Specialised ICT training and consultancy",
];

function BackToTopOnNavigation() {
const [location] = useLocation();

useEffect(() => {
window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, [location]);

return null;
}

export function PublicHeader() {
const [open, setOpen] = useState(false);
const [location] = useLocation();

useEffect(() => {
setOpen(false);
}, [location]);

return (
<header className="sticky top-0 z-50 border-b border-[#e7e1d3] bg-[#fbfaf5]/95 shadow-[0_4px_20px_rgba(16,59,45,0.06)] backdrop-blur-xl">
<div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
<Link
href="/"
onClick={() => setOpen(false)}
aria-label="RESA International home"
className="flex min-w-0 items-center gap-3"
>
<SchoolLogo
alt="RESA crest"
className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[#d8b765]/60 shadow-md"
testId="img-resa-logo"
/>

      <span className="min-w-0 leading-tight">
        <span className="block font-black tracking-[.04em] text-[#215641]">
          RHEMA EXPLOITS
        </span>
        <span className="block text-[10px] font-semibold tracking-[.08em] text-[#797869] sm:text-xs">
          SCIENCE ACADEMY INTERNATIONAL
        </span>
        <span className="mt-1 hidden text-[9px] font-bold tracking-[.16em] text-[#a17c32] sm:block">
          PASSION • SKILLS • EXCELLENT SPIRIT
        </span>
      </span>
    </Link>

    <nav
      aria-label="Main navigation"
      className="hidden items-center gap-x-3 gap-y-2 xl:flex"
    >
      {pages.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          aria-current={location === page.href ? "page" : undefined}
          className={`whitespace-nowrap text-xs font-bold transition-colors hover:text-[#a17c32] 2xl:text-sm ${
            location === page.href
              ? "text-[#1e6845]"
              : "text-[#526258]"
          }`}
        >
          {page.label}
        </Link>
      ))}

      <Link
        href={PORTAL_PATH}
        className="ml-1 inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#245b40] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_#153c2b] transition hover:-translate-y-0.5 hover:bg-[#17462f] hover:shadow-[0_5px_0_#153c2b]"
      >
        Portal Login <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </nav>

    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#ded8ca] bg-white text-[#245b40] shadow-sm transition hover:bg-[#f0eee4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40] xl:hidden"
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={open}
      aria-controls="resa-mobile-navigation"
    >
      {open ? (
        <X aria-hidden="true" />
      ) : (
        <Menu aria-hidden="true" />
      )}
    </button>
  </div>

  {open && (
    <nav
      id="resa-mobile-navigation"
      aria-label="Mobile navigation"
      className="border-t border-[#e7e1d3] bg-[#fbfaf5] px-4 py-4 shadow-lg xl:hidden"
    >
      <div className="mx-auto grid max-w-7xl gap-2 sm:grid-cols-2">
        {pages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            onClick={() => setOpen(false)}
            aria-current={location === page.href ? "page" : undefined}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              location === page.href
                ? "border border-[#d8b765]/50 bg-[#eaf1e9] text-[#1e6845]"
                : "border border-transparent text-[#526258] hover:bg-[#f0eee4]"
            }`}
          >
            {page.label}
          </Link>
        ))}

        <Link
          href={PORTAL_PATH}
          onClick={() => setOpen(false)}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#245b40] px-4 py-3.5 text-center text-sm font-bold text-white shadow-[0_4px_0_#153c2b] transition hover:bg-[#17462f]"
        >
          Portal Login <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )}
</header>

);
}

function JetabServicePopup({
onClose,
}: {
onClose: () => void;
}) {
useEffect(() => {
function handleEscape(event: KeyboardEvent) {
if (event.key === "Escape") onClose();
}

window.addEventListener("keydown", handleEscape);
return () => window.removeEventListener("keydown", handleEscape);

}, [onClose]);

return (
<div
className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102d22]/65 p-4 backdrop-blur-sm"
onClick={onClose}
role="presentation"
>
<section
role="dialog"
aria-modal="true"
aria-labelledby="jetab-service-title"
className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e4c879]/60 bg-[#fbfaf5] p-5 shadow-2xl sm:p-7"
onClick={(event) => event.stopPropagation()}
>
<button
type="button"
onClick={onClose}
aria-label="Close services"
className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e7e1d3] bg-white text-[#245b40] transition hover:bg-[#eaf1e9]"
>
<X size={18} aria-hidden="true" />
</button>

    <p className="text-xs font-black uppercase tracking-[.2em] text-[#a17c32]">
      JETAB TECH
    </p>

    <h2
      id="jetab-service-title"
      className="mt-2 pr-8 text-xl font-black text-[#215641] sm:text-2xl"
    >
      Request a Service or Training
    </h2>

    <p className="mt-2 text-sm leading-6 text-[#526258]">
      We provide technology solutions, creative services and practical
      digital skills training for schools, businesses and individuals.
    </p>

    <ul className="mt-5 space-y-3">
      {jetabServices.map((service) => (
        <li
          key={service}
          className="flex items-start gap-3 text-sm leading-5 text-[#34483b]"
        >
          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e7efe5] text-[#245b40]">
            <ArrowRight size={12} aria-hidden="true" />
          </span>
          <span>{service}</span>
        </li>
      ))}
    </ul>

    <a
      href={JETAB_WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16864a] px-4 py-3.5 text-sm font-bold text-white shadow-[0_4px_0_#106536] transition hover:-translate-y-0.5 hover:bg-[#116f3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16864a] focus-visible:ring-offset-2"
    >
      <MessageCircle size={18} aria-hidden="true" />
      Chat with JETAB TECH on WhatsApp
      <ExternalLink size={14} aria-hidden="true" />
    </a>

    <p className="mt-3 text-center text-xs text-[#797869]">
      Tap above to discuss your project or training needs.
    </p>
  </section>
</div>

);
}

export function PublicFooter() {
const [servicesOpen, setServicesOpen] = useState(false);

return (
<>
<footer className="bg-[#103b2d] text-[#f7f3e7]">
<div className="mx-auto grid max-w-7xl gap-7 px-5 py-8 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
<div>
<p className="text-sm font-black tracking-[.1em] text-[#e4c879]">
RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL
</p>

        <p className="mt-3 max-w-sm text-sm leading-7 text-[#d6dfd1]">
          Passion, Skills and Excellent Spirit. A science academy in
          Benin City supporting academic learning, technology, practical
          skills, creativity and character development.
        </p>

        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit RESA on Facebook (opens in a new tab)"
          title="Visit RESA on Facebook"
          className="mt-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-white/5 text-white transition hover:border-[#e4c879] hover:text-[#e4c879] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c879]"
        >
          <Facebook size={18} aria-hidden="true" />
        </a>
        <p className="mt-1 text-xs text-[#d6dfd1]">
          Follow RESA on Facebook.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-black text-[#e4c879]">
          Explore RESA
        </h2>

        <div className="mt-3 grid gap-2">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="w-fit text-sm text-[#d6dfd1] transition hover:text-[#e4c879]"
            >
              {page.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-black text-[#e4c879]">
          Contact RESA
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#d6dfd1]">
          1, Smiling George Way, Behind Mat Ice, Opposite Winners&apos;
          Chapel, Sapele Road, Benin City, Edo State, Nigeria.
        </p>

        <a
          href={`tel:${SCHOOL_PHONE}`}
          className="mt-2 block w-fit text-sm text-[#e4c879] transition hover:text-white"
        >
          +234 805 842 2691
        </a>

        <a
          href={SCHOOL_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 text-sm text-[#d6dfd1] transition hover:text-[#e4c879]"
        >
          <MessageCircle size={15} aria-hidden="true" />
          RESA WhatsApp
        </a>

        <a
          href={`mailto:${SCHOOL_EMAIL}`}
          className="mt-2 block break-all text-sm text-[#e4c879] transition hover:text-white"
        >
          {SCHOOL_EMAIL}
        </a>

        <Link
          href={PORTAL_PATH}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:border-[#e4c879] hover:text-[#e4c879]"
        >
          Portal Login <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>

    <div className="border-t border-white/15 px-4 py-4 text-center">
      <p className="text-xs leading-6 text-[#c3d0c5]">
        © {new Date().getFullYear()} Rhema Exploits Science Academy
        International. All rights reserved.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs">
        <span className="text-[#c3d0c5]">
          Designed and Powered by
        </span>
        <span className="font-black tracking-[.12em] text-[#e4c879]">
          JETAB TECH
        </span>

        <a
          href={JETAB_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with JETAB TECH on WhatsApp"
          title="Chat with JETAB TECH on WhatsApp"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#16864a] text-white transition hover:scale-110 hover:bg-[#116f3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c879]"
        >
          <MessageCircle size={15} aria-hidden="true" />
        </a>

        <span className="text-white/30">|</span>

        <button
          type="button"
          onClick={() => setServicesOpen(true)}
          className="font-semibold text-[#e4c879] underline decoration-[#e4c879]/50 underline-offset-4 transition hover:text-white hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c879]"
        >
          Request a Service or Training
        </button>
      </div>
    </div>
  </footer>

  {servicesOpen && (
    <JetabServicePopup onClose={() => setServicesOpen(false)} />
  )}
</>

);
}

export function PublicLayout({ children }: { children: ReactNode }) {
return (
<div className="min-h-[100dvh] bg-[#fbfaf5] text-[#283b30]">
<BackToTopOnNavigation />
<PublicHeader />
<main>{children}</main>
<PublicFooter />
</div>
);
}