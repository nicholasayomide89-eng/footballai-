import { requireOwnerApi } from "@/lib/auth";
import { db } from "@/lib/db";

/** Full activity log as JSON, including hashes, so it can be verified offline. */
export async function GET() {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const rows = await db.actionLog.findMany({ orderBy: { seq: "asc" } });
  const body = JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="keel-activity-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
