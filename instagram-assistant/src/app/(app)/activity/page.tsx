import { TopBar } from "@/components/TopBar";
import { verifyChain, type StoredEntry } from "@/lib/audit";
import { db } from "@/lib/db";

const ACTOR: Record<string, [string, string]> = { ai: ["AI", "accent"], owner: ["You", ""], system: ["System", ""] };
const OUTCOME: Record<string, string> = { blocked: "stop", failed: "stop", skipped: "warn", sent: "ok", published: "ok", ok: "" };

export default async function ActivityPage() {
  const all = await db.actionLog.findMany({ orderBy: { seq: "asc" } });
  const broken = verifyChain(all as unknown as StoredEntry[]);
  const recent = all.slice(-100).reverse();

  return (
    <>
      <TopBar title="Activity" backHref="/more" />
      <main className="page">
        <div className="row" style={{ justifyContent: "space-between" }}>
          {broken === null ? (
            <span className="tag ok">Log intact · {all.length} entries</span>
          ) : (
            <span className="tag stop">Log altered at entry {broken.toString()}</span>
          )}
          <a className="btn" href="/api/activity/export">Export full log</a>
        </div>
        <ol className="list">
          {recent.map((e) => {
            const [actor, actorTone] = ACTOR[e.actor] ?? [e.actor, ""];
            const detail = e.detail as Record<string, unknown> | null;
            const why = [
              e.ruleKeys.length ? `Rules: ${e.ruleKeys.join(", ")}` : null,
              typeof detail?.rationale === "string" ? detail.rationale : null,
              typeof detail?.error === "string" ? detail.error : null,
              typeof detail?.reason === "string" ? detail.reason : null,
            ].filter(Boolean);
            return (
              <li key={e.seq.toString()} className="log">
                <span className="mono small muted">{e.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<br />{e.at.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                <span className="stack" style={{ gap: 4 }}>
                  <span className="row">
                    <span className={`tag ${actorTone}`}>{actor}</span>
                    <strong className="small">{e.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong>
                    <span className={`tag ${OUTCOME[e.outcome] ?? ""}`}>{e.outcome}</span>
                  </span>
                  {why.length ? <span className="small muted">{why.join(" · ")}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
