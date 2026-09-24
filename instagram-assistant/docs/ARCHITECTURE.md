# Architecture

## Components

```
Browser (PWA) ──► Next.js app (src/app)
                    ├─ middleware.ts        owner session check on every route
                    ├─ server actions       all UI mutations (actions.ts)
                    └─ route handlers       OAuth, webhooks, media, export
                           │
                 src/lib/services           orchestration
                    ├─ messaging.ts         ingest → draft → critic → policy → send
                    ├─ stories.ts           upload → AI plan → policy → publish / handoff
                    ├─ analytics.ts         insights cache and timing/format analysis
                    └─ system.ts            pause switch, modes, defaults, Keel's caps
                           │
      ┌────────────────────┼─────────────────────┐
 src/lib/policy      src/lib/instagram      src/lib/ai
 (pure rules)        (only Meta caller)     (Claude: draft, critic, stories)
                           │
                 PostgreSQL (Prisma) · S3 · Anthropic API · graph.instagram.com
```

## The outbound path

Every DM goes through `sendSuggestion` in `src/lib/services/messaging.ts`:

1. **Draft.** Claude plans a reply, or recommends `no_reply` or `wait`, using only the transcript, stored memory, your profile and the text you approved.
2. **Critic.** A second Claude pass checks the draft makes sense, sounds like you, doesn't repeat answered questions and isn't pushy.
3. **Policy.** `evaluateMessage` in `src/lib/policy/engine.ts` is deterministic and unit-tested. It checks:
   - the 24-hour window and that the person messaged first
   - no double-texting and near-duplicate detection
   - the hard-rule detectors: sexual, offensive, financial, private information and commitments
   - per-contact AI access, the mode, the automation rule, active hours, daily caps, and critic flags
4. **Fresh re-check.** Policy is evaluated again against current database state just before sending, and automatic sends re-read the pause flag.
5. **Send and log.** The DM is sent through the Graph API, then the message, suggestion status, a style example (for approved sends only) and a hash-chained log entry are written in one transaction.

Anything that fails a check becomes a visible draft or a "held back" card with the reasons. Nothing is dropped silently.

## Security

- Instagram tokens are encrypted with AES-256-GCM (`src/lib/crypto.ts`). Keel never stores or sees your Instagram password.
- OAuth `state` is a single-use value in an httpOnly cookie, compared in constant time.
- Webhooks are verified with `X-Hub-Signature-256`, and deauthorize/deletion callbacks with `signed_request`.
- The owner session is an HMAC-signed cookie. Login is throttled.
- `ActionLog` is hash-chained, and a database trigger rejects UPDATE, DELETE and TRUNCATE on it.
- Untrusted text (DMs, captions) is fenced in prompts as data, and the hard rules are enforced in code, so prompt injection can't make Keel send money details, private information or abuse.
