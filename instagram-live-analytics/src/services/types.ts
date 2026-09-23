import type {
  DataSourceKind,
  LiveDelta,
  LiveSession,
  LiveSummary,
  MetricCapability,
} from "@/types/analytics";

export type Unsubscribe = () => void;

/**
 * The contract every data source implements. Components and hooks only ever
 * talk to this interface (via `getDataService()`), so the mock source can be
 * swapped for the Meta Graph API, a webhook relay, an approved third-party
 * analytics provider or a custom backend without touching UI code.
 */
export interface LiveAnalyticsDataSource {
  readonly kind: DataSourceKind;
  readonly label: string;

  /** Which metrics this source can actually provide, and how. */
  getCapabilities(): MetricCapability[];

  /** The Live currently broadcasting, if any. */
  getCurrentLive(): Promise<LiveSession | null>;

  /** Full data for one Live (current or past). */
  getLive(liveId: string): Promise<LiveSession>;

  /** Summaries of previous Lives, newest first. */
  listPreviousLives(): Promise<LiveSummary[]>;

  /** Push incremental updates for a running Live. */
  subscribeToLive(liveId: string, onDelta: (delta: LiveDelta) => void): Unsubscribe;

  // Creator actions ----------------------------------------------------------
  setCommentPinned(liveId: string, commentId: string, pinned: boolean): Promise<void>;
  setCommentFlagged(liveId: string, commentId: string, flagged: boolean, reason?: string): Promise<void>;
  setClipMarked(liveId: string, clipId: string, marked: boolean): Promise<void>;
  getMarkedClips(liveId: string): Promise<string[]>;
}
