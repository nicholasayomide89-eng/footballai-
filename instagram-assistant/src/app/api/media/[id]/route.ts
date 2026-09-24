import { requireOwnerApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { getObjectBytes } from "@/lib/services/storage";

/** Owner-only preview of an uploaded file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const { id } = await params;
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return new Response("not found", { status: 404 });
  const bytes = await getObjectBytes(asset.storageKey);
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, max-age=300", "Content-Disposition": "inline" },
  });
}
