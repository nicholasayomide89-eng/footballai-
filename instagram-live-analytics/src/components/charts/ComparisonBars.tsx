import { useState } from "react";

export interface CompareEntity {
  id: string;
  label: string;
  color: string;
}

export interface CompareMetric {
  key: string;
  label: string;
  format: (v: number) => string;
  values: Record<string, number>;
  /** Lower is better (e.g. drop-off). */
  invert?: boolean;
}

/**
 * Small-multiple horizontal bars: one panel per metric, one bar per entity.
 * Each metric keeps its own scale, so there is never a dual axis.
 */
export function ComparisonBars({ entities, metrics }: { entities: CompareEntity[]; metrics: CompareMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((m) => (
        <MetricPanel key={m.key} metric={m} entities={entities} />
      ))}
    </div>
  );
}

function MetricPanel({ metric, entities }: { metric: CompareMetric; entities: CompareEntity[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const values = entities.map((e) => metric.values[e.id] ?? 0);
  const max = Math.max(...values, 1);
  const best = metric.invert ? Math.min(...values) : Math.max(...values);
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 text-[13px] font-semibold text-ink">{metric.label}</h3>
      <ul className="space-y-2.5">
        {entities.map((e) => {
          const v = metric.values[e.id] ?? 0;
          const isBest = entities.length > 1 && v === best;
          return (
            <li
              key={e.id}
              onMouseEnter={() => setHover(e.id)}
              onMouseLeave={() => setHover(null)}
              className="group"
              title={`${e.label}: ${metric.format(v)}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden />
                  <span className="truncate">{e.label}</span>
                </span>
                <span className="tabular shrink-0 font-semibold text-ink">
                  {metric.format(v)}
                  {isBest && <span className="ml-1 text-[10px] font-medium text-[var(--status-good)]">▲ best</span>}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-sunken">
                <div
                  className="h-2 rounded-full transition-[width,opacity] duration-300"
                  style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: e.color, opacity: hover && hover !== e.id ? 0.4 : 1 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
