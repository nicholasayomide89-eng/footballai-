// Refreshes the Instagram token when it is within 10 days of expiring.
// Run daily from cron or your host's scheduler: `npm run refresh-tokens`.
import { appendLog } from "../src/lib/audit";
import { db } from "../src/lib/db";
import { refreshTokenIfDue } from "../src/lib/instagram/account";

async function main() {
  try {
    const refreshed = await refreshTokenIfDue(10);
    if (refreshed) await db.$transaction((tx) => appendLog(tx, { actor: "system", action: "instagram.token_refreshed", outcome: "ok" }));
    console.log(refreshed ? "Token refreshed." : "Token not due for refresh.");
  } catch (err) {
    await db.$transaction((tx) =>
      appendLog(tx, { actor: "system", action: "instagram.token_refresh_failed", detail: { error: String(err) }, outcome: "failed" }),
    );
    throw err;
  } finally {
    await db.$disconnect();
  }
}

void main();
