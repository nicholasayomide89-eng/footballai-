// Prints an OWNER_PASSWORD_HASH value for .env. Usage: npm run hash-password
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Choose a Keel password (min 12 characters): ");
rl.close();
if (password.length < 12) {
  console.error("Too short.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
console.log(`\nOWNER_PASSWORD_HASH=scrypt:${salt.toString("base64")}:${hash.toString("base64")}`);
