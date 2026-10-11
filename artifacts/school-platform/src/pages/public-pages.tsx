
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Lightbulb,
  MapPin,
  Phone,
  Mail,
  Wrench,
  Send,
} from "lucide-react";
import { PublicLayout } from "@/components/public-site";

const media = (name: string) =>
  `${import.meta.env.BASE_URL}media/photos/${name}`;

const schoolEmail = "rhemaexploitsacademy@gmail.com";
const schoolPhone = "+234 805 842 2691";

const gallery = [
  {
    file: "science-lab-activity.jpg",
    title: "Science laboratory activities",
    description: "Students working together during a science laboratory activity.",
  },
  {
    file: "ict-classroom-workstations.jpg",
    title: "ICT classroom practice",
    description: "A student using a desktop computer at an ICT workstation.",
  },
  {
    file: "cooking-and-baking-activities.jpg",
    title: "Cooking and baking",
    description: "Students taking part in a cooking and baking activity.",
  },
  {
    file: "skill-acquisition-workshop.jpg",
    title: "Skill acquisition workshop",
    description: "Students learning practical woodworking skills in a workshop.",
  },
  {
    file: "word-puzzle-activity.jpg",
    title: "Thinking together",
    description: "Students working together on a word puzzle activity.",
  },
  {
    file: "basketball-sports-team.jpg",
    title: "Sports and fitness",
    description: "Students taking part in a basketball activity.",
  },
  {
    file: "digital-learning-classroom.jpg",
    title: "Digital classroom learning",
    description: "Students taking part in a digital learning class.",
  },
  {
    file: "ict-digital-skills-lab.jpg",
    title: "ICT digital skills lab",
    description: "Computer workstations in the ICT and digital skills lab.",
  },
  {
    file: "mental-development-games.jpg",
    title: "Mental development games",
    description: "Students playing a strategy board game together.",
  },
  {
    file: "smartboard-classroom.jpg",
    title: "Learning with a smartboard",
    description: "Students following a classroom lesson on a smartboard.",
  },
  {
    file: "student-computer-lab.jpg",
    title: "Student computer lab",
    description: "A student working at a computer in the school computer lab.",
  },
  {
    file: "student-using-computer.jpg",
    title: "Individual computer learning",
    description: "A student using a computer for individual learning.",
  },
];

function PageIntro({
  eyebrow,
  title,
  copy,
  image,
  alt,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  image?: string;
  alt?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-[#e7e1d3] bg-[#f1efe4]">
      <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#8b702e]">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-tight text-[#214a37] sm:text-5xl lg:text-[3.7rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[#58665b] sm:text-lg">
            {copy}
          </p>
          <Link
            href="/admissions"
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#245b40] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#17462f]"
            data-testid="intro-admissions-link"
          >
            Explore admissions <ArrowRight size={17} />
          </Link>
        </div>

        {image && (
          <div className="relative">
            <div
              className="absolute -inset-3 rotate-2 rounded-[2rem] border border-[#d6c58e]"
              aria-hidden="true"
            />
            <img
              src={media(image)}
              alt={alt ?? ""}
              className="relative aspect-[4/3] w-full rounded-[1.65rem] object-cover shadow-[0_18px_50px_rgba(35,64,45,.16)]"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function PageCta({
  title = "Start a conversation with RESA",
  copy = "Ask us about the school and the admission enquiry process.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14">
      <div className="flex flex-col justify-between gap-6 rounded-[1.75rem] bg-[#245b40] px-7 py-9 text-white sm:flex-row sm:items-center sm:px-10">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#dce6d8]">
            {copy}
          </p>
        </div>
        <Link
          href="/admissions"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e4c879] px-5 py-3 text-sm font-bold text-[#254633] hover:bg-[#f0d993]"
          data-testid="cta-enquiry-link"
        >
          Admission enquiry <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function TopicPage({
  eyebrow,
  title,
  copy,
  image,
  alt,
  highlights,
  symbol,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  image: string;
  alt: string;
  highlights: { title: string; text: string }[];
  symbol: "light" | "book" | "tool";
}) {
  const Icon =
    symbol === "light" ? Lightbulb : symbol === "book" ? BookOpen : Wrench;

  return (
    <PublicLayout>
      <PageIntro
        eyebrow={eyebrow}
        title={title}
        copy={copy}
        image={image}
        alt={alt}
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-9 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">
              How learning takes shape
            </p>
            <h2 className="mt-4 font-serif text-3xl leading-tight text-[#214a37] sm:text-4xl">
              Knowledge with room to become practice.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((item, index) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[#e8e2d4] bg-[#fffef9] p-6 shadow-[0_6px_22px_rgba(42,56,43,.04)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9efdf] text-[#245b40]">
                  <Icon size={21} />
                </span>
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[.16em] text-[#9c8241]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-lg font-bold text-[#2b4837]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#667168]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PageCta />
    </PublicLayout>
  );
}

/* ABOUT RESA */

export function AboutPage() {
  return (
    <PublicLayout>
      <PageIntro
        eyebrow="About RESA"
        title="Preparing students for the future."
        copy="At Rhema Exploits Science Academy International, we don't just teach. We prepare students to think, create, lead and succeed through academic learning, practical skills, technology and character development."
        image="school-building-sign.jpg"
        alt="Rhema Exploits Science Academy school building and sign."
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">
              Our purpose
            </p>
            <h2 className="mt-4 font-serif text-3xl text-[#214a37]">
              Education beyond the classroom
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#667168]">
              RESA aims to create an environment where students can build
              knowledge, develop useful abilities, explore their interests
              and grow in confidence. We value learning that connects ideas
              with practical experiences.
            </p>
          </article>

          <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">
              Our guiding principle
            </p>
            <h2 className="mt-4 font-serif text-3xl text-[#214a37]">
              Passion, Skills and Excellent Spirit
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#667168]">
              Our guiding phrase reflects a balanced approach to education:
              enthusiasm for learning, the ability to apply knowledge, and
              the development of positive character, responsibility and
              respect for others.
            </p>
          </article>
        </div>

        <div className="mt-8 overflow-hidden rounded-[1.75rem] bg-[#e9efdf] p-7 sm:p-10">
          <h2 className="font-serif text-3xl text-[#214a37]">
            What makes the RESA experience distinctive?
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Academic growth",
                text: "Building understanding, curiosity and problem-solving habits.",
              },
              {
                title: "Technology and innovation",
                text: "Exploring digital learning, science and creative ideas.",
              },
              {
                title: "Practical development",
                text: "Connecting learning with hands-on activities and useful skills.",
              },
              {
                title: "Character and leadership",
                text: "Encouraging responsibility, confidence and cooperation.",
              },
              {
                title: "Creativity",
                text: "Giving students opportunities to think, make and explore.",
              },
              {
                title: "A future-facing outlook",
                text: "Helping learners prepare for changing educational and practical opportunities.",
              },
            ].map((item) => (
              <article key={item.title}>
                <h3 className="font-bold text-[#245b40]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#58665b]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PageCta
        title="Discover what RESA can offer your child"
        copy="Explore our learning areas or contact the school to ask questions."
      />
    </PublicLayout>
  );
}

/* ACADEMICS */

export function AcademicsPage() {
  return (
    <PublicLayout>
      <PageIntro
        eyebrow="Academics and development"
        title="Knowledge, discovery and practical learning."
        copy="RESA brings academic learning together with science, digital skills, creativity and personal development. Our aim is to encourage students to understand ideas and apply what they learn."
        image="smartboard-classroom.jpg"
        alt="Students learning with a classroom smartboard."
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Core academic learning",
              text: "Developing knowledge, understanding, communication and independent thinking.",
              image: "word-puzzle-activity.jpg",
            },
            {
              title: "Science and discovery",
              text: "Encouraging curiosity, observation, investigation and thoughtful problem-solving.",
              image: "science-lab-activity.jpg",
            },
            {
              title: "Digital skills",
              text: "Introducing students to computer-based learning and digital technology.",
              image: "ict-classroom-workstations.jpg",
            },
            {
              title: "Practical activities",
              text: "Connecting ideas with hands-on experiences, creativity and useful skills.",
              image: "skill-acquisition-workshop.jpg",
            },
            {
              title: "Thinking and teamwork",
              text: "Supporting cooperation, reasoning, communication and shared problem-solving.",
              image: "mental-development-games.jpg",
            },
            {
              title: "Personal development",
              text: "Encouraging confidence, responsibility, positive attitudes and leadership.",
              image: "basketball-sports-team.jpg",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="overflow-hidden rounded-2xl border border-[#e7e1d3] bg-[#fffef9]"
            >
              <img
                src={media(item.image)}
                alt={item.title}
                loading="lazy"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h2 className="text-lg font-bold text-[#245b40]">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#667168]">
                  {item.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <PageCta
        title="Explore learning at RESA"
        copy="Learn about our technology, practical skills and student activities."
      />
    </PublicLayout>
  );
}

/* INNOVATION AND TECHNOLOGY */

export function InnovationTechnologyPage() {
  return (
    <TopicPage
      eyebrow="Innovation & technology"
      title="Curiosity meets the digital world."
      copy="RESA brings academic learning together with science and technology, giving students space to explore ideas and build confidence with digital tools."
      image="ict-classroom-workstations.jpg"
      alt="A student practising at an ICT workstation."
      symbol="light"
      highlights={[
        {
          title: "Digital learning",
          text: "Students engage with computer-based learning and technology in the school's ICT spaces.",
        },
        {
          title: "Science and discovery",
          text: "Science learning encourages questions, exploration and thoughtful problem-solving.",
        },
        {
          title: "Ideas into making",
          text: "Technology and creativity are part of a learning experience that values trying, testing and improving.",
        },
        {
          title: "Skills for tomorrow",
          text: "Digital skills contribute to the academy's broader focus on practical, future-facing learning.",
        },
      ]}
    />
  );
}

/* PRACTICAL SKILLS */

export function PracticalSkillsPage() {
  return (
    <TopicPage
      eyebrow="Practical skills"
      title="Learn by making, doing and solving."
      copy="Alongside academic learning, RESA gives practical skills a place in school life. Students can explore hands-on activities that call for care, creativity and problem-solving."
      image="skill-acquisition-workshop.jpg"
      alt="Students practising woodworking during a skills workshop."
      symbol="tool"
      highlights={[
        {
          title: "Workshop practice",
          text: "Students take part in skill acquisition activities such as woodworking.",
        },
        {
          title: "Cooking and baking",
          text: "Cooking and baking activities invite students to learn through guided, practical participation.",
        },
        {
          title: "Creative thinking",
          text: "Making and creating offer a chance to apply ideas and think through challenges.",
        },
        {
          title: "Productive confidence",
          text: "Practical experiences support the school's aim to help students become capable and productive.",
        },
      ]}
    />
  );
}

/* WISDOM AND INSPIRATION */

export function WisdomInspirationPage() {
  return (
    <TopicPage
      eyebrow="Wisdom & inspiration"
      title="Character matters as much as knowledge."
      copy="RESA's guiding phrase, 'Passion, Skills and Excellent Spirit,' speaks to learning that develops the whole student academically, creatively and in character."
      image="word-puzzle-activity.jpg"
      alt="Students working together on a word puzzle."
      symbol="book"
      highlights={[
        {
          title: "Excellent spirit",
          text: "The academy's motto puts character and attitude alongside learning and skill.",
        },
        {
          title: "Learning with others",
          text: "Group activities give students opportunities to listen, contribute and solve problems together.",
        },
        {
          title: "Purpose and leadership",
          text: "RESA values the development of responsible, confident and purpose-driven young people.",
        },
        {
          title: "A balanced approach",
          text: "Academic learning sits alongside creativity, practical skills and personal development.",
        },
      ]}
    />
  );
}

/* ACTIVITIES AND GALLERY */

export function ActivitiesGalleryPage() {
  return (
    <PublicLayout>
      <PageIntro
        eyebrow="Activities & gallery"
        title="A closer look at learning in action."
        copy="Browse moments from RESA's school life, from science and digital learning to practical workshops, thinking games and sport."
        image="science-lab-activity.jpg"
        alt="Students working together during a science laboratory activity."
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">
              School moments
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#214a37] sm:text-4xl">
              Explore our activities
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#667168]">
            A selection of images from the academy's school media.
          </p>
        </div>

        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {gallery.map((item, index) => (
            <figure
              key={item.file}
              className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-[#e7e1d3] bg-[#fffef9] shadow-[0_8px_24px_rgba(42,56,43,.06)]"
            >
              <img
                src={media(item.file)}
                alt={item.description}
                loading="lazy"
                decoding="async"
                className="max-h-[440px] w-full bg-[#f2f0e7] object-cover"
                data-testid={`gallery-image-${index + 1}`}
              />
              <figcaption className="px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c8241]">
                  RESA activities
                </p>
                <h3 className="mt-1 font-bold text-[#2b4837]">
                  {item.title}
                </h3>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <PageCta
        title="Want to know more about RESA?"
        copy="Reach out to the school or prepare an admission enquiry."
      />
    </PublicLayout>
  );
}

/* ADMISSIONS AND ENQUIRY FORM */

export function AdmissionsPage() {
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [classApplyingFor, setClassApplyingFor] = useState("");
  const [message, setMessage] = useState("");
  const [prepared, setPrepared] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `RESA Admission Enquiry - ${studentName}`;
    const body = [
      "ADMISSION ENQUIRY",
      "",
      `Parent/Guardian Name: ${parentName}`,
      `Phone Number: ${phone}`,
      `Email Address: ${email || "Not provided"}`,
      `Student Name: ${studentName}`,
      `Class Applying For: ${classApplyingFor}`,
      "",
      "Message:",
      message || "No additional message",
    ].join("\n");

    const mailto = `mailto:${schoolEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    setPrepared(true);
    window.location.href = mailto;
  }

  return (
    <PublicLayout>
      <PageIntro
        eyebrow="Admissions"
        title="Take the next step with RESA."
        copy="Interested in RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL? Send an enquiry to the school and share your questions with us."
        image="digital-learning-classroom.jpg"
        alt="Students in a digital learning classroom."
      />

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_.75fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">
            Admission enquiry
          </p>
          <h2 className="mt-4 font-serif text-3xl leading-tight text-[#214a37] sm:text-4xl">
            Tell us what you'd like to know.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#667168]">
            Complete the form below. Your email application will open with the
            enquiry prepared for you to review and send to the school.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 grid gap-5 rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-5 sm:p-7"
          >
            <div>
              <label htmlFor="parentName" className="mb-2 block text-sm font-semibold text-[#2b4837]">
                Parent or guardian name *
              </label>
              <input
                id="parentName"
                name="parentName"
                value={parentName}
                onChange={(event) => setParentName(event.target.value)}
                required
                autoComplete="name"
                className="w-full rounded-xl border border-[#dcd6c7] bg-white px-4 py-3 text-base outline-none focus:border-[#245b40] focus:ring-2 focus:ring-[#245b40]/15"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-[#2b4837]">
                Phone number *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                autoComplete="tel"
                className="w-full rounded-xl border border-[#dcd6c7] bg-white px-4 py-3 text-base outline-none focus:border-[#245b40] focus:ring-2 focus:ring-[#245b40]/15"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#2b4837]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-[#dcd6c7] bg-white px-4 py-3 text-base outline-none focus:border-[#245b40] focus:ring-2 focus:ring-[#245b40]/15"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="studentName" className="mb-2 block text-sm font-semibold text-[#2b4837]">
                Student's name *
              </label>
              <input
                id="studentName"
                name="studentName"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                required
                className="w-full rounded-xl border border-[#dcd6c7] bg-white px-4 py-3 text-base outline-none focus:border-[#245b40] focus:ring-2 focus:ring-[#245b40]/15"
                placeholder="Enter the student's name"
              />
            </div>

            <div>
              <label htmlFor="classApplyingFor" className="mb-2 block text-sm font-semibold text-[#2b4837]">
                Class applying for *
              </label>
              <input
                id="classApplyingFor"
                name="classApplyingFor"
                value={classApplyingFor}
                onChange={(event) => setClassApplyingFor(event.target.value)}
                required
                className="w-full rounded-xl border border-[#dcd6c7] bg-white px-4 py-3 text-base outline-none focus:border-[#245b40] focus:ring-2 focus:ring-[#245b40]/15"
                placeholder="Enter the class"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm font-semibold text-[#2b4837]">
                Message or question
              </label>
              <textarea
                id="message"
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-xl border border-[#dcd6c7] bg-white px-4 py-3 text-base outline-none focus:border-[#245b40] focus:ring-2 focus:ring-[#245b40]/15"
                placeholder="What would you like to know?"
              />
            </div>

            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#245b40] px-6 py-3 font-bold text-white transition hover:bg-[#17462f]"
            >
              Prepare admission enquiry <Send size={17} />
            </button>

            {prepared && (
              <p role="status" className="text-sm leading-6 text-[#245b40]">
                Your email application should open. Please review the details
                and send the email. The enquiry is not stored or sent
                automatically by this website.
              </p>
            )}
          </form>
        </div>

        <aside className="h-fit rounded-[1.75rem] border border-[#e7e1d3] bg-[#f1efe4] p-7 sm:p-9">
          <h3 className="font-serif text-2xl text-[#214a37]">
            Contact the school directly
          </h3>
          <p className="mt-3 text-sm leading-6 text-[#667168]">
            You can also contact RESA if you have questions about admissions
            or the school.
          </p>

          <a
            href="tel:+2348058422691"
            className="mt-6 flex items-center gap-3 text-sm font-semibold text-[#245b40]"
          >
            <Phone size={17} /> {schoolPhone}
          </a>

          <a
            href={`mailto:${schoolEmail}`}
            className="mt-4 flex items-center gap-3 break-all text-sm font-semibold text-[#245b40]"
          >
            <Mail size={17} /> {schoolEmail}
          </a>

          <div className="mt-8 border-t border-[#dcd6c7] pt-6">
            <MapPin size={20} className="text-[#9c8241]" />
            <h4 className="mt-3 font-bold text-[#245b40]">Visit us</h4>
            <p className="mt-2 text-sm leading-7 text-[#667168]">
              1, Smiling George Way, Opposite Winners' Chapel, Behind Matice,
              Sapele Road, Benin City.
            </p>
          </div>
        </aside>
      </section>

      <PageCta
        title="We look forward to hearing from you"
        copy="Contact the academy if you need further information about RESA."
      />
    </PublicLayout>
  );
}

/* CONTACT */

export function ContactPage() {
  return (
    <PublicLayout>
      <PageIntro
        eyebrow="Contact RESA"
        title="We'd be glad to hear from you."
        copy="Contact RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL in Benin City by phone or email, or find us at our listed school address."
        image="school-building-sign.jpg"
        alt="The school building and Rhema Exploits Science Academy sign."
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7">
            <MapPin className="text-[#9c8241]" />
            <h2 className="mt-5 font-serif text-2xl text-[#214a37]">Visit us</h2>
            <p className="mt-3 text-sm leading-7 text-[#667168]">
              1, Smiling George Way, Opposite Winners' Chapel, Behind Matice,
              Sapele Road, Benin City.
            </p>
          </article>

          <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7">
            <Mail className="text-[#9c8241]" />
            <h2 className="mt-5 font-serif text-2xl text-[#214a37]">Email</h2>
            <a
              href={`mailto:${schoolEmail}`}
              className="mt-3 block break-all text-sm font-semibold text-[#245b40] underline underline-offset-4"
              data-testid="contact-email"
            >
              {schoolEmail}
            </a>
          </article>

          <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7">
            <Phone className="text-[#9c8241]" />
            <h2 className="mt-5 font-serif text-2xl text-[#214a37]">Phone</h2>
            <a
              href="tel:+2348058422691"
              className="mt-3 block text-sm font-semibold text-[#245b40] underline underline-offset-4"
              data-testid="contact-phone"
            >
              {schoolPhone}
            </a>
          </article>
        </div>

        <div className="mt-10 rounded-[1.75rem] bg-[#f1efe4] px-7 py-9 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">
            Admission enquiry
          </p>
          <h2 className="mt-3 font-serif text-3xl text-[#214a37]">
            Have a question about joining RESA?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667168]">
            Visit the Admissions page to complete the enquiry form.
          </p>
          <Link
            href="/admissions"
            className="mt-6 inline-flex items-center gap-2 font-bold text-[#245b40] hover:underline"
            data-testid="contact-enquiry-link"
          >
            Open admission enquiry <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
