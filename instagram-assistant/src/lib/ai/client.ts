import Anthropic from "@anthropic-ai/sdk";
import type { AutoParseableBetaOutputFormat } from "@anthropic-ai/sdk/lib/beta-parser";
import { env } from "../env";

let client: Anthropic | undefined;

export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class AiRefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`The model declined this request${category ? ` (${category})` : ""}`);
    this.name = "AiRefusalError";
  }
}

export class AiOutputError extends Error {}

/**
 * One structured call to Claude. Uses server-side refusal fallbacks so a
 * safety-classifier decline is retried on Anthropic's recommended model
 * instead of failing the feature outright.
 */
export async function structuredCall<T>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  format: AutoParseableBetaOutputFormat<T>;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<T> {
  const response = await anthropic().beta.messages.parse({
    model: env().ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort, format: opts.format },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });
  if (response.stop_reason === "refusal") throw new AiRefusalError(response.stop_details?.category ?? null);
  if (response.stop_reason === "max_tokens") throw new AiOutputError("The model ran out of output tokens");
  if (!response.parsed_output) throw new AiOutputError("The model returned output that didn't match the schema");
  return response.parsed_output;
}

/** Wraps untrusted text (DMs, captions) so the model treats it as data, not instructions. */
export function fenced(label: string, body: string): string {
  const safe = body.replaceAll(`</${label}>`, `<\\/${label}>`);
  return `<${label}>\n${safe}\n</${label}>`;
}
