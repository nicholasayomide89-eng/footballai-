import { useMemo, useState } from "react";
import { Eye, Heart, MessageCircle, UserPlus } from "lucide-react";
import type { MetricKey } from "@/types/analytics";
import { useDashboard } from "@/state/DashboardContext";
import { formatNumber, formatPct } from "@/lib/format";
import { Card, CardBody, CardHeader, SectionTitle, SegmentedControl, LiveDot } from "@/components/ui/primitives";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { StatTile } from "@/components/ui/StatTile";
import { TimeSeriesChart, type SeriesDef } from "@/components/charts/TimeSeriesChart";

type Range = "all" | "30" | "15";

export function MonitorPage() {
  const { session, overview } = useDashboard();
  const [range, setRange] = useState<Range>("all");

  const data = useMemo(() => {
    if (!session) return [];
    let cumFollowers = 0;
    const rows = session.series.map((p) => {
      cumFollowers += p.followersGained;
      return { ...p, cumulativeFollowers: cumFollowers };
    });
    return range === "all" ? rows : rows.slice(-Number(range));
  }, [session, range]);

  if (!session || !overview) return null;
  const isLive = overview.status === "live";
  const last = session.series[session.series.length - 1];
  const bands = session.guests.map((g) => ({ from: g.joinedMinute, to: g.leftMinute ?? last?.minute ?? 0, label: `@${g.username}` }));

  const charts: { title: string; subtitle: string; metric: MetricKey; series: SeriesDef[]; kind: "area" | "line" | "bar"; yFormat?: (v: number) => string; yDomain?: [number, number | "auto"] }[] = [
    { title: "Concurrent viewers", subtitle: "People watching at each minute", metric: "currentViewers", kind: "area", series: [{ key: "concurrentViewers", label: "Viewers", color: "var(--series-1)" }] },
    { title: "Comments per minute", subtitle: "All comments, including flagged", metric: "comments", kind: "bar", series: [{ key: "comments", label: "Comments", color: "var(--series-2)" }] },
    { title: "Likes / reactions per minute", subtitle: "Hearts sent during the Live", metric: "likes", kind: "bar", series: [{ key: "likes", label: "Likes", color: "var(--series-5)" }] },
    { title: "Followers gained", subtitle: "Cumulative new followers since the Live started", metric: "followersGained", kind: "area", series: [{ key: "cumulativeFollowers", label: "Total gained", color: "var(--series-3)", format: (v) => `+${formatNumber(v)}` }] },
    { title: "Audience engagement rate", subtitle: "(comments + likes + shares) ÷ viewers, per minute", metric: "engagementRate", kind: "line", yFormat: (v) => `${Math.round(v)}%`, series: [{ key: "engagementRate", label: "Engagement", color: "var(--series-7)", format: (v) => formatPct(v) }] },
    { title: "Viewer retention", subtitle: "Share of everyone who joined that is still watching", metric: "retention", kind: "line", yFormat: (v) => `${Math.round(v)}%`, yDomain: [0, 100], series: [{ key: "retention", label: "Retention", color: "var(--series-1)", format: (v) => formatPct(v) }] },
  ];

  return (
    <div>
      <SectionTitle
        title="Live Monitor"
        subtitle={
          isLive ? (
            <span className="inline-flex items-center gap-2">
              <LiveDot /> Charts update as new data arrives. Hover any chart for exact time and value.
            </span>
          ) : (
            "Replay of a finished Live. Hover any chart for exact time and value."
          )
        }
        actions={<SegmentedControl ariaLabel="Time range" value={range} onChange={setRange} options={[{ value: "all", label: "Full Live" }, { value: "30", label: "Last 30 min" }, { value: "15", label: "Last 15 min" }]} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile emphasis label={isLive ? "Watching now" : "Final minute"} icon={<Eye />} metric="currentViewers" value={formatNumber(isLive ? overview.currentViewers : last?.concurrentViewers ?? 0)} sub={last ? `${last.joins} joined · ${last.exits} left last minute` : undefined} />
        <StatTile emphasis label="Comments / min" icon={<MessageCircle />} metric="comments" value={last?.comments ?? 0} sub={`${formatNumber(overview.totalComments)} total`} />
        <StatTile emphasis label="Likes / min" icon={<Heart />} metric="likes" value={formatNumber(last?.likes ?? 0)} sub={`${formatNumber(overview.totalLikes)} total`} />
        <StatTile emphasis label="New followers" icon={<UserPlus />} metric="followersGained" value={`+${overview.followersGained}`} sub={`+${last?.followersGained ?? 0} last minute`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {charts.map((c) => (
          <Card key={c.title}>
            <CardHeader title={c.title} subtitle={c.subtitle} badge={<AvailabilityBadge metric={c.metric} />} />
            <CardBody>
              <TimeSeriesChart ariaLabel={c.title} data={data} series={c.series} kind={c.kind} yFormat={c.yFormat} yDomain={c.yDomain} bands={bands} height={220} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
