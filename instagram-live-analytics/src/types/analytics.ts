/**
 * Core analytics domain types.
 *
 * Every component consumes these shapes — never a raw API payload. Data
 * sources (mock, Meta Graph API, webhooks, third-party, custom backend)
 * are responsible for mapping their responses into these types.
 */

// ---------------------------------------------------------------------------
// Data provenance
// ---------------------------------------------------------------------------

/**
 * Where a metric's value comes from. Used to label every metric in the UI so
 * nothing implies an official API provides data it does not.
 */
export type MetricAvailability =
  | "official_api" // Returned by an official Meta/Instagram endpoint
  | "webhook" // Delivered by an official Meta webhook subscription
  | "estimated" // Derived/approximated from other available data
  | "manual_import" // Creator exports/enters it (e.g. from in-app Live insights)
  | "third_party" // Requires an approved third-party analytics provider
  | "unsupported"; // No known authorized source; shown only in demo mode

export type MetricKey =
  | "liveStatus"
  | "liveTitle"
  | "startTime"
  | "duration"
  | "currentViewers"
  | "peakViewers"
  | "uniqueViewers"
  | "comments"
  | "likes"
  | "shares"
  | "followersGained"
  | "avgWatchTime"
  | "totalWatchTime"
  | "viewerIdentities"
  | "joinsExits"
  | "returningViewers"
  | "guests"
  | "retention"
  | "engagementRate";

export interface MetricCapability {
  key: MetricKey;
  label: string;
  availability: MetricAvailability;
  /** Human explanation of the source and its limits. */
  note: string;
}

export type DataSourceKind = "mock" | "meta_graph" | "webhook" | "third_party" | "custom_backend";

// ---------------------------------------------------------------------------
// Live session
// ---------------------------------------------------------------------------

export type LiveStatus = "live" | "ended" | "scheduled";

/** One-minute aggregate bucket of a Live broadcast. */
export interface MinutePoint {
  /** Minutes since the Live started (0-based). */
  minute: number;
  /** ISO timestamp of the bucket start. */
  timestamp: string;
  concurrentViewers: number;
  comments: number;
  likes: number;
  shares: number;
  followersGained: number;
  joins: number;
  exits: number;
  /** Cumulative unique viewers up to and including this minute. */
  cumulativeUniqueViewers: number;
  /** (comments + likes + shares) / concurrentViewers × 100 */
  engagementRate: number;
  /** % of everyone who has joined so far that is still watching. */
  retention: number;
}

export interface Viewer {
  id: string;
  username: string;
  displayName: string;
  /** Optional remote avatar; UI falls back to generated initials. */
  avatarUrl?: string;
  isFollower: boolean;
  /** Watched at least one previous Live from this creator. */
  isReturning: boolean;
  joinedMinute: number;
  /** null while still watching. */
  leftMinute: number | null;
  commentCount: number;
  likeCount: number;
  watchSeconds: number;
}

export interface LiveComment {
  id: string;
  viewerId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  timestamp: string;
  minute: number;
  isQuestion: boolean;
  pinned: boolean;
  flagged: boolean;
  flagReason?: string;
}

export interface Guest {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  joinedMinute: number;
  /** null while the guest is still on screen. */
  leftMinute: number | null;
}

/** A content segment of the Live (used for topic insights). */
export interface TopicSegment {
  topic: string;
  startMinute: number;
  endMinute: number;
}

export type LiveEventType =
  | "live_started"
  | "viewer_milestone"
  | "guest_joined"
  | "guest_left"
  | "engagement_spike"
  | "comment_spike"
  | "follower_spike"
  | "question_spike"
  | "live_ended";

export interface LiveEvent {
  id: string;
  type: LiveEventType;
  minute: number;
  timestamp: string;
  label: string;
  detail?: string;
}

export interface LiveSession {
  id: string;
  title: string;
  status: LiveStatus;
  startedAt: string;
  /** ISO end time, if ended. */
  endedAt?: string;
  series: MinutePoint[];
  viewers: Viewer[];
  comments: LiveComment[];
  guests: Guest[];
  topics: TopicSegment[];
  /** Events reported by the source itself (start/end/guest). Spikes are detected client-side. */
  sourceEvents: LiveEvent[];
}

// ---------------------------------------------------------------------------
// Derived analytics
// ---------------------------------------------------------------------------

export interface LiveOverviewStats {
  status: LiveStatus;
  title: string;
  startedAt: string;
  durationSeconds: number;
  currentViewers: number;
  peakViewers: number;
  peakMinute: number;
  uniqueViewers: number;
  totalComments: number;
  totalLikes: number;
  totalShares: number;
  followersGained: number;
  avgWatchSeconds: number;
  totalWatchSeconds: number;
  avgViewers: number;
  engagementRate: number;
  avgRetention: number;
}

export type MomentType =
  | "viewer_surge"
  | "comment_surge"
  | "like_surge"
  | "follower_surge"
  | "guest_joined"
  | "discussion_started";

export interface EngagementMoment {
  id: string;
  type: MomentType;
  startMinute: number;
  endMinute: number;
  timestamp: string;
  title: string;
  description: string;
  viewers: number;
  /** % increase vs. rolling baseline. */
  changePct: number;
  /** 0–100 composite score used to rank clip opportunities. */
  score: number;
  isClipOpportunity: boolean;
}

export interface ClipOpportunity {
  id: string;
  momentId: string;
  startMinute: number;
  endMinute: number;
  timestamp: string;
  whatHappened: string;
  viewerCount: number;
  engagementSpikePct: number;
  estimatedLengthSeconds: number;
  suggestedTitle: string;
  suggestedCaption: string;
  /** Titles/captions are generated suggestions, not measured data. */
  suggestionSource: "ai_generated" | "template";
  score: number;
  marked: boolean;
}

export interface GuestAnalytics {
  guest: Guest;
  viewersBefore: number;
  peakDuring: number;
  avgViewersDuring: number;
  commentsDuring: number;
  commentsPerMinuteDuring: number;
  commentsPerMinuteBefore: number;
  followersDuring: number;
  engagementRateDuring: number;
  engagementRateBefore: number;
  /** Percentage-point change in engagement rate vs. before the guest joined. */
  engagementChange: number;
  viewerChangePct: number;
}

export interface QuestionCluster {
  id: string;
  canonical: string;
  count: number;
  askers: number;
  firstMinute: number;
  lastMinute: number;
  examples: string[];
}

export interface CommenterStat {
  viewerId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  comments: number;
  questions: number;
  firstMinute: number;
  lastMinute: number;
  isReturning: boolean;
}

// ---------------------------------------------------------------------------
// History & comparison
// ---------------------------------------------------------------------------

export interface LiveSummary {
  id: string;
  title: string;
  startedAt: string;
  durationMinutes: number;
  totalViewers: number;
  peakViewers: number;
  avgViewers: number;
  comments: number;
  likes: number;
  shares: number;
  newFollowers: number;
  avgWatchSeconds: number;
  totalWatchSeconds: number;
  engagementRate: number;
  avgRetention: number;
  guestNames: string[];
  topics: string[];
}

export interface InsightItem {
  id: string;
  title: string;
  value: string;
  detail: string;
  /** "calculated" = computed from data; "ai" = generated recommendation. */
  kind: "calculated" | "ai";
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/** Incremental update pushed by a live subscription. */
export interface LiveDelta {
  liveId: string;
  point?: MinutePoint;
  /** Current viewers within the running minute (sub-minute resolution). */
  currentViewers?: number;
  comments?: LiveComment[];
  viewersUpserted?: Viewer[];
  events?: LiveEvent[];
  guestsUpserted?: Guest[];
  status?: LiveStatus;
  endedAt?: string;
  /** Source clock, so durations stay consistent with the data (and with accelerated demo playback). */
  serverTime?: string;
}
