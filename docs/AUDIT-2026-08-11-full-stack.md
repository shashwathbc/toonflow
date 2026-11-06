# Toonflow Studio Paint — Full-Stack Audit

**Date:** 2026-08-11 · **Commit:** `4fc0dc3` (main, clean tree)
**Scope:** every field of the system — architecture, authorization, data model,
API surface, payments, performance/scale, accessibility, SEO, PWA, CI/CD,
configuration, code quality.

This is **not** a re-run of `SECURITY.md`. That report (Audit 1 + Audit 2, the
latter dated today) is accurate and its 19 findings are genuinely fixed; I
re-verified the fixes rather than re-reporting them. Everything below is either
**additive** (a finding neither audit covers) or **non-security** (correctness,
cost, operations, quality) — the axes a security-only pass does not measure.

---

## 0. Health snapshot — measured, not assumed

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | **PASS** — 0 errors, `strict: true` |
| ESLint | `eslint .` | **PASS** — 0 errors, 1 warning |
| Unit tests | `vitest run` | **PASS** — 136/136 across 14 files |
| Rules tests | `test:rules` | **Not run here** — needs the Java/Firestore emulator |
| Build | `next build` | **Not run here** — runs in CI's `e2e` job |

Codebase: **317 files, ~45,300 lines** (170 `.tsx`, 140 `.ts`), 15 API routes,
~65 route files, 10 type modules.

The one lint warning: `getBubbleDef` unused in
[bubbleLayout.ts:18](src/lib/editor/bubbleLayout.ts#L18).

---

## 1. Findings — ranked

Severity is **impact × exploitability/likelihood**, not category.

### 🔴 A1 — Draft and private content is world-readable and world-listable

**Files:** [firestore.rules:107](firestore.rules#L107), [:123](firestore.rules#L123), [:132](firestore.rules#L132), [:146](firestore.rules#L146)

Every content path is `allow read: if true`. That verb covers **both `get` and
`list`**, and the rules never look at `status` or `visibility`:

```
match /novels/{novelId}   { allow read: if true;   // ← draft + private included
  match /chapters/{id}    { allow read: if true; } // ← unpublished chapter bodies
match /webtoons/{id}      { allow read: if true;
  match /episodes/{id}    { allow read: if true; } // ← unpublished panel URLs
```

The app filters `visibility === 'public'` and `status ∈ published/ongoing/completed`
**client-side only** ([firestore.ts:521-529](src/lib/firebase/firestore.ts#L521-L529),
[homeData.ts:107](src/lib/home/homeData.ts#L107)). The web API key is public by
design, so anyone can open a Firestore channel and issue
`collection('novels').get()` — returning every draft, every private work, and
every unpublished chapter body verbatim.

This is not theoretical drift: `sitemap.ts` goes to real trouble
([:61](src/app/sitemap.ts#L61)) to keep private/unlisted works out of Google via
`isIndexable()`, and `Webtoon.visibility` has a dedicated `'unlisted'` state.
The product **intends** these to be non-public; the rules don't enforce it.

**Impact:** pre-release chapters scrapeable before publication; a creator's
private work is not private. For a serialized-fiction platform, embargo is the
product.

**Also forward-looking:** `Chapter.isPremium` / `coinCost` exist in the schema
([novel.ts:59-60](src/types/novel.ts#L59-L60)) and `HowEarningsWork` lists premium
chapters as *"soon"*. With `allow read: if true` on the chapter body, a coin
paywall **cannot** be enforced — the rule model must change *before* that ships,
not after.

**Fix:**
```
allow get: if resource.data.visibility == 'public'
           && resource.data.status in ['published','ongoing','completed']
        || isOwner(resource.data.authorId) || isAdmin();
allow list: if <same public predicate>;   // and add the composite indexes
```
Chapters/episodes need the parent lookup (`get(/novels/$(novelId)).data`) plus
their own `status == 'published'` check.

---

### 🟠 A2 — Per-IP rate limits are bypassable via a forged `X-Forwarded-For`

**File:** [botDetection.ts:97-101](src/lib/views/botDetection.ts#L97-L101)

```ts
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()   // ← leftmost = caller-supplied
```

Cloud Run / App Hosting **appends** to a client-supplied `X-Forwarded-For`
rather than replacing it. The leftmost entry is therefore whatever the caller
typed. Every per-IP limiter keys off this value:

- `/api/views` `begin:ip:` and `complete:ip:` ([route.ts:120](src/app/api/views/route.ts#L120), [:177](src/app/api/views/route.ts#L177))
- `/api/support` `support:ip:` ([route.ts:103](src/app/api/support/route.ts#L103))
- the `hashedIp` written into every `chapterViews` log row

Rotating the header per request gives an unlimited bucket — which reopens view
inflation (the thing the whole two-phase token protocol exists to prevent) at
the one layer the HMAC token doesn't cover, and removes the support throttle.

**Verify in one request:** `curl -H 'X-Forwarded-For: 1.2.3.4' https://…/api/support`
and watch the `support:ip:` key in the logs.

**Fix:** take the **N-th entry from the right**, where N = the number of proxies
you actually trust (1 for bare Cloud Run, 2 behind a load balancer), and fall
back to a deny-ish sentinel when the header is shorter than expected. Never
trust index 0.

---

### 🟠 A3 — `getCreatorWithdrawals` needs a composite index that the repo doesn't declare

**Files:** [firestore.ts:1062-1071](src/lib/firebase/firestore.ts#L1062-L1071), called from [wallet/page.tsx:417](src/app/(studio)/wallet/page.tsx#L417)

```ts
where('creatorId','==',creatorId), orderBy('createdAt','desc'), limit(50)
```
`firestore.indexes.json` declares **7** indexes; none is on `withdrawals`. A
`where` + `orderBy` on different fields is a composite query — Firestore answers
`FAILED_PRECONDITION` unless the index exists. Same gap for four more:

| Query | File | Index needed |
|---|---|---|
| `withdrawals` creatorId + createdAt desc | [firestore.ts:1062](src/lib/firebase/firestore.ts#L1062) | **live on /wallet** |
| `withdrawals` status + createdAt desc | [firestore.ts:571](src/lib/firebase/firestore.ts#L571) | dead code |
| `reports` status + createdAt desc | [firestore.ts:553](src/lib/firebase/firestore.ts#L553) | dead code |
| `follows` followingId + createdAt desc | [firestore.ts:1001](src/lib/firebase/firestore.ts#L1001) | dead code |
| `follows` followerId + createdAt desc | [firestore.ts:1012](src/lib/firebase/firestore.ts#L1012) | dead code |

If the `/wallet` one exists it was created **by hand in the console** — and CI
runs `firebase deploy --only firestore:indexes` ([ci.yml:155](.github/workflows/ci.yml#L155)),
so the repo is meant to be the source of truth. Console-only indexes are
config drift waiting to be reaped.

Note the *correct* variant already exists next door:
[wallet.ts:28-38](src/lib/firebase/wallet.ts#L28-L38) deliberately drops the
`orderBy` and sorts client-side, with a comment explaining why. Two functions,
same job, one index-safe — and `/wallet` calls the unsafe one while
`/dashboard` calls the safe one.

**Fix:** add the `withdrawals` index to `firestore.indexes.json`, or point
`/wallet` at `getUserWithdrawals` and delete the duplicate. Delete the four
dead queries.

---

### 🟠 A4 — Home, browse and search rank *the first N documents by ID*, not the top N

**Files:** [homeData.ts:37,101-102](src/lib/home/homeData.ts#L101-L102), [firestore.ts:507-516](src/lib/firebase/firestore.ts#L507-L516), [firestore.ts:1126-1127](src/lib/firebase/firestore.ts#L1126-L1127)

```ts
db.collection('novels').where('visibility','==','public').limit(60).get()
//        ↑ no orderBy → Firestore returns documents in __name__ (ID) order
```
then sorts those 60 by `viewCount` in memory and calls the result *trending*.

The comments explain the trade-off honestly (avoid a composite index; runs once
per ISR window) but stop one step short: **with no `orderBy`, `limit(60)` is not
a sample — it's the alphabetically-first 60 document IDs.** The moment the
public catalog exceeds the cap, trending/new-releases/browse/search all silently
operate on a fixed, arbitrary slice, and a genuinely popular work whose auto-ID
sorts late can never appear.

Caps: home `SCAN_LIMIT = 60`, browse `limitCount * 4` (= 96), search
`SEARCH_POOL = 400`.

**Impact:** silent, invisible, and it degrades *exactly* as the product
succeeds. There is no error and no log — the feed just becomes wrong.

**Fix:** add `(visibility ASC, viewCount DESC)` and `(visibility ASC, createdAt DESC)`
composite indexes and use a real `orderBy`. It is two index entries. For search,
move to a lowercased token field or a dedicated index before the catalog passes
~1k works.

---

### 🟡 A5 — A comment's body is capped on create but unbounded on update

**File:** [firestore.rules:321-331](firestore.rules#L321-L331)

```
allow create: … && request.resource.data.content.size() <= 5000;   // capped
allow update: if ((isOwner(…)||isAdmin())
    && !…affectedKeys().hasAny(['authorId','likeCount']))          // no size check
```
Post a 10-character comment, then update it to ~1 MB (the Firestore document
ceiling). Repeat. F-5 in Audit 1 added the create cap for precisely this reason;
the update path never got it. Comments are `allow read: if true`, so the payload
is also served to every reader of that page.

**Fix:** repeat the `content is string && content.size() <= 5000` clause in the
update rule. Same one-line gap exists on novel/webtoon `title`/`synopsis` —
neither create nor update bounds them (client-side zod only).

---

### 🟡 A6 — `/api/support` will send mail to any address, unauthenticated

**File:** [support/route.ts:120-163](src/app/api/support/route.ts#L120-L163)

The `email` field is caller-supplied, validated only for *shape*
([:28](src/app/api/support/route.ts#L28)), and is then used directly as the `to:`
of an automated message from the production Gmail account
([:163](src/app/api/support/route.ts#L163)). No auth, no CAPTCHA, no
verification that the submitter controls the address.

Controls today: 8 requests / 10 min per IP — **which A2 defeats** — and 5/day
per email address, which is per-*victim*, not per-attacker.

**Impact:** unsolicited mail from `toonflowstudiopaint@gmail.com` to arbitrary
recipients. The cost isn't the mail, it's the **sender reputation** — enough
volume and Gmail throttles or blocks the account that also sends your
transactional mail. Audit 1's F-12 fixed HTML injection *inside* this mail; it
did not address who the mail goes to.

**Fix:** Turnstile/reCAPTCHA on the support form (SECURITY §8.6 already
recommends this for signup), and/or require auth and take the address from the
verified session for signed-in users.

---

### 🟡 A7 — Financial PII stored unstructured, unvalidated, and admin-readable

**Files:** [transaction.ts:33](src/types/transaction.ts#L33), [firestore.rules:397-409](firestore.rules#L397-L409)

`Withdrawal.accountDetails: Record<string, string>` holds bank account numbers,
IFSC codes, UPI IDs and PayPal addresses. The create rule validates `creatorId`,
`amount` and `status` — and says nothing at all about `accountDetails`:

- **No shape or size bound.** Any signed-in user can write an arbitrary
  ~1 MB map into a `withdrawals` document.
- **Plaintext at rest**, readable by every account with `role == 'admin'`
  (`allow read: if … isAdmin()`), not just the super-admin.
- **No retention limit** — details persist indefinitely after payout.

For an Indian LLP with a GSTIN on the legal pages, that is a real data-handling
posture question, not a style note.

**Fix:** enumerate and cap the permitted keys per `method` in the rule; move the
collection behind an Admin-SDK route (as `/api/ratings` did for ratings); scope
reads to super-admin; add a retention job that clears details post-payout.

---

### 🟡 A8 — `/api/img` is unauthenticated, unmetered, and `Access-Control-Allow-Origin: *`

**File:** [img/route.ts:39-104](src/app/api/img/route.ts#L39-L104)

Audit 2's F-14 fix is solid on the *security* axis — bucket-scoped allowlist,
re-derived Content-Type, no redirect following, size and time ceilings. What it
doesn't have is a **cost** control: no auth, no rate limit, and `ACAO: *`.

Each call makes the server fetch up to 30 MB from Storage and stream it back —
so every request is billed twice (Storage egress + Cloud Run egress) and can be
driven by anyone, from any origin, in a loop. `Cache-Control: max-age=3600` only
helps a browser that wants to cooperate.

**Fix:** a per-IP token bucket (once A2 is fixed), drop `ACAO: *` to your own
origin, and consider requiring a session for anything above thumbnail size.

---

### 🟡 A9 — View-tracking collections grow forever with no TTL

**File:** [viewService.ts:82-119](src/lib/views/viewService.ts#L82-L119)

Each counted view writes **7 documents**: `viewDedup`, `chapterViews`,
`viewStats`, `viewStats/daily`, plus two `viewCount` increments. Of these:

- `chapterViews` — one immutable row **per view, forever**
- `viewDedup` — one document per (viewer × content) pair, **forever**
- `suspiciousViews` — unbounded

Nothing in the repo or `firebase.json` sets a TTL policy. Storage cost grows
linearly with traffic and never decreases, and both analytics endpoints then
scan up to 20,000 of these rows per call
([creator/analytics:18](src/app/api/creator/analytics/route.ts#L18),
[admin/analytics:58](src/app/api/admin/analytics/route.ts#L58)).

**Fix:** Firestore TTL policies on `chapterViews` (90 d — matches the analytics
window), `viewDedup` (rolling window + margin) and `suspiciousViews` (30 d).
Add an `expiresAt` field and declare it; it's a console/`fieldOverrides` change.

---

### 🟡 A10 — Analytics endpoints have no rate limit and unbounded read cost

**Files:** [creator/analytics/route.ts](src/app/api/creator/analytics/route.ts), [admin/analytics/route.ts](src/app/api/admin/analytics/route.ts)

`/api/creator/analytics` is authenticated but ungated: per call it runs 4 base
queries + ⌈contentIds/30⌉ chunked `in` queries at up to 20,000 docs each + up to
5 extra document reads. `Cache-Control: private, max-age=60` binds browsers, not
scripts. Any signed-in creator can loop it and bill you tens of thousands of
document reads per second.

**Fix:** `checkRateLimitAsync('analytics:' + uid, 20, 60_000)` at the top of
both routes; cache the computed payload in Firestore/Redis keyed by
`uid + dayKey` rather than recomputing per request.

---

### 🟢 A11 — Smaller items, grouped

| # | Finding | File |
|---|---|---|
| A11.1 | `likes` and `ratings` are `allow read: if true` **including list**, and their doc IDs embed the uid (`{uid}_{type}_{id}`) — so anyone can enumerate any user's complete like/rating history. Behavioural profile, not a secret, but it's a bulk primitive of exactly the kind F-17 closed for `users`. | [rules:453](firestore.rules#L453), [:468](firestore.rules#L468) |
| A11.2 | `follows` is `allow read: if isSignedIn()` with no constraint → one signed-in account can dump the **entire social graph**. | [rules:338](firestore.rules#L338) |
| A11.3 | `conversations` update allows either participant to write `unreadCount` (a map) with no bound — a participant can pin the other's badge to any number. | [rules:528-531](firestore.rules#L528-L531) |
| A11.4 | The service worker caches **every** successful navigation, including `/dashboard`, `/wallet`, `/messages`, with no size cap and no eviction other than a `CACHE_VERSION` bump. Shared-device leakage + unbounded growth. | [sw.js:86-107](public/sw.js#L86-L107) |
| A11.5 | `sanitizeHtml` allows the `style` attribute (blocking only `expression`/`javascript:`/`url()`/`@import`). A creator can still emit `position:fixed;inset:0;z-index:9999` and cover the page from inside chapter content. | [sanitizeHtml.ts:35](src/lib/utils/sanitizeHtml.ts#L35) |
| A11.6 | `recordView` uses `tx.update(parentRef, …)` — if the parent novel/webtoon was deleted while a child survives, `update` throws and the request 500s instead of returning `{counted:false}`. | [viewService.ts:119](src/lib/views/viewService.ts#L119) |
| A11.7 | `AuthContext` POSTs `/api/session` on **every** `onIdTokenChanged` (hourly refresh + every tab), and each POST does `verifyIdToken` + `createSessionCookie` (a remote Google call) + a `users/{uid}` read. Unnecessary latency, quota and read cost; SECURITY §8.5 flags the missing rate limit but not the cost. | [AuthContext.tsx:88-94](src/contexts/AuthContext.tsx#L88-L94) |

---

## 2. Field-by-field data model

Every collection, who can reach it, and whether the guarantee is **enforced** or
merely **conventional**. This is the table to keep current.

### `users/{uid}`

| Field | Written by | Rule enforcement |
|---|---|---|
| `uid`, `email` | signup | ✅ create-pinned; ⚠️ **`email` is readable by anyone who knows the uid** (`allow get: if true`) — F-17 residual, migration staged in SECURITY §7 |
| `displayName`, `bio`, `photoURL`, `bannerURL`, `socialLinks`, `hasOnboarded`, `referralSource` | owner | ✅ `onlyUpdates([...])` allowlist |
| `role` | **server only** | ✅ pinned to `'user'` on create unless super-admin email; admin can't self-promote (`request.auth.uid != userId`) |
| `balance`, `totalEarnings`, `totalViews` | **server only** (webhook / `chargeTokens`) | ✅ pinned to 0 on create, excluded from the owner allowlist |
| `isCreator` | server | ✅ pinned `false` on create |
| `followerCount` | any signed-in user | ✅ ±1 delta-bounded |
| `followingCount` | owner | ✅ ±1 delta-bounded |
| **uid enumeration** | — | ⚠️ `list` is admin-only, but uids leak via `novels.authorId`, `comments.authorId`, and public `followers`/`following` subcollections → the email set is still reachable one `get` at a time |

Sub: `followers/`, `following/` public-read, self-write ✅ · `blocked/` owner-only ✅ ·
`notifications/` cross-user create with type allowlist, length caps and a
rooted-path regex on `link`, re-validated at the sink ✅ (**best-designed rule in the file**)

### `novels/{id}` · `webtoons/{id}`

| Field | Written by | Enforcement |
|---|---|---|
| `authorId` | create only | ✅ `contentServerFieldsUnchanged()` |
| `viewCount` | **`/api/views` only** | ✅ Admin SDK; client writes blocked |
| `rating`, `ratingCount` | **`/api/ratings` only** | ✅ Admin SDK |
| `likeCount` | any signed-in user | ✅ ±1 **and** bound to the caller's like edge via `exists`/`existsAfter` |
| `status`, `visibility` | owner | ⚠️ **never read by any read rule** → see A1 |
| `title`, `synopsis`, `tags`, `genres` | owner | ⚠️ no length/shape bound in rules (zod client-side only) |
| `bookmarkCount`, `chapterCount`/`episodeCount` | client | ⚠️ not in the server-fields list — an author can set them freely (cosmetic) |

Sub: `chapters/`, `episodes/` — same pattern; `Episode.canvasProject` is the full
infinite-canvas project embedded in the document, so a complex episode can
approach Firestore's 1 MiB ceiling ([webtoon.ts:86](src/types/webtoon.ts#L86)).
No size guard exists at the write site ([firestore.ts:855](src/lib/firebase/firestore.ts#L855)).

### Money & moderation

| Collection | Read | Write | Notes |
|---|---|---|---|
| `transactions` | owner + admin | **`create: false`** | ✅ webhook/Admin-SDK only |
| `withdrawals` | owner + admin | owner create (pending), admin update | ⚠️ A7 |
| `reports` | admin | signed-in, fully shape-validated | ✅ F-18 |
| `supportRequests` | admin | **`create: false`** | ✅ Admin SDK only |
| `auditLogs` | admin | admin create, **no update/delete** | ✅ append-only |
| `settings` | admin | admin | ✅ |

### Server-only (all `read, write: if false`)

`chapterViews`, `viewDedup`, `views`(retired), `creatorAnalytics`,
`revenueHistory`, `viewHistory` ✅ · `viewStats`, `suspiciousViews` admin-read ✅ ·
`aiUsage` has **no rule at all** → default-deny ✅ (correct, but worth an explicit
`match` + comment so a future wildcard can't accidentally cover it).

### Messaging

Conversation ID is the sorted uid pair; create requires **mutual follow** and
**neither party blocked**; the `follows` doc ID is bound to
`{follower}_{following}` so a half-edge can't be forged; messages are
sender-bound and immutable; image URLs must match `https://.*` and are
re-validated at the sink. This is a genuinely well-constructed authorization
chain — the only gap is A11.3.

---

## 3. Area-by-area

### Architecture — 9/10
Clean layering that is actually *observed*, not just documented: components never
touch Firestore directly, the Admin SDK never crosses into client code, `db` is
split out of `config.ts` so signed-out visitors don't pay for the Firestore SDK,
route groups map cleanly to layouts. The `proxy.ts` naming convention is
correctly followed. Deduction: `dashboard/page.tsx` (42 KB) and
`ProfilePageClient.tsx` (34 KB) are past the point where a single file is
reviewable — both are doing 4–6 features' worth of work.

### Authorization — 8/10
Server-derived roles, revocable session cookies, Admin-SDK-only money paths, and
Firestore rules that are among the most carefully reasoned I've read — the
`likeCountBumped` edge-binding and the notification `link` regex are genuinely
sophisticated. Deduction is entirely A1: the read side never got the same
treatment as the write side.

*Note on the middleware:* `proxy.ts` gates `/admin` on a cookie. Cookies —
including `HttpOnly` ones — are editable in DevTools, so the admin **shell** is
reachable by anyone who sets `toonflow-user-role=admin`. The code says as much
([proxy.ts:22](src/proxy.ts#L22)) and data access is independently governed, so
this is correct as designed — but it means no admin page may ever server-render
privileged data without re-verifying. Today none do.

### API surface — 8/10
All 15 routes carry an appropriate guard; zod + body-size caps throughout;
generic error text with detail logged server-side; the AI ordering
(auth → per-user bucket → global cap → moderation → vendor) is textbook. The
payment webhook is exemplary: constant-time HMAC, catalog-derived coin amounts,
captured-amount cross-check, idempotency keyed on the Razorpay payment ID inside
a transaction. Deductions: A6, A8, A10 — all **cost/abuse**, none authorization.

### Performance & scale — 6/10
Strong on first paint: server-side home feed so covers are in the initial HTML,
ISR, trimmed `deviceSizes`, a 1-year image cache TTL with a documented rationale,
`minInstances: 1` to kill cold starts, `select()` projections on the heavy
queries, memoized auth context. Deductions are all **at scale**: A4 (ranking
breaks past 60 works), A9 (unbounded collections), A10 (uncapped read cost), and
the in-memory rate limiter multiplying by instance count until Upstash is wired
(SECURITY §8.4 — the code path is ready, the env vars are commented out in
`apphosting.yaml`).

### Accessibility — 9/10
The best-executed axis. Verified against the actual CSS and markup:

- Skip link ✅, `<main id="main-content" tabIndex={-1}>` ✅, `html lang` ✅
- Global `:focus-visible` at 2px/3px offset ✅ ([globals.css:90](src/app/globals.css#L90))
- Global `prefers-reduced-motion` using 0.01ms rather than `none`, so
  `transitionend` state machines don't stall — a detail most codebases get wrong ✅
- `maximumScale: 5` (zoom not blocked) ✅
- Icons `aria-hidden`, icon-only controls labelled, tooltips via a shared Radix provider ✅
- **Contrast, computed:** `text-secondary` #AAAAAA on #0F0F0F ≈ **9.0:1**;
  `text-muted` #8B8B8B ≈ **5.6:1** on `bg`, **4.7:1** on `bg-elevated`;
  `danger` #FF4444 ≈ **5.6:1**; `warning` #FFB800 ≈ **11:1**. All pass AA, and the
  `#717171 → #8B8B8B` fix noted in the CSS is real.

Deduction: **245 raw hex literals** across 27 components. Most are legitimate
(Konva canvas and Recharts need literal colours), but `SidebarLeft.tsx` (47),
`SidebarRight.tsx` (35) and `CanvasEditor.tsx` (20) are past that excuse and
violate the project's own "no raw hex in JSX" rule. Route them through a
token→hex export so a palette change can't leave the editor behind.

### SEO — 8/10
`metadataBase` from a single constant, per-route metadata, JSON-LD with `<`
escaped, `robots.ts`, and a sitemap that correctly uses the *same* `isIndexable()`
predicate as the pages so the two can't disagree. Deduction: the sitemap contains
only novels and webtoons — **no chapter or episode URLs**, which is the majority
of the crawlable long-tail. And the 50k-per-file cap (documented as P2) needs
`generateSitemaps()` before the catalog grows.

### PWA — 7/10
Hand-rolled SW is the right call for Turbopack, the cache-first allowlist is
correctly restricted to versioned/hashed paths, and the "deliberately NOT listed"
comment block explains what would break if you added `manifest.json`. Deductions:
A11.4 (authenticated navigations cached, no eviction), and `public/icons/` still
carries three orphaned 306 KB PNGs (`icon-192x192.png`, `icon-512x512.png`,
`icon-maskable-512x512.png` — all byte-identical in size) alongside the real `.v2`
files, served under a 1-year immutable header.

### Testing & CI — 7/10
136 fast unit tests concentrated exactly where they matter (sanitizer 15, image
proxy 17, SEO predicates 18, bot detection 14, crypto 9), a separate emulator-backed
rules suite, and a `deploy` job that correctly `needs: [e2e, rules]` so a rules
regression can't reach production. Real gaps:

- **`FIREBASE_TOKEN` + `npm install -g firebase-tools`** ([ci.yml:88,148,157](.github/workflows/ci.yml#L157)).
  `firebase login:ci` tokens are deprecated, and the CLI is installed unpinned —
  so a major release lands in your deploy path unreviewed. Pin the version and
  migrate to Workload Identity Federation or a service-account key.
- No `format:check` step despite Prettier being configured.
- No component or route-handler tests — the tested 14 files are all pure logic;
  every React component and all 15 API handlers are untested.

### Configuration & deployment — 5/10 ← weakest axis

| Issue | Evidence |
|---|---|
| **Razorpay key is a placeholder in production config** — `rzp_test_REPLACE_ME` for both the public and server key | [apphosting.yaml:69](apphosting.yaml#L69), [:89](apphosting.yaml#L89) |
| **Sentry DSN is the docs example** `https://examplePublicKey@o0.ingest.sentry.io/0` → `@sentry/nextjs` ships in the bundle and reports nowhere. This is also SECURITY §8.3's "no monitoring" made concrete. | [apphosting.yaml:40](apphosting.yaml#L40) |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` set, but `config.ts` deliberately omits it | [config.ts:11](src/lib/firebase/config.ts#L11) |
| `.env.example` omits `AI_DAILY_IMAGE_CAP`, `AI_DAILY_TEXT_CAP`, `AI_GENERATION_DISABLED`, `UPSTASH_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | — |

**Mitigating:** `FEATURE_FLAGS.wallet` and `.buyCoins` are both `false`
([constants.ts:12-16](src/lib/utils/constants.ts#L12-L16)), so the Razorpay
placeholder isn't breaking a live flow — it's a **hard blocker on flipping those
flags**, and worth fixing before anyone forgets why.

### Documentation drift — 6/10
Comment density is unusually high and unusually *useful* — most comments explain
*why*, often citing the audit finding they close. The drift is at the edges:

- `CLAUDE.md` says **"Next.js 15"**; `package.json` pins **16.2.12**. `apphosting.yaml`'s
  header says 15 too.
- `/api/ai/generate-image` comments describe "our funded Pollinations key
  (`POLLINATIONS_API_KEY`)" ([route.ts:179-181](src/app/api/ai/generate-image/route.ts#L179-L181))
  but production runs `IMAGE_PROVIDER: cloudflare` ([apphosting.yaml:97](apphosting.yaml#L97)),
  and `POLLINATIONS_API_KEY` isn't in the deployment config at all. The
  abstraction is fine — the comments are one migration behind.
- `types/analytics.ts` isn't re-exported from `types/index.ts`.

### Dead code
`getFollowers`, `getFollowing`, `getReports`, `getWithdrawals` are exported and
never imported anywhere in `src/`. `getUserWithdrawals` / `getCreatorWithdrawals`
are duplicates with different index characteristics (see A3).

---

## 4. Scorecard

| Area | Score | One-line basis |
|---|---:|---|
| Architecture & layering | 9 | Boundaries documented *and* observed; two oversized page files |
| Authorization (write) | 9 | Server-derived roles, delta-bounded counters, edge-bound likes |
| Authorization (read) | **5** | A1 — no read rule looks at `status`/`visibility` |
| API design & guards | 8 | Every route guarded; cost controls missing on 3 |
| Payments | 9 | Catalog-priced, amount-checked, idempotent, HMAC-verified |
| Data model integrity | 7 | Server fields enforced; string/PII fields unbounded |
| Performance (first paint) | 9 | SSR feed, ISR, tuned image pipeline, warm instance |
| Performance (at scale) | **5** | A4 ID-order ranking, A9 no TTL, A10 uncapped reads |
| Accessibility | 9 | Contrast verified; reduced-motion done right |
| SEO | 8 | Consistent predicates; no chapter URLs in sitemap |
| PWA | 7 | Correct cache-first allowlist; caches auth'd pages |
| Testing | 7 | 136 sharp unit tests; zero component/route coverage |
| CI/CD | 7 | Rules gate before deploy; deprecated auth, unpinned CLI |
| Configuration | **5** | Two placeholder values live in production config |
| Documentation | 6 | Excellent inline *why*; drifted framework/provider facts |
| **Overall** | **7.4 / 10** | Security prevention is genuinely strong. The exposure is on the **read** side of authorization, and on **cost/scale** — the axes a security pass doesn't measure. |

---

## 5. Fix order

**This week**
1. **A1** — visibility/status in the read rules (+ the composite indexes it needs). Largest single risk here.
2. **A3** — add the `withdrawals` index or repoint `/wallet`; verify `/wallet` in production today.
3. **A2** — fix `getClientIp` to count from the right.
4. **Config** — real Razorpay keys and a real Sentry DSN, *or* an explicit note that both stay off until the wallet flag flips.

**This month**
5. **A4** — real `orderBy` + indexes for home/browse; stop ranking an ID-order slice.
6. **A5** — size cap on comment update; bound `title`/`synopsis`.
7. **A9** — TTL policies on `chapterViews`, `viewDedup`, `suspiciousViews`.
8. **A10** — rate-limit both analytics routes; cache the payload.
9. **A6/A8** — CAPTCHA on support; rate-limit + same-origin `/api/img`.
10. **CI** — pin `firebase-tools`, move off `FIREBASE_TOKEN`.

**Backlog**
11. A7 (withdrawal PII), A11.1–.7, sitemap chapter URLs, split the two oversized page files, route editor hex through tokens, delete dead code and orphaned icons, fix the doc drift.

**Not code-fixable — still the biggest risks, unchanged from SECURITY §8:**
backups (none scheduled, no tested restore), MFA on the super-admin account,
and alerting on anything at all.

---

*Method: static review of the full tree at `4fc0dc3`, plus executed `tsc`,
`eslint` and `vitest`. Not covered: live traffic, the Firebase console's actual
index/TTL/backup state, Firestore rules **execution** (emulator not run here —
`npm run test:rules` still needs a pass), production bundle analysis, and any
runtime Lighthouse measurement.*
