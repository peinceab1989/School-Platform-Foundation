export type LocalHelpResult = { answer: string; topic: string } | null;

const CONTACT_EMAIL = "rhemaexploitsacademy@gmail.com";

const helpEntries: Array<{ topic: string; match: RegExp; answer: string }> = [
  {
    topic: "school_identity",
    match: /\b(what school|about (the )?school|school name|resa|rhema exploits|motto)\b/i,
    answer: "RESA is Rhema Exploits Science Academy International, based in Benin City, Nigeria. The school motto is “Passion • Skills • Excellent Spirit”. For official information that is not shown on the website, please contact the school administration.",
  },
  {
    topic: "admissions",
    match: /\b(admission|admissions|apply|application|enrol|enroll|enrolment|enrollment|admission form)\b/i,
    answer: "For admission enquiries, please use the Admission Enquiry section on the RESA website. It prepares an email to the school; your enquiry is not an application approval or a paid admission form. The school must confirm current requirements, availability and fees. Contact " + CONTACT_EMAIL + " if the email form does not open.",
  },
  {
    topic: "fees_and_payments",
    match: /\b(school fees|tuition|fee|fees|payment|paystack|receipt|bank account|account number)\b/i,
    answer: "For current school fees, payment instructions or receipt confirmation, please contact the RESA Finance Office through the official school channels. Do not send card details, PINs, passwords or one-time codes in this chat. I cannot verify a payment or confirm a balance.",
  },
  {
    topic: "portal_access",
    match: /\b(login|log in|sign in|password|portal|dashboard|forgot password|reset password)\b/i,
    answer: "To access the RESA Portal, open the official portal website and use the sign-in option for your account. If you cannot sign in, use the password-reset option or contact an authorised school administrator. Never share your password or one-time code in chat. I cannot access or change your account.",
  },
  {
    topic: "results_and_academics",
    match: /\b(result|results|report card|grade|grades|exam|examination|cbt|timetable|assignment|homework)\b/i,
    answer: "Published academic information is available through the appropriate signed-in student or parent dashboard when the school has released it. Please sign in to the RESA Portal. If an item is missing or appears incorrect, contact the class teacher or school administration. I cannot view private learner records.",
  },
  {
    topic: "attendance",
    match: /\b(attendance|absent|absence|late|check.?in|check.?out|biometric|qr code)\b/i,
    answer: "Attendance information is handled in the RESA Portal. Sign in with your authorised account and open the relevant attendance section. For corrections or questions about a particular learner or staff record, contact the school office. I cannot inspect or amend attendance records.",
  },
  {
    topic: "contact",
    match: /\b(contact|email|phone number|reach the school|customer care|customer support|speak to|talk to)\b/i,
    answer: "You can contact RESA through the public Ask RESA/Customer Care service on the school website or email " + CONTACT_EMAIL + ". Please do not post passwords, payment-card details or sensitive student records in a public chat.",
  },
  {
    topic: "school_hours_and_calendar",
    match: /\b(opening hours|school hours|working hours|school calendar|holiday|holidays|term dates|resumption|closing time)\b/i,
    answer: "School opening hours, term dates, holidays and special closures must be confirmed from the current school calendar or an official school notice. I do not have a verified live calendar in this local help mode, so I will not guess dates or hours. Please contact the school administration for confirmation.",
  },
];

export function getLocalHelpAnswer(question: string): LocalHelpResult {
  const text = question.trim();
  if (!text || text.length > 1200) return null;
  const entry = helpEntries.find((candidate) => candidate.match.test(text));
  if (entry) return { answer: entry.answer, topic: entry.topic };

  return {
    topic: "general",
    answer: "I’m the RESA website’s local help assistant. I can guide you with general information about the school, admissions enquiries, fees, portal access, results, attendance and contacting the school. I cannot access private records, confirm payments, make admission decisions or change account settings. Please rephrase your question or contact " + CONTACT_EMAIL + " for an official response.",
  };
}
