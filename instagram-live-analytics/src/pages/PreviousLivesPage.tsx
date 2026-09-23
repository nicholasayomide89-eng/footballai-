import clsx from "clsx";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, GitCompareArrows } from "lucide-react";
import type { LiveSummary } from "@/types/analytics";
import { useDashboard } from "@/state/DashboardContext";
import { formatDate, formatDuration, formatNumber, formatPct } from "@/lib/format";
import { Button, Card, SearchInput, SectionTitle, Select } from "@/components/ui/primitives";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import type { PageId } from "@/components/layout/navigation";
import type { MetricKey } from "@/types/analytics";

type SortKey = keyof Pick<LiveSummary, "startedAt" | "title" | "durationMinutes" | "totalViewers" | "peakViewers" | "avgViewers" | "comments" | "likes" | "newFollowers" | "avgWatchSeconds" | "engagementRate">;

const COLUMNS: { key: SortKey; label: string; metric?: MetricKey; align?: "right"; render: (l: LiveSummary) => string }[] = [
  { key: "startedAt", label: "Date", render: (l) => formatDate(l.startedAt) },
  { key: "title", label: "Live title", render: (l) => l.title },
  { key: "durationMinutes", label: "Duration", align: "right", metric: "duration", render: (l) => formatDuration(l.durationMinutes * 60) },
  { key: "totalViewers", label: "Total viewers", align: "right", metric: "uniqueViewers", render: (l) => formatNumber(l.totalViewers) },
  { key: "peakViewers", label: "Peak", align: "right", metric: "peakViewers", render: (l) => formatNumber(l.peakViewers) },
  { key: "avgViewers", label: "Avg viewers", align: "right", metric: "currentViewers", render: (l) => formatNumber(l.avgViewers) },
  { key: "comments", label: "Comments", align: "right", metric: "comments", render: (l) => formatNumber(l.comments) },
  { key: "likes", label: "Likes", align: "right", metric: "likes", render: (l) => formatNumber(l.likes) },
  { key: "newFollowers", label: "New followers", align: "right", metric: "followersGained", render: (l) => `+${formatNumber(l.newFollowers)}` },
  { key: "avgWatchSeconds", label: "Avg watch", align: "right", metric: "avgWatchTime", render: (l) => formatDuration(l.avgWatchSeconds) },
  { key: "engagementRate", label: "Engagement", align: "right", metric: "engagementRate", render: (l) => formatPct(l.engagementRate) },
];

export const MAX_COMPARE = 4;

export function PreviousLivesPage({ onNavigate, compareIds, setCompareIds }: { onNavigate: (p: PageId) => void; compareIds: string[]; setCompareIds: (ids: string[]) => void }) {
  const { previousLives, setActiveLiveId } = useDashboard();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<"all" | "30" | "90">("all");
  const [guestFilter, setGuestFilter] = useState<"any" | "with" | "without">("any");
  const [minEng, setMinEng] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "startedAt", dir: "desc" });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const newest = previousLives.reduce((m, l) => Math.max(m, new Date(l.startedAt).getTime()), 0);
    const cutoff = range === "all" ? 0 : newest - Number(range) * 86_400_000;
    const list = previousLives.filter(
      (l) =>
        (!q || l.title.toLowerCase().includes(q) || l.topics.some((t) => t.toLowerCase().includes(q)) || l.guestNames.some((g) => g.includes(q))) &&
        new Date(l.startedAt).getTime() >= cutoff &&
        (guestFilter === "any" || (guestFilter === "with" ? l.guestNames.length > 0 : l.guestNames.length === 0)) &&
        l.engagementRate >= minEng,
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number)) * dir;
    });
  }, [previousLives, query, range, guestFilter, minEng, sort]);

  const toggleCompare = (id: string) => {
    if (compareIds.includes(id)) setCompareIds(compareIds.filter((x) => x !== id));
    else if (compareIds.length < MAX_COMPARE) setCompareIds([...compareIds, id]);
  };

  const engValues = previousLives.map((l) => l.engagementRate);
  const engMax = Math.ceil(Math.max(0, ...engValues));

  return (
    <div>
      <SectionTitle
        title="Previous Lives"
        subtitle={`${previousLives.length} broadcasts. Click a column to sort; select up to ${MAX_COMPARE} to compare.`}
        actions={
          <Button variant="primary" disabled={compareIds.length < 2} onClick={() => onNavigate("compare")}>
            <GitCompareArrows className="h-4 w-4" /> Compare {compareIds.length ? `(${compareIds.length})` : ""}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search title, topic or guest" className="md:w-72" />
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Date range" value={range} onChange={setRange} options={[{ value: "all", label: "All time" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />
            <Select label="Guests" value={guestFilter} onChange={setGuestFilter} options={[{ value: "any", label: "Any guests" }, { value: "with", label: "With guests" }, { value: "without", label: "Solo only" }]} />
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              Min. engagement
              <input type="range" min={0} max={engMax} step={1} value={minEng} onChange={(e) => setMinEng(Number(e.target.value))} className="w-28 accent-[var(--series-1)]" />
              <span className="tabular w-10 text-ink">{minEng}%</span>
            </label>
          </div>
          <span className="text-xs text-ink-muted md:ml-auto">{rows.length} shown</span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="w-10 px-4 py-2.5">
                  <span className="sr-only">Compare</span>
                </th>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th key={c.key} className={clsx("px-3 py-2.5 text-xs font-medium text-ink-muted", c.align === "right" ? "text-right" : "text-left")} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <span className={clsx("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}>
                        <button type="button" onClick={() => setSort({ key: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" })} className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
                          {c.label}
                          <Icon className="h-3 w-3" aria-hidden />
                        </button>
                        {c.metric && <AvailabilityBadge metric={c.metric} />}
                      </span>
                    </th>
                  );
                })}
                <th className="px-3 py-2.5">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((l) => {
                const selected = compareIds.includes(l.id);
                return (
                  <tr key={l.id} className={clsx("border-b border-line/60 last:border-0 hover:bg-surface-sunken/50", selected && "bg-[color-mix(in_srgb,var(--series-1)_6%,transparent)]")}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && compareIds.length >= MAX_COMPARE}
                        onChange={() => toggleCompare(l.id)}
                        aria-label={`Compare ${l.title}`}
                        className="h-4 w-4 rounded accent-[var(--series-1)]"
                      />
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={clsx("px-3 py-2.5", c.align === "right" ? "text-right text-ink-soft" : "text-ink", c.key === "title" && "max-w-[260px] truncate font-medium", c.key === "startedAt" && "whitespace-nowrap text-ink-soft")}>
                        {c.render(l)}
                        {c.key === "title" && l.guestNames.length > 0 && <span className="ml-1.5 text-xs font-normal text-ink-muted">with @{l.guestNames[0]}</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLiveId(l.id);
                          onNavigate("overview");
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--series-1)] hover:bg-surface-sunken"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p className="px-4 py-10 text-center text-sm text-ink-muted">No Lives match these filters.</p>}
        </div>
      </Card>
    </div>
  );
}
