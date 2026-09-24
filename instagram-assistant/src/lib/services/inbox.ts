import { db } from "../db";
import { MESSAGING_WINDOW_MS, type PolicyDecision } from "../policy/engine";

export type ThreadStatus = { label: string; tone: "accent" | "warn" | "ok" | "neutral" };

export async function inboxThreads() {
  const conversations = await db.conversation.findMany({
    where: { contact: { igAccount: { status: "active" } } },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      suggestions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const now = Date.now();
  return conversations
    .map((c) => {
      const last = c.messages[0];
      const s = c.suggestions[0];
      const awaitingThem = c.lastOutboundAt !== null && (c.lastInboundAt === null || c.lastOutboundAt > c.lastInboundAt);
      const windowOpen = c.lastInboundAt !== null && now - c.lastInboundAt.getTime() <= MESSAGING_WINDOW_MS;
      let status: ThreadStatus;
      if (awaitingThem) status = { label: "Waiting on them. Don't double-text", tone: "neutral" };
      else if (s?.status === "open" && s.kind === "reply") status = { label: "Draft ready", tone: "accent" };
      else if (s?.status === "blocked") {
        const reason = (s.policy as unknown as PolicyDecision | null)?.reasons?.[0]?.message;
        status = { label: reason ? `Needs you: ${reason}` : "Needs you", tone: "warn" };
      } else if (s?.kind === "no_reply" && s.status === "open") status = { label: "No reply needed", tone: "neutral" };
      else if (!windowOpen && c.lastInboundAt) status = { label: "Window closed: reply in Instagram", tone: "warn" };
      else status = { label: "Up to date", tone: "ok" };
      return { conversation: c, last, status, sortAt: last?.createdAt ?? new Date(0) };
    })
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());
}

export function contactName(c: { displayName: string | null; username: string | null; igsid: string }): string {
  return c.displayName ?? (c.username ? `@${c.username}` : `Contact …${c.igsid.slice(-4)}`);
}

export function timeAgo(d: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
