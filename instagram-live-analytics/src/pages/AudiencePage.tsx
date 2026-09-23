import { useMemo } from "react";
import { LogIn, LogOut, Repeat, Sparkles, UserCheck, Users } from "lucide-react";
import { useDashboard } from "@/state/DashboardContext";
import { audienceBreakdown, commenterStats } from "@/lib/analytics";
import { formatDuration, formatNumber, formatOffset } from "@/lib/format";
import { useSessions } from "@/hooks/useAllSessions";
import { Card, CardBody, CardHeader, SectionTitle, Badge } from "@/components/ui/primitives";
import { StatTile } from "@/components/ui/StatTile";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { Avatar } from "@/components/ui/Avatar";
import { ChartLegend, TimeSeriesChart, type SeriesDef } from "@/components/charts/TimeSeriesChart";

const JOIN_EXIT: SeriesDef[] = [
  { key: "joins", label: "Joined", color: "var(--series-1)" },
  { key: "exits", label: "Left", color: "var(--series-2)" },
];

export function AudiencePage() {
  const { session } = useDashboard();
  const { sessions: history } = useSessions();

  const a = useMemo(() => (session ? audienceBreakdown(session) : null), [session]);
  const top = useMemo(() => (session ? commenterStats(session).slice(0, 8) : []), [session?.id, session?.comments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Viewers who comment across many Lives (by username).
  const regulars = useMemo(() => {
    const all = session && !history.some((h) => h.id === session.id) ? [...history, session] : history;
    const map = new Map<string, { lives: Set<string>; comments: number }>();
    for (const s of all) {
      for (const c of s.comments) {
        const r = map.get(c.username) ?? { lives: new Set(), comments: 0 };
        r.lives.add(s.id);
        r.comments++;
        map.set(c.username, r);
      }
    }
    return [...map.entries()]
      .map(([username, r]) => ({ username, lives: r.lives.size, comments: r.comments }))
      .sort((x, y) => y.lives - x.lives || y.comments - x.comments)
      .slice(0, 8);
  }, [history, session?.id, session?.comments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activity = useMemo(() => {
    if (!session) return [];
    const events: { id: string; username: string; minute: number; kind: "join" | "exit"; returning: boolean }[] = [];
    for (const v of session.viewers) {
      events.push({ id: `${v.id}-j`, username: v.username, minute: v.joinedMinute, kind: "join", returning: v.isReturning });
      if (v.leftMinute !== null) events.push({ id: `${v.id}-x`, username: v.username, minute: v.leftMinute, kind: "exit", returning: v.isReturning });
    }
    return events.sort((x, y) => y.minute - x.minute).slice(0, 40);
  }, [session]);

  if (!session || !a) return null;
  const returningPct = a.total ? Math.round((a.returning / a.total) * 100) : 0;

  return (
    <div>
      <SectionTitle title="Audience" subtitle="Who watched, who came back, and how the audience moved during the Live." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Unique viewers" icon={<Users />} metric="uniqueViewers" value={formatNumber(a.total)} sub={session.status === "live" ? `${formatNumber(a.watchingNow)} watching now` : undefined} />
        <StatTile label="Returning viewers" icon={<Repeat />} metric="returningViewers" value={formatNumber(a.returning)} sub={`${returningPct}% of audience`} />
        <StatTile label="New viewers" icon={<Sparkles />} metric="returningViewers" value={formatNumber(a.newViewers)} sub={`${100 - returningPct}% of audience`} />
        <StatTile label="Followers watching" icon={<UserCheck />} metric="viewerIdentities" value={formatNumber(a.followers)} sub={`${a.total ? Math.round((a.followers / a.total) * 100) : 0}% follow you`} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Returning vs. new" badge={<AvailabilityBadge metric="returningViewers" />} />
        <CardBody>
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${returningPct}% returning, ${100 - returningPct}% new`}>
            <div className="h-full rounded-l-full" style={{ width: `${returningPct}%`, background: "var(--series-1)" }} />
            <div className="h-full flex-1 rounded-r-full" style={{ background: "var(--series-2)" }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--series-1)]" /> Returning {returningPct}%</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--series-2)]" /> New {100 - returningPct}%</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Viewer joins and exits" subtitle="Per minute" badge={<AvailabilityBadge metric="joinsExits" />} actions={<ChartLegend series={JOIN_EXIT} />} />
          <CardBody>
            <TimeSeriesChart ariaLabel="Viewer joins and exits per minute" data={session.series} series={JOIN_EXIT} kind="line" height={230} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Audience growth" subtitle="Cumulative unique viewers" badge={<AvailabilityBadge metric="uniqueViewers" />} />
          <CardBody>
            <TimeSeriesChart ariaLabel="Cumulative unique viewers" data={session.series} series={[{ key: "cumulativeUniqueViewers", label: "Unique viewers", color: "var(--series-3)" }]} height={230} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Most active viewers" subtitle="Comments × 5 + likes" badge={<AvailabilityBadge metric="viewerIdentities" />} />
          <CardBody>
            <ul className="space-y-3">
              {a.mostActive.map(({ viewer, watchSeconds }) => (
                <li key={viewer.id} className="flex items-center gap-3">
                  <Avatar name={viewer.username} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                      {viewer.username} {viewer.isReturning && <Badge>Returning</Badge>}
                    </p>
                    <p className="tabular text-xs text-ink-muted">
                      {viewer.commentCount} comments · {viewer.likeCount} likes · {formatDuration(watchSeconds)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top commenters" subtitle="This Live" badge={<AvailabilityBadge metric="comments" />} />
          <CardBody>
            <RankList rows={top.map((t) => ({ id: t.viewerId, username: t.username, value: t.comments, sub: `${t.questions} questions · first at ${formatOffset(t.firstMinute)}` }))} unit="comments" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Most common commenters" subtitle="Comment in the most of your Lives" badge={<AvailabilityBadge metric="comments" />} />
          <CardBody>
            <RankList rows={regulars.map((r) => ({ id: r.username, username: r.username, value: r.lives, sub: `${r.comments} comments overall` }))} unit="Lives" />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Viewer activity" subtitle="Latest joins and exits" badge={<AvailabilityBadge metric="joinsExits" />} />
        <CardBody>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {activity.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                {e.kind === "join" ? <LogIn className="h-4 w-4 text-[var(--series-1)]" aria-label="joined" /> : <LogOut className="h-4 w-4 text-[var(--series-2)]" aria-label="left" />}
                <span className="min-w-0 flex-1 truncate text-ink-soft">
                  <span className="font-medium text-ink">{e.username}</span> {e.kind === "join" ? "joined" : "left"}
                  {e.kind === "join" && e.returning && <span className="text-ink-muted"> · returning</span>}
                </span>
                <span className="tabular text-xs text-ink-muted">{formatOffset(e.minute)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function RankList({ rows, unit }: { rows: { id: string; username: string; value: number; sub: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3">
          <span className="tabular w-4 text-xs font-semibold text-ink-muted">{i + 1}</span>
          <Avatar name={r.username} size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{r.username}</span>
              <span className="tabular shrink-0 text-sm font-semibold text-ink">
                {r.value} <span className="text-xs font-normal text-ink-muted">{unit}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-sunken">
              <div className="h-1.5 rounded-full bg-[var(--series-1)]" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink-muted">{r.sub}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
