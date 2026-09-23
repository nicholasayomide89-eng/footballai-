import { useMemo } from "react";
import { Calculator, Sparkles } from "lucide-react";
import { useDashboard } from "@/state/DashboardContext";
import { useSessions } from "@/hooks/useAllSessions";
import { computeInsights } from "@/lib/insights";
import { formatHour } from "@/lib/format";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/primitives";
import { BarList } from "@/components/charts/BarList";
import type { InsightItem, LiveSummary } from "@/types/analytics";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function InsightsPage() {
  const { previousLives } = useDashboard();
  const { sessions, loading } = useSessions();
  const insights = useMemo(() => computeInsights(previousLives, sessions), [previousLives, sessions]);

  const byHour = useMemo(() => groupAvg(previousLives, (l) => new Date(l.startedAt).getHours()).sort((a, b) => a.key - b.key).map((g) => ({ label: formatHour(g.key), value: Math.round(g.avg), note: `${g.n} Live${g.n > 1 ? "s" : ""}` })), [previousLives]);
  const byDay = useMemo(() => groupAvg(previousLives, (l) => new Date(l.startedAt).getDay()).sort((a, b) => a.key - b.key).map((g) => ({ label: DAYS[g.key], value: Math.round(g.avg), note: `${g.n} Live${g.n > 1 ? "s" : ""}` })), [previousLives]);

  return (
    <div>
      <SectionTitle title="Insights" subtitle={`Patterns across your ${previousLives.length} previous Lives.`} />

      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-soft">
          <Calculator className="h-3.5 w-3.5 text-[var(--series-1)]" /> <strong className="font-semibold text-ink">Calculated</strong> — computed directly from your Live data
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[color-mix(in_srgb,var(--series-7)_55%,transparent)] bg-surface px-2.5 py-1 text-ink-soft">
          <Sparkles className="h-3.5 w-3.5 text-[var(--series-7)]" /> <strong className="font-semibold text-ink">AI recommendation</strong> — generated suggestion; verify before acting
        </span>
      </div>

      {loading && !sessions.length ? (
        <p className="text-sm text-ink-muted">Crunching your Lives…</p>
      ) : (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">
            <Calculator className="h-4 w-4" /> Calculated from your data
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {insights.calculated.map((i) => (
              <InsightCard key={i.id} item={i} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Comments per minute by topic" subtitle="Which segments get people talking" />
              <CardBody>
                <BarList rows={[...insights.topics].sort((a, b) => b.commentsPerMinute - a.commentsPerMinute).map((t) => ({ label: t.topic, value: t.commentsPerMinute }))} format={(v) => `${v.toFixed(1)}/min`} color="var(--series-2)" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Viewer drop-off by topic" subtitle="Exits per minute per 100 viewers — higher means more people leave" />
              <CardBody>
                <BarList rows={[...insights.topics].sort((a, b) => b.exitsPerMinutePer100 - a.exitsPerMinutePer100).map((t) => ({ label: t.topic, value: t.exitsPerMinutePer100 }))} format={(v) => v.toFixed(1)} color="var(--series-8)" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Average peak viewers by start time" />
              <CardBody>
                <BarList rows={byHour} format={(v) => String(v)} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Average peak viewers by weekday" />
              <CardBody>
                <BarList rows={byDay} format={(v) => String(v)} />
              </CardBody>
            </Card>
          </div>

          <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--series-7)]">
            <Sparkles className="h-4 w-4" /> AI-generated recommendations
          </h2>
          <p className="-mt-1 mb-3 text-xs text-ink-muted">
            Demo mode uses rule-based templates in place of a language model. These are suggestions built on the calculated figures above, not measurements.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {insights.recommendations.map((i) => (
              <InsightCard key={i.id} item={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InsightCard({ item }: { item: InsightItem }) {
  const ai = item.kind === "ai";
  return (
    <Card className={ai ? "border-dashed border-[color-mix(in_srgb,var(--series-7)_45%,transparent)]" : ""}>
      <div className="p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          {ai ? <Sparkles className="h-3.5 w-3.5 text-[var(--series-7)]" /> : <Calculator className="h-3.5 w-3.5 text-[var(--series-1)]" />}
          {item.title}
        </div>
        <p className="mt-2 text-base font-semibold leading-snug text-ink">{item.value}</p>
        <p className="mt-1.5 text-[13px] text-ink-muted">{item.detail}</p>
      </div>
    </Card>
  );
}

function groupAvg(lives: LiveSummary[], keyOf: (l: LiveSummary) => number) {
  const m = new Map<number, number[]>();
  for (const l of lives) m.set(keyOf(l), [...(m.get(keyOf(l)) ?? []), l.peakViewers]);
  return [...m.entries()].map(([key, vals]) => ({ key, avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length }));
}
