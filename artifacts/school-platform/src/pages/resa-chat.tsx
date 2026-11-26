import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ArrowLeft, MessageCircle, Send, RefreshCw, ShieldCheck, Users, LockKeyhole, Paperclip, FileText, Mic, Square, Download, Smile } from "lucide-react";

type Role = "admin" | "teacher" | "student" | "parent";
type Contact = { user_id: string; role: string; display_name: string };
type Conversation = { id: string; participant_one: string; participant_two: string; subject: string; last_message_at: string; school_id: string; conversation_type: string; customer_care_duty?: string };
type ChatMessage = { id: string; sender_id: string; body: string; created_at: string; attachment_path?: string | null; attachment_name?: string | null; attachment_mime?: string | null; attachment_size?: number | null; attachment_url?: string | null; attachment_download_url?: string | null };
const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
function renderMessageBody(body: string) {
  const words = body.split(" ");
  return words.map((part, index) => {
    const isUrl = part.startsWith("https://") || part.startsWith("http://");
    return <span key={index}>{isUrl ? <a href={part} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{part}</a> : part}{index < words.length - 1 ? " " : ""}</span>;
  });
}


export default function ResaChatPage({ schoolId, userId, role }: { schoolId: string; userId: string; role: Role }) {
  const db = getSupabaseClient();
  const [enabled, setEnabled] = useState(false);
  const [channelPolicy, setChannelPolicy] = useState<Record<string, boolean>>({ private_messages: true, group_messages: true, customer_care: true, file_attachments: true });
  const [rolePolicy, setRolePolicy] = useState<Record<string, Record<string, boolean>>>({});
  const [recipientPolicy, setRecipientPolicy] = useState<Record<string, string[]>>({
    admin: ["admin", "teacher", "parent", "student"],
    teacher: ["admin", "student"],
    parent: ["admin"],
    student: ["admin", "teacher"],
  });
  const [selectedRole, setSelectedRole] = useState<string>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("channel") === "customer_care" ? "admin" : "admin");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversation_id") || "" : "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [selectedContact, setSelectedContact] = useState("");
  const [customerCareDuty, setCustomerCareDuty] = useState("general");
  const [chiefAdminId, setChiefAdminId] = useState("");
  const [isChiefAdmin, setIsChiefAdmin] = useState(false);
  const [careAssignments, setCareAssignments] = useState<Array<{duty_key:string;admin_user_id:string;enabled:boolean}>>([]);
  const [careStart, setCareStart] = useState("08:00");
  const [careEnd, setCareEnd] = useState("16:00");
  const [careDays, setCareDays] = useState<number[]>([1,2,3,4,5]);
  const [carePopupEnabled, setCarePopupEnabled] = useState(true);
  const [careSoundEnabled, setCareSoundEnabled] = useState(true);
  const [savingCareSettings, setSavingCareSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [subject, setSubject] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("channel") === "customer_care" ? "Customer Care" : "Chat");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const presenceChannelRef = useRef<any>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const isAdmin = role === "admin";
  const customerCareMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("channel") === "customer_care";
  const canUsePrivate = channelPolicy.private_messages !== false && (isAdmin || rolePolicy[role]?.private_messages !== false);
  const canUseGroups = channelPolicy.group_messages !== false && (isAdmin || rolePolicy[role]?.group_messages !== false);
  const canUseCustomerCare = channelPolicy.customer_care !== false && (isAdmin || rolePolicy[role]?.customer_care !== false);
  const canUseFiles = channelPolicy.file_attachments !== false && (isAdmin || rolePolicy[role]?.file_attachments !== false);

  const load = useCallback(async () => {
    setLoading(true); setContactsLoading(true); setError("");
    try {
    const settings = await (db as any).from("resa_chat_settings").select("chat_enabled,channel_policy,role_policy,recipient_policy").eq("school_id", schoolId).maybeSingle();
    if (settings.error) setError(settings.error.message);
    setEnabled(Boolean(settings.data?.chat_enabled));
    setChannelPolicy({ private_messages: true, group_messages: true, customer_care: true, file_attachments: true, ...(settings.data?.channel_policy ?? {}) });
    setRolePolicy(settings.data?.role_policy ?? {});
    setRecipientPolicy({ admin: ["admin", "teacher", "parent", "student"], teacher: ["admin", "student"], parent: ["admin"], student: ["admin", "teacher"], ...(settings.data?.recipient_policy ?? {}) });
    if (isAdmin) {
      const care = await (db as any).from("resa_customer_care_settings")
        .select("chief_admin_user_id,availability_start,availability_end,availability_days,website_popup_enabled,soft_sound_enabled")
        .eq("school_id", schoolId).maybeSingle();
      if (!care.error && care.data) {
        setChiefAdminId(String(care.data.chief_admin_user_id || ""));
        setIsChiefAdmin(String(care.data.chief_admin_user_id || "") === userId);
        setCareStart(String(care.data.availability_start || "08:00").slice(0,5));
        setCareEnd(String(care.data.availability_end || "16:00").slice(0,5));
        setCareDays((care.data.availability_days || [1,2,3,4,5]).map(Number));
        setCarePopupEnabled(care.data.website_popup_enabled !== false);
        setCareSoundEnabled(care.data.soft_sound_enabled !== false);
      }
      const assignments = await (db as any).from("resa_customer_care_assignments")
        .select("duty_key,admin_user_id,enabled").eq("school_id", schoolId);
      if (!assignments.error) setCareAssignments(assignments.data || []);
    }
    const conv = await (db as any).from("resa_chat_conversations").select("id,participant_one,participant_two,subject,last_message_at,school_id,conversation_type,customer_care_duty").eq("school_id", schoolId).order("last_message_at", { ascending: false });
    if (conv.error) setError(conv.error.message);
    const convRows = (conv.data ?? []) as Conversation[];
    setConversations(convRows);
    if (activeId && !convRows.some(c => c.id === activeId)) setActiveId("");
    // A single server-authorised directory keeps direct messages, Customer Care
    // and group member selection consistent across every role. The RPC returns
    // only active contacts in recipient categories approved for this sender role.
    const directory = await (db as any).rpc("get_school_message_contacts", { p_school_id: schoolId });
    if (directory.error) throw directory.error;
    setContacts((directory.data ?? []).map((entry: any) => ({
      user_id: String(entry.user_id),
      role: String(entry.role),
      display_name: String(entry.display_name || "Name not set — ask the school office to update this profile"),
    })).filter((entry: Contact) => entry.user_id && entry.user_id !== userId));
    } catch (e) {
      setContacts([]);
      setError(e instanceof Error ? e.message : "School contacts could not be loaded. Refresh and try again.");
    } finally {
      setLoading(false);
      setContactsLoading(false);
    }
  }, [db, schoolId, userId, role, isAdmin, activeId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedConversation = params.get("conversation_id");
    if (requestedConversation && conversations.some(conversation => conversation.id === requestedConversation)) {
      setActiveId(requestedConversation);
    }
  }, [conversations]);

  useEffect(() => {
    const messageId = new URLSearchParams(window.location.search).get("message_id");
    if (!messageId || !activeId || !messages.some(message => message.id === messageId)) return;
    document.getElementById("resa-chat-message-" + messageId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeId, messages]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    const fetchMessages = async () => {
      const result = await (db as any).from("resa_chat_messages").select("id,sender_id,body,created_at,attachment_path,attachment_name,attachment_mime,attachment_size").eq("conversation_id", activeId).order("created_at", { ascending: true }).limit(500);
      if (!cancelled) {
        if (result.error) setError(result.error.message);
        else {
          const rows = (result.data ?? []) as ChatMessage[];
          const senderIds = [...new Set(rows.map(message => message.sender_id).filter(Boolean))];
          if (senderIds.length) {
            const profiles = await (db as any).from("profiles").select("id,display_name").in("id", senderIds);
            if (!cancelled && !profiles.error) setMemberNames(Object.fromEntries((profiles.data ?? []).map((profile: any) => [profile.id, profile.display_name || "School member"])));
          }
          const enriched = await Promise.all(rows.map(async m => {
            if (!m.attachment_path) return m;
            const storage = (db as any).storage.from("resa-chat-media");
            const [inlineUrl, downloadUrl] = await Promise.all([
              storage.createSignedUrl(m.attachment_path, 3600),
              storage.createSignedUrl(m.attachment_path, 3600, { download: true }),
            ]);
            return { ...m, attachment_url: inlineUrl.data?.signedUrl ?? null, attachment_download_url: downloadUrl.data?.signedUrl ?? null };
          }));
          setMessages(enriched);
          if (rows.length) {
            const reads = await (db as any).from("resa_chat_message_reads").select("message_id").in("message_id", rows.map(m => m.id));
            if (!reads.error) {
              const counts: Record<string, number> = {};
              for (const receipt of reads.data ?? []) counts[receipt.message_id] = (counts[receipt.message_id] ?? 0) + 1;
              setReadCounts(counts);
            }
            await (db as any).from("resa_chat_message_reads").upsert(
              rows.filter(m => m.sender_id !== userId).map(m => ({ message_id: m.id, school_id: schoolId, user_id: userId })),
              { onConflict: "message_id,user_id", ignoreDuplicates: true }
            );
          }
        }
      }
    };
    void fetchMessages();
    const channel = db.channel("resa-chat-" + activeId).on("postgres_changes", { event: "*", schema: "public", table: "resa_chat_messages", filter: "conversation_id=eq." + activeId }, () => { void fetchMessages(); }).subscribe();
    return () => { cancelled = true; void db.removeChannel(channel); };
  }, [db, activeId]);

  useEffect(() => {
    if (!activeId) { setOnlineCount(0); return; }
    const channel = db.channel("resa-chat-presence-" + activeId, { config: { presence: { key: userId } } });
    presenceChannelRef.current = channel;
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state).length);
    });
    channel.on("broadcast", { event: "typing" }, ({ payload }: any) => {
      const typingId = String(payload?.user_id || "");
      if (!typingId || typingId === userId) return;
      setTypingIds(current => payload?.typing ? [...new Set([...current, typingId])] : current.filter(id => id !== typingId));
    });
    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
    return () => {
      presenceChannelRef.current = null;
      setOnlineCount(0);
      setTypingIds([]);
      void db.removeChannel(channel);
    };
  }, [db, activeId, userId]);

  const activeConversation = useMemo(() => conversations.find(c => c.id === activeId), [conversations, activeId]);
  const otherId = activeConversation ? (activeConversation.participant_one === userId ? activeConversation.participant_two : activeConversation.participant_one) : "";
  const otherContact = contacts.find(c => c.user_id === otherId);
  const sortedContacts = useMemo(() => [...contacts].sort((a,b)=>a.display_name.localeCompare(b.display_name)), [contacts]);
  const roleChoices = useMemo(() => [
    { key: "admin", label: "Administrators" },
    { key: "teacher", label: "Teachers & staff" },
    { key: "parent", label: "Parents & guardians" },
    { key: "student", label: "Students" },
  ], []);
  const selectedRoleAllowed = customerCareMode
    ? canUseCustomerCare && selectedRole === "admin"
    : isAdmin || (canUsePrivate && (recipientPolicy[role] ?? []).includes(selectedRole));
  const roleContacts = sortedContacts.filter(contact => contact.role === selectedRole);

  function broadcastTyping(typing: boolean) {
    void presenceChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { user_id: userId, typing } });
  }

  async function toggleChat() {
    setError(""); setNotice("");
    const next = !enabled;
    const result = await (db as any).from("resa_chat_settings").upsert({ school_id: schoolId, chat_enabled: next, updated_by: userId, updated_at: new Date().toISOString() });
    if (result.error) setError(result.error.message);
    else { setEnabled(next); setNotice(next ? "Dashboard chat is now enabled." : "Dashboard chat is deactivated. Existing messages remain saved and readable by permitted participants."); }
  }

  async function startConversation(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    if (!enabled) { setError("Chat has been deactivated by the administrator."); return; }
    if (customerCareMode ? !canUseCustomerCare : !canUsePrivate) { setError(customerCareMode ? "Customer Care is disabled for your account by the school administrator." : "Private messaging is disabled for your account by the school administrator."); return; }
    if (!selectedRoleAllowed) { setError("This recipient group is not enabled for your role. Contact the school administrator for access."); return; }
    let recipientId = selectedContact;
    let target = contacts.find(c => c.user_id === selectedContact);
    if (customerCareMode && !isAdmin) {
      const route = await (db as any).rpc("resolve_resa_customer_care_admin", { p_school_id: schoolId, p_duty_key: customerCareDuty });
      if (route.error || !route.data) { setError(route.error?.message || "No Customer Care administrator is currently assigned."); return; }
      recipientId = String(route.data);
      target = contacts.find(c => c.user_id === recipientId);
    } else if (!selectedContact || !roleContacts.some(contact => contact.user_id === selectedContact)) {
      setError("Choose a person from the selected, authorised recipient group."); return;
    }
    const desiredType = customerCareMode && !isAdmin ? "admin_support" : (!isAdmin && target?.role === "admin" ? "admin_support" : "direct");
    const existing = conversations.find(c => c.conversation_type === desiredType && (!(customerCareMode&&!isAdmin) || c.customer_care_duty === customerCareDuty) && [c.participant_one,c.participant_two].includes(userId) && [c.participant_one,c.participant_two].includes(recipientId));
    if (existing) { setActiveId(existing.id); return; }
    const result = await (db as any).from("resa_chat_conversations").insert({
      school_id: schoolId, created_by: userId, participant_one: userId, participant_two: recipientId,
      customer_care_duty: customerCareMode && !isAdmin ? customerCareDuty : "general",
      conversation_type: customerCareMode && !isAdmin ? "admin_support" : (!isAdmin && target?.role === "admin" ? "admin_support" : "direct"), subject: subject.trim() || (customerCareMode ? "Customer Care" : target ? "Chat with " + target.display_name : "Chat")
    }).select("id").single();
    if (result.error) setError(result.error.message);
    else { setActiveId(result.data.id); setNotice("Conversation opened."); await load(); }
  }

  async function saveCareAssignment(dutyKey: string, adminUserId: string) {
    if (!isChiefAdmin) return;
    const result = adminUserId
      ? await (db as any).from("resa_customer_care_assignments").upsert({ school_id: schoolId, duty_key: dutyKey, admin_user_id: adminUserId, assigned_by: userId, enabled: true }, { onConflict: "school_id,duty_key" })
      : await (db as any).from("resa_customer_care_assignments").delete().eq("school_id", schoolId).eq("duty_key", dutyKey);
    if (result.error) { setError(result.error.message); return; }
    const refreshed = await (db as any).from("resa_customer_care_assignments").select("duty_key,admin_user_id,enabled").eq("school_id", schoolId);
    if (!refreshed.error) setCareAssignments(refreshed.data || []);
    setNotice("Customer Care duty assignment saved.");
  }

  async function saveCareSchedule() {
    if (!isChiefAdmin) return;
    setSavingCareSettings(true); setError("");
    const result = await (db as any).from("resa_customer_care_settings").update({
      availability_start: careStart, availability_end: careEnd, availability_days: careDays,
      website_popup_enabled: carePopupEnabled, soft_sound_enabled: careSoundEnabled,
      updated_by: userId, updated_at: new Date().toISOString()
    }).eq("school_id", schoolId);
    if (result.error) setError(result.error.message);
    else setNotice("Customer Care availability schedule saved.");
    setSavingCareSettings(false);
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    if (!isAdmin) return;
    if (!enabled) { setError("Chat has been deactivated by the administrator."); return; }
    if (!canUseGroups) { setError("Group messaging is disabled by the school administrator."); return; }
    if (!groupName.trim() || groupMemberIds.length < 2) {
      setError("Enter a group name and select at least two other active members.");
      return;
    }
    setCreatingGroup(true);
    try {
      const result = await (db as any).rpc("resa_create_chat_group", {
        p_school_id: schoolId,
        p_subject: groupName.trim(),
        p_member_ids: groupMemberIds,
      });
      if (result.error) throw result.error;
      setGroupName(""); setGroupMemberIds([]);
      setActiveId(String(result.data));
      setNotice("Group created. Selected members can now open and participate in it.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The group could not be created.");
    } finally { setCreatingGroup(false); }
  }

  async function startVoiceNote() {
    setError("");
    if (!canUseFiles) { setError("The school administrator has disabled chat file and voice-note sharing."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser. You can attach an existing audio file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordingChunks.current = [];
      const supportedTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const preferred = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) recordingChunks.current.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || recordingChunks.current[0]?.type || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : type.includes("mpeg") ? "mp3" : "webm";
        const blob = new Blob(recordingChunks.current, { type });
        if (blob.size > 0) {
          setAttachment(new File([blob], "RESA-voice-note-" + new Date().toISOString().replace(/[:.]/g,"-") + "." + ext, { type }));
        }
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone permission was not granted.");
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }

  function stopVoiceNote() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function sendMessage(e: FormEvent) {
    e.preventDefault(); if ((!draft.trim() && !attachment) || !activeConversation) return;
    if (!enabled) { setError("Chat has been deactivated by the administrator."); return; }
    if (attachment && !canUseFiles) { setError("The school administrator has disabled chat file sharing."); return; }
    const activeChannelAllowed = activeConversation.conversation_type === "group" ? canUseGroups : activeConversation.conversation_type === "admin_support" ? canUseCustomerCare : canUsePrivate;
    if (!activeChannelAllowed) { setError("The school administrator has disabled this channel for your account."); return; }
    setSending(true); setError("");
    let uploadedPath: string | null = null;
    const attachmentMime = attachment ? (attachment.type || "application/octet-stream").split(";")[0].trim().toLowerCase() : null;
    try {
      if (attachment) {
        if (attachmentMime === "application/octet-stream") throw new Error("This device cannot identify the file type. Choose a common image, audio, video, PDF, Office document or ZIP archive format.");
        if (attachment.size <= 0 || attachment.size > 100 * 1024 * 1024) throw new Error("Chat attachments must be 100 MB or smaller.");
        const blockedExtension = /\.(exe|dll|com|bat|cmd|msi|msp|ps1|sh|bash|zsh|js|mjs|cjs|html|htm|xhtml|svg|jar|apk|ipa|app|deb|rpm|php|py|rb|pl|wasm|scr|vbs|hta)$/i;
        const blockedMime = /^(text\/html|image\/svg\+xml|application\/javascript|text\/javascript|application\/x-msdownload|application\/x-dosexec|application\/x-executable|application\/x-sh)$/i;
        if (blockedExtension.test(attachment.name) || blockedMime.test(attachment.type)) throw new Error("This file type is blocked for safety. Send documents, images, audio, video, spreadsheets, presentations or archives instead.");
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "attachment";
        uploadedPath = schoolId + "/" + activeConversation.id + "/" + crypto.randomUUID() + "-" + safeName;
        const upload = await (db as any).storage.from("resa-chat-media").upload(uploadedPath, attachment, { contentType: attachmentMime || "application/octet-stream", upsert: false });
        if (upload.error) throw upload.error;
      }
      const result = await (db as any).from("resa_chat_messages").insert({
        conversation_id: activeConversation.id, school_id: schoolId, sender_id: userId,
        body: draft.trim() || (attachment ? "Attachment" : ""),
        attachment_path: uploadedPath, attachment_name: attachment?.name ?? null,
        attachment_mime: attachmentMime, attachment_size: attachment?.size ?? null
      });
      if (result.error) {
        if (uploadedPath) await (db as any).storage.from("resa-chat-media").remove([uploadedPath]);
        throw result.error;
      }
      setDraft(""); setAttachment(null);
      await (db as any).from("resa_chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeConversation.id);
      const fresh = await (db as any).from("resa_chat_messages").select("id,sender_id,body,created_at,attachment_path,attachment_name,attachment_mime,attachment_size").eq("conversation_id", activeConversation.id).order("created_at", { ascending: true }).limit(500);
      if (!fresh.error) {
        const enriched = await Promise.all((fresh.data ?? []).map(async (m: ChatMessage) => {
          if (!m.attachment_path) return m;
          const storage = (db as any).storage.from("resa-chat-media");
          const [inlineUrl, downloadUrl] = await Promise.all([
            storage.createSignedUrl(m.attachment_path, 3600),
            storage.createSignedUrl(m.attachment_path, 3600, { download: true }),
          ]);
          return { ...m, attachment_url: inlineUrl.data?.signedUrl ?? null, attachment_download_url: downloadUrl.data?.signedUrl ?? null };
        }));
        setMessages(enriched);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return <main className="min-h-screen bg-[#f4f7f1] px-4 py-5 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <Link href={role === "student" ? "/student-dashboard" : role === "teacher" ? "/teacher-dashboard" : role === "parent" ? "/parent-dashboard" : "/dashboard"} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/> Back to dashboard</Link>
    <header className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">RESA communication</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("channel")==="customer_care"?"RESA Customer Care":"RESA Communication Centre"}</h1><p className="mt-2 text-sm leading-6 text-emerald-50">Private conversations, administrator-approved role-to-role messaging, Customer Care and school groups—with instant portal alerts and administrator-managed access.</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className={"rounded-full px-3 py-1 text-xs font-bold "+(enabled?"bg-emerald-100 text-emerald-950":"bg-amber-100 text-amber-950")}>{enabled?"Chat enabled":"Chat deactivated"}</span>{isAdmin&&<button onClick={()=>void toggleChat()} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950">{enabled?"Deactivate chat":"Activate chat"}</button>}</div></header>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {!enabled&&<div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><LockKeyhole size={20}/><div><strong>Messaging is currently disabled.</strong><p className="mt-1">An administrator must activate chat before anyone can start or send messages. Existing messages are preserved.</p></div></div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className={panel}><div className="flex items-center gap-2"><Users size={19}/><h2 className="font-extrabold">Start a conversation</h2></div><form onSubmit={e=>void startConversation(e)} className="mt-4 space-y-3"><div className="space-y-3">{!(customerCareMode&&!isAdmin)&&<label className="block text-sm font-semibold">{customerCareMode?"Customer Care · contact the school administrator":"1. Choose who you want to contact"}<select className={field+" mt-1"} value={selectedRole} onChange={e=>{setSelectedRole(e.target.value);setSelectedContact("");}}><option value="admin">Administrators</option><option value="teacher" disabled={customerCareMode}>Teachers & staff</option><option value="parent" disabled={customerCareMode}>Parents & guardians</option><option value="student" disabled={customerCareMode}>Students</option></select></label>}{customerCareMode&&!isAdmin&&<label className="block text-sm font-semibold">What do you need help with?<select className={field+" mt-1"} value={customerCareDuty} onChange={e=>setCustomerCareDuty(e.target.value)}><option value="general">General enquiry</option><option value="fees">Fees and payments</option><option value="admissions">Admissions</option><option value="cbt">Examinations and CBT</option><option value="results">Results</option><option value="attendance">Attendance</option><option value="technical">Technical support</option></select><span className="mt-1 block text-xs font-normal text-slate-500">RESA automatically routes your message to the administrator assigned to this duty.</span></label>}{!selectedRoleAllowed ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{roleChoices.find(item=>item.key===selectedRole)?.label} access is not enabled.</strong><p className="mt-1">Contact the school administrator to request permission to message this group. No names are shown until access is granted.</p></div> : <label className="block text-sm font-semibold">2. Choose a person<select className={field+" mt-1"} value={selectedContact} onChange={e=>setSelectedContact(e.target.value)}><option value="">{contactsLoading?"Loading authorised contacts…":roleContacts.length?"Choose a name…":"No active contacts in this group"}</option>{roleContacts.map(c=><option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select>{!contactsLoading&&!roleContacts.length&&<span className="mt-1 block text-xs font-normal text-slate-500">No contacts are available here, or your account has not been enabled for this group. Contact the school administrator for access.</span>}</label>}</div><label className="block text-sm font-semibold">Subject<input className={field+" mt-1"} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Mathematics homework"/></label><button disabled={!enabled||(customerCareMode?!canUseCustomerCare:!canUsePrivate)||!selectedRoleAllowed||(!(customerCareMode&&!isAdmin)&&!selectedContact)} className="w-full rounded-lg bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{customerCareMode?"Start Customer Care conversation":"Open private chat"}</button></form>{isChiefAdmin&&<div className="mt-5 border-t border-slate-200 pt-5"><h3 className="font-extrabold">Chief Administrator · Customer Care controls</h3><p className="mt-1 text-xs leading-5 text-slate-500">Assign all enquiries to one administrator or assign individual duties. Unassigned duties fall back to the all-access administrator.</p><div className="mt-3 space-y-3">{[{key:"all",label:"All Customer Care enquiries"},{key:"general",label:"General enquiries"},{key:"fees",label:"Fees and payments"},{key:"admissions",label:"Admissions"},{key:"cbt",label:"Examinations and CBT"},{key:"results",label:"Results"},{key:"attendance",label:"Attendance"},{key:"technical",label:"Technical support"}].map(duty=><label key={duty.key} className="block text-xs font-semibold">{duty.label}<select className={field+" mt-1"} value={careAssignments.find(a=>a.duty_key===duty.key&&a.enabled)?.admin_user_id||""} onChange={e=>void saveCareAssignment(duty.key,e.target.value)}><option value="">Use all-access fallback</option>{contacts.filter(c=>c.role==="admin").map(c=><option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select></label>)}</div><div className="mt-5 border-t border-slate-200 pt-4"><h4 className="font-bold">Website availability invitation</h4><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Opens<input type="time" className={field+" mt-1"} value={careStart} onChange={e=>setCareStart(e.target.value)}/></label><label className="text-xs font-semibold">Closes<input type="time" className={field+" mt-1"} value={careEnd} onChange={e=>setCareEnd(e.target.value)}/></label></div><div className="mt-3 flex flex-wrap gap-2">{[{day:1,label:"Mon"},{day:2,label:"Tue"},{day:3,label:"Wed"},{day:4,label:"Thu"},{day:5,label:"Fri"},{day:6,label:"Sat"},{day:7,label:"Sun"}].map(item=><label key={item.day} className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs"><input type="checkbox" checked={careDays.includes(item.day)} onChange={e=>setCareDays(old=>e.target.checked?[...old,item.day].sort():old.filter(day=>day!==item.day))}/>{item.label}</label>)}</div><div className="mt-3 space-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={carePopupEnabled} onChange={e=>setCarePopupEnabled(e.target.checked)}/>Show the website availability pop-up</label><label className="flex items-center gap-2"><input type="checkbox" checked={careSoundEnabled} onChange={e=>setCareSoundEnabled(e.target.checked)}/>Play a gentle availability sound</label></div><button type="button" disabled={savingCareSettings||!careDays.length||careStart>=careEnd} onClick={()=>void saveCareSchedule()} className="mt-3 w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingCareSettings?"Saving…":"Save Customer Care schedule"}</button></div></div>}{isAdmin&&!customerCareMode&&<form onSubmit={e=>void createGroup(e)} className="mt-5 border-t border-slate-200 pt-5"><h3 className="font-extrabold">Create a group</h3><p className="mt-1 text-xs leading-5 text-slate-500">Create a class, staff, parent or custom group. Only selected active school members can read and send messages.</p><input className={field+" mt-3"} value={groupName} onChange={e=>setGroupName(e.target.value)} maxLength={160} placeholder="Group name" aria-label="Group name"/><div className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">{sortedContacts.map(c=><label key={c.user_id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={groupMemberIds.includes(c.user_id)} onChange={e=>setGroupMemberIds(old=>e.target.checked?[...old,c.user_id]:old.filter(id=>id!==c.user_id))}/><span>{c.display_name} <span className="text-xs text-slate-500">· {c.role}</span></span></label>)}{!sortedContacts.length&&<p className="text-xs text-slate-500">No active members available.</p>}</div><button disabled={!enabled||!canUseGroups||creatingGroup||!groupName.trim()||groupMemberIds.length<2} className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{creatingGroup?"Creating group…":"Create group"}</button></form>}<div className="mt-6 flex items-center justify-between gap-2"><h2 className="font-extrabold">Recent chats</h2><button onClick={()=>void load()} className="rounded-lg border p-2" aria-label="Refresh chats"><RefreshCw size={15}/></button></div>{loading?<p className="py-4 text-sm text-slate-500">Loading…</p>:conversations.length===0?<p className="py-4 text-sm text-slate-500">No conversations yet.</p>:<div className="mt-2 space-y-2">{conversations.map(c=><button key={c.id} onClick={()=>setActiveId(c.id)} className={"w-full rounded-xl border p-3 text-left "+(activeId===c.id?"border-emerald-800 bg-emerald-50":"border-slate-200 bg-white")}><span className="block font-bold">{c.conversation_type==="group"?"👥 ":""}{c.subject}</span><span className="mt-1 block text-xs text-slate-500">{c.conversation_type==="group"?"Group conversation · ":""}{new Date(c.last_message_at).toLocaleString()}</span></button>)}</div>}</section>
      <section className={panel+" min-h-[460px]"}><div className="flex items-center gap-3 border-b border-slate-200 pb-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><MessageCircle size={22}/></span><div><h2 className="font-extrabold">{activeConversation?.subject ?? "Your messages"}</h2><p className="text-xs text-slate-500">{activeConversation?(activeConversation.conversation_type==="group"?"Group conversation":(otherContact?.display_name??memberNames[otherId]??"Conversation participant")):"Choose a conversation or start a new one"}{activeConversation && <span className="ml-2 text-emerald-700">· {onlineCount} online</span>}</p>{typingIds.length>0 && <span className="ml-2 text-emerald-700">· Someone is typing…</span>}</div></div>
        <div className="flex max-h-[480px] min-h-[300px] flex-col gap-3 overflow-y-auto py-4">{!activeConversation?<div className="m-auto max-w-sm text-center text-sm text-slate-500"><ShieldCheck size={28} className="mx-auto mb-2 text-emerald-800"/><p>Messages are private to conversation participants and authorised school administrators.</p></div>:messages.length===0?<p className="m-auto text-sm text-slate-500">No messages yet. Say hello.</p>:messages.map(m=><div id={"resa-chat-message-" + m.id} key={m.id} className={"max-w-[88%] rounded-2xl px-4 py-3 "+(m.sender_id===userId?"self-end bg-emerald-900 text-white":"self-start bg-slate-100 text-slate-900")}>{(activeConversation?.conversation_type==="group"||m.sender_id!==userId)&&<p className={"mb-1 text-[10px] font-bold "+(m.sender_id===userId?"text-emerald-100":"text-emerald-800")}>{m.sender_id===userId?"You":memberNames[m.sender_id]||contacts.find(contact=>contact.user_id===m.sender_id)?.display_name||"School member"}</p>}<p className="whitespace-pre-wrap break-words text-sm leading-6">{renderMessageBody(m.body)}</p>
          {m.attachment_path && <div className="mt-2 rounded-lg bg-black/5 p-2 text-sm">
            {m.attachment_url ? <><div>{m.attachment_mime?.startsWith("image/") ? <a href={m.attachment_url} target="_blank" rel="noreferrer"><img src={m.attachment_url} alt={m.attachment_name || "Chat attachment"} className="max-h-64 rounded-lg object-contain"/></a> : m.attachment_mime?.startsWith("audio/") ? <audio controls src={m.attachment_url} className="max-w-full"/> : m.attachment_mime?.startsWith("video/") ? <video controls src={m.attachment_url} className="max-h-64 max-w-full rounded-lg"/> : <span className="inline-flex items-center gap-2"><FileText size={16}/>{m.attachment_name || "Attached file"}</span>}</div><a href={m.attachment_download_url || m.attachment_url} download={m.attachment_name || true} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-current/20 px-3 py-1.5 text-xs font-bold"><Download size={14}/> Download file</a></> : "Attachment unavailable"}
          </div>}
          <time className={"mt-1 block text-[10px] "+(m.sender_id===userId?"text-emerald-100":"text-slate-500")}>{new Date(m.created_at).toLocaleString()}</time>
          {m.sender_id===userId && <span className="block text-right text-[10px] opacity-70">{readCounts[m.id] ? "Seen by " + readCounts[m.id] : "Sent"}</span>}</div>)}</div>
        <form onSubmit={e=>void sendMessage(e)} className="border-t border-slate-200 pt-3">
          {attachment && <div className="mb-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-950"><span className="truncate">{attachment.name} · {(attachment.size/1024/1024).toFixed(1)} MB</span><button type="button" onClick={()=>setAttachment(null)} className="font-bold">Remove</button></div>}
          {showEmojiPicker&&<div className="mb-2 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-2">{["😀","😃","😂","😊","😍","🥰","😉","😭","🙏","👍","👏","🎉","❤️","🔥","💯","🤝","🤔","😎","🙌","✅"].map(emoji=><button key={emoji} type="button" onClick={()=>setDraft(value=>value+emoji)} className="rounded-lg p-2 text-xl hover:bg-white" aria-label={"Insert "+emoji}>{emoji}</button>)}</div>}
          <div className="flex items-end gap-2">
            <button type="button" onClick={()=>setShowEmojiPicker(v=>!v)} disabled={!enabled||!activeConversation} className="rounded-lg border p-3 text-slate-700" title="Insert emoji" aria-label="Open emoji picker"><Smile size={18}/></button>
            <label className="cursor-pointer rounded-lg border p-3 text-slate-700" title="Attach a file"><Paperclip size={18}/><input type="file" className="hidden" disabled={!enabled||!canUseFiles||!activeConversation||recording||(activeConversation?.conversation_type==="group"?!canUseGroups:activeConversation?.conversation_type==="admin_support"?!canUseCustomerCare:!canUsePrivate)} accept="*/*" onChange={e=>setAttachment(e.target.files?.[0] ?? null)}/></label><button type="button" onClick={()=>recording?stopVoiceNote():void startVoiceNote()} disabled={!enabled||!canUseFiles||!activeConversation||sending||Boolean(attachment)||(activeConversation?.conversation_type==="group"?!canUseGroups:activeConversation?.conversation_type==="admin_support"?!canUseCustomerCare:!canUsePrivate)} className={"rounded-lg border p-3 "+(recording?"border-rose-300 bg-rose-50 text-rose-700":"text-slate-700")} title={recording?"Stop voice note":"Record voice note"}>{recording?<Square size={18}/>:<Mic size={18}/>}</button>
            <textarea value={draft} onChange={e=>{setDraft(e.target.value);broadcastTyping(Boolean(e.target.value.trim()));}} onBlur={()=>broadcastTyping(false)} maxLength={5000} rows={2} placeholder={!enabled?"Chat is disabled by the administrator":activeConversation?"Write a message…":"Choose a contact and open a chat to send this message"} disabled={!enabled||Boolean(activeConversation&&(activeConversation.conversation_type==="group"?!canUseGroups:activeConversation.conversation_type==="admin_support"?!canUseCustomerCare:!canUsePrivate))} className={field+" min-h-[48px] resize-y"}/>
            <button disabled={!enabled||!activeConversation||(!draft.trim()&&!attachment)||Boolean(attachment&&!canUseFiles)||sending||recording||(activeConversation?.conversation_type==="group"?!canUseGroups:activeConversation?.conversation_type==="admin_support"?!canUseCustomerCare:!canUsePrivate)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Send size={16}/>{sending?"Sending":"Send"}</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{recording?"Recording voice note… Stop recording to attach it.":!activeConversation?"You can draft a message now; open a conversation before sending. Private attachments up to 100 MB. The school administrator controls whether file sharing is enabled.":"Private attachments up to 100 MB. Images, audio, video, documents, spreadsheets, presentations and archives. Executable and active script files are blocked."}</p>
        </form>
      </section>
    </div>
    <p className="mt-4 text-center text-xs leading-5 text-slate-500">Use RESA chat for school-related communication. Do not share passwords or sensitive personal information.</p>
  </div></main>;
}
