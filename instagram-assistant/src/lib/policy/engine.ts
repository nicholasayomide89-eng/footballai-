import { detect, similarity, type DetectorKey } from "./detectors";

/**
 * The policy engine is the one gate every outbound message passes through.
 * It is pure (no I/O) so every rule is unit-tested. Callers load the context
 * from the database, call `evaluateMessage`, and act on the verdict:
 *
 *   allow        send it now
 *   needs_owner  keep it as a draft and ask the owner
 *   block        do not send; show the owner why
 *
 * The emergency pause is re-read by the caller inside the send transaction,
 * so a pause that lands between evaluation and send still wins.
 */

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DUPLICATE_THRESHOLD = 0.8;

export type MessagesMode = "suggest" | "approve" | "auto";
export type AiAccess = "none" | "suggest" | "approve" | "auto";
export type Relationship = "friend" | "professional" | "networking" | "dating" | "casual" | "unknown";

/** Rules that can never be switched off, even by the owner. */
export const LOCKED_RULES = [
  "no_double_text",
  "no_sexual",
  "no_offensive",
  "no_financial",
  "no_private_info",
] as const;

/** Detectors whose hits block a message outright (owner approval is not enough). */
const FORBIDDEN: ReadonlySet<DetectorKey> = new Set([
  "no_sexual",
  "no_offensive",
  "no_financial",
  "no_private_info",
]);

export interface AutoRuleInput {
  id: string;
  enabled: boolean;
  approved: boolean;
  dailyCap: number;
  activeFrom: number;
  activeTo: number;
}

export interface MessagePolicyInput {
  text: string;
  /** owner_approval: the owner tapped Send. auto_rule: an automation rule wants to send. */
  trigger: "owner_approval" | "auto_rule";
  now: Date;
  system: { automationOn: boolean; messagesMode: MessagesMode; timezone: string };
  contact: { aiAccess: AiAccess; relationship: Relationship; blocked: boolean };
  conversation: {
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
    /** Outbound messages ever sent in this conversation, by anyone. */
    outboundCount: number;
  };
  /** Most recent outbound texts in this conversation (newest first). */
  recentOutbound: string[];
  /** Safety rule keys currently enabled (locked rules are always added). */
  enabledRules: ReadonlySet<string>;
  /** Automatic sends so far today. */
  autoSentToday: { total: number; toContact: number };
  /** Global cap on automatic messages per day, across all rules. */
  globalAutoCap: number;
  rule?: AutoRuleInput;
  /** Sensitivity flags raised by the AI critic, e.g. "dating", "conflict", "emotional". */
  criticFlags: string[];
}

export type Verdict = "allow" | "needs_owner" | "block";

export interface Reason {
  key: string;
  message: string;
  verdict: Exclude<Verdict, "allow">;
}

export interface PolicyDecision {
  verdict: Verdict;
  reasons: Reason[];
}

export function effectiveRules(enabled: Iterable<string>): Set<string> {
  const set = new Set(enabled);
  for (const key of LOCKED_RULES) set.add(key);
  return set;
}

/** Local hour (0-23) in the given IANA timezone. */
export function localHour(now: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now);
  return Number.parseInt(hour, 10);
}

/** Active hours are [from, to) in local time; from === to means all day; from > to wraps midnight. */
function inActiveHours(hour: number, from: number, to: number): boolean {
  if (from === to) return true;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export function evaluateMessage(input: MessagePolicyInput): PolicyDecision {
  const reasons: Reason[] = [];
  const block = (key: string, message: string) => reasons.push({ key, message, verdict: "block" });
  const ask = (key: string, message: string) => reasons.push({ key, message, verdict: "needs_owner" });
  const rules = effectiveRules(input.enabledRules);
  const { conversation: convo, contact, system } = input;
  const text = input.text.trim();

  if (!text) block("empty", "The message is empty.");

  // --- Who Keel may help with -------------------------------------------
  if (contact.blocked) block("contact_blocked", "You blocked Keel from this contact.");
  if (contact.aiAccess === "none") block("contact_no_ai", "You turned AI off for this contact.");

  // --- Instagram platform rules -------------------------------------------
  if (!convo.lastInboundAt) {
    block("no_inbound", "Instagram only allows replies to people who messaged you first.");
  } else if (input.now.getTime() - convo.lastInboundAt.getTime() > MESSAGING_WINDOW_MS) {
    block(
      "window_closed",
      "More than 24 hours since their last message. Instagram's API can't send this; reply yourself in the Instagram app.",
    );
  }

  // --- Anti-spam ------------------------------------------------------------
  const awaitingReply =
    convo.lastOutboundAt !== null && (convo.lastInboundAt === null || convo.lastOutboundAt > convo.lastInboundAt);
  if (rules.has("no_double_text") && awaitingReply) {
    block("no_double_text", "They haven't replied to your last message yet. Keel doesn't double-text.");
  }
  if (text && input.recentOutbound.some((prev) => similarity(prev, text) >= DUPLICATE_THRESHOLD)) {
    block("duplicate", "Too similar to something you already sent in this chat.");
  }

  // --- Content hard rules ----------------------------------------------------
  for (const hit of detect(text, rules)) {
    if (FORBIDDEN.has(hit.key)) block(hit.key, hit.message);
    else if (input.trigger === "auto_rule") ask(hit.key, hit.message);
    // For owner_approval, commitments and pushback are the owner's call: they approved it.
  }

  // --- Mode gate --------------------------------------------------------------
  if (input.trigger === "owner_approval") {
    if (system.messagesMode === "suggest") {
      block("suggest_only", "Suggest-only mode: copy the text and send it yourself in Instagram.");
    }
    if (contact.aiAccess === "suggest") {
      block("contact_suggest_only", "This contact is set to suggestions only. Send it yourself in Instagram.");
    }
  } else {
    if (!system.automationOn) ask("paused", "Automation is paused.");
    if (system.messagesMode !== "auto") ask("mode", "Messages mode isn't set to automatic.");
    if (contact.aiAccess !== "auto") ask("contact_not_auto", "This contact isn't allowed automatic replies.");
    const rule = input.rule;
    if (!rule || !rule.enabled || !rule.approved) {
      ask("no_rule", "No approved automation rule covers this message.");
    } else {
      const hour = localHour(input.now, system.timezone);
      if (!inActiveHours(hour, rule.activeFrom, rule.activeTo)) ask("quiet_hours", "Outside this rule's active hours.");
      if (input.autoSentToday.total >= Math.min(rule.dailyCap, input.globalAutoCap)) {
        ask("daily_cap", "Daily limit for automatic messages reached.");
      }
      if (input.autoSentToday.toContact >= 3) ask("contact_cap", "Already sent 3 automatic messages to this person today.");
    }
    if (convo.outboundCount === 0) ask("first_message", "First message in this conversation needs your approval.");
    if (contact.relationship === "dating") ask("dating", "Dating conversations always need your approval.");
    for (const flag of input.criticFlags) ask(`critic_${flag}`, `The AI critic flagged this as ${flag}.`);
  }

  const verdict: Verdict = reasons.some((r) => r.verdict === "block")
    ? "block"
    : reasons.length > 0
      ? "needs_owner"
      : "allow";
  return { verdict, reasons };
}

export interface StoryPolicyInput {
  trigger: "owner_approval" | "auto_rule";
  system: { automationOn: boolean; storiesMode: "approve" | "auto" };
  /** API publishes in the rolling 24h window, as reported by Instagram. */
  quotaUsage: number;
  quotaTotal: number;
  /** Stories Keel published in the last 24h. */
  keelStoriesLast24h: number;
  keelDailyStoryCap: number;
  recommended: boolean;
  hasStickers: boolean;
}

export function evaluateStory(input: StoryPolicyInput): PolicyDecision {
  const reasons: Reason[] = [];
  if (input.quotaUsage >= input.quotaTotal) {
    reasons.push({ key: "ig_quota", message: "Instagram's 24-hour publishing limit is used up.", verdict: "block" });
  }
  if (input.keelStoriesLast24h >= input.keelDailyStoryCap) {
    reasons.push({ key: "keel_cap", message: `Keel's own limit of ${input.keelDailyStoryCap} Stories a day is reached.`, verdict: "block" });
  }
  if (input.trigger === "auto_rule") {
    if (!input.system.automationOn) reasons.push({ key: "paused", message: "Automation is paused.", verdict: "needs_owner" });
    if (input.system.storiesMode !== "auto") reasons.push({ key: "mode", message: "Stories mode isn't automatic.", verdict: "needs_owner" });
    if (!input.recommended) reasons.push({ key: "not_recommended", message: "The quality check didn't recommend this Story.", verdict: "needs_owner" });
    if (input.hasStickers) reasons.push({ key: "stickers", message: "Stickers must be added by hand in Instagram.", verdict: "needs_owner" });
  }
  const verdict: Verdict = reasons.some((r) => r.verdict === "block") ? "block" : reasons.length ? "needs_owner" : "allow";
  return { verdict, reasons };
}
