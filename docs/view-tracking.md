# View Tracking System

Server-validated, tamper-resistant view counting for chapters and episodes.
Public `viewCount` values can only be changed through `POST /api/views` —
Firestore rules reject any client write to `viewCount`.

## How a view gets counted

**Product rule: every open is a view.** There is no reading time to wait out and
no per-day cap — opening a chapter counts, opening it again tomorrow counts
again. What the pipeline filters is *fake* views, not *repeat* ones.

```
Reader opens chapter
  │
  ├─ useViewTracking (client)
  │    1. skips if navigator.webdriver, or this target already fired <5s ago
  │       (one open must not count twice — see "One open, one view" below)
  │    2. POST /api/views { phase: 'begin' }
  │         server: bot check → rate limit → sets signed httpOnly visitor
  │         cookie (tf_vid) → returns HMAC-signed view token with SERVER
  │         issue time (iat)
  │    3. POST /api/views { phase: 'complete', token, ... } immediately
  │
  └─ /api/views complete (server) — ALL checks re-done server-side:
       origin/referer must match host (CSRF)
       bot & prefetch detection (UA, sec-fetch-mode, sec-purpose, accept-language)
       rate limits per IP / visitor / session, temp block on repeat violations
       token: valid HMAC, matches content, bound to THIS visitor cookie, < 6h old
       dwell = now − token.iat  ← measured by OUR clock, unfakeable
       engagement gate (VIEW_CONFIG.minDwellMs, currently 0 = counts on open)
       engagement claim clamped to real elapsed time
       auth cookie verified with Admin SDK (invalid/expired ⇒ anonymous)
       │
       └─ single Firestore transaction:
            viewDedup/{type_content_visitorHash} — last view < 10s ago? abort.
            chapterViews/{auto}   immutable analytics log (hashed IP/UA/session)
            viewStats/{type_content} + /daily/{date}   aggregate counters
            content doc + parent doc   viewCount: FieldValue.increment(1)
```

### One open, one view

A single open can fire the protocol more than once — React Strict Mode
double-mounts every effect in development, soft navigation can remount the
reader in milliseconds, a retried fetch can land twice. Two independent guards
collapse those into one count:

- **Client**: a module-scope stamp per target suppresses a repeat within 5s.
- **Server**: concurrent and near-simultaneous completions collapse onto the
  same `viewDedup` document inside a transaction (`VIEW_CONFIG.dedupWindowMs`,
  10s), so the counter can never be double-incremented.

Neither is a per-day cap. Sustained refresh-spam is bounded by the per-IP /
per-visitor / per-session rate limits, which is where abuse is handled.

> **Regression history — read before changing the client hook.** Views have
> silently gone to zero twice, both times upstream of `recordView`:
> once at the CSRF guard (`req.nextUrl.host` is the *internal* Cloud Run host
> behind App Hosting, so no real visitor was ever same-origin), and once in
> `useViewTracking`, which aborted its own in-flight request on unmount — Strict
> Mode tore the effect down milliseconds after mount, every time. The hook now
> deliberately does **not** cancel on unmount: the view is earned the moment the
> page opens. Every rejection is logged server-side (and echoed as `reason` in
> the response outside production) so this can never be a black hole again.

## Identity & privacy

- Signed-in users dedup by verified Firebase `uid` (same person across devices).
- Anonymous readers dedup by a random id in an **httpOnly, HMAC-signed cookie**
  (`tf_vid`) — tampering invalidates it and the bound view token with it.
- IP, user agent, and session id are stored **only as salted SHA-256 hashes**,
  used as secondary signals for abuse review, never as the sole identifier.

## What is intentionally NOT counted

Bots/crawlers/AI scrapers (UA signatures), API tools (curl, Postman, axios…),
headless browsers (`navigator.webdriver`, headless UA), prefetch/prerender
requests, requests without JS execution (they never complete the two-phase
protocol), cross-origin requests, rate-limit violators. Rejected attempts
return `200 {counted:false}` so abusers get no oracle — outside production the
response also carries a `reason`, and every rejection is `console.warn`ed
server-side. Suspicious ones are logged to `suspiciousViews` for review.

## Collections

| Collection | Purpose | Client access |
|---|---|---|
| `viewDedup/{type_content_visitorHash}` | duplicate-request window + returning-reader signal | none |
| `chapterViews/{auto}` | per-view analytics log (spec fields, hashed identifiers) | none |
| `viewStats/{type_content}` (+ `daily/{yyyy-mm-dd}`) | aggregates: total views, unique visitors, returning views, engagement ms, scroll % | admin read |
| `suspiciousViews/{auto}` | rejected/abusive attempt log | admin read |

Analytics live entirely in `viewStats` and are never mixed into the public
`viewCount`.

## Analytics API

`GET /api/views/stats?contentType=chapter&contentId=…&parentId=…&days=30`
— content owner or admin only. Returns totals (unique visitors, returning
views, total reading time, avg engagement, avg completion %) plus
daily/weekly/monthly view and unique-visitor windows and a daily series.

## Configuration

Thresholds and limits: `src/lib/views/config.ts` (duplicate-request window,
dwell thresholds, rate limits). Secret: `VIEW_TOKEN_SECRET` env var (optional —
falls back to a hash of `FIREBASE_PRIVATE_KEY`; set it explicitly in
production so key rotation doesn't invalidate visitor cookies).

## Scaling notes

- Rate limiting is in-memory per server instance. For multi-instance
  deployments swap `checkRateLimit` in `src/lib/views/rateLimit.ts` for a
  Redis/Upstash implementation — the interface is one function.
- Firestore's ~1 write/sec/document soft limit applies to a single chapter's
  counter; at sustained >1 counted view/sec per chapter, shard the counter or
  move increments to a queued aggregator.

## Deploying

```
firebase deploy --only firestore:rules,firestore:indexes --project toonflow-studio-paint-f384c
```
