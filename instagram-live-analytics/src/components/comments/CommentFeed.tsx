import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, HelpCircle, Pause, Pin, Play } from "lucide-react";
import type { LiveComment } from "@/types/analytics";
import { escapeRe } from "@/lib/analytics";
import { formatTimeSeconds } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/primitives";

export function highlight(text: string, keywords: string[]) {
  if (!keywords.length) return text;
  const re = new RegExp(`(${keywords.map(escapeRe).join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-[color-mix(in_srgb,var(--series-4)_30%,transparent)] px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function CommentRow({
  comment,
  countByViewer,
  keywords,
  onPin,
  onFlag,
  onSelectUser,
}: {
  comment: LiveComment;
  countByViewer: Map<string, number>;
  keywords: string[];
  onPin: (id: string) => void;
  onFlag: (id: string) => void;
  onSelectUser?: (username: string) => void;
}) {
  const n = countByViewer.get(comment.viewerId) ?? 1;
  return (
    <li className={clsx("group flex gap-3 px-4 py-2.5 transition-colors hover:bg-surface-sunken/60", comment.flagged && "bg-[color-mix(in_srgb,var(--status-critical)_5%,transparent)]", comment.pinned && "bg-[color-mix(in_srgb,var(--series-1)_6%,transparent)]")}>
      <Avatar name={comment.username} src={comment.avatarUrl} size={34} ring={n >= 5} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button type="button" className="truncate text-[13px] font-semibold text-ink hover:underline" onClick={() => onSelectUser?.(comment.username)}>
            {comment.username}
          </button>
          <span className="tabular rounded-full bg-surface-sunken px-1.5 text-[11px] font-medium text-ink-soft" title={`${n} comments from this viewer`}>
            {n} {n === 1 ? "comment" : "comments"}
          </span>
          {comment.isQuestion && (
            <Badge tone="info">
              <HelpCircle className="h-3 w-3" aria-hidden /> Question
            </Badge>
          )}
          {comment.pinned && (
            <Badge tone="info">
              <Pin className="h-3 w-3" aria-hidden /> Pinned
            </Badge>
          )}
          {comment.flagged && (
            <Badge tone="critical" title={comment.flagReason}>
              <Flag className="h-3 w-3" aria-hidden /> {comment.flagReason ?? "Flagged"}
            </Badge>
          )}
          <span className="tabular ml-auto text-[11px] text-ink-muted">{formatTimeSeconds(comment.timestamp)}</span>
        </div>
        <p className={clsx("mt-0.5 break-words text-sm", comment.flagged ? "text-ink-muted" : "text-ink-soft")}>{highlight(comment.text, keywords)}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button type="button" onClick={() => onPin(comment.id)} className={clsx("rounded-md p-1.5 hover:bg-surface-sunken", comment.pinned ? "text-[var(--series-1)]" : "text-ink-muted")} aria-label={comment.pinned ? "Unpin comment" : "Pin comment"} aria-pressed={comment.pinned}>
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onFlag(comment.id)} className={clsx("rounded-md p-1.5 hover:bg-surface-sunken", comment.flagged ? "text-[var(--status-critical)]" : "text-ink-muted")} aria-label={comment.flagged ? "Unflag comment" : "Flag comment"} aria-pressed={comment.flagged}>
          <Flag className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

/**
 * Newest-first live comment feed. Pauses automatically while the user scrolls
 * down so incoming comments don't shift what they're reading.
 */
export function CommentFeed({
  comments,
  allComments,
  keywords,
  onPin,
  onFlag,
  onSelectUser,
  maxHeight = 560,
  live,
}: {
  comments: LiveComment[];
  /** Used to count comments per viewer (so counts ignore active filters). */
  allComments: LiveComment[];
  keywords: string[];
  onPin: (id: string) => void;
  onFlag: (id: string) => void;
  onSelectUser?: (username: string) => void;
  maxHeight?: number;
  live?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<LiveComment[] | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(150);

  const countByViewer = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of allComments) m.set(c.viewerId, (m.get(c.viewerId) ?? 0) + 1);
    return m;
  }, [allComments]);

  useEffect(() => {
    if (paused && !frozen) setFrozen(comments);
    if (!paused) setFrozen(null);
  }, [paused, comments, frozen]);

  const source = paused && frozen ? mergeFrozen(frozen, comments) : comments;
  const ordered = useMemo(() => [...source].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [source]);
  const pending = paused && frozen ? comments.length - frozen.length : 0;

  return (
    <div className="relative">
      {live && (
        <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-muted">
          <span>{paused ? "Feed paused while you read" : "Streaming newest first"}</span>
          <button type="button" onClick={() => setPaused((p) => !p)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-ink-soft hover:bg-surface-sunken">
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? `Resume${pending > 0 ? ` (${pending} new)` : ""}` : "Pause"}
          </button>
        </div>
      )}
      <div
        ref={scroller}
        className="overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
        onScroll={(e) => {
          if (!live) return;
          const top = (e.target as HTMLDivElement).scrollTop;
          if (top > 40 && !paused) setPaused(true);
        }}
      >
        <ul className="divide-y divide-line/70">
          {ordered.slice(0, limit).map((c) => (
            <CommentRow key={c.id} comment={c} countByViewer={countByViewer} keywords={keywords} onPin={onPin} onFlag={onFlag} onSelectUser={onSelectUser} />
          ))}
        </ul>
        {ordered.length > limit && (
          <div className="p-3 text-center">
            <button type="button" onClick={() => setLimit((l) => l + 200)} className="text-sm font-medium text-[var(--series-1)] hover:underline">
              Show more ({ordered.length - limit} older)
            </button>
          </div>
        )}
        {!ordered.length && <p className="px-4 py-10 text-center text-sm text-ink-muted">No comments match these filters.</p>}
      </div>
    </div>
  );
}

/** Keep frozen order but reflect pin/flag changes on the same comments. */
function mergeFrozen(frozen: LiveComment[], latest: LiveComment[]) {
  const byId = new Map(latest.map((c) => [c.id, c]));
  return frozen.map((c) => byId.get(c.id) ?? c);
}
