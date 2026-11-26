import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useLocation } from "wouter";
import { Bot, MapPin, MessageCircle, Send, X, ArrowUpRight, RotateCcw } from "lucide-react";

type HelpTopic = {
  keys: string[];
  title: string;
  answer: string;
  href: string;
};
type ChatMessage = { role: "user" | "assistant"; content: string };
type CustomerCareAvailability = { availability_enabled:boolean; availability_days:number[]; availability_start:string; availability_end:string; timezone:string; website_popup_enabled:boolean; soft_sound_enabled:boolean };
const RESA_SCHOOL_ID = "469a9ed9-8e6c-45b8-a76c-89536adb1d3d";

const helpTopics: HelpTopic[] = [
  { keys: ["attendance", "clock in", "clock out", "biometric", "check in", "check out"], title: "Attendance", answer: "Administrators can review daily attendance and manage registered devices in Smart Attendance Centre. Teachers and other users should use the attendance options available to their assigned role. If a device or scan fails, do not create a duplicate record; ask an authorised administrator to review it.", href: "/attendance" },
  { keys: ["result", "results", "report card", "grade", "score"], title: "Results", answer: "Students and parents can view results after the school publishes them. Authorised staff use Results Management to enter, review and publish results. Unpublished results may not appear in student or parent accounts.", href: "/results-management" },
  { keys: ["fee", "fees", "payment", "receipt", "school fees"], title: "Fees and payments", answer: "Parents can review available fee information from the parent dashboard. Payments and receipts must follow the school's finance verification process. A payment should not be treated as confirmed until an authorised finance officer verifies it.", href: "/fees-management" },
  { keys: ["assignment", "assignments", "homework", "project", "practical"], title: "Assignments", answer: "Teachers publish assignments for their assigned classes and subjects. Students open published work from their assignments area and submit the requested evidence. Only the assigned teacher and authorised school staff should review private submissions.", href: "/student-assignments" },
  { keys: ["cbt", "exam", "examination", "test"], title: "Examinations and CBT", answer: "Students can access examinations that have been published for their class and session. Teachers and administrators manage examinations through their authorised examination tools. If an exam is missing, check its publication status and class/session assignment.", href: "/examinations" },
  { keys: ["map", "maps", "direction", "directions", "location", "where is resa", "address"], title: "Maps and directions", answer: "Open RESA Maps & Places to search for destinations, view the school location and open live directions in Google Maps. Route times and road conditions are supplied by Google Maps and can change.", href: "/maps" },
  { keys: ["teacher", "class", "classes", "subject", "assign teacher", "teaching assignment"], title: "Classes and teaching assignments", answer: "Administrators maintain classes and subjects and assign teachers to the correct class, subject and academic session. Teachers should only work with classes and subjects assigned to their account.", href: "/teaching-assignments" },
  { keys: ["admission", "admissions", "enrolment", "enrollment", "register student"], title: "Admissions and enrolment", answer: "Admissions staff manage applications and admission decisions. After approval, authorised staff should complete the learner's class enrolment for the correct academic session. Do not create a second student record to solve a linking issue.", href: "/admissions-management" },
  { keys: ["staff", "invite teacher", "staff invitation", "approve teacher"], title: "Staff accounts", answer: "Administrators use Staff Invitations to invite and manage staff access. Only approve a person after verifying their identity and role. Existing accounts and permissions should not be changed casually.", href: "/staff-invitations" },
  { keys: ["parent", "guardian", "link child", "link learner"], title: "Parents and guardians", answer: "Parent accounts should only be linked to learners after the relationship and learner details have been verified by authorised school staff. Parents can then view information for learners linked to their account.", href: "/parent-management" },
  { keys: ["drive", "upload", "photo", "video", "file"], title: "RESA Drive", answer: "RESA Drive is used for school-managed files and media. Uploads should follow the school's file-size and access rules. If a file does not appear after upload, check its upload status before uploading it again.", href: "/school-services" },
  { keys: ["message", "messages", "communication", "announcement", "chat", "customer care", "contact admin", "support"], title: "RESA Communication Centre", answer: "Open RESA Chat to contact an administrator through in-app Customer Care, or start a private conversation with another school member when the administrator has enabled that sender-to-recipient permission. Choose a recipient category first; if access is not enabled, ask the school administrator. New messages appear in the recipient's portal inbox and phone alerts when enabled.", href: "/resa-chat?channel=customer_care" },
  { keys: ["settings", "school profile", "school information"], title: "School settings", answer: "School settings should only be changed by authorised administrators. Confirm the academic session, term and school details before saving changes that affect the wider portal.", href: "/school-settings" },
  { keys: ["school name", "about resa", "about the school", "school motto", "motto"], title: "About RESA", answer: "Rhema Exploits Science Academy International (RESA) is in Benin City, Edo State. The school motto is PASSION • SKILLS • EXCELLENT SPIRIT. For official school information and current announcements, contact the school directly.", href: "/" },
  { keys: ["school address", "resa address", "school location", "where is the school", "school phone", "school email", "contact resa", "contact the school"], title: "School contact and location", answer: "Rhema Exploits Science Academy International is at 1 Smiling George Way, Behind Mat Ice, Opp. Winners’ Chapel, Sapele Road, Benin City, Edo State, Nigeria. Phone: +234 805 842 2691. Email: rhemaexploitsacademy@gmail.com.", href: "/maps" },
  { keys: ["apply for admission", "how to apply", "admission process", "admission form"], title: "How to enquire about admission", answer: "Use the Admissions section of the RESA website to review the application route and submit the required details. Admission availability, current requirements, fees and decisions must be confirmed by the school; Ask RESA cannot approve an application or confirm a place.", href: "/admissions" },
  { keys: ["forgot password", "reset password", "cannot log in", "login problem", "sign in problem"], title: "Login and password help", answer: "Use the portal’s official password-reset option if it is available on your sign-in screen. Never share your password or one-time verification code with anyone, including in this chat. If you cannot regain access, contact an authorised school administrator to verify your account.", href: "/login" },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function findTopic(question: string) {
  const q = normalise(question);
  if (!q) return undefined;
  return helpTopics
    .map(topic => ({
      topic,
      score: topic.keys.reduce((best, key) => {
        const keyword = normalise(key);
        return keyword && (q === keyword || q.includes(` ${keyword} `) || q.startsWith(`${keyword} `) || q.endsWith(` ${keyword}`))
          ? Math.max(best, keyword.split(" ").length + (q === keyword ? 2 : 0))
          : best;
      }, 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.topic;
}

export default function ResaAssistantWidget() {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const [careMode,setCareMode]=useState(false);
  const [careName,setCareName]=useState("");
  const [careEmail,setCareEmail]=useState("");
  const [careDuty,setCareDuty]=useState("general");
  const [careDraft,setCareDraft]=useState("");
  const [careId,setCareId]=useState(()=>{try{return localStorage.getItem("resa-public-care-id")||"";}catch{return "";}});
  const [careToken,setCareToken]=useState(()=>{try{return localStorage.getItem("resa-public-care-token")||"";}catch{return "";}});
  const [careMessages,setCareMessages]=useState<Array<{id:string;sender_kind:string;body:string;created_at:string}>>([]);
  const [careStatus,setCareStatus]=useState<"open"|"waiting"|"closed">("open");
  const [careBusy,setCareBusy]=useState(false);
  const [careError,setCareError]=useState("");
  const [availability, setAvailability] = useState<CustomerCareAvailability | null>(null);
  const [showAvailabilityPrompt, setShowAvailabilityPrompt] = useState(false);
  const [customerCareOnline, setCustomerCareOnline] = useState(false);
  const soundAttempted = useRef(false);
  const lastChimeDay = useRef("");

  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!careId || !careToken || !open || !careMode) return;
    let alive = true;
    const client = getSupabaseClient();
    const poll = async () => {
      const result = await client.functions.invoke("resa-public-customer-care", {
        body: { action: "visitor_poll", conversation_id: careId, token: careToken },
      });
      if (!alive) return;
      if (!result.error && result.data?.messages) {
        setCareMessages(result.data.messages);
        if (result.data.status === "open" || result.data.status === "waiting" || result.data.status === "closed") {
          setCareStatus(result.data.status);
        }
      } else if (result.error) {
        setCareError(result.error.message || "Could not refresh your Customer Care conversation.");
      }
    };
    const channel = client.channel(`resa-public-care-${careId}`)
      .on("broadcast", { event: "message_updated" }, () => { void poll(); })
      .subscribe();
    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [careId, careToken, open, careMode]);
  useEffect(() => {
    let alive = true;
    const db = getSupabaseClient();
    const loadAvailability = async () => {
      const result = await (db as any).from("resa_customer_care_public_availability")
        .select("availability_enabled,availability_days,availability_start,availability_end,timezone,website_popup_enabled,soft_sound_enabled")
        .eq("school_id", RESA_SCHOOL_ID).maybeSingle();
      if (!alive || result.error || !result.data) return;
      setAvailability(result.data as CustomerCareAvailability);
    };
    void loadAvailability();
    const refresh = window.setInterval(() => void loadAvailability(), 60000);
    return () => { alive = false; window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    if (!availability) return;
    const evaluate = () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: availability.timezone || "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
      const part = (type:string) => parts.find(item=>item.type===type)?.value || "";
      const dayNumber = ({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7} as Record<string,number>)[part("weekday")] || 0;
      const minute = Number(part("hour"))*60+Number(part("minute"));
      const start = Number(String(availability.availability_start).slice(0,2))*60+Number(String(availability.availability_start).slice(3,5));
      const end = Number(String(availability.availability_end).slice(0,2))*60+Number(String(availability.availability_end).slice(3,5));
      const online = availability.availability_enabled && (availability.availability_days || []).includes(dayNumber) && minute >= start && minute < end;
      const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: availability.timezone || "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      if (lastChimeDay.current !== dateKey) { lastChimeDay.current = dateKey; soundAttempted.current = false; }
      let dismissedToday = false;
      try { dismissedToday = localStorage.getItem("resa-care-prompt-dismissed-" + dateKey) === "1"; } catch { /* Session-only dismissal remains available. */ }
      setCustomerCareOnline(online);
      const shouldPrompt = online && availability.website_popup_enabled;
      setShowAvailabilityPrompt(shouldPrompt && !dismissedToday);
    };
    evaluate();
    const tick = window.setInterval(evaluate, 30000);
    return () => window.clearInterval(tick);
  }, [availability]);

  useEffect(() => {
    if (!showAvailabilityPrompt || !availability?.soft_sound_enabled || soundAttempted.current) return;
    soundAttempted.current = true;
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const play = () => {
        if (context.state !== "running") return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.12);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + 0.3);
        window.setTimeout(() => void context.close(), 500);
        window.removeEventListener("pointerdown", unlockAndPlay);
      };
      const unlockAndPlay = () => { void context.resume().then(play).catch(() => { soundAttempted.current = false; }); };
      if (context.state === "running") play();
      else {
        void context.resume().then(play).catch(() => { soundAttempted.current = false; });
        window.addEventListener("pointerdown", unlockAndPlay, { once: true });
      }
    } catch {
      soundAttempted.current = false;
    }
  }, [showAvailabilityPrompt, availability]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("resa-assistant-position-v2");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { left?: number; top?: number };
      if (typeof parsed.left !== "number" || !Number.isFinite(parsed.left) ||
          typeof parsed.top !== "number" || !Number.isFinite(parsed.top)) return;
      setPosition({
        left: Math.max(8, Math.min(parsed.left, Math.max(8, window.innerWidth - 80))),
        top: Math.max(8, Math.min(parsed.top, Math.max(8, window.innerHeight - 80))),
      });
    } catch {
      // Ignore invalid or unavailable saved positioning data.
    }
  }, []);

  useEffect(() => {
    if (!position) return;
    try {
      localStorage.setItem("resa-assistant-position-v2", JSON.stringify(position));
    } catch {
      // Positioning remains available for this session if storage is unavailable.
    }
  }, [position]);

  useEffect(() => {
    function keepAssistantInViewport() {
      const bounds = containerRef.current?.getBoundingClientRect();
      const width = bounds?.width ?? 72;
      const height = bounds?.height ?? 56;
      setPosition(current => current ? {
        left: Math.max(8, Math.min(current.left, Math.max(8, window.innerWidth - width - 8))),
        top: Math.max(8, Math.min(current.top, Math.max(8, window.innerHeight - height - 8))),
      } : current);
    }
    window.addEventListener("resize", keepAssistantInViewport);
    return () => window.removeEventListener("resize", keepAssistantInViewport);
  }, []);

  function startDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 6) drag.moved = true;
    if (!drag.moved) return;
    const bounds = containerRef.current?.getBoundingClientRect();
    const width = bounds?.width ?? 72;
    const height = bounds?.height ?? 56;
    setPosition({
      left: Math.max(8, Math.min(event.clientX - drag.offsetX, Math.max(8, window.innerWidth - width - 8))),
      top: Math.max(8, Math.min(event.clientY - drag.offsetY, Math.max(8, window.innerHeight - height - 8))),
    });
  }

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClick.current = drag.moved;
    dragRef.current = null;
  }

  const activePage = useMemo(() => path.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "home", [path]);

  function dismissAvailabilityPrompt() {
    try {
      const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: availability?.timezone || "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      localStorage.setItem("resa-care-prompt-dismissed-" + dateKey, "1");
    } catch { /* Dismissal still applies for the current render. */ }
    setShowAvailabilityPrompt(false);
  }

  function openCustomerCare() {
    // Public visitors must remain in the public Ask RESA widget. The protected
    // in-app chat route is only for authenticated school members.
    setOpen(true);
    setCareMode(true);
    setShowAvailabilityPrompt(false);
  }

  async function pollPublicCare(id=careId,token=careToken) {
    if(!id||!token)return;
    const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"visitor_poll",conversation_id:id,token}});
    if(!result.error&&result.data?.messages){
      setCareMessages(result.data.messages);
      if(result.data.status==="open"||result.data.status==="waiting"||result.data.status==="closed")setCareStatus(result.data.status);
    } else if(result.error) {
      setCareError(result.error.message||"Could not refresh your Customer Care conversation.");
    }
  }
  function startNewPublicCare() {
    try { localStorage.removeItem("resa-public-care-id"); localStorage.removeItem("resa-public-care-token"); } catch { /* Current session can still restart. */ }
    setCareId("");setCareToken("");setCareMessages([]);setCareStatus("open");setCareDraft("");setCareError("");
  }
  async function startPublicCare(event: React.FormEvent) {
    event.preventDefault();setCareError("");
    if(!careName.trim()||!careDraft.trim()) {setCareError("Enter your name and first message.");return;}
    setCareBusy(true);
    try {
      const token=crypto.randomUUID();
      const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"visitor_start",name:careName,email:careEmail,duty:careDuty,message:careDraft,token}});
      if(result.error)throw result.error;
      const data=result.data as {conversation_id:string;token:string};
      setCareId(data.conversation_id);setCareToken(data.token);setCareStatus("open");
      try{localStorage.setItem("resa-public-care-id",data.conversation_id);localStorage.setItem("resa-public-care-token",data.token);}catch{/* Active session remains usable. */}
      setCareDraft("");await pollPublicCare(data.conversation_id,data.token);
    } catch(error) {setCareError(error instanceof Error?error.message:"Could not start Customer Care chat. Try again.");}
    finally {setCareBusy(false);}
  }
  async function sendPublicCare(event: React.FormEvent) {
    event.preventDefault();if(!careDraft.trim()||!careId||!careToken)return;
    setCareBusy(true);setCareError("");
    try {
      const result=await getSupabaseClient().functions.invoke("resa-public-customer-care",{body:{action:"visitor_send",conversation_id:careId,token:careToken,message:careDraft}});
      if(result.error)throw result.error;
      setCareDraft("");await pollPublicCare();
    } catch(error) {setCareError(error instanceof Error?error.message:"Message could not be sent. Try again.");}
    finally {setCareBusy(false);}
  }
  useEffect(()=>{
    if(!open||!careMode||!careId||!careToken)return;
    void pollPublicCare();const timer=window.setInterval(()=>void pollPublicCare(),5000);
    return()=>window.clearInterval(timer);
  },[open,careMode,careId,careToken]);

  function ask(value = question) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const history: ChatMessage[] = [...messages, { role: "user" as const, content: trimmed }].slice(-8);
    const topic = findTopic(trimmed);
    const answer = topic
      ? `${topic.title}\n\n${topic.answer}\n\nSource: RESA's approved local help library. No external AI service was contacted for this reply.`
      : "I do not have an approved answer to that question in RESA's current help library. I can help with attendance, results, fees and payments, assignments, examinations and CBT, admissions, staff accounts, parent accounts, classes, RESA Drive, school communication, school contact details and basic login guidance. For other questions or an official decision, please use the Portal Navigation Guide or contact RESA Customer Care. No external AI service was contacted.";
    setMessages([...history, { role: "assistant" as const, content: answer }].slice(-8));
    setQuestion("");
    setFallbackNotice(true);
  }

  return <div ref={containerRef} className={position ? "fixed z-[1200]" : "fixed bottom-4 left-4 z-[1200]"} style={position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined}>
    {showAvailabilityPrompt && !open && <div role="status" className="mb-3 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-emerald-950">RESA Customer Care</strong><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Available now</span></div><p className="mt-2 text-sm font-semibold text-slate-900">Hello! 👋 We're ready to chat.</p><p className="mt-1 text-xs leading-5 text-slate-600">Ask us about admissions, fees, school services or general enquiries.</p><div className="mt-3 flex gap-2"><button type="button" onClick={openCustomerCare} className="flex-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white">Chat with us</button><button type="button" onClick={dismissAvailabilityPrompt} aria-label="Dismiss availability message" className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600">Not now</button></div></div>}
    {open && <section role="dialog" aria-modal="false" aria-label="Ask RESA AI assistant" className="mb-3 flex w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl">
      <header onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="flex cursor-move touch-none select-none items-center justify-between bg-[#103b2d] p-4 text-white" title="Drag to move Ask RESA">
        <div className="flex items-center gap-2"><Bot size={20}/><div><p className="font-extrabold">Ask RESA</p><p className="text-[11px] text-emerald-100">{customerCareOnline?"Customer Care available now":"AI portal guidance"} • Page: {activePage}</p></div></div>
        <button type="button" onPointerDown={event=>event.stopPropagation()} onClick={()=>setOpen(false)} aria-label="Close assistant" className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
      </header>
      <div className="max-h-80 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <p className="text-sm leading-6 text-slate-600">Hello! I can guide you through RESA's general portal features. You can also chat with the school team without creating a portal account. Never share passwords or verification codes.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setCareMode(false)} className="rounded-full border px-3 py-2 text-xs font-semibold">Ask RESA guide</button><button type="button" onClick={()=>setCareMode(true)} className="rounded-full border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-900">Chat with Customer Care</button></div>
        <div className="flex flex-wrap gap-2">{["How do I check results?","How does biometric attendance work?","How do I enrol a student?","How do I use school fees?"].map(q=><button type="button" key={q} onClick={()=>ask(q)} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{q}</button>)}</div>
        {!careMode && messages.map((message, index)=><div key={index} className={message.role==="user"?"ml-7 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-950":"mr-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"}><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{message.role==="user"?"You":"Ask RESA"}</p><p className="whitespace-pre-wrap">{message.content}</p></div>)}
        {careMode && <div className="space-y-2"><p className="text-xs text-slate-500">Public Customer Care • no portal account required</p>{careId ? <>{careMessages.map(message=><div key={message.id} className={message.sender_kind==="visitor"?"ml-6 rounded-xl bg-emerald-50 p-3 text-sm":"mr-4 rounded-xl bg-slate-100 p-3 text-sm"}><p className="mb-1 text-[10px] font-bold uppercase text-slate-500">{message.sender_kind==="visitor"?"You":"RESA Customer Care"}</p><p className="whitespace-pre-wrap">{message.body}</p><time className="mt-1 block text-[10px] text-slate-400">{new Date(message.created_at).toLocaleString()}</time></div>)}{careStatus==="closed"&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><strong>This conversation has been closed by RESA Customer Care.</strong><button type="button" onClick={startNewPublicCare} className="mt-2 block font-bold underline">Start a new conversation</button></div>}</> : <form onSubmit={startPublicCare} className="space-y-2"><input required maxLength={100} value={careName} onChange={e=>setCareName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border px-3 py-2 text-sm"/><input type="email" maxLength={254} value={careEmail} onChange={e=>setCareEmail(e.target.value)} placeholder="Email (optional)" className="w-full rounded-lg border px-3 py-2 text-sm"/><select value={careDuty} onChange={e=>setCareDuty(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="general">General enquiry</option><option value="admissions">Admissions</option><option value="fees">Fees</option><option value="cbt">CBT and examinations</option><option value="results">Results</option><option value="attendance">Attendance</option><option value="technical">Technical support</option></select></form>}{careError&&<p className="text-xs text-rose-700">{careError}</p>}</div>}
        {fallbackNotice && <p className="text-[10px] text-amber-700">Local verified help-library mode • no AI API usage</p>}
      </div>
      {careMode ? (careId&&careStatus==="closed" ? <div className="border-t border-slate-100 p-3 text-center text-xs text-slate-500">This conversation is closed. Use “Start a new conversation” above to contact RESA again.</div> : <form onSubmit={careId?sendPublicCare:startPublicCare} className="flex gap-2 border-t border-slate-100 p-3"><input value={careDraft} onChange={e=>setCareDraft(e.target.value)} maxLength={5000} placeholder={careId?"Write to Customer Care…":"Your first message…"} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><button type="submit" disabled={!careDraft.trim()||careBusy||careStatus==="closed"} className="rounded-xl bg-[#174c35] px-3 text-white disabled:opacity-50"><Send size={17}/></button></form>) : <form onSubmit={e=>{e.preventDefault();void ask();}} className="flex gap-2 border-t border-slate-100 p-3"><input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1200} placeholder="Ask a portal question…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700 disabled:bg-slate-50" aria-label="Ask RESA a question"/><button type="submit" aria-label="Send question" disabled={!question.trim()} className="rounded-xl bg-[#174c35] px-3 text-white disabled:opacity-50"><Send size={17}/></button></form>}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs"><button type="button" onClick={()=>{setPosition(null);try{localStorage.removeItem("resa-assistant-position-v2");}catch{/* Position reset remains active for this session. */}}} className="inline-flex items-center gap-1 font-semibold text-slate-600 underline" title="Return Ask RESA to its default left-side position"><RotateCcw size={12}/> Reset position</button><a href="/portal-navigation-guide" className="font-semibold text-emerald-800 underline">Portal guide</a><button type="button" onClick={()=>setCareMode(true)} className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><MessageCircle size={12}/> Public Customer Care</button><a href="/maps" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><MapPin size={12}/> Maps</a><a href="https://wa.me/2348058422691" target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">WhatsApp support</a></footer>
      <p className="px-4 pb-3 text-[10px] leading-4 text-slate-400">AI guidance is informational, may be inaccurate and cannot access private records or perform school actions.</p>
    </section>}
    <button type="button" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setOpen(v=>!v);}} aria-expanded={open} aria-label={open ? "Close Ask RESA assistant" : "Open Ask RESA assistant"} className="ml-auto flex items-center gap-2 rounded-full bg-[#103b2d] px-4 py-3 font-bold text-white shadow-xl ring-2 ring-white transition hover:bg-[#1a5a3d]">
      {open ? <X size={19}/> : <MessageCircle size={19}/>}<span className="text-sm">Ask RESA</span>
    </button>
  </div>;
}
