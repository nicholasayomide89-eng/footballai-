/**
 * Integration test for the reply pipeline against a real PostgreSQL database.
 * The AI and Instagram are faked; everything else (policy, storage, audit
 * log, append-only trigger) is real. Runs only when TEST_DATABASE_URL is set.
 */
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";

if (existsSync(".env")) process.loadEnvFile(".env");
const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

let sentCount = 0;
const sendText = vi.fn(async (_to: string, _text: string) => ({ recipient_id: "999", message_id: `mid.keel.${++sentCount}` }));
let nextDraft = "lekki sunday market! go before 11 or it's packed";

vi.mock("@/lib/instagram/account", async (orig) => ({
  ...(await orig<typeof import("@/lib/instagram/account")>()),
  graphClient: async () => ({ client: { sendText }, account: {} }),
}));
vi.mock("@/lib/ai/replies", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/replies")>()),
  planReply: async () => ({
    recommendation: "reply",
    draft: nextDraft,
    rationale: "Answers their question.",
    conversation_type: "friendly",
    their_tone: "short, lowercase",
    flags: [],
    memory_updates: [{ kind: "fact", content: "Looking for a good market" }],
  }),
  critiqueDraft: async () => ({
    makes_sense: true,
    sounds_like_owner: 90,
    repeats_answered_question: false,
    too_pushy_or_needy: false,
    issues: [],
    flags: [],
    verdict: "ok",
  }),
}));

const run = TEST_DB ? describe : describe.skip;

run("reply pipeline (database)", () => {
  let db: typeof import("@/lib/db").db;
  let messaging: typeof import("@/lib/services/messaging");
  let system: typeof import("@/lib/services/system");
  let seq = 0;
  const inbound = (mid: string, text: string, isEcho = false) => ({
    kind: "message" as const,
    accountIgId: "1784",
    contactIgsid: "999",
    mid,
    text,
    attachments: null,
    isEcho,
    timestamp: new Date(Date.now() + ++seq),
  });

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    messaging = await import("@/lib/services/messaging");
    system = await import("@/lib/services/system");
    const { storeToken } = await import("@/lib/instagram/account");
    // ActionLog is append-only by design, so it is never cleared.
    await db.automationRule.deleteMany();
    await db.styleExample.deleteMany();
    await db.igAccount.deleteMany();
    await db.systemState.deleteMany();
    await system.ensureDefaults();
    const account = await db.igAccount.create({ data: { igUserId: "1784", username: "owner", accountType: "CREATOR" } });
    await storeToken(account.id, "IGAA-test-token", new Date(Date.now() + 50 * 86_400_000), ["instagram_business_basic"]);
  });

  it("drafts a reply for an inbound DM and sends it only after approval", async () => {
    const convoId = await messaging.ingestMessage(inbound("mid.in.1", "which market? been looking for a good one"));
    expect(convoId).toBeTruthy();
    const contact = await db.contact.findFirstOrThrow();
    await db.contact.update({ where: { id: contact.id }, data: { aiAccess: "approve", relationship: "friend" } });

    const suggestion = await messaging.suggestReply(convoId!);
    expect(suggestion?.status).toBe("open");
    expect(sendText).not.toHaveBeenCalled();
    expect(await db.conversationMemory.count()).toBe(1);

    const result = await messaging.sendSuggestion(suggestion!.id, { trigger: "owner_approval", editedText: suggestion!.draft! });
    expect(result.status).toBe("sent");
    expect(sendText).toHaveBeenCalledWith("999", nextDraft);
    const sent = await db.message.findFirstOrThrow({ where: { direction: "outbound" } });
    expect(sent.sentBy).toBe("keel_approved");
    expect(await db.styleExample.count()).toBe(1);
  });

  it("ignores the webhook echo of Keel's own send", async () => {
    const before = await db.message.count();
    await messaging.ingestMessage({ ...inbound("mid.keel.1", nextDraft, true) });
    expect(await db.message.count()).toBe(before);
  });

  it("never double-texts while waiting on them", async () => {
    const convo = await db.conversation.findFirstOrThrow();
    nextDraft = "also there's a pottery stall at the back";
    const s = await messaging.suggestReply(convo.id);
    expect(s?.status).toBe("blocked");
    expect(JSON.stringify(s?.policy)).toContain("no_double_text");
    expect(sentCount).toBe(1);
  });

  it("auto-replies only under an approved rule, and stops when paused", async () => {
    const contact = await db.contact.findFirstOrThrow();
    await db.contact.update({ where: { id: contact.id }, data: { aiAccess: "auto" } });
    await db.systemState.update({ where: { id: 1 }, data: { messagesMode: "auto" } });
    await db.automationRule.create({
      data: { name: "friendly", scope: "dm", conditions: { conversationTypes: ["friendly"], maxChars: 200 }, dailyCap: 5, activeFrom: 0, activeTo: 0, enabled: true, approvedAt: new Date() },
    });

    const convoId = await messaging.ingestMessage(inbound("mid.in.2", "omg thank you!!"));
    nextDraft = "anytime! enjoy it";
    await messaging.suggestReply(convoId!);
    expect(sentCount).toBe(2);
    expect((await db.message.findFirstOrThrow({ where: { sentBy: "keel_auto" } })).text).toBe("anytime! enjoy it");

    await system.setAutomation(false, "test");
    await messaging.ingestMessage(inbound("mid.in.3", "see you soon"));
    nextDraft = "yes!! soon";
    const held = await messaging.suggestReply(convoId!);
    expect(sentCount).toBe(2);
    expect(held?.status).toBe("open");
    await system.setAutomation(true);
  });

  it("keeps an intact, append-only activity log", async () => {
    const { verifyChain } = await import("@/lib/audit");
    const rows = await db.actionLog.findMany({ orderBy: { seq: "asc" } });
    expect(rows.length).toBeGreaterThan(5);
    expect(verifyChain(rows as never)).toBeNull();
    await expect(db.$executeRawUnsafe(`UPDATE "ActionLog" SET outcome = 'ok'`)).rejects.toThrow(/append-only/);
    await expect(db.actionLog.deleteMany()).rejects.toThrow(/append-only/);
  });
});
