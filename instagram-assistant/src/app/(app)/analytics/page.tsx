import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { NotConnectedError } from "@/lib/instagram/account";
import { BLOCKS, DAYS, formatComparison, recentPerformance, timingGrid, type MediaStats } from "@/lib/services/analytics";
import { systemState } from "@/lib/services/system";

// Sequential single-hue ramp (light to dark) for the timing heatmap.
const RAMP = ["#eef0fb", "#d3d9f5", "#aeb8ec", "#8190de", "#5667cf", "#2d46c8"];

function pct(n: number | null | undefined) {
  return n === null || n === undefined ? "–" : `${(n * 100).toFixed(1)}%`;
}

export default async function AnalyticsPage() {
  const state = await systemState();
  let stats: MediaStats[] = [];
  let problem: string | null = null;
  try {
    stats = await recentPerformance(25);
  } catch (err) {
    problem = err instanceof NotConnectedError ? "Connect Instagram to see analytics." : "Couldn't load insights from Instagram right now.";
  }

  const { grid, samples } = timingGrid(stats, state.timezone);
  const values = grid.flat().filter((v): v is number => v !== null);
  const max = Math.max(0, ...values);
  const formats = formatComparison(stats);
  const top = [...stats].filter((s) => s.engagementRate !== null).sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0)).slice(0, 5);
  const maxMultiple = Math.max(1, ...formats.map((f) => f.multiple));

  return (
    <>
      <TopBar title="Analytics" />
      <main className="page">
        {problem ? (
          <p className="card warn">{problem} {problem.startsWith("Connect") ? <Link href="/settings">Settings</Link> : null}</p>
        ) : (
          <>
            <p className="small muted">Based on your last {stats.length} posts, not on trends. Engagement rate is interactions divided by reach.</p>

            <section className="card" aria-labelledby="timing">
              <h2 id="timing">When your posts do best</h2>
              {samples < 10 ? <p className="small muted">Only {samples} posts with reach data so far, so treat this as a rough guide.</p> : null}
              <div className="heat" role="table" aria-label="Average engagement rate by day and posting time">
                <span role="columnheader" />
                {BLOCKS.map((b) => <span key={b} role="columnheader" style={{ textAlign: "center" }}>{b}h</span>)}
                {DAYS.map((day, i) => (
                  <div key={day} role="row" style={{ display: "contents" }}>
                    <span role="rowheader">{day}</span>
                    {grid[i]!.map((v, j) => {
                      const level = v === null || max === 0 ? -1 : Math.min(5, Math.floor((v / max) * 5.999));
                      return (
                        <span
                          key={j}
                          role="cell"
                          className="cell"
                          title={v === null ? `${day} ${BLOCKS[j]}h: no posts` : `${day} ${BLOCKS[j]}h: ${pct(v)}`}
                          aria-label={v === null ? "no posts" : pct(v)}
                          style={{ background: level < 0 ? "var(--sunken)" : RAMP[level] }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="small muted">Times in {state.timezone}. Grey cells mean you haven&apos;t posted then.</p>
            </section>

            {formats.length ? (
              <section className="card" aria-labelledby="formats">
                <h2 id="formats">What works for you</h2>
                {formats.map((f) => (
                  <div key={f.label} style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr) 48px", gap: 8, alignItems: "center" }}>
                    <span className="small">{f.label} <span className="muted">({f.count})</span></span>
                    <span style={{ height: 10, borderRadius: "0 4px 4px 0", background: "var(--accent)", width: `${(f.multiple / maxMultiple) * 100}%` }} />
                    <span className="mono small" style={{ textAlign: "right" }}>{f.multiple.toFixed(1)}×</span>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="stack" aria-labelledby="top">
              <h2 id="top">Top posts</h2>
              <ul className="list">
                {top.map((s) => (
                  <li key={s.media.id} className="row" style={{ padding: "10px 0", flexWrap: "nowrap" }}>
                    <span style={{ flex: 1, minWidth: 0 }} className="small ellipsis">
                      {s.media.permalink ? <a href={s.media.permalink} target="_blank" rel="noreferrer">{s.media.caption?.slice(0, 80) || s.media.media_type}</a> : s.media.caption}
                    </span>
                    <span className="mono small">{pct(s.engagementRate)}</span>
                    <span className="small muted">{s.metrics.reach?.toLocaleString() ?? "–"} reach</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
