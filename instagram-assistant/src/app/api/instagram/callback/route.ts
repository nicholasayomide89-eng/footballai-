import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { appendLog } from "@/lib/audit";
import { requireOwnerApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { oauthConfig, storeToken } from "@/lib/instagram/account";
import { GraphClient } from "@/lib/instagram/graph";
import { exchangeCode, exchangeForLongLived, InstagramApiError, OAUTH_STATE_COOKIE, SCOPES } from "@/lib/instagram/oauth";
import { ensureDefaults } from "@/lib/services/system";

function fail(reason: string) {
  const res = NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(reason)}`, env().APP_URL), 303);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const denied = await requireOwnerApi();
  if (denied) return denied;

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail(params.get("error_description") ?? "Instagram connection was cancelled.");
  const code = params.get("code");
  const state = params.get("state") ?? "";
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";
  if (!code || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return fail("The sign-in link expired or didn't match. Please try again.");
  }

  try {
    const cfg = oauthConfig();
    // Instagram may append "#_" to the code.
    const short = await exchangeCode(cfg, code.replace(/#_$/, ""));
    const long = await exchangeForLongLived(cfg, short.accessToken);
    const graph = new GraphClient(long.accessToken, short.userId, cfg.graphVersion);
    const profile = await graph.profile();
    const igUserId = profile.user_id ?? short.userId;
    const granted = short.permissions.length ? short.permissions : [...SCOPES];

    await ensureDefaults();
    // One connected account at a time: retire any other.
    await db.igAccount.updateMany({ where: { igUserId: { not: igUserId } }, data: { status: "revoked" } });
    const account = await db.igAccount.upsert({
      where: { igUserId },
      create: { igUserId, username: profile.username, accountType: profile.account_type ?? "unknown" },
      update: { username: profile.username, accountType: profile.account_type ?? "unknown", status: "active" },
    });
    await storeToken(account.id, long.accessToken, long.expiresAt, granted);

    const graphForAccount = new GraphClient(long.accessToken, igUserId, cfg.graphVersion);
    let webhooks = "live";
    try {
      await graphForAccount.subscribeWebhooks(["messages"]);
    } catch {
      webhooks = "missing";
    }
    const capabilityRows = [
      ...SCOPES.map((s) => ({ key: s, status: granted.includes(s) ? "live" : "missing" })),
      { key: "webhooks.messages", status: webhooks },
      { key: "story_stickers", status: "unsupported" },
      { key: "follower_lists", status: "unsupported" },
      { key: "cold_dms", status: "unsupported" },
    ];
    await db.$transaction(async (tx) => {
      for (const row of capabilityRows) {
        await tx.capability.upsert({
          where: { igAccountId_key: { igAccountId: account.id, key: row.key } },
          create: { igAccountId: account.id, ...row },
          update: { status: row.status, verifiedAt: new Date() },
        });
      }
      await appendLog(tx, {
        actor: "owner",
        action: "instagram.connected",
        target: profile.username,
        detail: { scopes: granted, accountType: profile.account_type ?? null },
        outcome: "ok",
      });
    });
  } catch (err) {
    return fail(err instanceof InstagramApiError ? `Instagram said: ${err.message}` : "Couldn't finish connecting to Instagram.");
  }

  const res = NextResponse.redirect(new URL("/settings?connected=1", env().APP_URL), 303);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
