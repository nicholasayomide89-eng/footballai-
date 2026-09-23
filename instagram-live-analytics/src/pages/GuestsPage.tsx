import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { GuestAnalytics } from "@/types/analytics";
import { useDashboard } from "@/state/DashboardContext";
import { guestAnalytics } from "@/lib/analytics";
import { formatNumber, formatOffset, formatPct, formatDate } from "@/lib/format";
import { useSessions } from "@/hooks/useAllSessions";
import { Card, CardBody, CardHeader, EmptyState, SectionTitle, SegmentedControl } from "@/components/ui/primitives";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { Avatar } from "@/components/ui/Avatar";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { ComparisonBars, type CompareEntity } from "@/components/charts/ComparisonBars";

const SLOT_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-7)", "var(--series-5)", "var(--series-6)"];

export function GuestsPage() {
  const { session, guests } = useDashboard();
  const [scope, setScope] = useState<"live" | "all">("live");
  const { sessions: history } = useSessions();

  const allGuestRows = useMemo(() => {
    const rows: (GuestAnalytics & { liveTitle: string; liveDate: string })[] = [];
    for (const s of history) for (const g of guestAnalytics(s)) rows.push({ ...g, liveTitle: s.title, liveDate: s.startedAt });
    return rows;
  }, [history]);

  // Aggregate per guest across Lives; colors are fixed per guest identity.
  const aggregated = useMemo(() => {
    const src = scope === "live" ? guests.map((g) => ({ ...g, liveTitle: session?.title ?? "", liveDate: session?.startedAt ?? "" })) : allGuestRows;
    const by = new Map<string, typeof src>();
    for (const r of src) by.set(r.guest.username, [...(by.get(r.guest.username) ?? []), r]);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return [...by.entries()].map(([username, rows]) => ({
      username,
      displayName: rows[0].guest.displayName,
      appearances: rows.length,
      viewerLift: Math.round(avg(rows.map((r) => r.viewerChangePct))),
      peak: Math.round(avg(rows.map((r) => r.peakDuring))),
      cpm: Math.round(avg(rows.map((r) => r.commentsPerMinuteDuring)) * 10) / 10,
      followers: Math.round(avg(rows.map((r) => r.followersDuring))),
      engChange: Math.round(avg(rows.map((r) => r.engagementChange)) * 10) / 10,
    }));
  }, [scope, guests, allGuestRows, session]);

  const colorOrder = useMemo(() => {
    const names = [...new Set([...guests.map((g) => g.guest.username), ...allGuestRows.map((r) => r.guest.username)])];
    return new Map(names.map((n, i) => [n, SLOT_COLORS[i % SLOT_COLORS.length]]));
  }, [guests, allGuestRows]);

  if (!session) return null;
  const entities: CompareEntity[] = aggregated.map((g) => ({ id: g.username, label: `@${g.username}${scope === "all" ? ` (${g.appearances}×)` : ""}`, color: colorOrder.get(g.username) ?? "var(--series-1)" }));
  const val = (f: (g: (typeof aggregated)[number]) => number) => Object.fromEntries(aggregated.map((g) => [g.username, f(g)]));
  const bands = session.guests.map((g) => ({ from: g.joinedMinute, to: g.leftMinute ?? session.series.length - 1, label: `@${g.username}` }));

  return (
    <div>
      <SectionTitle title="Guests" subtitle={<span className="inline-flex items-center gap-1.5">How each guest changed viewers, chat and follows <AvailabilityBadge metric="guests" /></span>} />

      {guests.length ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {guests.map((g) => (
              <GuestCard key={g.guest.id} g={g} color={colorOrder.get(g.guest.username) ?? "var(--series-1)"} />
            ))}
          </div>
          <Card className="mt-6">
            <CardHeader title="Viewers during guest appearances" subtitle="Shaded = guest on screen" badge={<AvailabilityBadge metric="currentViewers" />} />
            <CardBody>
              <TimeSeriesChart ariaLabel="Viewers with guest appearances" data={session.series} series={[{ key: "concurrentViewers", label: "Viewers", color: "var(--series-1)" }]} bands={bands} height={240} />
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState title="No guests in this Live">Switch to “All Lives” below to compare guests from your previous broadcasts.</EmptyState>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Compare guests"
          subtitle={scope === "all" ? "Averages across every appearance in your previous Lives" : "Guests in the selected Live"}
          actions={<SegmentedControl ariaLabel="Guest comparison scope" value={scope} onChange={setScope} options={[{ value: "live", label: "This Live" }, { value: "all", label: "All Lives" }]} />}
        />
        <CardBody>
          {aggregated.length ? (
            <ComparisonBars
              entities={entities}
              metrics={[
                { key: "lift", label: "Viewer lift after joining", format: (v) => `${v >= 0 ? "+" : ""}${v}%`, values: val((g) => g.viewerLift) },
                { key: "peak", label: "Peak viewers during", format: formatNumber, values: val((g) => g.peak) },
                { key: "cpm", label: "Comments per minute", format: (v) => v.toFixed(1), values: val((g) => g.cpm) },
                { key: "followers", label: "Followers gained during", format: (v) => `+${v}`, values: val((g) => g.followers) },
                { key: "eng", label: "Engagement change (pts)", format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`, values: val((g) => g.engChange) },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-muted">No guests to compare.</p>
          )}
          {scope === "all" && allGuestRows.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium text-ink-muted">
                    <th className="py-2 pr-3">Guest</th>
                    <th className="py-2 pr-3">Live</th>
                    <th className="py-2 pr-3 text-right">Before</th>
                    <th className="py-2 pr-3 text-right">Peak</th>
                    <th className="py-2 pr-3 text-right">Comments</th>
                    <th className="py-2 pr-3 text-right">Followers</th>
                    <th className="py-2 text-right">Engagement Δ</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {allGuestRows.map((r) => (
                    <tr key={`${r.guest.id}`} className="border-b border-line/60 last:border-0">
                      <td className="py-2 pr-3 font-medium text-ink">@{r.guest.username}</td>
                      <td className="py-2 pr-3 text-ink-soft">
                        {r.liveTitle} <span className="text-ink-muted">· {formatDate(r.liveDate)}</span>
                      </td>
                      <td className="py-2 pr-3 text-right text-ink-soft">{r.viewersBefore}</td>
                      <td className="py-2 pr-3 text-right text-ink">{r.peakDuring}</td>
                      <td className="py-2 pr-3 text-right text-ink-soft">{r.commentsDuring}</td>
                      <td className="py-2 pr-3 text-right text-ink-soft">+{r.followersDuring}</td>
                      <td className="py-2 text-right text-ink-soft">{r.engagementChange >= 0 ? "+" : ""}{r.engagementChange.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function GuestCard({ g, color }: { g: GuestAnalytics; color: string }) {
  const up = g.engagementChange >= 0;
  const stats: [string, string][] = [
    ["Joined", formatOffset(g.guest.joinedMinute)],
    ["Left", g.guest.leftMinute !== null ? formatOffset(g.guest.leftMinute) : "Still on"],
    ["Viewers before", formatNumber(g.viewersBefore)],
    ["Peak during", formatNumber(g.peakDuring)],
    ["Comments during", `${formatNumber(g.commentsDuring)} (${g.commentsPerMinuteDuring}/min)`],
    ["Followers gained", `+${g.followersDuring}`],
  ];
  return (
    <Card>
      <div className="flex items-center gap-3 p-5 pb-0">
        <span className="rounded-full p-[2px]" style={{ background: color }}>
          <Avatar name={g.guest.username} src={g.guest.avatarUrl} size={44} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{g.guest.displayName}</p>
          <p className="truncate text-sm text-ink-muted">@{g.guest.username}</p>
        </div>
        <div className="text-right">
          <div className={`tabular inline-flex items-center gap-0.5 text-lg font-semibold ${g.viewerChangePct >= 0 ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"}`}>
            {g.viewerChangePct >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(g.viewerChangePct)}%
          </div>
          <div className="text-[11px] text-ink-muted">viewer lift</div>
        </div>
      </div>
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="tabular text-sm font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2 text-sm">
          <span className="text-ink-soft">Engagement rate</span>
          <span className="tabular text-ink">
            {formatPct(g.engagementRateBefore)} → <span className="font-semibold">{formatPct(g.engagementRateDuring)}</span>{" "}
            <span className={up ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"}>
              ({up ? "+" : ""}
              {g.engagementChange.toFixed(1)} pts)
            </span>
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
