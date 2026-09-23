import type {
  Guest,
  LiveComment,
  LiveEvent,
  LiveSession,
  MinutePoint,
  TopicSegment,
  Viewer,
} from "@/types/analytics";
import { autoFlagReason, isQuestion } from "@/lib/moderation";
import { createRng, type Rng } from "./random";
import { GENERIC_COMMENTS, SPAM_COMMENTS, TOPIC_LIBRARY, buildUsernamePool } from "./seedData";

export interface TopicPlan {
  topic: string;
  minutes: number;
  viewerMod?: number;
  commentMod?: number;
  likeMod?: number;
  exitMod?: number;
  followMod?: number;
}

export interface GuestPlan {
  username: string;
  displayName: string;
  join: number;
  leave: number;
  /** Multiplier on target viewers while on screen (e.g. 1.4 = +40%). */
  viewerBoost: number;
  commentBoost?: number;
  followBoost?: number;
}

export interface LivePlan {
  id: string;
  title: string;
  startedAt: Date;
  baseViewers: number;
  seed: number;
  topics: TopicPlan[];
  guests: GuestPlan[];
  status: "live" | "ended";
}

interface InternalViewer extends Viewer {
  chattiness: number;
}

const MIN = 60_000;

export function planDuration(plan: LivePlan) {
  return plan.topics.reduce((s, t) => s + t.minutes, 0);
}

/**
 * Simulates a full Live broadcast minute by minute. The result is a complete
 * script; the mock data source reveals it progressively for the "live" demo.
 */
export function generateLiveSession(plan: LivePlan): LiveSession {
  const rng = createRng(plan.seed);
  const duration = planDuration(plan);
  const start = plan.startedAt.getTime();
  const pool = buildUsernamePool(Math.max(1500, plan.baseViewers * 6), rng.next);
  let poolIdx = 0;

  // Topic lookup per minute
  const topics: TopicSegment[] = [];
  let cursor = 0;
  for (const t of plan.topics) {
    topics.push({ topic: t.topic, startMinute: cursor, endMinute: cursor + t.minutes - 1 });
    cursor += t.minutes;
  }
  const topicAt = (m: number) => plan.topics[topics.findIndex((t) => m >= t.startMinute && m <= t.endMinute)] ?? plan.topics[plan.topics.length - 1];

  const viewers: InternalViewer[] = [];
  let active: InternalViewer[] = [];
  const comments: LiveComment[] = [];
  const series: MinutePoint[] = [];
  let smoothedTarget = plan.baseViewers * 0.2;

  const newViewer = (m: number): InternalViewer => {
    const who = pool[poolIdx++ % pool.length];
    const returning = rng.chance(0.38);
    const v: InternalViewer = {
      id: `${plan.id}-v${viewers.length}`,
      username: poolIdx > pool.length ? `${who.username}_${poolIdx}` : who.username,
      displayName: who.displayName,
      isFollower: returning ? rng.chance(0.8) : rng.chance(0.35),
      isReturning: returning,
      joinedMinute: m,
      leftMinute: null,
      commentCount: 0,
      likeCount: 0,
      watchSeconds: 0,
      chattiness: Math.pow(rng.next(), 4) * (returning ? 2.2 : 1) + 0.02,
    };
    viewers.push(v);
    return v;
  };

  for (let m = 0; m < duration; m++) {
    const topic = topicAt(m);
    const guestsOn = plan.guests.filter((g) => m >= g.join && m <= g.leave);
    const guestViewer = guestsOn.reduce((p, g) => p * g.viewerBoost, 1);
    const guestComment = guestsOn.reduce((p, g) => p * (g.commentBoost ?? 1.35), 1);
    const guestFollow = guestsOn.reduce((p, g) => p * (g.followBoost ?? 1.8), 1);

    const progress = m / duration;
    const ramp = Math.min(1, 0.22 + m / 7);
    const tail = progress > 0.72 ? 1 - 0.45 * ((progress - 0.72) / 0.28) : 1;
    const rawTarget = plan.baseViewers * ramp * tail * (topic.viewerMod ?? 1) * guestViewer * (1 + rng.gauss() * 0.03);
    // Smooth so audience changes look organic rather than stepwise.
    smoothedTarget = smoothedTarget + (rawTarget - smoothedTarget) * 0.45;

    // Exits
    const exitRate = 0.03 * (topic.exitMod ?? 1) * (progress > 0.85 ? 1.6 : 1);
    const exitCount = Math.min(active.length, rng.count(active.length * exitRate));
    for (let i = 0; i < exitCount; i++) {
      const idx = rng.int(0, active.length - 1);
      const v = active[idx];
      v.leftMinute = m;
      active[idx] = active[active.length - 1];
      active.pop();
    }

    // Joins
    const deficit = Math.max(0, Math.round(smoothedTarget - active.length));
    const joinCount = deficit + rng.count(active.length * 0.008);
    for (let i = 0; i < joinCount; i++) active.push(newViewer(m));

    const concurrent = active.length;

    // Comments
    const commentMean = concurrent * 0.03 * (topic.commentMod ?? 1) * guestComment;
    const commentCount = rng.count(commentMean);
    const totalWeight = active.reduce((s, v) => s + v.chattiness, 0);
    const lib = TOPIC_LIBRARY[topic.topic] ?? TOPIC_LIBRARY["Audience Q&A"];
    const guestLib = TOPIC_LIBRARY["Guest conversation"];
    for (let i = 0; i < commentCount && concurrent > 0; i++) {
      let r = rng.next() * totalWeight;
      let author = active[0];
      for (const v of active) {
        r -= v.chattiness;
        if (r <= 0) {
          author = v;
          break;
        }
      }
      const roll = rng.next();
      let text: string;
      const useGuest = guestsOn.length > 0 && rng.chance(0.35);
      const src = useGuest ? guestLib : lib;
      if (roll < 0.015) text = rng.pick(SPAM_COMMENTS);
      else if (roll < 0.15) text = rng.pick(rng.pick(src.questions).variants);
      else if (roll < 0.5) text = rng.pick(src.comments);
      else text = rng.pick(GENERIC_COMMENTS);

      author.commentCount++;
      const flagReason = autoFlagReason(text);
      comments.push({
        id: `${plan.id}-c${comments.length}`,
        viewerId: author.id,
        username: author.username,
        displayName: author.displayName,
        text,
        minute: m,
        timestamp: new Date(start + m * MIN + Math.floor(rng.next() * 59_000)).toISOString(),
        isQuestion: isQuestion(text),
        pinned: false,
        flagged: Boolean(flagReason),
        flagReason,
      });
    }

    const likes = rng.count(concurrent * 0.12 * (topic.likeMod ?? 1) * (guestsOn.length ? 1.25 : 1));
    const shares = rng.count(concurrent * 0.0045 * (topic.likeMod ?? 1));
    const nonFollowers = active.filter((v) => !v.isFollower);
    const followersGained = Math.min(nonFollowers.length, rng.count(nonFollowers.length * 0.0035 * (topic.followMod ?? 1) * guestFollow));
    for (let i = 0; i < followersGained; i++) nonFollowers[i].isFollower = true;
    for (let i = 0; i < Math.min(likes, 400); i++) {
      if (!active.length) break;
      active[rng.int(0, active.length - 1)].likeCount++;
    }

    const cumulativeUnique = viewers.length;
    series.push({
      minute: m,
      timestamp: new Date(start + m * MIN).toISOString(),
      concurrentViewers: concurrent,
      comments: commentCount,
      likes,
      shares,
      followersGained,
      joins: joinCount,
      exits: exitCount,
      cumulativeUniqueViewers: cumulativeUnique,
      engagementRate: concurrent ? round2(((commentCount + likes + shares) / concurrent) * 100) : 0,
      retention: cumulativeUnique ? round2((concurrent / cumulativeUnique) * 100) : 0,
    });
  }

  // Everyone still watching leaves when the broadcast ends.
  if (plan.status === "ended") for (const v of active) v.leftMinute = duration;
  for (const v of viewers) v.watchSeconds = ((v.leftMinute ?? duration) - v.joinedMinute) * 60 + 30;

  comments.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Creator pins a couple of the most useful questions.
  pinFirstMatching(comments, /enter the giveaway|rules|template/i);
  pinFirstMatching(comments, /replay/i);

  const guests: Guest[] = plan.guests.map((g, i) => ({
    id: `${plan.id}-g${i}`,
    username: g.username,
    displayName: g.displayName,
    joinedMinute: g.join,
    leftMinute: g.leave,
  }));

  const sourceEvents: LiveEvent[] = [
    { id: `${plan.id}-e-start`, type: "live_started", minute: 0, timestamp: plan.startedAt.toISOString(), label: "Live started" },
  ];
  for (const g of guests) {
    sourceEvents.push({ id: `${g.id}-join`, type: "guest_joined", minute: g.joinedMinute, timestamp: new Date(start + g.joinedMinute * MIN).toISOString(), label: `@${g.username} joined`, detail: g.displayName });
    sourceEvents.push({ id: `${g.id}-left`, type: "guest_left", minute: g.leftMinute!, timestamp: new Date(start + g.leftMinute! * MIN).toISOString(), label: `@${g.username} left`, detail: g.displayName });
  }
  const endedAt = new Date(start + duration * MIN).toISOString();
  if (plan.status === "ended") {
    sourceEvents.push({ id: `${plan.id}-e-end`, type: "live_ended", minute: duration, timestamp: endedAt, label: "Live ended" });
  }

  return {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    startedAt: plan.startedAt.toISOString(),
    endedAt: plan.status === "ended" ? endedAt : undefined,
    series,
    viewers: viewers.map(stripInternal),
    comments,
    guests,
    topics,
    sourceEvents,
  };
}

function pinFirstMatching(comments: LiveComment[], re: RegExp) {
  const c = comments.find((x) => !x.flagged && re.test(x.text));
  if (c) c.pinned = true;
}

function stripInternal({ chattiness: _c, ...v }: InternalViewer): Viewer {
  return v;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const ALL_TOPICS = Object.keys(TOPIC_LIBRARY).filter((t) => t !== "Guest conversation");

/** Topic behaviour tweaks so insights have real patterns to find. */
const TOPIC_TRAITS: Record<string, Omit<TopicPlan, "topic" | "minutes">> = {
  "Intro & catch-up": { exitMod: 1.1 },
  "Pricing your work": { commentMod: 1.6, followMod: 1.4 },
  "Gear & studio setup": { exitMod: 1.9, commentMod: 0.8, viewerMod: 0.9 },
  "Portfolio reviews": { commentMod: 1.3, viewerMod: 1.05 },
  "Audience Q&A": { commentMod: 1.9 },
  "Building a content system": { exitMod: 1.4, commentMod: 0.9 },
  "Giveaway announcement": { likeMod: 3.2, commentMod: 3, viewerMod: 1.2, followMod: 2.5 },
  "Brand deals & collabs": { commentMod: 1.5, followMod: 1.6, viewerMod: 1.05 },
  "Wrap-up": { exitMod: 1.7 },
};

export function topicPlan(topic: string, minutes: number): TopicPlan {
  return { topic, minutes, ...TOPIC_TRAITS[topic] };
}

export function buildHistoryPlans(now: Date, titles: string[], guestPool: { username: string; displayName: string }[]): LivePlan[] {
  const rng: Rng = createRng(20260923);
  const plans: LivePlan[] = [];
  const day = 24 * 60 * MIN;
  let t = now.getTime() - 3 * day;
  titles.forEach((title, i) => {
    const date = new Date(t);
    // Vary start hour; evenings do best in this demo account.
    const hour = rng.pick([12, 13, 17, 18, 19, 19, 20, 20, 21]);
    date.setHours(hour, rng.pick([0, 0, 30]), 0, 0);
    const dow = date.getDay();
    const timeFactor = (hour >= 19 && hour <= 20 ? 1.3 : hour >= 17 ? 1.05 : 0.8) * (dow === 4 || dow === 0 ? 1.2 : 1);
    const growth = 1 - i * 0.025; // older lives had a smaller audience
    const base = Math.round((280 + rng.next() * 260) * timeFactor * growth);

    const topicCount = rng.int(3, 5);
    const chosen = new Set<string>(["Intro & catch-up"]);
    while (chosen.size < topicCount) chosen.add(rng.pick(ALL_TOPICS.filter((x) => x !== "Wrap-up" && x !== "Intro & catch-up")));
    chosen.add("Wrap-up");
    const topics = [...chosen].map((tp) => topicPlan(tp, tp === "Intro & catch-up" ? rng.int(4, 7) : tp === "Wrap-up" ? rng.int(4, 6) : rng.int(8, 16)));
    const duration = topics.reduce((s, x) => s + x.minutes, 0);

    const guests: GuestPlan[] = [];
    if (rng.chance(0.55)) {
      const g = guestPool[i % guestPool.length];
      const join = rng.int(8, Math.max(9, Math.floor(duration * 0.45)));
      const leave = Math.min(duration - 3, join + rng.int(10, 22));
      const strength = [1.45, 1.15, 1.3, 1.08, 1.25][i % guestPool.length];
      guests.push({ ...g, join, leave, viewerBoost: strength, commentBoost: 1 + (strength - 1) * 1.4, followBoost: 1 + (strength - 1) * 3 });
    }

    plans.push({
      id: `live-${String(titles.length - i).padStart(3, "0")}`,
      title,
      startedAt: date,
      baseViewers: base,
      seed: 1000 + i * 17,
      topics,
      guests,
      status: "ended",
    });
    t -= day * rng.int(4, 9);
  });
  return plans;
}

export function buildCurrentPlan(startedAt: Date): LivePlan {
  return {
    id: "live-current",
    title: "Building a Brand from Zero — Live Q&A with Maya",
    startedAt,
    baseViewers: 760,
    seed: 4242,
    status: "live",
    topics: [
      topicPlan("Intro & catch-up", 6),
      topicPlan("Pricing your work", 14),
      topicPlan("Gear & studio setup", 9),
      { ...topicPlan("Brand deals & collabs", 16) },
      topicPlan("Giveaway announcement", 7),
      topicPlan("Audience Q&A", 18),
      topicPlan("Portfolio reviews", 14),
      topicPlan("Wrap-up", 6),
    ],
    guests: [
      { username: "maya.frames", displayName: "Maya Okafor", join: 31, leave: 52, viewerBoost: 1.42, commentBoost: 1.6, followBoost: 2.4 },
      { username: "theo.makes.type", displayName: "Theo Lindqvist", join: 70, leave: 82, viewerBoost: 1.12, commentBoost: 1.2, followBoost: 1.4 },
    ],
  };
}
