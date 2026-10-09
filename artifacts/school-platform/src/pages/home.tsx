import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Laptop,
  Menu,
  Microscope,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              src={mediaPath("media/logo/resa-logo.jpg")}
              alt=""
              className="h-12 w-12 rounded-full bg-white object-cover shadow-sm ring-1 ring-slate-200"
              width={48}
              height={48}
            />

            <div>
              <div className="font-black text-blue-800">
                RHEMA EXPLOITS
              </div>
              <div className="text-xs font-semibold text-slate-500">
                SCIENCE ACADEMY INTERNATIONAL
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <a href="#about" className="font-medium hover:text-blue-700">
              About
            </a>
            <a href="#academics" className="font-medium hover:text-blue-700">
              Academics
            </a>
            <a href="#activities" className="font-medium hover:text-blue-700">
              Activities
            </a>
            <a href="#admissions" className="font-medium hover:text-blue-700">
              Admissions
            </a>
            <a href="#contact" className="font-medium hover:text-blue-700">
              Contact
            </a>

            <Link
              href="/dashboard"
              className="rounded-lg bg-blue-700 px-4 py-2.5 font-bold text-white"
            >
              Portal Login
            </Link>
          </nav>

          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg border p-2 lg:hidden"
            aria-label="Menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <div className="border-t bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-2">
              <a
                href="#about"
                onClick={() => setOpen(false)}
                className="rounded-lg p-3 hover:bg-slate-50"
              >
                About
              </a>

              <a
                href="#academics"
                onClick={() => setOpen(false)}
                className="rounded-lg p-3 hover:bg-slate-50"
              >
                Academics
              </a>

              <a
                href="#activities"
                onClick={() => setOpen(false)}
                className="rounded-lg p-3 hover:bg-slate-50"
              >
                Activities
              </a>

              <a
                href="#admissions"
                onClick={() => setOpen(false)}
                className="rounded-lg p-3 hover:bg-slate-50"
              >
                Admissions
              </a>

              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="rounded-lg p-3 hover:bg-slate-50"
              >
                Contact
              </a>

              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-blue-700 p-3 text-center font-bold text-white"
              >
                Portal Login
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-4 font-bold text-blue-200">
              PASSION • SKILLS • EXCELLENT SPIRIT
            </p>

            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Preparing Students for the Future
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">
              At Rhema Exploits Science Academy International, we don't just
              teach. We prepare students to think, create, lead and succeed.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#admissions"
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-bold text-blue-900"
              >
                Explore Admissions
                <ArrowRight />
              </a>

              <a
                href="#activities"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-4 font-bold"
              >
                Explore Activities
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl shadow-blue-950/30">
            <img
              src={mediaPath("media/photos/digital-learning-classroom.jpg")}
              alt="RESA students attending a digital learning class."
              className="aspect-[4/3] w-full object-cover"
              width={1452}
              height={988}
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-blue-950/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
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
      <section id="about" className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-blue-700">
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

          <p className="mt-5 font-bold text-blue-800">
            Passion, Skills and Excellent Spirit.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="academics" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-blue-700">
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
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
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
      <section id="activities" className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-blue-700">
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
                  className={`aspect-[4/3] w-full ${
                    photo.fit === "contain"
                      ? "bg-slate-100 object-contain p-2"
                      : "object-cover"
                  }`}
                  loading="lazy"
                  decoding="async"
                />

                <div className="p-5">
                  <p className="text-xs font-bold uppercase text-blue-700">
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
      <section id="admissions" className="bg-blue-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-blue-300">
            Admissions
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Enroll Today. Build Tomorrow!
          </h2>

          <p className="mt-5 max-w-2xl leading-8 text-blue-100">
            Give your child more than just a classroom education. Choose an
            environment built around academic excellence, practical skills,
            technology, creativity and leadership.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button className="rounded-xl bg-white px-6 py-4 font-bold text-blue-900">
              Admission Enquiry
            </button>

            <button className="rounded-xl border border-white/30 px-6 py-4 font-bold">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-bold uppercase tracking-wide text-blue-700">
            Contact RESA
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            We'd Love to Hear From You
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border p-6">
              <CalendarDays className="text-blue-700" />
              <h3 className="mt-4 font-black">Visit Us</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                1, Smiling George Way, Opposite Winners' Chapel,
                Behind Matice, Sapele Road, Benin City.
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <BookOpen className="text-blue-700" />
              <h3 className="mt-4 font-black">Email</h3>
              <a
                href="mailto:rhemaexploitsacademy@gmail.com"
                className="mt-2 block break-all text-sm text-blue-700"
              >
                rhemaexploitsacademy@gmail.com
              </a>
            </div>

            <div className="rounded-2xl border p-6">
              <Users className="text-blue-700" />
              <h3 className="mt-4 font-black">Phone</h3>
              <a
                href="tel:+2348058422691"
                className="mt-2 block text-sm text-blue-700"
              >
                +234 805 842 2691
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-10 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-black">RHEMA EXPLOITS SCIENCE ACADEMY</h3>
              <p className="mt-1 text-sm text-slate-400">
                Passion, Skills and Excellent Spirit.
              </p>
            </div>

            <a
              href="https://www.facebook.com/profile.php?id=61590864593753"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-300 hover:text-white"
            >
              Facebook
            </a>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Rhema Exploits Science Academy
            International. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}