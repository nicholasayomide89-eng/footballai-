import type { InsightItem, LiveSession, LiveSummary } from "@/types/analytics";
import { buildClipOpportunities, detectMoments, guestAnalytics } from "./analytics";
import { formatDuration, formatHour, formatOffset, formatPct } from "./format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function bestBucket<T extends string | number>(summaries: LiveSummary[], keyOf: (s: LiveSummary) => T) {
  const groups = new Map<T, LiveSummary[]>();
  for (const s of summaries) groups.set(keyOf(s), [...(groups.get(keyOf(s)) ?? []), s]);
  const scored = [...groups.entries()].map(([k, list]) => ({ key: k, avgPeak: mean(list.map((l) => l.peakViewers)), n: list.length }));
  // Rank buckets with at least two Lives first so one-off results don't win.
  return scored.sort((a, b) => Number(b.n >= 2) - Number(a.n >= 2) || b.avgPeak - a.avgPeak);
}

const worst = <T extends { avgPeak: number }>(xs: T[]) => xs.reduce((w, x) => (x.avgPeak < w.avgPeak ? x : w), xs[0]);

export interface TopicStat {
  topic: string;
  commentsPerMinute: number;
  exitsPerMinutePer100: number;
  appearances: number;
}

/** Aggregates per-topic comment rate and viewer drop-off across Lives. */
export function topicStats(sessions: LiveSession[]): TopicStat[] {
  const acc = new Map<string, { comments: number; minutes: number; exitsPer100: number[]; appearances: number }>();
  for (const s of sessions) {
    for (const t of s.topics) {
      const pts = s.series.filter((p) => p.minute >= t.startMinute && p.minute <= t.endMinute);
      if (!pts.length) continue;
      const a = acc.get(t.topic) ?? { comments: 0, minutes: 0, exitsPer100: [], appearances: 0 };
      a.comments += pts.reduce((x, p) => x + p.comments, 0);
      a.minutes += pts.length;
      a.exitsPer100.push(...pts.map((p) => (p.concurrentViewers ? (p.exits / p.concurrentViewers) * 100 : 0)));
      a.appearances++;
      acc.set(t.topic, a);
    }
  }
  return [...acc.entries()].map(([topic, a]) => ({
    topic,
    commentsPerMinute: Math.round((a.comments / a.minutes) * 10) / 10,
    exitsPerMinutePer100: Math.round(mean(a.exitsPer100) * 10) / 10,
    appearances: a.appearances,
  }));
}

export function computeInsights(summaries: LiveSummary[], sessions: LiveSession[]) {
  const calculated: InsightItem[] = [];
  if (!summaries.length) return { calculated, recommendations: [] as InsightItem[], topics: [] as TopicStat[] };

  const best = [...summaries].sort((a, b) => b.engagementRate * b.avgViewers - a.engagementRate * a.avgViewers)[0];
  calculated.push({
    id: "best-live",
    kind: "calculated",
    title: "Best-performing Live",
    value: best.title,
    detail: `${best.peakViewers.toLocaleString()} peak viewers · ${formatPct(best.engagementRate)} engagement · +${best.newFollowers} followers`,
  });

  const guestRows = sessions.flatMap((s) => guestAnalytics(s));
  const byGuest = new Map<string, typeof guestRows>();
  for (const g of guestRows) byGuest.set(g.guest.username, [...(byGuest.get(g.guest.username) ?? []), g]);
  const guestRank = [...byGuest.entries()]
    .map(([u, rows]) => ({ username: u, name: rows[0].guest.displayName, lift: mean(rows.map((r) => r.viewerChangePct)), followers: mean(rows.map((r) => r.followersDuring)), n: rows.length }))
    .sort((a, b) => b.lift - a.lift);
  if (guestRank[0]) {
    calculated.push({
      id: "best-guest",
      kind: "calculated",
      title: "Best-performing guest",
      value: `${guestRank[0].name} (@${guestRank[0].username})`,
      detail: `+${Math.round(guestRank[0].lift)}% viewers on average after joining · ${Math.round(guestRank[0].followers)} followers gained per appearance · ${guestRank[0].n} appearance${guestRank[0].n > 1 ? "s" : ""}`,
    });
  }

  const hours = bestBucket(summaries, (s) => new Date(s.startedAt).getHours());
  calculated.push({
    id: "best-hour",
    kind: "calculated",
    title: "Best time of day",
    value: formatHour(hours[0].key),
    detail: `Lives starting around ${formatHour(hours[0].key)} average ${Math.round(hours[0].avgPeak)} peak viewers (${hours[0].n} Lives). Lowest: ${formatHour(worst(hours).key)} at ${Math.round(worst(hours).avgPeak)}.`,
  });

  const days = bestBucket(summaries, (s) => new Date(s.startedAt).getDay());
  calculated.push({
    id: "best-day",
    kind: "calculated",
    title: "Best day of the week",
    value: DAYS[days[0].key],
    detail: `${Math.round(days[0].avgPeak)} average peak viewers across ${days[0].n} Live${days[0].n > 1 ? "s" : ""}.`,
  });

  const topics = topicStats(sessions);
  const chatty = [...topics].sort((a, b) => b.commentsPerMinute - a.commentsPerMinute);
  const leaky = [...topics].sort((a, b) => b.exitsPerMinutePer100 - a.exitsPerMinutePer100);
  calculated.push({
    id: "topic-comments",
    kind: "calculated",
    title: "Topics that generate the most comments",
    value: chatty.slice(0, 2).map((t) => t.topic).join(", "),
    detail: chatty.slice(0, 3).map((t) => `${t.topic}: ${t.commentsPerMinute}/min`).join(" · "),
  });
  calculated.push({
    id: "topic-dropoff",
    kind: "calculated",
    title: "Topics associated with viewer drop-off",
    value: leaky.filter((t) => t.topic !== "Wrap-up").slice(0, 2).map((t) => t.topic).join(", "),
    detail: `${leaky.filter((t) => t.topic !== "Wrap-up").slice(0, 3).map((t) => `${t.topic}: ${t.exitsPerMinutePer100} exits/min per 100 viewers`).join(" · ")} (wrap-up excluded).`,
  });

  const avgStay = mean(summaries.map((s) => s.avgWatchSeconds));
  calculated.push({
    id: "avg-stay",
    kind: "calculated",
    title: "Average time viewers stay",
    value: formatDuration(avgStay),
    detail: `Across ${summaries.length} Lives. Longest: ${formatDuration(Math.max(...summaries.map((s) => s.avgWatchSeconds)))}.`,
  });

  // Best clip per Live, then the top three across Lives.
  const clips = sessions
    .flatMap((s) => buildClipOpportunities(s, detectMoments(s), new Set()).slice(0, 1).map((c) => ({ c, live: s.title })))
    .sort((a, b) => b.c.score - a.c.score)
    .slice(0, 3);
  calculated.push({
    id: "best-clips",
    kind: "calculated",
    title: "Best moments for Reels / Shorts",
    value: clips.map((x) => x.c.suggestedTitle).slice(0, 1).join("") || "—",
    detail: clips.map((x) => `${x.live} at ${formatOffset(x.c.startMinute)} (score ${x.c.score})`).join(" · "),
  });

  // Recommendations: generated text. In demo mode these are rule-based
  // templates standing in for an LLM call — the UI labels them as AI output.
  const recommendations: InsightItem[] = [
    {
      id: "rec-schedule",
      kind: "ai",
      title: "Schedule your next Live",
      value: `${DAYS[days[0].key]} around ${formatHour(hours[0].key)}`,
      detail: `Your audience shows up most at this slot. Announce it 24h ahead in Stories with a countdown sticker.`,
    },
    {
      id: "rec-topics",
      kind: "ai",
      title: "Lead with what gets people talking",
      value: chatty[0]?.topic ?? "—",
      detail: `Open with ${chatty[0]?.topic.toLowerCase()} while the audience is building, and move ${leaky.find((t) => t.topic !== "Wrap-up")?.topic.toLowerCase()} later or shorten it — it's where viewers tend to leave.`,
    },
    {
      id: "rec-guest",
      kind: "ai",
      title: "Bring back your strongest guest",
      value: guestRank[0] ? `@${guestRank[0].username}` : "Try a guest",
      detail: guestRank[0] ? `Guest segments lift viewers and follows. Consider a recurring slot with ${guestRank[0].name}.` : "Guest segments usually lift viewers — try one next time.",
    },
    {
      id: "rec-clips",
      kind: "ai",
      title: "Repurpose the top moment",
      value: clips[0]?.c.suggestedTitle ?? "—",
      detail: "Cut a 30–60s vertical clip starting a few seconds before the spike, add captions, and post within 48h while the Live is fresh.",
    },
  ];

  return { calculated, recommendations, topics };
}
