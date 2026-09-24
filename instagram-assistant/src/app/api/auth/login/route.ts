import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword } from "@/lib/crypto";
import { env } from "@/lib/env";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";

// Simple in-memory throttle: 5 failed attempts per IP per 15 minutes.
const failures = new Map<string, { count: number; until: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const f = failures.get(ip);
  if (f && f.count >= 5 && f.until > now) {
    return NextResponse.redirect(new URL("/login?error=locked", env().APP_URL), 303);
  }
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (!verifyPassword(password, env().OWNER_PASSWORD_HASH)) {
    const entry = f && f.until > now ? f : { count: 0, until: now + 15 * 60_000 };
    entry.count++;
    failures.set(ip, entry);
    return NextResponse.redirect(new URL("/login?error=1", env().APP_URL), 303);
  }
  failures.delete(ip);
  const res = NextResponse.redirect(new URL("/", env().APP_URL), 303);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(env().SESSION_SECRET), {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
