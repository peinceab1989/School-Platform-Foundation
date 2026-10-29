import { type FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

const admissionsEmail = "Resainternational2024@gmail.com";

export default function AdmissionEnquiryForm() {
  const [enquiryPrepared, setEnquiryPrepared] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
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
    <div
      id="admission-enquiry"
      className="scroll-mt-28 rounded-3xl bg-[#fffef9] p-6 text-[#283b30] shadow-[0_18px_50px_rgba(35,64,45,.12)] sm:p-8"
      aria-labelledby="admission-form-heading"
      data-testid="admission-enquiry-form"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-[#245b40]">
        RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL
      </p>
      <h2
        id="admission-form-heading"
        className="mt-2 text-2xl font-black sm:text-3xl"
      >
        Admission enquiry
      </h2>
      <p className="mt-3 leading-7 text-[#667168]">
        Share a few details and we’ll prepare an enquiry email addressed to
        the school.
      </p>

      <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="parentName"
            className="mb-2 block text-sm font-semibold text-[#283b30]"
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
            className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-[#283b30] placeholder:text-[#85897f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
            data-testid="input-parent-name"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-2 block text-sm font-semibold text-[#283b30]"
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
            className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-[#283b30] placeholder:text-[#85897f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
            data-testid="input-phone"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-[#283b30]"
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
            className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-[#283b30] placeholder:text-[#85897f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
            data-testid="input-email"
          />
        </div>

        <div>
          <label
            htmlFor="studentName"
            className="mb-2 block text-sm font-semibold text-[#283b30]"
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
            className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-[#283b30] placeholder:text-[#85897f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
            data-testid="input-student-name"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="classApplyingFor"
            className="mb-2 block text-sm font-semibold text-[#283b30]"
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
            className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-[#283b30] placeholder:text-[#85897f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
            data-testid="input-class-applying-for"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="message"
            className="mb-2 block text-sm font-semibold text-[#283b30]"
          >
            Message <span className="font-normal text-[#667168]">(optional)</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            maxLength={3000}
            placeholder="Add any questions or details you would like the school to know."
            className="w-full resize-y rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-[#283b30] placeholder:text-[#85897f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648451]"
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

          <p className="mt-4 text-sm leading-6 text-[#667168]">
            Submitting opens your email app with the enquiry ready to send. If
            it doesn&apos;t open, email{" "}
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
              Your email app should now show the completed enquiry. Review it
              and press send to contact the school.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
