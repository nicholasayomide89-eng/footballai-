import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  OWNER_PASSWORD_HASH: z.string().startsWith("scrypt:", "Run `npm run hash-password` to create OWNER_PASSWORD_HASH"),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  INSTAGRAM_APP_ID: z.string().min(1),
  INSTAGRAM_APP_SECRET: z.string().min(1),
  INSTAGRAM_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v24.0"),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment. Throws with a readable list of problems on first use. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}
