import type { LiveComment, LiveDelta, LiveSession, LiveSummary } from "@/types/analytics";
import { autoFlagReason, isQuestion } from "@/lib/moderation";
import { META_GRAPH_CAPABILITIES } from "../capabilities";
import type { LiveAnalyticsDataSource, Unsubscribe } from "../types";

/**
 * Direct Instagram Graph API source — a starting point, not production-ready.
 *
 * Only fills what the official API exposes (see `META_GRAPH_CAPABILITIES`):
 * the active live media and its comments. Every other metric is left at 0 and
 * the UI shows it as unavailable. Access tokens must never ship in a browser
 * bundle for real users: run these calls from your backend and use
 * `HttpBackendDataSource` instead. This class exists to document the mapping
 * and for local testing with a short-lived token.
 *
 * Verify endpoint names, fields and required permissions against Meta's
 * current documentation before relying on this.
 */
export class MetaGraphDataSource implements LiveAnalyticsDataSource {
  readonly kind = "meta_graph" as const;
  readonly label = "Instagram Graph API (direct)";

  constructor(
    private igUserId: string,
    private accessToken: string,
    private apiVersion = "v21.0",
  ) {}

  getCapabilities() {
    return META_GRAPH_CAPABILITIES;
  }

  async getCurrentLive(): Promise<LiveSession | null> {
    const res = await this.graph<{ data: { id: string; timestamp?: string; media_product_type?: string }[] }>(
      `/${this.igUserId}/live_media`,
      { fields: "id,media_type,media_product_type,timestamp,username" },
    );
    const media = res.data[0];
    if (!media) return null;
    return this.toSession(media.id, media.timestamp ?? new Date().toISOString(), await this.fetchComments(media.id));
  }

  async getLive(liveId: string): Promise<LiveSession> {
    const current = await this.getCurrentLive();
    if (current?.id === liveId) return current;
    throw new Error("Past Lives are not retrievable from the Graph API. Store them in your backend while the Live is running.");
  }

  async listPreviousLives(): Promise<LiveSummary[]> {
    // No official history endpoint for ended broadcasts' analytics.
    return [];
  }

  subscribeToLive(liveId: string, onDelta: (d: LiveDelta) => void): Unsubscribe {
    // Polling fallback. In production, receive the `live_comments` webhook on
    // your server and forward it to the browser instead.
    const seen = new Set<string>();
    const poll = async () => {
      try {
        const comments = (await this.fetchComments(liveId)).filter((c) => !seen.has(c.id));
        comments.forEach((c) => seen.add(c.id));
        if (comments.length) onDelta({ liveId, comments });
      } catch {
        /* surface via your own error reporting */
      }
    };
    poll();
    const h = window.setInterval(poll, 5000);
    return () => window.clearInterval(h);
  }

  // Creator actions aren't available through the API; keep them locally.
  async setCommentPinned() {}
  async setCommentFlagged() {}
  async setClipMarked() {}
  async getMarkedClips() {
    return [];
  }

  private async fetchComments(mediaId: string): Promise<LiveComment[]> {
    const res = await this.graph<{ data: { id: string; text: string; timestamp: string; username?: string; from?: { id: string; username: string } }[] }>(
      `/${mediaId}/comments`,
      { fields: "id,text,timestamp,username,from" },
    );
    return res.data.map((c) => {
      const username = c.from?.username ?? c.username ?? "unknown";
      const flagReason = autoFlagReason(c.text);
      return {
        id: c.id,
        viewerId: c.from?.id ?? username,
        username,
        displayName: username,
        text: c.text,
        timestamp: c.timestamp,
        minute: 0, // re-bucketed in toSession
        isQuestion: isQuestion(c.text),
        pinned: false,
        flagged: Boolean(flagReason),
        flagReason,
      };
    });
  }

  private toSession(id: string, startedAt: string, comments: LiveComment[]): LiveSession {
    const start = new Date(startedAt).getTime();
    const minutes = Math.max(1, Math.ceil((Date.now() - start) / 60_000));
    for (const c of comments) c.minute = Math.max(0, Math.floor((new Date(c.timestamp).getTime() - start) / 60_000));
    const series = Array.from({ length: minutes }, (_, m) => ({
      minute: m,
      timestamp: new Date(start + m * 60_000).toISOString(),
      // Unsupported by the API — left at 0 and labelled in the UI.
      concurrentViewers: 0,
      likes: 0,
      shares: 0,
      followersGained: 0,
      joins: 0,
      exits: 0,
      cumulativeUniqueViewers: 0,
      engagementRate: 0,
      retention: 0,
      comments: comments.filter((c) => c.minute === m).length,
    }));
    return {
      id,
      title: "Instagram Live",
      status: "live",
      startedAt,
      series,
      viewers: [],
      comments,
      guests: [],
      topics: [],
      sourceEvents: [{ id: `${id}-start`, type: "live_started", minute: 0, timestamp: startedAt, label: "Live started" }],
    };
  }

  private async graph<T>(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams({ ...params, access_token: this.accessToken });
    const res = await fetch(`https://graph.facebook.com/${this.apiVersion}${path}?${qs}`);
    if (!res.ok) throw new Error(`Graph API ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
}
