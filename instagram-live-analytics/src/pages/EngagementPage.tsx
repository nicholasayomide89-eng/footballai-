import clsx from "clsx";
import { useMemo, useState } from "react";
import { HelpCircle, Heart, MessageCircle, Scissors, TrendingUp, UserPlus, Users, type LucideIcon } from "lucide-react";
import type { EngagementMoment, LiveEvent, LiveEventType, MomentType } from "@/types/analytics";
import { useDashboard } from "@/state/DashboardContext";
import { formatNumber, formatOffset, formatTime } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/primitives";
import { EVENT_META, LiveTimeline, TimelineAxis, TimelineStrip } from "@/components/timeline/LiveTimeline";
import type { PageId } from "@/components/layout/navigation";

const MOMENT_META: Record<MomentType, { icon: LucideIcon; label: string; color: string }> = {
  viewer_surge: { icon: Users, label: "Viewer surge", color: "var(--series-1)" },
  comment_surge: { icon: MessageCircle, label: "Comment spike", color: "var(--series-2)" },
  like_surge: { icon: Heart, label: "Likes spike", color: "var(--series-5)" },
  follower_surge: { icon: TrendingUp, label: "Follower spike", color: "var(--series-3)" },
  guest_joined: { icon: UserPlus, label: "Guest joined", color: "var(--series-7)" },
  discussion_started: { icon: HelpCircle, label: "Big question", color: "var(--series-4)" },
};

export function EngagementPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { session, moments, timeline } = useDashboard();
  const [types, setTypes] = useState<Set<MomentType>>(new Set(Object.keys(MOMENT_META) as MomentType[]));
  const [eventTypes, setEventTypes] = useState<Set<LiveEventType>>(new Set(Object.keys(EVENT_META) as LiveEventType[]));
  const [clipsOnly, setClipsOnly] = useState(false);

  const shown = useMemo(() => moments.filter((m) => types.has(m.type) && (!clipsOnly || m.isClipOpportunity)), [moments, types, clipsOnly]);
  const stripEvents: LiveEvent[] = useMemo(
    () => shown.map((m) => ({ id: m.id, type: momentToEvent(m.type), minute: m.startMinute, timestamp: m.timestamp, label: `${m.title}${m.isClipOpportunity ? " · Clip opportunity" : ""}` })),
    [shown],
  );

  if (!session) return null;
  const duration = Math.max(session.series.length, 1);
  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  return (
    <div>
      <SectionTitle title="Engagement" subtitle="Moments detected automatically from spikes against each metric’s recent baseline." />

      <Card>
        <CardHeader
          title="Engagement moments"
          subtitle={`${moments.length} detected · ${moments.filter((m) => m.isClipOpportunity).length} clip opportunities`}
          actions={
            <button type="button" onClick={() => setClipsOnly((v) => !v)} aria-pressed={clipsOnly} className={clsx("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium", clipsOnly ? "border-transparent bg-brand-gradient text-white" : "border-line text-ink-soft hover:bg-surface-sunken")}>
              <Scissors className="h-3.5 w-3.5" /> Clip opportunities only
            </button>
          }
        />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.keys(MOMENT_META) as MomentType[]).map((t) => {
              const meta = MOMENT_META[t];
              const on = types.has(t);
              return (
                <button key={t} type="button" onClick={() => toggle(types, t, setTypes)} aria-pressed={on} className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-line bg-surface text-ink" : "border-dashed border-line text-ink-muted")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? meta.color : "rgb(var(--line))" }} />
                  {meta.label}
                  <span className="tabular text-ink-muted">{moments.filter((m) => m.type === t).length}</span>
                </button>
              );
            })}
          </div>
          <div className="px-3">
            <TimelineStrip events={stripEvents} duration={duration} highlight={(e) => e.label.includes("Clip opportunity")} />
            <TimelineAxis duration={duration} />
          </div>

          <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((m) => (
              <MomentCard key={m.id} m={m} onClip={() => onNavigate("clips")} />
            ))}
            {!shown.length && <li className="text-sm text-ink-muted">No moments match these filters yet.</li>}
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Live timeline" subtitle="Everything that happened, in order" />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.keys(EVENT_META) as LiveEventType[]).map((t) => {
              const on = eventTypes.has(t);
              const n = timeline.filter((e) => e.type === t).length;
              if (!n) return null;
              return (
                <button key={t} type="button" onClick={() => toggle(eventTypes, t, setEventTypes)} aria-pressed={on} className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", on ? "border-line text-ink" : "border-dashed border-line text-ink-muted")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? EVENT_META[t].color : "rgb(var(--line))" }} />
                  {EVENT_META[t].label} <span className="tabular text-ink-muted">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="mb-6 px-3">
            <TimelineStrip events={timeline.filter((e) => eventTypes.has(e.type))} duration={duration} />
            <TimelineAxis duration={duration} />
          </div>
          <LiveTimeline events={timeline} filter={eventTypes} />
        </CardBody>
      </Card>
    </div>
  );
}

function MomentCard({ m, onClip }: { m: EngagementMoment; onClip: () => void }) {
  const meta = MOMENT_META[m.type];
  const Icon = meta.icon;
  return (
    <li className={clsx("rounded-xl border p-4", m.isClipOpportunity ? "border-[color-mix(in_srgb,#e1306c_40%,transparent)]" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{m.title}</p>
            <p className="tabular text-xs text-ink-muted">
              {formatOffset(m.startMinute)} · {formatTime(m.timestamp)}
            </p>
          </div>
        </div>
        {m.isClipOpportunity && (
          <button type="button" onClick={onClip}>
            <Badge tone="brand">
              <Scissors className="h-3 w-3" aria-hidden /> Clip opportunity
            </Badge>
          </button>
        )}
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">{m.description}</p>
      <div className="tabular mt-2 flex gap-4 text-xs text-ink-muted">
        <span>{formatNumber(m.viewers)} viewers</span>
        {m.changePct > 0 && <span>+{m.changePct}%</span>}
        <span>Score {m.score}</span>
      </div>
    </li>
  );
}

function momentToEvent(t: MomentType): LiveEventType {
  return ({ viewer_surge: "viewer_milestone", comment_surge: "comment_spike", like_surge: "engagement_spike", follower_surge: "follower_spike", guest_joined: "guest_joined", discussion_started: "question_spike" } as const)[t];
}
