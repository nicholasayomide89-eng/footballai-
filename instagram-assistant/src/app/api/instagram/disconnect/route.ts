import { NextResponse } from "next/server";
import { appendLog } from "@/lib/audit";
import { requireOwnerApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/** Deletes the token and all cached Instagram data. The activity log is kept. */
export async function POST() {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  await db.$transaction(async (tx) => {
    const accounts = await tx.igAccount.findMany({ select: { username: true } });
    await tx.igAccount.deleteMany({}); // cascades to tokens, contacts, conversations, messages, memory
    await tx.insightSnapshot.deleteMany({});
    await appendLog(tx, { actor: "owner", action: "instagram.disconnected", detail: { accounts: accounts.map((a) => a.username) }, outcome: "ok" });
  });
  return NextResponse.redirect(new URL("/settings?disconnected=1", env().APP_URL), 303);
}
