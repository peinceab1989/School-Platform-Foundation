
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Laptop,
  Microscope,
  Trophy,
  Mail,
  MapPin,
  Phone,
  Users,
  Wallet,
  CreditCard,
  ClipboardList,
  GraduationCap,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/public-site";
import {
  getSupabaseClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type WebsiteContent =
  Database["public"]["Functions"]["get_resa_website_content"]["Returns"][number];

const mediaPath = (path: string) =>
  `${import.meta.env.BASE_URL}${path}`;

const features = [
  {
    icon: BookOpen,
    title: "Academic Excellence",
    description:
      "Build a strong foundation through learning, curiosity, discipline and excellent teaching.",
    href: "/academics",
  },
  {
    icon: Laptop,
    title: "Innovation & Technology",
    description:
      "Explore computing, digital literacy, coding and technology-enhanced learning.",
    href: "/innovation-technology",
  },
  {
    icon: Microscope,
    title: "Practical Skills",
    description:
      "Discover science, creativity, hands-on activities and useful real-world skills.",
    href: "/practical-skills",
  },
  {
    icon: Trophy,
    title: "Wisdom & Inspiration",
    description:
      "Develop leadership, confidence, responsibility and a positive attitude to life.",
    href: "/wisdom-inspiration",
  },
];

export default function HomePage() {
  const [websiteContent, setWebsiteContent] = useState<WebsiteContent[]>([]);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return;
    }

    let isMounted = true;

    async function loadWebsiteContent() {
      try {
        const { data, error } = await getSupabaseClient().rpc(
          "get_resa_website_content",
          {
            p_content_type: null,
          },
        );

        if (error) {
          console.error("Unable to load RESA website content:", error.message);
          return;
        }

        if (isMounted) {
          setWebsiteContent(data ?? []);
        }
      } catch (error) {
        console.error("Unable to connect to RESA website content:", error);
      }
    }

    void loadWebsiteContent();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-[#174b35] text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#e7cd83] sm:text-sm">
                PASSION • SKILLS • EXCELLENT SPIRIT
              </p>

              <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                Preparing Students for the Future
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
                At Rhema Exploits Science Academy International, we help
                students think, create, discover their abilities and prepare
                for a changing world.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/admissions"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e7cd83] px-5 py-3 font-bold text-[#173e2d] transition hover:bg-white"
                >
                  Explore Admissions <ArrowRight size={18} />
                </Link>

                <Link
                  href="/activities-gallery"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/50 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  School Activities
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
              <img
                src={mediaPath("media/photos/digital-learning-classroom.jpg")}
                alt="Students learning in a digital classroom"
                className="h-64 w-full object-cover sm:h-80 lg:h-[390px]"
              />
            </div>
          </div>
        </section>

        {websiteContent.length > 0 && (
          <section
            aria-labelledby="website-updates-heading"
            className="bg-white px-5 py-12 sm:px-8 sm:py-16"
          >
            <div className="mx-auto max-w-7xl">
              <div className="mx-auto mb-8 max-w-2xl text-center">
                <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#98782c]">
                  Stay Informed
                </p>

                <h2
                  id="website-updates-heading"
                  className="mt-3 text-2xl font-extrabold text-[#215641] sm:text-3xl"
                >
                  RESA News & Updates
                </h2>

                <p className="mt-3 leading-7 text-[#5d6a60]">
                  Discover the latest news, announcements, events and updates
                  from our school.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {websiteContent.map((item) => {
                  const contentType = item.content_type.replace(/_/g, " ");
                  const hasImage = Boolean(item.image_url?.trim());
                  const hasPublicationDate =
                    Boolean(item.published_at) &&
                    !Number.isNaN(Date.parse(item.published_at));

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-[#e2dece] bg-white shadow-sm transition hover:shadow-md"
                    >
                      {hasImage && (
                        <img
                          src={item.image_url}
                          alt={item.image_alt || item.title}
                          className="h-48 w-full object-cover"
                          loading="lazy"
                        />
                      )}

                      <div className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#eaf1e8] px-3 py-1 text-xs font-bold capitalize text-[#215641]">
                            {contentType}
                          </span>

                          {hasPublicationDate && (
                            <time
                              dateTime={item.published_at}
                              className="text-xs text-[#657066]"
                            >
                              {new Date(item.published_at).toLocaleDateString(
                                "en-NG",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </time>
                          )}
                        </div>

                        <h3 className="mt-4 text-lg font-bold text-[#215641]">
                          {item.title}
                        </h3>

                        {(item.summary || item.body) && (
                          <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-[#657066]">
                            {item.summary || item.body}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#98782c]">
              Welcome to RESA
            </p>

            <h2 className="mt-3 text-2xl font-extrabold text-[#215641] sm:text-3xl">
              More Than a Classroom Education
            </h2>

            <p className="mt-4 leading-7 text-[#5d6a60]">
              Every child deserves an excellent learning environment. RESA
              brings together academic development, science, technology,
              practical skills and character building to prepare learners for
              meaningful opportunities.
            </p>

            <Link
              href="/about"
              className="mt-5 inline-flex items-center gap-2 font-bold text-[#215641] hover:text-[#98782c]"
            >
              Learn more about RESA <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        <section className="bg-[#f1efe5] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <h2 className="text-2xl font-extrabold text-[#215641] sm:text-3xl">
                Learning for Life
              </h2>

              <p className="mt-3 leading-7 text-[#5d6a60]">
                Discover the areas that help our students learn, grow and
                prepare for the future.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="rounded-2xl border border-[#e2dece] bg-white p-5 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf1e8] text-[#215641]">
                      <Icon size={25} />
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-[#215641]">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-[#657066]">
                      {feature.description}
                    </p>

                    <Link
                      href={feature.href}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#215641] hover:text-[#98782c]"
                    >
                      Explore <ArrowRight size={15} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-gradient-to-br from-[#174b35] via-[#205b41] to-[#103b2d] px-5 py-14 text-white sm:px-8 sm:py-20">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10 shadow-[0_0_0_28px_rgba(255,255,255,.035),0_0_0_60px_rgba(255,255,255,.025)]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto mb-9 max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#e7cd83]">Quick access • Clear guidance</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Your RESA Journey, Made Easier</h2>
              <p className="mt-3 leading-7 text-white/75">Explore admissions and school-fee information. Open each panel to see the steps and the right way to make an enquiry.</p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <article className="group rounded-3xl border border-white/15 bg-white/[.09] p-5 shadow-[0_18px_45px_rgba(0,0,0,.18)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/[.13] hover:shadow-[0_24px_55px_rgba(0,0,0,.25)] sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e7cd83] text-[#174b35] shadow-lg shadow-black/10"><Wallet size={27}/></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#e7cd83]">Fees & finance</p>
                    <h3 className="mt-1 text-2xl font-extrabold">Understand school payments</h3>
                    <p className="mt-2 text-sm leading-6 text-white/75">Ask for the current approved fee schedule and payment instructions before making a payment.</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  <details className="group/fee rounded-xl border border-white/15 bg-black/10 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2"><ClipboardList size={17} className="text-[#e7cd83]"/> Fee breakdown</span>
                      <ChevronDown size={17} className="transition group-open/fee:rotate-180"/>
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-white/75">Request an itemised breakdown of applicable tuition and approved school charges for your child's class and session. Amounts can change, so confirm the latest schedule with the school.</p>
                  </details>
                  <details className="group/method rounded-xl border border-white/15 bg-black/10 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2"><CreditCard size={17} className="text-[#e7cd83]"/> Payment options & receipts</span>
                      <ChevronDown size={17} className="transition group-open/method:rotate-180"/>
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-white/75">Contact the school to confirm its currently approved payment channel, account details and receipt procedure. Do not send money to an unverified account or rely on details from an old message.</p>
                  </details>
                  <a href="https://wa.me/2348058422691?text=Hello%20RESA%2C%20please%20send%20me%20the%20current%20school%20fee%20schedule%2C%20itemised%20payment%20breakdown%20and%20approved%20payment%20instructions." target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e7cd83] px-5 py-3 text-sm font-extrabold text-[#173e2d] shadow-lg transition hover:-translate-y-0.5 hover:bg-white">Request fee schedule <ArrowRight size={17}/></a>
                </div>
              </article>
              <article className="group rounded-3xl border border-white/15 bg-white/[.09] p-5 shadow-[0_18px_45px_rgba(0,0,0,.18)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/[.13] hover:shadow-[0_24px_55px_rgba(0,0,0,.25)] sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e7cd83] text-[#174b35] shadow-lg shadow-black/10"><GraduationCap size={28}/></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#e7cd83]">Admissions & registration</p>
                    <h3 className="mt-1 text-2xl font-extrabold">Take the next step</h3>
                    <p className="mt-2 text-sm leading-6 text-white/75">Find out about admission enquiries, required documents and registration guidance.</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  <details className="group/admission rounded-xl border border-white/15 bg-black/10 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2"><ClipboardList size={17} className="text-[#e7cd83]"/> Registration steps</span>
                      <ChevronDown size={17} className="transition group-open/admission:rotate-180"/>
                    </summary>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/75">
                      <li>Read the admission information and confirm class availability.</li>
                      <li>Contact the school to confirm required documents and registration procedure.</li>
                      <li>Submit information only through a school-approved registration channel.</li>
                      <li>Confirm any admission-related charges and obtain an official receipt.</li>
                    </ol>
                  </details>
                  <details className="group/requirements rounded-xl border border-white/15 bg-black/10 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#e7cd83]"/> Before making a payment</span>
                      <ChevronDown size={17} className="transition group-open/requirements:rotate-180"/>
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-white/75">Verify the student's admission status, the amount due, the approved payment channel and how to collect an official receipt directly with RESA.</p>
                  </details>
                  <Link href="/admissions" className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e7cd83]/70 bg-white/10 px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-white/20">Explore admissions <ArrowRight size={17}/></Link>
                </div>
              </article>
            </div>
            <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-white/60">For your protection, RESA does not publish unverified bank details or promise online payment processing on this page. Confirm current instructions directly with the school.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl">
              <img
                src={mediaPath("media/photos/ict-digital-skills-lab.jpg")}
                alt="Students developing digital skills"
                className="h-64 w-full object-cover sm:h-80"
                loading="lazy"
              />
            </div>

            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf1e8] text-[#215641]">
                <Users size={25} />
              </div>

              <h2 className="mt-4 text-2xl font-extrabold text-[#215641] sm:text-3xl">
                Every Learner Has Potential
              </h2>

              <p className="mt-4 leading-7 text-[#5d6a60]">
                We encourage learners to build knowledge, develop practical
                abilities, work together and approach tomorrow with confidence.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/activities-gallery"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#215641] px-5 py-3 font-bold text-white hover:bg-[#174b35]"
                >
                  View School Gallery <ArrowRight size={17} />
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#215641] px-5 py-3 font-bold text-[#215641] hover:bg-[#eaf1e8]"
                >
                  Contact RESA
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="contact-resa" className="bg-[#f1efe5] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-8 max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#98782c]">Admissions & Contact</p>
              <h2 className="mt-3 text-2xl font-extrabold text-[#215641] sm:text-3xl">Talk to RESA</h2>
              <p className="mt-3 leading-7 text-[#5d6a60]">For current admission availability, fees and required documents, please contact the school directly before making any payment.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <a href="tel:+2348058422691" className="rounded-2xl border border-[#e2dece] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf1e8] text-[#215641]"><Phone size={21} aria-hidden="true" /></span>
                <h3 className="mt-4 font-extrabold text-[#215641]">Call RESA</h3>
                <p className="mt-2 text-sm text-[#657066]">+234 805 842 2691</p>
              </a>
              <a href="mailto:rhemaexploitsacademy@gmail.com" className="rounded-2xl border border-[#e2dece] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf1e8] text-[#215641]"><Mail size={21} aria-hidden="true" /></span>
                <h3 className="mt-4 font-extrabold text-[#215641]">Email the school</h3>
                <p className="mt-2 break-words text-sm text-[#657066]">rhemaexploitsacademy@gmail.com</p>
              </a>
              <a href="https://www.google.com/maps/search/?api=1&query=1%2C+Smiling+George+Way%2C+Behind+Mat+Ice%2C+Opposite+Winners%27+Chapel%2C+Sapele+Road%2C+Benin+City%2C+Edo+State%2C+Nigeria" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#e2dece] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf1e8] text-[#215641]"><MapPin size={21} aria-hidden="true" /></span>
                <h3 className="mt-4 font-extrabold text-[#215641]">Visit the school</h3>
                <p className="mt-2 text-sm leading-6 text-[#657066]">1, Smiling George Way, Behind Mat Ice, Opp. Winners’ Chapel, Sapele Road, Benin City, Edo State, Nigeria.</p>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/admissions" className="inline-flex items-center gap-2 rounded-xl bg-[#215641] px-5 py-3 font-bold text-white transition hover:bg-[#174b35]">Admissions information <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-[#215641] bg-white px-5 py-3 font-bold text-[#215641] transition hover:bg-[#eaf1e8]">More contact options <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

    </PublicLayout>
  );
}
