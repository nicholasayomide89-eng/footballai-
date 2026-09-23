import clsx from "clsx";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Check, Clock, Copy, Eye, Sparkles, TrendingUp } from "lucide-react";
import type { ClipOpportunity } from "@/types/analytics";
import { formatDuration, formatNumber, formatOffset, formatTime } from "@/lib/format";
import { Badge, Button } from "@/components/ui/primitives";

export function AiLabel({ source }: { source: ClipOpportunity["suggestionSource"] }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color-mix(in_srgb,var(--series-7)_55%,transparent)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--series-7)]"
      title={source === "template" ? "Generated suggestion (demo uses rule-based templates in place of an AI model). Not measured data." : "AI-generated suggestion. Not measured data."}
    >
      <Sparkles className="h-3 w-3" aria-hidden /> AI suggestion
    </span>
  );
}

export function ClipCard({ clip, onToggleMark, rank }: { clip: ClipOpportunity; onToggleMark: (id: string) => void; rank?: number }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <article className={clsx("flex flex-col rounded-2xl border bg-surface p-5 shadow-card transition-colors", clip.marked ? "border-[color-mix(in_srgb,var(--series-1)_55%,transparent)]" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {rank !== undefined && <span className="tabular flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white">{rank}</span>}
          <div>
            <div className="tabular text-sm font-semibold text-ink">
              {formatOffset(clip.startMinute)} – {formatOffset(clip.endMinute + 1)}
            </div>
            <div className="text-xs text-ink-muted">{formatTime(clip.timestamp)}</div>
          </div>
        </div>
        <Badge tone="brand">Score {clip.score}</Badge>
      </div>

      <p className="mt-3 text-sm text-ink-soft">{clip.whatHappened}</p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-surface-sunken px-2.5 py-2">
          <dt className="flex items-center gap-1 text-ink-muted">
            <Eye className="h-3 w-3" aria-hidden /> Viewers
          </dt>
          <dd className="tabular mt-0.5 font-semibold text-ink">{formatNumber(clip.viewerCount)}</dd>
        </div>
        <div className="rounded-lg bg-surface-sunken px-2.5 py-2">
          <dt className="flex items-center gap-1 text-ink-muted">
            <TrendingUp className="h-3 w-3" aria-hidden /> Spike
          </dt>
          <dd className="tabular mt-0.5 font-semibold text-ink">{clip.engagementSpikePct > 0 ? `+${clip.engagementSpikePct}%` : "—"}</dd>
        </div>
        <div className="rounded-lg bg-surface-sunken px-2.5 py-2">
          <dt className="flex items-center gap-1 text-ink-muted">
            <Clock className="h-3 w-3" aria-hidden /> Length
          </dt>
          <dd className="tabular mt-0.5 font-semibold text-ink">~{formatDuration(clip.estimatedLengthSeconds)}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 rounded-xl border border-dashed border-line p-3">
        <AiLabel source={clip.suggestionSource} />
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Suggested title</span>
            <button type="button" onClick={() => copy("title", clip.suggestedTitle)} className="rounded p-1 text-ink-muted hover:text-ink" aria-label="Copy title">
              {copied === "title" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-sm font-medium text-ink">{clip.suggestedTitle}</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Reel / Short caption</span>
            <button type="button" onClick={() => copy("caption", clip.suggestedCaption)} className="rounded p-1 text-ink-muted hover:text-ink" aria-label="Copy caption">
              {copied === "caption" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-sm text-ink-soft">{clip.suggestedCaption}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant={clip.marked ? "primary" : "secondary"} size="sm" onClick={() => onToggleMark(clip.id)} aria-pressed={clip.marked}>
          {clip.marked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {clip.marked ? "Marked for editing" : "Mark for editing"}
        </Button>
      </div>
    </article>
  );
}
