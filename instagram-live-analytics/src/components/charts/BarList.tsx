/** Single-series horizontal bar list (one hue — magnitude only). */
export function BarList({ rows, format, color = "var(--series-1)" }: { rows: { label: string; value: number; note?: string }[]; format: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-ink-soft">{r.label}</span>
            <span className="tabular shrink-0 font-semibold text-ink">
              {format(r.value)}
              {r.note && <span className="ml-1 font-normal text-ink-muted">{r.note}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-sunken">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
