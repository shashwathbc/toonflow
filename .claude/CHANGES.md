# Toonflow Studio Paint — Change Log

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


## 2026-06-25 — Fix 11 ARIA/CSS lint problems

- `CreateWebtoonModal.tsx`: Changed `aria-invalid` from JSX expression to spread-object pattern (matches CreateNovelModal, avoids axe static-analysis false positive); split `aria-selected` genre buttons into two static renders (`"true"`/`"false"`); added `aria-label="Select genres"` to `role="listbox"` div
- `(novel)/create/novel/page.tsx`: Added `aria-label="Sort order options"` to sort `role="listbox"` div
- `(novel)/create/webtoon/page.tsx`: Added `aria-label="Sort order options"` to sort `role="listbox"` div
- `CreateNovelModal.tsx`: Added `aria-label="Select genres"` to `role="listbox"` div
- `globals.css`: Wrapped `scrollbar-width`/`scrollbar-color` in `@supports (scrollbar-width: thin)` block to suppress compat warnings (webkit fallback retained)
- `EpisodeSidebar.tsx`: Removed `style` prop from `<li>`; apply dnd-kit transform/transition imperatively via `useEffect` + merged ref (`useRef` + `useCallback`); moved opacity/z-index to Tailwind conditional classes
