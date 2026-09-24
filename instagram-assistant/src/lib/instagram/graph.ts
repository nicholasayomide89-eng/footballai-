import { readJson } from "./oauth";

/**
 * The Instagram gateway: the only code in Keel that talks to Meta. Every
 * method maps to one documented Instagram Graph API call. Anything Meta does
 * not offer (follower lists, story stickers, cold DMs) is intentionally
 * absent rather than worked around.
 */

export interface Profile {
  user_id: string;
  username: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export interface Media {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InsightValue {
  name: string;
  period: string;
  values?: Array<{ value: number }>;
  total_value?: { value: number };
}

export interface ConversationSummary {
  id: string;
  updated_time: string;
  participants?: { data: Array<{ id: string; username?: string }> };
}

export interface GraphMessage {
  id: string;
  created_time: string;
  from: { id: string; username?: string };
  to: { data: Array<{ id: string; username?: string }> };
  message?: string;
}

export interface PublishingLimit {
  quota_usage: number;
  config?: { quota_total: number; quota_duration: number };
}

const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

export class GraphClient {
  private readonly base: string;

  constructor(
    private readonly accessToken: string,
    readonly igUserId: string,
    graphVersion: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.base = `https://graph.instagram.com/${graphVersion}`;
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.base}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    // Token in the Authorization header keeps it out of URLs and logs.
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.accessToken}` }, cache: "no-store" });
    return readJson<T>(res);
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return readJson<T>(res);
  }

  profile(): Promise<Profile> {
    return this.get<Profile>("me", {
      fields: "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
    });
  }

  async recentMedia(limit = 12): Promise<Media[]> {
    const r = await this.get<{ data: Media[] }>(`${this.igUserId}/media`, { fields: MEDIA_FIELDS, limit: String(limit) });
    return r.data;
  }

  /** Only Stories that are live right now (posted in the last 24 hours). */
  async liveStories(): Promise<Media[]> {
    const r = await this.get<{ data: Media[] }>(`${this.igUserId}/stories`, { fields: MEDIA_FIELDS });
    return r.data;
  }

  /**
   * Per-media insights. Metric names change between API versions, so the
   * caller passes the list and handles a rejected metric gracefully.
   */
  async mediaInsights(mediaId: string, metrics: string[]): Promise<InsightValue[]> {
    const r = await this.get<{ data: InsightValue[] }>(`${mediaId}/insights`, { metric: metrics.join(",") });
    return r.data;
  }

  async conversations(limit = 25): Promise<ConversationSummary[]> {
    const r = await this.get<{ data: ConversationSummary[] }>("me/conversations", {
      platform: "instagram",
      fields: "id,updated_time,participants",
      limit: String(limit),
    });
    return r.data;
  }

  async conversationMessages(conversationId: string): Promise<GraphMessage[]> {
    const r = await this.get<{ messages?: { data: GraphMessage[] } }>(conversationId, {
      fields: "messages{id,created_time,from,to,message}",
    });
    return r.messages?.data ?? [];
  }

  /** Send a text DM. Instagram only accepts this within 24h of the person's last message. */
  sendText(recipientIgsid: string, text: string): Promise<{ recipient_id: string; message_id: string }> {
    return this.post(`${this.igUserId}/messages`, { recipient: { id: recipientIgsid }, message: { text } });
  }

  publishingLimit(): Promise<PublishingLimit> {
    return this.get<{ data: PublishingLimit[] }>(`${this.igUserId}/content_publishing_limit`, {
      fields: "quota_usage,config",
    }).then((r) => r.data[0] ?? { quota_usage: 0 });
  }

  /**
   * Publish a photo or video Story. Instagram fetches the media from
   * `mediaUrl`, so it must be publicly reachable (Keel uses a short-lived
   * presigned URL). Stickers, music and links can't be added through the API.
   */
  async publishStory(mediaUrl: string, kind: "image" | "video", opts: { pollMs?: number; timeoutMs?: number } = {}): Promise<string> {
    const container = await this.post<{ id: string }>(`${this.igUserId}/media`, {
      media_type: "STORIES",
      ...(kind === "image" ? { image_url: mediaUrl } : { video_url: mediaUrl }),
    });
    await this.waitForContainer(container.id, opts.pollMs ?? 3000, opts.timeoutMs ?? 120_000);
    const published = await this.post<{ id: string }>(`${this.igUserId}/media_publish`, { creation_id: container.id });
    return published.id;
  }

  private async waitForContainer(id: string, pollMs: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const s = await this.get<{ status_code?: string; status?: string }>(id, { fields: "status_code,status" });
      if (s.status_code === "FINISHED" || s.status_code === "PUBLISHED") return;
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
        throw new Error(`Instagram could not process the media: ${s.status ?? s.status_code}`);
      }
      if (Date.now() > deadline) throw new Error("Timed out waiting for Instagram to process the media");
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  /** Subscribe this account to message webhooks for the app. */
  subscribeWebhooks(fields: string[] = ["messages"]): Promise<{ success: boolean }> {
    const url = `me/subscribed_apps?subscribed_fields=${encodeURIComponent(fields.join(","))}`;
    return this.post(url, {});
  }
}
