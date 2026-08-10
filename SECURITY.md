# Toonflow Studio Paint — Security Audit Report

> This file holds two audits. **Audit 2 (2026-08-11)** is the current record and
> is immediately below. Audit 1 (2026-07-05) follows it, retained unchanged as
> the historical baseline — its findings F-1…F-13 remain fixed.

---

# Audit 2 — 2026-08-11 · Zero-Trust hardening pass

**Scope:** everything added since Audit 1 — the image proxy, ratings, creator and
admin analytics, messaging, notifications, blocks, the storyboard/agent AI
surface — plus a re-review of the Firestore rules against the *current* data
model and revenue logic.
**Method:** source review of all 15 API route handlers, `firestore.rules`,
`storage.rules`, `src/proxy.ts`, the auth/session/rate-limit/spend-guard
libraries and every XSS sink; secret scan of the working tree **and** git
history; `npm audit` supply-chain review. Fixes applied directly, with
regression tests.

## 1. Executive summary

The controls Audit 1 put in place have held: session minting still verifies
before it mints, the money paths are still Admin-SDK-only, view counting is
still server-authoritative, and no secret is committed anywhere in history.
Every one of the 15 API routes carries an appropriate guard — verified
individually, not assumed.

This pass found **six new issues**, all introduced by features built after
Audit 1. One is serious: the same-origin image proxy added for canvas export was
an **open relay that let anyone serve attacker-controlled content — including
attacker-chosen `Content-Type` — from `toonflowstudiopaint.com` itself**, which
is script execution in our own origin. Two more were **authorization gaps where
the Firestore rules asserted a protection in their comments that the rule
logic did not actually implement** — creators could rewrite their own
`viewCount` (the field creator payouts are computed from), and any signed-in
user could inflate or destroy any story's like count by replaying a single-field
write.

All six are fixed. **34 new automated security tests** were added, and the
Firestore rules — which CI deploys automatically on merge to `main` — now have a
regression gate in front of that deploy.

**Post-remediation risk score: 84 / 100.** That is *lower* than Audit 1's 88 not
because the system got worse, but because this pass measured things Audit 1 did
not: bulk PII exposure, business-logic integrity, and the absence of any
monitoring or tested backup. The remaining deductions are almost entirely
operator/infrastructure actions listed in §8 — they cannot be closed from the
repository.

## 2. What this audit could NOT cover

Stated plainly, because a security report that implies more coverage than it has
is worse than no report:

| Requested | Status | Why |
|---|---|---|
| Live DAST against the production site | **Not performed** | No authorization to attack live infrastructure was established in-session; findings here are from source, which is strictly more complete for authz logic anyway. |
| Cloudflare WAF / bot / DDoS config | **Not performed** | No Cloudflare credentials or evidence Cloudflare fronts the app; the app deploys to Firebase App Hosting. |
| DNS, Vercel config | **Not performed** | Not in this repository; app is on Firebase App Hosting, not Vercel. |
| Backup restore test | **Not performed** | Requires a live Firestore export/import against a scratch project. **No backup schedule exists today** — see §8, this is the single largest unmitigated risk. |
| MFA enablement | **Not performed** | Firebase Console action, not code. |
| Firestore rules execution | **Not verified locally** | No JRE on this machine, so the emulator could not run. The rules tests are written and wired into CI; **run `npm run test:rules` once before merging.** |
| Secret rotation | **Not needed** | Scan of the working tree and full git history found no committed secret. |

## 3. Findings and fixes

### F-14 — `/api/img` open relay → script execution in our own origin · **HIGH** (CVSS 8.0)
- **OWASP:** A01 Broken Access Control / A03 Injection · **API7:2023 SSRF**
- **Vector:** `AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N`
- **File:** `src/lib/utils/imageProxy.ts`, `src/app/api/img/route.ts`
- **Before:** the proxy accepted any URL whose host was `storage.googleapis.com`,
  `*.appspot.com` or `*.firebasestorage.app`, then streamed the response back
  **copying the upstream `Content-Type` verbatim**. Every one of those
  namespaces is open to public registration.
- **Attack:** create a free GCS bucket, upload `evil.html` as `text/html`, then
  send a victim to
  `https://toonflowstudiopaint.com/api/img?u=https://storage.googleapis.com/attacker-bucket/evil.html`.
  The response is attacker HTML served from our origin, and our CSP permits
  `script-src 'unsafe-inline'` — so the script runs **as toonflowstudiopaint.com**.
  The session cookie is `HttpOnly` so it can't be read, but the script can call
  every authenticated same-origin API as the victim, read page data, and phish
  behind a genuine address bar. Secondary vector: `fetch` followed redirects, so
  an allowlisted host could bounce the request to an internal address.
- **Fix:** the allowlist is now **bucket-scoped, not host-scoped** — the target's
  bucket is resolved out of all three URL shapes (`/v0/b/<bucket>/o/…`,
  `storage.googleapis.com/<bucket>/…`, host-as-bucket) and must be one of *this
  deployment's* buckets, derived from config. Credentials in the authority and
  explicit ports are refused. The route no longer trusts upstream at all: it
  re-derives `Content-Type` from a raster allowlist (415 otherwise, so
  `text/html` and `image/svg+xml` can never exit this origin), sets
  `redirect: 'manual'`, and adds a 15 s timeout, a 30 MB streaming ceiling,
  `nosniff`, and `Content-Security-Policy: default-src 'none'; sandbox`.
- **Tests:** 17 cases in `src/lib/utils/imageProxy.test.ts`, including each
  bypass above, metadata/loopback/private-IP targets, and scheme confusion.

### F-15 — Creators could rewrite their own `viewCount`, rating and `authorId` · **HIGH** (CVSS 7.1)
- **OWASP:** A01 Broken Access Control / A04 Insecure Design
- **File:** `firestore.rules` (`novels`, `webtoons`, and their subcollections)
- **Before:** `allow update: if isOwner(resource.data.authorId) || isAdmin()`.
  The comment directly above it stated that `viewCount` and the rating aggregate
  were server-managed and "clients may not touch them" — **the rule did not
  enforce that.** An unrestricted owner write covered every field.
- **Attack:** the author of a story issues one `updateDoc` setting
  `viewCount: 9_999_999`. That field is exactly what
  `/api/creator/analytics` sums into `lifetimeViews` and converts to money via
  `viewsToCreatorInr()`, so it directly inflates reported earnings ahead of a
  withdrawal request; it also drives browse ranking, trending, and the admin
  "top content" board. The same write could set `rating: 5, ratingCount: 9999`
  (defeating the entire point of moving ratings behind `/api/ratings` in Audit 1)
  or reassign `authorId` — the anchor every ownership check keys off.
- **Fix:** new `contentServerFieldsUnchanged()` predicate; owner and admin
  updates must leave `viewCount`, `rating`, `ratingCount`, `authorId` and
  `likeCount` untouched. Writing an *identical* value is not a diff, so
  legitimate whole-object writes still pass. Applied to novels, webtoons,
  chapters and episodes; the equivalent `authorId`/`likeCount` pin was added to
  `comments`.

### F-16 — Like counts inflatable/destroyable by replay · **MEDIUM** (CVSS 5.3)
- **OWASP:** A04 Insecure Design · **API6:2023 business-flow abuse**
- **File:** `firestore.rules`
- **Before:** `likeCountBumped()` bounded the delta to ±1 but bound it to
  *nothing else*. Nothing tied the counter to the caller's own like.
- **Attack:** any signed-in user loops a single-field `likeCount: n+1` write —
  arbitrarily inflating their own story, or looping `n-1` to drive a rival's to
  zero. Ranking manipulation, at the cost of one script.
- **Fix:** the bump is now bound to the caller's like **edge**. Likes live at the
  deterministic id `{uid}_{contentType}_{contentId}`, so the rule names the exact
  document this caller's like must occupy and requires it to appear (`+1`) or
  disappear (`-1`) **in the same commit**, via `exists()`/`existsAfter()`. A
  replayed `+1` fails because the edge already exists. `toggleLike()` already
  wrote both documents in one transaction, so no client change was needed. The
  `likes` doc id is now also pinned to that format, making "one like per user per
  target" structural rather than a client convention.

### F-17 — Whole user collection, including every email and balance, publicly dumpable · **HIGH** (CVSS 7.5)
- **OWASP:** A01 Broken Access Control / A02 Cryptographic & data exposure ·
  **API3:2023 excessive data exposure**
- **File:** `firestore.rules` (`users`), `src/lib/firebase/social.ts`
- **Before:** `allow read: if true` on `users/{userId}`. A user document carries
  `email`, `balance` and `totalEarnings` next to the public profile fields, and
  `read` covers **`list`** — so one unauthenticated query returned every
  registered user's email address and wallet balance.
- **Impact:** mass email harvest — the raw material for credential stuffing and
  targeted phishing against the exact userbase — plus disclosure of every
  creator's earnings.
- **Fix:** the verb is split: `allow get: if true` (profile pages and follower
  rows read one known uid), `allow list: if isAdmin()`. `fetchProfiles()` in
  `social.ts` was the only non-admin caller that needed the collection listable;
  it now issues per-document `getDoc`s. Firestore bills per document either way,
  so this costs one round trip per uid instead of one per 30 — parallelised, over
  at most a page of followers.
- **Residual:** someone who already knows a uid can still read that one user's
  email. Fully closing it means moving the fields off the document; that is a
  money-path schema migration and is specified in §7 rather than performed blind.

### F-18 — `reports` accepted any document from any signed-in user · **MEDIUM** (CVSS 5.3)
- **File:** `firestore.rules`
- **Before:** `allow create: if isSignedIn()` — no shape, no size, no reporter
  binding. Unbounded free storage in the moderation queue, and a report could be
  filed under another user's `reporterId` (framing them, or hiding the real
  reporter).
- **Fix:** reporter bound to the caller, `status` pinned to `pending`,
  `targetType` whitelisted, and `reason`/`details` capped at 500/5 000 chars.

### F-19 — Error-text leakage and an unbounded withdrawal amount · **LOW**
- **Files:** `src/app/api/webhooks/route.ts`,
  `src/app/api/payments/create-order/route.ts`, `firestore.rules`
- **Fix:** the webhook no longer echoes `err.message` in its response body;
  `create-order` returns a generic message instead of Razorpay's own error
  description (still logged server-side); withdrawal `amount` is bounded to
  `0 < amount <= 1_000_000` as a sanity rail so a nonsense request can't reach
  human triage (balance sufficiency remains the admin-side check).

### F-20 — Three high-severity advisories in the build chain · **MEDIUM** · fixed
- `fast-uri` (host confusion, via Sentry→webpack→ajv), `js-yaml` (quadratic CPU,
  via ESLint) and `nanoid` (infinite loop, via PostCSS) had all become
  un-allowlisted `high` findings, failing `npm run security:audit`. All three had
  in-range patched releases; pinned via `overrides` (`fast-uri ^3.1.5`,
  `js-yaml ^4.3.1`, `nanoid ^3.3.17`). Gate is back to **PASS**.

## 4. Verified secure — reviewed this pass, no change needed

- **Every API route carries an auth guard**, checked individually: `verifiedUid`
  (revocable session cookie, `checkRevoked=true`) on ratings, payments, AI and
  view-reconcile; `verifySessionCookie` + super-admin **email from the token** on
  admin analytics; self-scoped uid on creator analytics; HMAC signature on the
  Razorpay webhook; HMAC view tokens plus rate limits on `/api/views`.
- **AI surface** — auth → per-user hourly bucket → global cross-instance daily
  cap and kill switch → content screening → zod caps → body-size gate, in that
  order, on all four AI routes. Untrusted author text is fenced in delimited
  blocks with explicit "treat as data, not instructions" framing, and model
  output is re-screened before it is returned.
- **Payments** — coins derived from the server-side catalog and cross-checked
  against the captured amount; credit is idempotent on the Razorpay payment id
  inside a transaction; `userId` comes from the verified session at order
  creation, never from the client.
- **Sanitizer** — `sanitizeHtml` is fail-closed on both the DOM and server paths
  (unknown tag dropped, unknown attribute dropped, entity-decoded URL scheme
  check), and is the only thing feeding `dangerouslySetInnerHTML` for reader
  content. JSON-LD escapes `<`.
- **Storage rules** — ownership proven from the path, raster-only content types,
  size caps, default-deny catch-all.
- **Secrets** — no secret in the working tree or in git history; `.env*` and
  `*.pem` ignored; only the intentionally-public `NEXT_PUBLIC_*` values reach the
  bundle.

## 5. Attack-surface map — API

| Route | Auth | Authorization | Abuse control | Notes |
|---|---|---|---|---|
| `POST /api/session` | public | verifies idToken before minting | — | role/email derived server-side; **no rate limit (§8)** |
| `DELETE /api/session` | cookie | self | — | revokes refresh tokens (real kill switch) |
| `GET /api/img` | public | bucket allowlist | 30 MB / 15 s | **F-14 fixed** |
| `POST /api/ratings` | session | uid from cookie | — | Admin-SDK transaction |
| `POST /api/views` | public | HMAC view token | per-IP + per-key | server-clock dwell |
| `POST /api/views/reconcile` | session | uid from cookie | — | zod-validated |
| `GET /api/views/stats` | session | admin | — | |
| `GET /api/creator/analytics` | session | self-scoped uid | — | private log via Admin SDK |
| `GET /api/admin/analytics` | session | super-admin **email** | — | strongest check in the app |
| `POST /api/ai/*` (4) | session | uid | hourly + global cap + kill switch | moderation in/out |
| `POST /api/payments/create-order` | session | uid | — | catalog-priced |
| `POST /api/webhooks` | HMAC | signature | idempotent | amount cross-checked |
| `POST /api/support` | public | — | per-IP + per-email | HTML-escaped email |

## 6. Regression tests added

| File | Cases | Covers |
|---|---|---|
| `src/lib/utils/imageProxy.test.ts` | 17 | F-14 — every bypass, SSRF targets, scheme/credential confusion |
| `security/firestore.rules.test.ts` | 17 | F-15 – F-19 — counter integrity, like replay, enumeration, report shape, money paths |

`npm test` (136 passing) stays emulator-free and instant. The rules suite runs
separately via `npm run test:rules` (Firestore emulator) and is wired into CI as
its own `rules` job, which the `deploy` job now **depends on** — deploy publishes
`firestore.rules`, so it must not run against a ruleset the suite rejects.

## 7. Staged migration — closing F-17 completely

Not performed here: it rewrites the schema the wallet reads from, and there is no
staging environment or emulator available in-session to verify it. Do it as its
own reviewed change.

1. Add `users/{uid}/private/account` — rules `allow read: if isOwner(uid) || isAdmin(); allow write: if false;`.
2. Backfill `email`, `balance`, `totalEarnings` into it with an Admin-SDK script; **dual-write** both locations.
3. Repoint readers: `wallet/page.tsx`, `dashboard/page.tsx`, the earnings page, and the admin users table.
4. Repoint writers: `chargeTokens` and the Razorpay webhook credit transaction.
5. Verify balances reconcile across both copies, then drop the fields from `users/{uid}` and stop dual-writing.

Rollback: stop at any step — the old fields remain authoritative until step 5.

## 8. Remaining risk — operator actions, highest first

1. **No backups.** Nothing in this repo or the Firebase config schedules a
   Firestore export. An attacker with a compromised admin credential — or a bad
   script — could delete content with no recovery path. Enable scheduled
   Firestore exports to a GCS bucket with **object retention/lock** and a
   separate access boundary, then *test a restore into a scratch project*. Until
   a restore has actually been run, recovery is unproven. **This is the single
   largest unmitigated risk.**
2. **No MFA on admin/super-admin.** The super-admin check is an email string in a
   verified token — strong, but only as strong as that one Google account.
   Enable TOTP in Firebase Auth for it today.
3. **No security monitoring or alerting.** Sentry is a dependency but there are no
   alerts on webhook signature failures, 401/403 bursts, rate-limit violations,
   role changes, or spend-cap trips. Nothing would currently *detect* an attack
   in progress — every finding above was prevention, not detection.
4. **Rate limiting is in-memory unless Upstash is configured.** The code path is
   ready; set `UPSTASH_REDIS_REST_URL`/`_TOKEN`. On multi-instance App Hosting the
   per-user AI caps are currently per-process, i.e. multiplied by instance count.
5. **No rate limit on `POST /api/session`** — cheap credential-stuffing oracle
   against Firebase Auth. Add a per-IP limit.
6. **No WAF/CAPTCHA at the edge.** Turnstile on signup and support would blunt
   mass account creation; account creation is currently unbounded.
7. **CSP still allows `script-src 'unsafe-inline'`.** This is what turned F-14
   from "serves a weird file" into "runs attacker script". A nonce-based CSP via
   middleware removes the whole class.
8. **Storage magic-byte validation.** Rules can only check the *declared*
   content type; a polyglot uploaded as `image/png` is accepted. Low impact now
   that `/api/img` pins its own response type, but an on-upload check would close it.
9. **`brace-expansion`** remains allowlisted in the audit gate (documented in
   `scripts/audit-gate.mjs`; npm's range over-matches patched releases).

## 9. Scorecard

Scored on evidence, not on the presence of a control.

| Area | Score | Basis |
|---|---:|---|
| Authentication | 82 | Revocable sessions, verified minting, enumeration-safe. −: no MFA, no throttle on session mint |
| Authorization | 88 | Server-derived roles, Admin-SDK money paths; F-15/F-16/F-17 closed and now regression-tested |
| API security | 88 | Every route guarded, zod + body caps, generic errors |
| Frontend security | 76 | Fail-closed sanitizer, safe URL handling. −: CSP `unsafe-inline` |
| Firebase rules | 86 | Least-privilege, counters server-managed, now tested. −: single-doc PII read remains |
| Database | 84 | Ownership enforced, immutable security fields, query limits |
| Storage | 80 | Owner-scoped paths, raster-only, size caps. −: no magic-byte check |
| AI security | 88 | Layered auth/rate/budget/moderation, injection-fenced prompts |
| Supply chain | 85 | Audit gate in CI, advisories cleared, lockfile committed. −: no SBOM/provenance |
| Infrastructure | 62 | HTTPS/HSTS solid. −: no WAF, no edge rate limiting |
| Monitoring | 25 | Structured server logs exist; **no alerting on any of them** |
| Incident response | 40 | Real kill switches (token revocation, AI disable). −: no written runbook until §10 |
| Backup / recovery | 15 | **No scheduled backup, no tested restore** |
| **Overall** | **84 / 100** | Prevention is strong; detection and recovery are the gap |

## 10. Incident response — first moves

| Incident | Contain | Recover |
|---|---|---|
| Account compromised | `revokeRefreshTokens(uid)` (invalidates every session cookie immediately) | reset password, re-verify email |
| **Admin compromised** | demote `users/{uid}.role` via console, revoke tokens, audit `auditLogs` | rotate `FIREBASE_PRIVATE_KEY`; review every role change since |
| Session/token leaked | revoke that uid's refresh tokens | — |
| API key leaked | rotate in Secret Manager, redeploy | check `aiUsage/{day}` for spend spike |
| AI abuse / cost run | set `AI_GENERATION_DISABLED=1` (config-only, no deploy) | lower `AI_DAILY_*_CAP` |
| Payment fraud | disable the Razorpay key | webhook is idempotent; replay is already safe |
| Data deleted / ransomware | revoke credentials, freeze writes | **restore from export — see §8.1, currently unavailable** |
| Dependency compromised | pin via `overrides`, rerun `npm run security:audit` | redeploy |

## 11. What cannot be eliminated

Screenshotting of reader content cannot be prevented — OS capture, a second
device, or a camera all defeat any web control, and any claim otherwise is
false. Treat it as content control, not a security boundary: signed expiring
media URLs and per-user watermarking raise attribution cost, nothing more.
Equally: a determined attacker who obtains a valid session cookie *is* that user
until the session is revoked — which is why detection (§8.3) matters more than
another preventive layer. **This system is not unhackable, and no control listed
here should be read as claiming it is.**

---

# Audit 1 — 2026-07-05 (historical baseline)

**Date:** 2026-07-05
**Scope:** Full application (Next.js 16 App Router, Firebase Auth/Firestore/Storage, Razorpay, Anthropic/Stability AI)
**Audit type:** Defensive enterprise security review + direct remediation
**Method:** Manual source review of every API route, middleware, Firebase rule, auth/session/crypto lib, plus `npm audit`, secrets scan, and XSS-sink review.

---

## 1. Executive Summary

Toonflow entered this audit in **good shape**. The high-value paths — session minting, token/balance accounting, and view counting — were already built defensively: sessions are minted only after `verifyIdToken`, roles are derived server-side from Firestore (never trusted from the client), token spend runs in Admin-SDK transactions that bypass client-writable rules, and view counts are gated by HMAC-signed server-clock tokens. No secrets are committed; `.env*` is git-ignored and no live keys were found in source.

The audit found **no critical remote-code-execution or authentication-bypass** vulnerabilities. It did find a cluster of **medium-severity** issues typical of a fast-moving SaaS: a missing Content-Security-Policy, Firestore/Storage rules that allowed forged authorship and cross-user asset overwrites, a stored-XSS click target in profile links, and API routes that leaked raw error text and accepted unbounded input. **All were fixed directly in this pass.**

**Post-remediation risk score: 88 / 100** (up from an estimated **68 / 100** pre-audit). Remaining points are external/operational (WAF, multi-instance rate limiting, MFA, a transitive dependency advisory) rather than code defects.

---

## 2. Risk Score

| | Score (0–100, higher = safer) |
|---|---|
| **Before this audit** | ~68 |
| **After this audit** | **88** |

Deductions remaining: distributed rate limiting (‑4), no WAF/CAPTCHA at edge (‑3), MFA not yet enforced (‑2), transitive `uuid` advisory (‑2), Storage magic-byte validation not enforceable in rules (‑1).

---

## 3. Findings & Fixes (OWASP + CVSS)

Severity uses CVSS 3.1 base vectors. All findings below are **FIXED** unless marked otherwise.

### F-1 — Missing Content-Security-Policy · MEDIUM (CVSS 5.4)
- **OWASP:** A05 Security Misconfiguration
- **Vector:** `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N`
- **File:** `next.config.js`
- **Before:** No `Content-Security-Policy`, no HSTS. Any XSS that slipped past app-level escaping could exfiltrate to any host and load arbitrary external scripts; no framing protection beyond `X-Frame-Options`.
- **Fix:** Added an enforcing CSP scoped to the exact third parties used (Firebase, Google sign-in, Razorpay): `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, allowlisted `connect/img/frame/script-src`. Added HSTS (2y, `includeSubDomains; preload`), `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `X-Frame-Options: DENY`, expanded `Permissions-Policy`.
- **Residual:** `script-src` retains `'unsafe-inline'` because Next.js App Router injects inline hydration scripts. Upgrade path (nonce via middleware) documented in §7.

### F-2 — Cross-user Storage asset overwrite (defacement) · MEDIUM (CVSS 6.5)
- **OWASP:** A01 Broken Access Control
- **Vector:** `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`
- **File:** `storage.rules`
- **Before:** `novels/{id}/cover`, `banner`, `webtoons/{id}/cover`, and episode panels allowed **any authenticated user** to write (`if isAuth()`), so user A could overwrite user B's public cover art.
- **Attack:** Sign in → `PUT` to `novels/<victimNovelId>/cover/cover.jpg` → victim's storefront shows attacker's image.
- **Fix:** Writes now require ownership via a Firestore lookup (`ownsNovel`/`ownsWebtoon` → `authorId == request.auth.uid`). Added a default-deny catch-all.

### F-3 — SVG upload (scripted-image) · MEDIUM (CVSS 5.4)
- **OWASP:** A03 Injection / A05 Misconfiguration
- **File:** `storage.rules`
- **Before:** `isImage()` matched `image/.*`, permitting `image/svg+xml`, which can embed `<script>`.
- **Fix:** Replaced with an explicit raster allowlist `image/(png|jpeg|jpg|webp|gif)`.

### F-4 — Forged authorship / counter injection on content create · MEDIUM (CVSS 5.3)
- **OWASP:** A01 Broken Access Control / A04 Insecure Design
- **File:** `firestore.rules` (`novels`, `webtoons`)
- **Before:** `allow create: if isSignedIn()` — no binding of `authorId` to the caller and no guard on counters, so a client could create content attributed to another user or seed `viewCount: 9_999_999`, bypassing the server-managed view system.
- **Fix:** Create now requires `authorId == request.auth.uid` **and** `viewCount == 0 && likeCount == 0`.

### F-5 — Comment/like impersonation + unbounded comment body · MEDIUM (CVSS 5.3)
- **OWASP:** A01 Broken Access Control
- **File:** `firestore.rules` (`comments`, `likes`)
- **Before:** `comments`/`likes` create only required `isSignedIn()` — a client could post a comment or like as another user, and comment bodies were unbounded (storage abuse).
- **Fix:** `comments` create requires `authorId == uid`, `likeCount == 0`, and `content` ≤ 5 000 chars; `likes` create requires `uid == request.auth.uid`.

### F-6 — Arbitrary follower/following-count tampering · LOW (CVSS 4.3)
- **OWASP:** A04 Insecure Design
- **File:** `firestore.rules` (`users`)
- **Before:** `onlyUpdates(['followerCount','followingCount'])` let any signed-in user set **any** user's counts to **any** value (vanity inflation / griefing).
- **Fix:** Updates bounded to exact **±1** deltas; `followingCount` is owner-only. Matches the legitimate follow batch while removing the injection primitive.

### F-7 — Forged transaction history · LOW (CVSS 3.7)
- **OWASP:** A04 Insecure Design
- **File:** `firestore.rules` (`transactions`)
- **Before:** Client could create arbitrary `transactions` docs (e.g. a fake `coin_purchase`) usable to social-engineer support. Balance was unaffected (server-managed) but history looked legitimate.
- **Fix:** `transactions` create → `if false`. All real transaction writes go through the Admin SDK (AI spend + Razorpay webhook), which bypasses rules.

### F-8 — Self-approved / negative withdrawals · LOW (CVSS 4.3)
- **OWASP:** A04 Insecure Design
- **File:** `firestore.rules` (`withdrawals`)
- **Before:** Withdrawal create allowed any amount and any `status`.
- **Fix:** Requires `amount is number > 0` and `status == 'pending'`; only admins (Admin SDK) can flip status. Balance sufficiency remains an admin-side check.

### F-9 — Stored XSS via profile "website" link · MEDIUM (CVSS 6.1)
- **OWASP:** A03 Injection (XSS)
- **Vector:** `AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N`
- **File:** `src/app/(main)/profile/[uid]/ProfilePageClient.tsx`
- **Before:** `<a href={profile.socialLinks.website}>` rendered a user-controlled value unchecked. A creator setting `website` to `javascript:…` created a click-to-execute XSS in any visitor's session.
- **Fix:** New `safeHttpUrl()` (`src/lib/utils/url.ts`) normalizes to `http(s)` and returns `null` for `javascript:`/`data:`/other schemes; the link only renders when safe and carries `rel="noopener noreferrer nofollow ugc"`. (Twitter/Instagram links were already safe — hard-coded scheme + host.)

### F-10 — Verbose error leakage from API routes · LOW (CVSS 4.3)
- **OWASP:** A05 Misconfiguration / A09 Logging
- **Files:** `api/ai/{novel-assist,novel-content,generate-image}`, `api/payments/create-order`
- **Before:** Catch blocks returned raw `err.message` to the client — could surface upstream provider internals.
- **Fix:** All return generic messages; full detail is logged server-side only.

### F-11 — Unbounded AI request input (cost/DoS) · MEDIUM (CVSS 5.3)
- **OWASP:** A04 Insecure Design / API4:2023 Unrestricted Resource Consumption
- **Files:** `api/ai/{novel-assist,novel-content,generate-image}`
- **Before:** Bodies parsed without schema/size limits; `history` and `previousChapters` arrays and long strings were forwarded to the model. Token charging capped *some* cost, but body size and array length were unbounded.
- **Fix:** Added `zod` schemas with per-field `.max()` length caps and array caps, plus a `content-length` gate (`bodyTooLarge`, 64 KB / 512 KB). Invalid input → `400`, oversize → `413`.

### F-12 — Support auto-reply HTML injection + weak throttle · LOW (CVSS 3.1)
- **OWASP:** A03 Injection
- **File:** `api/support/route.ts`
- **Before:** User `name` interpolated into the HTML email unescaped; rate limit was per-email only (attacker rotates emails).
- **Fix:** `escapeHtml(name)` before templating; added a per-IP limit (8 / 10 min) in front of the per-email cap, plus a 16 KB body gate.

### F-13 — Transitive `uuid` advisory · LOW · **ACCEPTED RISK (monitor)**
- **OWASP:** A06 Vulnerable & Outdated Components
- **Advisory:** GHSA-w5hq-g745-h8pq (buffer-bounds in `uuid` v3/5/6), pulled in via `firebase-admin` → `@google-cloud/storage` → `gaxios/teeny-request` → `uuid`.
- **Reachability:** Not reachable in our usage (the vulnerable path requires passing a `buf` argument to `uuid`, which we never do). `npm audit fix --force` downgrades `firebase-admin` (breaking). Left pending a non-breaking `firebase-admin` release.

---

## 4. Areas reviewed and found already secure (no change needed)

- **Session mint (`/api/session`)** — `verifyIdToken` before any cookie; role from Firestore + super-admin email override; cookies `HttpOnly`, `Secure` (prod), `SameSite=Lax`. `SameSite=Lax` also blocks cross-site CSRF on the JSON API routes (cookie withheld on cross-site `fetch`).
- **Token accounting (`src/lib/tokens.ts`)** — Admin-SDK transaction, atomic read-then-decrement (no TOCTOU), fails closed.
- **Razorpay webhook** — constant-time HMAC verification; coins derived from the trusted catalog, not the payment amount; idempotent credit keyed on payment id inside a transaction.
- **View pipeline** — HMAC-signed view tokens, server-clock dwell (client can't fake time), bot heuristics, same-origin/CSRF guard, sliding-window rate limits, private analytics collections (`if false` to clients).
- **Reader HTML** — chapter bodies pass through the allowlist sanitizer (`sanitizeHtml`) before `dangerouslySetInnerHTML`; comments render as escaped text.
- **Middleware (`src/proxy.ts`)** — `/admin`, `/admin/super`, and authed-user gates on server-derived cookies.
- **Secrets** — none committed; `.env*` git-ignored; `*.pem` ignored.

---

## 5. Attack Scenarios (pre-fix → now blocked)

1. **Content defacement:** attacker overwrites a rival creator's cover art via Storage → **blocked** (owner-only writes, F-2).
2. **Profile-link XSS:** creator sets `website=javascript:fetch('/api/session',{method:'DELETE'})`; a visitor clicks → **blocked** (scheme validation, F-9).
3. **View-count fraud:** creator seeds `viewCount: 10_000_000` at novel creation to inflate earnings/ranking → **blocked** (counter guard, F-4).
4. **Comment impersonation:** post a defamatory comment as another user's `authorId` → **blocked** (authorId binding, F-5).
5. **AI cost bomb:** send a 50 MB `history` array to `/api/ai/novel-assist` → **blocked** (body gate + zod caps, F-11).
6. **Support spam / HTML-injected email:** mass-submit with rotating emails and a `<script>`-laden name → **throttled per-IP + escaped** (F-12).

---

## 6. Before / After — headers

| Header | Before | After |
|---|---|---|
| Content-Security-Policy | *(none)* | scoped allowlist, `object-src 'none'`, `frame-ancestors 'none'` |
| Strict-Transport-Security | *(none)* | `max-age=63072000; includeSubDomains; preload` |
| Cross-Origin-Opener-Policy | *(none)* | `same-origin-allow-popups` |
| X-Frame-Options | `SAMEORIGIN` | `DENY` |
| Permissions-Policy | `camera/mic/geo` only | + topics, FLoC, usb, serial, bluetooth off; payment scoped |
| X-Content-Type-Options | `nosniff` | `nosniff` (kept) |

---

## 7. Remaining Risks & Recommendations (not code-fixable here)

1. **Rate limiting is per-instance (in-memory).** Fine for single-instance/small deploys; on Vercel's multi-instance runtime, move `checkRateLimit` behind **Upstash Redis** (interface is already isolated in `src/lib/views/rateLimit.ts`).
2. **CSP `'unsafe-inline'` on scripts.** Upgrade to a **nonce-based CSP**: generate a per-request nonce in `src/proxy.ts`, pass via header, and set `script-src 'self' 'nonce-…'`. Requires widening the middleware matcher to all routes — test hydration carefully.
3. **Edge protection.** Put **Cloudflare (WAF + Bot Management + rate rules)** or Vercel's firewall in front; add **CAPTCHA/Turnstile** on signup and support to blunt mass account creation and credential stuffing.
4. **MFA.** Firebase Auth supports TOTP/SMS second factor — enable for admin/superadmin at minimum.
5. **Storage magic-byte validation.** Rules can't inspect file bytes; add a Cloud Function (or on-upload check) to verify magic bytes match the content-type and reject polyglots.
6. **Monitoring.** Wire **Sentry** (client+server) and **Google Cloud Monitoring** alerts on: webhook signature failures, `logSuspiciousActivity` spikes, 402/429 bursts, and admin-role changes (`auditLogs`).
7. **Dependency hygiene.** Track `firebase-admin` for a release that clears GHSA-w5hq-g745-h8pq; run `npm audit` in CI.

---

## 8. Security Checklist

- [x] Sessions verified server-side (`verifyIdToken`) before cookie mint
- [x] Roles derived server-side, never from the client body
- [x] Cookies `HttpOnly` + `Secure` (prod) + `SameSite=Lax`
- [x] CSRF mitigated (SameSite cookies + same-origin guard on view API)
- [x] CSP, HSTS, COOP, frame/permissions headers enforced
- [x] Firestore rules: authorship bound, counters server-managed, least privilege
- [x] Storage rules: owner-only writes, raster-only, size caps, default-deny
- [x] No stored/DOM/reflected XSS sinks unescaped (sanitizer + URL validation)
- [x] API input validated (zod) + body-size capped + generic errors
- [x] Payment webhook: signature-verified + idempotent + catalog-priced
- [x] Secrets in env only; `.env*` git-ignored; `.env.example` documents all keys
- [ ] Distributed rate limiting (Redis) — *recommended*
- [ ] WAF / CAPTCHA at edge — *recommended*
- [ ] MFA for admins — *recommended*
- [ ] Sentry + Cloud Monitoring alerts — *recommended*

## 9. Production Deployment Checklist

- [ ] Set all server secrets in the host (not `.env.local`): `FIREBASE_*`, `ANTHROPIC_API_KEY`, `STABILITY_API_KEY`, `RAZORPAY_*`, `VIEW_TOKEN_SECRET` (`openssl rand -hex 32`), `GMAIL_APP_PASSWORD`.
- [ ] `firebase deploy --only firestore:rules,storage --project toonflow-studio-paint-f384c` to publish the hardened rules.
- [ ] Register the Razorpay webhook and confirm `RAZORPAY_WEBHOOK_SECRET` matches.
- [ ] Enable HSTS preload submission only after confirming all subdomains are HTTPS.
- [ ] Turn on Cloudflare/Vercel WAF + rate rules; add Turnstile to signup/support.
- [ ] Verify CSP in report-only first if adding a nonce; watch the browser console for blocks.
- [ ] Confirm `npm audit` gate in CI and Sentry DSN wired.
