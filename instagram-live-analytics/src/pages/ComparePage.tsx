import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";
import type { LiveSession } from "@/types/analytics";
import { useDashboard } from "@/state/DashboardContext";
import { useSessions } from "@/hooks/useAllSessions";
import { formatDate, formatDuration, formatNumber, formatPct } from "@/lib/format";
import { Card, CardBody, CardHeader, EmptyState, SectionTitle, SegmentedControl } from "@/components/ui/primitives";
import { ComparisonBars, type CompareEntity } from "@/components/charts/ComparisonBars";
import { MAX_COMPARE } from "./PreviousLivesPage";

const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

export function ComparePage({ compareIds, setCompareIds }: { compareIds: string[]; setCompareIds: (ids: string[]) => void }) {
  const { previousLives } = useDashboard();
  const [curve, setCurve] = useState<"retention" | "concurrentViewers" | "engagementRate">("retention");

  useEffect(() => {
    if (compareIds.length === 0 && previousLives.length >= 2) setCompareIds(previousLives.slice(0, 2).map((l) => l.id));
  }, [compareIds.length, previousLives, setCompareIds]);

  const { sessions } = useSessions(compareIds);
  const summaries = compareIds.map((id) => previousLives.find((l) => l.id === id)).filter(Boolean) as typeof previousLives;
  const entities: CompareEntity[] = summaries.map((s) => ({ id: s.id, label: `${s.title} · ${formatDate(s.startedAt)}`, color: SLOTS[compareIds.indexOf(s.id)] }));
  const val = (f: (s: (typeof summaries)[number]) => number) => Object.fromEntries(summaries.map((s) => [s.id, f(s)]));

  const curveData = useMemo(() => buildCurves(sessions, curve), [sessions, curve]);
  const available = previousLives.filter((l) => !compareIds.includes(l.id));

  return (
    <div>
      <SectionTitle title="Live comparison" subtitle={`Pick 2–${MAX_COMPARE} Lives. Each metric has its own scale; colors stay with each Live.`} />

      <Card className="mb-6">
        <CardBody className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {summaries.map((s) => (
              <span key={s.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-line py-1 pl-2.5 pr-1 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLOTS[compareIds.indexOf(s.id)] }} aria-hidden />
                <span className="truncate text-ink">{s.title}</span>
                <span className="shrink-0 text-xs text-ink-muted">{formatDate(s.startedAt)}</span>
                <button type="button" onClick={() => setCompareIds(compareIds.filter((x) => x !== s.id))} className="rounded-full p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label={`Remove ${s.title}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {compareIds.length < MAX_COMPARE && (
              <select
                value=""
                onChange={(e) => e.target.value && setCompareIds([...compareIds, e.target.value])}
                className="h-9 max-w-full rounded-full border border-dashed border-line bg-surface px-3 text-sm text-ink-soft"
                aria-label="Add a Live to compare"
              >
                <option value="">+ Add Live…</option>
                {available.map((l) => (
                  <option key={l.id} value={l.id}>
                    {formatDate(l.startedAt)} — {l.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardBody>
      </Card>

      {summaries.length < 2 ? (
        <Card>
          <EmptyState title="Select at least two Lives">Add Lives above or select them from the Previous Lives table.</EmptyState>
        </Card>
      ) : (
        <>
          <ComparisonBars
            entities={entities}
            metrics={[
              { key: "peak", label: "Peak viewers", format: formatNumber, values: val((s) => s.peakViewers) },
              { key: "avg", label: "Average viewers", format: formatNumber, values: val((s) => s.avgViewers) },
              { key: "watch", label: "Average watch time", format: formatDuration, values: val((s) => s.avgWatchSeconds) },
              { key: "ret", label: "Average retention", format: (v) => formatPct(v), values: val((s) => s.avgRetention) },
              { key: "comments", label: "Comments", format: formatNumber, values: val((s) => s.comments) },
              { key: "likes", label: "Likes", format: formatNumber, values: val((s) => s.likes) },
              { key: "followers", label: "Followers gained", format: (v) => `+${formatNumber(v)}`, values: val((s) => s.newFollowers) },
              { key: "eng", label: "Engagement rate", format: (v) => formatPct(v), values: val((s) => s.engagementRate) },
              { key: "duration", label: "Duration", format: (v) => formatDuration(v * 60), values: val((s) => s.durationMinutes) },
            ]}
          />

          <Card className="mt-6">
            <CardHeader
              title="Over the course of each Live"
              subtitle="X axis is % of the Live elapsed, so different lengths line up"
              actions={
                <SegmentedControl
                  ariaLabel="Curve metric"
                  value={curve}
                  onChange={setCurve}
                  options={[{ value: "retention", label: "Retention" }, { value: "concurrentViewers", label: "Viewers" }, { value: "engagementRate", label: "Engagement" }]}
                />
              }
            />
            <CardBody>
              <div className="h-[300px]" role="img" aria-label={`${curve} curves for selected Lives`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="pct" type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} />
                    <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (curve === "concurrentViewers" ? formatNumber(v) : `${Math.round(v)}%`)} />
                    <Tooltip
                      isAnimationActive={false}
                      cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
                      contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "rgb(var(--ink))", fontWeight: 600 }}
                      labelFormatter={(v) => `${v}% through the Live`}
                      formatter={(v: number, name: string) => [curve === "concurrentViewers" ? formatNumber(v) : formatPct(v), summaries.find((s) => s.id === name)?.title ?? name]}
                    />
                    <Legend formatter={(id: string) => <span className="text-xs text-ink-soft">{summaries.find((s) => s.id === id)?.title ?? id}</span>} iconType="circle" iconSize={8} />
                    {compareIds.map((id) => (
                      <Line key={id} dataKey={id} name={id} type="monotone" stroke={SLOTS[compareIds.indexOf(id)]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--chart-surface)", strokeWidth: 2 }} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function buildCurves(sessions: LiveSession[], key: "retention" | "concurrentViewers" | "engagementRate") {
  const rows: Record<string, number>[] = [];
  for (let pct = 0; pct <= 100; pct += 2) {
    const row: Record<string, number> = { pct };
    for (const s of sessions) {
      if (!s.series.length) continue;
      const idx = Math.min(s.series.length - 1, Math.round((pct / 100) * (s.series.length - 1)));
      row[s.id] = Math.round((s.series[idx][key] as number) * 10) / 10;
    }
    rows.push(row);
  }
  return rows;
}
