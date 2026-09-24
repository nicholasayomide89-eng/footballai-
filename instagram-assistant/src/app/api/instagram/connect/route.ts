import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { env } from "@/lib/env";
import { oauthConfig } from "@/lib/instagram/account";
import { authorizeUrl, OAUTH_STATE_COOKIE } from "@/lib/instagram/oauth";

export async function GET() {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(oauthConfig(), state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/api/instagram/callback",
    maxAge: 600,
  });
  return res;
}
