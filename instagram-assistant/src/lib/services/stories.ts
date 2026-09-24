import { randomUUID } from "node:crypto";
import type { Prisma, StoryDraft } from "@prisma/client";
import { db } from "../db";
import { appendLog } from "../audit";
import { planStory, type StoryStyle } from "../ai/stories";
import { voiceBrief } from "../ai/voice";
import { graphClient } from "../instagram/account";
import { InstagramApiError } from "../instagram/oauth";
import { evaluateStory, type PolicyDecision } from "../policy/engine";
import { presignedGetUrl, putObject } from "./storage";
import { LIMITS, systemState } from "./system";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_VISION_BYTES = 5 * 1024 * 1024;

type ImageType = (typeof IMAGE_TYPES)[number];

export function mediaKind(mime: string): "image" | "video" | null {
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

/**
 * Stores an upload and asks the AI for a Story plan. Videos are stored and
 * can be published, but the AI plan is only generated for images (the owner
 * adds a note describing a video instead).
 */
export async function draftStory(opts: { bytes: Uint8Array; mimeType: string; fileName?: string; style: StoryStyle; note?: string }): Promise<StoryDraft> {
  const kind = mediaKind(opts.mimeType);
  if (!kind) throw new Error("Unsupported file type");
  if (opts.bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("File is larger than 50 MB");

  const storageKey = `media/${randomUUID()}`;
  await putObject(storageKey, opts.bytes, opts.mimeType);
  const asset = await db.mediaAsset.create({ data: { storageKey, mimeType: opts.mimeType, kind, originalName: opts.fileName } });

  const [profile, examples, recent] = await Promise.all([
    db.personalityProfile.findUnique({ where: { id: 1 } }),
    db.styleExample.findMany({ where: { kind: { in: ["story", "caption"] } }, orderBy: { approvedAt: "desc" }, take: LIMITS.styleExamples }),
    db.storyDraft.findMany({ where: { status: { in: ["published", "handoff"] } }, orderBy: { createdAt: "desc" }, take: 15, select: { overlayText: true } }),
  ]);

  if (kind === "video" || opts.bytes.byteLength > MAX_VISION_BYTES) {
    return db.storyDraft.create({
      data: {
        mediaAssetId: asset.id,
        style: opts.style,
        overlayText: null,
        hashtags: [],
        quality: { concerns: ["Keel can't review this file automatically (video or larger than 5 MB). Check it yourself before posting."] },
        recommended: false,
      },
    });
  }

  const plan = await planStory({
    voice: voiceBrief(profile, examples),
    style: opts.style,
    image: { mediaType: opts.mimeType as ImageType, base64: Buffer.from(opts.bytes).toString("base64") },
    recentTexts: recent.map((r) => r.overlayText).filter((t): t is string => Boolean(t)),
    ownerNote: opts.note,
  });

  return db.$transaction(async (tx) => {
    const draft = await tx.storyDraft.create({
      data: {
        mediaAssetId: asset.id,
        style: opts.style,
        overlayText: plan.overlay_text || null,
        caption: plan.caption_note || null,
        stickerIdea: plan.sticker.type === "none" ? undefined : (plan.sticker as Prisma.InputJsonValue),
        musicIdea: plan.music_idea || null,
        hashtags: plan.hashtags,
        quality: { makes_sense: plan.makes_sense, concerns: plan.concerns, similarity_to_recent: plan.similarity_to_recent },
        recommended: plan.recommended && plan.makes_sense && plan.similarity_to_recent !== "high",
      },
    });
    await appendLog(tx, {
      actor: "ai",
      action: "story.drafted",
      target: draft.id,
      detail: { style: opts.style, recommended: draft.recommended, concerns: plan.concerns },
      outcome: "ok",
    });
    return draft;
  });
}

export type PublishResult = { status: "published"; igMediaId: string } | { status: "blocked" | "needs_owner"; decision: PolicyDecision } | { status: "error"; message: string };

/**
 * Publishes an approved Story through the official Content Publishing API.
 * Overlay text and stickers can't be applied by the API: Keel publishes the
 * media as-is; use the Instagram handoff when you want text or stickers.
 */
export async function publishStory(draftId: string): Promise<PublishResult> {
  const draft = await db.storyDraft.findUniqueOrThrow({ where: { id: draftId }, include: { mediaAsset: true } });
  if (draft.status !== "suggested" && draft.status !== "approved" && draft.status !== "failed") {
    return { status: "error", message: "This Story has already been handled." };
  }

  let quota = { quota_usage: 0, config: { quota_total: 100, quota_duration: 86400 } };
  try {
    const { client } = await graphClient();
    const limit = await client.publishingLimit();
    quota = { quota_usage: limit.quota_usage, config: limit.config ?? quota.config };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Could not check the publishing limit." };
  }

  const system = await systemState();
  const keelStoriesLast24h = await db.storyDraft.count({ where: { status: "published", decidedAt: { gte: new Date(Date.now() - 86_400_000) } } });
  const decision = evaluateStory({
    trigger: "owner_approval",
    system: { automationOn: system.automationOn, storiesMode: system.storiesMode as "approve" | "auto" },
    quotaUsage: quota.quota_usage,
    quotaTotal: quota.config.quota_total,
    keelStoriesLast24h,
    keelDailyStoryCap: LIMITS.storiesPer24h,
    recommended: draft.recommended,
    hasStickers: Boolean(draft.stickerIdea),
  });
  if (decision.verdict !== "allow") {
    await db.$transaction((tx) =>
      appendLog(tx, { actor: "owner", action: "story.publish_refused", target: draftId, outcome: "blocked", ruleKeys: decision.reasons.map((r) => r.key) }),
    );
    return { status: decision.verdict === "block" ? "blocked" : "needs_owner", decision };
  }

  try {
    const { client } = await graphClient();
    const url = await presignedGetUrl(draft.mediaAsset.storageKey);
    const igMediaId = await client.publishStory(url, draft.mediaAsset.kind === "video" ? "video" : "image");
    await db.$transaction(async (tx) => {
      await tx.storyDraft.update({ where: { id: draftId }, data: { status: "published", igMediaId, decidedAt: new Date(), failureReason: null } });
      if (draft.overlayText) await tx.styleExample.create({ data: { kind: "story", text: draft.overlayText } });
      await appendLog(tx, { actor: "owner", action: "story.published", target: draftId, detail: { igMediaId }, outcome: "published" });
    });
    return { status: "published", igMediaId };
  } catch (err) {
    const message = err instanceof InstagramApiError ? `Instagram: ${err.message}` : err instanceof Error ? err.message : "Publishing failed.";
    await db.$transaction(async (tx) => {
      await tx.storyDraft.update({ where: { id: draftId }, data: { status: "failed", failureReason: message } });
      await appendLog(tx, { actor: "owner", action: "story.publish_failed", target: draftId, detail: { error: message }, outcome: "failed" });
    });
    return { status: "error", message };
  }
}

/** The owner finished the Story by hand in Instagram (for stickers, music or text). */
export async function markHandoff(draftId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const draft = await tx.storyDraft.update({ where: { id: draftId }, data: { status: "handoff", decidedAt: new Date() } });
    if (draft.overlayText) await tx.styleExample.create({ data: { kind: "story", text: draft.overlayText } });
    await appendLog(tx, { actor: "owner", action: "story.handoff", target: draftId, outcome: "ok" });
  });
}

export async function rejectStory(draftId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.storyDraft.update({ where: { id: draftId }, data: { status: "rejected", decidedAt: new Date() } });
    await appendLog(tx, { actor: "owner", action: "story.rejected", target: draftId, outcome: "skipped" });
  });
}

