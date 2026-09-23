import clsx from "clsx";
import { Flag, Heart, MessageCircle, Play, Square, TrendingUp, UserMinus, UserPlus, Users, HelpCircle, type LucideIcon } from "lucide-react";
import type { LiveEvent, LiveEventType } from "@/types/analytics";
import { formatOffset, formatTime } from "@/lib/format";

export const EVENT_META: Record<LiveEventType, { icon: LucideIcon; label: string; color: string }> = {
  live_started: { icon: Play, label: "Live started", color: "var(--status-good)" },
  viewer_milestone: { icon: Flag, label: "Viewer milestone", color: "var(--series-1)" },
  guest_joined: { icon: UserPlus, label: "Guest joined", color: "var(--series-7)" },
  guest_left: { icon: UserMinus, label: "Guest left", color: "var(--series-7)" },
  engagement_spike: { icon: Heart, label: "Engagement spike", color: "var(--series-5)" },
  comment_spike: { icon: MessageCircle, label: "Comment spike", color: "var(--series-2)" },
  follower_spike: { icon: TrendingUp, label: "Follower spike", color: "var(--series-3)" },
  question_spike: { icon: HelpCircle, label: "Big question", color: "var(--series-4)" },
  live_ended: { icon: Square, label: "Live ended", color: "var(--ink-muted)" },
};

/** Vertical list timeline of Live events. */
export function LiveTimeline({ events, compact = false, filter }: { events: LiveEvent[]; compact?: boolean; filter?: Set<LiveEventType> }) {
  const shown = filter ? events.filter((e) => filter.has(e.type)) : events;
  return (
    <ol className="relative">
      {shown.map((e, i) => {
        const meta = EVENT_META[e.type];
        const Icon = meta.icon;
        return (
          <li key={e.id} className="animate-in relative flex gap-3 pb-4 last:pb-0">
            {i < shown.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-line" aria-hidden />}
            <span
              className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-surface"
              style={{ background: `color-mix(in srgb, ${meta.color} 16%, rgb(var(--surface)))`, color: meta.color }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-ink">{e.label}</p>
                <span className="tabular text-xs text-ink-muted">
                  {formatOffset(e.minute)} · {formatTime(e.timestamp)}
                </span>
              </div>
              {!compact && e.detail && <p className="mt-0.5 text-[13px] text-ink-muted">{e.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal strip showing events positioned along the Live's duration. */
export function TimelineStrip({ events, duration, highlight }: { events: LiveEvent[]; duration: number; highlight?: (e: LiveEvent) => boolean }) {
  const max = Math.max(duration, 1);
  return (
    <div className="relative h-14 w-full">
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-sunken" />
      {events.map((e) => {
        const meta = EVENT_META[e.type];
        const Icon = meta.icon;
        const hot = highlight?.(e);
        return (
          <span
            key={e.id}
            className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${Math.min(100, (e.minute / max) * 100)}%` }}
          >
            <span
              tabIndex={0}
              className={clsx("flex items-center justify-center rounded-full border-2 border-surface shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)]", hot ? "h-7 w-7" : "h-5 w-5")}
              style={{ background: meta.color, color: "white" }}
              aria-label={`${e.label} at ${formatOffset(e.minute)}`}
            >
              <Icon className={hot ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} aria-hidden />
            </span>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink shadow-lg group-hover:block group-focus-within:block">
              <span className="font-semibold">{e.label}</span>
              <span className="block text-ink-muted">{formatOffset(e.minute)}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function TimelineAxis({ duration }: { duration: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(duration * f));
  return (
    <div className="relative mt-1 h-4 text-[11px] text-ink-muted">
      {ticks.map((t, i) => (
        <span key={i} className={clsx("tabular absolute", i === 0 ? "left-0" : i === ticks.length - 1 ? "right-0" : "-translate-x-1/2")} style={i > 0 && i < ticks.length - 1 ? { left: `${(t / Math.max(duration, 1)) * 100}%` } : undefined}>
          {formatOffset(t)}
        </span>
      ))}
    </div>
  );
}

export { Users as TimelineUsersIcon };
