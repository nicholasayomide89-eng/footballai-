import { CalendarClock, Clock, Eye, Heart, Hourglass, MessageCircle, Mountain, Share2, Timer, UserPlus, Users } from "lucide-react";
import { useDashboard } from "@/state/DashboardContext";
import { formatDateTime, formatDuration, formatClock, formatNumber, formatOffset, formatPct } from "@/lib/format";
import { commenterStats } from "@/lib/analytics";
import { Card, CardBody, CardHeader, Button, LiveDot, Badge } from "@/components/ui/primitives";
import { StatTile } from "@/components/ui/StatTile";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { LiveTimeline } from "@/components/timeline/LiveTimeline";
import { Avatar } from "@/components/ui/Avatar";
import type { PageId } from "@/components/layout/navigation";
import { useMemo } from "react";

export function OverviewPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { session, overview, timeline, clips, guests } = useDashboard();
  const topCommenters = useMemo(() => (session ? commenterStats(session).slice(0, 5) : []), [session?.id, session?.comments.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!session || !overview) return null;
  const isLive = overview.status === "live";
  const bands = session.guests.map((g) => ({ from: g.joinedMinute, to: g.leftMinute ?? session.series.length - 1, label: `@${g.username}` }));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-brand-gradient" aria-hidden />
        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {isLive ? (
                <Badge tone="critical" className="uppercase tracking-wide">
                  <LiveDot /> Live now
                </Badge>
              ) : (
                <Badge>Ended</Badge>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                Status <AvailabilityBadge metric="liveStatus" />
              </span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {overview.title} <AvailabilityBadge metric="liveTitle" />
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" aria-hidden /> Started {formatDateTime(overview.startedAt)} <AvailabilityBadge metric="startTime" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden /> <span className="tabular">{formatClock(overview.durationSeconds)}</span> <AvailabilityBadge metric="duration" />
              </span>
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted">
                <Eye className="h-4 w-4" aria-hidden /> {isLive ? "Watching now" : "Peak viewers"} <AvailabilityBadge metric={isLive ? "currentViewers" : "peakViewers"} />
              </div>
              <div className="tabular text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{formatNumber(isLive ? overview.currentViewers : overview.peakViewers)}</div>
            </div>
            <Button variant="secondary" onClick={() => onNavigate("monitor")} className="hidden sm:inline-flex">
              Open monitor
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Current viewers" icon={<Eye />} metric="currentViewers" value={isLive ? formatNumber(overview.currentViewers) : "—"} sub={isLive ? "Updating live" : "Live has ended"} />
        <StatTile label="Peak concurrent" icon={<Mountain />} metric="peakViewers" value={formatNumber(overview.peakViewers)} sub={`at ${formatOffset(overview.peakMinute)}`} />
        <StatTile label="Unique viewers" icon={<Users />} metric="uniqueViewers" value={formatNumber(overview.uniqueViewers)} sub={`${formatNumber(overview.avgViewers)} avg concurrent`} />
        <StatTile label="Comments" icon={<MessageCircle />} metric="comments" value={formatNumber(overview.totalComments)} sub={`${(overview.totalComments / Math.max(1, session.series.length)).toFixed(1)} per minute`} />
        <StatTile label="Likes / reactions" icon={<Heart />} metric="likes" value={formatNumber(overview.totalLikes)} />
        <StatTile label="Shares" icon={<Share2 />} metric="shares" value={formatNumber(overview.totalShares)} />
        <StatTile label="New followers" icon={<UserPlus />} metric="followersGained" value={`+${formatNumber(overview.followersGained)}`} />
        <StatTile label="Avg watch time" icon={<Timer />} metric="avgWatchTime" value={formatDuration(overview.avgWatchSeconds)} sub="per unique viewer" />
        <StatTile label="Total watch time" icon={<Hourglass />} metric="totalWatchTime" value={formatDuration(overview.totalWatchSeconds)} />
        <StatTile label="Engagement rate" icon={<Heart />} metric="engagementRate" value={formatPct(overview.engagementRate)} sub="interactions / viewer / min" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Concurrent viewers"
            subtitle="Shaded bands show when guests were on screen"
            badge={<AvailabilityBadge metric="currentViewers" />}
            actions={
              <Button variant="ghost" size="sm" onClick={() => onNavigate("monitor")}>
                All charts →
              </Button>
            }
          />
          <CardBody>
            <TimeSeriesChart ariaLabel="Concurrent viewers over time" data={session.series} series={[{ key: "concurrentViewers", label: "Viewers", color: "var(--series-1)" }]} bands={bands} height={260} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent events" actions={<Button variant="ghost" size="sm" onClick={() => onNavigate("engagement")}>Timeline →</Button>} />
          <CardBody className="max-h-[300px] overflow-y-auto scrollbar-thin">
            <LiveTimeline events={[...timeline].reverse().slice(0, 8)} compact />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top clip opportunities" actions={<Button variant="ghost" size="sm" onClick={() => onNavigate("clips")}>View all →</Button>} />
          <CardBody>
            <ul className="space-y-3">
              {clips.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <span className="tabular mt-0.5 rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-ink">{formatOffset(c.startMinute)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.suggestedTitle}</p>
                    <p className="text-xs text-ink-muted">Score {c.score} · {formatNumber(c.viewerCount)} viewers</p>
                  </div>
                </li>
              ))}
              {!clips.length && <li className="text-sm text-ink-muted">No clip-worthy spikes yet.</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top commenters" actions={<Button variant="ghost" size="sm" onClick={() => onNavigate("comments")}>Comments →</Button>} />
          <CardBody>
            <ul className="space-y-2.5">
              {topCommenters.map((c) => (
                <li key={c.viewerId} className="flex items-center gap-3">
                  <Avatar name={c.username} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.username}</span>
                  <span className="tabular text-sm font-semibold text-ink">{c.comments}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Guests" badge={<AvailabilityBadge metric="guests" />} actions={<Button variant="ghost" size="sm" onClick={() => onNavigate("guests")}>Details →</Button>} />
          <CardBody>
            <ul className="space-y-3">
              {guests.map((g) => (
                <li key={g.guest.id} className="flex items-center gap-3">
                  <Avatar name={g.guest.username} size={34} ring />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{g.guest.displayName}</p>
                    <p className="text-xs text-ink-muted">
                      {formatOffset(g.guest.joinedMinute)} – {g.guest.leftMinute !== null ? formatOffset(g.guest.leftMinute) : "now"}
                    </p>
                  </div>
                  <span className={`tabular text-sm font-semibold ${g.viewerChangePct >= 0 ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"}`}>{g.viewerChangePct >= 0 ? "+" : ""}{g.viewerChangePct}%</span>
                </li>
              ))}
              {!guests.length && <li className="text-sm text-ink-muted">No guests in this Live.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
