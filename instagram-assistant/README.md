# Keel: an AI assistant for your Instagram account

Keel helps you manage your own Instagram account without it looking automated. It drafts replies and Stories in your voice, checks every draft against your rules and Instagram's limits, and waits for your approval before anything goes out. Automatic replies happen only under rules you approve, and one tap pauses everything.

It uses only Meta's official **Instagram API with Instagram Login**. It never asks for your Instagram password, and it never uses scrapers, browser bots or private APIs.

The design (architecture, Meta capability check, data model, safety system and screens) is on the design canvas. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) summarizes it.

## What's in this MVP

| Area | Status |
|---|---|
| Instagram OAuth (password stays on instagram.com), encrypted token storage, auto-refresh | Built |
| Home dashboard: automation status, what needs you, profile counts | Built |
| Inbox: DMs via webhook, AI reply drafts, "don't reply" and "don't double-text" advice, conversation memory | Built |
| Three message modes: suggest only, ask before sending, auto under approved rules | Built |
| AI critic pass on every draft plus deterministic hard rules | Built |
| Story Assistant: upload, 7 styles, quality, privacy and repetition check, approve then publish, or finish in Instagram | Built |
| AI Personality: voice sliders, slang, facts you provide, learning only from approved text | Built |
| Emergency pause, safety rules, auto-reply rules, per-contact AI access | Built |
| Hash-chained, append-only activity log with export | Built |
| Analytics: engagement by format and posting time, from your own posts | Built |
| Content Planner, scheduled posting, Story auto-post rules, comment replies | Phase 2 |
| Passkey login (MVP uses a scrypt-hashed owner password) | Phase 2 |

## What Instagram does and doesn't allow

Keel is built around these limits and doesn't work around them:

- **Professional account required.** Creator or Business accounts are free, but they can't be private.
- **Replies only within 24 hours** of the other person's last message, and only to people who messaged you first. Keel never cold-messages anyone.
- **Story stickers, polls, music, links and text can't be added through the API.** Keel still writes them. You then either publish the photo or video alone, or use "Finish in Instagram".
- **Follower and following lists aren't available**, only the counts.
- **Publishing is capped** per rolling 24 hours. Keel reads the live limit before every publish and applies its own lower cap of 3 Stories a day.

## Setup

### 1. Meta app

1. At [developers.facebook.com](https://developers.facebook.com), create an app of type **Business** and add the **Instagram** product. Choose **API setup with Instagram login**.
2. Under *Business login settings*, add the redirect URL `https://YOUR_DOMAIN/api/instagram/callback`.
3. Under *Webhooks*, set the callback URL to `https://YOUR_DOMAIN/api/webhooks/instagram`, pick a verify token, and subscribe to `messages`.
4. Set the *Deauthorize* and *Data deletion* callback URLs to `https://YOUR_DOMAIN/api/instagram/deauthorize`.
5. Add your own Instagram account under *App roles → Instagram testers* and accept the invite in Instagram (*Settings → Website permissions → Apps and websites*). To manage only your own account, Standard Access is enough and no App Review is needed.
6. In the Instagram app, go to *Settings → Messages and story replies → Message controls → Connected tools* and turn on **Allow access to messages**.

### 2. Services

- PostgreSQL 14 or newer
- An S3-compatible bucket, kept private. Keel gives Instagram a 15-minute presigned URL when it publishes.
- An Anthropic API key

### 3. Run

```bash
cp .env.example .env         # fill in the values
npm install
npm run hash-password        # paste the output into OWNER_PASSWORD_HASH
npx prisma migrate deploy
npm run build && npm start
```

Schedule `npm run refresh-tokens` to run daily; it renews the Instagram token before it expires.

Serve Keel over HTTPS in production. Session cookies are marked `Secure` whenever `APP_URL` starts with `https://`.

## Tests

```bash
npm test          # policy engine, crypto, sessions, audit chain, webhooks, Instagram client
npm run lint      # TypeScript typecheck
```

`tests/messaging.int.test.ts` runs the full reply pipeline against a real PostgreSQL database when `TEST_DATABASE_URL` is set, with the AI and Instagram faked. It covers approval-only sends, echo de-duplication, double-text blocking, auto-reply rules, the pause switch, and the append-only log trigger.

## AI model

Drafting and critique use Claude (`ANTHROPIC_MODEL`, default `claude-opus-5`) through the official Anthropic SDK, with structured outputs. Requests enable server-side refusal fallbacks (`fallbacks: "default"`): if a safety classifier declines a request, it is retried on Anthropic's recommended fallback model instead of failing. Remove `fallbacks` in `src/lib/ai/client.ts` if you don't want this.
