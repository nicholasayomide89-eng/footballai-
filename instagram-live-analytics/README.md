# LiveLens — Instagram Live analytics dashboard

A React + TypeScript + Tailwind dashboard for creators to monitor Instagram Lives in real time and learn from past broadcasts. It ships with realistic, deterministic **sample data** (a fictional creator account), so every screen works before any real API is connected.

```bash
cd instagram-live-analytics
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

> The scripts pass `--configLoader native` because this repository's root `package.json` isn't valid JSON, and Vite's default config loader walks up into it.

## What's inside

| Section | What it shows |
|---|---|
| **Overview** | Live status, title, start time, duration, current/peak/unique viewers, comments, likes, shares, new followers, average and total watch time, engagement rate |
| **Live Monitor** | Live-updating charts: concurrent viewers, comments per minute, likes per minute, followers gained, engagement rate and retention. Hover any chart to see the exact time and value |
| **Audience** | Most active viewers, top commenters, most common commenters across Lives, returning vs. new viewers, joins and exits, audience growth |
| **Comments** | Live feed (username, avatar, comment, timestamp, how many comments that viewer has left), search, filters, most active commenters, repeated questions grouped by wording, keyword detection, pinned and flagged comments |
| **Guests** | Each guest's join and leave times, viewers before, peak during, comments, followers, engagement change; comparison within one Live or across all Lives |
| **Engagement** | Automatically detected moments on a timeline (viewer, comment, like and follower spikes, guest joins, big questions), with "Clip opportunities" highlighted, plus the full Live event timeline |
| **Clip Opportunities** | Timestamp, what happened, viewer count, spike size, suggested title and caption, estimated length, "Mark for editing", CSV export |
| **Previous Lives** | Sortable and filterable table; open any past Live in every other view; select Lives to compare |
| **Comparisons** | 2–4 Lives side by side: one small chart per metric, each on its own scale, plus retention, viewer and engagement curves over the course of each Live |
| **Insights** | Calculated patterns (best Live, best guest, best time and day, topics that drive comments or drop-off, average stay, best clip moments), kept separate from clearly labelled AI recommendations |
| **Settings** | Data source, a table of which metrics are available from which source, keyword settings |

The demo Live starts 40 minutes in and plays back at **12× speed** (one simulated minute every 5 seconds) so the live views visibly update. Use *Settings → Restart demo Live* to replay it.

## Data architecture

```
src/
  types/analytics.ts          All domain types (LiveSession, MinutePoint, LiveComment, Guest, …)
  services/
    types.ts                  LiveAnalyticsDataSource — the one interface the UI depends on
    index.ts                  getDataService(): the only place a concrete source is chosen
    capabilities.ts           Which metrics each source can provide, and how
    mock/                     Deterministic generator + progressive live playback
    backend/                  HttpBackendDataSource (REST + Server-Sent Events) — recommended for production
    meta/                     MetaGraphDataSource — direct Instagram Graph API mapping (reference only)
  lib/
    analytics.ts              Source-agnostic calculations: overview, moment detection, clips, guests, question grouping
    insights.ts               Patterns across Lives
    moderation.ts             Rule-based comment flagging
  state/                      DashboardContext (loading, streaming deltas, creator actions)
  components/                 UI primitives, charts, timeline, comment feed, clip cards, layout
  pages/                      One file per sidebar section
```

Components never call an API directly. They read from `DashboardContext`, which talks only to `LiveAnalyticsDataSource`. To switch to real data, construct a different source in `src/services/index.ts`:

```ts
setDataService(await new HttpBackendDataSource(import.meta.env.VITE_API_URL).init());
```

Live updates arrive as `LiveDelta` objects (a new minute of data, new comments, viewer and guest changes, events, status). The same delta format works for the mock playback, a webhook relay or polling.

## Metric availability

The Instagram Graph API exposes very little about Lives. As documented, it covers the active live media (`live_media`), comments on it, and the `live_comments` webhook. Viewer counts, viewer identities, reactions, shares, watch time, retention and guests are **not** available from it. Follower changes are only available as a daily account total.

Every metric in the UI carries a badge that shows where its value would come from in production:

- ✅ **Official API** / 📡 **Webhook**: available from Meta
- Σ **Estimated**: derived from other data
- ✎ **Manual import**: the creator enters it, e.g. from the Instagram app's own Live insights
- ⓘ **Third-party**: needs an approved analytics provider
- ⚠ **Not in official API**: sample data in demo mode only

The full table is in `src/services/capabilities.ts` and on the Settings page. Meta changes these APIs often, so check the current Graph API documentation before relying on any of them.

Suggested clip titles, captions and the Insights recommendations are **generated suggestions**, not measurements, and are labelled that way. In demo mode they come from rule-based templates. Replace them with a language-model call in `buildClipOpportunities` and `computeInsights` and keep the "AI" labels.
