
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Laptop,
  Microscope,
  Trophy,
  Users,
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
      <main>
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

        <section id="explore-resa" className="bg-white px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-8 max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#98782c]">
                Explore RESA
              </p>
              <h2 className="mt-3 text-2xl font-extrabold text-[#215641] sm:text-3xl">
                Everything You Need to Know, in One Place
              </h2>
              <p className="mt-3 leading-7 text-[#5d6a60]">
                Scroll through the school website or open any public section below to learn about our school, learning programmes, admissions and ways to contact us.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "About RESA", description: "Learn about our school, values, vision and learning environment.", href: "/about" },
                { title: "Academics & Development", description: "Explore academic learning and student development.", href: "/academics" },
                { title: "Innovation & Technology", description: "Discover computing, coding, digital literacy and technology.", href: "/innovation-technology" },
                { title: "Practical Skills", description: "Explore science activities, creativity and hands-on skills.", href: "/practical-skills" },
                { title: "Wisdom & Inspiration", description: "Read about character, leadership and personal development.", href: "/wisdom-inspiration" },
                { title: "School Activities & Gallery", description: "See school activities and learning highlights.", href: "/activities-gallery" },
                { title: "Admissions", description: "Find admissions information and the next steps for applying.", href: "/admissions" },
                { title: "Contact & Enquiries", description: "Reach the school for directions, questions and enquiries.", href: "/contact" },
              ].map((item) => (
                <article key={item.href} className="group flex h-full flex-col rounded-2xl border border-[#e2dece] bg-gradient-to-br from-white to-[#f5f6ee] p-5 shadow-[0_10px_24px_-18px_rgba(16,59,45,0.35)] transition duration-200 hover:-translate-y-1 hover:border-[#c9d9c8] hover:shadow-lg">
                  <h3 className="text-lg font-extrabold text-[#215641]">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#657066]">{item.description}</p>
                  <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#215641] hover:text-[#98782c]">
                    Open section <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#174b35] p-6 text-white shadow-xl sm:flex-row sm:items-center sm:p-8">
              <div>
                <h3 className="text-xl font-extrabold">Already have a RESA portal account?</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">Use the secure portal entry to continue to the available student, parent, teacher or administrator sign-in options.</p>
              </div>
              <Link href="/portal-options" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#e7cd83] px-5 py-3 font-bold text-[#173e2d] transition hover:bg-white">
                Portal & Services <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

      </main>
    </PublicLayout>
  );
}
