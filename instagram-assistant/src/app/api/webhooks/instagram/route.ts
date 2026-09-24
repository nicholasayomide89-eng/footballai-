import { after } from "next/server";
import { env } from "@/lib/env";
import { parseMessagingEvents, verifySignature } from "@/lib/instagram/webhook";
import { ingestMessage, suggestReply } from "@/lib/services/messaging";

/** Meta's subscription handshake. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env().INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), env().INSTAGRAM_APP_SECRET)) {
    return new Response("bad signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const toSuggest = new Set<string>();
  for (const event of parseMessagingEvents(payload)) {
    const conversationId = await ingestMessage(event);
    if (conversationId) toSuggest.add(conversationId);
  }
  // Respond to Meta immediately; draft replies after the response is sent.
  after(async () => {
    for (const id of toSuggest) {
      try {
        await suggestReply(id);
      } catch (err) {
        console.error("suggestReply failed", id, err);
      }
    }
  });
  return new Response("ok", { status: 200 });
}
