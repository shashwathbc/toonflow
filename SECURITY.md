# Toonflow Studio Paint — Security Audit Report

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
