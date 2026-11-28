export type ResaChatMessage = { role: "user" | "assistant"; content: string };

export function localFaqAnswer(messages: ResaChatMessage[]): string {
  const question = messages.filter((message) => message.role === "user").at(-1)?.content
    .toLowerCase().replace(/\s+/g, " ").trim() ?? "";

  if (/^(hi|hello|good morning|good afternoon|good evening|greetings)\b/.test(question)) {
    return "Hello! Welcome to Rhema Exploits Science Academy International (RESA). I can help with general school information and portal guidance. What would you like to know?";
  }
  if (/(admission|apply|application|admission form|form number|enrol|enroll)/.test(question)) {
    return "For admission, open the Admissions section on the official RESA website and follow the current application instructions. A form number is issued only after the admission-form payment has been successfully verified; an enquiry alone does not issue a form number. Please use the fee and availability displayed by the official school checkout or confirm them with the school office. Do not send bank details, card information or passwords in chat.";
  }
  if (/(fee|fees|tuition|school fee|how much|price|cost)/.test(question)) {
    return "I cannot confirm a current RESA fee from this public help service. Please check the official fee information in the RESA portal or contact the school Finance Office. Do not pay into an account or use payment instructions that have not been confirmed by the school.";
  }
  if (/(pay|payment|paystack|receipt|transaction)/.test(question)) {
    return "Use only the payment option shown inside the official RESA website or portal. Keep your provider reference and receipt. A payment is treated as successful only after the server verifies it; a screenshot or enquiry is not proof of payment. If a verified payment is not reflected, contact the school Finance Office with the transaction reference—never share your card PIN, password or one-time code.";
  }
  if (/(login|log in|sign in|password|portal|dashboard|account)/.test(question)) {
    return "To access the portal, open the official RESA website and choose the sign-in option for your account. Use the account invitation or password-reset process if you have not activated your account or cannot sign in. Students, parents and staff should use their own assigned accounts. Never share a password or one-time code with anyone.";
  }
  if (/(calendar|holiday|resumption|resume|school day|opening date|closing date|timetable)/.test(question)) {
    return "RESA's school calendar and timetable are controlled by the school administration. Please check the latest notice on the official website or your signed-in dashboard. I cannot confirm an unannounced holiday, resumption date or timetable change.";
  }
  if (/(contact|address|location|where.*school|phone|email|customer care|customer-care)/.test(question)) {
    return "You are speaking with the RESA information assistant for Rhema Exploits Science Academy International in Benin City, Nigeria. For a current phone number, exact street address or an official response, use the Contact or Ask RESA section on the official school website so you receive verified details.";
  }
  if (/(result|exam|examination|cbt|score|attendance|assignment|student record|my child)/.test(question)) {
    return "For results, CBT, attendance, assignments or any individual learner record, please sign in to the appropriate RESA account. This public help service cannot access or disclose private student records. If something looks incorrect, contact an authorised school administrator.";
  }
  if (/(teacher|staff|appointment|admin|administrator|principal|proprietor)/.test(question)) {
    return "For staff appointments, administrator access or official school decisions, please contact the school administration through the official RESA website. This assistant cannot confirm appointments, grant access or change account permissions.";
  }
  if (/(motto|mission|name of the school|school name)/.test(question)) {
    return "The school is Rhema Exploits Science Academy International (RESA). Its motto is “Passion • Skills • Excellent Spirit”.";
  }
  return "I can provide basic RESA website, admissions, payment-safety and portal-navigation guidance, but the free local help service is not connected to a live AI provider right now. For a question outside those topics, please use Ask RESA to contact the school team or speak with an authorised administrator. I will not guess fees, dates, policies or private account information.";
}