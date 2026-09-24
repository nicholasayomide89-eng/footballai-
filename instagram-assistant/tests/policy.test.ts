import { describe, expect, it } from "vitest";
import { detect, similarity } from "@/lib/policy/detectors";
import { evaluateMessage, evaluateStory, localHour, type MessagePolicyInput } from "@/lib/policy/engine";

const NOW = new Date("2026-09-24T14:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const ALL_RULES = new Set(["no_arguments", "no_commitments"]);

function base(overrides: Partial<MessagePolicyInput> = {}): MessagePolicyInput {
  return {
    text: "lekki sunday market! go before 11 or it's packed",
    trigger: "owner_approval",
    now: NOW,
    system: { automationOn: true, messagesMode: "approve", timezone: "UTC" },
    contact: { aiAccess: "approve", relationship: "friend", blocked: false },
    conversation: { lastInboundAt: hoursAgo(1), lastOutboundAt: hoursAgo(2), outboundCount: 4 },
    recentOutbound: ["it was chaos but so worth it"],
    enabledRules: ALL_RULES,
    autoSentToday: { total: 0, toContact: 0 },
    globalAutoCap: 10,
    criticFlags: [],
    ...overrides,
  };
}

function autoBase(overrides: Partial<MessagePolicyInput> = {}): MessagePolicyInput {
  return base({
    trigger: "auto_rule",
    text: "haha thank you!",
    system: { automationOn: true, messagesMode: "auto", timezone: "UTC" },
    contact: { aiAccess: "auto", relationship: "friend", blocked: false },
    rule: { id: "r1", enabled: true, approved: true, dailyCap: 5, activeFrom: 9, activeTo: 22 },
    ...overrides,
  });
}

const keys = (d: ReturnType<typeof evaluateMessage>) => d.reasons.map((r) => r.key);

describe("owner-approved replies", () => {
  it("allows a normal reply inside the window", () => {
    expect(evaluateMessage(base()).verdict).toBe("allow");
  });

  it("blocks when the person never messaged first", () => {
    const d = evaluateMessage(base({ conversation: { lastInboundAt: null, lastOutboundAt: null, outboundCount: 0 } }));
    expect(d.verdict).toBe("block");
    expect(keys(d)).toContain("no_inbound");
  });

  it("blocks outside Instagram's 24-hour window", () => {
    const d = evaluateMessage(base({ conversation: { lastInboundAt: hoursAgo(25), lastOutboundAt: hoursAgo(30), outboundCount: 3 } }));
    expect(keys(d)).toContain("window_closed");
  });

  it("never double-texts, even with owner approval", () => {
    const d = evaluateMessage(base({ conversation: { lastInboundAt: hoursAgo(5), lastOutboundAt: hoursAgo(1), outboundCount: 3 } }));
    expect(d.verdict).toBe("block");
    expect(keys(d)).toContain("no_double_text");
  });

  it("no_double_text stays on even if the stored rule set omits it", () => {
    const d = evaluateMessage(base({ enabledRules: new Set(), conversation: { lastInboundAt: hoursAgo(5), lastOutboundAt: hoursAgo(1), outboundCount: 3 } }));
    expect(keys(d)).toContain("no_double_text");
  });

  it("blocks near-duplicates of recent messages", () => {
    const d = evaluateMessage(base({ text: "It was chaos, but so worth it!" }));
    expect(keys(d)).toContain("duplicate");
  });

  it.each([
    ["no_financial", "can you send me money on cashapp? like $50"],
    ["no_financial", "my account number is 0123456789 and sort code 12-34-56"],
    ["no_private_info", "call me on +234 803 555 0199"],
    ["no_private_info", "email me at me@example.com"],
    ["no_sexual", "send nudes"],
    ["no_offensive", "you're such an idiot"],
  ])("blocks %s content: %s", (key, text) => {
    const d = evaluateMessage(base({ text }));
    expect(d.verdict).toBe("block");
    expect(keys(d)).toContain(key);
  });

  it("lets the owner approve a commitment they chose to make", () => {
    expect(evaluateMessage(base({ text: "let's meet on saturday at 2pm" })).verdict).toBe("allow");
  });

  it("refuses to send in suggest-only mode", () => {
    const d = evaluateMessage(base({ system: { automationOn: true, messagesMode: "suggest", timezone: "UTC" } }));
    expect(keys(d)).toContain("suggest_only");
  });

  it("respects per-contact AI access", () => {
    expect(keys(evaluateMessage(base({ contact: { aiAccess: "none", relationship: "friend", blocked: false } })))).toContain("contact_no_ai");
    expect(keys(evaluateMessage(base({ contact: { aiAccess: "suggest", relationship: "friend", blocked: false } })))).toContain("contact_suggest_only");
  });

  it("owner-approved sends still work while automation is paused", () => {
    expect(evaluateMessage(base({ system: { automationOn: false, messagesMode: "approve", timezone: "UTC" } })).verdict).toBe("allow");
  });
});

describe("automatic replies", () => {
  it("allows a reply that matches an approved rule", () => {
    expect(evaluateMessage(autoBase()).verdict).toBe("allow");
  });

  it("pausing turns automatic sends into drafts", () => {
    const d = evaluateMessage(autoBase({ system: { automationOn: false, messagesMode: "auto", timezone: "UTC" } }));
    expect(d.verdict).toBe("needs_owner");
    expect(keys(d)).toContain("paused");
  });

  it("needs an approved, enabled rule", () => {
    expect(keys(evaluateMessage(autoBase({ rule: undefined })))).toContain("no_rule");
    expect(keys(evaluateMessage(autoBase({ rule: { id: "r", enabled: true, approved: false, dailyCap: 5, activeFrom: 9, activeTo: 22 } })))).toContain("no_rule");
  });

  it("holds messages outside active hours", () => {
    const late = new Date("2026-09-24T23:30:00Z");
    const d = evaluateMessage(autoBase({ now: late, conversation: { lastInboundAt: new Date(late.getTime() - 3600_000), lastOutboundAt: new Date(late.getTime() - 7200_000), outboundCount: 2 } }));
    expect(keys(d)).toContain("quiet_hours");
  });

  it("treats equal from/to hours as all day and wraps past midnight", () => {
    const late = new Date("2026-09-24T23:30:00Z");
    const convo = { lastInboundAt: new Date(late.getTime() - 3600_000), lastOutboundAt: new Date(late.getTime() - 7200_000), outboundCount: 2 };
    const rule = (activeFrom: number, activeTo: number) => ({ id: "r", enabled: true, approved: true, dailyCap: 5, activeFrom, activeTo });
    expect(evaluateMessage(autoBase({ now: late, conversation: convo, rule: rule(0, 0) })).verdict).toBe("allow");
    expect(evaluateMessage(autoBase({ now: late, conversation: convo, rule: rule(20, 2) })).verdict).toBe("allow");
    expect(keys(evaluateMessage(autoBase({ now: late, conversation: convo, rule: rule(2, 20) })))).toContain("quiet_hours");
  });

  it("enforces daily caps", () => {
    expect(keys(evaluateMessage(autoBase({ autoSentToday: { total: 5, toContact: 0 } })))).toContain("daily_cap");
    expect(keys(evaluateMessage(autoBase({ globalAutoCap: 2, autoSentToday: { total: 2, toContact: 0 } })))).toContain("daily_cap");
    expect(keys(evaluateMessage(autoBase({ autoSentToday: { total: 1, toContact: 3 } })))).toContain("contact_cap");
  });

  it("escalates commitments, dating chats, first messages and critic flags", () => {
    expect(keys(evaluateMessage(autoBase({ text: "see you tomorrow then" })))).toContain("no_commitments");
    expect(keys(evaluateMessage(autoBase({ contact: { aiAccess: "auto", relationship: "dating", blocked: false } })))).toContain("dating");
    expect(keys(evaluateMessage(autoBase({ conversation: { lastInboundAt: hoursAgo(1), lastOutboundAt: null, outboundCount: 0 } })))).toContain("first_message");
    expect(keys(evaluateMessage(autoBase({ criticFlags: ["emotional"] })))).toContain("critic_emotional");
  });

  it("requires the contact to allow automatic replies", () => {
    const d = evaluateMessage(autoBase({ contact: { aiAccess: "approve", relationship: "friend", blocked: false } }));
    expect(d.verdict).toBe("needs_owner");
  });
});

describe("stories", () => {
  const story = {
    trigger: "owner_approval" as const,
    system: { automationOn: true, storiesMode: "approve" as const },
    quotaUsage: 1,
    quotaTotal: 100,
    keelStoriesLast24h: 0,
    keelDailyStoryCap: 3,
    recommended: true,
    hasStickers: false,
  };
  it("allows an approved story within limits", () => expect(evaluateStory(story).verdict).toBe("allow"));
  it("blocks at Instagram's quota and Keel's cap", () => {
    expect(evaluateStory({ ...story, quotaUsage: 100 }).verdict).toBe("block");
    expect(evaluateStory({ ...story, keelStoriesLast24h: 3 }).verdict).toBe("block");
  });
  it("auto-posting needs auto mode, no pause, a recommendation and no stickers", () => {
    const auto = { ...story, trigger: "auto_rule" as const, system: { automationOn: true, storiesMode: "auto" as const } };
    expect(evaluateStory(auto).verdict).toBe("allow");
    expect(evaluateStory({ ...auto, system: { automationOn: false, storiesMode: "auto" } }).verdict).toBe("needs_owner");
    expect(evaluateStory({ ...auto, recommended: false }).verdict).toBe("needs_owner");
    expect(evaluateStory({ ...auto, hasStickers: true }).verdict).toBe("needs_owner");
  });
});

describe("helpers", () => {
  it("similarity is 1 for identical and low for unrelated text", () => {
    expect(similarity("see you there", "See you there!")).toBe(1);
    expect(similarity("see you there", "which market was it")).toBeLessThan(0.2);
  });
  it("does not flag ordinary chat", () => {
    expect(detect("haha no way, which market? been looking for a good one", new Set(["no_financial", "no_private_info", "no_sexual", "no_offensive", "no_arguments", "no_commitments"]))).toEqual([]);
  });
  it("computes local hours per timezone", () => {
    expect(localHour(NOW, "UTC")).toBe(14);
    expect(localHour(NOW, "Africa/Lagos")).toBe(15);
  });
});
