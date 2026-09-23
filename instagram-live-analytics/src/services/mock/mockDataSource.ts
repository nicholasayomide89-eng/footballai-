import type { LiveComment, LiveDelta, LiveEvent, LiveSession, LiveSummary, Viewer } from "@/types/analytics";
import { summarize } from "@/lib/analytics";
import { META_GRAPH_CAPABILITIES } from "../capabilities";
import type { LiveAnalyticsDataSource, Unsubscribe } from "../types";
import { buildCurrentPlan, buildHistoryPlans, generateLiveSession, planDuration, type LivePlan } from "./generator";
import { GUEST_POOL, PREVIOUS_LIVE_TITLES } from "./seedData";

const MIN = 60_000;
/** The demo Live opens this many minutes in. */
const DEMO_START_MINUTE = 40;
/** Real milliseconds per simulated minute (12× playback). */
export const DEMO_MS_PER_MINUTE = 5_000;
const STORAGE_KEY = "livelens-marked-clips";

/**
 * Demo data source. Generates realistic, deterministic Lives and plays the
 * current one back progressively so every live-updating view can be tested
 * without a real account.
 */
export class MockDataSource implements LiveAnalyticsDataSource {
  readonly kind = "mock" as const;
  readonly label = "Demo data (sample account)";

  private plans = new Map<string, LivePlan>();
  private sessions = new Map<string, LiveSession>();
  private currentPlan!: LivePlan;
  private playbackStartedAt = Date.now();
  private overrides = new Map<string, Partial<LiveComment>>();
  private marked: Record<string, string[]> = loadMarked();

  constructor() {
    this.reset();
  }

  /** Restart the demo broadcast from minute 40. */
  reset() {
    const now = new Date();
    this.plans.clear();
    this.sessions.clear();
    this.currentPlan = buildCurrentPlan(new Date(now.getTime() - DEMO_START_MINUTE * MIN));
    this.plans.set(this.currentPlan.id, this.currentPlan);
    for (const p of buildHistoryPlans(now, PREVIOUS_LIVE_TITLES, GUEST_POOL)) this.plans.set(p.id, p);
    this.playbackStartedAt = Date.now();
  }

  getCapabilities() {
    // The demo fills every metric, but reports the availability a real Meta
    // integration would have so the UI labels stay honest.
    return META_GRAPH_CAPABILITIES;
  }

  async getCurrentLive() {
    const minutes = this.elapsedMinutes();
    if (minutes >= planDuration(this.currentPlan)) return this.snapshot(planDuration(this.currentPlan), true);
    return this.snapshot(minutes, false);
  }

  async getLive(liveId: string) {
    if (liveId === this.currentPlan.id) return this.getCurrentLive();
    return this.applyOverrides(this.full(liveId));
  }

  async listPreviousLives(): Promise<LiveSummary[]> {
    return [...this.plans.values()]
      .filter((p) => p.id !== this.currentPlan.id)
      .map((p) => summarize(this.full(p.id)))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  subscribeToLive(liveId: string, onDelta: (d: LiveDelta) => void): Unsubscribe {
    if (liveId !== this.currentPlan.id) return () => {};
    const full = this.full(liveId);
    const duration = full.series.length;
    let revealed = this.elapsedMinutes();
    const sent = new Set<string>(full.comments.filter((c) => c.minute < revealed).map((c) => c.id));
    let ended = revealed >= duration;

    const tick = () => {
      if (ended) return;
      const simFloat = DEMO_START_MINUTE + (Date.now() - this.playbackStartedAt) / DEMO_MS_PER_MINUTE;
      const n = Math.min(duration, Math.floor(simFloat));
      const start = new Date(full.startedAt).getTime();
      const serverTime = new Date(start + simFloat * MIN).toISOString();

      // Completed minutes
      while (revealed < n) {
        const m = revealed;
        const comments = full.comments.filter((c) => c.minute === m && !sent.has(c.id));
        comments.forEach((c) => sent.add(c.id));
        const touched = full.viewers.filter((v) => v.joinedMinute === m || v.leftMinute === m || comments.some((c) => c.viewerId === v.id));
        const events = full.sourceEvents.filter((e) => e.minute === m && e.type !== "live_ended");
        const guests = this.projectGuests(full, m + 1).filter((g) => g.joinedMinute === m || g.leftMinute === m);
        onDelta({
          liveId,
          point: full.series[m],
          comments: comments.map((c) => this.withOverride(c)),
          viewersUpserted: touched.map((v) => this.projectViewer(full, v, m + 1)),
          events,
          guestsUpserted: guests,
          serverTime,
        });
        revealed++;
      }

      if (n >= duration) {
        ended = true;
        const endedAt = new Date(start + duration * MIN).toISOString();
        const endEvent: LiveEvent = { id: `${liveId}-e-end`, type: "live_ended", minute: duration, timestamp: endedAt, label: "Live ended" };
        onDelta({ liveId, status: "ended", endedAt, events: [endEvent], currentViewers: 0, serverTime: endedAt });
        return;
      }

      // Running minute: drip comments and interpolate viewers.
      const frac = simFloat - n;
      const cutoff = start + (n + frac) * MIN;
      const drip = full.comments.filter((c) => c.minute === n && !sent.has(c.id) && new Date(c.timestamp).getTime() <= cutoff);
      drip.forEach((c) => sent.add(c.id));
      const a = full.series[Math.max(0, n - 1)].concurrentViewers;
      const b = full.series[n].concurrentViewers;
      const jitter = Math.round((Math.random() - 0.5) * Math.max(4, b * 0.01));
      onDelta({
        liveId,
        currentViewers: Math.max(0, Math.round(a + (b - a) * frac) + jitter),
        comments: drip.map((c) => this.withOverride(c)),
        serverTime,
      });
    };

    tick();
    const handle = window.setInterval(tick, 1000);
    return () => window.clearInterval(handle);
  }

  async setCommentPinned(_liveId: string, commentId: string, pinned: boolean) {
    this.overrides.set(commentId, { ...this.overrides.get(commentId), pinned });
  }

  async setCommentFlagged(_liveId: string, commentId: string, flagged: boolean, reason?: string) {
    this.overrides.set(commentId, { ...this.overrides.get(commentId), flagged, flagReason: flagged ? reason ?? "Flagged by you" : undefined });
  }

  async setClipMarked(liveId: string, clipId: string, marked: boolean) {
    const set = new Set(this.marked[liveId] ?? []);
    if (marked) set.add(clipId);
    else set.delete(clipId);
    this.marked[liveId] = [...set];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.marked));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }

  async getMarkedClips(liveId: string) {
    return this.marked[liveId] ?? [];
  }

  // -------------------------------------------------------------------------

  private elapsedMinutes() {
    return Math.floor(DEMO_START_MINUTE + (Date.now() - this.playbackStartedAt) / DEMO_MS_PER_MINUTE);
  }

  private full(liveId: string): LiveSession {
    let s = this.sessions.get(liveId);
    if (!s) {
      const plan = this.plans.get(liveId);
      if (!plan) throw new Error(`Unknown Live: ${liveId}`);
      s = generateLiveSession(plan);
      this.sessions.set(liveId, s);
    }
    return s;
  }

  /** The current Live as it looked after `n` completed minutes. */
  private snapshot(n: number, ended: boolean): LiveSession {
    const full = this.full(this.currentPlan.id);
    const start = new Date(full.startedAt).getTime();
    const endedAt = ended ? new Date(start + full.series.length * MIN).toISOString() : undefined;
    return this.applyOverrides({
      ...full,
      status: ended ? "ended" : "live",
      endedAt,
      series: full.series.slice(0, n),
      comments: full.comments.filter((c) => c.minute < n),
      viewers: full.viewers.filter((v) => v.joinedMinute < n).map((v) => this.projectViewer(full, v, n)),
      guests: this.projectGuests(full, n),
      sourceEvents: [
        ...full.sourceEvents.filter((e) => e.minute < n && e.type !== "live_ended"),
        ...(ended ? [{ id: `${full.id}-e-end`, type: "live_ended" as const, minute: full.series.length, timestamp: endedAt!, label: "Live ended" }] : []),
      ],
    });
  }

  private projectViewer(full: LiveSession, v: Viewer, n: number): Viewer {
    const left = v.leftMinute !== null && v.leftMinute < n ? v.leftMinute : null;
    const commentCount = full.comments.filter((c) => c.viewerId === v.id && c.minute < n).length;
    const totalMin = Math.max(1, (v.leftMinute ?? full.series.length) - v.joinedMinute);
    const watchedMin = (left ?? n) - v.joinedMinute;
    return {
      ...v,
      leftMinute: left,
      commentCount,
      likeCount: Math.round(v.likeCount * Math.min(1, watchedMin / totalMin)),
      watchSeconds: watchedMin * 60,
    };
  }

  private projectGuests(full: LiveSession, n: number) {
    return full.guests
      .filter((g) => g.joinedMinute < n)
      .map((g) => ({ ...g, leftMinute: g.leftMinute !== null && g.leftMinute < n ? g.leftMinute : null }));
  }

  private withOverride(c: LiveComment): LiveComment {
    const o = this.overrides.get(c.id);
    return o ? { ...c, ...o } : c;
  }

  private applyOverrides(s: LiveSession): LiveSession {
    if (!this.overrides.size) return s;
    return { ...s, comments: s.comments.map((c) => this.withOverride(c)) };
  }
}

function loadMarked(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
