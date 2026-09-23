import type { LiveDelta, LiveSession, LiveSummary, MetricCapability } from "@/types/analytics";
import type { LiveAnalyticsDataSource, Unsubscribe } from "../types";

/**
 * Data source for your own backend — the recommended production setup.
 *
 * The backend is where authorized data is collected and merged:
 *   - Instagram Graph API polling (live_media, comments on the live media)
 *   - Meta webhooks (`live_comments`) received server-side and verified
 *   - Manual imports of in-app Live insights (peak/unique viewers, etc.)
 *   - Approved third-party analytics providers
 * It exposes the domain types in `src/types/analytics.ts` over REST plus a
 * Server-Sent Events stream for live deltas, and reports honestly which
 * metrics it can fill via `/capabilities`.
 *
 * Expected endpoints (relative to `baseUrl`):
 *   GET  /capabilities                    -> MetricCapability[]
 *   GET  /lives/current                   -> LiveSession | 204
 *   GET  /lives/:id                       -> LiveSession
 *   GET  /lives                           -> LiveSummary[]
 *   GET  /lives/:id/stream   (SSE)        -> `data: LiveDelta` events
 *   PUT  /lives/:id/comments/:cid         -> { pinned?, flagged?, flagReason? }
 *   PUT  /lives/:id/clips/:clipId         -> { marked }
 *   GET  /lives/:id/clips/marked          -> string[]
 */
export class HttpBackendDataSource implements LiveAnalyticsDataSource {
  readonly kind = "custom_backend" as const;
  readonly label = "Custom backend";
  private capabilities: MetricCapability[] = [];

  constructor(private baseUrl: string, private getToken?: () => string | undefined) {}

  /** Call once before use so `getCapabilities()` can stay synchronous. */
  async init() {
    this.capabilities = await this.get<MetricCapability[]>("/capabilities");
    return this;
  }

  getCapabilities() {
    return this.capabilities;
  }

  async getCurrentLive() {
    const res = await this.request("/lives/current");
    return res.status === 204 ? null : ((await res.json()) as LiveSession);
  }

  getLive(liveId: string) {
    return this.get<LiveSession>(`/lives/${encodeURIComponent(liveId)}`);
  }

  listPreviousLives() {
    return this.get<LiveSummary[]>("/lives");
  }

  subscribeToLive(liveId: string, onDelta: (d: LiveDelta) => void): Unsubscribe {
    const es = new EventSource(`${this.baseUrl}/lives/${encodeURIComponent(liveId)}/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        onDelta(JSON.parse(e.data) as LiveDelta);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => es.close();
  }

  async setCommentPinned(liveId: string, commentId: string, pinned: boolean) {
    await this.request(`/lives/${liveId}/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ pinned }) });
  }

  async setCommentFlagged(liveId: string, commentId: string, flagged: boolean, reason?: string) {
    await this.request(`/lives/${liveId}/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ flagged, flagReason: reason }) });
  }

  async setClipMarked(liveId: string, clipId: string, marked: boolean) {
    await this.request(`/lives/${liveId}/clips/${clipId}`, { method: "PUT", body: JSON.stringify({ marked }) });
  }

  getMarkedClips(liveId: string) {
    return this.get<string[]>(`/lives/${liveId}/clips/marked`);
  }

  private async request(path: string, init: RequestInit = {}) {
    const token = this.getToken?.();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
    if (!res.ok && res.status !== 204) throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res;
  }

  private async get<T>(path: string) {
    return (await (await this.request(path)).json()) as T;
  }
}
