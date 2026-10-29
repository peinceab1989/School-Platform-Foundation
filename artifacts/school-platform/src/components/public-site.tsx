import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  Facebook,
  Menu,
  MessageCircle,
  X,
} from "lucide-react";
import { SchoolLogo } from "@/components/school-logo";

const FACEBOOK_URL = "https://www.facebook.com/share/1H2v8eruwR/";
const SCHOOL_EMAIL = "Resainternational2024@gmail.com";
const SCHOOL_PHONE = "+2348058422691";
const SCHOOL_WHATSAPP = "https://wa.me/2347010945774?text=Hello%20RESA%20Customer%20Care%2C%20I%20need%20assistance.";
const PORTAL_PATH = "/portal-options";
const JETAB_WHATSAPP =
  "https://wa.me/2347054078988?text=Hello%20JETAB%20TECH%2C%20I%20would%20like%20to%20request%20a%20service%20or%20training.";

const primaryPages = [
  { href: "/about", label: "About" },
  { href: "/academics", label: "Academics" },
  { href: "/admissions", label: "Admissions" },
  { href: "/contact", label: "Contact" },
];

const explorePages = [
  { href: "/innovation-technology", label: "Innovation & Technology" },
  { href: "/practical-skills", label: "Practical Skills & Entrepreneurship" },
  { href: "/wisdom-inspiration", label: "Wisdom & Inspiration" },
  { href: "/activities-gallery", label: "School Activities & Gallery" },
];

const allPages = [...primaryPages, ...explorePages];

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
  const isExplorePage = explorePages.some((page) => page.href === location);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  const linkClass = (href: string) =>
    `rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40] focus-visible:ring-offset-2 ${
      location === href
        ? "bg-[#eaf1e9] text-[#1e6845]"
        : "text-[#526258] hover:bg-white hover:text-[#1e6845]"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-[#e7e1d3] bg-[#fbfaf5]/95 shadow-[0_3px_18px_rgba(16,59,45,0.05)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          aria-label="RESA International home"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40] focus-visible:ring-offset-4"
        >
          <SchoolLogo
            alt="Official RESA crest"
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#d8b765]/60 sm:h-12 sm:w-12"
            testId="img-resa-logo"
          />
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-black tracking-[.035em] text-[#215641] sm:text-base">
              RHEMA EXPLOITS
            </span>
            <span className="mt-0.5 block text-[9px] font-semibold tracking-[.065em] text-[#797869] sm:text-[10px]">
              SCIENCE ACADEMY INTERNATIONAL
            </span>
            <span className="mt-1 hidden text-[9px] font-bold tracking-[.12em] text-[#a17c32] sm:block">
              PASSION • SKILLS • EXCELLENT SPIRIT
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          <Link href="/" aria-current={location === "/" ? "page" : undefined} className={linkClass("/")}>
            Home
          </Link>
          {primaryPages.map((page) => (
            <Link key={page.href} href={page.href} aria-current={location === page.href ? "page" : undefined} className={linkClass(page.href)}>
              {page.label}
            </Link>
          ))}
          <details className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40] ${
                isExplorePage ? "bg-[#eaf1e9] text-[#1e6845]" : "text-[#526258]"
              }`}
            >
              Explore <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[#e7e1d3] bg-white p-2 shadow-xl">
              {explorePages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  onClick={(event) => {
                    const menu = event.currentTarget.closest("details");
                    if (menu) menu.open = false;
                  }}
                  aria-current={location === page.href ? "page" : undefined}
                  className="block rounded-xl px-3 py-3 text-sm font-medium text-[#526258] transition hover:bg-[#f3f5ef] hover:text-[#1e6845] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40]"
                >
                  {page.label}
                </Link>
              ))}
            </div>
          </details>
          <Link
            href={PORTAL_PATH}
            className="ml-2 inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#245b40] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#17462f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40] focus-visible:ring-offset-2"
          >
            School Portal <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>

        <Link
          href={PORTAL_PATH}
          className="hidden shrink-0 items-center gap-2 rounded-xl bg-[#245b40] px-3 py-2.5 text-xs font-bold text-white sm:inline-flex lg:hidden"
        >
          Portal <ArrowRight size={14} aria-hidden="true" />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#ded8ca] bg-white text-[#245b40] shadow-sm transition hover:bg-[#f0eee4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245b40] lg:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="resa-mobile-navigation"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          id="resa-mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-[#e7e1d3] bg-[#fbfaf5] px-4 py-4 shadow-lg lg:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1.5 sm:grid-cols-2">
            {[{ href: "/", label: "Home" }, ...allPages].map((page) => (
              <Link
                key={page.href}
                href={page.href}
                onClick={() => setOpen(false)}
                aria-current={location === page.href ? "page" : undefined}
                className={linkClass(page.href) + " block px-4 py-3"}
              >
                {page.label}
              </Link>
            ))}
            <Link
              href={PORTAL_PATH}
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#245b40] px-4 py-3.5 text-center text-sm font-bold text-white sm:col-span-2"
            >
              Open School Portal <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-[#103b2d] text-[#f7f3e7]">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_.8fr_1fr] md:py-14">
        <div>
          <div className="flex items-center gap-3">
            <SchoolLogo
              alt="RESA crest"
              className="h-12 w-12 rounded-full border border-white/20 object-cover"
              testId="img-resa-footer-logo"
            />
            <div>
              <p className="text-sm font-black tracking-[.06em] text-[#e4c879]">
                RHEMA EXPLOITS
              </p>
              <p className="mt-0.5 text-[10px] font-semibold tracking-[.06em] text-white/75">
                SCIENCE ACADEMY INTERNATIONAL
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#d6dfd1]">
            Passion • Skills • Excellent Spirit. A science-focused learning community in Benin City developing academic knowledge, practical ability, digital confidence and character.
          </p>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit RESA on Facebook (opens in a new tab)"
            className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/5 text-white transition hover:border-[#e4c879] hover:text-[#e4c879] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c879]"
          >
            <Facebook size={18} aria-hidden="true" />
          </a>
        </div>

        <div>
          <h2 className="text-sm font-bold text-[#e4c879]">Explore RESA</h2>
          <div className="mt-4 grid gap-3">
            {[
              { href: "/about", label: "About the School" },
              { href: "/academics", label: "Academics" },
              { href: "/innovation-technology", label: "Innovation & Technology" },
              { href: "/activities-gallery", label: "School Activities" },
              { href: "/admissions", label: "Admissions" },
            ].map((page) => (
              <Link key={page.href} href={page.href} className="w-fit text-sm text-[#d6dfd1] transition hover:text-[#e4c879] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c879]">
                {page.label}
              </Link>
            ))}
          </div>
          <Link
            href={PORTAL_PATH}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-bold text-white transition hover:border-[#e4c879] hover:text-[#e4c879]"
          >
            Portal Login <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div>
          <h2 className="text-sm font-bold text-[#e4c879]">Contact RESA</h2>
          <address className="mt-4 not-italic text-sm leading-7 text-[#d6dfd1]">
            1, Smiling George Way, Behind Mat Ice, Opp. Winners’ Chapel, Sapele Road, Benin City, Edo State, Nigeria.
          </address>
          <a href={`tel:${SCHOOL_PHONE}`} className="mt-3 block w-fit text-sm font-semibold text-[#e4c879] hover:text-white">
            +234 805 842 2691
          </a>
          <a href={SCHOOL_WHATSAPP} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-[#d6dfd1] transition hover:text-[#e4c879]">
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp the school
          </a>
          <a href={`mailto:${SCHOOL_EMAIL}`} className="mt-3 block break-words text-sm text-[#e4c879] transition hover:text-white">
            {SCHOOL_EMAIL}
          </a>
        </div>
      </div>

      <div className="border-t border-white/15 px-4 py-5 text-center">
        <p className="text-xs leading-6 text-[#c3d0c5]">
          © {new Date().getFullYear()} Rhema Exploits Science Academy International. All rights reserved.
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-[#c3d0c5]">
          <span>Designed &amp; Powered by</span>
          <a
            href={JETAB_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-black tracking-[.12em] text-[#e4c879] underline decoration-[#e4c879]/40 underline-offset-4 transition hover:text-white"
          >
            JETAB TECH <MessageCircle size={13} aria-hidden="true" />
          </a>
        </p>
      </div>
    </footer>
  );
}

function FloatingCustomerCare() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ offsetX: number; offsetY: number; moved: boolean; startX: number; startY: number } | null>(null);
  const suppressClick = useRef(false);

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
    if (!drag.current.moved) return;
    const width = 86;
    const height = 42;
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - drag.current.offsetX)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - drag.current.offsetY)),
    });
  }

  function endDrag() {
    suppressClick.current = Boolean(drag.current?.moved);
    drag.current = null;
  }

  return (
    <>
    <style>{`@keyframes resaCarePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } } @media (prefers-reduced-motion: reduce) { .resa-care-pulse { animation: none !important; } }`}</style>
    <div className="z-[70]" style={position ? { position: "fixed", left: position.left, top: position.top } : { position: "fixed", right: 16, bottom: 92 }}>
      {open && (
        <div
          role="dialog"
          aria-label="RESA customer care options"
          className="absolute bottom-[50px] right-0 w-[min(280px,calc(100vw-24px))] rounded-2xl border border-[#e7e1d3] bg-[#fffdf7] p-4 text-[#263b2f] shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#174b35]">RESA Customer Care</p>
              <p className="mt-1 text-xs leading-5 text-[#657066]">Choose how you would like to contact us.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close customer care" className="rounded-lg p-1 text-[#526258] hover:bg-[#edf2e9]">
              <X size={17} />
            </button>
          </div>
          <Link href="/school-communication" onClick={() => setOpen(false)} className="mt-4 flex items-center gap-3 rounded-xl bg-[#174b35] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#103b2d]">
            <MessageCircle size={18} /> Chat with admin
          </Link>
          <a href={SCHOOL_WHATSAPP} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-3 rounded-xl border border-[#d7dfd3] bg-[#edf4e9] px-3 py-3 text-sm font-bold text-[#20553d] transition hover:bg-[#e0ebdc]">
            <MessageCircle size={18} /> WhatsApp RESA
          </a>
          <p className="mt-3 text-[11px] leading-4 text-[#6b756c]">WhatsApp: 0701 094 5774</p>
        </div>
      )}
      <button
        type="button"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          setOpen(value => !value);
        }}
        aria-label={open ? "Close customer care options" : "Open customer care options"}
        aria-expanded={open}
        title="Drag to move; tap for customer care"
        className="resa-care-pulse flex h-10 touch-none select-none items-center gap-2 rounded-full border border-[#f2df9b] bg-[#174b35] px-3 text-xs font-extrabold text-white shadow-[0_5px_18px_rgba(16,59,45,.28)] transition hover:scale-110 hover:bg-[#103b2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b765] focus-visible:ring-offset-2" style={{ animation: "resaCarePulse 2.4s ease-in-out infinite" }}
      >
        <MessageCircle size={16} aria-hidden="true" />
        Help
      </button>
    </div>
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
