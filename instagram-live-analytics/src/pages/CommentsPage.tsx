import { useMemo, useState } from "react";
import { Flag, Pin, Plus, X } from "lucide-react";
import { useDashboard } from "@/state/DashboardContext";
import { clusterQuestions, commenterStats, escapeRe, keywordCounts } from "@/lib/analytics";
import { formatNumber, formatOffset } from "@/lib/format";
import { Card, CardBody, CardHeader, SearchInput, SectionTitle, SegmentedControl, Badge } from "@/components/ui/primitives";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { CommentFeed } from "@/components/comments/CommentFeed";
import { Avatar } from "@/components/ui/Avatar";

type Filter = "all" | "questions" | "keywords" | "pinned" | "flagged";

export function CommentsPage() {
  const { session, keywords, setKeywords, togglePin, toggleFlag } = useDashboard();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [user, setUser] = useState<string | null>(null);
  const [minComments, setMinComments] = useState(1);
  const [newKeyword, setNewKeyword] = useState("");

  const comments = session?.comments ?? [];
  const countByViewer = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) m.set(c.viewerId, (m.get(c.viewerId) ?? 0) + 1);
    return m;
  }, [comments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kwRe = keywords.length ? new RegExp(`\\b(${keywords.map(escapeRe).join("|")})`, "i") : null;
    return comments.filter((c) => {
      if (q && !c.text.toLowerCase().includes(q) && !c.username.toLowerCase().includes(q)) return false;
      if (user && c.username !== user) return false;
      if ((countByViewer.get(c.viewerId) ?? 0) < minComments) return false;
      if (filter === "questions") return c.isQuestion && !c.flagged;
      if (filter === "pinned") return c.pinned;
      if (filter === "flagged") return c.flagged;
      if (filter === "keywords") return kwRe ? kwRe.test(c.text) : false;
      return true;
    });
  }, [comments, query, user, filter, keywords, minComments, countByViewer]);

  const commenters = useMemo(() => (session ? commenterStats(session).slice(0, 6) : []), [session?.id, comments.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const questions = useMemo(() => clusterQuestions(comments).slice(0, 6), [comments]);
  const kwCounts = useMemo(() => keywordCounts(comments, keywords), [comments, keywords]);
  const pinned = comments.filter((c) => c.pinned);
  const flagged = comments.filter((c) => c.flagged);

  if (!session) return null;
  const counts: Record<Filter, number> = {
    all: comments.length,
    questions: comments.filter((c) => c.isQuestion && !c.flagged).length,
    keywords: kwCounts.reduce((s, k) => s + k.count, 0),
    pinned: pinned.length,
    flagged: flagged.length,
  };

  const addKeyword = () => {
    const k = newKeyword.trim().toLowerCase();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setNewKeyword("");
  };

  return (
    <div>
      <SectionTitle title="Comments" subtitle={<span className="inline-flex items-center gap-1.5">{formatNumber(comments.length)} comments from {formatNumber(countByViewer.size)} viewers <AvailabilityBadge metric="comments" /></span>} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <SearchInput value={query} onChange={setQuery} placeholder="Search comments or usernames" className="flex-1" />
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                Min. comments/viewer
                <input type="number" min={1} max={50} value={minComments} onChange={(e) => setMinComments(Math.max(1, Number(e.target.value) || 1))} className="h-9 w-16 rounded-lg border border-line bg-surface px-2 text-sm text-ink" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                ariaLabel="Comment filter"
                value={filter}
                onChange={setFilter}
                options={(["all", "questions", "keywords", "pinned", "flagged"] as Filter[]).map((f) => ({
                  value: f,
                  label: (
                    <span>
                      {f[0].toUpperCase() + f.slice(1)} <span className="tabular text-ink-muted">{formatNumber(counts[f])}</span>
                    </span>
                  ),
                }))}
              />
              {user && (
                <button type="button" onClick={() => setUser(null)} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink">
                  @{user} <X className="h-3 w-3" aria-label="Clear user filter" />
                </button>
              )}
            </div>
          </div>
          <CommentFeed comments={filtered} allComments={comments} keywords={keywords} onPin={togglePin} onFlag={toggleFlag} onSelectUser={setUser} live={session.status === "live"} maxHeight={720} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Most active commenters" />
            <CardBody>
              <ul className="space-y-2.5">
                {commenters.map((c) => (
                  <li key={c.viewerId}>
                    <button type="button" onClick={() => setUser(c.username)} className="flex w-full items-center gap-3 rounded-lg text-left hover:bg-surface-sunken/60">
                      <Avatar name={c.username} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.username}</span>
                      <span className="tabular text-sm font-semibold text-ink">{c.comments}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Most repeated questions" subtitle="Similar wording grouped together" />
            <CardBody>
              <ul className="space-y-3">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{q.canonical}</p>
                      <Badge tone="info">×{q.count}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {q.askers} viewers · {formatOffset(q.firstMinute)}–{formatOffset(q.lastMinute)}
                    </p>
                    {q.examples.length > 1 && <p className="mt-1 truncate text-xs text-ink-muted">Also: “{q.examples.slice(1, 3).join("”, “")}”</p>}
                  </li>
                ))}
                {!questions.length && <li className="text-sm text-ink-muted">No questions yet.</li>}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Keyword detection" subtitle="Highlighted in the feed" />
            <CardBody>
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {kwCounts.map((k) => (
                  <li key={k.keyword} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pl-2.5 pr-1 text-xs">
                    <button type="button" className="font-medium text-ink" onClick={() => { setFilter("keywords"); setQuery(k.keyword); }}>
                      {k.keyword}
                    </button>
                    <span className="tabular text-ink-muted">{k.count}</span>
                    <button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k.keyword))} className="rounded-full p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label={`Remove keyword ${k.keyword}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => { e.preventDefault(); addKeyword(); }} className="flex gap-2">
                <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Add keyword" aria-label="Add keyword" className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted" />
                <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-[13px] font-medium text-ink hover:bg-surface-sunken">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-1.5"><Pin className="h-4 w-4" /> Pinned</span>} />
            <CardBody>
              <MiniList items={pinned} onToggle={togglePin} empty="Pin comments from the feed to keep them here." action="Unpin" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-1.5"><Flag className="h-4 w-4" /> Flagged</span>} subtitle="Auto-flagged links & spam, plus your manual flags" />
            <CardBody>
              <MiniList items={flagged} onToggle={toggleFlag} empty="Nothing flagged." action="Unflag" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniList({ items, onToggle, empty, action }: { items: { id: string; username: string; text: string; minute: number; flagReason?: string }[]; onToggle: (id: string) => void; empty: string; action: string }) {
  if (!items.length) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="max-h-64 space-y-2.5 overflow-y-auto scrollbar-thin">
      {items.map((c) => (
        <li key={c.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">{c.username}</span> · {formatOffset(c.minute)}
              {c.flagReason && <> · {c.flagReason}</>}
            </p>
            <p className="break-words text-sm text-ink-soft">{c.text}</p>
          </div>
          <button type="button" onClick={() => onToggle(c.id)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
            {action}
          </button>
        </li>
      ))}
    </ul>
  );
}
