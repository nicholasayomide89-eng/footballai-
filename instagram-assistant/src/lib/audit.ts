import type { LogActor, LogOutcome, Prisma } from "@prisma/client";
import { sha256 } from "./crypto";

/**
 * Append-only, hash-chained activity log. Each entry's hash covers the
 * previous entry's hash, so any edit or deletion breaks the chain and
 * `verifyChain` reports where.
 */

export const GENESIS_HASH = "0".repeat(64);

export interface LogEntryInput {
  actor: LogActor;
  action: string;
  target?: string | null;
  detail?: Prisma.InputJsonValue;
  outcome: LogOutcome;
  ruleKeys?: string[];
}

/** Stable JSON: object keys sorted, so the same data always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function entryHashes(entry: LogEntryInput, prevHash: string, at: Date) {
  const payloadHash = sha256(
    canonicalJson({
      actor: entry.actor,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ?? null,
      outcome: entry.outcome,
      ruleKeys: entry.ruleKeys ?? [],
      at: at.toISOString(),
    }),
  );
  return { payloadHash, hash: sha256(`${prevHash}:${payloadHash}`) };
}

/** Appends an entry inside the caller's transaction. */
export async function appendLog(tx: Prisma.TransactionClient, entry: LogEntryInput) {
  // Serialise writers so two concurrent appends can't share a prevHash.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7201)`;
  const last = await tx.actionLog.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS_HASH;
  const at = new Date();
  const { payloadHash, hash } = entryHashes(entry, prevHash, at);
  return tx.actionLog.create({
    data: {
      actor: entry.actor,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail,
      outcome: entry.outcome,
      ruleKeys: entry.ruleKeys ?? [],
      payloadHash,
      prevHash,
      hash,
      at,
    },
  });
}

export interface StoredEntry extends LogEntryInput {
  seq: bigint;
  prevHash: string;
  hash: string;
  at: Date;
}

/** Returns the seq of the first broken link, or null when the chain is intact. */
export function verifyChain(entries: StoredEntry[]): bigint | null {
  let prev = GENESIS_HASH;
  for (const e of entries) {
    const { hash } = entryHashes(e, prev, e.at);
    if (e.prevHash !== prev || e.hash !== hash) return e.seq;
    prev = e.hash;
  }
  return null;
}
