# Toonflow Studio Paint — Change Log

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
