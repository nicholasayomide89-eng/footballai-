"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { appendLog } from "@/lib/audit";
import { isOwner } from "@/lib/auth";
import { dismissSuggestion, sendSuggestion, suggestReply } from "@/lib/services/messaging";
import { draftStory, markHandoff, mediaKind, publishStory, rejectStory } from "@/lib/services/stories";
import { ensureDefaults, setAutomation } from "@/lib/services/system";
import { STORY_STYLES } from "@/lib/ai/stories";

async function guard() {
  if (!(await isOwner())) redirect("/login");
}

function back(path: string, params: Record<string, string> = {}): never {
  // Only same-site relative paths, never an open redirect.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) path = "/";
  const qs = new URLSearchParams(params).toString();
  redirect(qs ? `${path}?${qs}` : path);
}

// --- Emergency switch & modes -------------------------------------------------

export async function pauseAutomation(formData: FormData) {
  await guard();
  await setAutomation(false, String(formData.get("reason") ?? "") || undefined);
  revalidatePath("/", "layout");
  back(String(formData.get("returnTo") ?? "/rules"));
}

export async function resumeAutomation(formData: FormData) {
  await guard();
  if (formData.get("confirm") !== "yes") back("/rules", { error: "Tick the box to confirm you want automation back on." });
  await setAutomation(true);
  revalidatePath("/", "layout");
  back("/rules");
}

const ModesSchema = z.object({
  messagesMode: z.enum(["suggest", "approve", "auto"]),
  storiesMode: z.enum(["approve", "auto"]),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
});

export async function saveModes(formData: FormData) {
  await guard();
  const parsed = ModesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/rules", { error: parsed.error.issues[0]?.message ?? "Invalid settings" });
  await db.$transaction(async (tx) => {
    const before = await tx.systemState.findUniqueOrThrow({ where: { id: 1 } });
    await tx.systemState.update({ where: { id: 1 }, data: parsed.data });
    await appendLog(tx, {
      actor: "owner",
      action: "settings.modes_changed",
      detail: { from: { messagesMode: before.messagesMode, storiesMode: before.storiesMode }, to: parsed.data },
      outcome: "ok",
    });
  });
  revalidatePath("/", "layout");
  back("/rules", { saved: "1" });
}

export async function saveSafetyRules(formData: FormData) {
  await guard();
  await ensureDefaults();
  const rules = await db.safetyRule.findMany();
  await db.$transaction(async (tx) => {
    for (const rule of rules) {
      const enabled = rule.locked || formData.get(rule.key) === "on";
      if (enabled !== rule.enabled) {
        await tx.safetyRule.update({ where: { key: rule.key }, data: { enabled } });
        await appendLog(tx, { actor: "owner", action: enabled ? "rule.enabled" : "rule.disabled", target: rule.key, outcome: "ok" });
      }
    }
  });
  revalidatePath("/rules");
  back("/rules", { saved: "1" });
}

const AutoRuleSchema = z.object({
  name: z.string().trim().min(3).max(80),
  conversationTypes: z.array(z.enum(["friendly", "professional", "networking", "casual"])).min(1, "Pick at least one conversation type"),
  maxChars: z.coerce.number().int().min(20).max(500),
  dailyCap: z.coerce.number().int().min(1).max(10),
  activeFrom: z.coerce.number().int().min(0).max(23),
  activeTo: z.coerce.number().int().min(0).max(23),
});

export async function createAutoRule(formData: FormData) {
  await guard();
  if (formData.get("confirm") !== "yes") back("/rules", { error: "Confirm that you approve this rule." });
  const parsed = AutoRuleSchema.safeParse({
    name: formData.get("name"),
    conversationTypes: formData.getAll("conversationTypes"),
    maxChars: formData.get("maxChars"),
    dailyCap: formData.get("dailyCap"),
    activeFrom: formData.get("activeFrom"),
    activeTo: formData.get("activeTo"),
  });
  if (!parsed.success) back("/rules", { error: parsed.error.issues[0]?.message ?? "Invalid rule" });
  const { name, conversationTypes, maxChars, ...rest } = parsed.data;
  await db.$transaction(async (tx) => {
    const rule = await tx.automationRule.create({
      data: { name, scope: "dm", conditions: { conversationTypes, maxChars }, ...rest, enabled: true, approvedAt: new Date() },
    });
    await appendLog(tx, { actor: "owner", action: "auto_rule.created", target: rule.id, detail: { name, conversationTypes, maxChars, ...rest }, outcome: "ok" });
  });
  revalidatePath("/rules");
  back("/rules", { saved: "1" });
}

export async function toggleAutoRule(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  await db.$transaction(async (tx) => {
    const rule = await tx.automationRule.findUniqueOrThrow({ where: { id } });
    await tx.automationRule.update({ where: { id }, data: { enabled: !rule.enabled } });
    await appendLog(tx, { actor: "owner", action: rule.enabled ? "auto_rule.disabled" : "auto_rule.enabled", target: id, outcome: "ok" });
  });
  revalidatePath("/rules");
  back("/rules");
}

// --- Replies ---------------------------------------------------------------------

export async function sendReply(formData: FormData) {
  await guard();
  const suggestionId = String(formData.get("suggestionId"));
  const conversationId = String(formData.get("conversationId"));
  const text = String(formData.get("text") ?? "");
  const result = await sendSuggestion(suggestionId, { trigger: "owner_approval", editedText: text });
  revalidatePath(`/inbox/${conversationId}`);
  if (result.status === "sent") back(`/inbox/${conversationId}`, { sent: "1" });
  if (result.status === "error") back(`/inbox/${conversationId}`, { error: result.message });
  back(`/inbox/${conversationId}`, { error: result.decision.reasons.map((r) => r.message).join(" ") });
}

export async function skipReply(formData: FormData) {
  await guard();
  const conversationId = String(formData.get("conversationId"));
  await dismissSuggestion(String(formData.get("suggestionId")));
  revalidatePath(`/inbox/${conversationId}`);
  back(`/inbox/${conversationId}`);
}

export async function regenerateReply(formData: FormData) {
  await guard();
  const conversationId = String(formData.get("conversationId"));
  await suggestReply(conversationId);
  revalidatePath(`/inbox/${conversationId}`);
  back(`/inbox/${conversationId}`);
}

const ContactSchema = z.object({
  relationship: z.enum(["friend", "professional", "networking", "dating", "casual", "unknown"]),
  aiAccess: z.enum(["none", "suggest", "approve", "auto"]),
  displayName: z.string().trim().max(80).optional(),
});

export async function saveContact(formData: FormData) {
  await guard();
  const contactId = String(formData.get("contactId"));
  const conversationId = String(formData.get("conversationId"));
  const parsed = ContactSchema.safeParse({
    relationship: formData.get("relationship"),
    aiAccess: formData.get("aiAccess"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) back(`/inbox/${conversationId}`, { error: "Invalid contact settings" });
  await db.$transaction(async (tx) => {
    const before = await tx.contact.findUniqueOrThrow({ where: { id: contactId } });
    await tx.contact.update({ where: { id: contactId }, data: parsed.data });
    await appendLog(tx, {
      actor: "owner",
      action: "contact.updated",
      target: contactId,
      detail: { from: { relationship: before.relationship, aiAccess: before.aiAccess }, to: { relationship: parsed.data.relationship, aiAccess: parsed.data.aiAccess } },
      outcome: "ok",
    });
  });
  revalidatePath(`/inbox/${conversationId}`);
  back(`/inbox/${conversationId}`, { saved: "1" });
}

export async function forgetMemory(formData: FormData) {
  await guard();
  const conversationId = String(formData.get("conversationId"));
  const id = String(formData.get("memoryId"));
  await db.$transaction(async (tx) => {
    await tx.conversationMemory.delete({ where: { id } });
    await appendLog(tx, { actor: "owner", action: "memory.deleted", target: conversationId, outcome: "ok" });
  });
  revalidatePath(`/inbox/${conversationId}`);
  back(`/inbox/${conversationId}`);
}

// --- Stories ---------------------------------------------------------------------

export async function uploadStory(formData: FormData) {
  await guard();
  const file = formData.get("media");
  const style = z.enum(STORY_STYLES).safeParse(formData.get("style"));
  if (!(file instanceof File) || file.size === 0) back("/stories", { error: "Choose a photo or video." });
  if (!style.success) back("/stories", { error: "Pick a style." });
  if (!mediaKind(file.type)) back("/stories", { error: "Use a JPEG, PNG, WebP, MP4 or MOV file." });
  const note = String(formData.get("note") ?? "").slice(0, 500) || undefined;
  let draftId: string;
  try {
    const draft = await draftStory({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type, fileName: file.name, style: style.data, note });
    draftId = draft.id;
  } catch (err) {
    back("/stories", { error: err instanceof Error ? err.message : "Couldn't draft this Story." });
  }
  back(`/stories/${draftId}`);
}

export async function publishStoryAction(formData: FormData) {
  await guard();
  const id = String(formData.get("draftId"));
  if (formData.get("confirm") !== "yes") back(`/stories/${id}`, { error: "Confirm that you want to publish this Story now." });
  const result = await publishStory(id);
  revalidatePath("/stories");
  if (result.status === "published") back(`/stories/${id}`, { published: "1" });
  if (result.status === "error") back(`/stories/${id}`, { error: result.message });
  back(`/stories/${id}`, { error: result.decision.reasons.map((r) => r.message).join(" ") });
}

export async function handoffStory(formData: FormData) {
  await guard();
  const id = String(formData.get("draftId"));
  await markHandoff(id);
  revalidatePath("/stories");
  back(`/stories/${id}`);
}

export async function rejectStoryAction(formData: FormData) {
  await guard();
  await rejectStory(String(formData.get("draftId")));
  revalidatePath("/stories");
  back("/stories");
}

// --- Personality -------------------------------------------------------------------

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

const PersonalitySchema = z.object({
  humor: z.coerce.number().int().min(0).max(4),
  confidence: z.coerce.number().int().min(0).max(4),
  formality: z.coerce.number().int().min(0).max(4),
  flirting: z.coerce.number().int().min(0).max(3),
  emojiRate: z.enum(["none", "rare", "some", "lots"]),
  sentenceLength: z.enum(["short", "mid", "long"]),
});

export async function savePersonality(formData: FormData) {
  await guard();
  const parsed = PersonalitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/personality", { error: "Invalid values" });
  const facts: Record<string, string> = {};
  for (const key of ["work", "city", "interests", "offLimits", "other"]) {
    const v = String(formData.get(`fact_${key}`) ?? "").trim().slice(0, 300);
    if (v) facts[key] = v;
  }
  await ensureDefaults();
  await db.$transaction(async (tx) => {
    await tx.personalityProfile.update({
      where: { id: 1 },
      data: {
        ...parsed.data,
        slang: list(formData.get("slang")),
        signaturePhrases: list(formData.get("signaturePhrases")),
        bannedPhrases: list(formData.get("bannedPhrases")),
        factsAboutMe: facts as Prisma.InputJsonValue,
      },
    });
    await appendLog(tx, { actor: "owner", action: "personality.updated", outcome: "ok" });
  });
  revalidatePath("/personality");
  back("/personality", { saved: "1" });
}

export async function deleteStyleExample(formData: FormData) {
  await guard();
  await db.styleExample.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/personality");
  back("/personality");
}
