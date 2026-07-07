# Toonflow Studio Paint — Engineering Handover & Architecture Documentation

**Version:** 1.0 · **Date:** 2026-07-06 · **Audience:** incoming engineering team
**Repo root:** `d:\toonflow` · **Firebase project:** `toonflow-studio-paint-f384c`

> Companion documents: [01-project-scan](01-project-scan.md), [02-architecture](02-architecture.md), [03-feature-audit](03-feature-audit.md), [04-quality-security-performance](04-quality-security-performance.md), [05-seo-ai-deployment-testing-product](05-seo-ai-deployment-testing-product.md), [06-todo-roadmap-report](06-todo-roadmap-report.md), [view-tracking](view-tracking.md), and the root [SECURITY.md](../SECURITY.md) audit (2026-07-05). This document is the consolidated, current-state handover.

---

## 1. Executive Summary

**What it is.** Toonflow Studio Paint is a professional webtoon / manga / web-novel SaaS platform: readers browse and read serialized content; creators write novels (rich-text editor with AI assistance) and assemble webtoon episodes (panel-strip editor with drag-and-drop); the platform monetizes through a token ("coin") economy with AI feature spend and Razorpay purchases, with a 70/30 creator/platform revenue split planned.

**Business goals.**
1. Reader acquisition through free public reading (novels + webtoons).
2. Creator acquisition through a zero-install browser studio (novel editor + webtoon episode builder + AI tools).
3. Monetization: token purchases (Razorpay, INR), AI feature spend, premium chapter unlocks and creator payouts (wallet currently feature-flag-locked).

**Core features (shipped).**
- Public catalog: home, browse (genre/status/sort filters), originals, title pages, chapter/episode readers.
- Full auth: email/password + Google sign-in, server-verified session cookies, role-gated middleware.
- Creator studio: novel CRUD + TipTap rich-text chapter editor + PDF export (jspdf); webtoon CRUD + panel upload/reorder (dnd-kit) with mandatory branded intro/outro pages.
- AI pipeline: synopsis generate/improve/expand and writing assistance (Claude Haiku 4.5), image prompt + image generation (Stability AI), all token-metered server-side.
- Engagement: likes, ratings (1–5), comments, follows, bookmarks, reading history.
- Server-validated view counting (two-phase signed-token protocol, bot detection, rate limiting, 24h dedup).
- Admin + super-admin consoles: platform stats, user/content moderation, reports, support inbox, business analytics (recharts), platform settings, audit logs.
- Support flow: modal → `/api/support` → Firestore inbox + Gmail auto-reply.
- PWA: manifest + hand-rolled service worker (offline page fallback, static asset caching).

**Current status.** Feature-complete beta. `webtoonStudio` flag ON, `wallet` flag OFF (payments code is complete but gated). **No automated tests, no CI/CD pipeline, no error-tracking service.** Security was audited and remediated 2026-07-05 (88/100). ~150 TS/TSX source files, ~23.4k LOC.

**Architecture in one paragraph.** A single Next.js 16 App Router application (Turbopack for dev *and* build) serving five route groups; Firebase Auth/Firestore/Storage as the primary backend, accessed from the browser through a typed service layer guarded by hardened Firestore/Storage rules; and 10 Node.js API route handlers for everything requiring trust: session minting, AI calls with token charging (Firebase Admin SDK transactions), Razorpay order creation + webhook crediting, server-validated view counting, support intake, and super-admin analytics. Middleware (`src/proxy.ts`) enforces route-level access from server-set cookies.

---

## 2. Frontend Documentation

| Concern | Technology | Where | Why / notes |
|---|---|---|---|
| Framework | **Next.js 16.2.9** (App Router, `src/`, `@/*` alias) | whole app | RSC + route groups + built-in image/font/SEO primitives. Dev **and** build run Turbopack — never add webpack-only plugins. |
| UI runtime | **React 19.2.4** | whole app | Server Components by default; `'use client'` only where hooks/events are needed. |
| Language | **TypeScript 5, strict** | whole app | Domain types in `src/types/` (user, novel, webtoon, comment, transaction). |
| CSS | **Tailwind CSS 3.4.19** + `tailwind-merge`/`clsx` via `cn()` (`src/lib/utils/cn.ts`) | whole app | Design tokens only (`bg-bg`, `text-text-secondary`, `bg-accent` #00C896…). **v4 syntax (`@theme`, `@utility`) is forbidden.** Plugin: `tailwind-scrollbar`. |
| UI primitives | **Radix UI** (avatar, dialog, dropdown, scroll-area, select, tabs, tooltip) | `components/ui`, editors, admin | Unstyled + accessible; styled with tokens. Alternative considered: full component kits (MUI/Chakra) — rejected for bundle/design control. |
| Icons | **lucide-react 1.21** | everywhere | Tree-shakable. No brand icons in lucide (known gotcha — social icons hand-rolled). |
| State | **Zustand 5 + persist** (`src/store/useAppStore.ts`) | reader font size, browse filters, mobile nav, search query, login modal | Tiny global store; only `fontSize` + `browseFilters` persisted to `localStorage` (`toonflow-prefs`). |
| Auth state | **React Context** (`src/contexts/AuthContext.tsx`) | app-wide | `onIdTokenChanged` keeps the session cookie fresh; Firestore SDK dynamically imported so signed-out visitors never download it. |
| Server state | Custom hooks (`useNovels`, `useWebtoons`, `useChapters`, `useEpisodes`, `useFirestore`, `useInfiniteScroll`) | pages | Thin wrappers over the Firestore service layer. No React Query/SWR — acceptable now; consider TanStack Query if cache invalidation grows hairy. |
| Forms | **react-hook-form 7.80** + **zod 4** via `@hookform/resolvers` | auth, studio forms | Schema-first validation shared client/server style. |
| Rich text | **TipTap 3.27** (starter-kit, underline, text-align, color, character-count, placeholder) | `components/editor/NovelRichEditor.tsx` | Chapter authoring. Output sanitized before render (see §7). |
| Drag & drop | **dnd-kit** (core/sortable/utilities) | webtoon panel ordering | Accessible DnD, no HTML5-DnD quirks. |
| Charts | **recharts 3.9** | `components/admin/AdminCharts.tsx`, `BusinessCharts.tsx` | Admin/super-admin analytics only (keeps it out of public bundles). |
| Animations | **Framer Motion 12** | home, transitions, editors | Declarative; respect `prefers-reduced-motion` where used. |
| PDF export | **jspdf 4.2** | novel editor page | Client-side chapter/manuscript export. |
| Toasts | **react-hot-toast** | root layout | Styled to dark theme in `app/layout.tsx`. |
| Images | **next/image** with AVIF/WebP, remote patterns for Firebase Storage / Google avatars / GitHub / picsum | catalog, readers | `minimumCacheTTL: 3600`. Panels up to 25 MB served from Firebase Storage — see §14 for the resizing recommendation. |
| Fonts | **next/font** — Inter, `display: swap`, CSS variable | root layout | Self-hosted by Next; no external font requests (CSP-friendly). |
| A11y | WCAG conventions enforced by CLAUDE.md | everywhere | Skip-link in root layout; focus-visible rings; aria-labels on icon buttons; tab semantics; 4.5:1 contrast tokens. |
| SEO | Metadata API (template titles, OG/Twitter cards, `metadataBase`), `src/app/robots.ts`, `src/app/sitemap.ts` | root + pages | OG image at `public/og-image.png`. Content pages are largely client-rendered — see §14/§26 for SSR recommendation. |
| PWA | `public/manifest.json` + hand-rolled `public/sw.js` + `components/pwa/PwaRegister.tsx` | global | Prod-only registration; dev unregisters stale workers. **next-pwa was deliberately removed** (webpack-only). |

**Not used (by design):** Redux, styled-components, Apollo/GraphQL clients, canvas libraries (webtoon "paint" is image-upload based today), Storybook.

---

## 3. Backend Documentation

- **Runtime:** Node.js via Next.js route handlers — every handler pins `export const runtime = 'nodejs'` (Admin SDK + `crypto` + nodemailer are Node-only; do not move these to edge).
- **API style:** REST-ish JSON over 10 route handlers. No GraphQL, no WebSockets (Firestore's client SDK provides realtime where needed), no background job system (webhook + request-time work only).
- **Framework conventions:** all trusted mutations go through the **Firebase Admin SDK** (`src/lib/firebase/serverApp.ts` — lazy singleton from `FIREBASE_*` env). Client-side Firestore access goes through the service layer (`src/lib/firebase/*`), never raw in components.

### Middleware — `src/proxy.ts`
Next 16 "proxy" convention (**never create `middleware.ts`** — it conflicts). Matcher: `/create/**`, `/dashboard/**`, `/admin/**`, `/wallet/**`.
1. `/admin/super/**` → requires auth cookie **and** email cookie `== SUPER_ADMIN_EMAIL`.
2. `/admin/**` → requires role cookie in `['admin','superadmin']`.
3. `/create/webtoon/**` → redirects to `/coming-soon` when `FEATURE_FLAGS.webtoonStudio` is off (currently on).
4. `/create|/dashboard|/wallet` → requires auth cookie, else redirect to `/login?redirect=…`.

Cookies are informational for *routing*; every API route re-verifies the ID token cryptographically (`verifiedUid()` in `src/lib/auth/serverUser.ts`) — middleware is a UX gate, the Admin SDK check is the security boundary.

### Cross-cutting server utilities
| Utility | File | Purpose |
|---|---|---|
| `verifiedUid(req)` | `lib/auth/serverUser.ts` | Verify Firebase ID token from the httpOnly cookie; `null` on any failure. **The uid never comes from a request body.** |
| `chargeTokens(uid, action, desc)` | `lib/tokens.ts` | Atomic Admin-SDK transaction: balance check → decrement → transaction log. Fails closed. |
| `bodyTooLarge`, `escapeHtml` | `lib/api/guard.ts` | Content-length gate (64 KB AI / 16 KB support), HTML-escape for email templates. |
| `checkRateLimit(key, limit, window)` | `lib/views/rateLimit.ts` | In-memory sliding window + temp blocking. **Per-instance only** — swap for Redis/Upstash before multi-instance deploy (interface is a single function). |
| Bot detection / IP | `lib/views/botDetection.ts` | UA heuristics, webdriver flag, same-origin check, client IP extraction. |
| HMAC crypto | `lib/views/crypto.ts` | Signed view tokens + signed anonymous visitor cookie; salted hashes for IP/UA/visitor. Secret: `VIEW_TOKEN_SECRET` (falls back to hash of `FIREBASE_PRIVATE_KEY`). |

- **Logging:** `console.error/warn` with `[route]` prefixes only. No structured logging, no log drain. `@opentelemetry/api` is in `package.json` but **unused in `src/`** (see §22).
- **Error handling:** every route catches, logs details server-side, returns generic messages (fixed in audit F-10). View route intentionally returns `200 {counted:false}` on rejections to avoid giving abusers an oracle.
- **Validation:** zod schemas on AI + view routes with `.max()` caps; manual field clamps on support; catalog-validated packages on payments.
- **Versioning:** none (`/api/*` v1 implicit). Fine at this scale; introduce `/api/v2` only on breaking change.
- **File uploads:** browser → Firebase Storage directly (rules-enforced, §7). No server-side image processing pipeline (no resizing/thumbnailing — flagged in §14).

---

## 4. Database Documentation (Firestore)

Primary store: **Cloud Firestore** (NoSQL, document model). Bucket: `toonflow-studio-paint-f384c.firebasestorage.app`.

### Collections

| Collection | Doc id | Written by | Read | Purpose |
|---|---|---|---|---|
| `users/{uid}` | auth uid | client (profile fields only) + Admin SDK (balance/role) | public | Profile, role, `isCreator`, counters, `balance`, `totalEarnings` |
| `novels/{id}` | auto | owner client | public | Novel metadata + denormalized counters (`viewCount`, `likeCount`, `rating`, `chapterCount`) |
| `novels/{id}/chapters/{id}` | auto | owner client | public | Chapter content (sanitized HTML), `wordCount`, premium flags |
| `webtoons/{id}` | auto | owner client | public | Webtoon metadata + counters |
| `webtoons/{id}/episodes/{id}` | auto | owner client | public | `panels: PanelImage[]`, intro/outro meta, premium flags |
| `comments/{id}` | auto | author client | public | ≤5000 chars, authorId bound to caller |
| `likes/{id}`, `ratings/{id}`, `follows/{id}` | auto | owner client | public/auth | Engagement records, uid-bound |
| `bookmarks/{uid}/items`, `readingHistory/{uid}/items` | per-user | owner only | owner only | Library + resume state |
| `transactions/{id}` | auto / `rzp_{paymentId}` | **server only** | owner+admin | AI spend + coin purchases; webhook idempotency key |
| `withdrawals/{id}` | auto | creator create (`pending` only) | owner+admin | Payout requests; admin flips status |
| `reports/{id}` | auto | any signed-in | admin | Moderation queue |
| `supportRequests/{id}` | auto | **server only** | admin | Support inbox |
| `auditLogs/{id}` | auto | admin | admin | Admin action trail |
| `settings/platform` | fixed | admin | admin | Maintenance mode, signup toggle, AI quotas, announcement banner |
| `viewDedup`, `chapterViews`, `viewStats(+/daily)`, `suspiciousViews` | hashed / auto | **server only** | none / admin | Tamper-proof view pipeline (§ view-tracking.md) |

### ER sketch

```
users 1──∞ novels 1──∞ chapters          users 1──∞ webtoons 1──∞ episodes
  │           ▲                             │
  │           └── comments (targetId) ──────┘
  ├──∞ likes / ratings / follows / bookmarks / readingHistory
  ├──∞ transactions (server-written)     ├──∞ withdrawals
  └── viewDedup / chapterViews reference content + hashed viewer
```

- **Relationships:** by-reference (`authorId`, `novelId`, `targetId`) + denormalized display fields (`authorName`, `authorPhotoURL`) — standard Firestore trade-off; renames require fan-out updates (currently not implemented — acceptable, flag as debt).
- **Indexes:** 5 composites in `firestore.indexes.json` (chapterViews ×3, supportRequests ×2). Deploy with `firebase deploy --only firestore:indexes --project toonflow-studio-paint-f384c` (the `--project` flag is required — no default alias).
- **Constraints/validation:** enforced in security rules (counter seeding blocked, ±1 follower deltas, comment length, rating 1–5, withdrawal `pending`+positive) — see §7.
- **Query patterns to watch:** admin list screens fetch `limit(n*2)` then filter/sort client-side (`lib/firebase/admin.ts`) — fine to ~10k docs, needs server-side search (Algolia/Typesense) beyond that. `getAllUsers` deliberately avoids `orderBy('createdAt')` because Firestore drops docs missing the field.
- **Backup/recovery:** **none configured.** Recommendation (P1): enable Firestore PITR + scheduled exports to a GCS bucket (`gcloud firestore export` via Cloud Scheduler), and versioning on the Storage bucket.

---

## 5. Authentication

**Provider:** Firebase Auth (email/password + Google OAuth popup). Client helpers in `lib/firebase/auth.ts`; UI in `(auth)/login`, `(auth)/signup`.

### Flow

```
Browser                            Next.js server                     Firebase
  │ signIn (email/pw or Google)──────────────────────────────────────► Auth
  │ ◄──────────────────────────────────────────────── ID token (1h TTL)
  │ onIdTokenChanged fires (sign-in, sign-out, hourly refresh)
  │ POST /api/session {idToken} ──► verifyIdToken (Admin SDK)
  │                                 role ◄── Firestore users/{uid}
  │                                 (email == SUPER_ADMIN_EMAIL ⇒ superadmin)
  │ ◄── Set-Cookie ×3 (7d, SameSite=Lax, Secure in prod)
  │      toonflow-auth-token  (httpOnly — the raw ID token)
  │      toonflow-user-role   (middleware routing hint)
  │      toonflow-user-email  (middleware routing hint)
  │
  │ …later, any API call: cookie → verifyIdToken again (server truth)
  │ Sign-out: DELETE /api/session → cookies cleared
```

Key properties:
- **Server never trusts the client** for role/email — they're derived from the verified token + Firestore inside `/api/session` (`src/app/api/session/route.ts`). A lookup failure falls back to `user`, never elevates.
- The cookie stores the **ID token itself** and is re-minted on every hourly Firebase refresh (`AuthContext` calls `/api/session` on each `onIdTokenChanged`), so the 7-day cookie never holds a stale token for long. Note: an ID token is only *valid* for 1 h — middleware only checks cookie presence (routing), while APIs verify cryptographically, so an expired cookie degrades to "anonymous" safely.
- First sign-in: `createUserDocument()` provisions `users/{uid}` (role `user`, balance 0).
- **Password reset:** `sendPasswordResetEmail` (Firebase-hosted flow). **Email verification: not enforced. MFA/2FA: not enabled** (Firebase supports TOTP/SMS — enable in console + UI work; readiness: moderate).
- No custom refresh tokens/JWTs — Firebase rotation is the mechanism. Consider migrating the cookie to Firebase **session cookies** (`createSessionCookie`, up to 14 d, revocable) as a hardening upgrade.

---

## 6. Authorization

**RBAC roles:** `user` → `creator` → `admin` → `superadmin` (`isCreator` is a convenience boolean set for creator+). Super admin is **pinned to one email** (`shashwathbc@gmail.com` in `lib/utils/constants.ts`) — both a safeguard and a single point of failure; move to a custom claim before adding a second operator.

### Access matrix

| Capability | Anon | User | Creator | Admin | Super |
|---|---|---|---|---|---|
| Read published content, profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| Like / rate / comment / follow / bookmark / report | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create & edit **own** novels/webtoons + upload assets | ❌ | ✅* | ✅ | ✅ | ✅ |
| Spend AI tokens / buy coins | ❌ | ✅ | ✅ | ✅ | ✅ |
| Request withdrawal (`pending` only) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Moderate content/users/reports/support, platform settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| Role assignment, seed tools, business analytics API | ❌ | ❌ | ❌ | ❌ | ✅ |
| Write `balance` / `role` / `viewCount` / `transactions` | ❌ | ❌ | ❌ | ❌ | ❌ (server only) |

\* `/create` requires only auth today; the `creator` role is a product distinction, not yet an enforcement boundary.

**Enforcement layers (defense in depth):** UI (`useAuth()` flags) → middleware cookies (routing) → Firestore/Storage rules (client data plane) → Admin-SDK routes with `verifyIdToken` (money, views, analytics). The three admin surfaces independently re-check: middleware cookie, client `isAdmin`, and rules `isAdmin()` (Firestore role lookup).

---

## 7. Security Documentation

A full audit was performed 2026-07-05 and remediated in-place — see [SECURITY.md](../SECURITY.md) (findings F-1…F-13, before/after, CVSS vectors). **Post-remediation score: 88/100.** Summary of current posture plus this review's additions:

### Verified strong
- **AuthN/session:** cookies minted only after `verifyIdToken`; role from Firestore; httpOnly/Secure/Lax. `SameSite=Lax` + JSON-only POSTs is the CSRF story (no cross-site form posts exist; `form-action 'self'` in CSP). View route additionally enforces same-origin.
- **Money paths:** balance/role/totalEarnings are client-unwritable (rules); AI spend is an atomic Admin transaction (no TOCTOU); Razorpay webhook uses constant-time HMAC compare, derives coins from the **server catalog** (never the paid amount), idempotent on `rzp_{paymentId}`; `create-order` binds the verified uid into order notes.
- **View integrity:** HMAC tokens, server-clock dwell, signed visitor cookie, layered rate limits, hashed IP/UA (no raw PII in analytics docs), client-inaccessible collections.
- **Rules:** authorship bound to caller; counters unseedable; ±1 follower deltas; comment cap 5 000; withdrawals pending-only; storage owner-only, raster-image allowlist (SVG blocked), 10/25 MB caps, default-deny catch-all.
- **XSS:** chapter HTML passes an allowlist sanitizer (`lib/utils/sanitizeHtml.ts`) before `dangerouslySetInnerHTML`; profile `website` normalized by `safeHttpUrl()` (blocks `javascript:`/`data:`); support email templates HTML-escaped.
- **Headers (next.config.js):** enforcing CSP (self + Firebase/Google/Razorpay only, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`), HSTS 2y preload, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, COOP `same-origin-allow-popups`, tight Permissions-Policy.
- **Secrets:** `.env*` git-ignored; `.env.example` documents every var; no secrets in source (verified by audit scan).

### Known residual risks (ordered)

| # | Issue | Severity | Risk / attack | Fix |
|---|---|---|---|---|
| R1 | **No tests/CI** guarding the security-critical rules & routes | High (process) | A refactor silently re-opens F-4/F-7-class holes | §18 plan: rules unit tests (`@firebase/rules-unit-testing`) + route tests in CI as merge gate |
| R2 | **In-memory rate limiting** | Medium | Multi-instance deploy ⇒ limits become per-pod, effectively ÷N; instance restart clears blocks | Upstash/Redis behind `checkRateLimit` (single call site to swap) |
| R3 | CSP `script-src 'unsafe-inline'` | Medium | An HTML-injection foothold could execute inline script | Nonce-based CSP via proxy (documented upgrade path in SECURITY.md §7) |
| R4 | ID-token-as-cookie (7 d) vs Firebase **session cookies** | Medium | Stolen cookie usable ≤1 h (token expiry) — bounded, but revocation is coarse | `adminAuth().createSessionCookie()` + `verifySessionCookie(checkRevoked)` |
| R5 | No WAF/CAPTCHA/edge bot protection | Medium | Credential stuffing, scripted signups, AI-cost probing | Cloudflare in front (WAF + Turnstile on signup/support) or Vercel WAF |
| R6 | MFA not offered; email verification not enforced | Medium | Account takeover on reused passwords, throwaway-email abuse | Firebase MFA (TOTP) for admin+creator; `emailVerified` gate for creation |
| R7 | 8 moderate `npm audit` advisories — transitive `uuid` (via firebase-admin→gcs) & `postcss` (via next) | Low | Neither reachable in our usage (audit F-13) | Track upstream; re-audit on `firebase-admin`/`next` bumps |
| R8 | Super-admin = hardcoded email | Low | Single account compromise = full control; no break-glass second admin | Custom claim + enforced MFA |
| R9 | Storage content sniffing only via `contentType` | Low | Mislabelled file bytes (rules can't magic-byte check) | Post-upload Cloud Function validation or upload proxy |
| R10 | No DDoS story beyond per-route limits | Low→Med at scale | Volumetric attack cost | Comes free with Cloudflare/Vercel edge (R5) |

Injection review: no SQL (no relational DB); NoSQL injection not applicable (typed SDK params, ids regex-validated `^[A-Za-z0-9_-]+$`); SSRF — no user-supplied URL fetches server-side; open redirects — `login?redirect=` is path-used only; directory traversal — no filesystem serving beyond Next static. **Prompt injection:** user text is embedded in AI prompts (synopsis/assist). Blast radius is inherently low (output returns to the same user; no tools/functions exposed to the model) — keep it that way: never add tool-use to these endpoints without an isolation review.

---

## 8. Storage Documentation

| Layer | What lives there | Lifecycle / notes |
|---|---|---|
| **Firestore** | All domain data (§4) | No TTL policies; viewDedup docs are rolling-window keyed (consider TTL on `viewDedup`/`chapterViews` >180 d) |
| **Firebase Storage** | `users/{uid}/avatar|banner`, `novels/{id}/cover|banner`, `webtoons/{id}/cover`, `webtoons/{id}/episodes/{eid}/*` | Owner-write via rules; raster only; 10 MB (25 MB panels). **No cleanup job** — deleting a novel/webtoon orphans its files (debt: delete-cascade Cloud Function) |
| **localStorage** | `toonflow-prefs` (font size, browse filters — Zustand persist) | Non-sensitive only. Firebase Auth SDK also persists its own session (IndexedDB) |
| **Cookies** | 3 session cookies (§5), `tf_vid` signed anonymous visitor id (1 y, httpOnly) | httpOnly where secret-bearing |
| **Service-worker caches** | `tf-static-v1` (cache-first: `/_next/static`, icons, images), `tf-pages-v1` (network-first navigations) | Bump `CACHE_VERSION` in `public/sw.js` per deploy to invalidate. `/api/*` and cross-origin **never intercepted** |
| **CDN/browser cache** | `/icons`, `/images`, `/og-image.png` → `immutable, max-age=1y`; Next static assets content-hashed | Set in `next.config.js` headers |
| **In-memory (server)** | Rate-limit buckets (`lib/views/rateLimit.ts`), request cache (`lib/utils/requestCache.ts`) | Lost on restart — by design, see R2 |

Encryption: all Google-managed at rest (Firestore/Storage) + TLS in transit. No client-side encryption needs identified.

---

## 9. Cloud Infrastructure

**Current reality:** the repo configures **Firebase (Auth/Firestore/Storage) only** — `firebase.json` has no hosting target, there is no `vercel.json`, no Dockerfile, no IaC. App hosting is therefore an operational decision that lives outside the repo; the app is Vercel-shaped (Next 16, image optimization, edge headers).

```
                 ┌────────────────────────────────────────────────┐
 Browser/PWA ───►│  Vercel (recommended) — Next.js 16 app          │
   │             │  • static/ISR assets on edge CDN                │
   │             │  • src/proxy.ts (route gating)                  │
   │             │  • /api/* Node functions                        │
   │             └──────┬──────────────┬───────────┬──────────────┘
   │ (client SDK)       │ Admin SDK    │ HTTPS     │ SMTP
   ▼                    ▼              ▼           ▼
 Firebase Auth      Firestore      Anthropic    Gmail (nodemailer)
 Firebase Storage   (+rules)       Stability
   ▲                               Razorpay ──webhook──► /api/webhooks
   └── direct upload/read (rules-enforced)
```

- **Deploy flows:** app → `next build` (Turbopack) then host deploy (manual today); rules/indexes → `firebase deploy --only firestore:rules,firestore:indexes,storage --project toonflow-studio-paint-f384c` (**explicit `--project` required**).
- **DNS/SSL/CDN:** provided by the eventual host; HSTS preload is already set, so HTTPS must be non-negotiable from day one.
- **Regions:** Firestore region fixed at project creation; keep compute (Vercel region) close to it and to the India-first user base (e.g. `bom1`).
- **Recommendation:** Vercel + Cloudflare (DNS/WAF) in front; document the choice in the repo once made.

---

## 10. API Documentation

All endpoints JSON, cookie-authenticated (httpOnly ID token) unless noted. Global errors: `400` invalid input, `401` unauthenticated, `402` insufficient tokens, `403` forbidden, `413` oversized, `429` throttled, `5xx` generic (details server-logged only).

| # | Method & route | Auth | Request (validated) | Response | Notes |
|---|---|---|---|---|---|
| 1 | `POST /api/session` | idToken in body | `{idToken}` | cookies ×3 + `{status:'ok'}` | verifyIdToken → role from Firestore; super-admin email override |
| 2 | `DELETE /api/session` | — | — | clears cookies | sign-out |
| 3 | `POST /api/views` (begin) | optional | zod: `{phase:'begin', contentType, contentId, parentId, webdriver?}` (ids `^[\w-]{1,128}$`) | `{token}` + sets `tf_vid` | same-origin required; 120/10 min/IP; bot-check |
| 4 | `POST /api/views` (complete) | optional | zod: `{phase:'complete', token, sessionId, engagementDurationMs, scrollPercentage, …}` | `{counted: bool}` | HMAC token bound to visitor+content; server dwell ≥20 s or ≥50 % scroll + 8 s; 24 h dedup; rejections return 200 `{counted:false}` (no oracle) |
| 5 | `GET /api/views/stats` | varies | query params | aggregate stats | reads server-only viewStats |
| 6 | `GET /api/admin/analytics` | **super admin** (email check on verified token) | — | 14-day traffic/signups/top-content, live users (5 min window) | Admin SDK reads of private `chapterViews` (≤20 k docs/query) |
| 7 | `POST /api/ai/novel-content` | required | zod: action ∈ generate/improve/expand-synopsis; title ≤300; synopsis ≤8 k; prompt ≤2 k; body ≤64 KB | `{result}` | charges 3/2/2 tokens **before** calling Claude Haiku 4.5 (max_tokens 400) |
| 8 | `POST /api/ai/novel-assist` | required | zod-capped chat/assist payload ≤64 KB | `{result}` | 2 tokens; Claude Haiku 4.5 |
| 9 | `POST /api/ai/generate-image` | required | `action:'prompt'` (1 token, Claude) or `action:'generate'` (15 tokens, Stability; prompt ≤2 k) | prompt text / image data | 402 with balance info when short |
| 10 | `POST /api/payments/create-order` | required | `{packageId}` (validated against `COIN_PACKAGES`) | `{orderId, amount, currency}` | Razorpay order; verified uid + coins written into order `notes` server-side |
| 11 | `POST /api/webhooks` | **Razorpay HMAC** (`x-razorpay-signature`, timing-safe) | raw body | `{received:true}` | `payment.captured` → idempotent credit transaction `rzp_{id}`; returns 200 even on internal error (documented anti-retry-storm choice — monitor logs) |
| 12 | `POST /api/support` | optional | type/name≤100/email≤254/subject≤150/message≤4000; ≤16 KB | `{ok,id,emailSent}` | 8/10 min/IP + 5/day/email; Admin-SDK write; Gmail auto-reply (escaped) |

No OpenAPI spec exists; this table is the contract of record. Generating `openapi.yaml` from the zod schemas (e.g. `zod-openapi`) is a cheap P3 win.

---

## 11. Folder Structure

```
d:\toonflow
├─ docs/                    # 01–06 prior audits + view-tracking + this handover
├─ public/                  # manifest.json, sw.js (hand-rolled SW), icons/, images/, og-image.png
├─ firestore.rules          # Firestore security rules (audited)
├─ firestore.indexes.json   # 5 composite indexes
├─ storage.rules            # Storage security rules (owner-only, raster-only)
├─ firebase.json            # rules/indexes deploy config (no hosting)
├─ next.config.js           # CSP + security headers, image config, cache headers
├─ tailwind.config.ts       # v3 design tokens (bg/text/accent/danger/warning)
├─ CLAUDE.md / AGENTS.md    # engineering conventions (source of truth for style)
├─ SECURITY.md              # 2026-07-05 audit report
└─ src/
   ├─ app/
   │  ├─ layout.tsx         # root: Inter font, metadata, AuthProvider, Toaster, PwaRegister, skip-link
   │  ├─ robots.ts, sitemap.ts
   │  ├─ (main)/            # public: home, browse, originals, title pages, episode reader,
   │  │                     #   profile/[uid], create hub, coming-soon, privacy/terms/ai-policy
   │  ├─ (auth)/            # login, signup — centered layout, no nav
   │  ├─ (studio)/          # dashboard, wallet, admin, admin/super/** — sidebar shells
   │  ├─ (novel)/           # create/novel[+id], create/webtoon[+id], create/seed — editor chrome
   │  ├─ (reader)/          # novel/[id]/chapter/[chapterId] — distraction-free reader
   │  └─ api/               # 10 route handlers (§10)
   ├─ components/           # admin(6) auth(2) content(2) editor(7) home(1) layout(7)
   │                        # novel(2) pwa(1) reader(8) support(1) ui(5) webtoon(3)
   ├─ contexts/AuthContext.tsx
   ├─ hooks/                # useAuth (re-export), useNovels/Webtoons/Chapters/Episodes,
   │                        # useFirestore, useInfiniteScroll, useDebounce, useViewTracking
   ├─ lib/
   │  ├─ api/guard.ts       # body-size gate, escapeHtml
   │  ├─ auth/serverUser.ts # verifiedUid
   │  ├─ firebase/          # config.ts (client init) db.ts (firestore inst) auth.ts storage.ts
   │  │                     # firestore.ts (1 090 LOC domain service) engagement.ts wallet.ts
   │  │                     # admin.ts (client-side ADMIN DASHBOARD service — naming trap!)
   │  │                     # serverApp.ts (REAL Admin SDK — server only)
   │  ├─ tokens.ts          # server token accounting
   │  ├─ views/             # config, crypto, botDetection, rateLimit, viewService
   │  └─ utils/             # cn, constants (flags/packages/roles), formatters, requestCache,
   │                        # sanitizeHtml, time, url (safeHttpUrl)
   ├─ store/useAppStore.ts  # Zustand UI store
   ├─ types/                # user, novel, webtoon, comment, transaction
   └─ proxy.ts              # middleware (Next 16 proxy convention)
```

⚠️ **Naming trap for new engineers:** `lib/firebase/admin.ts` is the *client-side admin-dashboard* Firestore service. The Firebase **Admin SDK** lives in `lib/firebase/serverApp.ts`. Renaming `admin.ts` → `adminDashboard.ts` is a recommended P3 cleanup.

---

## 12. Component Documentation (by domain)

46 components, one per file, PascalCase. Conventions: `cn()` for class merging, Skeletons for loading, tokens only, WCAG attributes required.

- **ui/** — `Button`, `Input`, `Badge`, `Modal` (Radix Dialog), `Skeleton`. Pure presentational, prop-driven, no data fetching; the reuse layer everything else builds on.
- **layout/** — `Navbar`, `Footer`, `MobileNav`, `UserMenu` (Radix dropdown), `StudioLayoutShell`/`StudioSidebar`, `ResponsiveSidebarShell`. Consume `useAuth()` + `useAppStore` (mobile nav state).
- **editor/** — `NovelRichEditor` (TipTap instance + `EditorToolbar`), `ChapterSidebar`, `EpisodeSidebar`, `AIAssistant` (calls AI routes, handles 402 → wallet upsell), `WebtoonToolbar`, `BrandingMetaDialog` (intro/outro meta). Heaviest client components; all dynamically loaded within studio routes so reader bundles stay clean.
- **reader/** — `CommentSection`, `LikeButton`, `RatingControl`, `BookmarkButton` (optimistic UI over `lib/firebase/engagement.ts`), `IntroPoster`/`EndingPoster`/`CreditsPoster`/`TitlePage` (mandatory branded episode pages — structural, not panels, cannot be deleted/reordered).
- **admin/** — `StatCard`, `AdminCharts`/`BusinessCharts` (recharts), `ConfirmDialog` (destructive-action guard), `SuperAdminLayoutShell`/`SuperAdminSidebar`.
- **webtoon/, novel/, content/, home/, support/, auth/, pwa/** — cards/grids, hero, support modal, auth forms, `PwaRegister` (SW lifecycle: registers in prod, unregisters in dev).

State ownership: server data via hooks; page-local UI via `useState`; cross-page UI via Zustand; auth via context. No prop-drilling pathologies observed at current scale.

---

## 13. State Management

| Kind | Mechanism | Contents |
|---|---|---|
| Auth/session | `AuthContext` | firebaseUser, profile, `isAuthenticated/isCreator/isAdmin/isSuperAdmin`, `refreshProfile()` |
| Global UI | Zustand (`useAppStore`) | fontSize†, browseFilters†, mobileNavOpen, searchQuery, loginModalOpen († persisted) |
| Server data | custom hooks → `lib/firebase/*` | novels/webtoons/chapters/episodes lists + `requestCache` de-duping |
| Local | `useState`/RHF | forms, dialogs, editor drafts |
| Derived-loading | pattern per `project_react_lint_patterns` memory | derived from data presence, not paired setState (React Compiler-friendly) |

Data flow: **UI → service layer → Firestore/API → hook state → render.** No Redux, no React Query — a deliberate simplicity choice; revisit only when cross-page cache invalidation (e.g., "my library" freshness) becomes a real bug source.

---

## 14. Performance Analysis

*(Static analysis — no Lighthouse/RUM numbers exist in-repo; establishing measurement is itself the first recommendation.)*

**Already good:**
- Turbopack builds; content-hashed immutable static assets; `compress: true`.
- AVIF/WebP via `next/image` everywhere; `next/font` (zero external font fetches, `display:swap` → no FOIT/CLS).
- Firestore SDK dynamically imported post-auth (signed-out visitors skip the heaviest client dep) — the single biggest bundle win, already done.
- recharts/TipTap/dnd-kit confined to admin/studio route bundles.
- SW cache-first for static assets; edge `immutable` headers.
- `getCountFromServer` for admin counts (no doc-read explosions); `select()` projections + 20 k caps in analytics.

**Risks / recommendations (ordered by user impact):**
1. **Episode panel weight** — raw uploads up to 25 MB render in the reader. Add a resize pipeline (Firebase "Resize Images" extension or upload-time canvas re-encode) + lazy `loading="lazy"` below the fold. This dominates LCP on the core reading surface.
2. **Client-rendered content pages** — title/reader pages fetch client-side; TTFB is fine but LCP waits on JS + Firestore round-trip, and crawlers see shells. Move title pages + chapter readers to **server components/ISR** (fetch via Admin SDK, revalidate 60 s) for LCP + SEO simultaneously.
3. **No bundle budget** — add `@next/bundle-analyzer` and a CI size check.
4. **No Web-Vitals telemetry** — add `useReportWebVitals` → Vercel Analytics/GA to get real LCP/INP/CLS.
5. `getPlatformStats` fires 10 parallel count queries per admin dashboard load — cache 60 s in `requestCache`.

---

## 15. Scalability

| Scale | Verdict | Binding constraint |
|---|---|---|
| 1K users | ✅ works today | none |
| 10K users | ✅ with minor ops | Firestore free-tier limits; enable billing alerts |
| 100K users | ⚠️ needs the P1 items | **In-memory rate limiter breaks on multi-instance (R2)**; admin client-side filtering breaks (needs Algolia/Typesense); panel bandwidth costs (needs resizing/CDN); webhook + view write throughput fine (sharded by doc) |
| 1M users | ⚠️ re-architecture of hot paths | `viewCount` on popular docs approaches Firestore's ~1 write/s/doc sustained guidance → distributed counter shards or scheduled aggregation from `viewStats`; analytics query (20 k docs/request) → pre-aggregated daily rollups only; email via Gmail app-password → transactional provider (SES/Postmark) |
| 10M users | 🔭 platform evolution | Read model likely moves to CDN-cached ISR + search index; consider BigQuery export for analytics; queueing (Cloud Tasks) for fan-out writes |

The good news: the trust boundaries (Admin-SDK-only money/views) already match a scaled architecture; scaling is mostly swapping single-instance conveniences (memory rate limit, client search, raw images) for managed services, not redesigning security.

---

## 16. Monitoring

**Current state: console logging only.** No Sentry, no uptime checks, no alerts, no dashboards. `chapterViews`/`viewStats`/`suspiciousViews` + `/api/admin/analytics` provide *product* analytics; `auditLogs` records admin actions. Nothing watches *the system*.

Recommended minimum (in order):
1. **Sentry** (`@sentry/nextjs`) — client + server error tracking with release tagging. Biggest blind spot today: webhook handler returns 200 on internal errors, so a crediting bug would be **silent**; Sentry alert on that catch block specifically.
2. **Uptime + health:** add `/api/health` (checks Admin SDK init) + Better Uptime/Checkly on it and on `/`.
3. **Vercel Analytics / Web Vitals** for RUM (pairs with §14-4).
4. **Budget alerts:** GCP billing alerts (Firestore reads, Storage egress) + Anthropic/Stability spend caps — AI cost is bounded per-request by token charging, but only billing alerts bound it globally.
5. Later: wire the already-present `@opentelemetry/api` or remove it (§22); Grafana/Prometheus only if self-hosting.

---

## 17. DevOps

- **CI/CD: none.** No `.github/`, no pipelines. Deploys are manual (`next build` + host; `firebase deploy … --project toonflow-studio-paint-f384c` for rules).
- **Git:** single `main` branch, direct commits, informal messages ("fixes", "major fixes"). No tags/releases.
- **Environments:** one Firebase project — **prod and dev share a database.** Create a second Firebase project for dev/staging before the next growth phase; wire via `.env.local` swap.
- **Secrets:** `.env.local` (git-ignored) locally; must be replicated into host env vars on deploy. `.env.example` is the manifest.
- **Rollback:** host-level (Vercel instant rollback) once hosting exists; Firestore rules roll back by redeploying the previous file (keep rules in PRs for exactly this reason).

**Recommended baseline (1–2 days of work):** GitHub Actions with `lint → tsc --noEmit → build → (tests when they exist)` on PR; branch protection on `main`; conventional commits; rules deploy as a manual-approval workflow. This plus Sentry converts the project from "solo-dev mode" to "team-ready".

---

## 18. Testing

**Current coverage: 0%. There are no unit, integration, E2E, security, or load tests, and no test runner is installed.** This is the single largest engineering risk in the project given how much invariant-heavy logic exists (rules, token accounting, webhook idempotency, view dedup).

Priority test plan:
1. **Firestore/Storage rules tests** (`@firebase/rules-unit-testing` + emulator): counter seeding blocked, authorship binding, ±1 follower deltas, transactions `create:false`, storage owner-only. These encode the entire F-2…F-8 audit surface. *(Highest value per hour.)*
2. **Route handler unit tests** (Vitest): `chargeTokens` (insufficient/concurrent), webhook (bad signature 401, replay idempotency, unknown package fallback), session (invalid token 401, role derivation), views (stale token, dedup window, engagement gate), support (throttles).
3. **E2E smoke** (Playwright): signup → create novel → publish chapter → read as anon → view counted; login-gate redirects.
4. Later: load test `/api/views` (k6) to size the Redis migration; dependency scanning in CI (`npm audit --audit-level=high` gate).

---

## 19. AI Features

| Feature | Endpoint | Model | Token cost | Caps |
|---|---|---|---|---|
| Synopsis generate / improve / expand | `/api/ai/novel-content` | `claude-haiku-4-5-20251001` (max_tokens 400) | 3 / 2 / 2 | title ≤300, synopsis ≤8 k, prompt ≤2 k, body ≤64 KB |
| Writing assistant | `/api/ai/novel-assist` | Claude Haiku 4.5 | 2 | zod-capped history |
| Image prompt | `/api/ai/generate-image` (`action:'prompt'`) | Claude Haiku 4.5 (max_tokens 250) | 1 | synopsis ≤4 k |
| Image generation | `/api/ai/generate-image` (`action:'generate'`) | Stability AI | 15 | prompt ≤2 k |

**Cost & safety architecture:** charge-before-call against the **verified uid** in an atomic Admin transaction (fails closed — a Firestore error never grants free usage); insufficient balance → 402 with exact shortfall; every spend writes a `transactions` row (`ai_usage`). Input is length-capped + body-size-gated; errors are generic (no provider internals leak). Prompt injection blast radius is minimal (no tools, output returned only to the paying user) — see §7. `settings/platform.aiGenerationsPerDay` exists as a config knob but **is not currently enforced in the AI routes** (gap worth closing for abuse control). No response caching (each call is user-specific creative output — caching not applicable). Anthropic key is server-only; recommend org-level spend limits as the backstop.

---

## 20. Third-Party Services

| Service | Purpose | Auth | Cost model | Risk / mitigation | Alternatives |
|---|---|---|---|---|---|
| Firebase Auth | identity (email+Google) | client config (public) | free tier generous | vendor lock-in (acceptable) | Auth0, Clerk, Supabase |
| Firestore | primary DB | client SDK + Admin service account | per read/write/GB | cost spikes on hot content → §15 | Supabase/Postgres |
| Firebase Storage | user media | rules + Admin | per GB + egress | orphaned files (§8) | S3+CloudFront, R2 |
| Anthropic API | text AI | `ANTHROPIC_API_KEY` | per token | spend bounded per-request; set org cap | — |
| Stability AI | image gen | `STABILITY_API_KEY` | per image | same | DALL·E, Imagen |
| Razorpay | payments (INR) | key id/secret + webhook secret | % per txn | webhook is the only crediting path — monitor it (§16) | Stripe (intl expansion) |
| Gmail SMTP | support auto-reply | app password | free | app-password fragility, send limits (~500/day) | SES, Postmark, Resend |

---

## 21. Environment Variables

From `.env.example` (authoritative manifest; never commit `.env.local`):

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_{API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID}` | client (public by design) | ✅ (measurement optional) | Firebase client init (`lib/firebase/config.ts`) |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` | client | recommended | metadataBase, canonical URLs |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | client | for wallet | checkout.js public key |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | **server, secret** | ✅ | Admin SDK service account (PEM newlines escaped as `\n`) |
| `VIEW_TOKEN_SECRET` | server, secret | optional (falls back to hash of private key) | HMAC for view tokens + visitor cookie — set explicitly in prod |
| `ANTHROPIC_API_KEY` | server, secret | for AI text | Claude calls |
| `STABILITY_API_KEY` | server, secret | for AI images | Stability calls |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | server, secret | for payments | order creation |
| `RAZORPAY_WEBHOOK_SECRET` | server, secret | for payments | webhook HMAC verification |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | server, secret | for support email | nodemailer auto-reply (skips gracefully if unset) |

Every route that needs a secret checks for it and returns 503 with a clear message rather than crashing — good operability pattern; keep it for new routes.

---

## 22. Dependencies

31 runtime + 11 dev dependencies. `npm audit` (2026-07-06): **0 critical, 0 high, 8 moderate** — all transitive: `uuid` chain via `firebase-admin→@google-cloud/storage→teeny-request/gaxios` (unreachable in our usage — audit F-13, accepted/monitored) and `postcss` via `next` (build-time only). Action: none forced; re-audit on next `firebase-admin`/`next` releases.

Notable pins: `next 16.2.9`, `react 19.2.4`, `firebase 12.15`, `firebase-admin 14.1`, `zod 4`, `zustand 5`, `tailwindcss 3.4.19` (v3 intentionally), `@anthropic-ai/sdk 0.105`, `@tiptap/* 3.27`, `lucide-react 1.21`.

**Unused/questionable:**
- `@opentelemetry/api` — declared but **no imports in `src/`**. Either wire it (§16) or remove.
- `date-fns` — verify usage vs. `lib/utils/time.ts` helpers; drop if redundant.
Everything else verified in use (tiptap→editor, dnd-kit→panels, recharts→admin, jspdf→novel export, nodemailer→support).

---

## 23. Technical Debt (prioritized)

1. **No tests / no CI** — highest risk; §18/§17 plans. *(P0)*
2. **Prod and dev share one Firebase project** — a dev mistake mutates production data. *(P0)*
3. **In-memory rate limiter** — blocks horizontal scaling; single-function swap to Redis. *(P1)*
4. **No Firestore backup/PITR, no Storage delete-cascade** — data-loss and orphan risk. *(P1)*
5. **CLAUDE.md says "Next.js 15" but the app is Next 16.2.9** — doc drift that will misdirect newcomers; also README.md is still the create-next-app template. *(P2)*
6. **`lib/firebase/admin.ts` naming trap** (client service vs Admin SDK). *(P2)*
7. Admin list screens: fetch-then-filter client-side; `limit(n*2)` heuristics; duplicated timestamp-sort helpers ×3 in `admin.ts` — extract one `sortByCreatedAt` util and plan a search index. *(P2)*
8. `aiGenerationsPerDay` platform setting exists but is unenforced. *(P2)*
9. Denormalized `authorName/PhotoURL` never re-synced on profile rename. *(P3)*
10. `views/{id}` legacy collection retired in rules but still present — schedule data deletion. *(P3)*
11. Unused `@opentelemetry/api`; possible `date-fns` redundancy. *(P3)*
12. No OpenAPI spec; API contract lives in this doc. *(P3)*

Positives worth preserving: consistent service-layer discipline, security-conscious comments explaining *why* at every trust boundary, zod-at-the-edge, one-component-per-file, token-only styling.

---

## 24. Production Readiness Checklist

| Area | Status | Evidence |
|---|---|---|
| Security | 🟢 86% | Audited + remediated; residuals R1–R10 tracked |
| Performance | 🟡 70% | Strong primitives; unmeasured; panel-image pipeline missing |
| Accessibility | 🟢 85% | WCAG conventions systematically applied; needs an axe/manual pass for verification |
| SEO | 🟡 72% | Metadata/robots/sitemap ✅; content pages client-rendered |
| Scalability | 🟡 60% | Fine to ~10k; R2 + search + counters block 100k+ |
| Reliability | 🟡 55% | Graceful env-var degradation ✅; no health checks, silent-webhook-error risk |
| Monitoring | 🔴 20% | Console only; no Sentry/uptime/alerts |
| Logging | 🟡 45% | Consistent prefixes; unstructured, no retention |
| Disaster recovery / backups | 🔴 15% | No PITR/exports; rules recoverable from git |
| Compliance | 🟡 55% | Privacy/Terms/AI-policy pages exist; hashed analytics PII ✅; no GDPR deletion tooling (user-data delete is partial), payments limited to Razorpay India |
| Testing/CI | 🔴 0% | none |

**Overall production readiness: 62/100** — safe for a controlled beta on a single instance with an attentive operator; the gap to "production-grade" is almost entirely operational (tests, CI, monitoring, backups), not architectural.

---

## 25. Architecture Diagrams

**High-level & request lifecycle**

```
        ┌─────────── Browser / PWA (React 19, SW v1) ───────────┐
        │  (main) public │ (auth) │ (studio) admin │ (novel) editors │ (reader)
        └───────┬───────────────────────────┬────────────────────┘
                │ client Firebase SDK        │ fetch /api/*  (cookies, SameSite=Lax)
                ▼                            ▼
   Firestore + Storage (RULES = client      Next.js Node handlers
   data plane: authorship, counters,        ├─ session   → verifyIdToken → cookies
   owner-only media, default deny)          ├─ ai/*      → verifiedUid → chargeTokens ⚛ → Claude/Stability
                ▲                           ├─ payments  → verifiedUid → Razorpay order
                │ Admin SDK (bypasses       ├─ webhooks  → HMAC → idempotent credit ⚛
                │ rules; the trusted plane) ├─ views     → HMAC token + dwell + dedup ⚛
                └───────────────────────────┴─ support   → throttle → write + Gmail
                                                    ⚛ = Firestore transaction
```

**Authentication flow** — see §5 diagram. **Middleware gates** — §3. **Database schema** — §4. **View pipeline** — [view-tracking.md](view-tracking.md).

**Deployment pipeline (current → target)**

```
current:  dev machine ──(manual)──► next build ──► host?        firebase deploy --project …
target:   PR ─► GitHub Actions (lint+types+tests+build) ─► Vercel preview ─► merge ─► prod
                                        └─► rules deploy job (manual approval)
```

**User journeys:** Reader: home → browse → title page → reader → (20 s dwell) view counted → like/comment/bookmark. Creator: login → /create → novel editor (TipTap+AI, tokens) or webtoon studio (panels+intro/outro) → publish → dashboard stats. Buyer (flag-locked): wallet → package → Razorpay checkout → webhook credit → balance. Admin: /admin (stats, moderation, support) · /admin/super (users, analytics, settings, seed).

---

## 26. Final Audit Report

| Dimension | Score | Rationale |
|---|---|---|
| Architecture | **84** | Clean trust boundaries, disciplined service layer, right-sized (no over-engineering); deductions for single-project envs + unhosted deploy story |
| Security | **86** | Professionally audited + remediated; residuals are operational (WAF, MFA, distributed limits, nonce CSP) |
| Performance | **74** | Excellent primitives (fonts, images, dynamic imports, SW); unmeasured; panel pipeline + SSR of content pages pending |
| Code Quality | **82** | Strict TS, consistent conventions, exemplary security comments; minor duplication + naming trap |
| Maintainability | **76** | Great docs/ + SECURITY.md; zero tests drags it down; CLAUDE.md/README drift |
| Scalability | **62** | Solid to 10k; known, documented blockers past that (rate limiter, search, counters) |
| Accessibility | **85** | Systematic WCAG conventions; needs formal verification pass |
| SEO | **72** | Metadata/sitemap/robots done; CSR content pages limit crawlability of the core catalog |
| Developer Experience | **68** | Fast Turbopack loop, typed everything, good conventions; no CI/tests/preview envs |
| **Production Readiness** | **62** | Beta-ready; ops maturity is the gap |

### 1. Critical (fix immediately)
1. **Stand up CI + first tests** for Firestore rules and the webhook/token-charging routes (§18-1/2) — these guard money and integrity with zero regression protection today.
2. **Enable Firestore PITR + scheduled exports** and GCP billing alerts — currently a single bad write/delete is unrecoverable.
3. **Create a separate dev/staging Firebase project** — stop developing against production data.
4. **Add Sentry** with a specific alert on the webhook catch-path (silent-crediting-failure risk).

### 2. High priority
5. Redis/Upstash rate limiting behind `checkRateLimit` (pre-req for any multi-instance deploy).
6. Formalize hosting (Vercel + region near Firestore) + GitHub Actions deploy; document in repo.
7. Enforce `aiGenerationsPerDay`; add Turnstile/CAPTCHA on signup + support.
8. Migrate session cookie to Firebase session cookies with revocation checks (R4).
9. Panel-image resize pipeline + lazy loading (biggest UX/cost lever).

### 3. Medium priority
10. SSR/ISR for title pages + readers (SEO + LCP). 11. MFA for admin/creator accounts; email-verification gate for creation. 12. Storage delete-cascade + orphan sweep. 13. Search index (Algolia/Typesense) for browse + admin. 14. Fix CLAUDE.md version drift; rewrite README as a real onboarding doc; rename `lib/firebase/admin.ts`.

### 4. Low priority
15. Nonce-based CSP. 16. OpenAPI generation from zod. 17. Remove `@opentelemetry/api` or wire tracing. 18. TTL policy on `viewDedup`/old `chapterViews`; delete legacy `views` collection. 19. Extract duplicated timestamp-sort helper.

### 5. Future enhancements
Wallet/payments GA (flag flip + payout ops runbook) · premium unlocks end-to-end · recommendations ("because you read…") · offline reading (SW range-caching of episodes) · i18n · native wrappers (Capacitor) around the PWA · creator analytics dashboards from `viewStats` · Stripe for international payments.

### 6. 30-day roadmap
Wk 1: CI (lint/types/build) + Sentry + billing alerts + staging Firebase project. Wk 2: rules test suite + webhook/token tests as merge gates. Wk 3: Vercel prod deploy + Redis rate limiting + health check/uptime. Wk 4: image resize pipeline + Web-Vitals telemetry + README/CLAUDE.md fixes.

### 7. 90-day roadmap
Month 2: wallet GA (Razorpay live keys, payout runbook, admin withdrawal ops), MFA + email verification, CAPTCHA, session-cookie migration. Month 3: SSR/ISR content pages, search index, Playwright E2E suite, moderation tooling hardening, backup restore drill.

### 8. 1-year roadmap
Q2: premium content monetization at scale, creator analytics, recommendations v1. Q3: internationalization + Stripe, mobile app shells, distributed counters + BigQuery analytics export. Q4: ML-assisted moderation/anti-fraud on `suspiciousViews`, multi-region read model (ISR + edge cache), SOC2-track operational maturity (structured logging, retention, access reviews).

---

*Prepared by the staff-engineering documentation review, 2026-07-06. Facts verified against source at commit `c5c5e22`. Where this document and code disagree, the code wins — please PR the correction here.*
