import { db } from "../db";
import { graphClient } from "../instagram/account";
import type { GraphClient, Media } from "../instagram/graph";
import { InstagramApiError } from "../instagram/oauth";

const METRIC_SETS = [
  ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"],
  ["reach", "likes", "comments", "shares", "saved", "total_interactions"],
  ["reach", "total_interactions"],
];
const FRESH_MS = 6 * 3600_000;

export interface MediaStats {
  media: Media;
  metrics: Record<string, number>;
  engagementRate: number | null;
}

/** Metric names shift between API versions; try the richest set first. */
async function fetchInsights(client: GraphClient, mediaId: string): Promise<Record<string, number>> {
  for (const set of METRIC_SETS) {
    try {
      const rows = await client.mediaInsights(mediaId, set);
      const out: Record<string, number> = {};
      for (const r of rows) out[r.name] = r.total_value?.value ?? r.values?.[0]?.value ?? 0;
      return out;
    } catch (err) {
      if (!(err instanceof InstagramApiError) || err.isAuthError || err.isRateLimited) throw err;
    }
  }
  return {};
}

async function cachedInsights(client: GraphClient, mediaId: string): Promise<Record<string, number>> {
  const recent = await db.insightSnapshot.findMany({
    where: { igMediaId: mediaId, capturedAt: { gte: new Date(Date.now() - FRESH_MS) } },
    orderBy: { capturedAt: "desc" },
  });
  if (recent.length) {
    const out: Record<string, number> = {};
    for (const r of recent) if (!(r.metric in out)) out[r.metric] = r.value;
    return out;
  }
  const fresh = await fetchInsights(client, mediaId);
  const entries = Object.entries(fresh);
  if (entries.length) {
    await db.insightSnapshot.createMany({ data: entries.map(([metric, value]) => ({ igMediaId: mediaId, metric, value, period: "lifetime" })) });
  }
  return fresh;
}

export async function recentPerformance(limit = 25): Promise<MediaStats[]> {
  const { client } = await graphClient();
  const media = await client.recentMedia(limit);
  const out: MediaStats[] = [];
  for (const m of media) {
    const metrics = await cachedInsights(client, m.id);
    const interactions = metrics.total_interactions ?? (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saved ?? 0);
    out.push({ media: m, metrics: { ...metrics, total_interactions: interactions }, engagementRate: metrics.reach ? interactions / metrics.reach : null });
  }
  return out;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const BLOCKS = ["0", "3", "6", "9", "12", "15", "18", "21"] as const;

/**
 * Average engagement rate of your own posts by the day and 3-hour block they
 * were posted, in your timezone. Cells with no posts are null.
 */
export function timingGrid(stats: MediaStats[], timezone: string): { grid: (number | null)[][]; samples: number } {
  const sums = DAYS.map(() => BLOCKS.map(() => ({ total: 0, n: 0 })));
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", hour: "numeric", hourCycle: "h23" });
  let samples = 0;
  for (const s of stats) {
    if (s.engagementRate === null) continue;
    const parts = fmt.formatToParts(new Date(s.media.timestamp));
    const day = DAYS.indexOf(parts.find((p) => p.type === "weekday")?.value as (typeof DAYS)[number]);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    if (day < 0) continue;
    const cell = sums[day]![Math.floor(hour / 3)]!;
    cell.total += s.engagementRate;
    cell.n++;
    samples++;
  }
  return { grid: sums.map((row) => row.map((c) => (c.n ? c.total / c.n : null))), samples };
}

/** Average engagement rate per format, as a multiple of your overall average. */
export function formatComparison(stats: MediaStats[]): Array<{ label: string; multiple: number; count: number }> {
  const rated = stats.filter((s) => s.engagementRate !== null);
  if (!rated.length) return [];
  const overall = rated.reduce((a, s) => a + (s.engagementRate ?? 0), 0) / rated.length;
  if (!overall) return [];
  const groups = new Map<string, number[]>();
  for (const s of rated) {
    const label = s.media.media_product_type === "REELS" ? "Reels" : s.media.media_type === "CAROUSEL_ALBUM" ? "Carousels" : s.media.media_type === "VIDEO" ? "Videos" : "Photos";
    groups.set(label, [...(groups.get(label) ?? []), s.engagementRate ?? 0]);
  }
  return [...groups.entries()]
    .map(([label, rates]) => ({ label, count: rates.length, multiple: rates.reduce((a, b) => a + b, 0) / rates.length / overall }))
    .sort((a, b) => b.multiple - a.multiple);
}
