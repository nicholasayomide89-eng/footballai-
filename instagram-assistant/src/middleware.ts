import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

// Paths reachable without an owner session. Webhook and Meta callbacks
// authenticate with Meta signatures instead.
const PUBLIC = ["/login", "/api/auth/login", "/api/webhooks/instagram", "/api/instagram/deauthorize", "/manifest.webmanifest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const secret = process.env.SESSION_SECRET;
  if (secret && (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
