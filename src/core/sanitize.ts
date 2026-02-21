export function normalizeTimestamp(ts?: number) {
  if (!ts) return Date.now();
  return ts < 1e12 ? ts * 1000 : ts;
}

export function toDateString(ts?: number) {
  return new Date(normalizeTimestamp(ts)).toISOString().slice(0, 10);
}

export function channelBase(value?: string): string {
  return String(value || "unknown").split(":")[0] || "unknown";
}

export function normalizeConversationId(channelId: string, raw?: string) {
  const channel = channelBase(channelId);
  const value = String(raw || "").trim();
  if (!value) return `${channel}:unknown`;

  let id = value;
  while (new RegExp(`^${channel}:${channel}:`, "i").test(id)) {
    id = id.replace(new RegExp(`^${channel}:`, "i"), "");
  }

  if (id.startsWith(`${channel}:`)) return id;
  if (/^[a-z0-9_-]+:.+/i.test(id)) return id;
  return `${channel}:${id}`;
}

export function resolveConversationId(
  ctx: { channelId?: string; conversationId?: string; accountId?: string },
  fallback?: string,
) {
  const channel = channelBase(ctx.channelId);
  if (ctx.conversationId) return normalizeConversationId(channel, ctx.conversationId);
  if (fallback) return normalizeConversationId(channel, fallback);
  if (ctx.accountId) return normalizeConversationId(channel, ctx.accountId);
  return `${channel}:unknown`;
}

export function sanitizeText(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

export function sanitizeCapturedText(raw: string, mode: "all" | "everything"): string {
  let text = sanitizeText(raw);
  if (mode === "all") {
    text = text.replace(/<lightrag-context>[\s\S]*?<\/lightrag-context>\s*/gi, "");
    text = text.replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>\s*/gi, "");
  }
  return text.trim();
}

export function extractText(value: unknown): string {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object") {
          const p = v as { text?: string; value?: string; content?: unknown; output_text?: string };
          return p.text || p.value || p.output_text || extractText(p.content);
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  if (value && typeof value === "object") {
    const v = value as { text?: string; content?: unknown; output_text?: string; output?: unknown };
    if (typeof v.text === "string") return sanitizeText(v.text);
    if (typeof v.output_text === "string") return sanitizeText(v.output_text);
    if (v.content !== undefined) return extractText(v.content);
    if (v.output !== undefined) return extractText(v.output);
  }
  return sanitizeText(String(value || ""));
}

export function clipText(text: string, maxChars = 12000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}
