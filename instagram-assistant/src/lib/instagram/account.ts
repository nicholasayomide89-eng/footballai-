import { db } from "../db";
import { env } from "../env";
import { open, parseKey, seal } from "../crypto";
import { GraphClient } from "./graph";
import { refreshLongLived, type OAuthConfig } from "./oauth";

export function oauthConfig(): OAuthConfig {
  const e = env();
  return {
    appId: e.INSTAGRAM_APP_ID,
    appSecret: e.INSTAGRAM_APP_SECRET,
    redirectUri: `${e.APP_URL}/api/instagram/callback`,
    graphVersion: e.INSTAGRAM_GRAPH_VERSION,
  };
}

export async function activeAccount() {
  return db.igAccount.findFirst({ where: { status: "active" }, include: { token: true } });
}

export async function storeToken(igAccountId: string, accessToken: string, expiresAt: Date, scopes: string[]) {
  const sealed = seal(accessToken, parseKey(env().TOKEN_ENCRYPTION_KEY));
  const data = { ciphertext: new Uint8Array(sealed.ciphertext), iv: new Uint8Array(sealed.iv), authTag: new Uint8Array(sealed.authTag), scopes, expiresAt, refreshedAt: new Date() };
  await db.oAuthToken.upsert({ where: { igAccountId }, create: { igAccountId, ...data }, update: data });
}

function decryptToken(t: { ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array }): string {
  return open(
    { ciphertext: Buffer.from(t.ciphertext), iv: Buffer.from(t.iv), authTag: Buffer.from(t.authTag) },
    parseKey(env().TOKEN_ENCRYPTION_KEY),
  );
}

export class NotConnectedError extends Error {
  constructor() {
    super("No Instagram account is connected");
  }
}

/** A Graph API client for the connected account, or throws NotConnectedError. */
export async function graphClient(): Promise<{ client: GraphClient; account: NonNullable<Awaited<ReturnType<typeof activeAccount>>> }> {
  const account = await activeAccount();
  if (!account?.token) throw new NotConnectedError();
  if (account.token.expiresAt.getTime() < Date.now()) {
    await db.igAccount.update({ where: { id: account.id }, data: { status: "expired" } });
    throw new NotConnectedError();
  }
  return { client: new GraphClient(decryptToken(account.token), account.igUserId, env().INSTAGRAM_GRAPH_VERSION), account };
}

/** Refreshes the token when it has less than `withinDays` left. Returns true if refreshed. */
export async function refreshTokenIfDue(withinDays = 10): Promise<boolean> {
  const account = await activeAccount();
  if (!account?.token) return false;
  const msLeft = account.token.expiresAt.getTime() - Date.now();
  if (msLeft > withinDays * 86_400_000) return false;
  const fresh = await refreshLongLived(decryptToken(account.token));
  await storeToken(account.id, fresh.accessToken, fresh.expiresAt, account.token.scopes);
  return true;
}
