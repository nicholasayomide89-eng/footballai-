import { db } from "../db";
import { appendLog } from "../audit";
import { LOCKED_RULES } from "../policy/engine";

export const DEFAULT_SAFETY_RULES: Array<{ key: string; label: string }> = [
  { key: "no_double_text", label: "Never message someone twice if they haven't replied" },
  { key: "no_sexual", label: "Never send sexual messages" },
  { key: "no_offensive", label: "Never send offensive messages" },
  { key: "no_arguments", label: "Never argue with people" },
  { key: "no_financial", label: "Never send money or financial information" },
  { key: "no_private_info", label: "Never share private information" },
  { key: "no_commitments", label: "Never make promises or commitments without my approval" },
];

/** Keel's own caps, deliberately far below Instagram's limits. */
export const LIMITS = {
  autoMessagesPer24h: 10,
  storiesPer24h: 3,
  transcriptMessages: 40,
  styleExamples: 20,
} as const;

/** Creates the singleton rows and default safety rules on first run. Idempotent. */
export async function ensureDefaults(): Promise<void> {
  await db.systemState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  await db.personalityProfile.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const locked = new Set<string>(LOCKED_RULES);
  for (const rule of DEFAULT_SAFETY_RULES) {
    await db.safetyRule.upsert({
      where: { key: rule.key },
      create: { ...rule, enabled: true, locked: locked.has(rule.key) },
      update: { label: rule.label, locked: locked.has(rule.key) },
    });
  }
}

export async function systemState() {
  await ensureDefaults();
  return db.systemState.findUniqueOrThrow({ where: { id: 1 } });
}

export async function enabledRuleKeys(): Promise<Set<string>> {
  const rules = await db.safetyRule.findMany({ where: { enabled: true }, select: { key: true } });
  return new Set(rules.map((r) => r.key));
}

/** The emergency switch. Pausing takes effect for every send that hasn't reached Instagram yet. */
export async function setAutomation(on: boolean, reason?: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.systemState.update({
      where: { id: 1 },
      data: on ? { automationOn: true, pausedAt: null, pausedReason: null } : { automationOn: false, pausedAt: new Date(), pausedReason: reason ?? null },
    });
    await appendLog(tx, {
      actor: "owner",
      action: on ? "automation.resumed" : "automation.paused",
      detail: reason ? { reason } : undefined,
      outcome: "ok",
    });
  });
}
