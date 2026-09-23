import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatNumber, formatOffset, formatTime } from "@/lib/format";

export interface SeriesDef {
  key: string;
  label: string;
  /** CSS color, normally a categorical slot: var(--series-N). */
  color: string;
  format?: (v: number) => string;
}

export interface ChartBand {
  from: number;
  to: number;
  label: string;
}

export interface ChartMarker {
  minute: number;
  label: string;
}

type Row = { minute: number; timestamp?: string };

interface Props {
  data: readonly Row[];
  series: SeriesDef[];
  kind?: "area" | "line" | "bar";
  height?: number;
  yFormat?: (v: number) => string;
  yDomain?: [number | "auto", number | "auto"];
  bands?: ChartBand[];
  markers?: ChartMarker[];
  /** Label for the time axis tooltip header. */
  ariaLabel: string;
}

const axisTick = { fill: "var(--chart-axis)", fontSize: 11 };

export function TimeSeriesChart({ data, series, kind = "area", height = 240, yFormat = formatNumber, yDomain, bands = [], markers = [], ariaLabel }: Props) {
  const uid = useId().replace(/:/g, "");
  const common = {
    data: data as Row[],
    margin: { top: 8, right: 12, bottom: 0, left: 0 },
    accessibilityLayer: true,
  };
  const grid = <CartesianGrid vertical={false} stroke="var(--chart-grid)" />;
  const x = (
    <XAxis
      dataKey="minute"
      type="number"
      domain={["dataMin", "dataMax"]}
      tickFormatter={(m: number) => formatOffset(m)}
      tick={axisTick}
      tickLine={false}
      axisLine={{ stroke: "var(--chart-grid)" }}
      minTickGap={28}
      allowDecimals={false}
    />
  );
  const y = <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => yFormat(v)} domain={yDomain ?? [0, "auto"]} allowDecimals={false} />;
  const tooltip = <Tooltip content={<ChartTooltip series={series} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} isAnimationActive={false} />;
  const overlays = [
    ...bands.map((b) => (
      <ReferenceArea
        key={`band-${b.label}-${b.from}`}
        x1={b.from}
        x2={b.to}
        fill="var(--series-7)"
        fillOpacity={0.07}
        ifOverflow="hidden"
        label={{ value: b.label, position: "insideTopLeft", fill: "var(--chart-axis)", fontSize: 10 }}
      />
    )),
    ...markers.map((m) => (
      <ReferenceLine key={`mk-${m.label}-${m.minute}`} x={m.minute} stroke="var(--chart-axis)" strokeDasharray="2 3" ifOverflow="hidden" label={{ value: m.label, position: "insideTopRight", fill: "var(--chart-axis)", fontSize: 10 }} />
    )),
  ];

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart {...common} barCategoryGap={1}>
            {grid}
            {x}
            {y}
            {tooltip}
            {overlays}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : kind === "line" ? (
          <LineChart {...common}>
            {grid}
            {x}
            {y}
            {tooltip}
            {overlays}
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--chart-surface)" }} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : (
          <AreaChart {...common}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {grid}
            {x}
            {y}
            {tooltip}
            {overlays}
            {series.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#fill-${uid}-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--chart-surface)" }} isAnimationActive={false} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, series }: TooltipProps<number, string> & { series: SeriesDef[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-semibold text-ink">{formatOffset(row.minute)}</span>
        {row.timestamp && <span className="text-ink-muted">{formatTime(String(row.timestamp))}</span>}
      </div>
      <ul className="space-y-1">
        {series.map((s) => {
          const v = (row as unknown as Record<string, unknown>)[s.key];
          if (typeof v !== "number") return null;
          return (
            <li key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="tabular font-semibold text-ink">{(s.format ?? formatNumber)(v)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChartLegend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {series.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
