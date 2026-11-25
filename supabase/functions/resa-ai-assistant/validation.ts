export type ChatMessage = { role: "user" | "assistant"; content: string };

export function validateMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8) return null;
  const messages: ChatMessage[] = [];
  let totalLength = 0;
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > 1200) return null;
    totalLength += text.length;
    if (totalLength > 6000) return null;
    messages.push({ role, content: text });
  }
  if (messages[messages.length - 1]?.role !== "user") return null;
  return messages;
}
