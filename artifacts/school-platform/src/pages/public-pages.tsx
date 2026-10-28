
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Lightbulb,
  Mail,
  MapPin,
  Monitor,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { PublicLayout } from "@/components/public-site";

const SCHOOL = "RHEMA EXPLOITS SCIENCE ACADEMY INT’L";
const TAGLINE = "PASSION • SKILLS • EXCELLENT SPIRIT";
const ADDRESS =
  "1, Smiling George Way, Behind Matice, Opp. Winners’ Chapel, Sapele Road, Benin City, Edo State, Nigeria.";
const EMAIL = "rhemaexploitsacademy@gmail.com";
const PHONE = "08058422691";
const WHATSAPP = "08058422691";
const ADMISSIONS_PHONE = "08052159511";
const FACEBOOK = "https://www.facebook.com/share/1H2v8eruwR/";

const photos = {
  science: "science-lab-activity.jpg",
  ict: "ict-classroom-workstations.jpg",
  cooking: "cooking-and-baking-activities.jpg",
  workshop: "skill-acquisition-workshop.jpg",
  puzzles: "word-puzzle-activity.jpg",
  sports: "basketball-sports-team.jpg",
  learning: "digital-learning-classroom.jpg",
  digitalLab: "ict-digital-skills-lab.jpg",
  games: "mental-development-games.jpg",
  smartboard: "smartboard-classroom.jpg",
  computerLab: "student-computer-lab.jpg",
  studentComputer: "student-using-computer.jpg",
};

function imageUrl(file: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}media/photos/${file}`;
}

function PageHero({
  eyebrow,
  title,
  description,
  image,
}: {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#103b2d] text-white">
      <div className="absolute inset-0 -z-10">
        <img
          src={imageUrl(image)}
          alt=""
          className="h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09271e] via-[#103b2d]/95 to-[#103b2d]/55" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9bd76]/50 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#f0d995]">
            <Sparkles size={15} />
            {eyebrow}
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
            {description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admissions"
              className="inline-flex items-center gap-2 rounded-xl bg-[#d8b765] px-6 py-3.5 font-bold text-[#153b2c] shadow-[0_8px_0_#98783a,0_16px_30px_#0003] transition hover:-translate-y-1 hover:shadow-[0_10px_0_#98783a,0_20px_35px_#0003]"
            >
              Explore Admissions <ArrowRight size={18} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-6 py-3.5 font-bold text-white transition hover:bg-white/20"
            >
              Contact RESA
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-3 rotate-3 rounded-[2rem] border border-[#d8b765]/60 bg-[#d8b765]/10" />
          <div className="relative overflow-hidden rounded-[1.7rem] border border-white/20 bg-white/10 p-2 shadow-2xl backdrop-blur-sm">
            <img
              src={imageUrl(image)}
              alt={`${SCHOOL} learning environment`}
              className="h-72 w-full rounded-[1.2rem] object-cover sm:h-96"
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/20 bg-[#103b2d]/90 p-4 backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e5ca7d]">
                Learn • Create • Lead
              </p>
              <p className="mt-1 text-lg font-extrabold">
                Knowledge with practical skills
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-[#a17c32]">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-black tracking-tight text-[#163c2e] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-8 text-slate-600">
          {description}
        </p>
      )}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  number,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  number: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#e7e0cf] bg-white p-6 shadow-[0_5px_0_#e9e1d1,0_14px_30px_#173b2b0d] transition duration-300 hover:-translate-y-2 hover:border-[#c9ad66] hover:shadow-[0_8px_0_#c9ad66,0_22px_35px_#173b2b18]">
      <span className="absolute right-5 top-4 text-4xl font-black text-[#163c2e]/[0.06]">
        {number}
      </span>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf1e9] text-[#20553d] shadow-[inset_0_-4px_0_#d4e1d2] transition group-hover:rotate-3 group-hover:bg-[#163c2e] group-hover:text-[#e9cf81]">
        <Icon size={27} />
      </div>
      <h3 className="text-xl font-extrabold text-[#173d2e]">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{description}</p>
    </article>
  );
}

function PhotoCard({
  image,
  title,
  description,
}: {
  image: string;
  title: string;
  description: string;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[#e8e0ce] bg-white shadow-[0_5px_0_#e8e0ce,0_14px_28px_#173b2b0d] transition duration-300 hover:-translate-y-2 hover:shadow-xl">
      <div className="relative overflow-hidden">
        <img
          src={imageUrl(image)}
          alt={title}
          loading="lazy"
          className="h-56 w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#103b2d]/60 to-transparent opacity-70" />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-extrabold text-[#173d2e]">{title}</h3>
        <p className="mt-3 leading-7 text-slate-600">{description}</p>
      </div>
    </article>
  );
}

function CallToAction() {
  return (
    <section className="px-5 py-16 sm:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#103b2d] px-6 py-12 text-white shadow-[0_8px_0_#09271e,0_24px_45px_#103b2d25] sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[35px] border-white/[0.05]" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-[#d8b765]/10 blur-2xl" />
        <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7cc80]">
              Your child’s future matters
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Give learning a practical purpose.
            </h2>
            <p className="mt-4 leading-8 text-white/75">
              Discover a learning environment where science, technology,
              character and practical skills work together.
            </p>
          </div>
          <Link
            href="/admissions"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d8b765] px-6 py-4 font-extrabold text-[#153b2c] shadow-[0_6px_0_#98783a] transition hover:-translate-y-1"
          >
            Start Admission Enquiry <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AboutPage() {
  const values = [
    ["Respect", "We respect parents, teachers, students, the community and every school stakeholder."],
    ["Innovation", "We encourage visionary thinking, curiosity and ideas that can shape a better future."],
    ["Integrity", "We promote honesty, transparency, godliness and personal responsibility."],
    ["Empathy", "We encourage intentional care, love, attention and consideration for others."],
    ["Godliness", "We uphold godly principles in our communication, actions and school life."],
    ["Morality", "We teach learners to uphold ethical principles and do what is right."],
  ];

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Discover RESA"
        title="About RESA"
        description="A science- and technology-focused learning community committed to practical skills, excellent character and the development of future leaders."
        image={photos.science}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a17c32]">
              Who we are
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#163c2e] sm:text-4xl">
              Passion for learning. Skills for life.
            </h2>
            <p className="mt-5 leading-8 text-slate-600">
              {SCHOOL} is committed to helping learners build a strong
              educational foundation through science, technology, creativity,
              practical activities and values-based development.
            </p>
            <p className="mt-4 leading-8 text-slate-600">
              We believe that education should go beyond memorising facts. It
              should equip learners to ask questions, solve problems, work
              responsibly with others and apply their knowledge to real-life
              situations.
            </p>
            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#e4dcc8] bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e9f0e7] text-[#20553d]">
                <ShieldCheck size={25} />
              </div>
              <div>
                <p className="font-extrabold text-[#163c2e]">
                  Character and responsibility
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Learning supported by integrity, respect and godliness.
                </p>
              </div>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-3 rotate-2 rounded-3xl bg-[#d8b765]/35" />
            <img
              src={imageUrl(photos.ict)}
              alt="Students learning in the ICT classroom"
              className="relative h-80 w-full rounded-3xl border-4 border-white object-cover shadow-2xl sm:h-[27rem]"
            />
            <div className="absolute -bottom-5 -left-2 rounded-2xl border border-[#e7dec9] bg-white p-4 shadow-xl sm:-left-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#a17c32]">
                Our guiding principle
              </p>
              <p className="mt-1 font-black text-[#163c2e]">
                Passion • Skills • Excellent Spirit
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-8 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-[#163c2e] p-7 text-white shadow-[0_7px_0_#0a291e] sm:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-[#e7cc80]">
              <Target size={26} />
            </div>
            <h2 className="mt-5 text-2xl font-black">Our Vision</h2>
            <p className="mt-4 leading-8 text-white/80">
              To raise preferred leaders, builders and helpers of witty
              scientific innovations through diligence and divine inspiration
              with passion for skills and entrepreneurial spirit that transform
              the nation for global impact.
            </p>
          </div>
          <div className="rounded-3xl border border-[#e7dec9] bg-[#faf8f1] p-7 shadow-[0_7px_0_#e7dec9] sm:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e4ecdf] text-[#20553d]">
              <Lightbulb size={26} />
            </div>
            <h2 className="mt-5 text-2xl font-black text-[#163c2e]">
              Our Mission
            </h2>
            <p className="mt-4 leading-8 text-slate-600">
              We aim to deliver quality science and technology-focused
              education that nurtures curiosity, spiritual growth, problem
              solving skills, and ethical responsibility while preparing
              students for higher education and future careers.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="The RESA standard"
            title="Our Core Values"
            description="The principles that guide our learning, relationships and everyday decisions."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map(([title, description], i) => (
              <FeatureCard
                key={title}
                icon={[Heart, Lightbulb, ShieldCheck, Users, Star, CheckCircle2][i]}
                title={title}
                description={description}
                number={`0${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e7dec9] bg-[#faf8f1] p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-[#a17c32]">
              Founder / Proprietor
            </p>
            <h3 className="mt-2 text-xl font-black text-[#163c2e]">
              PST. BLESSING JAMES OKEH
            </h3>
          </div>
          <div className="rounded-2xl border border-[#e7dec9] bg-[#faf8f1] p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-[#a17c32]">
              Principal / Head of School
            </p>
            <h3 className="mt-2 text-xl font-black text-[#163c2e]">
              MR. EVANS OSAYANDE AMASIHOHU
            </h3>
          </div>
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function AcademicsPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Academic excellence"
        title="Academics & Development"
        description="Building knowledge, confidence, curiosity and the skills learners need for further education and a changing world."
        image={photos.smartboard}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="A strong foundation"
            title="Learning beyond the textbook"
            description="Our educational approach brings together academic foundations, practical application, digital awareness and personal development."
          />
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard number="01" icon={BookOpen} title="Academic Foundations" description="Support learners in developing knowledge, communication, critical thinking and independent learning habits." />
            <FeatureCard number="02" icon={Brain} title="Mental Development" description="Encourage reasoning, creativity, problem-solving and intellectual curiosity through purposeful activities." />
            <FeatureCard number="03" icon={GraduationCap} title="Personal Growth" description="Build confidence, teamwork, responsibility and readiness for future educational opportunities." />
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center">
          <img src={imageUrl(photos.learning)} alt="Digital learning environment" className="h-80 w-full rounded-3xl object-cover shadow-xl" loading="lazy" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a17c32]">Our approach</p>
            <h2 className="mt-3 text-3xl font-black text-[#163c2e]">Helping every learner grow</h2>
            <p className="mt-4 leading-8 text-slate-600">Effective education connects classroom learning with practice, discussion, projects and reflection. We aim to nurture learners who can understand concepts and use their knowledge thoughtfully.</p>
            <ul className="mt-6 space-y-3">
              {["Curiosity and active participation", "Problem-solving and practical activities", "Responsible use of technology", "Character, confidence and collaboration"].map(item => (
                <li key={item} className="flex gap-3 text-slate-700"><CheckCircle2 className="mt-1 shrink-0 text-[#34734d]" size={19} />{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function InnovationTechnologyPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Future-ready learning"
        title="Innovation & Technology"
        description="Introducing learners to digital tools, scientific thinking, computing and the confidence to explore how technology works."
        image={photos.digitalLab}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Explore and create" title="Technology with purpose" description="We want learners to understand technology as a tool for learning, creating, communicating and solving problems." />
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard number="01" icon={Monitor} title="Digital Literacy" description="Develop familiarity with computers, digital learning tools, online responsibility and essential technology skills." />
            <FeatureCard number="02" icon={Cpu} title="Computing & Coding" description="Build foundations in computational thinking, logical reasoning and introductory programming concepts." />
            <FeatureCard number="03" icon={FlaskConical} title="Scientific Exploration" description="Encourage learners to observe, ask questions, investigate ideas and connect scientific concepts with real life." />
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2">
          <PhotoCard image={photos.computerLab} title="Computing in practice" description="A learning environment for building confidence with computer systems and digital tools." />
          <PhotoCard image={photos.science} title="Science through exploration" description="Encouraging observation, inquiry and a practical approach to understanding the world." />
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function PracticalSkillsPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Skills for life"
        title="Practical Skills & Entrepreneurship"
        description="Giving learners opportunities to explore useful skills, creative thinking, teamwork and the foundations of enterprise."
        image={photos.workshop}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Learning by doing" title="Turn ideas into practical ability" description="Practical education helps learners connect ideas with action, develop confidence and discover interests that may grow into future opportunities." />
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard number="01" icon={Wrench} title="Practical Workshops" description="Build an appreciation for tools, making, careful processes, safety and solving everyday problems." />
            <FeatureCard number="02" icon={Lightbulb} title="Creativity & Enterprise" description="Explore ideas, resourcefulness, teamwork and how useful products or services can address needs." />
            <FeatureCard number="03" icon={Users} title="Collaboration" description="Develop communication, planning, responsibility and the ability to work constructively with others." />
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2">
          <PhotoCard image={photos.cooking} title="Cooking & creative skills" description="Practical activities can help learners develop patience, planning and useful everyday abilities." />
          <PhotoCard image={photos.workshop} title="Skills acquisition" description="Hands-on experiences encourage learners to explore their strengths and practise new skills." />
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function WisdomInspirationPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Wisdom • Character • Purpose"
        title="Wisdom & Inspiration"
        description="Nurturing integrity, godliness, empathy, responsibility and the desire to use knowledge to make a positive difference."
        image={photos.puzzles}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Character matters" title="Knowledge guided by wisdom" description="Education is most meaningful when learning is accompanied by good judgement, respect for others and a sense of responsibility." />
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard number="01" icon={Heart} title="Empathy & Respect" description="Encouraging kindness, listening, cooperation and respect for the dignity of others." />
            <FeatureCard number="02" icon={ShieldCheck} title="Integrity & Morality" description="Promoting honesty, accountability, ethical choices and doing what is right." />
            <FeatureCard number="03" icon={Star} title="Purpose & Inspiration" description="Helping learners recognise their potential and apply their abilities constructively." />
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center">
          <img src={imageUrl(photos.games)} alt="Learners engaged in a mental development activity" className="h-80 w-full rounded-3xl object-cover shadow-xl" loading="lazy" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a17c32]">Our commitment</p>
            <h2 className="mt-3 text-3xl font-black text-[#163c2e]">Developing the whole learner</h2>
            <p className="mt-4 leading-8 text-slate-600">We want learners to grow intellectually, socially and morally. Through everyday school life, they can practise responsibility, thoughtful decision-making, compassion and respect.</p>
          </div>
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function ActivitiesGalleryPage() {
  const activities = [
    { image: photos.science, title: "Science activities", description: "Exploring scientific ideas through practical learning." },
    { image: photos.ict, title: "ICT & computing", description: "Building confidence with digital tools and computer skills." },
    { image: photos.cooking, title: "Cooking & baking", description: "Developing creativity and practical everyday skills." },
    { image: photos.workshop, title: "Skills workshop", description: "Learning by doing and practising new abilities." },
    { image: photos.puzzles, title: "Mental development", description: "Encouraging reasoning, concentration and problem-solving." },
    { image: photos.sports, title: "Sports & teamwork", description: "Promoting participation, cooperation and team spirit." },
    { image: photos.smartboard, title: "Digital learning", description: "Connecting lessons with modern learning tools." },
    { image: photos.studentComputer, title: "Computer practice", description: "Developing practical familiarity with computer systems." },
  ];

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Life at RESA"
        title="School Activities & Gallery"
        description="Explore learning, creativity, practical experiences and teamwork across our school community."
        image={photos.sports}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Moments of growth" title="Explore our learning experiences" description="A selection of school activity photographs. More photographs and updates can be added as the school gallery grows." />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map(activity => <PhotoCard key={activity.title} {...activity} />)}
          </div>
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function AdmissionsPage() {
  const steps = [
    ["Make an enquiry", "Contact the school to ask about admission and class placement."],
    ["Visit or speak with the school", "Discuss your child's needs and the available admission process."],
    ["Prepare the required documents", "Ask the school to confirm any additional documents needed for your application."],
    ["Confirm next steps", "Contact the admissions team for current requirements, payment guidance and resumption details."],
  ];

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Join our community"
        title="Admissions at RESA"
        description="Take the next step towards a learning experience built around academic foundations, practical skills, technology and character."
        image={photos.learning}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionHeading eyebrow="Your admission journey" title="A clear path to enrolment" description="Our admissions team can guide parents and guardians through the current process and answer questions about placement." />
            <div className="space-y-4">
              {steps.map(([title, description], index) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-[#e7dec9] bg-white p-5 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#163c2e] font-black text-[#e7cc80]">{index + 1}</div>
                  <div>
                    <h3 className="font-extrabold text-[#163c2e]">{title}</h3>
                    <p className="mt-2 leading-7 text-slate-600">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="h-fit rounded-3xl border border-[#e7dec9] bg-white p-7 shadow-[0_7px_0_#e7dec9,0_18px_35px_#173b2b0d] sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9f0e7] text-[#20553d]"><GraduationCap size={30} /></div>
            <h2 className="mt-5 text-2xl font-black text-[#163c2e]">Admission enquiry</h2>
            <p className="mt-3 leading-7 text-slate-600">Please contact the school to confirm current admission availability, fees, documents and other requirements before making payment.</p>
            <div className="mt-6 rounded-2xl bg-[#faf8f1] p-5">
              <p className="text-sm font-bold text-slate-500">Admission fee (as provided by the school)</p>
              <p className="mt-1 text-3xl font-black text-[#163c2e]">₦10,000</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Confirm the current fee and payment instructions directly with the school.</p>
            </div>
            <div className="mt-5 rounded-2xl border border-[#e7dec9] p-5">
              <p className="font-extrabold text-[#163c2e]">Document to prepare</p>
              <p className="mt-2 leading-7 text-slate-600">Four (4) recent passport photographs. Please confirm whether any additional documents are required.</p>
            </div>
            <a href={`tel:${ADMISSIONS_PHONE}`} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#163c2e] px-5 py-4 font-extrabold text-white shadow-[0_5px_0_#09271e] transition hover:-translate-y-1">
              <Phone size={18} /> Call Admissions
            </a>
            <a href={`https://wa.me/2348058422691`} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d7dfd3] bg-[#edf4e9] px-5 py-4 font-extrabold text-[#20553d] transition hover:bg-[#e0ebdc]">
              Enquire on WhatsApp <ArrowRight size={18} />
            </a>
          </aside>
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}

export function ContactPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="We are here to help"
        title="Contact Us"
        description="Reach out to RESA for admissions enquiries, school information and questions about our learning programmes."
        image={photos.ict}
      />
      <section className="bg-[#faf8f1] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Get in touch" title="We would love to hear from you" description="Contact the appropriate school line or send an email. For current admissions details, please speak directly with the school." />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard number="01" icon={MapPin} title="Visit the school" description={ADDRESS} />
            <FeatureCard number="02" icon={Phone} title="Call the school" description={`Main line: ${PHONE}. Admissions and customer care: ${ADMISSIONS_PHONE}.`} />
            <FeatureCard number="03" icon={Mail} title="Send an email" description={EMAIL} />
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <a href={`tel:${PHONE}`} className="flex items-center justify-center gap-3 rounded-2xl bg-[#163c2e] p-5 font-extrabold text-white shadow-[0_5px_0_#09271e] transition hover:-translate-y-1">
              <Phone size={20} /> Call RESA
            </a>
            <a href="https://wa.me/2348058422691" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 rounded-2xl border border-[#d7dfd3] bg-[#eaf2e7] p-5 font-extrabold text-[#20553d] transition hover:-translate-y-1">
              <Phone size={20} /> WhatsApp: {WHATSAPP}
            </a>
            <a href={`mailto:${EMAIL}`} className="flex items-center justify-center gap-3 rounded-2xl border border-[#e7dec9] bg-white p-5 font-extrabold text-[#163c2e] transition hover:-translate-y-1">
              <Mail size={20} /> Email RESA
            </a>
            <a href={FACEBOOK} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 rounded-2xl border border-[#e7dec9] bg-white p-5 font-extrabold text-[#163c2e] transition hover:-translate-y-1">
              <Users size={20} /> Follow us on Facebook
            </a>
          </div>
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-xl font-black text-[#163c2e]">School hours</h3>
            <p className="mt-2 leading-7 text-slate-600">7:00 AM – 4:00 PM. Please contact the school to confirm arrangements before visiting.</p>
          </div>
        </div>
      </section>
      <CallToAction />
    </PublicLayout>
  );
}
