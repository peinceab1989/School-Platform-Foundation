import { Link } from "wouter";
import { ArrowRight, BookOpen, Lightbulb, MapPin, Phone, Mail, Wrench } from "lucide-react";
import { PublicLayout } from "@/components/public-site";

const media = (name: string) => `${import.meta.env.BASE_URL}media/photos/${name}`;

const gallery = [
  { file: "science-lab-activity.jpg", title: "Science laboratory activities", description: "Students working together during a science laboratory activity." },
  { file: "ict-classroom-workstations.jpg", title: "ICT classroom practice", description: "A student using a desktop computer at an ICT workstation." },
  { file: "cooking-and-baking-activities.jpg", title: "Cooking and baking", description: "Students taking part in a cooking and baking activity." },
  { file: "skill-acquisition-workshop.jpg", title: "Skill acquisition workshop", description: "Students learning practical woodworking skills in a workshop." },
  { file: "word-puzzle-activity.jpg", title: "Thinking together", description: "Students working together on a word puzzle activity." },
  { file: "basketball-sports-team.jpg", title: "Sports and fitness", description: "Students with a basketball during a sports activity." },
  { file: "digital-learning-classroom.jpg", title: "Digital classroom learning", description: "Students taking part in a digital learning class." },
  { file: "ict-digital-skills-lab.jpg", title: "ICT digital skills lab", description: "Computer workstations in the ICT and digital skills lab." },
  { file: "mental-development-games.jpg", title: "Mental development games", description: "Students playing a strategy board game together." },
  { file: "smartboard-classroom.jpg", title: "Learning with a smartboard", description: "Students following a lesson displayed on a classroom smartboard." },
  { file: "student-computer-lab.jpg", title: "Student computer lab", description: "A student working at a computer in the school computer lab." },
  { file: "student-using-computer.jpg", title: "Individual computer learning", description: "A student using a desktop computer for individual learning." },
];

function PageIntro({ eyebrow, title, copy, image, alt }: { eyebrow: string; title: string; copy: string; image?: string; alt?: string }) {
  return <section className="relative overflow-hidden border-b border-[#e7e1d3] bg-[#f1efe4]">
    <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr]">
      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#8b702e]">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.06] tracking-tight text-[#214a37] sm:text-5xl lg:text-[3.7rem]">{title}</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[#58665b] sm:text-lg">{copy}</p>
        <Link href="/admissions" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#245b40] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#17462f]" data-testid="intro-admissions-link">Explore admissions <ArrowRight size={17} /></Link>
      </div>
      {image && <div className="relative">
        <div className="absolute -inset-3 rotate-2 rounded-[2rem] border border-[#d6c58e]" aria-hidden="true" />
        <img src={media(image)} alt={alt ?? ""} className="relative aspect-[4/3] w-full rounded-[1.65rem] object-cover shadow-[0_18px_50px_rgba(35,64,45,.16)]" />
      </div>}
    </div>
  </section>;
}

function PageCta({ title = "Start a conversation with RESA", copy = "Ask us about the school and the admission enquiry process." }: { title?: string; copy?: string }) {
  return <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
    <div className="flex flex-col justify-between gap-6 rounded-[1.75rem] bg-[#245b40] px-7 py-9 text-white sm:flex-row sm:items-center sm:px-10">
      <div><h2 className="font-serif text-2xl sm:text-3xl">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#dce6d8]">{copy}</p></div>
      <Link href="/#admission-enquiry" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e4c879] px-5 py-3 text-sm font-bold text-[#254633] hover:bg-[#f0d993]" data-testid="cta-enquiry-link">Admission enquiry <ArrowRight size={16} /></Link>
    </div>
  </section>;
}

function TopicPage({ eyebrow, title, copy, image, alt, highlights, symbol }: { eyebrow: string; title: string; copy: string; image: string; alt: string; highlights: { title: string; text: string }[]; symbol: "light" | "book" | "tool" }) {
  const Icon = symbol === "light" ? Lightbulb : symbol === "book" ? BookOpen : Wrench;
  return <PublicLayout>
    <PageIntro eyebrow={eyebrow} title={title} copy={copy} image={image} alt={alt} />
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="grid gap-9 lg:grid-cols-[.7fr_1.3fr]">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">How learning takes shape</p><h2 className="mt-4 font-serif text-3xl leading-tight text-[#214a37] sm:text-4xl">Knowledge with room to become practice.</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {highlights.map((item, index) => <article key={item.title} className="rounded-2xl border border-[#e8e2d4] bg-[#fffef9] p-6 shadow-[0_6px_22px_rgba(42,56,43,.04)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9efdf] text-[#245b40]"><Icon size={21} /></span>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[.16em] text-[#9c8241]">0{index + 1}</p>
            <h3 className="mt-2 text-lg font-bold text-[#2b4837]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#667168]">{item.text}</p>
          </article>)}
        </div>
      </div>
    </section>
    <PageCta />
  </PublicLayout>;
}

export function InnovationTechnologyPage() {
  return <TopicPage eyebrow="Innovation & technology" title="Curiosity meets the digital world." copy="RESA brings academic learning together with science and technology, giving students space to explore ideas and build confidence with digital tools." image="ict-classroom-workstations.jpg" alt="A student practising at an ICT workstation." symbol="light" highlights={[
    { title: "Digital learning", text: "Students engage with computer-based learning and technology in the school’s ICT spaces." },
    { title: "Science and discovery", text: "Science learning encourages questions, exploration and thoughtful problem-solving." },
    { title: "Ideas into making", text: "Technology and creativity are part of a wider learning experience that values trying, testing and improving." },
    { title: "Skills for tomorrow", text: "Digital skills contribute to the academy’s broader focus on practical, future-facing learning." },
  ]} />;
}

export function PracticalSkillsPage() {
  return <TopicPage eyebrow="Practical skills" title="Learn by making, doing and solving." copy="Alongside academic learning, RESA gives practical skills a place in school life. Students can explore hands-on activities that call for care, creativity and problem-solving." image="skill-acquisition-workshop.jpg" alt="Students practising woodworking during a skills workshop." symbol="tool" highlights={[
    { title: "Workshop practice", text: "Students take part in skill acquisition activities such as woodworking." },
    { title: "Cooking and baking", text: "Cooking and baking activities invite students to learn through guided, practical participation." },
    { title: "Creative thinking", text: "Making and creating offer a chance to apply ideas, work carefully and think through challenges." },
    { title: "Productive confidence", text: "Practical experiences support the school’s aim to help students become capable and productive." },
  ]} />;
}

export function WisdomInspirationPage() {
  return <TopicPage eyebrow="Wisdom & inspiration" title="Character matters as much as knowledge." copy="RESA’s guiding phrase, “Passion, Skills and Excellent Spirit,” speaks to learning that develops the whole student: academically, creatively and in character." image="word-puzzle-activity.jpg" alt="Students working together on a word puzzle." symbol="book" highlights={[
    { title: "Excellent spirit", text: "The academy’s motto puts character and attitude alongside learning and skill." },
    { title: "Learning with others", text: "Group activities give students opportunities to listen, contribute and solve problems together." },
    { title: "Purpose and leadership", text: "RESA values the development of responsible, confident and purpose-driven young people." },
    { title: "A balanced approach", text: "Academic learning sits alongside creativity, practical skills and personal development." },
  ]} />;
}

export function ActivitiesGalleryPage() {
  return <PublicLayout>
    <PageIntro eyebrow="Activities & gallery" title="A closer look at learning in action." copy="Browse moments from RESA’s school life, from science and digital learning to practical workshops, thinking games and sport." image="science-lab-activity.jpg" alt="Students working together during a science laboratory activity." />
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">School moments</p><h2 className="mt-3 font-serif text-3xl text-[#214a37] sm:text-4xl">Explore our activities</h2></div>
        <p className="max-w-md text-sm leading-6 text-[#667168]">A selection of images from the academy’s existing school media.</p>
      </div>
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {gallery.map((item, index) => <figure key={item.file} className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-[#e7e1d3] bg-[#fffef9] shadow-[0_8px_24px_rgba(42,56,43,.06)]">
          <img src={media(item.file)} alt={item.description} loading="lazy" decoding="async" className="max-h-[440px] w-full bg-[#f2f0e7] object-cover" data-testid={`gallery-image-${index + 1}`} />
          <figcaption className="px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c8241]">RESA activities</p><h3 className="mt-1 font-bold text-[#2b4837]">{item.title}</h3></figcaption>
        </figure>)}
      </div>
    </section>
    <PageCta title="Want to know more about RESA?" copy="Reach out to the school or prepare an admission enquiry." />
  </PublicLayout>;
}

export function AdmissionsPage() {
  return <PublicLayout>
    <PageIntro eyebrow="Admissions" title="Take the next step with RESA." copy="Interested in RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL? Send an enquiry to the school and share your questions with us." image="digital-learning-classroom.jpg" alt="Students in a digital learning classroom." />
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_.8fr]">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">Connect with the academy</p><h2 className="mt-4 max-w-xl font-serif text-3xl leading-tight text-[#214a37] sm:text-4xl">Tell us what you’d like to know.</h2><p className="mt-5 max-w-xl text-base leading-8 text-[#667168]">Use the admission enquiry form on our home page to provide your contact details and a message. Submitting the form prepares an email in your email application; you review and send it yourself.</p>
        <Link href="/#admission-enquiry" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#245b40] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#17462f]" data-testid="admissions-form-link">Go to admission enquiry <ArrowRight size={17} /></Link>
      </div>
      <aside className="rounded-[1.75rem] border border-[#e7e1d3] bg-[#f1efe4] p-7 sm:p-9"><h3 className="font-serif text-2xl text-[#214a37]">Contact the school directly</h3><p className="mt-3 text-sm leading-6 text-[#667168]">For questions, use the verified contact details below.</p>
        <a href="tel:+2348058422691" className="mt-6 flex items-center gap-3 text-sm font-semibold text-[#245b40]" data-testid="admissions-phone"><Phone size={17} />+234 805 842 2691</a>
        <a href="mailto:rhemaexploitsacademy@gmail.com" className="mt-4 flex items-center gap-3 break-all text-sm font-semibold text-[#245b40]" data-testid="admissions-email"><Mail size={17} />rhemaexploitsacademy@gmail.com</a>
      </aside>
    </section>
    <PageCta title="Ready to make an enquiry?" copy="The enquiry form remains on the RESA home page, and clearly opens your mail app for you to review and send." />
  </PublicLayout>;
}

export function ContactPage() {
  return <PublicLayout>
    <PageIntro eyebrow="Contact RESA" title="We’d be glad to hear from you." copy="Contact RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL in Benin City by phone or email, or find us at our listed school address." image="school-building-sign.jpg" alt="The school building and Rhema Exploits Science Academy sign." />
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="grid gap-5 md:grid-cols-3">
        <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7"><MapPin className="text-[#9c8241]" /><h2 className="mt-5 font-serif text-2xl text-[#214a37]">Visit us</h2><p className="mt-3 text-sm leading-7 text-[#667168]">1, Smiling George Way, Opposite Winners&apos; Chapel, Behind Matice, Sapele Road, Benin City.</p></article>
        <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7"><Mail className="text-[#9c8241]" /><h2 className="mt-5 font-serif text-2xl text-[#214a37]">Email</h2><a href="mailto:rhemaexploitsacademy@gmail.com" className="mt-3 block break-all text-sm font-semibold text-[#245b40] underline underline-offset-4" data-testid="contact-email">rhemaexploitsacademy@gmail.com</a></article>
        <article className="rounded-2xl border border-[#e7e1d3] bg-[#fffef9] p-7"><Phone className="text-[#9c8241]" /><h2 className="mt-5 font-serif text-2xl text-[#214a37]">Phone</h2><a href="tel:+2348058422691" className="mt-3 block text-sm font-semibold text-[#245b40] underline underline-offset-4" data-testid="contact-phone">+234 805 842 2691</a></article>
      </div>
      <div className="mt-12 rounded-[1.75rem] bg-[#f1efe4] px-7 py-9 sm:px-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b702e]">Admission enquiry</p><h2 className="mt-3 font-serif text-3xl text-[#214a37]">Have a question about joining RESA?</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[#667168]">Share your details through the existing admission enquiry form on our home page. It prepares a mailto message addressed to the academy.</p><Link href="/#admission-enquiry" className="mt-6 inline-flex items-center gap-2 font-bold text-[#245b40] hover:underline" data-testid="contact-enquiry-link">Open admission enquiry <ArrowRight size={17} /></Link></div>
    </section>
  </PublicLayout>;
}
