import { createHmac, timingSafeEqual } from "node:crypto";
import { appendLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Meta's deauthorize and data-deletion callbacks both POST a signed_request.
 * Either way, Keel deletes the account's Instagram data.
 */
function parseSignedRequest(signed: string, secret: string): { user_id?: string } | null {
  const [sig, payload] = signed.split(".");
  if (!sig || !payload) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

export async function POST(req: Request) {
  const form = await req.formData();
  const data = parseSignedRequest(String(form.get("signed_request") ?? ""), env().INSTAGRAM_APP_SECRET);
  if (!data?.user_id) return new Response("invalid signed_request", { status: 400 });
  const userId = String(data.user_id);
  const confirmation = `keel-${Date.now().toString(36)}`;
  await db.$transaction(async (tx) => {
    await tx.igAccount.deleteMany({ where: { igUserId: userId } });
    await appendLog(tx, { actor: "system", action: "instagram.deauthorized", target: userId, detail: { confirmation }, outcome: "ok" });
  });
  return Response.json({ url: `${env().APP_URL}/settings`, confirmation_code: confirmation });
}
