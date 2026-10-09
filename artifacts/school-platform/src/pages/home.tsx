import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Laptop,
  Microscope,
  Trophy,
  Users,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { PublicLayout } from "@/components/public-site";

const features = [
  {
    icon: Laptop,
    title: "ICT & Digital Skills",
    text: "Practical digital learning, coding and technology skills for the future.",
  },
  {
    icon: Microscope,
    title: "Science & Innovation",
    text: "Science learning that encourages curiosity, creativity and discovery.",
  },
  {
    icon: Trophy,
    title: "Skills & Entrepreneurship",
    text: "Practical skills that help students create, solve problems and become productive.",
  },
  {
    icon: Users,
    title: "Leadership & Character",
    text: "Building responsible, confident and purpose-driven future leaders.",
  },
];

const mediaPath = (path: string) =>
  `${import.meta.env.BASE_URL}${path}`;

const admissionsEmail = "rhemaexploitsacademy@gmail.com";

const schoolPhotos = [
  {
    src: "media/photos/basketball-sports-team.jpg",
    category: "Sports & fitness",
    title: "Basketball and team sports",
    alt: "RESA students in sports uniforms with a basketball.",
    fit: "contain",
  },
  {
    src: "media/photos/cooking-and-baking-activities.jpg",
    category: "Practical skills",
    title: "Cooking and baking activities",
    alt: "Students taking part in a supervised cooking and baking activity.",
    fit: "cover",
  },
  {
    src: "media/photos/ict-classroom-workstations.jpg",
    category: "Digital learning",
    title: "ICT classroom practice",
    alt: "A student using a desktop computer at an ICT workstation.",
    fit: "cover",
  },
  {
    src: "media/photos/ict-digital-skills-lab.jpg",
    category: "Digital learning",
    title: "ICT digital skills lab",
    alt: "Computer workstations in the ICT and digital skills lab.",
    fit: "contain",
  },
  {
    src: "media/photos/mental-development-games.jpg",
    category: "Thinking skills",
    title: "Mental development games",
    alt: "Students playing a strategy board game together.",
    fit: "contain",
  },
  {
    src: "media/photos/school-building-sign.jpg",
    category: "Our school",
    title: "Rhema Exploits Science Academy",
    alt: "The school building and Rhema Exploits Science Academy sign.",
    fit: "contain",
  },
  {
    src: "media/photos/science-lab-activity.jpg",
    category: "Science",
    title: "Science laboratory activities",
    alt: "Students working together during a science laboratory activity.",
    fit: "contain",
  },
  {
    src: "media/photos/skill-acquisition-workshop.jpg",
    category: "Practical skills",
    title: "Skill acquisition workshop",
    alt: "Students learning practical woodworking skills in a workshop.",
    fit: "contain",
  },
  {
    src: "media/photos/smartboard-classroom.jpg",
    category: "Digital learning",
    title: "Learning with the smartboard",
    alt: "Students following a lesson displayed on a classroom smartboard.",
    fit: "cover",
  },
  {
    src: "media/photos/student-computer-lab.jpg",
    category: "Digital learning",
    title: "Student computer lab",
    alt: "A student working at a computer in the school computer lab.",
    fit: "cover",
  },
  {
    src: "media/photos/student-using-computer.jpg",
    category: "Digital learning",
    title: "Individual computer learning",
    alt: "A student using a desktop computer for individual learning.",
    fit: "contain",
  },
  {
    src: "media/photos/word-puzzle-activity.jpg",
    category: "Class activities",
    title: "Word puzzle activities",
    alt: "Students working together on a word puzzle activity.",
    fit: "contain",
  },
];

export default function HomePage() {
  const [enquiryPrepared, setEnquiryPrepared] = useState(false);

  const handleAdmissionEnquirySubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const parentName = String(formData.get("parentName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const studentName = String(formData.get("studentName") ?? "").trim();
    const classApplyingFor = String(
      formData.get("classApplyingFor") ?? "",
    ).trim();
    const message = String(formData.get("message") ?? "").trim();

    const subject = `Admission enquiry for ${studentName}`;
    const body = [
      "Admission enquiry from the RESA website",
      "",
      `Parent or guardian name: ${parentName}`,
      `Phone number: ${phone}`,
      `Email address: ${email}`,
      `Student's name: ${studentName}`,
      `Class applying for: ${classApplyingFor}`,
      `Message: ${message || "No additional message"}`,
    ].join("\n");

    window.location.href =
      `mailto:${admissionsEmail}?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    setEnquiryPrepared(true);
  };

  return (
    <PublicLayout>

      {/* Hero */}
      <section className="bg-[#214a37] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-4 font-bold text-[#e4c879]">
              PASSION • SKILLS • EXCELLENT SPIRIT
            </p>

            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Preparing Students for the Future
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#e0e9dd]">
              At Rhema Exploits Science Academy International, we don't just
              teach. We prepare students to think, create, lead and succeed.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#admission-enquiry"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#e4c879] px-6 py-4 font-bold text-[#254633]"
                data-testid="home-cta-admissions"
              >
                Explore Admissions
                <ArrowRight />
              </a>

              <a
                href="#activities"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-4 font-bold"
                data-testid="home-cta-activities"
              >
                Explore Activities
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl">
            <img
              src={mediaPath("media/photos/digital-learning-classroom.jpg")}
              alt="RESA students attending a digital learning class."
              className="aspect-[4/3] w-full object-cover"
              width={1452}
              height={988}
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#183b2a]/80 via-[#183b2a]/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e4c879]">
                Learning in action
              </p>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                Digital learning at RESA
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-[#8b702e]">
            Welcome to RESA
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            More Than Just a Classroom Education
          </h2>

          <p className="mt-5 max-w-3xl leading-8 text-slate-600">
            Every child deserves an excellent learning environment. RESA
            provides academic learning together with science, technology,
            practical skills, creativity, entrepreneurship and leadership
            development.
          </p>

          <p className="mt-5 font-bold text-[#245b40]">
            Passion, Skills and Excellent Spirit.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="academics" className="scroll-mt-24 bg-[#f1efe4] py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-[#8b702e]">
            Academics & Development
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Learning Today. Leading Tomorrow.
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                  data-testid={`home-feature-${feature.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e9efdf] text-[#245b40]">
                    <Icon />
                  </div>

                  <h3 className="mt-5 font-black">{feature.title}</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Activities */}
      <section id="activities" className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-[#8b702e]">
            RESA Activities & Media
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Life Beyond the Classroom
          </h2>

          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Discover practical, creative and educational experiences that
            make learning at RESA engaging and meaningful.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {schoolPhotos.map((photo) => (
              <div
                key={photo.src}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              >
                <img
                  src={mediaPath(photo.src)}
                  alt={photo.alt}
                  data-testid={`home-photo-${photo.src.split("/").pop()?.replace(".jpg", "")}`}
                  className={`aspect-[4/3] w-full ${
                    photo.fit === "contain"
                      ? "bg-slate-100 object-contain p-2"
                      : "object-cover"
                  }`}
                  loading="lazy"
                  decoding="async"
                />

                <div className="p-5">
                  <p className="text-xs font-bold uppercase text-[#8b702e]">
                    {photo.category}
                  </p>

                  <h3 className="mt-2 font-black">
                    {photo.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admissions */}
      <section
        id="admissions"
        className="scroll-mt-24 bg-[#214a37] py-16 text-white"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="pt-2">
            <p className="font-bold uppercase tracking-wide text-[#e4c879]">
              Admissions
            </p>

            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Enroll Today. Build Tomorrow!
            </h2>

            <p className="mt-5 max-w-xl leading-8 text-[#e0e9dd]">
              Give your child more than just a classroom education. Choose an
              environment built around academic excellence, practical skills,
              technology, creativity and leadership.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#admission-enquiry"
                className="rounded-xl bg-[#e4c879] px-6 py-4 text-center font-bold text-[#254633] hover:bg-[#f0d993]"
                data-testid="home-admission-enquiry-anchor"
              >
                Admission Enquiry
              </a>

              <a
                href="#academics"
                className="rounded-xl border border-white/30 px-6 py-4 text-center font-bold hover:bg-white/10"
                data-testid="home-academics-anchor"
              >
                Learn More
              </a>
            </div>
          </div>

          <div
            id="admission-enquiry"
            className="scroll-mt-24 rounded-3xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8"
            aria-labelledby="admission-form-heading"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-[#245b40]">
              RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL
            </p>
            <h3
              id="admission-form-heading"
              className="mt-2 text-2xl font-black sm:text-3xl"
            >
              Admission enquiry
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              Share a few details and we’ll prepare an enquiry email addressed
              to the school.
            </p>

            <form
              className="mt-7 grid gap-5 sm:grid-cols-2"
              onSubmit={handleAdmissionEnquirySubmit}
            >
              <div>
                <label
                  htmlFor="parentName"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Parent or guardian name
                </label>
                <input
                  id="parentName"
                  name="parentName"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  required
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
                  data-testid="input-parent-name"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Phone number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={32}
                  required
                  placeholder="Enter your phone number"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
                  data-testid="input-phone"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
                  data-testid="input-email"
                />
              </div>

              <div>
                <label
                  htmlFor="studentName"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Student&apos;s name
                </label>
                <input
                  id="studentName"
                  name="studentName"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  required
                  placeholder="Enter the student's full name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
                  data-testid="input-student-name"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="classApplyingFor"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Class applying for
                </label>
                <input
                  id="classApplyingFor"
                  name="classApplyingFor"
                  type="text"
                  maxLength={80}
                  required
                  placeholder="Enter the class or year group"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
                  data-testid="input-class-applying-for"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="message"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Message <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  maxLength={3000}
                  placeholder="Add any questions or details you would like the school to know."
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
                  data-testid="input-message"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#245b40] px-6 py-4 font-bold text-white transition hover:bg-[#17462f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451] focus-visible:ring-offset-2 sm:w-auto"
                  data-testid="button-prepare-enquiry"
                >
                  Prepare enquiry email
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Submitting opens your email app with the enquiry ready to
                  send. If it doesn&apos;t open, email{" "}
                  <a
                    href={`mailto:${admissionsEmail}`}
                    className="font-semibold text-[#245b40] underline underline-offset-2"
                    data-testid="link-admissions-email"
                  >
                    {admissionsEmail}
                  </a>
                  .
                </p>

                {enquiryPrepared && (
                  <p
                    className="mt-3 rounded-xl bg-[#edf3e9] p-4 text-sm leading-6 text-[#244a36]"
                    data-testid="status-enquiry-prepared"
                    role="status"
                    aria-live="polite"
                  >
                    Your email app should now show the completed enquiry.
                    Review it and press send to contact the school.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-[#8b702e]">
            Contact RESA
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            We'd Love to Hear From You
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border p-6">
              <CalendarDays className="text-[#8b702e]" />
              <h3 className="mt-4 font-black">Visit Us</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                1, Smiling George Way, Opposite Winners' Chapel,
                Behind Matice, Sapele Road, Benin City.
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <BookOpen className="text-[#8b702e]" />
              <h3 className="mt-4 font-black">Email</h3>
              <a
                href="mailto:rhemaexploitsacademy@gmail.com"
                className="mt-2 block break-all text-sm text-[#245b40]"
                data-testid="home-contact-email"
              >
                rhemaexploitsacademy@gmail.com
              </a>
            </div>

            <div className="rounded-2xl border p-6">
              <Users className="text-[#8b702e]" />
              <h3 className="mt-4 font-black">Phone</h3>
              <a
                href="tel:+2348058422691"
                className="mt-2 block text-sm text-[#245b40]"
                data-testid="home-contact-phone"
              >
                +234 805 842 2691
              </a>
            </div>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}