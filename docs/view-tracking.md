# View Tracking System

Server-validated, tamper-resistant view counting for chapters and episodes.
Public `viewCount` values can only be changed through `POST /api/views` —
Firestore rules reject any client write to `viewCount`.

## How a view gets counted

```
Reader opens chapter
  │
  ├─ useViewTracking (client)
  │    1. skips entirely if navigator.webdriver, or already counted locally <24h
  │    2. POST /api/views { phase: 'begin' }
  │         server: bot check → rate limit → sets signed httpOnly visitor
  │         cookie (tf_vid) → returns HMAC-signed view token with SERVER
  │         issue time (iat)
  │    3. accumulates VISIBLE time (Page Visibility API) + max scroll depth
  │    4. when visible ≥ 20s OR (scroll ≥ 50% AND visible ≥ 8s):
  │       POST /api/views { phase: 'complete', token, ... }
  │       (also fired via sendBeacon on pagehide if already qualified)
  │
  └─ /api/views complete (server) — ALL checks re-done server-side:
       origin/referer must match host (CSRF)
       bot & prefetch detection (UA, sec-fetch-mode, sec-purpose, accept-language)
       rate limits per IP / visitor / session, temp block on repeat violations
       token: valid HMAC, matches content, bound to THIS visitor cookie, < 6h old
       dwell = now − token.iat  ← measured by OUR clock, unfakeable
       gate: dwell ≥ 20s OR (scroll ≥ 50% AND dwell ≥ 8s)
       engagement claim clamped to real elapsed time
       auth cookie verified with Admin SDK (invalid/expired ⇒ anonymous)
       │
       └─ single Firestore transaction:
            viewDedup/{type_content_visitorHash} — last view < 24h ago? abort.
            chapterViews/{auto}   immutable analytics log (hashed IP/UA/session)
            viewStats/{type_content} + /daily/{date}   aggregate counters
            content doc + parent doc   viewCount: FieldValue.increment(1)
```

Duplicate requests — refreshes, back-button, multiple tabs, replayed tokens,
concurrent requests — all collapse onto the same `viewDedup` document inside a
transaction, so at most one count per visitor per content per rolling 24 h.

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
return `200 {counted:false}` so abusers get no oracle; suspicious ones are
logged to `suspiciousViews` for review.

## Collections

| Collection | Purpose | Client access |
|---|---|---|
| `viewDedup/{type_content_visitorHash}` | rolling-window dedup + returning-reader signal | none |
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

Thresholds and limits: `src/lib/views/config.ts` (dedup window, dwell
thresholds, rate limits). Secret: `VIEW_TOKEN_SECRET` env var (optional —
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
