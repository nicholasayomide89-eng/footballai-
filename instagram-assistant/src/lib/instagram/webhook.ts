import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface IncomingMessageEvent {
  kind: "message";
  accountIgId: string;
  /** The other person, whichever direction the message went. */
  contactIgsid: string;
  mid: string;
  text: string | null;
  attachments: unknown[] | null;
  /** true when the account itself sent the message (from Keel or the Instagram app). */
  isEcho: boolean;
  timestamp: Date;
}

interface RawMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; attachments?: unknown[]; is_echo?: boolean; is_deleted?: boolean; is_unsupported?: boolean };
}

interface RawPayload {
  object?: string;
  entry?: Array<{ id?: string; time?: number; messaging?: RawMessaging[] }>;
}

/** Extracts DM events from a webhook payload. Unknown shapes are ignored, never thrown on. */
export function parseMessagingEvents(payload: unknown): IncomingMessageEvent[] {
  const body = payload as RawPayload;
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return [];
  const out: IncomingMessageEvent[] = [];
  for (const entry of body.entry) {
    const accountIgId = entry.id;
    if (!accountIgId || !Array.isArray(entry.messaging)) continue;
    for (const m of entry.messaging) {
      const msg = m.message;
      if (!msg?.mid || msg.is_deleted || msg.is_unsupported) continue;
      const isEcho = msg.is_echo === true;
      const contactIgsid = isEcho ? m.recipient?.id : m.sender?.id;
      if (!contactIgsid) continue;
      out.push({
        kind: "message",
        accountIgId,
        contactIgsid,
        mid: msg.mid,
        text: msg.text ?? null,
        attachments: msg.attachments ?? null,
        isEcho,
        timestamp: new Date(m.timestamp ?? entry.time ?? Date.now()),
      });
    }
  }
  return out;
}
