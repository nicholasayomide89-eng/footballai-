import type { AiSuggestion, Prisma } from "@prisma/client";
import { db } from "../db";
import { appendLog } from "../audit";
import { AiOutputError, AiRefusalError } from "../ai/client";
import { critiqueDraft, planReply, type Critique, type ReplyContext, type ReplyPlan } from "../ai/replies";
import { voiceBrief } from "../ai/voice";
import { graphClient } from "../instagram/account";
import { InstagramApiError } from "../instagram/oauth";
import type { IncomingMessageEvent } from "../instagram/webhook";
import { evaluateMessage, type AutoRuleInput, type MessagePolicyInput, type PolicyDecision } from "../policy/engine";
import { enabledRuleKeys, LIMITS, systemState } from "./system";

const DAY_MS = 86_400_000;

function latest(current: Date | null, candidate: Date): Date {
  return current && current > candidate ? current : candidate;
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

/**
 * Stores a DM from the webhook. Returns the conversation id when a new
 * inbound message arrived and Keel should consider replying.
 */
export async function ingestMessage(event: IncomingMessageEvent): Promise<string | null> {
  const account = await db.igAccount.findFirst({ where: { igUserId: event.accountIgId, status: "active" } });
  if (!account) return null;

  const contact = await db.contact.upsert({
    where: { igAccountId_igsid: { igAccountId: account.id, igsid: event.contactIgsid } },
    create: { igAccountId: account.id, igsid: event.contactIgsid },
    update: {},
  });
  const conversation = await db.conversation.upsert({
    where: { contactId: contact.id },
    create: { contactId: contact.id },
    update: {},
  });

  const existing = await db.message.findUnique({ where: { igMid: event.mid } });
  if (existing) return null; // Our own send echoing back, or a redelivered webhook.

  await db.$transaction([
    db.message.create({
      data: {
        conversationId: conversation.id,
        igMid: event.mid,
        direction: event.isEcho ? "outbound" : "inbound",
        sentBy: event.isEcho ? "owner_manual" : "contact",
        text: event.text,
        attachments: (event.attachments ?? undefined) as Prisma.InputJsonValue | undefined,
        createdAt: event.timestamp,
      },
    }),
    // Webhooks can arrive out of order: only ever move these timestamps forward.
    db.conversation.update({
      where: { id: conversation.id },
      data: event.isEcho
        ? { lastOutboundAt: latest(conversation.lastOutboundAt, event.timestamp) }
        : { lastInboundAt: latest(conversation.lastInboundAt, event.timestamp) },
    }),
    // The owner replied by hand: any open draft for this chat is now stale.
    ...(event.isEcho
      ? [db.aiSuggestion.updateMany({ where: { conversationId: conversation.id, status: "open" }, data: { status: "expired", decidedAt: new Date() } })]
      : []),
  ]);

  if (event.isEcho || contact.blocked || contact.aiAccess === "none") return null;
  return conversation.id;
}

// ---------------------------------------------------------------------------
// Suggest
// ---------------------------------------------------------------------------

async function loadReplyContext(conversationId: string) {
  const conversation = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      contact: true,
      memory: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "desc" }, take: LIMITS.transcriptMessages },
    },
  });
  const [profile, examples] = await Promise.all([
    db.personalityProfile.findUnique({ where: { id: 1 } }),
    db.styleExample.findMany({ where: { kind: "dm" }, orderBy: { approvedAt: "desc" }, take: LIMITS.styleExamples }),
  ]);
  const messages = [...conversation.messages].reverse();
  const ctx: ReplyContext = {
    voice: voiceBrief(profile, examples),
    contactName: conversation.contact.displayName ?? conversation.contact.username ?? "this person",
    relationship: conversation.contact.relationship,
    memory: conversation.memory.map((m) => `(${m.kind}) ${m.content}`),
    transcript: messages
      .filter((m) => m.text)
      .map((m) => ({ from: m.direction === "outbound" ? ("owner" as const) : ("them" as const), text: m.text ?? "", at: m.createdAt })),
    now: new Date(),
  };
  return { conversation, messages, ctx };
}

type Loaded = Awaited<ReturnType<typeof loadReplyContext>>;

async function policyInput(
  loaded: Loaded,
  text: string,
  trigger: MessagePolicyInput["trigger"],
  criticFlags: string[],
  rule?: AutoRuleInput,
): Promise<MessagePolicyInput> {
  const { conversation, messages } = loaded;
  const since = new Date(Date.now() - DAY_MS);
  const [system, rules, autoTotal, autoToContact, outboundCount] = await Promise.all([
    systemState(),
    enabledRuleKeys(),
    db.message.count({ where: { sentBy: "keel_auto", createdAt: { gte: since } } }),
    db.message.count({ where: { sentBy: "keel_auto", createdAt: { gte: since }, conversationId: conversation.id } }),
    db.message.count({ where: { conversationId: conversation.id, direction: "outbound" } }),
  ]);
  return {
    text,
    trigger,
    now: new Date(),
    system: { automationOn: system.automationOn, messagesMode: system.messagesMode as "suggest" | "approve" | "auto", timezone: system.timezone },
    contact: {
      aiAccess: conversation.contact.aiAccess,
      relationship: conversation.contact.relationship,
      blocked: conversation.contact.blocked,
    },
    conversation: { lastInboundAt: conversation.lastInboundAt, lastOutboundAt: conversation.lastOutboundAt, outboundCount },
    recentOutbound: messages.filter((m) => m.direction === "outbound" && m.text).slice(-10).map((m) => m.text ?? ""),
    enabledRules: rules,
    autoSentToday: { total: autoTotal, toContact: autoToContact },
    globalAutoCap: LIMITS.autoMessagesPer24h,
    rule,
    criticFlags,
  };
}

/** Finds an approved automation rule that covers this plan, if any. */
async function matchingRule(plan: ReplyPlan, critique: Critique): Promise<AutoRuleInput | undefined> {
  if (plan.recommendation !== "reply" || critique.verdict !== "ok" || critique.sounds_like_owner < 80) return undefined;
  const rules = await db.automationRule.findMany({ where: { scope: "dm", enabled: true, approvedAt: { not: null } } });
  for (const r of rules) {
    const c = (r.conditions ?? {}) as { conversationTypes?: string[]; maxChars?: number };
    if (c.conversationTypes?.length && !c.conversationTypes.includes(plan.conversation_type)) continue;
    if (c.maxChars && plan.draft.length > c.maxChars) continue;
    return { id: r.id, enabled: r.enabled, approved: true, dailyCap: r.dailyCap, activeFrom: r.activeFrom, activeTo: r.activeTo };
  }
  return undefined;
}

/**
 * Drafts (or declines to draft) the next message for a conversation, records
 * it as a suggestion, and sends automatically only if an approved rule and
 * every policy check allow it.
 */
export async function suggestReply(conversationId: string): Promise<AiSuggestion | null> {
  const loaded = await loadReplyContext(conversationId);
  const lastInbound = [...loaded.messages].reverse().find((m) => m.direction === "inbound");

  let plan: ReplyPlan;
  try {
    plan = await planReply(loaded.ctx);
  } catch (err) {
    if (err instanceof AiRefusalError || err instanceof AiOutputError) {
      await db.$transaction((tx) =>
        appendLog(tx, { actor: "ai", action: "reply.draft_failed", target: conversationId, detail: { error: err.message }, outcome: "failed" }),
      );
      return null;
    }
    throw err;
  }

  const critique: Critique =
    plan.recommendation === "reply" && plan.draft.trim()
      ? await critiqueDraft(loaded.ctx, plan.draft)
      : { makes_sense: true, sounds_like_owner: 100, repeats_answered_question: false, too_pushy_or_needy: false, issues: [], flags: [], verdict: "ok" };

  const flags = [...new Set([...plan.flags, ...critique.flags])];
  const isReply = plan.recommendation === "reply" && critique.verdict !== "drop" && plan.draft.trim().length > 0;
  const decision: PolicyDecision | null = isReply
    ? evaluateMessage(await policyInput(loaded, plan.draft, "owner_approval", flags))
    : null;

  const suggestion = await db.$transaction(async (tx) => {
    await tx.aiSuggestion.updateMany({ where: { conversationId, status: "open" }, data: { status: "expired", decidedAt: new Date() } });
    const created = await tx.aiSuggestion.create({
      data: {
        conversationId,
        kind: isReply ? "reply" : "no_reply",
        draft: isReply ? plan.draft.trim() : null,
        rationale: plan.rationale,
        critic: { ...critique, flags, recommendation: plan.recommendation, their_tone: plan.their_tone } as Prisma.InputJsonValue,
        policy: (decision ?? { verdict: "block", reasons: [] }) as unknown as Prisma.InputJsonValue,
        status: decision?.verdict === "block" ? "blocked" : "open",
      },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { tone: plan.conversation_type } });
    if (plan.memory_updates.length) {
      await tx.conversationMemory.createMany({
        data: plan.memory_updates.map((m) => ({ conversationId, kind: m.kind, content: m.content, sourceMessageId: lastInbound?.id ?? null })),
      });
    }
    await appendLog(tx, {
      actor: "ai",
      action: isReply ? "reply.drafted" : `reply.${plan.recommendation}`,
      target: conversationId,
      detail: { suggestionId: created.id, rationale: plan.rationale },
      outcome: decision?.verdict === "block" ? "blocked" : "ok",
      ruleKeys: decision?.reasons.map((r) => r.key) ?? [],
    });
    return created;
  });

  if (isReply && decision?.verdict !== "block") {
    const rule = await matchingRule(plan, critique);
    if (rule) await sendSuggestion(suggestion.id, { trigger: "auto_rule", rule, criticFlags: flags });
  }
  return suggestion;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export type SendResult =
  | { status: "sent"; messageId: string }
  | { status: "needs_owner" | "blocked"; decision: PolicyDecision }
  | { status: "error"; message: string };

/**
 * The only path by which Keel sends a DM. Re-evaluates policy against fresh
 * state immediately before calling Instagram, so a pause, a new message from
 * the contact, or a manual reply since the draft was made all take effect.
 */
export async function sendSuggestion(
  suggestionId: string,
  opts: { trigger: "owner_approval"; editedText?: string } | { trigger: "auto_rule"; rule: AutoRuleInput; criticFlags: string[] },
): Promise<SendResult> {
  const suggestion = await db.aiSuggestion.findUniqueOrThrow({ where: { id: suggestionId } });
  if (suggestion.status !== "open" || suggestion.kind !== "reply" || !suggestion.draft) {
    return { status: "error", message: "This draft is no longer available." };
  }
  const edited = opts.trigger === "owner_approval" && opts.editedText !== undefined && opts.editedText.trim() !== suggestion.draft;
  const text = (opts.trigger === "owner_approval" && opts.editedText !== undefined ? opts.editedText : suggestion.draft).trim();

  const loaded = await loadReplyContext(suggestion.conversationId);
  const decision = evaluateMessage(
    await policyInput(loaded, text, opts.trigger, opts.trigger === "auto_rule" ? opts.criticFlags : [], opts.trigger === "auto_rule" ? opts.rule : undefined),
  );
  if (decision.verdict !== "allow") {
    await db.$transaction(async (tx) => {
      if (decision.verdict === "block") {
        await tx.aiSuggestion.update({ where: { id: suggestionId }, data: { status: "blocked", policy: decision as unknown as Prisma.InputJsonValue } });
      }
      await appendLog(tx, {
        actor: opts.trigger === "auto_rule" ? "ai" : "owner",
        action: opts.trigger === "auto_rule" ? "reply.auto_held" : "reply.send_refused",
        target: suggestion.conversationId,
        detail: { suggestionId },
        outcome: decision.verdict === "block" ? "blocked" : "skipped",
        ruleKeys: decision.reasons.map((r) => r.key),
      });
    });
    return { status: decision.verdict === "block" ? "blocked" : "needs_owner", decision };
  }

  // Last-moment pause check for automatic sends.
  if (opts.trigger === "auto_rule") {
    const fresh = await db.systemState.findUniqueOrThrow({ where: { id: 1 } });
    if (!fresh.automationOn) {
      const paused: PolicyDecision = { verdict: "needs_owner", reasons: [{ key: "paused", message: "Automation is paused.", verdict: "needs_owner" }] };
      return { status: "needs_owner", decision: paused };
    }
  }

  let sent: { message_id: string };
  try {
    const { client } = await graphClient();
    sent = await client.sendText(loaded.conversation.contact.igsid, text);
  } catch (err) {
    const message = err instanceof InstagramApiError ? `Instagram: ${err.message}` : "Could not reach Instagram.";
    await db.$transaction((tx) =>
      appendLog(tx, { actor: opts.trigger === "auto_rule" ? "ai" : "owner", action: "reply.send_failed", target: suggestion.conversationId, detail: { suggestionId, error: message }, outcome: "failed" }),
    );
    return { status: "error", message };
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        conversationId: suggestion.conversationId,
        igMid: sent.message_id,
        direction: "outbound",
        sentBy: opts.trigger === "auto_rule" ? "keel_auto" : "keel_approved",
        text,
        createdAt: now,
      },
    });
    await tx.conversation.update({ where: { id: suggestion.conversationId }, data: { lastOutboundAt: now } });
    await tx.aiSuggestion.update({ where: { id: suggestionId }, data: { status: edited ? "edited_and_sent" : "sent", decidedAt: now, draft: text } });
    // Learn only from what the owner approved.
    if (opts.trigger === "owner_approval") await tx.styleExample.create({ data: { kind: "dm", text } });
    await appendLog(tx, {
      actor: opts.trigger === "auto_rule" ? "ai" : "owner",
      action: opts.trigger === "auto_rule" ? "reply.sent_auto" : edited ? "reply.sent_edited" : "reply.sent_approved",
      target: suggestion.conversationId,
      detail: { suggestionId, messageId: sent.message_id, ruleId: opts.trigger === "auto_rule" ? opts.rule.id : null },
      outcome: "sent",
    });
  });
  return { status: "sent", messageId: sent.message_id };
}

export async function dismissSuggestion(suggestionId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const s = await tx.aiSuggestion.update({ where: { id: suggestionId }, data: { status: "dismissed", decidedAt: new Date() } });
    await appendLog(tx, { actor: "owner", action: "reply.dismissed", target: s.conversationId, detail: { suggestionId }, outcome: "skipped" });
  });
}
