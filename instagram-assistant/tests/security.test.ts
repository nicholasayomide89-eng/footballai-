import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entryHashes, GENESIS_HASH, verifyChain, type StoredEntry } from "@/lib/audit";
import { hashPassword, open, parseKey, seal, verifyPassword } from "@/lib/crypto";
import { parseMessagingEvents, verifySignature } from "@/lib/instagram/webhook";
import { createSessionToken, verifySessionToken } from "@/lib/session";

describe("token encryption", () => {
  const key = randomBytes(32);
  it("round-trips and uses a fresh IV each time", () => {
    const a = seal("IGAAtoken", key);
    const b = seal("IGAAtoken", key);
    expect(open(a, key)).toBe("IGAAtoken");
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.toString("utf8")).not.toContain("IGAAtoken");
  });
  it("rejects tampering and wrong keys", () => {
    const s = seal("secret", key);
    s.ciphertext[0] = s.ciphertext[0]! ^ 1;
    expect(() => open(s, key)).toThrow();
    expect(() => open(seal("secret", key), randomBytes(32))).toThrow();
  });
  it("requires a 32-byte key", () => {
    expect(() => parseKey(Buffer.alloc(16).toString("base64"))).toThrow();
    expect(parseKey(key.toString("base64")).length).toBe(32);
  });
});

describe("owner password", () => {
  it("verifies the right password only", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("wrong horse battery", stored)).toBe(false);
    expect(verifyPassword("x", "plain")).toBe(false);
  });
});

describe("session cookie", () => {
  const secret = "s".repeat(48);
  it("accepts a fresh token and rejects forged or expired ones", async () => {
    const token = await createSessionToken(secret);
    expect(await verifySessionToken(token, secret)).toBe(true);
    expect(await verifySessionToken(token, "t".repeat(48))).toBe(false);
    expect(await verifySessionToken(`${token}x`, secret)).toBe(false);
    expect(await verifySessionToken(undefined, secret)).toBe(false);
    const old = await createSessionToken(secret, Date.now() - 8 * 86_400_000);
    expect(await verifySessionToken(old, secret)).toBe(false);
  });
});

describe("audit hash chain", () => {
  function chain(n: number): StoredEntry[] {
    let prev = GENESIS_HASH;
    const out: StoredEntry[] = [];
    for (let i = 1; i <= n; i++) {
      const entry = { actor: "ai" as const, action: "reply.drafted", target: `c${i}`, detail: { i, nested: { b: 2, a: 1 } }, outcome: "ok" as const, ruleKeys: [] };
      const at = new Date(Date.UTC(2026, 8, 24, 12, i));
      const { hash } = entryHashes(entry, prev, at);
      out.push({ ...entry, seq: BigInt(i), prevHash: prev, hash, at });
      prev = hash;
    }
    return out;
  }
  it("verifies an intact chain", () => expect(verifyChain(chain(5))).toBeNull());
  it("detects an edited entry", () => {
    const c = chain(5);
    c[2] = { ...c[2]!, outcome: "sent" };
    expect(verifyChain(c)).toBe(3n);
  });
  it("detects a deleted entry", () => {
    const c = chain(5);
    c.splice(1, 1);
    expect(verifyChain(c)).toBe(3n);
  });
  it("hashes JSON independent of key order", () => {
    const at = new Date();
    const a = entryHashes({ actor: "owner", action: "x", detail: { a: 1, b: 2 }, outcome: "ok" }, GENESIS_HASH, at);
    const b = entryHashes({ actor: "owner", action: "x", detail: { b: 2, a: 1 }, outcome: "ok" }, GENESIS_HASH, at);
    expect(a.hash).toBe(b.hash);
  });
});

describe("webhooks", () => {
  const secret = "app-secret";
  const body = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: "1784",
        time: 1758700000000,
        messaging: [
          { sender: { id: "999" }, recipient: { id: "1784" }, timestamp: 1758700000000, message: { mid: "m1", text: "hey!" } },
          { sender: { id: "1784" }, recipient: { id: "999" }, timestamp: 1758700001000, message: { mid: "m2", text: "hi", is_echo: true } },
          { sender: { id: "999" }, recipient: { id: "1784" }, timestamp: 1758700002000, message: { mid: "m3", is_deleted: true } },
          { sender: { id: "999" }, recipient: { id: "1784" }, timestamp: 1758700003000, read: { mid: "m1" } },
        ],
      },
    ],
  });
  const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("checks the X-Hub-Signature-256 header", () => {
    expect(verifySignature(body, sig, secret)).toBe(true);
    expect(verifySignature(`${body} `, sig, secret)).toBe(false);
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "sha256=zz", secret)).toBe(false);
  });

  it("parses inbound messages and echoes, skipping deletions and read receipts", () => {
    const events = parseMessagingEvents(JSON.parse(body));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ mid: "m1", contactIgsid: "999", isEcho: false, text: "hey!", accountIgId: "1784" });
    expect(events[1]).toMatchObject({ mid: "m2", contactIgsid: "999", isEcho: true });
  });

  it("ignores payloads from other products", () => {
    expect(parseMessagingEvents({ object: "page", entry: [] })).toEqual([]);
    expect(parseMessagingEvents(null)).toEqual([]);
  });
});
