import type { MetricAvailability, MetricCapability } from "@/types/analytics";

/**
 * What an official Meta/Instagram integration can realistically provide for
 * Lives on an Instagram professional account.
 *
 * Based on the Instagram Graph API's documented Live surface: the
 * `live_media` edge (the active broadcast and its basic fields), reading
 * comments on the live media during the broadcast, and the `live_comments`
 * webhook field. Account-level insights such as `follower_count` are only
 * available at daily granularity. Viewer counts, viewer identities,
 * reactions, shares, watch time and guest data for Lives are not exposed.
 *
 * Meta changes these APIs regularly — re-verify against the current Graph API
 * docs before enabling a production data source, and update this table.
 */
export const META_GRAPH_CAPABILITIES: MetricCapability[] = [
  { key: "liveStatus", label: "Live status", availability: "official_api", note: "live_media edge returns the active broadcast while you are live." },
  { key: "liveTitle", label: "Live title", availability: "manual_import", note: "Not reliably exposed on live media; enter it in the dashboard or import it." },
  { key: "startTime", label: "Start time", availability: "official_api", note: "Media timestamp from the live_media edge." },
  { key: "duration", label: "Duration", availability: "estimated", note: "Computed from start time and when the broadcast stops appearing on live_media." },
  { key: "comments", label: "Comments", availability: "webhook", note: "live_comments webhook, or polling comments on the live media during the broadcast." },
  { key: "currentViewers", label: "Current viewers", availability: "unsupported", note: "No official endpoint. Requires manual import from in-app Live insights." },
  { key: "peakViewers", label: "Peak viewers", availability: "manual_import", note: "Shown in the Instagram app after the Live; import it manually." },
  { key: "uniqueViewers", label: "Unique viewers", availability: "manual_import", note: "Available in in-app insights only; import it manually." },
  { key: "likes", label: "Likes / reactions", availability: "unsupported", note: "Live hearts/reactions are not available through the Graph API." },
  { key: "shares", label: "Shares", availability: "unsupported", note: "Not available for Live broadcasts." },
  { key: "followersGained", label: "Followers gained", availability: "estimated", note: "Estimated from account follower_count changes (daily granularity) — not attributable per minute." },
  { key: "avgWatchTime", label: "Average watch time", availability: "unsupported", note: "No official source. Requires an authorized third-party provider or manual import." },
  { key: "totalWatchTime", label: "Total watch time", availability: "unsupported", note: "No official source." },
  { key: "viewerIdentities", label: "Viewer list", availability: "unsupported", note: "Individual viewers are not exposed. Commenter identities are available via comments." },
  { key: "joinsExits", label: "Viewer joins & exits", availability: "unsupported", note: "Not exposed by any official endpoint." },
  { key: "returningViewers", label: "Returning viewers", availability: "estimated", note: "Can be estimated only for commenters (people who commented in a previous Live)." },
  { key: "guests", label: "Guests", availability: "manual_import", note: "Guest joins/leaves are not exposed; log them manually or import from a recording." },
  { key: "retention", label: "Viewer retention", availability: "unsupported", note: "Requires per-viewer presence data, which is not available." },
  { key: "engagementRate", label: "Engagement rate", availability: "estimated", note: "Derived; accuracy depends on the viewer and reaction sources above." },
];

export const AVAILABILITY_META: Record<
  MetricAvailability,
  { label: string; short: string; description: string }
> = {
  official_api: { label: "Official API", short: "API", description: "Provided by an official Meta/Instagram endpoint." },
  webhook: { label: "Webhook", short: "Webhook", description: "Delivered by an official Meta webhook subscription." },
  estimated: { label: "Estimated", short: "Est.", description: "Derived from other data; treat as an approximation." },
  manual_import: { label: "Manual import", short: "Manual", description: "Entered or imported by the creator from in-app insights." },
  third_party: { label: "Third-party", short: "3rd-party", description: "Requires an approved third-party analytics provider." },
  unsupported: { label: "Not in official API", short: "Demo only", description: "No authorized source is known. Shown with sample data in demo mode only." },
};

export function capabilityMap(caps: MetricCapability[]) {
  return Object.fromEntries(caps.map((c) => [c.key, c])) as Record<MetricCapability["key"], MetricCapability>;
}
