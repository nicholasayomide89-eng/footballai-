/**
 * Instagram API with Instagram Login ("Business Login for Instagram").
 * The owner types their password on instagram.com only; Keel receives an
 * authorization code and exchanges it server-side for tokens.
 */

export const OAUTH_STATE_COOKIE = "keel_oauth_state";

export const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
  "instagram_business_manage_messages",
  "instagram_business_content_publish",
] as const;

export const SCOPE_EXPLANATIONS: Record<(typeof SCOPES)[number], string> = {
  instagram_business_basic: "See your profile, follower and following counts, posts and live Stories.",
  instagram_business_manage_insights: "Read reach, views, saves and shares so Analytics can learn what works for you.",
  instagram_business_manage_messages: "Read DMs people send you and reply within Instagram's 24-hour window.",
  instagram_business_content_publish: "Publish photo and video Stories and posts that you approve.",
};

export interface OAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphVersion: string;
}

export function authorizeUrl(cfg: Pick<OAuthConfig, "appId" | "redirectUri">, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }

  /** Token expired, revoked, or permissions removed. */
  get isAuthError(): boolean {
    return this.code === 190 || this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613;
  }
}

export async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_subcode?: number } | string;
    error_message?: string;
  } & T;
  if (!res.ok) {
    const err = typeof body.error === "object" ? body.error : undefined;
    const message = err?.message ?? body.error_message ?? (typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
    throw new InstagramApiError(message, res.status, err?.code, err?.error_subcode);
  }
  return body;
}

export interface ShortLivedToken {
  accessToken: string;
  userId: string;
  permissions: string[];
}

/** Step 1: authorization code -> short-lived token (about 1 hour). */
export async function exchangeCode(cfg: OAuthConfig, code: string, fetchImpl: typeof fetch = fetch): Promise<ShortLivedToken> {
  const form = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code,
  });
  const res = await fetchImpl("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  type Payload = { access_token: string; user_id: string | number; permissions?: string | string[] };
  const body = await readJson<Payload | { data: Payload[] }>(res);
  const tok = "data" in body ? body.data[0] : body;
  if (!tok?.access_token) throw new InstagramApiError("No access token in response", res.status);
  const perms = tok.permissions ?? [];
  return {
    accessToken: tok.access_token,
    userId: String(tok.user_id),
    permissions: Array.isArray(perms) ? perms : perms.split(",").map((p) => p.trim()).filter(Boolean),
  };
}

export interface LongLivedToken {
  accessToken: string;
  expiresAt: Date;
}

/** Step 2: short-lived -> long-lived token (about 60 days). */
export async function exchangeForLongLived(cfg: OAuthConfig, shortToken: string, fetchImpl: typeof fetch = fetch): Promise<LongLivedToken> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("access_token", shortToken);
  const body = await readJson<{ access_token: string; expires_in: number }>(await fetchImpl(url));
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + body.expires_in * 1000) };
}

/** Long-lived tokens can be refreshed once they are at least 24 hours old. */
export async function refreshLongLived(token: string, fetchImpl: typeof fetch = fetch): Promise<LongLivedToken> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const body = await readJson<{ access_token: string; expires_in: number }>(await fetchImpl(url));
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + body.expires_in * 1000) };
}
