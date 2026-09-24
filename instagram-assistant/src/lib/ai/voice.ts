import type { PersonalityProfile, StyleExample } from "@prisma/client";
import { fenced } from "./client";

const SCALE = ["none", "low", "moderate", "high", "very high"];

/** Describes the owner's voice for the system prompt, from what they entered and approved only. */
export function voiceBrief(profile: PersonalityProfile | null, examples: StyleExample[]): string {
  const lines: string[] = [];
  if (profile) {
    lines.push(
      `Humor: ${SCALE[profile.humor] ?? "moderate"}. Confidence: ${SCALE[profile.confidence] ?? "moderate"}. Formality: ${SCALE[profile.formality] ?? "moderate"}.`,
      `Flirting: ${profile.flirting === 0 ? "never flirt" : `at most ${SCALE[profile.flirting]}, and only if the other person clearly flirts first`}.`,
      `Emoji use: ${profile.emojiRate}. Sentence length: ${profile.sentenceLength}.`,
    );
    if (profile.slang.length) lines.push(`Words and slang they use: ${profile.slang.join(", ")}.`);
    if (profile.signaturePhrases.length) lines.push(`Phrases that sound like them: ${profile.signaturePhrases.join(" | ")}.`);
    if (profile.bannedPhrases.length) lines.push(`Never use: ${profile.bannedPhrases.join(" | ")}.`);
    const facts = profile.factsAboutMe as Record<string, string>;
    const factLines = Object.entries(facts ?? {}).filter(([, v]) => typeof v === "string" && v.trim());
    lines.push(
      factLines.length
        ? `Facts the owner has told you about themselves (the ONLY personal facts you may use):\n${factLines.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
        : "The owner hasn't told you any personal facts. Don't state or imply any.",
    );
  } else {
    lines.push("No personality profile yet: write neutrally, briefly and casually. Don't invent personal facts.");
  }
  if (examples.length) {
    lines.push(
      "Messages and captions the owner wrote or approved (style reference only; never copy them verbatim):",
      fenced("style_examples", examples.map((e) => `- (${e.kind}) ${e.text}`).join("\n")),
    );
  }
  return lines.join("\n");
}
