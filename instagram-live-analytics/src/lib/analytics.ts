/**
 * Pure, source-agnostic analytics. Everything here works on the domain types
 * only, so the same calculations run whether data comes from the mock source,
 * Meta's APIs, webhooks or a custom backend.
 */
import type {
  ClipOpportunity,
  CommenterStat,
  EngagementMoment,
  GuestAnalytics,
  LiveComment,
  LiveEvent,
  LiveOverviewStats,
  LiveSession,
  LiveSummary,
  MinutePoint,
  MomentType,
  QuestionCluster,
} from "@/types/analytics";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function lastMinute(session: LiveSession) {
  return session.series.length ? session.series[session.series.length - 1].minute : 0;
}

export function computeOverview(session: LiveSession, liveViewers?: number, now: number = Date.now()): LiveOverviewStats {
  const s = session.series;
  const peak = s.reduce((best, p) => (p.concurrentViewers > best.concurrentViewers ? p : best), s[0] ?? ({ concurrentViewers: 0, minute: 0 } as MinutePoint));
  const totalWatchSeconds = sum(s.map((p) => p.concurrentViewers * 60));
  const unique = s.length ? s[s.length - 1].cumulativeUniqueViewers : 0;
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now;
  const totals = {
    comments: sum(s.map((p) => p.comments)),
    likes: sum(s.map((p) => p.likes)),
    shares: sum(s.map((p) => p.shares)),
  };
  const avgViewers = mean(s.map((p) => p.concurrentViewers));
  return {
    status: session.status,
    title: session.title,
    startedAt: session.startedAt,
    durationSeconds: Math.max(0, Math.round((end - start) / 1000)),
    currentViewers: session.status === "live" ? liveViewers ?? s[s.length - 1]?.concurrentViewers ?? 0 : 0,
    peakViewers: peak.concurrentViewers,
    peakMinute: peak.minute,
    uniqueViewers: unique,
    totalComments: totals.comments,
    totalLikes: totals.likes,
    totalShares: totals.shares,
    followersGained: sum(s.map((p) => p.followersGained)),
    avgWatchSeconds: unique ? Math.round(totalWatchSeconds / unique) : 0,
    totalWatchSeconds,
    avgViewers: Math.round(avgViewers),
    engagementRate: s.length ? round1(mean(s.map((p) => p.engagementRate))) : 0,
    avgRetention: round1(mean(s.map((p) => p.retention))),
  };
}

export function summarize(session: LiveSession): LiveSummary {
  const o = computeOverview(session);
  return {
    id: session.id,
    title: session.title,
    startedAt: session.startedAt,
    durationMinutes: session.series.length,
    totalViewers: o.uniqueViewers,
    peakViewers: o.peakViewers,
    avgViewers: o.avgViewers,
    comments: o.totalComments,
    likes: o.totalLikes,
    shares: o.totalShares,
    newFollowers: o.followersGained,
    avgWatchSeconds: o.avgWatchSeconds,
    totalWatchSeconds: o.totalWatchSeconds,
    engagementRate: o.engagementRate,
    avgRetention: o.avgRetention,
    guestNames: session.guests.map((g) => g.username),
    topics: session.topics.map((t) => t.topic),
  };
}

// ---------------------------------------------------------------------------
// Engagement moments
// ---------------------------------------------------------------------------

const METRIC_FOR: Record<Exclude<MomentType, "guest_joined" | "discussion_started">, keyof MinutePoint> = {
  viewer_surge: "concurrentViewers",
  comment_surge: "comments",
  like_surge: "likes",
  follower_surge: "followersGained",
};

const MOMENT_COPY: Record<MomentType, string> = {
  viewer_surge: "Viewer surge",
  comment_surge: "Comment spike",
  like_surge: "Likes spike",
  follower_surge: "Follower spike",
  guest_joined: "Guest joined",
  discussion_started: "Big question",
};

/**
 * Flags minutes where a metric jumps well above its trailing baseline.
 * Baseline = mean of the previous `window` minutes; a spike requires both a
 * relative jump (`minPct`) and a z-score above `minZ` so noise isn't flagged.
 */
export function detectMoments(session: LiveSession, opts = { window: 6, minPct: 35, minZ: 2 }): EngagementMoment[] {
  const s = session.series;
  const moments: EngagementMoment[] = [];
  const topicAt = (m: number) => session.topics.find((t) => m >= t.startMinute && m <= t.endMinute)?.topic;

  (Object.keys(METRIC_FOR) as (keyof typeof METRIC_FOR)[]).forEach((type) => {
    const key = METRIC_FOR[type];
    let cooldownUntil = -1;
    // Skip the opening minutes: the audience ramping up isn't a "moment".
    for (let i = Math.max(opts.window, type === "viewer_surge" ? 12 : 8); i < s.length; i++) {
      if (i <= cooldownUntil) continue;
      const prev = s.slice(i - opts.window, i).map((p) => p[key] as number);
      const base = mean(prev);
      const sd = Math.sqrt(mean(prev.map((x) => (x - base) ** 2))) || 1;
      // Viewer counts move slowly — compare against the window's start instead.
      const current = s[i][key] as number;
      const ref = type === "viewer_surge" ? prev[0] : base;
      const changePct = ref > 0 ? ((current - ref) / ref) * 100 : 0;
      const z = (current - base) / sd;
      const minPct = type === "viewer_surge" ? 18 : opts.minPct;
      const minAbs = type === "follower_surge" ? 3 : type === "viewer_surge" ? 25 : 5;
      if (changePct >= minPct && (type === "viewer_surge" || z >= opts.minZ) && current - ref >= minAbs) {
        // Extend while elevated
        let end = i;
        while (end + 1 < s.length && (s[end + 1][key] as number) >= ref * (1 + minPct / 200)) end++;
        const topic = topicAt(i);
        moments.push({
          id: `${session.id}-${type}-${i}`,
          type,
          startMinute: i,
          endMinute: Math.min(end, i + 8),
          timestamp: s[i].timestamp,
          title: MOMENT_COPY[type],
          description: `${labelFor(type)} rose ${Math.round(changePct)}% vs. the previous ${opts.window} minutes${topic ? ` during “${topic}”` : ""}.`,
          viewers: s[i].concurrentViewers,
          changePct: Math.round(changePct),
          score: 0,
          isClipOpportunity: false,
        });
        cooldownUntil = end + 3;
      }
    }
  });

  // Guests
  for (const g of session.guests) {
    if (g.joinedMinute >= s.length) continue;
    const before = s[Math.max(0, g.joinedMinute - 1)]?.concurrentViewers ?? 0;
    const window = s.slice(g.joinedMinute, Math.min(s.length, g.joinedMinute + 6));
    const after = Math.max(...window.map((p) => p.concurrentViewers), before);
    const changePct = before ? Math.round(((after - before) / before) * 100) : 0;
    moments.push({
      id: `${session.id}-guest-${g.id}`,
      type: "guest_joined",
      startMinute: g.joinedMinute,
      endMinute: Math.min(g.leftMinute ?? s.length - 1, g.joinedMinute + 5),
      timestamp: s[g.joinedMinute].timestamp,
      title: `@${g.username} joined`,
      description: `${g.displayName} joined as a guest. Viewers went from ${before} to ${after} within 5 minutes.`,
      viewers: s[g.joinedMinute].concurrentViewers,
      changePct,
      score: 0,
      isClipOpportunity: false,
    });
  }

  // Major questions / discussions
  const { clusters, byComment } = clusterQuestionsIndexed(session.comments);
  const totalQuestions = clusters.reduce((a, q) => a + q.count, 0);
  const seenMinutes = new Set<number>();
  for (const q of clusters.slice(0, 4)) {
    if (q.count < Math.max(6, totalQuestions * 0.05)) continue;
    // Find the minute of densest asking
    const perMinute = new Map<number, number>();
    for (const c of session.comments) if (byComment.get(c.id) === q.id) perMinute.set(c.minute, (perMinute.get(c.minute) ?? 0) + 1);
    const [minute, n] = [...perMinute.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n < 3 || minute >= s.length || seenMinutes.has(minute)) continue;
    seenMinutes.add(minute);
    moments.push({
      id: `${session.id}-q-${q.id}`,
      type: "discussion_started",
      startMinute: minute,
      endMinute: Math.min(s.length - 1, minute + 3),
      timestamp: s[minute].timestamp,
      title: MOMENT_COPY.discussion_started,
      description: `“${q.canonical}” was asked ${q.count} times by ${q.askers} viewers.`,
      viewers: s[minute].concurrentViewers,
      changePct: 0,
      score: 0,
      isClipOpportunity: false,
    });
  }

  // Score: engagement intensity around the moment, relative to the Live average.
  const avgEng = mean(s.map((p) => p.engagementRate)) || 1;
  const avgViewers = mean(s.map((p) => p.concurrentViewers)) || 1;
  const overlapBonus = (m: EngagementMoment) =>
    moments.filter((o) => o !== m && Math.abs(o.startMinute - m.startMinute) <= 2).length;
  for (const m of moments) {
    const win = s.slice(m.startMinute, m.endMinute + 1);
    const eng = mean(win.map((p) => p.engagementRate)) / avgEng;
    const vw = mean(win.map((p) => p.concurrentViewers)) / avgViewers;
    const raw = eng * 28 + vw * 22 + Math.min(m.changePct, 200) / 10 + overlapBonus(m) * 6 + (m.type === "guest_joined" ? 8 : 0);
    m.score = Math.max(0, Math.min(100, Math.round(raw)));
  }
  const sorted = [...moments].sort((a, b) => b.score - a.score);
  const threshold = sorted[Math.min(sorted.length - 1, 8)]?.score ?? 100;
  for (const m of moments) m.isClipOpportunity = m.score >= Math.max(threshold, 55);

  return moments.sort((a, b) => a.startMinute - b.startMinute);
}

function labelFor(type: MomentType) {
  return { viewer_surge: "Concurrent viewers", comment_surge: "Comments per minute", like_surge: "Likes per minute", follower_surge: "New followers per minute", guest_joined: "Viewers", discussion_started: "Questions" }[type];
}

// ---------------------------------------------------------------------------
// Clip suggestions
// ---------------------------------------------------------------------------

/**
 * Turns high-scoring moments into clip suggestions. Titles and captions here
 * are template-generated placeholders; a production build would call an LLM
 * and keep `suggestionSource: "ai_generated"` so the UI labels them as such.
 */
export function buildClipOpportunities(session: LiveSession, moments: EngagementMoment[], marked: Set<string>): ClipOpportunity[] {
  const topicAt = (m: number) => session.topics.find((t) => m >= t.startMinute && m <= t.endMinute)?.topic ?? "the Live";
  // Overlapping moments (e.g. a guest joins and comments + follows spike
  // together) become one clip, keeping the highest-scoring description.
  const picked: EngagementMoment[] = [];
  for (const m of moments.filter((x) => x.isClipOpportunity).sort((a, b) => b.score - a.score)) {
    if (!picked.some((p) => Math.abs(p.startMinute - m.startMinute) <= 3)) picked.push(m);
  }
  return picked
    .map((m) => {
      const topic = topicAt(m.startMinute);
      const lead = Math.max(0, m.startMinute - 1);
      const length = Math.min(90, Math.max(20, (m.endMinute - lead + 1) * 15));
      const guest = session.guests.find((g) => m.startMinute >= g.joinedMinute && m.startMinute <= (g.leftMinute ?? Infinity));
      const id = `clip-${m.id}`;
      return {
        id,
        momentId: m.id,
        startMinute: lead,
        endMinute: m.endMinute,
        timestamp: session.series[lead]?.timestamp ?? m.timestamp,
        whatHappened: m.description,
        viewerCount: m.viewers,
        engagementSpikePct: m.changePct,
        estimatedLengthSeconds: length,
        suggestedTitle: suggestTitle(m.type, topic, guest?.displayName),
        suggestedCaption: suggestCaption(m.type, topic, guest?.username),
        suggestionSource: "template",
        score: m.score,
        marked: marked.has(id),
      } satisfies ClipOpportunity;
    });
}

function suggestTitle(type: MomentType, topic: string, guest?: string) {
  switch (type) {
    case "guest_joined": return guest ? `${guest} drops in — and chat explodes` : "Surprise guest moment";
    case "discussion_started": return `The question everyone asked about ${topic.toLowerCase()}`;
    case "follower_surge": return `The ${topic.toLowerCase()} tip that won new followers`;
    case "like_surge": return `${topic}: the moment the hearts took over`;
    case "comment_surge": return `Chat couldn’t keep up: ${topic.toLowerCase()}`;
    default: return `Why everyone tuned in for ${topic.toLowerCase()}`;
  }
}

function suggestCaption(type: MomentType, topic: string, guest?: string) {
  const tag = topic.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => w && !["your", "the", "and", "a", "of"].includes(w)).slice(0, 2).join("");
  const base = {
    guest_joined: `When ${guest ? "@" + guest : "our guest"} joined, everything changed 👀 Full Live replay on my profile.`,
    discussion_started: `You asked, I answered 🙌 The most-asked question from last night's Live.`,
    follower_surge: `This one tip had people hitting follow mid-Live. Save it for later 📌`,
    like_surge: `The moment the hearts went wild ❤️ Were you there?`,
    comment_surge: `Chat went off during this part 💬 What would you add?`,
    viewer_surge: `Everyone showed up for this bit. Here's why 👇`,
  }[type];
  return `${base} #${tag || "live"} #creatortips #instagramlive`;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

const STOP = new Set(["as", "out", "did", "get", "guys", "two", "each", "other", "small", "creator", "the", "a", "an", "is", "are", "you", "do", "does", "what", "how", "which", "that", "this", "to", "for", "of", "i", "your", "using", "use", "can", "will", "be", "it", "please", "should", "we", "guys", "there", "my", "me", "is", "s", "on", "after", "in", "and", "or", "next", "at", "look"]);

const SYNONYMS: Record<string, string> = { know: "meet", microphone: "mic", charge: "price", rates: "price", logos: "logo", reach: "pitch", land: "first", find: "first", when: "", "when's": "", enter: "giveaway", rules: "giveaway" };

function normalizeQ(text: string) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .map((t) => SYNONYMS[t] ?? t)
    .filter((t) => t && !STOP.has(t));
  return { tokens: new Set(tokens), key: [...new Set(tokens)].sort().join("-") };
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  a.forEach((x) => b.has(x) && inter++);
  return inter / (a.size + b.size - inter || 1);
};

/** Groups near-duplicate questions (e.g. "what mic is that?" / "which microphone do you use?"). */
export function clusterQuestionsIndexed(comments: LiveComment[]) {
  type Working = QuestionCluster & { variants: Set<string>[]; askerSet: Set<string> };
  const clusters: Working[] = [];
  const byComment = new Map<string, string>();
  for (const c of comments) {
    if (!c.isQuestion || c.flagged) continue;
    const n = normalizeQ(c.text);
    if (!n.tokens.size) continue;
    // Match against any wording already seen in a cluster, not just the first.
    let cl = clusters.find((x) => x.variants.some((v) => jaccard(v, n.tokens) >= 0.5));
    if (!cl) {
      cl = { id: n.key, canonical: c.text, count: 0, askers: 0, firstMinute: c.minute, lastMinute: c.minute, examples: [], variants: [], askerSet: new Set() };
      clusters.push(cl);
    }
    if (cl.variants.length < 8 && !cl.variants.some((v) => jaccard(v, n.tokens) === 1)) cl.variants.push(n.tokens);
    byComment.set(c.id, cl.id);
    cl.count++;
    cl.askerSet.add(c.viewerId);
    cl.lastMinute = Math.max(cl.lastMinute, c.minute);
    if (cl.examples.length < 4 && !cl.examples.includes(c.text)) cl.examples.push(c.text);
  }
  const result: QuestionCluster[] = clusters
    .map(({ variants: _v, askerSet, ...rest }) => ({ ...rest, askers: askerSet.size }))
    .sort((a, b) => b.count - a.count);
  return { clusters: result, byComment };
}

export function clusterQuestions(comments: LiveComment[]) {
  return clusterQuestionsIndexed(comments).clusters;
}

export function commenterStats(session: LiveSession): CommenterStat[] {
  const byViewer = new Map<string, CommenterStat>();
  const viewerIdx = new Map(session.viewers.map((v) => [v.id, v]));
  for (const c of session.comments) {
    let s = byViewer.get(c.viewerId);
    if (!s) {
      s = { viewerId: c.viewerId, username: c.username, displayName: c.displayName, avatarUrl: c.avatarUrl, comments: 0, questions: 0, firstMinute: c.minute, lastMinute: c.minute, isReturning: viewerIdx.get(c.viewerId)?.isReturning ?? false };
      byViewer.set(c.viewerId, s);
    }
    s.comments++;
    if (c.isQuestion) s.questions++;
    s.lastMinute = Math.max(s.lastMinute, c.minute);
  }
  return [...byViewer.values()].sort((a, b) => b.comments - a.comments);
}

export function keywordCounts(comments: LiveComment[], keywords: string[]) {
  return keywords
    .map((k) => {
      const re = new RegExp(`\\b${escapeRe(k)}`, "i");
      return { keyword: k, count: comments.filter((c) => re.test(c.text)).length };
    })
    .sort((a, b) => b.count - a.count);
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export function guestAnalytics(session: LiveSession): GuestAnalytics[] {
  const s = session.series;
  return session.guests
    .filter((g) => g.joinedMinute < s.length)
    .map((guest) => {
      const pre = s.slice(Math.max(0, guest.joinedMinute - 5), guest.joinedMinute);
      const during = s.slice(guest.joinedMinute, Math.min(s.length, (guest.leftMinute ?? s.length) + 1));
      const viewersBefore = pre.length ? pre[pre.length - 1].concurrentViewers : 0;
      const peakDuring = Math.max(0, ...during.map((p) => p.concurrentViewers));
      const cpmBefore = mean(pre.map((p) => p.comments));
      const cpmDuring = mean(during.map((p) => p.comments));
      const engBefore = mean(pre.map((p) => p.engagementRate));
      const engDuring = mean(during.map((p) => p.engagementRate));
      return {
        guest,
        viewersBefore,
        peakDuring,
        avgViewersDuring: Math.round(mean(during.map((p) => p.concurrentViewers))),
        commentsDuring: sum(during.map((p) => p.comments)),
        commentsPerMinuteDuring: round1(cpmDuring),
        commentsPerMinuteBefore: round1(cpmBefore),
        followersDuring: sum(during.map((p) => p.followersGained)),
        engagementRateDuring: round1(engDuring),
        engagementRateBefore: round1(engBefore),
        engagementChange: round1(engDuring - engBefore),
        viewerChangePct: viewersBefore ? Math.round(((peakDuring - viewersBefore) / viewersBefore) * 100) : 0,
      };
    });
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const MILESTONES = [100, 250, 500, 750, 1000, 1500, 2000, 5000, 10000];

export function buildTimeline(session: LiveSession, moments: EngagementMoment[]): LiveEvent[] {
  const events: LiveEvent[] = [...session.sourceEvents.filter((e) => e.minute <= lastMinute(session) + 1 || e.type === "live_ended")];
  let nextIdx = 0;
  for (const p of session.series) {
    while (nextIdx < MILESTONES.length && p.concurrentViewers >= MILESTONES[nextIdx]) {
      events.push({ id: `${session.id}-ms-${MILESTONES[nextIdx]}`, type: "viewer_milestone", minute: p.minute, timestamp: p.timestamp, label: `${MILESTONES[nextIdx].toLocaleString()} viewers`, detail: "Concurrent viewer milestone" });
      nextIdx++;
    }
  }
  const map: Partial<Record<MomentType, LiveEvent["type"]>> = {
    comment_surge: "comment_spike",
    like_surge: "engagement_spike",
    viewer_surge: "engagement_spike",
    follower_surge: "follower_spike",
    discussion_started: "question_spike",
  };
  for (const m of moments) {
    const type = map[m.type];
    if (!type) continue;
    events.push({ id: `ev-${m.id}`, type, minute: m.startMinute, timestamp: m.timestamp, label: m.title, detail: m.description });
  }
  return events.sort((a, b) => a.minute - b.minute || order(a.type) - order(b.type));
}

const order = (t: LiveEvent["type"]) => (t === "live_started" ? -1 : t === "live_ended" ? 99 : 0);

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

export function audienceBreakdown(session: LiveSession) {
  const current = lastMinute(session);
  const watching = session.viewers.filter((v) => v.leftMinute === null);
  const returning = session.viewers.filter((v) => v.isReturning).length;
  const watchSeconds = (v: LiveSession["viewers"][number]) => ((v.leftMinute ?? current + 1) - v.joinedMinute) * 60;
  const mostActive = [...session.viewers]
    .map((v) => ({ viewer: v, watchSeconds: watchSeconds(v), activity: v.commentCount * 5 + v.likeCount }))
    .sort((a, b) => b.activity - a.activity)
    .slice(0, 8);
  return {
    total: session.viewers.length,
    watchingNow: watching.length,
    returning,
    newViewers: session.viewers.length - returning,
    followers: session.viewers.filter((v) => v.isFollower).length,
    mostActive,
  };
}
