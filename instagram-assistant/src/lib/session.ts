/**
 * Owner session: an HMAC-SHA256 signed cookie. Uses Web Crypto so the same
 * code runs in middleware (edge) and in route handlers (node).
 */

export const SESSION_COOKIE = "keel_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ sub: "owner", exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS })));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!constantTimeEqual(sig, await hmac(secret, payload))) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; exp?: number };
    return json.sub === "owner" && typeof json.exp === "number" && json.exp * 1000 > now;
  } catch {
    return false;
  }
}
