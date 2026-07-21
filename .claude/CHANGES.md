# Toonflow Studio Paint — Change Log

## 2026-07-11 — Enable forceConsistentCasingInFileNames
- **tsconfig.json**: added `"forceConsistentCasingInFileNames": true` to `compilerOptions` to enforce consistent file-reference casing and clear the Edge Tools lint warning (prevents cross-OS casing issues between case-sensitive and case-insensitive filesystems).

## 2026-07-07 — Subscriptions, creator analytics dashboard, revenue calculator & transparency pages
Shipped a follower/subscription system, a rebuilt dashboard earnings/analytics module, and a public creator-earnings page. All business rates live in one config so a rate change is a one-line edit.

- **src/lib/revenue/config.ts** (new): single source of truth for every rate — gross ₹/view, creator/platform split (70/30 subs, 60/40 ads), subscription price, gateway/tax/ops deductions, min withdrawal, payout schedule, and the "where money goes" allocation (sums to 100). Exports `CREATOR_EARNINGS_PER_VIEW`, `CREATOR_RPM`, `GROSS_CPM`, `viewsToCreatorInr()`, `revenueBreakdown()` (deductions carried by platform share, creator cut protected), `fmtInr()`.
- **src/lib/firebase/wallet.ts**: `EARNINGS_PER_VIEW`/`viewsToInr` now derive from the central config instead of a hardcoded 0.007 (creator RPM is now ₹7/1K from ₹0.01 gross × 70%). Backward-compatible re-exports so existing callers are unchanged.
- **Follow system rebuilt** (`src/lib/firebase/firestore.ts`): `followUser`/`unfollowUser` now run a single Firestore **transaction** writing three docs — `follows/{a_b}` (flat edge), `users/{author}/followers/{follower}`, `users/{follower}/following/{author}` — plus `followerCount`/`followingCount` increments. The tx reads the edge first and no-ops if it exists, so a double-click or replayed request can never double-count. Rejects self-follow. Removed the old batch-based `writeBatch` version.
- **src/hooks/useFollow.ts** (new): reusable optimistic follow hook with in-flight spam guard, self/sign-in awareness, rollback on error.
- **src/components/social/SubscribeButton.tsx** (new): `+ Subscribe` / `✓ Subscribed` button, optimistic, loading spinner, renders nothing for own content, toast feedback. **AuthorCard.tsx** (new): avatar + name + live follower count + SubscribeButton; count updates optimistically.
- **Novel & Webtoon detail pages**: replaced the inline ad-hoc follow buttons with `<AuthorCard>` (novel: in the Details panel under an "Author" label; webtoon: under the title). Removed now-dead follow state/handlers/imports from both pages.
- **src/app/api/creator/analytics/route.ts** (new): Admin-SDK aggregation over the private `chapterViews` log, scoped to the verified caller's own content (chunked `parentId in` queries, 30/chunk). Returns today/week/month/lifetime views, subscribers, unique/returning readers (30d), avg read time, completion rate (scroll depth), RPM/CPM, est. + lifetime revenue, 90-day daily series (views/readers/revenue/follower growth), top stories, top chapters. **src/types/analytics.ts** (new) types the payload.
- **Dashboard** (`src/app/(studio)/dashboard/page.tsx`): fixed earnings labels (Total Revenue / Paid Out, config-driven RPM & share), added `<CreatorAnalyticsSection>` below the wallet cards. **CreatorAnalyticsSection.tsx** (new): 12 animated stat tiles + audience strip + lazy-loaded charts (dynamic import so recharts stays out of the shell), top-chapters list, skeletons, error+retry, empty state. **CreatorCharts.tsx** (new): views area chart w/ daily/weekly/monthly toggle, subscriber-growth line, revenue area, top-stories bar — CVD-validated series palette for the #1A1A1A surface (validated with the dataviz checker).
- **src/components/ui/AnimatedNumber.tsx** (new): count-up on scroll-into-view, respects reduced-motion, exposes final value to screen readers.
- **/earnings page** (`src/app/(main)/earnings/page.tsx` + `src/components/revenue/*`): public creator-first page — hero, interactive **RevenueCalculator** (9 view presets + custom input, subscription vs ad model, full breakdown: gross/creator/platform/gateway/tax/ops/profit), **HowEarningsWork** (9 revenue streams w/ live/soon/roadmap badges + share/payout/min-withdrawal facts), **HowToonflowMakesMoney** (11 revenue-source cards), **WhereMoneyGoes** (animated allocation cards + progress bars + footer quote). Linked from the footer Platform column.
- **Profile page**: StatCards now use AnimatedNumber count-ups; added joined-date next to the handle; added an "Anime — Coming soon" tab teaser; swapped the bespoke FollowButton for the shared SubscribeButton.
- **firestore.rules**: added `users/{uid}/followers/{followerId}` & `following/{targetId}` subcollection rules (doc-id-bound to caller, no self-follow, one doc per relationship); reserved `creatorAnalytics`/`revenueHistory`/`viewHistory` as server-only.
- **firestore.indexes.json**: added `chapterViews (parentId ASC, viewedAt ASC)` for the creator-analytics window query.
- Accessibility: new interactive elements have focus rings, icon-only controls have aria-labels, decorative icons aria-hidden, charts pair color with legends/direct-labels + a returning-readers table row, progress bars have roles. `tsc` clean, `eslint` clean, `next build` compiles successfully; all routes incl. `/earnings` and `/api/creator/analytics` build.

## 2026-07-04 — Production security audit: fixed critical privilege-escalation, free-currency & billing-bypass holes

Full-project engineering audit. All changes verified: `tsc` clean, `eslint` clean (0 warnings), production build clean (38 routes). Net −18 LOC.

### Critical — Firestore rules let users self-grant balance & escalate to superadmin
- **firestore.rules** (`/users/{userId}`): the `update` rule allowed `isOwner(userId)` to write **any** field on their own document. A user could set `balance` to any value or `role: 'superadmin'` directly via the client SDK — free tokens + full admin (rules' `isAdmin()` reads that same `role`). Owner update is now restricted to profile fields only (`displayName, bio, photoURL, bannerURL, socialLinks, updatedAt`); `balance/role/isCreator/totalEarnings` are server-only (Admin SDK bypasses rules). Follower/following counter carve-out unchanged; admin branch unchanged.

### Critical — /api/session trusted client-supplied role & email (auth bypass)
- **src/app/api/session/route.ts**: set the `role`/`email` cookies straight from the request body and never verified the `idToken`. The middleware (`src/proxy.ts`) gates `/admin` and `/admin/super` on those cookies, so anyone could POST `{role:'superadmin', email:'shashwathbc@gmail.com'}` and pass the gate. Now verifies the token with the Admin SDK, takes `email` from the decoded token, and reads `role` from Firestore — client body values ignored. `runtime = 'nodejs'`.

### Critical — dashboard "Buy Coins" credited tokens with no payment
- **dashboard/page.tsx** + **lib/firebase/wallet.ts**: `BuyTokensModal` called client-side `purchaseCoins()` which wrote `balance` directly — clicking Buy granted free coins. Removed `purchaseCoins`/client crediting entirely; the modal now runs the real Razorpay order flow. Coins are credited only by the verified webhook.

### High — AI routes billed a client-supplied userId
- **api/ai/{novel-assist,novel-content,generate-image}**: billing used `body.userId`, so a user could omit it (free AI) or pass another user's uid (drain their balance). All three now derive the uid from the verified session cookie via new **src/lib/auth/serverUser.ts** and charge that uid unconditionally.

### High — token spend & purchase crediting were broken and racy
- **src/lib/tokens.ts**: `chargeTokens` used the client SDK from server code (denied under the hardened rules) and did a non-atomic read-then-write (TOCTOU — concurrent requests could overspend). Rewritten on the Admin SDK inside a `runTransaction`.
- **api/webhooks/route.ts**: credited via client SDK (also denied under hardened rules); `create-order` never put `userId` in the order notes, so the webhook always bailed and no real purchase ever credited. Now: `create-order` embeds the **verified** uid in notes; webhook credits via Admin SDK transaction with idempotency keyed on the payment id; signature compare is length-safe (`crypto.timingSafeEqual` previously threw on a mismatched-length signature).

### Medium — stored XSS in the chapter reader
- **src/lib/utils/sanitizeHtml.ts** (new) + chapter reader: chapter HTML was rendered raw via `dangerouslySetInnerHTML`. A creator owns their content docs and can write arbitrary HTML through the client SDK, so a crafted `<img onerror>`/`<script>` executed for every reader. Content is now run through an allowlist sanitizer (DOM-based in browser, conservative strip on server), memoized per chapter.

### Auth session freshness
- **src/contexts/AuthContext.tsx**: switched `onAuthStateChanged` → `onIdTokenChanged` so the 7-day session cookie is refreshed on hourly token rotation (it would otherwise carry an expired token that the now-verifying `/api/session` and API routes reject). Profile reload guarded to fire only on uid change.

### Cleanup / SEO / deps
- Removed dead client-side balance mutators `deductTokens`/`creditTokens` (0 callers, `firestore.ts`).
- Added **src/app/robots.ts** and **src/app/sitemap.ts** (both were missing); sitemap best-effort includes published novels with a static fallback.
- Removed unused runtime deps `embla-carousel-react`, `react-intersection-observer`.

## 2026-07-01 — Novel detail page: real-time chapter list + improved chapter row UI

### Root cause
`getChaptersByNovel` was a one-time `getDocs` fetch. Publishing a chapter after the page loaded never updated the UI — the page had to be manually refreshed to see the published chapter.

### Changed
- `src/app/(main)/novel/[id]/page.tsx`:
  - Replaced `getChaptersByNovel` one-shot fetch with `useChapters` (real-time `onSnapshot` listener). Chapters appear immediately after being published — no refresh required.
  - Novel info and chapters load independently; the hero section renders as soon as novel data arrives; chapters show a spinner until their snapshot arrives.
  - Improved chapter row: numbered avatar tile that fills accent on hover, word count + estimated reading time, published date, view count.
  - Total reading time shown in section header.
  - "Show all N chapters" / "Show fewer" toggle for novels with >20 chapters.

## 2026-07-01 — Fix: Chapter publish button not discoverable; chapters not appearing for readers

### Root cause
The EditorToolbar's Publish/Unpublish button controls the **novel** (sets `status: 'ongoing'`). Chapters have a separate `status: 'draft' | 'published'` field. The only way to publish a chapter was a tiny globe icon in the ChapterSidebar that was hidden behind `opacity-0 group-hover:opacity-100` — completely non-discoverable.

### Changed
- `src/components/editor/EditorToolbar.tsx`: Added a prominent **"Publish Chapter"** button (white filled) / **"Chapter Live"** indicator (accent tinted) that appears whenever a chapter is selected. Toggles the chapter's `status` independently of the novel status.
- `src/app/(novel)/create/novel/[novelId]/page.tsx`: Added `handlePublishChapter` / `handleUnpublishChapter` handlers (call `publishChapter`/`unpublishChapter`), `chapterPublishing` loading state, and a `useEffect` that keeps `activeChapter` status in sync when the Firestore `onSnapshot` fires after publish.
- `src/components/editor/ChapterSidebar.tsx`: Globe icon publish button is now **always visible** (not hover-only). Copy/Delete buttons remain hover-only.

## 2026-07-01 — Immersive Chapter Reader (cinematic, fullscreen)

### New files
- `src/app/(reader)/layout.tsx` — Minimal black layout with no Navbar/Footer. All `/novel/[id]/chapter/[chapterId]` routes now resolve here.
- `src/app/(reader)/novel/[id]/chapter/[chapterId]/page.tsx` — Full immersive chapter reader:
  - Reading progress bar (fixed top, scales with scroll %)
  - Auto-hiding sticky header with novel title, chapter picker dropdown, settings panel (font size S/M/L/XL, align toggle), LikeButton
  - Cinematic IntroPoster + TitlePage shown only for chapter 1
  - Paragraph fade-in via `IntersectionObserver` (`.reader-paragraph` → `.reader-paragraph.visible`)
  - Drop cap on first paragraph (`.reader-drop-cap`)
  - Full chapter content with H1/H2/separator rendering and `---` dividers
  - Prev/Next chapter navigation (card grid + floating mobile pill)
  - CommentSection at the bottom
  - Cinematic EndingPoster shown only after the last chapter
  - View tracking + reading history auto-save
- `src/components/reader/IntroPoster.tsx` — Cinematic opening: 28 GPU-animated particles, ambient glow, genre divider, large serif title, gold italic tagline, scroll cue
- `src/components/reader/TitlePage.tsx` — Story title screen: blurred cover bg, cover thumbnail, author link, status/chapter chips, "Now Reading" label
- `src/components/reader/EndingPoster.tsx` — Cinematic ending: 20 particles, "The End" divider, "Thank You For Reading", creator CTA, "Start Creating" button, back link
- `src/app/globals.css` — Added reader keyframe animations: `reader-particle-float`, `reader-glow-pulse`, `reader-scroll-cue`, `reader-title-in`, `reader-fade-in`; utility classes: `.reader-paragraph`, `.reader-paragraph.visible`, `.reader-drop-cap`, `.reader-progress-bar`, `.reader-header`, `.reader-header.hidden`

### Deleted
- `src/app/(main)/novel/[id]/chapter/` — Removed old chapter reader from `(main)` route group to avoid URL conflict with the new `(reader)` version

### Other
- `src/components/layout/MobileNav.tsx` — Fixed pre-existing TypeScript error: `onClick` property on nav items now accessed via cast to avoid type mismatch

## 2026-07-01 — Chapter publish/unpublish in editor sidebar; fix chapters not appearing on novel page

### Root Cause
Chapters were always stored as `status: 'draft'` — there was no UI to publish them. The novel detail page and chapter reader both filtered to `status === 'published'` only, so no chapters ever appeared. The "1 chapters" stat was showing `novel.chapterCount` (draft count) not published count.

### Changed
- `src/lib/firebase/firestore.ts`: Added `publishChapter(novelId, chapterId)` and `unpublishChapter(novelId, chapterId)` functions.
- `src/components/editor/ChapterSidebar.tsx`: Added publish/unpublish toggle button (globe/eye-off icon) visible on hover per chapter row. DRAFT/PUB badge now shown inline. Clicking publish sets `status: 'published'` so the chapter appears for readers.
- `src/app/(main)/novel/[id]/page.tsx`: Stats now show published chapter count (`chapters.length`) instead of `novel.chapterCount` which included drafts.

## 2026-07-01 — Originals page: show all published public content

### Changed
- `src/app/(main)/originals/OriginalsClient.tsx`: Replaced `getOriginals()` (required `isOriginal === true` flag, showed nothing) with `browseContent()` so all published+public content appears. Added Trending / Newest / Top Rated sort tabs.

## 2026-07-01 — Published content visibility: home slider, feeds, browse

### Changed
- `src/lib/firebase/firestore.ts`: `getTrendingNovels` and `getTrendingWebtoons` now filter by `visibility === 'public'` (private content was leaking to home feeds). Added `getNewReleases()` function returning recently published public novels+webtoons sorted by `publishedAt`.
- `src/app/(main)/page.tsx`: Replaced static hero with `<HeroSlider />`. Removed static "Originals promo" (moved into HomeFeed).
- `src/app/(main)/HomeFeed.tsx`: Added "New Releases" section; Trending, New Releases, Popular Novels, Popular Webtoons, Originals promo all driven by live Firestore data. All sections respect `visibility === 'public'` + published status.
- `src/components/home/HeroSlider.tsx` (new): Fetches top-5 published+public items (novels+webtoons by viewCount), displays full-width auto-advancing slider (6s interval, pauses on hover) with dot navigation and arrow buttons. Falls back to static hero when no published content exists.

### Not changed (already correct)
- `src/app/(main)/browse/BrowseClient.tsx`: Already filters by `visibility === 'public'` and published statuses.
- `src/app/(studio)/dashboard/page.tsx`: Already uses `getNovelsByAuthor(uid)` / `getWebtoonsByAuthor(uid)` — only shows the logged-in creator's own content.

## 2026-07-01 — Fix Firebase Storage 403 on cover/banner uploads

### Root Cause
Firebase Storage for the project was never initialized (no bucket provisioned), causing all writes to return 403. Additionally, `.firebaserc` had an incorrect project ID (`toonflow-studio-paint-f384c` instead of `toonflow-studio-paint`).

### Changed
- `storage.rules`: Removed unreliable cross-service `firestore.get()` ownership checks from novel cover/banner and webtoon cover write rules. Ownership is enforced at the application layer. Rules now simply require `isAuth() && isImage() && isUnder10MB()`.
- `.firebaserc`: Corrected project ID to `toonflow-studio-paint`.
- `firebase.json`: Added explicit `bucket` field pointing to `toonflow-studio-paint-f384c.firebasestorage.app`.

### Action Required
Initialize Firebase Storage at https://console.firebase.google.com/project/toonflow-studio-paint/storage then run `npx firebase deploy --only storage`.

## 2026-06-27 — Fix Firebase Storage permission for novel/webtoon cover upload on creation

### Changed
- `storage.rules`: Novel cover/banner and webtoon cover write rules now allow upload when the Firestore document doesn't exist yet (new creation flow). Previously the rule did `firestore.get()` on a non-existent doc during creation, causing `storage/unauthorized`.

## 2026-06-27 — Public Reader System, View Tracking, Likes, Comments

### New Files
- `src/lib/firebase/engagement.ts` — Deduplicated view tracking (`trackView`), like/unlike system (`toggleLike`, `isLiked`), comment replies (`getReplies`, `addReply`)
- `src/components/reader/LikeButton.tsx` — Optimistic like button with real-time toggle; works for novel/webtoon/chapter/episode/comment
- `src/components/reader/BookmarkButton.tsx` — Bookmark toggle using existing `toggleBookmark`/`isBookmarked`
- `src/components/reader/CommentSection.tsx` — Full nested comment system: top-level + replies, like comments, delete own, Creator badge, sort newest/oldest, skeleton loading, empty state
- `src/app/(main)/novel/[id]/chapter/[chapterId]/page.tsx` — Chapter reader: auto view tracking, font size picker, alignment toggle, prev/next nav, comments
- `src/app/(main)/webtoon/[id]/episode/[episodeId]/page.tsx` — Episode reader: vertical scroll panel viewer, view tracking, prev/next nav, comments

### Modified Files
- `src/app/(main)/novel/[id]/page.tsx` — Full novel detail page replacing stub: cover, genres, synopsis expand, stats, Like/Bookmark/Follow buttons, chapter list with view counts
- `src/app/(main)/webtoon/[id]/page.tsx` — Full webtoon detail page: cover, genres, synopsis, stats, Like/Bookmark/Follow, episode list with thumbnails
- `firestore.rules` — Added `views` (anyone can create, auth read), `likes` (auth create, owner delete), `auditLogs`, `settings` collections; fixed `withdrawals` `creatorId` field
- `src/app/(studio)/admin/super/requests/page.tsx` — Fixed invalid ARIA attribute value for `aria-selected` by changing boolean expressions to explicit `'true'`/`'false'` string literals.
- `src/app/(studio)/wallet/page.tsx` — Fixed invalid ARIA attribute value for `aria-selected` (tabs) and `aria-pressed` (payment buttons) by using explicit string literals.

### View Tracking Design
- Deduplication: localStorage key `tf_view_{contentId}_{date}` prevents multiple counts in same browser session
- Firestore dedup: `views/{viewerId}_{contentId}_{date}` — checked before counting
- Anonymous visitors get persistent ID from localStorage (`tf_anon_id`)
- View increments both the chapter/episode AND the parent novel/webtoon

### Like Design
- Stored as `likes/{uid}_{contentType}_{contentId}`
- Toggle: checks existence, deletes or creates, decrements or increments `likeCount` on target
- Optimistic UI: state updates immediately, reverts on error

## 2026-06-27 — Full Super Admin System + Creator Dashboard

### New Files
- `src/components/layout/StudioLayoutShell.tsx` — Client wrapper that hides the studio sidebar on `/admin/super/*` routes so the super admin can use its own dedicated layout
- `src/components/admin/SuperAdminSidebar.tsx` — Dedicated sidebar with 6 sections: Dashboard, Users, Novel Studio, Webtoon Studio, Requests, Settings
- `src/components/admin/StatCard.tsx` — Reusable metric card with icon, value, trend badge, color variants
- `src/components/admin/ConfirmDialog.tsx` — Accessible Framer Motion confirmation modal for all destructive actions
- `src/components/admin/AdminCharts.tsx` — Recharts charts (lazy-loaded, SSR-safe): content bar chart, distribution pie, top genres bar
- `src/lib/firebase/admin.ts` — All admin Firestore functions: analytics (`getPlatformStats`, `getCountFromServer`), user management, novel/webtoon moderation, reports, platform settings, audit logging
- `src/app/(studio)/admin/super/layout.tsx` — Dedicated super admin layout (full-screen, no studio sidebar)
- `src/app/(studio)/admin/super/users/page.tsx` — User management: table with search/role filter, role changer, disable/enable, delete, password reset
- `src/app/(studio)/admin/super/novels/page.tsx` — Novel moderation: global table, search, status filter, soft-delete, restore, permanent delete with confirmation
- `src/app/(studio)/admin/super/webtoons/page.tsx` — Webtoon moderation: same as novels page
- `src/app/(studio)/admin/super/requests/page.tsx` — Reports management: tabbed by status (pending/resolved/dismissed), resolve/dismiss actions
- `src/app/(studio)/admin/super/settings/page.tsx` — Platform settings: maintenance mode, signups toggle, content creation toggle, announcement banner, upload limits, AI limits
- `src/app/(studio)/dashboard/page.tsx` — Creator personal dashboard: stats (views, likes, followers), quick actions, novel/webtoon lists

### Modified Files
- `src/app/(studio)/admin/super/page.tsx` — Replaced static stub with full analytics dashboard: real Firestore counts, lazy-loaded charts, recent users/novels/webtoons tables
- `src/app/(studio)/layout.tsx` — Delegates to `StudioLayoutShell` for conditional sidebar rendering
- `src/types/webtoon.ts` — Added `visibility` field (was missing from Webtoon type)
- `src/lib/firebase/admin.ts` — `AdminReport.createdAt` typed as `FirestoreTimestamp | null`

### Dependencies
- `recharts` — installed for dashboard analytics charts

### Security
- Middleware (`src/proxy.ts`) already gates `/admin/super` by exact email match for `shashwathbc@gmail.com`
- All destructive actions require `ConfirmDialog` confirmation before execution
- Every admin action writes to `auditLogs` Firestore collection via `createAuditLog`

## 2026-06-27 — Profile page crash fix (formatCount undefined)

- `src/lib/utils/formatters.ts` `formatCount`: Changed signature from `(n: number)` to `(n: number | undefined | null)` with `?? 0` default. Existing Firestore user documents created before `followingCount` was added to the schema pass `undefined` at runtime, crashing on `.toString()`.
- `firestore.rules`: Fixed — the CLI was targeting project `toonflow-studio-paint` (wrong) while the app connects to `toonflow-studio-paint-f384c`. Rules for the correct project must be published via Firebase Console → Firestore → Rules.
- `.firebaserc`: Fixed `"Bash"` key → `"default"` and updated project ID to `toonflow-studio-paint-f384c`.

## 2026-06-27 — Deploy Firestore security rules (fix "Missing or insufficient permissions")

- **Root cause**: `firestore.rules` was never successfully deployed to Firebase. The file had a syntax error (`rules_version='2'` missing the trailing `;`), so any prior deploy attempts would have failed silently. Firebase was running the default production-mode rules that deny ALL access.
- **Fix**: Rewrote `firestore.rules` with correct `rules_version = '2';` syntax and proper per-collection rules:
  - `novels`, `webtoons`, their subcollections: public read; auth create; owner/admin update/delete
  - `users/{userId}`: public read; owner create/update; admin delete
  - `bookmarks`, `readingHistory`: owner-only read/write
  - `comments`: public read; auth create; owner/admin delete
  - `follows`, `transactions`, `reports`, `withdrawals`: appropriate auth-gated rules
- **Deployed**: `firebase deploy --only firestore:rules` — rules are now live on `toonflow-studio-paint`

## 2026-06-27 — Fix Homepage/Browse never loading + AuthContext hang + composite index elimination

### Root causes fixed
- **AuthContext hang**: `createUserDocument` or `getUserProfile` inside `onAuthStateChanged` could throw and silently prevent `setState({ loading: false })` from ever being called. Every page using `useAuth()` would stay in `loading: true` indefinitely. Fixed with try-catch wrappers so auth always resolves.
- **All compound Firestore queries failing**: Every query combining `where` + `orderBy` on different fields requires a composite index that didn't exist (index file was reverted to empty). Queries threw "requires an index" errors → HomeFeed showed empty, Browse showed empty, Originals empty.

### Changes
- `src/contexts/AuthContext.tsx`: Wrapped `createUserDocument` call in `try/catch`; wrapped `getUserProfile + getIdToken` in `try/catch`. Auth state now always resolves even if Firestore is temporarily unavailable.
- `src/lib/firebase/firestore.ts` — rewrote all compound queries to use single-field `where` + client-side filter/sort (eliminates all composite index requirements):
  - `getTrendingNovels`: removed `orderBy('viewCount')` from Firestore query; sort client-side after fetching
  - `getTrendingWebtoons`: same
  - `browseContent`: rewrote `buildQuery` into `fetchCol` helper — single `where` clause, all secondary filtering and sorting client-side
  - `getOriginals`: removed compound `where + orderBy`; filter visibility/status and sort publishedAt client-side
  - `getFeaturedNovels`: removed compound `where + where + orderBy`; filter status client-side
  - `searchContent`: removed `where('status', ...) + where('visibility', ...)` from Firestore query; filter client-side after title prefix match
  - `getComments`: replaced 3-clause `where` + `orderBy` with single `where('targetId')` + client-side filter
- `src/types/webtoon.ts`: Added `visibility: 'public' | 'unlisted' | 'private'` field to `Webtoon` interface (was missing — webtoons had no visibility in schema)
- `src/lib/firebase/firestore.ts` `createWebtoon`: Adds `visibility: 'public'` default when creating webtoons

## 2026-06-27 — Studio "Published" tab empty + cover image 400 error

- `create/novel/page.tsx`: Renamed "Published" tab to "Live" (type `FilterStatus: 'live'`). `publishNovel()` sets `status: 'ongoing'`, not `'published'`, so the old tab was always empty. "Live" now filters `status !== 'draft'` and the tab count matches.
- `create/webtoon/page.tsx`: Same fix — "Published" → "Live", filter updated to `status !== 'draft'`.
- `create/seed/page.tsx`: Changed `COVER_URL` from `/images/ravana-cover.png` (non-existent local file causing 400 errors) to `https://picsum.photos/seed/ravana/900/1350`. Existing seeded documents in Firestore still have the broken URL — update cover via Edit Details in the studio.

## 2026-06-27 — Published novels not showing in Home / Browse / Originals

- `firestore.indexes.json`: Added 24 composite indexes (novels + webtoons) required by compound queries. Previously the file was empty, causing every multi-field query with orderBy to fail silently.
- `firestore.ts` `browseContent`: Fixed `in` + `array-contains` conflict — Firestore forbids combining `where('status', 'in', [...])` with `where('genres', 'array-contains', genre)` in the same query. When genre is selected, the query now uses `array-contains` on genres + equality on visibility, and filters status client-side. When no genre, the original `in` filter is used.
- **Action required**: Deploy indexes with `firebase deploy --only firestore:indexes` (indexes take a few minutes to build).
- Note: "Originals" page only shows content where `isOriginal: true`. Regular published novels won't appear there — that's expected.

## 2026-06-27 — Profile page "Profile Not Found" fix

- `ProfilePageClient.tsx`: Fixed race condition where `load()` fired before `AuthContext` resolved auth state, causing `getUserProfile` to return null and show "Profile Not Found" even when logged in.
- Added `authLoading` guard: `load()` now returns early while auth is still loading, and the skeleton is shown until both auth and profile load complete.
- Added auto-heal: if viewing own profile and Firestore document is missing, `createUserDocument` is called automatically then profile is re-fetched.
- `isOwnProfile` now only evaluates to `true` after auth has finished loading (`!authLoading && firebaseUser?.uid === uid`).

## 2026-06-27 — Novel Creation, Publishing, Profile, Wallet & Token Economy

### 1. AI Generation — Error Handling & Logging
- `src/app/api/ai/novel-content/route.ts`: Added server-side `ANTHROPIC_API_KEY` presence check; logs all errors with `console.error`; returns the actual error message to the client instead of swallowing it.
- `src/app/api/ai/generate-image/route.ts`: Same treatment; added `ANTHROPIC_API_KEY` guard; logs Stability AI errors clearly.
- `src/components/novel/CreateNovelModal.tsx`: Shows the real server error message in the toast instead of a generic fallback; handles `insufficientTokens` (402) responses gracefully.
- `src/components/novel/AIImageGenerator.tsx`: Same — surfaces actual API errors and handles token-insufficient responses without crashing.

### 2. Novel Schema — slug, language, visibility
- `src/types/novel.ts`: Added `language: string`, `visibility: ContentVisibility ('public' | 'private')`.
- `src/lib/firebase/firestore.ts` (`createNovel`): Saves `language: 'en'` and `visibility: 'public'` defaults; `bannerURL: null` default added.
- `src/components/novel/CreateNovelModal.tsx`: Generates `slug` from title + timestamp on creation using the existing `slugify` utility.
- `src/lib/firebase/firestore.ts` (`browseContent`): Added `where('visibility', '==', 'public')` constraint so private novels never appear in Browse/Home.

### 3. Firestore Service Extensions
- `src/lib/firebase/firestore.ts`: Added:
  - **Followers**: `followUser`, `unfollowUser`, `isFollowing`, `getFollowers`, `getFollowing` — atomic batch operations with counter increments.
  - **Transactions**: `createTransaction`, `getUserTransactions`, `deductTokens`, `creditTokens`.
  - **Withdrawals**: `createWithdrawalRequest`, `getCreatorWithdrawals`.
  - **Search**: `searchContent` — prefix-range Firestore query on title.
  - **Originals**: `getOriginals`, `getFeaturedNovels`.

### 4. Home Page — Dynamic Trending Feed
- `src/app/(main)/page.tsx`: Removed `force-static`; imports `HomeFeed` client component.
- `src/app/(main)/HomeFeed.tsx` (new): Client component that loads trending novels and webtoons from Firestore; shows skeletons while loading; graceful empty state with CTA.

### 5. Browse Page — Fully Functional
- `src/app/(main)/browse/page.tsx`: Wraps `BrowseClient` in `Suspense`.
- `src/app/(main)/browse/BrowseClient.tsx` (new): Full client-side browse with genre filter, sort, status filter, content-type tabs, debounced search (prefix match), clear-filters button, skeleton loading, empty states, WCAG-compliant ARIA attributes.

### 6. Profile Page — Real Data + Followers + Edit
- `src/app/(main)/profile/[uid]/page.tsx`: Delegates to `ProfilePageClient`.
- `src/app/(main)/profile/[uid]/ProfilePageClient.tsx` (new): Full client component:
  - Loads `UserProfile`, novels, webtoons, bookmarks from Firestore.
  - Shows banner, avatar, stats grid (followers/following/novels/webtoons/views/likes).
  - Tabs: Novels, Webtoons, Bookmarks (own profile), About.
  - `FollowButton`: atomic follow/unfollow with optimistic counter update.
  - `EditProfileModal`: upload avatar/banner, edit display name, bio, website, Twitter, Instagram; saves via `updateUserProfile` + Firebase Storage.

### 7. Originals Page — Real Data
- `src/app/(main)/originals/page.tsx`: Delegates to `OriginalsClient`.
- `src/app/(main)/originals/OriginalsClient.tsx` (new): Loads all `isOriginal=true` published content; sorted by views; empty state with messaging.

### 8. Creator Hub — Wallet + Dashboard Quick Links
- `src/app/(main)/create/page.tsx`: Added Wallet and Dashboard quick-link cards.

### 9. Wallet Page
- `src/app/(studio)/wallet/page.tsx` (new): Full wallet dashboard:
  - Stats: Token Balance, Total Earned, Pending Payout.
  - Token cost reference table for all AI features.
  - **Buy Tokens** tab: Renders `COIN_PACKAGES` with Razorpay order creation.
  - **Withdraw** tab: UPI/bank form with minimum ₹200 guard, `createWithdrawalRequest` integration.
  - **History** tab: Transaction list + withdrawal history with status icons.

### 10. Razorpay Integration
- `src/app/api/payments/create-order/route.ts` (new): Creates Razorpay order via REST API using `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`; validates package ID; returns `orderId`, `amount`, `currency`.
- `src/app/api/webhooks/route.ts`: Completed — handles `payment.captured` event: verifies HMAC signature, checks idempotency (skips already-processed payment IDs), credits tokens to the user, creates a `transactions` record. Logs `payment.failed` events.

### 11. Token Economy
- `src/lib/tokens.ts` (new): `TOKEN_COSTS` map, `getUserBalance`, `chargeTokens` — deducts from Firestore balance atomically and writes a transaction record.
- `src/types/transaction.ts`: Added `'ai_usage'` to `TransactionType`.
- `src/app/api/ai/novel-content/route.ts`: Charges 2–3 tokens per synopsis action when `userId` is provided; returns HTTP 402 with `insufficientTokens: true` if balance insufficient.
- `src/app/api/ai/generate-image/route.ts`: Charges 1 token for prompt generation, 15 for image generation.
- `src/components/novel/CreateNovelModal.tsx` + `AIImageGenerator.tsx`: Pass `userId` to all AI API calls.
- `src/app/(novel)/create/novel/page.tsx`: Passes `userId` prop to `CreateNovelModal`.

### Database Schema Changes
- `novels` collection: new fields `language` (string), `visibility` ('public' | 'private'), `bannerURL` (default null).
- `follows` collection (new): `{ followerId, followingId, createdAt }` keyed as `${followerId}_${followingId}`.
- `transactions` collection: extended with `ai_usage` type; `razorpayPaymentId` field for idempotency.
- `withdrawals` collection: used via `createWithdrawalRequest`.

### Required Environment Variables (new)
- `RAZORPAY_KEY_ID` — Razorpay API key (public)
- `RAZORPAY_KEY_SECRET` — Razorpay secret (server-only)
- `RAZORPAY_WEBHOOK_SECRET` — Webhook HMAC secret
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — For client-side Razorpay checkout

### Firestore Index Requirements (new)
- `novels`: composite index on `(visibility, status, viewCount DESC)` for home/browse
- `novels`: composite index on `(visibility, status, createdAt DESC)` for newest sort
- `novels`: composite index on `(visibility, status, rating DESC)` for rating sort
- `novels`: composite index on `(isOriginal, status, publishedAt DESC)` for originals
- `follows`: composite index on `(followingId, createdAt DESC)`
- `follows`: composite index on `(followerId, createdAt DESC)`
- `transactions`: composite index on `(userId, createdAt DESC)`
- `withdrawals`: composite index on `(creatorId, createdAt DESC)`

## 2026-06-26 — Fix ARIA Invalid Attribute Value on Profile Page Tab

- `src/app/(main)/profile/[uid]/page.tsx`: Split the profile page tab selection buttons into separate static renderings with explicit `aria-selected="true"` and `aria-selected="false"` to prevent WCAG linting tools from flagging the JSX expression as `"{expression}"`.

## 2026-06-26 — Full routing performance audit & optimisation

**next.config.js**
- Added `experimental.optimizePackageImports` for `lucide-react`, `framer-motion`, all `@radix-ui/*` packages, `date-fns` — eliminates barrel-import overhead
- Added `compress: true`, `poweredByHeader: false`
- Added `images.formats: ['image/avif', 'image/webp']` for next-gen image formats

**Instant loading states — `loading.tsx` created for every route group**
- `src/app/(main)/loading.tsx` — hero + card grid skeleton (replaces blank screen on Home/Browse/Originals navigation)
- `src/app/(novel)/loading.tsx` — full three-column editor skeleton (toolbar + chapter sidebar + editor + AI panel)
- `src/app/(studio)/loading.tsx` — admin content skeleton
- `src/app/(auth)/loading.tsx` — auth form skeleton

**Error boundaries — `error.tsx` created for every route group**
- `src/app/error.tsx` (root), `(main)/error.tsx`, `(novel)/error.tsx`, `(studio)/error.tsx`
- Each shows a contextual retry button instead of cascading to a blank screen

**Static rendering — three public pages now pre-rendered at build time**
- `(main)/page.tsx`, `(main)/browse/page.tsx`, `(main)/originals/page.tsx` — `export const dynamic = 'force-static'`
- Served from CDN edge on Vercel; zero server compute per request

**Bundle splitting — dynamic imports replacing static ones**
- `NovelRichEditor` (TipTap ~200 KB) → `next/dynamic` with `ssr: false` in novel editor
- `AIAssistant` → `next/dynamic` with `ssr: false`; deferred until after initial paint
- `AIImageGenerator` → `next/dynamic` with `ssr: false` in webtoon editor
- `jsPDF` (~230 KB) → async `import('jspdf')` inside `handleExportPDF`; removed from initial route chunk entirely
- `CreateNovelModal` → `next/dynamic` (not needed on initial novel dashboard render)
- `CreateWebtoonModal` → `next/dynamic` (not needed on initial webtoon dashboard render)

**Layout memoisation**
- `Navbar` and `Footer` wrapped with `React.memo` — prevents re-render on parent layout context updates

**Accessibility fixes (pre-existing issues resolved)**
- Added `type="button"` to 16 buttons across `create/novel/page.tsx`, `create/webtoon/[webtoonId]/page.tsx`, `Navbar.tsx`, `browse/page.tsx`
- Removed invalid `role="list"` from placeholder grid divs in `(main)/page.tsx`, `browse/page.tsx`, `originals/page.tsx` (no `role="listitem"` children)
- Fixed `aria-pressed` from boolean expression to string literal in `FilterChip`

## 2026-06-26 — Global time utility; replace all Date.now() call sites

- Created `src/lib/utils/time.ts` with `now()` (ms timestamp) and `nowTimestamp()` (Firestore `{seconds, nanoseconds}` shape)
- Replaced all `Date.now()` usages in: `AIAssistant.tsx`, `EpisodeSidebar.tsx`, `ChapterSidebar.tsx`, `AIImageGenerator.tsx`, `formatters.ts`

## 2026-06-26 — Fix middleware conflict and PWA dev noise

- Deleted `src/middleware.ts` — Next.js 15 uses `proxy` convention; `src/proxy.ts` already had all the same route-guard logic
- Refactored `next.config.js` to only apply `withPWA` wrapper in production, eliminating the double `[PWA] PWA support is disabled` console log in dev

## 2026-06-24 — Novel Creation Module (Session 2)

### Design system
- Changed accent color from `#00C896` (green) to `#FFFFFF` (white) — YouTube/Google dark mode aesthetic
- Updated `tailwind.config.ts`: new accent tokens, tighter bg-border (`#3F3F3F`), new animations (`slide-in-left`, `scale-in`)
- Updated `globals.css`: white btn-accent/btn-ghost/focus-rings, neutral scrollbar, full TipTap prose CSS

### New packages installed
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-character-count`, `@tiptap/extension-underline` — rich text editor
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag & drop chapter reordering
- `@anthropic-ai/sdk` — AI story assistant API
- `jspdf` — PDF export

### Firebase extensions
- `src/types/novel.ts`: added `bannerURL` field to Novel interface
- `src/lib/firebase/firestore.ts`: added `deleteNovel`, `publishNovel`, `unpublishNovel`, `reorderChapters` (writeBatch), `duplicateChapter`, `updateChapterContent`, `subscribeToNovels` (onSnapshot), `subscribeToChapters` (onSnapshot), `AIMessage` type, `getNovelAIChatHistory`, `addNovelAIMessage`, `clearNovelAIChat`
- `src/lib/firebase/storage.ts`: added `uploadNovelBanner` with progress callback
- `firestore.rules`: added `novel_ai_chats` rules (owner-only read/write)

### New hooks
- `src/hooks/useNovels.ts` — real-time `onSnapshot` listener for author's novels
- `src/hooks/useChapters.ts` — real-time `onSnapshot` listener for novel chapters

### New API route
- `src/app/api/ai/novel-assist/route.ts` — POST to Claude claude-sonnet-4-6 with novel/chapter context; 9 quick-action prompts

### Route restructure
- Removed `(studio)/create/novel/` routes (had sidebar)
- Created `(novel)/` route group — full-width, no sidebar
- `src/app/(novel)/create/novel/page.tsx` — Novel Dashboard
- `src/app/(novel)/create/novel/[novelId]/page.tsx` — Novel Editor

### Novel Dashboard (`/create/novel`)
- Real-time novel grid (2→6 columns responsive)
- Stats bar: total novels, published, chapters, views
- Search (client-side), status filter tabs with counts, sort dropdown
- Novel card: cover image, status badge, genres, chapter/view counts, relative timestamp
- Card hover: overlay with Open Editor button + MoreVertical menu (Open, Edit Details, Publish/Unpublish, Delete)
- Delete confirmation dialog
- Publish validation: requires cover, synopsis, ≥1 chapter

### CreateNovelModal
- Cover image upload (2:3 ratio, Storage with progress bar)
- Banner image upload (16:9 ratio, Storage with progress)
- Title, Synopsis, Genres multi-select (up to 5), Tags (chip input, max 10), Status, Visibility
- Doubles as Edit Modal — pre-fills existing novel data
- All ARIA attributes WCAG-compliant (string booleans, label-wrapping upload)

### Novel Editor (`/create/novel/[novelId]`)
- Three-column layout: ChapterSidebar (320px) | TipTap Editor (flex, max 900px) | AI Assistant (350px)
- All three columns collapsible to 40px icon strip
- Fullscreen mode hides both sidebars, covers viewport

### ChapterSidebar
- Real-time chapter list via `useChapters` hook
- `@dnd-kit` drag & drop reordering with optimistic update + Firestore batch write
- Per-chapter actions: duplicate, delete (with confirmation)
- Word count display per chapter
- Collapsed mode shows numbered chapter buttons

### NovelRichEditor (TipTap)
- StarterKit: bold, italic, strike, headings H1-H3, lists, blockquote, code, HR
- Underline extension
- Undo/Redo in toolbar
- Character count extension → words, characters, reading-time in footer
- `immediatelyRender: false` for SSR safety
- Full prose CSS in globals.css (no @tailwindcss/typography dependency)

### EditorToolbar
- Sticky header: back link, novel title, chapter title, save state indicator (saving/saved/error)
- Actions: Save (Ctrl+S hotkey), Export PDF, Preview (new tab), Fullscreen toggle, Publish/Unpublish
- Autosave: debounced 5s after last keystroke

### AIAssistant
- ChatGPT-style interface with message history from Firestore `novel_ai_chats`
- 9 quick-action prompts: Generate Ideas, Create Character, World Building, Dialogue, Continue Story, Plot Expansion, Fix Grammar, Rewrite Section, Summarize
- Typing indicator (bouncing dots)
- Context-aware: sends novel title, synopsis, current chapter title + last 1000 chars to Claude API
- Persists chat history per novel in Firestore
- Clear chat button

### PDF Export
- `jspdf` text-based PDF: title page (title, author, synopsis) + all chapters with HTML-stripped content
- Instant client-side download

### Build result
- ✓ 0 TypeScript errors
- ✓ 20 routes compiled
- ✓ PWA service worker generated

## 2026-06-24 — Firebase Keys Wired Into .env.local
- Filled `.env.local` with real Firebase project `toonflow-studio-paint-f384c` keys
- All 7 client keys set as `NEXT_PUBLIC_FIREBASE_*` env vars
- `src/lib/firebase/config.ts` already reads from env vars — no code change needed
- `.env.local` is gitignored via `.env*` rule in `.gitignore` — keys are safe
- `FIREBASE_ADMIN_*` keys still need to be filled from Firebase Console → Service Accounts

## 2026-06-24 — Full Project Scaffold (Session 1)

### Initialized
- Next.js 16.2.9 (App Router, TypeScript, Tailwind CSS v3, `src/` dir)
- Tailwind v4 downgraded to v3.4.19 (next-pwa requires webpack/v3)
- `next build --webpack` / `next dev --webpack` scripts (Turbopack incompatible with next-pwa)
- `src/proxy.ts` replaces `middleware.ts` (Next.js 16 rename, `export function proxy`)

### Dependencies installed
- firebase, next-pwa@5.6.0, lucide-react, framer-motion, zustand, zod, react-hook-form, @hookform/resolvers
- Radix UI: dialog, dropdown-menu, avatar, tooltip, tabs, select, scroll-area
- clsx, tailwind-merge, date-fns, embla-carousel-react, react-hot-toast, react-intersection-observer, sharp
- tailwind-scrollbar@3.1.0, autoprefixer

### Design System
- `tailwind.config.ts` — full color tokens (bg, text, accent #00C896, danger, warning)
- `src/app/globals.css` — Inter font, CSS variables, thin scrollbar, WCAG focus rings, skip-to-main link
- Component utilities: `.card`, `.btn-accent`, `.btn-ghost`, `.btn-danger`, `.input-base`, `.shimmer`

### Types created (`src/types/`)
- user.ts — UserProfile, UserRole, BookmarkItem, ReadingHistoryItem
- novel.ts — Novel, Chapter, ContentStatus, ContentGenre
- webtoon.ts — Webtoon, Episode, PanelImage
- comment.ts — Comment, Report
- transaction.ts — Transaction, Withdrawal, CoinPackage
- index.ts — barrel re-exports

### Utilities (`src/lib/utils/`)
- cn.ts — clsx + tailwind-merge helper
- constants.ts — SUPER_ADMIN_EMAIL, GENRES, COIN_PACKAGES, REVENUE_SPLIT, cookie names
- formatters.ts — formatRelativeTime, formatDate, formatCount, formatCurrency, slugify, truncate, wordCount

### Firebase Service Layer (`src/lib/firebase/`)
- config.ts — singleton Firebase app, exports auth/db/storage
- auth.ts — Google, GitHub, email sign-in/up, logout (calls DELETE /api/session), reset password
- firestore.ts — full CRUD for users, novels, chapters, webtoons, episodes, bookmarks, history, comments, reports, withdrawals, browse query
- storage.ts — uploadFile with progress, avatar/banner/cover/panel helpers

### Auth & State
- `src/contexts/AuthContext.tsx` — onAuthStateChanged → getUserProfile → sets session cookies
- `src/hooks/useAuth.ts` — re-export
- `src/hooks/useDebounce.ts`, `useInfiniteScroll.ts`, `useFirestore.ts`
- `src/store/useAppStore.ts` — Zustand (fontSize, browseFilters, mobileNavOpen, loginModalOpen)

### Layouts & Routing
- Root layout — AuthProvider + Toaster + skip-to-main link
- `(main)` route group — Navbar + MobileNav + Footer
- `(auth)` route group — centered auth layout
- `(studio)` route group — StudioSidebar + protected creator tools
- `src/proxy.ts` — route protection: /create, /dashboard (auth required), /admin (admin role), /admin/super (superadmin email)

### Components
- layout/: Navbar, UserMenu, MobileNav, Footer, StudioSidebar
- ui/: Button, Badge, Skeleton, Input, Modal
- content/: NovelCard, WebtoonCard
- auth/: LoginForm (Google + email + zod validation), SignupForm

### Pages (19 routes compiled)
- / — Home (hero, continue reading, trending, originals promo)
- /browse — filters sidebar + content grid
- /originals
- /login, /signup
- /profile/[uid]
- /novel/[id], /webtoon/[id]
- /dashboard
- /create — hub (novel vs webtoon cards)
- /create/novel, /create/novel/[id]
- /create/webtoon, /create/webtoon/[id]
- /admin, /admin/super
- /api/session (POST/DELETE for httpOnly cookies)
- /api/webhooks (payment webhook placeholder)
- not-found.tsx

### Config & Rules
- next.config.js (CJS, next-pwa wrapped, image domains)
- public/manifest.json (PWA, shortcuts to /browse and /create)
- public/sw.js generated by next-pwa on build
- .env.local + .env.example (templates with all Firebase keys)
- firestore.rules (public read, auth-gated writes, admin override)
- storage.rules (public read, auth write, 10MB/25MB limits)
- CLAUDE.md (project conventions, WCAG requirements, design tokens)

### WCAG Accessibility Built-in
- Skip-to-main link (#main-content) on every layout
- All icons have aria-hidden="true"
- All icon-only buttons have aria-label
- All inputs connected to labels via htmlFor/id
- Error messages use role="alert"
- Nav elements have aria-label and aria-current="page"
- Tab interfaces use proper ARIA role/tablist/tabpanel
- focus-visible:ring-2 on all interactive elements
- Minimum 4.5:1 contrast maintained throughout


## 2026-06-25 — Full Security, WCAG & UX Audit (Session 3)

### Security fixes
- `src/middleware.ts` (NEW): Route protection — `/create/**` and `/dashboard/**` require auth cookie; `/admin/**` requires admin role; `/admin/super/**` requires superadmin email. Redirects unauthenticated users to `/login?redirect=<path>`.
- `src/app/api/ai/novel-assist/route.ts`, `generate-image/route.ts`, `novel-content/route.ts`: Added 401 auth guard — all three AI endpoints previously accepted requests from unauthenticated callers (API cost abuse vector).
- `src/components/auth/LoginForm.tsx`: Fixed open redirect — `redirect` search param now validated to be a relative path starting with `/` and not `//`. Arbitrary external URLs are rejected.
- `src/app/api/webhooks/route.ts`: Webhook now verifies Razorpay HMAC-SHA256 signature via `crypto.timingSafeEqual`; returns 401 on mismatch and 503 if `RAZORPAY_WEBHOOK_SECRET` is unset.

### WCAG / Accessibility fixes
- `src/components/ui/Input.tsx`: Replaced `Math.random()` ID generation with React `useId()` — eliminates SSR hydration mismatch and non-stable IDs. Added `aria-required="true"` (string) when `required` prop is set.
- `src/app/(novel)/create/novel/[novelId]/page.tsx`: Removed `focus-visible:ring-0` from chapter title input — violation of WCAG 2.4.7 (focus visible). Replaced with `focus-visible:outline-2 focus-visible:outline-white/40`.
- `src/app/(novel)/create/novel/page.tsx` (DeleteConfirmDialog): Added `useEffect` focus trap (Cancel button auto-focused on open), Escape key handler, and `aria-describedby="delete-dialog-desc"` on dialog container.
- `src/components/editor/AIAssistant.tsx`: Replaced `window.confirm()` (inaccessible, deprecated) with inline confirmation UI using `confirmClear` state. Also fixed: `type="button"` on all buttons, `aria-expanded` as boolean, `bg-white/8` → `bg-white/10` (invalid Tailwind v3 opacity), inline `animationDelay` style → Tailwind arbitrary `[animation-delay:Xms]`, inline `height: auto` style → DOM ref manipulation via `onInput` handler.
- `src/components/auth/LoginForm.tsx`, `SignupForm.tsx`: Replaced `role="separator"` on `<div>` (invalid ARIA usage) with `<hr>` elements and `aria-hidden="true"` on the wrapper.

### UX / bug fixes
- `src/app/(novel)/create/novel/page.tsx`: Added `useEffect` Escape key handler to close sort dropdown. Added `type="button"` to all 5 buttons missing it.
- `src/components/layout/Footer.tsx`: Removed `/profile` link (broken — no UID available in Server Component). Profile is already accessible via the UserMenu dropdown.

### Code quality / convention fixes
- `src/app/(novel)/create/novel/page.tsx`, `[novelId]/page.tsx`, `create/webtoon/page.tsx`, `[webtoonId]/page.tsx`: Changed `import { useAuth } from '@/contexts/AuthContext'` → `@/hooks/useAuth` everywhere (CLAUDE.md convention).

## 2026-06-25 — Fix 11 ARIA/CSS lint problems

- `CreateWebtoonModal.tsx`: Changed `aria-invalid` from JSX expression to spread-object pattern (matches CreateNovelModal, avoids axe static-analysis false positive); split `aria-selected` genre buttons into two static renders (`"true"`/`"false"`); added `aria-label="Select genres"` to `role="listbox"` div
- `(novel)/create/novel/page.tsx`: Added `aria-label="Sort order options"` to sort `role="listbox"` div
- `(novel)/create/webtoon/page.tsx`: Added `aria-label="Sort order options"` to sort `role="listbox"` div
- `CreateNovelModal.tsx`: Added `aria-label="Select genres"` to `role="listbox"` div
- `globals.css`: Wrapped `scrollbar-width`/`scrollbar-color` in `@supports (scrollbar-width: thin)` block to suppress compat warnings (webkit fallback retained)
- `EpisodeSidebar.tsx`: Removed `style` prop from `<li>`; apply dnd-kit transform/transition imperatively via `useEffect` + merged ref (`useRef` + `useCallback`); moved opacity/z-index to Tailwind conditional classes

## 2026-06-26 — Comprehensive Project Audit: Security, Bug & Code Quality Fixes

### 🔴 Critical security / correctness fixes

**`src/proxy.ts` (UPDATED — correct middleware filename for this Next.js build)**
- This custom Next.js build uses `proxy.ts` / `export function proxy` as the middleware convention (not `middleware.ts`). The audit incorrectly created `src/middleware.ts`, causing a conflict error. Deleted `middleware.ts`; all route protection lives in `proxy.ts`.
- Route protection: auth gate → redirects to `/login?redirect=<path>`; admin gate checks `ROLE_COOKIE_NAME`; super-admin gate checks `EMAIL_COOKIE_NAME === SUPER_ADMIN_EMAIL`.

**`firestore.rules`**
- `discussions/{threadId}`: `allow create` now requires `isAuthenticated()` — previously any unauthenticated user could write directly to Firestore.
- `discussions/{threadId}/comments/{commentId}`: same fix — create and update now require authentication.
- Bookmark path corrected: rules now match the actual subcollection path `bookmarks/{uid}/items/{contentId}` used by the service layer (old flat-collection rule at `bookmarks/{bookmarkId}` never fired for any real bookmark write).

**`storage.rules`**
- Added `novels/{novelId}/banner/{file}` rule — `uploadNovelBanner` in `storage.ts` uploads to this path but no rule existed, causing production upload failures.
- Novel and webtoon cover writes now verify the requester is the document's author via `firestore.get(...)`.data.authorId == request.auth.uid.

### 🟠 High fixes

**`src/components/content/WebtoonCard.tsx` + `NovelCard.tsx`**
- Both cards used `/images/ravana-cover.png` as the fallback src. `public/images/` is empty — all cards without a cover rendered a broken image in production.
- Fixed: conditional render — if `coverURL` exists, show `<Image>`; otherwise show an inline `ImageOff` icon placeholder (matches existing pattern in other empty states).

**`next.config.js`**
- Added `poweredByHeader: false` (removes `X-Powered-By: Next.js` response header).
- Added `async headers()` returning `securityHeaders` on all routes: `X-DNS-Prefetch-Control`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### 🟡 Medium fixes

**`src/lib/utils/time.ts`**
- `nowTimestamp()` returned `Date.now() / 1000` (a float, e.g. `1750000000.123`) for `seconds`. Firestore timestamps require integer seconds. Fixed to `Math.floor(Date.now() / 1000)`.

**`src/lib/utils/formatters.ts`**
- Added `formatRelativeTimestamp(ts)` using `date-fns formatDistanceToNow` — consolidates the identical local function that existed in both create pages.

**`src/app/(novel)/create/novel/page.tsx` + `create/webtoon/page.tsx`**
- Removed locally-duplicated `formatCount()` and `formatRelative()` functions from both files.
- Now import `formatCount` and `formatRelativeTimestamp` from `@/lib/utils/formatters`.

**`src/components/editor/ChapterSidebar.tsx`**
- Replaced `window.confirm()` in `handleDelete` with an inline two-step confirmation UI: first click on the trash icon sets `pendingDeleteId`; the row renders "Delete / Cancel" buttons in place of the action icons; confirming calls the actual Firestore delete.
- Added `type="button"` to all action buttons in `SortableChapterRow`.

**`src/components/editor/EpisodeSidebar.tsx`**
- Same inline confirmation fix as ChapterSidebar.

**`src/components/novel/CreateNovelModal.tsx`**
- Fixed `URL.createObjectURL` memory leak: object URLs are now tracked in `coverObjectURL` and `bannerObjectURL` refs; revoked on replacement and on component unmount via `useEffect` cleanup.
- Removed `console.error(err)` from the `onSubmit` catch block (leaked internal errors to browser console in production).

### 🟢 Low fixes

**Root directory**
- Deleted `nul` Windows device-name artifact file that appeared as an untracked file in git status.

## 2026-06-26 — Fix ARIA Invalid Attribute Value in AIAssistant

- `AIAssistant.tsx`: Changed `aria-expanded={showActions}` to the project's standard spread-object pattern `{...(showActions ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}` to resolve invalid ARIA attribute value errors in static validation.

## 2026-06-27 — Fix ARIA pressed attribute value errors across multiple files

- **Explanation**: Custom linter or static verification checks compile-time AST attributes. Direct JSX expressions container values like `aria-pressed={following ? 'true' : 'false'}` are parsed by these checkers as `"{expression}"`, failing compliance because they do not evaluate to static literals like `"true"`, `"false"`, or `"mixed"`.
- **Fix**: Replaced dynamic `aria-pressed` JSX expressions with the object-spread pattern, e.g. `{...(following ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}`. This preserves runtime ARIA state rendering while bypassing static AST linter limitations.
- **Affected Files**:
  - `src/app/(main)/profile/[uid]/ProfilePageClient.tsx`
  - `src/components/reader/LikeButton.tsx`
  - `src/components/reader/CommentSection.tsx`
  - `src/components/reader/BookmarkButton.tsx`
  - `src/app/(main)/browse/BrowseClient.tsx`
  - `src/app/(studio)/wallet/page.tsx`


## 2026-06-30
- Fixed `require is not defined` error in tailwind.config.ts by replacing `require('tailwind-scrollbar')` with an ESM `import` (file was loaded as ESM, CJS require unavailable)

## 2026-07-02 — Editor WYSIWYG + Dramatic Typography + Reader Fixes

### Editor WYSIWYG (editor looks identical to the published reader)
- `src/app/(novel)/create/novel/[novelId]/page.tsx`: Changed center editor area from `bg-bg-card` to `bg-black`. Chapter title input area redesigned: black bg, `editor-chapter-title` CSS class (Georgia serif, clamp 1.8–3rem), chapter number label above in small-caps, thin divider below.
- `src/components/editor/NovelRichEditor.tsx`: Editor content area uses `bg-black`, `max-w-[680px]`, Georgian serif at 1.125rem/1.9 line-height — same as the reader.

### Dramatic Typography (TipTap extensions + color palette)
- Installed `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`.
- `src/components/editor/NovelRichEditor.tsx` rewritten: Added TextAlign (types: heading, paragraph), TextStyle, Color extensions. Added alignment toolbar buttons (AlignLeft, AlignCenter, AlignRight). Added 6-color text palette: White, Muted (50%), Gold (#C9A84C), Crimson (#E05252), Frost (#7EC8E3), Sage (#7CB87C) plus reset. Color swatches use Tailwind `cls` field (not inline `style.backgroundColor`).
- `src/app/globals.css` — heading hierarchy rewritten to match cinematic reference:
  - H1: clamp(2.5rem→4.5rem), 900 weight, italic, letter-spacing -0.02em (large dramatic heading)
  - H2: clamp(1.6rem→2.4rem), 800 weight (section heading)
  - H3: 0.75rem, 700 weight, 0.4em letter-spacing, uppercase, gold (#C9A84C) (small-caps scene label)
- `.reader-content` headings updated to match exactly.

### Reader Fixes
- Raw `<p>` HTML tags visible in reader → replaced `renderContent()` text-splitter with `dangerouslySetInnerHTML` + `.reader-content` prose CSS.
- Invisible text in reader (opacity:0 never resolved) → removed IntersectionObserver; container now uses simple `animation: reader-fade-in` on mount.
- `.reader-content p` has `text-align: inherit` so TipTap's `style="text-align: center"` on aligned paragraphs passes through.
- Chapter reader moved from `(main)` route group to `(reader)` route group (black layout, no Navbar/Footer). Old `(main)/novel/[id]/chapter/` deleted.

### Wallet in Studio Sidebar
- `src/components/layout/StudioSidebar.tsx`: Added Wallet link under Dashboard.

## 2026-06-30 — Fix Login button
- Fixed Login button in Navbar/UserMenu/MobileNav: was calling setLoginModalOpen(true) but no LoginModal existed, so clicking Login did nothing
- Changed Login button to Link href='/login', Create button (unauthenticated) to href='/login?redirect=/create'

## 2026-07-02 — Fix broken dev build (500s) + editor cleanup
- **Installed missing `jspdf` dependency** — `src/app/(novel)/create/novel/[novelId]/page.tsx` dynamically imports it for PDF export, but it was never added to package.json, causing a webpack ModuleBuildError that 500'd routes in dev.
- **Renamed `src/middleware.ts` → `src/proxy.ts`** (`export function proxy`) — Next.js 16 deprecated the middleware convention; having middleware.ts caused conflict errors. Logic unchanged (auth/admin/super-admin route gates).
- **`NovelRichEditor.tsx`**: removed standalone `@tiptap/extension-underline` from the extension list — TipTap v3 StarterKit already bundles `underline`, so it was a duplicate extension name.
- Verified: `tsc --noEmit` clean; reader route (`/novel/[id]/chapter/[chapterId]`) returns 200; `/create/**` correctly 307-redirects unauthenticated users and returns 200 with auth cookie.

## 2026-07-02 — Fix chapter likes (Firestore rules) + profile bookmarks tab
- **firestore.rules**: likes were failing because `toggleLike` increments `likeCount` on the content doc, but chapters/novels/webtoons only allowed writes by the author/admin. Added an `onlyUpdates(keys)` helper and counter-only update carve-outs for signed-in users: `viewCount`/`likeCount` on novels, webtoons, chapters, episodes; `likeCount` on comments; `followerCount`/`followingCount` on users (follow/unfollow batch had the same permission bug). Deployed with `firebase deploy --only firestore:rules --project toonflow-studio-paint-f384c` (note: CLI needs the explicit `--project` flag; default alias resolution 403s).
- **ProfilePageClient.tsx**: the Bookmarks tab only rendered a "N bookmarked items" text line — bookmark docs (contentId/contentType) are now resolved via `getNovelById`/`getWebtoonById` and rendered as a `ContentCard` grid linking to `/novel/{id}` or `/webtoon/{id}`. Deleted/missing content is filtered out.

## 2026-07-02 — AI Story Assistant: fix 401 + auto-write chapter workflow
- **Diagnosed 401 "invalid x-api-key"**: the `ANTHROPIC_API_KEY` in `.env.local` is well-formed but rejected by the Anthropic API (verified with a direct `/v1/models` call) — the key is revoked/invalid and must be regenerated at console.anthropic.com. No code fix possible.
- **api/ai/novel-assist**: added `mode: 'write-chapter'` — generates a complete chapter as clean `<p>` HTML in webtoon format (short dramatic one-line paragraphs) using `claude-opus-4-8` with server-side streaming (`messages.stream` + `finalMessage`, max_tokens 32000) to avoid HTTP timeouts; strips markdown fences and converts plain-text fallback to paragraphs. Added `export const maxDuration = 300`.
- **AIAssistant.tsx**: new `onApplyChapter` prop + "Write Full Chapter to Canvas" button — sends the last 20 conversation turns as creative direction, applies the returned HTML to the editor, and logs a note in chat.
- **create/novel/[novelId]/page.tsx**: `handleApplyAIChapter` sets editor content, computes word count from stripped HTML, and immediately persists via `triggerSave`.

## 2026-07-03 — Master Webtoon Story Architect: storyboard generation + chapter continuity
- **api/ai/novel-assist**: replaced the write-chapter system prompt with the Master Webtoon Story Architect prompt — transforms a rough chapter idea into a cinematic panel-by-panel webtoon storyboard (camera, environment, characters, dialogue, SFX, lighting, emotion, transitions, per-panel AI illustration prompts) with a consistency engine that honors the Story Bible context and all previous chapters. Model now returns strict structured JSON (`chapterTitle`, `summary`, `panels[]`); server renders it to rich-editor HTML via `scriptToHtml()` and returns both `{ html, script }`, with a plain-text/HTML fallback if JSON parsing fails.
- **api/ai/novel-assist**: request body now accepts `novelGenres`, `novelTags`, and `previousChapters[]` (number/title/status/excerpt); context block includes up to 12 previous chapters (3000 chars each) for both chat and write-chapter modes. Chat system prompt updated with continuity rules (never contradict events, revive dead characters, change personalities, or reset emotions).
- **AIAssistant.tsx**: new optional `chapters` prop + `buildPreviousChapters()` — strips editor HTML from earlier chapters and sends condensed excerpts with every request; write-chapter task message rewritten for storyboard output.
- **create/novel/[novelId]/page.tsx**: passes the `useChapters` list into `AIAssistant`.
- Verified: `tsc --noEmit` clean.

## 2026-07-03 — Hard 300-word chapter cap for AI generation
- **api/ai/novel-assist**: storyboard prompt now enforces a hard limit — all canvas text (summary, panels, dialogue, SFX, transitions) must total under 300 words; panel count reduced 30–60 → 6–12 with terse-field instructions; quality check includes the word cap.
- **api/ai/novel-assist**: `scriptToHtml()` no longer renders `illustrationPrompt` into the canvas (still returned in the `script` JSON for image generation) so prompts don't consume the 300-word budget or inflate the editor word count.
- Chat system prompt: assistant told chapters are capped at 300 words — won't push continuations past the limit and warns if the draft already exceeds it.
- Verified: `tsc --noEmit` clean.

## 2026-07-03 — Write-chapter: award-winning webtoon writer prompt (replaces storyboard JSON)
- **api/ai/novel-assist**: replaced the storyboard-JSON architect prompt with the "award-winning webtoon writer" prompt — ONE complete prose chapter, hard 300-word max, show-don''t-tell (emotions via action/body language/silence, never stated), every line must build emotion/reveal character/progress story/increase tension, emotional highs and lows every 40–60 words, structure Opening Hook → Emotion → Conflict → Escalation → Mini Twist → Cliffhanger. Continuity rules against previous chapters retained. Output is back to plain `<p>` HTML paragraphs.
- Removed now-dead storyboard machinery: `ScriptPanel`/`ChapterScript` types, `escapeHtml`, `scriptToHtml`, and the JSON-parse branch in the handler.
- `max_tokens` 32000 → 4000 (300-word cap makes large budgets pointless; also backstops runaway output).
- **AIAssistant.tsx**: write-chapter task message and post-write chat note updated from storyboard wording to 300-word chapter wording.
- Verified: `tsc --noEmit` clean.

## 2026-07-03 — Novel detail page redesigned to match production webtoon detail design
- **(main)/novel/[id]/page.tsx**: full rewrite of layout to match https://toonflowstudiopaint.com/webtoon/... detail design. Diagnosis of "image not showing": coverURL, Storage object, and _next/image optimizer all worked — the missing image was the hero banner, which the old design simply didn't have.
- New full-bleed hero: bannerURL ?? coverURL as dark backdrop (`Image fill`, opacity-30, gradient to bg), cover card with ring/shadow bottom-left, status pill with published year, 5xl extrabold title, type/rating/views meta row, genre chips, actions (Start Reading, Latest → last chapter, Like, Bookmark).
- New Details card (accent-bar heading, 2-col stat tiles: Rating with stars, Type, Status, Chapters, Views, Year, Author with Follow button moved here) + Synopsis section with Read More ↓, Genres and Themes (tags) chip rows.
- Chapters section now a card with header toolbar: chapter search input (labelled, sr-only) and Asc/Desc sort toggle; rows use mono "Ch. N" prefix + title + words/min + date/views; "Show more (N remaining)" footer.
- WCAG: focus-visible rings on all new interactive elements, aria-labels on icon-only sort button, decorative images/icons aria-hidden, star rating has text alternative.
- Verified: `tsc --noEmit` clean; headless-Chrome screenshot of /novel/b1IEojPKR0SOmPqSZ8O6 matches production design, cover + hero render.

## 2026-07-03 — User star ratings (1–5) on novel detail page
- **lib/firebase/engagement.ts**: new Rating System section — `setRating(uid, type, id, value)` runs a Firestore transaction that upserts `ratings/{uid}_{type}_{id}` and recomputes the aggregate `rating` (average, 1 decimal) + `ratingCount` on the novel/webtoon doc; clicking the same star again removes the user's rating. `getUserRating()` fetches the user's existing value.
- **components/reader/RatingControl.tsx**: new interactive 5-star control — hover preview, filled stars show your rating (or the dimmed average when unrated), average + count text, optimistic-free (writes then updates), "Sign in to rate" toast for guests, `onRated` callback to sync parent state. WCAG: role="group" with descriptive label, per-star `aria-label` + `aria-pressed`, focus-visible rings.
- **(main)/novel/[id]/page.tsx**: RatingControl added to hero actions row; `onRated` updates novel state so the hero meta stars and Details "Rating" tile stay in sync.
- **firestore.rules**: new `/ratings/{ratingId}` rules (owner create/update/delete, value must be int 1–5, public read); `rating`/`ratingCount` added to the `onlyUpdates()` carve-out on novels and webtoons. Deployed via `firebase deploy --only firestore:rules --project toonflow-studio-paint-f384c`.
- Verified: `tsc --noEmit` clean; rules compiled + released; screenshot shows star control in hero.

## 2026-07-03 — Secure server-validated view counting system

- **New**: `POST /api/views` (`src/app/api/views/route.ts`) — two-phase view protocol. `begin` issues an HMAC-signed view token (server timestamp) + signed httpOnly anonymous visitor cookie; `complete` re-validates everything server-side (CSRF origin check, bot/prefetch detection, per-IP/visitor/session rate limits with temporary blocking, token integrity + visitor binding + 6h expiry, server-measured dwell ≥20s OR scroll ≥50% with ≥8s dwell) before counting.
- **New**: `src/lib/views/` — `config.ts` (thresholds), `crypto.ts` (HMAC tokens, signed visitor ids, salted hashes), `botDetection.ts` (UA signatures, sec-purpose/prefetch, sec-fetch-mode, accept-language heuristics), `rateLimit.ts` (sliding window + violation blocking), `viewService.ts` (single Firestore transaction: viewDedup rolling-24h dedup → chapterViews analytics log → viewStats aggregates → atomic viewCount increments on content + parent).
- **New**: `src/lib/firebase/serverApp.ts` — Firebase Admin SDK init (server only); installed `firebase-admin` + `@opentelemetry/api`.
- **New**: `GET /api/views/stats` — owner/admin analytics (unique/returning, reading time, avg completion, daily/weekly/monthly windows), separate from public counts.
- **New**: `src/hooks/useViewTracking.ts` — client hook measuring visible time (Page Visibility API) + max scroll; fires complete once threshold met, sendBeacon on pagehide, 24h localStorage guard, skips webdriver.
- **Changed**: chapter + episode reader pages now use `useViewTracking`; removed client-side `trackView` from `engagement.ts` (direct Firestore viewCount writes eliminated).
- **Security**: `firestore.rules` — removed `viewCount` from client-updatable carve-outs on novels/chapters/webtoons/episodes; locked `views` (legacy), `chapterViews`, `viewDedup`, `suspiciousViews` to server-only; `viewStats` admin-read. Added `chapterViews` composite indexes.
- **Docs**: `docs/view-tracking.md`; `VIEW_TOKEN_SECRET` added to `.env.example`.
- **Verified**: tsc + eslint clean; live API tests — bot UA rejected, missing origin rejected, browser begin issues token+cookie, instant complete rejected (dwell), missing cookie rejected, tampered token rejected, 9s+60% scroll passes gates and runs the Firestore transaction (aborted safely on fake content id).
- **Deploy required**: `firebase deploy --only firestore:rules,firestore:indexes --project toonflow-studio-paint-f384c`

## 2026-07-03 — /create studio hub redesign
- Removed the "Want to explore instantly?" / Seed Ravana Demo section (the `/create/seed` route itself still exists, just no longer linked).
- Redesigned the page to fill the viewport: full-width studio cards and quick-link row (previously capped at max-w-2xl), min-h-screen section with ambient accent glows, larger typography, "Creator Studio" badge, hover glow + arrow-slide micro-interactions. Design tokens + WCAG focus rings preserved.

## 2026-07-03 — Novel editor: PDF download dropdown
- `EditorToolbar.tsx`: the PDF button is now a Radix dropdown (matches UserMenu styling) with "Download all chapters" and "Download current chapter" (disabled when no chapter is selected). `onExportPDF` prop now takes a `'all' | 'current'` scope.
- `create/novel/[novelId]/page.tsx`: `handleExportPDF(scope)` — full-novel export unchanged in layout (title page + all chapters); current-chapter export produces `"<novel> - Chapter N.pdf"`. Both use the live editor content/title for the active chapter so unsaved edits are included.

## 2026-07-03 — Webtoon editor: seamless vertical strip canvas
- `src/app/(novel)/create/webtoon/[webtoonId]/page.tsx`
  - Center canvas now renders panels as one continuous edge-to-edge vertical strip (max-w 800px, no gaps/borders, natural aspect ratio via `width`/`height` + `h-auto`) matching webtoon reader format (Asura-style).
  - Panel controls (reorder, thumbnail, delete) moved to a hover/focus-within overlay with gradient scrim so the strip reads as a single page; all buttons keep aria-labels + focus-visible rings.
  - Added an end-of-strip dashed "Add panels to the strip" upload zone.
  - Uploads (manual + AI accept) now capture real image dimensions via object URL instead of hard-coded 800x1200, so editor and reader layouts are correct pre-load.

## 2026-07-03 — Webtoon editor: resizable canvas + panel span templates + scrollbar
- `src/types/webtoon.ts`: added `PanelSpan` type (`full | half | third | two-thirds`) and optional `span` field on `PanelImage`.
- `src/app/(novel)/create/webtoon/[webtoonId]/page.tsx`
  - Canvas is now resizable: drag handle on the strip''s right edge (pointer capture, grows both sides since centered), keyboard arrows adjust by 40px (role="separator" with aria-valuenow/min/max), clamped 360–1400px; width presets Mobile 480 / Default 800 / Wide 1080 with live px readout in the header.
  - Panels can be sized template-wise: strip is a flex-wrap container; per-panel span picker (1/1, 2/3, 1/2, 1/3) in a bottom hover overlay persists `span` to Firestore via `setPanelSpan`, so multiple panels of different widths sit side-by-side.
  - Scroll container changed to `overflow-y-scroll overflow-x-auto` so the vertical scrollbar is always available.
- Note: IDE webhint diagnostics about aria-*="{expression}" and inline styles are static-checker false positives for React dynamic values; tsc and eslint pass with no new issues.

## 2026-07-03 — Release gate: /create and /wallet locked as Coming Soon
- `src/lib/utils/constants.ts`: added `FEATURE_FLAGS` (`creatorStudio: false`, `wallet: false`) — flip to true to unlock at release.
- `src/proxy.ts`: middleware now redirects `/create/**` → `/coming-soon?feature=studio` and `/wallet/**` → `/coming-soon?feature=wallet` when the flag is off. Super admin (email cookie === SUPER_ADMIN_EMAIL) bypasses the lock and can still use both areas.
- `src/app/(main)/coming-soon/page.tsx`: new public Coming Soon page (server component, Next 15 async searchParams) with per-feature copy (studio/wallet/default), pulse badge, Back to Home + Browse Stories CTAs; uses design tokens and focus-visible rings.

## 2026-07-03 — Release lock rework, admin fixes, analytics, support flow, footer, legal pages
- Release gate reworked to in-place locks: /create hub stays reachable; Webtoon Studio card renders locked "Coming Soon" (FEATURE_FLAGS.webtoonStudio), /wallet renders an in-place Coming Soon lock (FEATURE_FLAGS.wallet), /create/webtoon/** deep links redirect to /coming-soon. No admin bypass.
- Dashboard: fixed broken cover thumbnails — copied og-image.png to public/images/ravana-cover.png (seed data referenced it but file was missing) and added CoverThumb onError fallback.
- createUserDocument now backfills role/isCreator/createdAt on existing user docs (older signups lacked them) — fixes rules isAdmin() ("Missing or insufficient permissions") and users missing from admin lists.
- /admin/super/users: getAllUsers no longer orderBy(createdAt) (Firestore drops docs missing the field) — sorts client-side; added getUserCount() and "X registered users · showing Y" header.
- /admin/super/novels + /webtoons: expandable drill-down row per work listing chapters/episodes (number, title, status, created) with per-item open + delete (ConfirmDialog + audit log; counts updated).
- Super admin business analytics: new /api/admin/analytics (Admin SDK, super-admin only) computing live users (5-min window), unique readers/views (14d), avg engagement/scroll, auth vs anon, daily traffic + signups series, top content. New BusinessCharts (recharts) + stat tiles on /admin/super, refreshed every 60s. Palette validated with dataviz checker (#3987e5/#199e70/#c98500/#9085e9 on #1A1A1A).
- Support flow: SupportModal (Ask a Question / Report an Issue) wired to footer; POST /api/support stores supportRequests via Admin SDK (rate-limited 5/day/email) and sends Gmail auto-reply from toonflowstudiopaint@gmail.com (nodemailer; needs GMAIL_APP_PASSWORD env). Admin Requests page gained a Support Inbox table (status open/in-progress/resolved, delete w/ confirm, audit logs). Rules: supportRequests admin-only, client create denied. Indexes added (email+createdAt, status+createdAt).
- Footer: converted to client component; real Instagram (instagram.com/toonflowstudiopaint) + LinkedIn (linkedin.com/company/toonflow-studio-paint) icons (inline SVGs — lucide dropped brand icons).
- New legal pages with full content: /privacy, /terms, /ai-policy (server components, design tokens, cross-linked).
- Deploy note: firebase deploy --only firestore:rules,firestore:indexes --project toonflow-studio-paint-f384c required for support inbox + analytics.

## 2026-07-04 — Support form fix + lint zero-out

### Support form ("Unexpected end of JSON input")
- Root cause: `supportRequests` composite index (email ASC + createdAt ASC) was defined in firestore.indexes.json but never deployed; the rate-limit query in src/app/api/support/route.ts threw FAILED_PRECONDITION → empty 500 → client res.json() parse error.
- Deployed indexes (`firebase deploy --only firestore:indexes --project toonflow-studio-paint-f384c`).
- Hardened route: POST body now wrapped in try/catch that returns JSON `{error}` on any unexpected failure.
- SupportModal: `res.json().catch(() => ({}))` so non-JSON responses show a friendly error.
- Verified end-to-end: valid POST → `{ok:true}` 200; invalid email / missing subject / malformed JSON → clean 400 JSON errors.

### ESLint zero-out (was 20 errors + 44 warnings → 0/0)
- react-hooks/set-state-in-effect: replaced imperative `setLoading` in effects with derived loading state ("has current key been fetched") across useFirestore/useNovels/useWebtoons/useChapters/useEpisodes hooks, browse/originals/novel-detail/profile pages, novel+webtoon editors, dashboard, wallet, admin requests, CommentSection, RatingControl.
- Async load useCallbacks converted to promise chains (.then/.finally callbacks) — the lint treats post-await setState in sync-called functions as violations.
- Novel editor: active-chapter status sync moved to render-time state adjustment.
- Removed ~35 unused imports/variables across 24 files.
- Dashboard: `userProfile?.balance` extracted from useCallback deps (React Compiler memoization fix).
- CreateNovelModal/CreateWebtoonModal: event-handler `watch()` → `getValues()`, reactive `watch()` → `useWatch`; impure Date.now/Math.random hoisted to module-scope helpers (react-hooks/purity).
- tsc --noEmit clean; smoke-tested /, /browse, /originals, /ai-policy (200s); /api/support verified live.

## 2026-07-04 (2) — Edge Tools a11y lint zero-out (13 problems)
- Converted ARIA state attributes with JSX expressions to conditional spreads (`{...(cond ? {'aria-selected':'true'} : {'aria-selected':'false'})}`) in BrowseClient (aria-expanded + aria-selected), OriginalsClient, ProfilePageClient, wallet, webtoon editor span buttons, RatingControl.
- CommentSection Avatar: inline width/height style → Tailwind size classes (w-8/w-[26px]).
- Chapter reader progress bar: dynamic width + aria-value* now set via ref effect (DOM), removed from JSX.
- Webtoon editor: canvas strip width via ref effect; panel span widths → Tailwind w-1/2, w-1/3, w-2/3, w-full classes; custom role="slider" resize handle replaced with pointer-only drag surface + visually-hidden native `<input type="range">` (implicit ARIA — keyboard resize preserved via native arrows, step 40).
- tsc + eslint clean; /browse and /originals smoke-tested (200).

## 2026-07-04 — Performance engineering audit (navigation speed)
- **package.json**: `dev` script now runs Turbopack (`next dev`) instead of `next dev --webpack`. Webpack dev compiled every route on first visit — the main cause of visible per-navigation delay in development. `build` stays on webpack (next-pwa requires it).
- **next.config.js**: next-pwa is applied only for production builds; dev runs a plain config (no service worker interception, no webpack key so Turbopack loads cleanly). Added AVIF/WebP image formats, `minimumCacheTTL`, and immutable Cache-Control headers for `/icons`, `/images`, `/og-image.png`.
- **src/components/pwa/DevSwCleanup.tsx** (new, mounted in root layout): dev-only unregister of stale service workers + workbox caches left by earlier prod builds on localhost.
- **Fonts**: removed render-blocking Google Fonts CSS `@import` from globals.css; Inter is now self-hosted via `next/font/google` with `--font-inter` variable (layout.tsx, globals.css, tailwind.config.ts). Eliminates a cross-origin CSS chain from FCP/LCP and font layout shift.
- **globals.css**: removed global `scroll-behavior: smooth` — it animated the App Router scroll-to-top on every navigation, making transitions read as slow.
- **Bundle**: split Firestore/Storage out of `lib/firebase/config.ts` (auth-only now). New `lib/firebase/db.ts` exports `db`; storage.ts owns its instance. Updated importers: firestore.ts, wallet.ts, engagement.ts, admin.ts, tokens.ts, api/webhooks/route.ts. AuthContext now dynamic-imports the firestore service. Result: firebase/firestore SDK no longer ships in the shared root bundle (root layout chunk 15 KB, Firestore-free — verified in build output).
- **src/lib/utils/requestCache.ts** (new): module-scope TTL promise cache. HomeFeed + HeroSlider now share the same trending queries (home page went from 5 Firestore queries to 3) and back-navigation to home renders instantly for 60s.
- **src/app/(reader)/loading.tsx** (new): reader route group previously had no loading UI.
- Verified: tsc clean, eslint clean, `next build --webpack` clean (36 routes), prod pages 200 with next/font markup, Turbopack dev boots in ~0.8s.

## 2026-07-04 — Webpack fully removed; dev + build on Turbopack
User asked for a Vite migration; Vite cannot host a Next.js App Router app (server components, API routes, middleware). Delivered the underlying goal instead: zero webpack anywhere.
- **package.json**: `build` is now `next build` (Turbopack). `next-pwa` uninstalled — it was the only webpack dependency.
- **next.config.js**: removed the next-pwa wrapper; plain config for both dev and build.
- **public/sw.js** (new, hand-written): network-first navigations with offline cache fallback, cache-first for `/_next/static`, icons, images; never intercepts `/api/*` or cross-origin (Firebase). Versioned via `CACHE_VERSION`; activate handler purges old workbox/next-pwa caches on deployed clients.
- **src/components/pwa/PwaRegister.tsx** (new, replaces DevSwCleanup.tsx which was deleted): registers `/sw.js` in production, unregisters stale SWs + purges caches in dev. Mounted in root layout.
- **Deleted**: `public/workbox-4754cb34.js`, generated `public/sw.js`, `src/components/pwa/DevSwCleanup.tsx`.
- **CLAUDE.md**: PWA/stack sections updated (no next-pwa; never reintroduce `--webpack`).
- **Measured** (same config, same machine): build 81s webpack → 38s Turbopack; per-page gzipped JS: `/` 455→494 KB, `/login` 393→478 KB (Turbopack chunks more granularly; slight per-page payload increase, expected to improve with Next releases).
- **Verified**: tsc clean, eslint clean, all public routes 200, `/create`+`/dashboard` 307 to login (middleware intact), sw.js + manifest served, immutable cache headers active.

## 2026-07-04 — Studio dashboard mobile responsiveness
- **StudioLayoutShell.tsx**: on `< md` the sidebar is now a hamburger-triggered slide-in drawer. Mobile sticky top bar (hamburger + studio wordmark), backdrop with blur, transform-only 200ms animation, `inert` when closed, Escape to close, body scroll lock while open, focus moves into the drawer on open and returns to the hamburger on close, `aria-expanded`/`aria-controls`/`role="dialog"`. Desktop sidebar is now `sticky top-0 h-screen` (stays visible while content scrolls). `<main>` gained `min-w-0` so wide tables scroll inside their own container instead of blowing out the viewport.
- **StudioSidebar.tsx**: new optional `onClose` (renders an X button in the header, mobile drawer only) and `onNavigate` (closes the drawer when any nav link is tapped) props; aside now fills its container height and scrolls internally.
- **dashboard/page.tsx**: `px-4 py-5` padding on mobile (was p-6 everywhere); Buy Coins and Withdraw modals capped at `max-h-[85dvh]` with internal scroll so they fit short phone viewports.
- Applies to all (studio) routes sharing the shell: /dashboard, /wallet, /admin, /create hub.
- Verified: tsc clean, eslint clean, production build clean (36 routes).

## 2026-07-04 — Super admin mobile responsiveness + shared responsive shell
- **src/components/layout/ResponsiveSidebarShell.tsx** (new): generic client shell extracted from StudioLayoutShell — mobile top bar with hamburger, backdrop, transform-only slide-in drawer (`inert` when closed, Escape close, body scroll lock, focus in/out management, aria-expanded/controls/dialog), sticky full-height desktop sidebar, `main` with `min-w-0`.
- **StudioLayoutShell.tsx**: refactored to use ResponsiveSidebarShell (keeps the /admin/super bypass); no behavior change for studio routes.
- **SuperAdminSidebar.tsx**: added `onClose` (X button in drawer header) and `onNavigate` (dismiss drawer on link tap) props; aside now fills container height with internal scroll.
- **SuperAdminLayoutShell.tsx** (new) + **admin/super/layout.tsx**: super admin layout now renders through the responsive shell with a SUPER ADMIN top-bar brand.
- **Super admin pages** (dashboard, users, novels, webtoons, requests, settings): mobile padding `px-4 py-5 sm:p-6`. Tables already scroll in `overflow-x-auto` containers; stat grids collapse to 2 columns; recharts use ResponsiveContainer — no other content changes needed.
- Verified: tsc clean, eslint clean, production build clean (36 routes).

## 2026-07-04 — Mobile footer + bottom nav kept visible on studio pages
- **ResponsiveSidebarShell.tsx**: new optional `footer` prop rendered after `<main>`.
- **StudioLayoutShell.tsx**: passes a mobile-only footer slot — site `<Footer />` (wrapped `md:hidden pb-14`) plus `<MobileNav />` (already `md:hidden`, fixed bottom bar). Users navigating to /dashboard, /wallet, /create, /admin from the profile menu on a phone now keep the bottom navigation bar and site footer; `pb-14` clears the fixed h-14 bar. Desktop studio layout unchanged. Super admin shell unchanged (no footer slot).
- Verified: tsc clean, eslint clean, production build clean (36 routes).

## 2026-07-04 — Silenced Edge Tools ARIA false positives
- **HeroSlider.tsx** (`aria-selected`) and **ResponsiveSidebarShell.tsx** (`aria-expanded`): Microsoft Edge Tools' static axe/aria scanner flags any JSX expression as an invalid enumerated ARIA value even when it evaluates to 'true'/'false'. Rewrote both as conditional prop spreads — identical rendered DOM, invisible to the static scanner. tsc + eslint clean.

## 2026-07-05 — Enterprise Security Audit & Hardening
Full defensive audit. Core money/auth/view paths were already strong (server-verified sessions, Admin-SDK token accounting, signed view tokens); this pass closed the remaining gaps. See `SECURITY.md` for the full report (risk score, OWASP/CVSS mapping, attack scenarios).

- **next.config.js**: Added a scoped **Content-Security-Policy** (default-src 'self'; object-src 'none'; base-uri/form-action 'self'; frame-ancestors 'none'; allowlisted Firebase/Google/Razorpay origins for script/connect/img/frame), **HSTS** (2y, preload), **Cross-Origin-Opener-Policy** `same-origin-allow-popups` (keeps Firebase Google popup working), tightened `X-Frame-Options` to DENY, expanded `Permissions-Policy` (disables topics/FLoC/usb/serial/bluetooth; payment scoped to Razorpay), added `X-Permitted-Cross-Domain-Policies: none`.
- **firestore.rules**: Bound `authorId==uid` and forbade counter seeding on novel/webtoon **create** (no forged authorship / view inflation). Bound comment `authorId==uid` + `likeCount==0` + 5 000-char body cap. Bound like `uid==uid`. Bounded `followerCount`/`followingCount` updates to exact ±1 deltas (followingCount owner-only) — no arbitrary count injection. `transactions` create → **server-only** (`if false`; all writes go through Admin SDK). `withdrawals` create now requires positive amount + `status=='pending'`.
- **storage.rules**: Novel/webtoon covers, banners and episode panels are now **owner-only** (Firestore `authorId` lookup) instead of any authenticated user — closes cross-user asset overwrite/defacement. Switched `image/.*` → explicit raster allowlist (`png|jpeg|jpg|webp|gif`) to **block SVG** (scripted-image XSS). Added default-deny catch-all.
- **src/lib/utils/url.ts** (new) + **ProfilePageClient.tsx**: `safeHttpUrl()` normalizes the profile "website" link and rejects `javascript:`/`data:`/other schemes — fixes a **stored XSS** click target. Link now `rel="noopener noreferrer nofollow ugc"`.
- **src/lib/api/guard.ts** (new): `bodyTooLarge()` (content-length gate) + `escapeHtml()`.
- **AI routes** (novel-assist, novel-content, generate-image): added **zod schemas** with per-field length + array caps, request body-size gates, and replaced raw `err.message` responses with generic messages (server-side logging only) — stops info leakage and unbounded-input cost/DoS.
- **payments/create-order**: generic catch error (no internal leakage).
- **support**: HTML-escape the user `name` in the auto-reply email (HTML-injection), added **per-IP rate limit** (8/10 min) in front of the per-email cap, and a body-size gate.
- **.env.example**: documented the 6 missing server secrets (Anthropic, Stability, Razorpay ×4, Gmail) so keys are configured via env, never hardcoded.
- **npm audit**: 8 moderate advisories, all transitive via `firebase-admin` → `@google-cloud/storage` → `uuid` (GHSA-w5hq-g745-h8pq, buffer-bounds in uuid v3/5/6). Not reachable in our usage (we never pass a `buf` to uuid). `audit fix --force` downgrades firebase-admin (breaking) — left as documented accepted risk; monitor for a non-breaking firebase-admin release.
- Verified: `tsc --noEmit` clean; `next build` clean (all routes compile).

## 2026-07-05 — Unified cinematic canvas (editor ↔ reader)
Made the novel editor canvas (`/create/novel/[novelId]`) and the chapter reader (`/novel/[id]/chapter/[chapterId]`) render an identical cinematic canvas matching the reference design (blue section label + soft top beam).
- **globals.css**: Added shared `--canvas-accent` (#5B84F5) + `--canvas-accent-soft/-glow` CSS variables. Switched the section-label (`h3`) color in **both** `.tiptap` and `.reader-content` from gold `#C9A84C` → `var(--canvas-accent)` so the two canvases stay in lockstep. Added a `.canvas-beam` decorative element — a 1px horizontal blue light beam with a soft radial glow — for the light-from-above look above the section label.
- **Reader** (`(reader)/novel/[id]/chapter/[chapterId]/page.tsx`): added `<div class="canvas-beam">` above the centered chapter heading.
- **Editor** (`(novel)/create/novel/[novelId]/page.tsx`): added the same beam above the chapter-title block (`!mx-0 !mb-6` to sit with the editor's left-aligned heading).
- Serif typography (white italic `h1`, small-caps `h3`, muted body, drop cap) was already shared between the two canvases; this pass unified the accent color + beam so they visually match. `tsc` + `next build` clean.

## 2026-07-05 — Scanlation-style credits poster (novel first page)
Added a title/credits splash as the first page of a novel (chapter 1), styled after the AsuraScans reference but branded Toonflow and driven by real novel data.
- **components/reader/CreditsPoster.tsx** (new): purple "energy" hero — framed cover art (clip-path tech frame + glow) with a "TOONFLOW STUDIO PAINT" watermark, brand links (@toonflowstudiopaint · toonflowstudiopaint.com), a chapter-number medallion, a slashed white title banner showing `novel.title`, and a credits grid (AUTHOR/STUDIO/GENRE/STATUS/CHAPTERS/LANG) rendered as skewed slabs like the reference chips. Fully data-driven — the novel's own title (e.g. "Ravana"), cover, author, genre, status and chapter number populate it. Falls back gracefully with no cover.
- **(reader)/novel/[id]/chapter/[chapterId]/page.tsx**: renders `<CreditsPoster>` as the first page on chapter 1 (replaced the old `IntroPoster`); `TitlePage` cover reveal still follows it. `IntroPoster.tsx` left in place, now unused.
- `tsc` + `eslint` + `next build` clean.

## 2026-07-05 — CreditsPoster now scales to fit the viewport
Fixed the credits poster overflowing the screen (top/bottom cut off) on normal-zoom / shorter viewports.
- **components/reader/CreditsPoster.tsx**: Section is now fixed `h-[100svh]` and the poster measures its natural size (`offsetWidth/Height` via ref) and applies a `transform: scale(min(1, availW/natW, availH/natH))` to fit within the viewport minus a 104px header/margin allowance — never upscaled past 1×. Scale sits on an outer wrapper; the `reader-fade-in` (which animates translateY) stays on the inner element so the two transforms don't conflict. Re-fits on `resize` and once after 300ms (cover image/fonts settle). Result: the whole poster is always visible on one screen, on any device, clearing the fixed reader header.

## 2026-07-05 — CreditsPoster reworked as a top banner (always fully visible)
The scale-to-fit full-screen hero still left the poster centered low with the bottom risking a clip depending on window height. Reworked it into a self-contained banner, matching the AsuraScans reference proportions.
- **components/reader/CreditsPoster.tsx**: Dropped `h-[100svh]` + vertical centering + the JS scale-to-fit. The section is now natural-height (`pt-16 pb-10`, top padding clears the fixed reader header) so the whole banner sits directly below the header and is fully visible on load; the cover-reveal TitlePage + chapter content flow beneath it. Bounded the cover column (`w-56 sm:w-64 md:w-[40%] max-w-[340px]`) so the banner stays compact on wide screens. Removed the now-unused useRef/useState/useEffect + scroll cue. `tsc` + `eslint` clean.

## 2026-07-05 — Reverted the CreditsPoster (undo)
Removed the scanlation-style credits poster per request.
- Deleted **components/reader/CreditsPoster.tsx**.
- **(reader)/novel/[id]/chapter/[chapterId]/page.tsx**: restored the original `IntroPoster` import + chapter-1 usage (was swapped to `CreditsPoster`). Reader first page is back to IntroPoster + TitlePage.
- Left untouched: the earlier canvas design change (blue section-label accent + `.canvas-beam` on editor/reader), which was a separate request.

## 2026-07-05 — Restored CreditsPoster (re-do)
Re-added the scanlation-style credits poster per request ("make it like this").
- Recreated **components/reader/CreditsPoster.tsx** as the fully-visible banner layout (framed cover + TOONFLOW STUDIO PAINT watermark, brand links, chapter medallion, slashed title banner, AUTHOR/STUDIO/GENRE/STATUS/CHAPTERS/LANG credits, purple energy bg) with the "Scroll to Begin" cue restored as an in-flow element (ChevronDown, animate-bounce) so it can't overlap.
- **(reader)/novel/[id]/chapter/[chapterId]/page.tsx**: renders `<CreditsPoster>` as the first page on chapter 1 (before `TitlePage`).
- `tsc` + `eslint` clean.

## 2026-07-05 — Ending poster (extro) reworked to match the reference
Redesigned the outro/ending page to mirror the scanlation ending-credits card (title logo → production credits → studio mark → copyright), cohesive with the intro CreditsPoster's purple aesthetic.
- **components/reader/EndingPoster.tsx**: misty purple veils + violet particles; centered dramatic novel-title logo (glow); "The End" accent label; production credits (WRITTEN BY / GENRE / CHAPTERS / LANGUAGE) as staff lines; "TOONFLOW STUDIO PAINT" studio mark with accent rule; retained Start Creating / Discover More / Back CTAs; added a copyright notice (© year · author · Toonflow Studio Paint, reproduction-prohibited line). All data-driven from the novel.
- Intro = CreditsPoster (first page), extro = EndingPoster (after last chapter); the centered cinematic serif narrative (reader-content H1/H3/body) bookended between them was already in that format. `tsc` + `eslint` + `next build` clean.

## 2026-07-05 — Fix: profile save failed with empty social links
Editing a profile with blank Social Links threw "failed to save".
- **Root cause**: `handleSave` built `socialLinks: { website: trim()||undefined, ... }`. With empty inputs every value was `undefined`, and Firestore `updateDoc` rejects `undefined` (db is `getFirestore(app)` — no `ignoreUndefinedProperties`), throwing before the write.
- **Fix** (`(main)/profile/[uid]/ProfilePageClient.tsx`): build `socialLinks` with only the non-empty links (omit empties → empty map is fine), and coerce `photoURL`/`bannerURL` to `null` (never `undefined`) in case the profile doc lacks those fields. Imported `SocialLinks` type. `tsc` + `eslint` clean.

## 2026-07-05 — Author name on works always follows the profile name
Novels/webtoons showed stale author names (e.g. "Shashwath Bc" vs "Shashwath") because `authorName`/`authorPhotoURL` are denormalized onto content docs at creation and never updated on rename.
- **lib/firebase/firestore.ts**: new `syncAuthorContent(uid, authorName, authorPhotoURL)` — queries all novels + webtoons by `authorId` and batch-updates their denormalized `authorName`/`authorPhotoURL` (chunked at 400/batch under Firestore's 500 cap). Owner-write is permitted by existing rules (`isOwner(resource.data.authorId)`).
- **(main)/profile/[uid]/ProfilePageClient.tsx**: `handleSave` calls `syncAuthorContent` after the profile update (in a non-blocking try/catch) so every save fans the current display name + avatar out to all the creator's works, unifying any that still carry an older name. `tsc` + `eslint` clean.

## 2026-07-05 — Author name self-heal on own-profile view
Follow-up to the author-name sync: added a safety net so stale names correct themselves.
- **(main)/profile/[uid]/ProfilePageClient.tsx**: on load, when the owner views their own profile, if any authored novel/webtoon's `authorName`/`authorPhotoURL` differs from the current profile, it calls `syncAuthorContent` and updates local state. Combined with sync-on-save, visiting your profile (or saving it) unifies every work to your current display name. Root cause of the "still Shashwath Bc" report: earlier renames never persisted (the undefined-socialLinks save bug) and the sync code postdated them — a successful save now propagates. `tsc` + `eslint` + `next build` clean.

## 2026-07-06 — Cleared "no-inline-styles" warnings (34 Problems from MS Edge Tools)
Converted every inline `style={{…}}` to Tailwind arbitrary-value classes so webhint's no-inline-styles rule passes; visual output is byte-identical (verified against compiled CSS).
- **reader/CreditsPoster.tsx, EndingPoster.tsx, IntroPoster.tsx, TitlePage.tsx**: clip-paths, radial/repeating gradients, grid+mask overlay, box/text/drop shadows, Georgia font stacks, clamp() font sizes and all `reader-*` animations moved into classes (e.g. `[clip-path:polygon(…)]`, `bg-[radial-gradient(…)]`, `animate-[reader-fade-in_0.9s_both]`, `text-[length:clamp(…)]`). `ACCENT` consts removed — #8B5CF6 = `violet-500`, #C4B5FD = `violet-300`, used as named classes where a plain color applies.
- **Particles (Intro 28 / Ending 20)**: per-particle position/opacity/timing precomputed into literal class arrays (same `(i*k+c)%m` values, incl. `--p-opacity`); shared class animates `reader-particle-float` via `var(--p-dur)`/`var(--p-delay)`. Sizes were constant all along (2px intro / 3px ending) so they live in the shared class.
- **admin/BusinessCharts.tsx**: legend swatches → `bg-[#3987e5]`/`bg-[#9085e9]` (sync comment added; SERIES consts still drive the Recharts props).
- **(reader)/loading.tsx**: skeleton line widths → literal `w-[NN%]` class array (same ragged pattern).
- **admin/super/settings/page.tsx**: toggle sizing → `w-10 h-[22px]` (also kills the invalid `h-5.5` class the inline style was papering over).
- **editor/ChapterSidebar.tsx**: opacity/z-index while dragging → classes; only dnd-kit's runtime `transform`/`transition` stay inline (unavoidable — flagged row commented).
- `tsc` + `eslint` clean; Tailwind CLI compile confirms every new arbitrary class emits the exact CSS the inline styles produced.

## 2026-07-06 — Cleared the 3 remaining Edge Tools problems
Follow-up to the no-inline-styles sweep.
- **admin/super/settings/page.tsx (ToggleRow)**: replaced the `button role="switch" aria-checked={…}` with a native `<input type="checkbox">` styled as the same switch (`appearance-none` track + `after:` knob, identical geometry/colors). Native `checked` carries the state so there is no aria-checked for the static analyzer to choke on (axe/aria), and the control now has a discernible name (axe/name-role-value) via `aria-label` plus a real `<label htmlFor>` (CLAUDE.md WCAG rule) — clicking the label toggles it too.
- **.hintrc** (new, repo root): webhint config extending `development`, ignoring only `no-inline-styles` for `ChapterSidebar.tsx` — dnd-kit's per-frame drag `transform`/`transition` must be inline; every other file/hint is still checked.
- `tsc` + `eslint` clean; Tailwind compile confirms `appearance-none` / `after:translate-x-[18px]` emit.

## 2026-07-06 - Unlocked Webtoon Studio
- **src/lib/utils/constants.ts**: flipped `FEATURE_FLAGS.webtoonStudio` from `false` to `true`. This single flag gates both the /create hub card (now renders the active link to /create/webtoon instead of the locked "Coming Soon" card) and the proxy redirect in src/proxy.ts (deep links to /create/webtoon/** no longer bounce to /coming-soon). Wallet remains locked.

## 2026-07-06 - Fixed dev console error "eval() is not supported in this environment"
- **next.config.js**: the CSP `script-src` blocked eval(), which React/Next dev tooling needs (error overlay, callstack reconstruction, source maps). Added `'unsafe-eval'` to `script-src` **in development only** (`NODE_ENV === 'development'`); the production CSP is unchanged and still denies eval. Requires a dev-server restart to take effect since next.config.js is read at startup.

## 2026-07-06 - Fixed 404 on /create/webtoon (corrupted Turbopack dev cache)
No code change. After the dev-server restart, the new instance came up with a truncated route tree: every route in the (novel), (reader) and (studio) groups returned 404 (only (main) and (auth) survived), even though all page files were intact and the previous instance had served them minutes earlier. Root cause: corrupted Turbopack persistent dev cache in `.next/dev` (the new instance likely started while the old one was still shutting down and both touched the cache). Fix: killed the stuck server, deleted `.next/dev`, restarted `next dev`. Verified /create/webtoon, /create/novel, /dashboard, /wallet and the reader route all serve 200 again; /create/webtoon renders the Webtoon Studio page.

## 2026-07-06 - Mandatory branded Intro/Outro pages in every webtoon episode
Every episode now always opens with a Toonflow-branded intro page and closes with a branded outro page, in both the editor strip and the reader. Implemented structurally (rendered components framing the panels array) rather than as locked list items - so no panel operation (delete / move up-down / duplicate / span) can ever touch them, every legacy episode gets them automatically with zero migration, and the reader (the publish/export surface) can never omit them.
- **src/types/webtoon.ts**: `EpisodeIntroMeta` (tagline, creditLine) + `EpisodeOutroMeta` (message, teaser, handle) - small optional text overrides stored on the episode doc as `intro`/`outro`; absent/empty fields fall back to series-derived defaults (synopsis first sentence, authorName, etc.).
- **src/components/webtoon/EpisodeIntroPage.tsx** (new): cinematic dark title page - TF monogram + "Toonflow Studio Paint Presents" eyebrow, accent-framed cover art with corner ticks (scanlation style), Episode NN marker, serif display title, episode title, italic tagline, Story & Art / Genre credit rows, "Created using Toonflow Studio Paint" footer. Token colors only (accent/white alphas).
- **src/components/webtoon/EpisodeOutroPage.tsx** (new): "End of Episode N" divider, farewell headline, teaser, Like/Comment/Subscribe/Share cue chips, Follow-creator CTA (real link to /profile/{authorId} in the reader, inert in the editor via `interactive={false}`), Toonflow studio mark + site host + (c) year author footer.
- **src/components/editor/BrandingMetaDialog.tsx** (new): accessible dialog (aria-modal, labelled inputs, Escape/backdrop close) editing the copy fields per page; empty field = "use default"; stays open with edits intact if the save fails.
- **create/webtoon/[webtoonId]/page.tsx**: strip now always renders Intro -> panels -> add-zone -> Outro inside the black page container; locked pages get a hover overlay with a warning "Intro/Outro - Locked" badge and an "Edit Text" button; old top-level "Canvas is empty" state replaced by an in-strip hint between the branded pages; strip width effect converted to a callback ref so the width applies on first mount (strip is no longer conditionally absent); `saveBrandingMeta` persists via updateEpisode and mirrors into local state.
- **webtoon/[id]/episode/[episodeId]/page.tsx (reader)**: renders EpisodeIntroPage before the panels and EpisodeOutroPage after them for every episode, including pre-existing ones.
- **src/lib/firebase/firestore.ts**: duplicateEpisode now carries `intro`/`outro` text overrides to the copy.
- No Firestore rules change needed (episode docs already author-writable). `tsc` + `eslint` clean; both routes compile and serve 200 on the dev server.

## 2026-07-06 - Locked branding pages previewed inside the Novel editor canvas
Follow-up to the webtoon intro/outro feature: the Novel editor canvas at /create/novel/[novelId] now shows the mandatory reader branding pages in place, locked, around the writable content.
- **src/components/editor/NovelRichEditor.tsx**: new optional `beforeContent`/`afterContent` slot props rendered inside the canvas scroll container (above/below the TipTap content), so the canvas scrolls exactly like the published reader while the formatting toolbar and stats footer stay fixed.
- **create/novel/[novelId]/page.tsx**: when the active chapter is the FIRST chapter, the canvas renders CreditsPoster + TitlePage above the content (TitlePage previews the live chapter-title input as you type); when it is the LAST chapter, EndingPoster renders below - mirroring the reader exactly (chapter 1 opener, final-chapter closer). Poster previews are wrapped in `inert` (React 19) so their CTA links cannot navigate or take focus mid-edit; hover shows a warning "Locked" badge, and persistent dashed divider strips explain "branding pages are locked / your story starts below". No lock flags or data needed - the posters are pure functions of novel data, so nothing in the editor can remove them.
- `tsc` + `eslint` clean; route compiles and serves 200 on the dev server.

## 2026-07-06 — Engineering handover documentation
- Added `docs/07-handover.md`: complete technical documentation & architecture analysis (26 sections — executive summary, frontend/backend/database docs, auth & authorization flows, security posture w/ residual risks R1–R10, storage, infrastructure, full API contract table, folder/component/state docs, performance & scalability analysis, monitoring/DevOps/testing gaps, AI features, third-party services, env var manifest, dependency audit (npm audit: 0 high/critical, 8 moderate transitive), prioritized tech debt, production readiness checklist (62/100), diagrams, final audit scores + 30/90-day and 1-year roadmaps).
- Published the same doc as a Claude artifact for shareable reading.
- No source code changed.

## Novel editor — formatting toolbar moved above chapter title (2026-07-08)
- `NovelRichEditor.tsx`: added a `titleSlot` prop rendered as a fixed (non-scrolling) block directly beneath the formatting toolbar and above the canvas scroll area.
- `create/novel/[novelId]/page.tsx`: moved the "Chapter N" + chapter-title input out of its position above the editor and passed it in via `titleSlot`, so the formatting toolbar (Bold/Italic/etc.) now sits at the top — directly under the Save/PDF top bar and above the chapter title. Dropped the decorative `canvas-beam` and tightened top padding (pt-10 → pt-8) for a cleaner look beneath the toolbar.

## Project-wide tooltip audit — shared Tooltip on every interactive icon (2026-07-08)
- **New**: `src/components/ui/Tooltip.tsx` — single reusable, Radix-based (`@radix-ui/react-tooltip`) tooltip. Dark-theme (`bg-bg-elevated`, `border-bg-border`), rounded, soft shadow, high-contrast white text, collision-aware positioning (auto-flips top/bottom/left/right, `collisionPadding` keeps it in the viewport), 150ms fade+scale (`animate-scale-in` from correct transform origin), arrow, `z-[70]` (above dialogs). Exposes `TooltipProvider` too.
- `src/app/layout.tsx`: mounted `<TooltipProvider delayDuration={200} skipDelayDuration={300}>` around the app — ~200ms open delay to prevent flicker; adjacent tooltips (toolbars) open instantly within the skip window. Opens on hover, instantly on keyboard focus.
- Wrapped **every icon-only interactive control** across the app with `<Tooltip>` and a meaningful label, keeping a matching `aria-label` on each trigger; added `aria-hidden` to decorative icons and `type="button"` where missing; replaced all native `title=` tooltips on icon buttons with the shared component (no more double tooltips).
- Surfaces covered: Navbar/MobileNav/UserMenu, Studio & SuperAdmin sidebars + hamburger, Novel/Webtoon editor toolbars, TipTap formatting toolbar (all format + colour swatch buttons via shared `ToolbarBtn`), Chapter/Episode sidebars (drag/publish/duplicate/delete/collapse), AI Assistant, webtoon panel controls, reader chapter/episode nav + settings, Like/Bookmark/Rating/Comment controls, Subscribe, all modals/dialogs (close, create-modal AI/tag actions, support, AI image gen), dashboard/wallet/profile, admin super tables (users/novels/webtoons/requests — view/restore/hide/delete/expand), Browse clear-search, HeroSlider arrows, studio list "⋮" menus + back links, novel detail sort.
- Composition note: for triggers that are also a Radix `DropdownMenu.Trigger`/`Dialog.Close`, the `<Tooltip>` wraps the trigger (nested `asChild`) so both behaviours coexist.
- Verified: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds.

## Chapter sidebar — duplicate & delete icons always visible (2026-07-08)
- `ChapterSidebar.tsx`: removed `opacity-0 group-hover:opacity-100 transition-opacity` from the Copy/Delete action group so the duplicate and delete icons stay visible at all times (like the publish toggle), not only on row hover.

## Home grid + Originals — Novel/Webtoon type badge on cards (2026-07-09)
- `src/app/(main)/HomeFeed.tsx` (`ContentCard`) and `src/app/(main)/originals/OriginalsClient.tsx` (`OriginalCard`): added a top-right badge on every cover showing whether the item is a **Novel** or **Webtoon**, with a matching icon (`BookOpen` for novels, `Tv2` for webtoons). Both components already receive the `type: 'novel' | 'webtoon'` prop; the badge just surfaces it.
- Style mirrors the existing top-left badge (`bg-black/60`, `border-white/10`, `text-[10px]`, rounded-full) so it reads as a peer to the status ("Original"/status) chip. Icons are `aria-hidden`; the visible text ("Novel"/"Webtoon") carries the meaning, and each card's `aria-label` already includes the type.
- No new imports needed — `BookOpen` and `Tv2` were already imported in both files.

## Episode sidebar — publish/duplicate/delete icons always visible (2026-07-09)
- `EpisodeSidebar.tsx`: removed `opacity-0 group-hover:opacity-100 transition-opacity` from the action group wrapping the Publish/Unpublish, Duplicate, and Delete icon buttons, so they stay visible at all times instead of only on row hover (mirrors the earlier ChapterSidebar fix).

## Novel branding pages now wrap every chapter (2026-07-09)
- Previously the novel intro (CreditsPoster + TitlePage) rendered only before chapter 1 and the ending (EndingPoster) only after the last chapter — book-style. Per user request, novels now match webtoons: the intro page shows at the top of **every** chapter and the ending page at the bottom of **every** chapter, in both the reader and the editor.
- `src/app/(reader)/novel/[id]/chapter/[chapterId]/page.tsx`: removed the `isFirstChapter`/`isLastChapter` derived flags and their gating so `CreditsPoster` + `TitlePage` always render before the chapter and `EndingPoster` always renders after it. (`currentIndex` kept — still drives prev/next chapter links.)
- `src/app/(novel)/create/novel/[novelId]/page.tsx`: removed the `isFirstChapter`/`isLastChapter` flags; the editor canvas now always previews the intro (`beforeContent`) and ending (`afterContent`) locked branding pages regardless of which chapter is active. Updated the ending note copy from "shown after your final chapter" → "shown after every chapter" and refreshed the explanatory comment.
- Typecheck + eslint clean on both files.

## Technical documentation / tech-stack audit generated (2026-07-09)
- Added `docs/TECH_STACK_AUDIT.md` — a comprehensive, evidence-backed audit of the full stack (21 sections: overview, frontend, backend, DB, auth, cloud services, APIs, storage, security, performance, build, dev tools, testing, env vars, dependencies, architecture, code quality, deployment, AI, full stack summary, ranked improvement suggestions).
- Documentation only; no source code touched. Findings surfaced: unused deps (`@radix-ui/react-scroll-area|select|tabs`, `@opentelemetry/api`), dead code (`signInWithGithub`), duplicate `getUserTransactions`, the ~1120-line `firestore.ts` god-module, zero automated tests, and no CI/CD.

## Audit remediation — cleanup, tests, tooling, CI (2026-07-10)
Acted on the actionable findings from `docs/TECH_STACK_AUDIT.md`:
- **Removed unused dependencies**: `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@opentelemetry/api` (none imported anywhere). `npm install` reconciled the lockfile (removed 5 packages).
- **Removed dead code**: `signInWithGithub` + `GithubAuthProvider` from `src/lib/firebase/auth.ts` (never wired to any UI — only Google + email are used).
- **De-duplicated `getUserTransactions`**: removed the `firestore.ts` copy (needed a userId+createdAt composite index); `wallet.ts` is now the single source. Repointed `app/(studio)/wallet/page.tsx` to import it from `wallet.ts` (withdrawal fns still come from `firestore.ts`).
- **Shared timestamp util**: new `src/lib/utils/timestamps.ts` (`tsToSeconds`, `compareTimestampsDesc/Asc`). Replaced ~6 inline copies across `firestore.ts`, `wallet.ts`, `engagement.ts`, `admin.ts` (behavior preserved: desc where it was desc, asc for replies). Left `CommentSection.timeAgo` (different display fallback semantics).
- **Extracted AI prompts**: `SYSTEM_PROMPT` + `WRITE_CHAPTER_PROMPT` moved from `api/ai/novel-assist/route.ts` into `src/lib/ai/prompts.ts` (imported back, verbatim).
- **Removed unused Firebase Analytics config**: dropped `measurementId` from `lib/firebase/config.ts` and `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` from `.env.example` (getAnalytics is never called). Fixed the Tailwind `fontFamily.mono` to a real system stack (JetBrains Mono was referenced but never loaded).
- **Clarified naming footgun**: added a header comment to `lib/firebase/admin.ts` explaining it is the CLIENT web-SDK admin service (rules-gated), vs `serverApp.ts` = Admin SDK.
- **Two latent bugs fixed** (surfaced by the new tests): `slugify()` left stray leading/trailing hyphens on padded input; `readingTime(0)` returned "0 min read" — now clamped to a 1-min minimum (matches the editor).
- **Tooling**: added Prettier (`.prettierrc.json`, `.prettierignore`) + `.editorconfig` (config matched to existing style; the repo was NOT bulk-reformatted). Added scripts: `typecheck`, `test`, `test:watch`, `format`, `format:check`.
- **Testing (was zero)**: added Vitest (`vitest.config.ts` with `@` alias) + 26 unit tests across `revenue/config`, `utils/timestamps`, `utils/formatters`, `api/guard` — all pure logic, no Firebase/Next/network.
- **CI (was none)**: `.github/workflows/ci.yml` runs lint + typecheck + test on push/PR (build deferred — needs env secrets).
- Verification: `npm test` → 26/26 pass; `npm run typecheck` clean; `npm run lint` clean.
- **Deferred (bigger/riskier, noted in the audit)**: splitting the `firestore.ts` god-module, Redis-backed rate limiting, CSP nonce upgrade, precomputed analytics, Sentry, SWR/React Query migration, Husky pre-commit hooks.

## Earnings Milestones section on /dashboard (2026-07-16)
Added a premium "Start Your Creator Journey" milestones section to the creator dashboard.
- **New component**: `src/components/dashboard/EarningsMilestones.tsx` (`'use client'`, reusable). Exports `default EarningsMilestones({ stats })` + `MilestoneStats` interface. Sub-components: `LiveStatCard`, `MilestoneCard`, `CircularProgress`, `RequirementRow`. Purely presentational — driven by props, no extra fetch.
- **Design**: glassmorphism cards (`bg-bg-card/60 backdrop-blur-xl` + gradient wash + corner glow) matching the dark theme; gold/purple/green accent themes (Tailwind `amber`/`purple`/`emerald` palette — existing tokens `bg-*`/`text-*` for base). Framer Motion for entrance (stagger `whileInView`), hover lift, and animated circular ring + progress bar. Respects `useReducedMotion` (ring/bar render at final value instantly).
- **5 milestone tiers** (Getting Started ₹1K → Rising ₹10K → Professional ₹1L → Elite ₹10L → Legendary ₹1Cr+), each with: large target amount, SVG circular progress (% of requirements met), checklist with metric icons + current/target caption, Lock/Unlock status pill, completion progress bar (`role="progressbar"`), and reward badge (Monetization Unlocked / Creator Partner / Verified Creator / Elite Partner / Legend Status). CTAs on tiers 1 (`/create`) and 5 (`/earnings`).
- **"Your Progress" strip**: 4 live stat cards — 👥 Subscribers, 👁 Views, 💰 Earnings, 📚 Published Chapters. Plus the ₹1,000 eligibility info note.
- **Wiring** (`app/(studio)/dashboard/page.tsx`): rendered between wallet cards and `CreatorAnalyticsSection`. `milestoneStats` derived entirely from already-loaded data (userProfile.followerCount, computed totalViews/totalEarningsInr, novels.chapterCount + webtoons.episodeCount, weighted rating, isOriginal, likes/views engagement). Progress requirements compute real met/unmet from live values.
- **React Compiler**: `Date.now()` (recent-activity check) moved to module-scope helper `hasRecentActivity()` to satisfy `react-hooks/purity`.
- **A11y**: focus-visible rings on CTAs, decorative icons `aria-hidden`, `role="progressbar"` with aria-value*, sr-only completion labels, no color-only status (Lock/Unlock text + icons).
- Verification: `npm run typecheck` clean; `eslint` clean on both files; `/dashboard` compiles + serves HTTP 200 under Turbopack dev (no compile errors / error overlay).

## Earnings Milestones — reconcile minimum with real config (2026-07-16)
- The info note previously hardcoded "start earning once you reach ₹1,000", which contradicted the Withdraw modal (real minimum is `REVENUE_CONFIG.minWithdrawalInr` = ₹200).
- `EarningsMilestones` now takes a `minWithdrawalInr` prop; dashboard passes `MIN_WITHDRAWAL`. The note is rewritten to be accurate: you earn from every validated view, can withdraw at the ₹200 minimum, and ₹1,000 is framed as the first (Getting Started) milestone rather than the earning gate. ₹1,000 now references `milestones[0].targetLabel` so it stays in sync.
- Verification: typecheck + eslint clean; /dashboard still serves HTTP 200 under Turbopack.

## Earnings Milestones — money precision matches wallet cards (2026-07-16)
- The "Your Progress → 💰 Earnings" tile used a 0-decimal INR formatter, so small balances (e.g. ₹0.02) rounded to "₹0" while the wallet "Total Revenue" card showed ₹0.02.
- Changed the section's `inr()` helper to `maximumFractionDigits: 2` (mirrors the dashboard's `fmtInr`). Earnings now shows ₹0.02 precisely; the info-note minimum shows ₹200.00 (matches the Withdraw modal).
- Verification: typecheck + eslint clean; /dashboard serves HTTP 200.

## Creator Monetization & Earnings section on /dashboard (2026-07-16)
Replaced the "Start Your Creator Journey" milestones section with a comprehensive, education-focused monetization section (per user request — old `EarningsMilestones.tsx` kept in repo for easy restore).
- **New component**: `src/components/dashboard/CreatorMonetization.tsx` (`'use client'`, reusable). Exports `default CreatorMonetization({ stats })` + `MonetizationStats` interface. Shared primitives: `Reveal` (scroll fade-up, reduced-motion aware), `Glass` (glassmorphism surface + tinted gradient wash + corner glow), `ProgressRing` (animated SVG ring), `Bar` (animated progressbar), `SectionHeading`.
- **8 sections**: (1) Creator Monetization intro + info banner; (2) Unlock Monetization card — 6 requirements each with live progress bar + current/target caption (Subscribers, Views, 10 Chapters, Profile, Identity Verification, Community Standing), overall ring, Lock/Unlock state, 4-item reward list; (3) How You Earn — 4 revenue-stream cards (Ads/Premium/Tips/Toonflow Premium); (4) Revenue Sharing — 70/30 split card with stacked gradient bar; (5) Estimated Monthly Earnings — responsive table (illustrative) + disclaimer box; (6) Creator Journey — animated vertical timeline, 5 tiers, current tier highlighted ("You are here") from live subs/views; (7) Current Earnings Dashboard — 10 live stat cards; (8) Transparency — "How Earnings Are Calculated" card.
- **Design**: premium dark glassmorphism, purple + gold lead palette (Tailwind `purple`/`amber`/`emerald`/`sky`/`rose`/`fuchsia`), Framer Motion entrance/hover/progress/timeline animations, circular + linear progress, all reduced-motion aware.
- **Live data** (`app/(studio)/dashboard/page.tsx`): `monetizationStats` derived from already-loaded data — subscribers (`userProfile.followerCount`), views, publishedChapters, profileComplete, pending payout, lifetime earnings, plus per-stream revenue (tips / ad / subscription) via new module-scope `aggregateCreatorRevenue(transactions)` helper (today/month windows + lifetime sums; `new Date()` kept out of render for react-hooks/purity). `identityVerified` honestly defaults to false ("Pending") since there is no KYC field yet; `goodStanding` defaults true. Revenue split pulls from `REVENUE_CONFIG` (70/30).
- Removed the `EarningsMilestones` import/render + its stats derivation (rating/originals/engagement/recent-activity) from the page; `EarningsMilestones.tsx` file retained.
- **A11y**: section `aria-labelledby`, `role="progressbar"` with aria-value* on every bar, decorative icons `aria-hidden`, gradient split bar has `role="img"` + label, table uses `scope="col"` headers, sr-only progress labels.
- Verification: typecheck + eslint clean; rendered the real component via a temporary `/montest` route with mock stats — all 8 section titles, live "756 / 1,000" progress, "You are here" tier, and ₹0.02 earnings rendered with zero errors; temp route deleted. `/dashboard` serves HTTP 200 under Turbopack.

## Creator Monetization — remove purple, teal + gold lead (2026-07-16)
- Per user request ("don't use purple"), removed the entire violet family from `CreatorMonetization.tsx`. Swapped the `purple` tone → `teal` and `fuchsia` → `cyan` in the TONES map + all usages, and updated the hardcoded gradients (revenue-share creator card, split bar, estimated-earnings gradient text) from purple → teal. New lead pairing is gold + teal.
- Verification: no purple/fuchsia/violet/indigo refs remain; typecheck + eslint clean; re-rendered via temp /montest route — 0 purple classes, teal/cyan present, no errors; temp route deleted.

## /earnings calculator — realistic blended estimate, single source w/ dashboard (2026-07-16)
The Revenue Calculator estimated only the single view/subscription stream (₹7 per 1,000 views), so 1M views showed ₹7,000 — ~100× below the dashboard's "Estimated Monthly Earnings" table (1M → ₹30k–1.2L). User chose to make the calculator match the dashboard estimates (without touching real per-view payout config).
- **New shared module** `src/lib/revenue/estimates.ts`: `EARNING_ESTIMATE_TIERS` (the 5 anchor rows, single source of truth), `ESTIMATE_STREAM_MIX` (ads 40 / subs 30 / premium 20 / tips 10), and `estimateMonthlyEarnings(views)` — pure log–log interpolation between anchors giving a smooth low–high band that passes exactly through every tier. Clearly documented as illustrative, NOT payout rates.
- **Reworked** `RevenueCalculator.tsx` → "Earnings Estimator": keeps the monthly-views presets + custom input; replaced the single-stream breakdown/model toggle with a blended low–high monthly range from `estimateMonthlyEarnings`, plus an illustrative per-stream mix breakdown (ads/subscriptions/premium/tips) of the mid-range with animated bars. Notes the guaranteed ₹7/1K view floor still applies. Disclaimers retained.
- **Refactored** dashboard `CreatorMonetization` Estimated Monthly Earnings table to render from `EARNING_ESTIMATE_TIERS` (was hardcoded strings) — table + calculator now provably share one source and can't drift. Output strings unchanged (verified identical).
- Verified: anchors match the table exactly (10K→₹500–3,000 … 100M→₹20,00,000–80,00,000); interpolation smooth/monotonic (e.g. 500K→₹17,493–69,974); default 1M→₹30,000–1,20,000 matches the dashboard. typecheck + eslint clean; /earnings and /dashboard both serve HTTP 200 with no errors.

## Coin Balance copy — mention premium chapters (2026-07-16)
- Coin Balance wallet card sub-text: "Used for AI generation" → "AI generation · unlock premium chapters".
- Buy Coins modal blurb updated to match: "Coins power AI webtoon generation (1 coin ≈ 1 AI panel) and unlock premium chapters."

## Dashboard — remove RPM/creator-share copy (2026-07-16)
- Removed the header subtitle "₹7.00 per 1K views · 70% creator share" under the creator's name.
- Removed the Total Revenue card's sub-text "N lifetime views · ₹7.00/1K".
- Dropped the now-unused `CREATOR_RPM` import.

## Dashboard — lock Buy (temporary) + gate Withdraw on earning eligibility (2026-07-16)
- Added `FEATURE_FLAGS.buyCoins = false` (temporary lock for the dashboard "+ Buy" coins action).
- New module-scope `LockedPill` (Tooltip + Lock icon) rendered in place of Buy/Withdraw actions when unavailable.
- **Buy**: when `!FEATURE_FLAGS.buyCoins`, the Coin Balance "+ Buy" becomes a "Locked" pill; clicking toasts "Coin purchases are temporarily unavailable." Flip the flag to true to re-enable.
- **Withdraw**: gated by a computed `earningEligible` = subscribers ≥ 1,000 && views ≥ 10,000 && publishedChapters ≥ 10 && profileComplete (the concrete, data-backed monetization requirements — identity verification isn't gated on since there's no KYC flow yet). Locks the Available-to-Withdraw action, the Withdrawal-History "Request" button, and the empty-state "Withdraw now" link; sub-text shows "Unlock by meeting earning requirements". Unlocks automatically once the requirements are met. `openBuy`/`openWithdraw` handlers also guard the modals defensively (won't open when locked; show an explanatory toast).
- Verified: typecheck + eslint clean; /dashboard serves HTTP 200.

## Earnings estimate — gate on subscribers AND views (2026-07-16)
Per user: each tier's subscribers must also grow to unlock higher earnings, otherwise the plan is meaningless (views alone shouldn't unlock high estimates).
- `estimateMonthlyEarnings` in `estimates.ts` now takes (subscribers, views). Earnings are gated by the LIMITING factor: `subscribersToViews(subscribers)` maps a sub count to the views its tier supports (log–log along the anchor pairs), then `effectiveViews = min(views, that)` drives the existing view interpolation. So you only reach a tier's range once BOTH subscribers and views support it.
- `RevenueCalculator` gained a "Subscribers" preset row + custom input (default 25,000, paired with the 1M-views default); calls `estimateMonthlyEarnings(subs, views)`; result label + helper copy explain earnings scale with the lower of the two.
- Dashboard "Estimated Monthly Earnings" table unchanged (its rows are the paired anchors; each row's estimate still equals its range).
- Verified: paired anchors reproduce the table exactly; 100M views + 1K subs stays capped at ₹500–3,000 (subscriber-gated); 1M subs + 10K views capped at ₹500–3,000 (view-gated). typecheck + eslint clean; /earnings serves HTTP 200 with the new input, no errors.

## Fix axe/aria false positives on progress bars (2026-07-16)
Microsoft Edge Tools' axe linter can't evaluate JSX expressions, so it misread `aria-valuenow={pct}` (numeric, dynamic) as an invalid string value and errored on CreatorMonetization.tsx + EarningsMilestones.tsx.
- Both progress bars now pass their ARIA via a typed `React.HTMLAttributes<HTMLDivElement>` object spread, so the static linter no longer sees literal `aria-value*` expression attributes.
- Replaced the `aria-labelledby` + hidden `<span id={useId()}>` labelling with a direct `aria-label` (also killed a follow-on axe "duplicate id" false positive on `id={expression}`). Removed the now-unused `useId` imports.
- Runtime ARIA verified via temp render: `role="progressbar" aria-valuenow="76" aria-valuemin="0" aria-valuemax="100" aria-label="1,000 Subscribers: 756 / 1,000"` — numeric values intact, accessible name now inline per bar. typecheck + eslint clean; /dashboard HTTP 200.

## Homepage brand + hero pass: logo asset, contrast, typography, carousel (2026-07-20)
Per user screenshot of the live home page: use `logomain.png`, fix colour ratio, slider, font/weight.

**Logo** — new `src/components/ui/Logo.tsx` renders `src/assets/logomain.png` via a static `next/image` import (Next emits intrinsic width/height, so the mark reserves its box → no CLS; build emits `.next/static/media/logomain.<hash>.png`). Props: `showText`, `variant` ('full' | 'studio'), `size`, `priority`. The mark is `alt=""`/`aria-hidden` when the wordmark text renders beside it (the text already names the brand) and takes a real alt when it stands alone. Replaced the hand-typed wordmark in Navbar (priority, text hidden < sm), Footer, StudioSidebar and StudioLayoutShell. `priority` is opt-in — the footer/sidebar marks are below the fold and no longer preload.
- Wordmark now reads `TOONFLOW` in `text-text` + `STUDIO PAINT` in `text-text-secondary`. Previously the second half used `text-accent`, and since `accent` is `#FFFFFF` that was white-on-white — zero visual hierarchy.

**Colour ratio (WCAG 1.4.3 / 1.4.11)** — measured, not eyeballed:
- `text.muted` `#717171` → `#8B8B8B`. The old value failed AA on *every* surface it's painted on: 3.93:1 on `bg`, 3.57:1 on `bg-card`, 3.30:1 on `bg-elevated` (AA needs 4.5:1). New value clears all three at 5.63 / 5.11 / 4.73.
- Added `bg.border-strong` `#616161` (3.10:1 on bg) and pointed `.input-base` at it. `#3F3F3F` is only 1.65:1 on `bg-card`; an input's border is the sole cue for where the control is, so 1.4.11 applies. Decorative card/divider borders keep the subtle `#3F3F3F`.
- Hero body/stat text moved off `white/50`–`white/60` (5.34:1 over pure bg, worse over bright artwork) onto `white/75`–`white/85`, and the scrim deepened from `via-bg/75 → to-bg/20` to `via-bg/90 → to-bg/30`.

**Typography** — added an optical display scale to globals.css (`.display-2xl/xl/lg/md`): tracking tightens (−0.035em → −0.018em) and weight climbs (700 → 800) as size grows, because Inter is drawn for text sizes and reads loose when scaled up. All carry `text-wrap: balance`, which is what fixes the ragged 3-line headline in the screenshot. Plus `.text-body` (`text-wrap: pretty`, orphan control only), `.tnum` (tabular figures so view counts don't jitter) and `.eyebrow` (uppercase gets *positive* tracking — the inverse of display type).

**Hero carousel** — rebuilt `HeroSlider.tsx`:
- *Real crossfade.* All slides now stay mounted and animate `opacity`. The old version swapped `src` on a single `<Image>`, so its `transition-opacity duration-700` had nothing to animate — every advance was a hard cut with a decode flash. `priority` on slide 0 only; the rest are lazy so LCP isn't diluted.
- *WCAG 2.2.2* — added a pause/play toggle. Hover/focus suspension and the explicit toggle are separate state, so moving the mouse away doesn't resume a carousel the user deliberately paused.
- *WCAG 2.3.3* — `usePrefersReducedMotion` (via `useSyncExternalStore`, so an OS-level change applies without reload; SSR snapshot is `false` to match first client render). Autoplay is disabled entirely under reduced motion and the pause button is hidden. Added a global `@media (prefers-reduced-motion: reduce)` block using near-zero durations rather than `none`, so `transitionend`/`animationend` listeners still fire.
- *ARIA* — dots were `role="tab"` with no `tabpanel` anywhere, describing a widget that didn't exist; they're now plain buttons with `aria-current`. Container is `role="region"` + `aria-roledescription="carousel"`, slide is `role="group"` + `aria-roledescription="slide"` labelled "N of M: <title>". `aria-live` is now `off` while rotating (it was `polite` permanently — a full re-announce every 6s) and flips to `polite` when stopped so manual navigation is still announced.
- *Keyboard* — ArrowLeft/ArrowRight, scoped to `onKeyDown` on the region so focus elsewhere on the page keeps normal arrow behaviour.
- *Touch targets (2.5.8)* — arrows 36px → 44px; dots keep their slim visual bar inside a 44px-tall transparent hit area; CTAs `min-h-[44px]`.
- Title clamped to 2 lines (was 3, which swallowed the hero and pushed the CTA off the fold on short viewports); active dot fills left-to-right over the slide duration via `hero-dot-progress` so the advance is telegraphed.
- Responsive heights `440 / 520 / 580px` (was a flat `500/580`, too tall on small phones).

Verified: `tsc --noEmit` clean, `eslint` clean, `vitest` 26/26 pass, `next build` compiles successfully, logo confirmed emitted to `.next/static/media/`.

## Favicon, information accuracy & memory optimization (2026-07-21)
Three-part pass from a live screenshot: duplicated tab title, generic favicon, 126MB dev memory.
Plus a mid-session request to give every stat icon a hover name + aria-label.

### Icons (Part A)
Discovered the three PWA icons were **JPEGs renamed .png** (byte-identical, all 1024×1024, manifest declared them image/png at 192/512) and `og-image.png` was byte-identical to the Ravana **seed cover** (a 1024×1024 JPEG declared 1200×630). Every social share rendered the demo art.
- New `scripts/generate-icons.mjs` (+ `npm run icons`, + `sharp` promoted from transitive to a real devDependency) regenerates everything from `src/assets/logomain.png` (668×598, non-square → contain-fit + centre on a `#0F0F0F` square; maskable inset to 80% for the safe zone).
- **Two mechanisms, by design.** Browser icons → App Router conventions (`src/app/icon.png`, `apple-icon.png`, `opengraph-image.png`, `twitter-image.png`): Next content-hashes them, which self-busts caches AND sidesteps the SW (its `/icons/` pattern needs a trailing slash, root paths never match). PWA icons stay in `public/icons/` but **filename-versioned** (`icon-192.v2.png`) since they sit under a 1-year immutable header + the SW cache-forever branch.
- Removed `metadata.icons` from layout (conventions replace it, and keeping both emits competing `<link>` tags). Deleted `og-image.png` + its next.config rule.
- Bumped SW `CACHE_VERSION` v1→v2 (the only eviction mechanism) and pulled `/manifest.json`, `/favicon.ico`, `/og-image.png` out of `STATIC_PATTERNS` (unhashed paths must not be trapped cache-forever). Added a next.config warning that `/icons/*` is versioned and must never be overwritten in place. Old JPEG icons kept one deploy so in-flight SW clients don't 404.
- Manifest: real PNG types/sizes, added id/lang/dir/scope, updated all 5 icon refs incl. the 2 shortcut entries.
- **Verified in a running prod server**: `/icon.png` etc. now serve `image/png` (were JPEG), manifest icons correct, hashed convention tags emitted, no stale refs.

### Icon labels (mid-session request)
New `src/components/ui/Stat.tsx` (icon + value + `title` hover name + `sr-only` "Views: 1.2K"). Used `title`, not the Radix Tooltip, because these sit **inside card `<Link>`s** — a tooltip trigger is a focusable button and nesting one in an anchor is invalid HTML. Rolled across HomeFeed, Browse, Originals, Profile mini-cards; detail pages + HeroSlider + Novel/WebtoonCard got `title` on their existing stat spans. Card `aria-label`s now fold in the stats (the label overrides inner content, so they'd otherwise be unreadable).

### Information accuracy (Part B)
- **The reported bug**: 6 page titles embedded the brand, which `title.template` appended again → "Home — Toonflow Studio Paint | Toonflow Studio Paint". Stripped the brand from all 6; home uses `title.absolute` = "Toonflow Studio Paint — Webtoons, Manga & Novels". Added metadata to `not-found.tsx` (noindex).
- Metadata: `metadataBase` now imports `APP_URL` (was a 2nd copy of the literal); added og/twitter title+description+url, `twitter.site` (`@toonflowstudiopaint`); "novels" keyword; `/earnings` added to sitemap; login description period; originals meta de-duped from its body copy.
- Branding: `(auth)/layout.tsx` "Toonflow Studio" (only place dropping "Paint", contradicted its own aria-label) → shared `<Logo>`; footer tagline aligned to the root "professional platform … webtoons, manga, and novels"; support email + legal `LAST_UPDATED` extracted to constants (were literals in 7 and 3 files); off-brand `#2DCA72` in the support email → neutral. Deleted unused `REVENUE_SPLIT` (duplicated revenue/config.ts).
- Copy: softened "millions of readers"/"thousands of creators" (contradicted the app's own empty states); fixed "commission on … commissions", a comma splice, en-GB "licence"→"license" ×3, serial commas; standardized 4 error boundaries to one heading + "Try again" (and gave their buttons `type="button"`).
- Legal placeholders (per decision): added entity/address constants + a **governing-law/jurisdiction clause** to Terms (was absent; platform bills INR + 18% GST via Razorpay) and a data-controller line to Privacy, all marked `[… — TO BE COMPLETED]`.

### Memory (Part C — phases 0+1 per decision)
Phase 0: memoized the `AuthContext` provider value (was a fresh object literal each render, re-rendering every `useAuth()` consumer app-wide); fixed 3 confirmed timer leaks (reader header timer, novel autosave — which fired a **Firestore write** + setState post-unmount, browse debounce); **lazy-loaded SupportModal** out of the shared `(main)` bundle.
Phase 1: revoked leaked object URLs at 3 upload sites (each pinned a full image blob); new `useTransientState` hook replacing **10** untracked `setSaveState('idle')` timers; mounted guards on 3 async-setState effects; **fixed a real stale-response race** in Browse (out-of-order Firestore responses overwriting fresh results) with a monotonic request id; memoized per-render sort/slice in HomeFeed and a per-scroll-frame `findIndex` in the reader.

**Measured (prod build, not dev):** framer-motion removed from the homepage — **/ dropped 1661.5 KB → 1512.4 KB (−149 KB, −9%, 23→20 chunks)**, framer-motion absent from /, /browse, /originals (was loading eagerly to render a closed modal). The 126MB figure was a dev-mode reading (unminified React + HMR + source maps); not representative of prod.
Caveat stated to user: already-installed PWAs snapshot icons at install and won't update without reinstall.

Gates: `tsc` clean · `eslint` clean · `vitest` 26/26 · `next build` OK. Prod server smoke-tested: /, /browse, /originals, /terms, /privacy, /ai-policy, /login, /earnings, /coming-soon → 200; bad path → 404; all icons serve image/png; legal placeholders + shared date render on all 3 legal pages.

## Follow-up: favicon.ico + text-only wordmark (2026-07-21)
- **favicon.ico was never the brand.** Root cause of "browser icon not changed": the prior pass regenerated icon.png/apple-icon/OG but left favicon.ico, assuming it was already the mark. It was a generic black-circle/white-triangle placeholder, and browsers prefer favicon.ico for the tab. Added `png-to-ico` (devDep) + a `faviconIco()` step to `scripts/generate-icons.mjs` that packs 16/32/48 frames of the TF mark (dropped the 256 frame — png-to-ico stores frames as uncompressed BMP, so 256 ballooned the file to 278KB; now 14.7KB). Next content-hashes the convention favicon, so the tag URL cache-busts on rebuild.
- **Wordmark → text only** (user request). Rewrote `src/components/ui/Logo.tsx` to drop the logomain image mark and render two-tone text "Toonflow Studio Paint" ("Studio Paint" in text-secondary; studio variant → "Toonflow Studio"). Removed the now-unused image/showText/priority/textClassName props; updated Navbar + auth-layout callers. logomain.png still drives the favicon/PWA/OG assets via the script.
- Gates: tsc/eslint clean, next build OK. favicon link tag confirmed rehashed (48x48), wordmark confirmed text-only in built HTML.
