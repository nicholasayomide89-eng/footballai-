import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM encryption for Instagram access tokens at rest. The key comes
 * from TOKEN_ENCRYPTION_KEY (32 bytes, base64). In production, load that key
 * from your KMS / secret manager rather than a plain .env file.
 */

export interface Sealed {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function parseKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function seal(plaintext: string, key: Buffer, aad = "ig-token"): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function open(sealed: Sealed, key: Buffer, aad = "ig-token"): string {
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// --- Owner password (scrypt) ---------------------------------------------------

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT);
  // ":" separators: "$" would be expanded by .env loaders.
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}
