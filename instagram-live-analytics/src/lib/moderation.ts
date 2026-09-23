/** Lightweight rule-based comment moderation shared by all data sources. */

const RULES: { test: RegExp; reason: string }[] = [
  { test: /(https?:\/\/|bit\.ly|\.com\/|link in bio)/i, reason: "Contains a link" },
  { test: /\b(free followers|cheap followers|promo|crypto|signals)\b/i, reason: "Possible spam / promotion" },
  { test: /\b(follow me|dm me)\b/i, reason: "Self-promotion" },
];

export function autoFlagReason(text: string): string | undefined {
  return RULES.find((r) => r.test.test(text))?.reason;
}

export function isQuestion(text: string) {
  return /\?\s*$/.test(text.trim()) || /^(how|what|when|where|why|who|which|can|will|is|do|does|should)\b/i.test(text.trim());
}
