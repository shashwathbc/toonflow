# Phase 1 — Complete Project Scan

## Complete Folder Tree

```
toonflow/
├── .claude/                          # Claude agent config
├── .env.example                      # Environment template
├── .env.local                        # Local secrets (gitignored)
├── .firebaserc                       # Firebase project alias
├── .gitignore                        # Git ignore rules
├── AGENTS.md                         # Agent rules (Next.js)
├── CLAUDE.md                         # Claude conventions
├── README.md                         # Project readme
├── dataconnect/                      # Firebase Data Connect (unused)
│   ├── dataconnect.yaml              # DC config (PostgreSQL)
│   ├── schema/
│   │   └── schema.gql                # GQL schema
│   ├── example/                      # Example connector
│   └── seed_data.gql                 # Seed data
├── eslint.config.mjs                 # ESLint flat config
├── firebase.json                     # Firebase deployment config
├── firestore.indexes.json            # Firestore indexes (empty)
├── firestore.rules                   # Firestore security rules
├── next-env.d.ts                     # Next.js type declarations
├── next.config.js                    # Next.js config (CJS + PWA)
├── package.json                      # Dependencies & scripts
├── package-lock.json                 # Lockfile
├── postcss.config.js                 # PostCSS config
├── public/
│   ├── favicon.ico                   # Favicon
│   ├── file.svg                      # Default SVG
│   ├── globe.svg                     # Default SVG
│   ├── next.svg                      # Default SVG
│   ├── vercel.svg                    # Default SVG
│   ├── window.svg                    # Default SVG
│   ├── icons/                        # ⚠️ EMPTY — PWA icons missing
│   ├── images/                       # ⚠️ EMPTY — No images
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker (generated)
│   └── workbox-e43f5367.js           # Workbox runtime
├── src/
│   ├── proxy.ts                      # Middleware/auth proxy
│   ├── app/
│   │   ├── favicon.ico               # App favicon
│   │   ├── globals.css               # Global styles (517 lines)
│   │   ├── layout.tsx                # Root layout (AuthProvider + Toaster)
│   │   ├── error.tsx                 # Root error boundary
│   │   ├── not-found.tsx             # 404 page
│   │   ├── (auth)/
│   │   │   ├── layout.tsx            # Auth centered layout
│   │   │   ├── loading.tsx           # Auth loading state
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Login page (uses LoginForm)
│   │   │   └── signup/
│   │   │       └── page.tsx          # Signup page (uses SignupForm)
│   │   ├── (main)/
│   │   │   ├── layout.tsx            # Main layout (Navbar+Footer+MobileNav)
│   │   │   ├── loading.tsx           # Main loading skeleton
│   │   │   ├── error.tsx             # Main error boundary
│   │   │   ├── page.tsx              # Home page
│   │   │   ├── HomeFeed.tsx          # Home feed client component
│   │   │   ├── browse/
│   │   │   │   ├── page.tsx          # Browse page (server)
│   │   │   │   └── BrowseClient.tsx  # Browse client component
│   │   │   ├── create/
│   │   │   │   └── page.tsx          # Create hub page
│   │   │   ├── novel/[id]/
│   │   │   │   └── page.tsx          # Novel detail page
│   │   │   ├── originals/
│   │   │   │   ├── page.tsx          # Originals page (server)
│   │   │   │   └── OriginalsClient.tsx
│   │   │   ├── profile/[uid]/
│   │   │   │   ├── page.tsx          # Profile page (server)
│   │   │   │   └── ProfilePageClient.tsx
│   │   │   └── webtoon/[id]/
│   │   │       ├── page.tsx          # Webtoon detail page
│   │   │       └── episode/[episodeId]/
│   │   │           └── page.tsx      # Episode viewer (stub?)
│   │   ├── (novel)/
│   │   │   ├── layout.tsx            # Novel studio layout
│   │   │   └── create/
│   │   │       ├── error.tsx         # Novel create error
│   │   │       ├── loading.tsx       # Novel create loading
│   │   │       └── novel/[id]/
│   │   │           └── ... (novel editor)
│   │   ├── (reader)/
│   │   │   ├── layout.tsx            # Reader layout (black bg)
│   │   │   └── novel/[id]/
│   │   │       └── chapter/[chapterId]/
│   │   │           └── page.tsx      # Novel chapter reader
│   │   ├── (studio)/
│   │   │   ├── layout.tsx            # Studio layout shell
│   │   │   ├── error.tsx             # Studio error boundary
│   │   │   ├── loading.tsx           # Studio loading skeleton
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx          # Admin dashboard
│   │   │   │   └── super/
│   │   │   │       ├── layout.tsx    # Super admin layout
│   │   │   │       ├── page.tsx      # Super admin dashboard
│   │   │   │       ├── novels/page.tsx
│   │   │   │       ├── webtoons/page.tsx
│   │   │   │       ├── users/page.tsx
│   │   │   │       ├── requests/page.tsx
│   │   │   │       ├── seed/page.tsx
│   │   │   │       └── settings/page.tsx
│   │   │   ├── create/               # ⚠️ EMPTY directory
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx          # Creator dashboard (34K!)
│   │   │   └── wallet/
│   │   │       └── page.tsx          # Wallet/tokens page (21K!)
│   │   └── api/
│   │       ├── ai/
│   │       │   ├── generate-image/route.ts
│   │       │   ├── novel-assist/route.ts
│   │       │   └── novel-content/route.ts
│   │       ├── payments/
│   │       │   └── create-order/route.ts
│   │       ├── session/route.ts
│   │       └── webhooks/route.ts
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminCharts.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── SuperAdminSidebar.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── SignupForm.tsx
│   │   ├── browse/                   # ⚠️ EMPTY
│   │   ├── content/
│   │   │   ├── NovelCard.tsx
│   │   │   └── WebtoonCard.tsx
│   │   ├── editor/
│   │   │   ├── AIAssistant.tsx
│   │   │   ├── ChapterSidebar.tsx
│   │   │   ├── EditorToolbar.tsx
│   │   │   ├── EpisodeSidebar.tsx
│   │   │   ├── NovelRichEditor.tsx
│   │   │   └── WebtoonToolbar.tsx
│   │   ├── home/
│   │   │   └── HeroSlider.tsx
│   │   ├── layout/
│   │   │   ├── Footer.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── StudioLayoutShell.tsx
│   │   │   ├── StudioSidebar.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── novel/
│   │   │   ├── AIImageGenerator.tsx
│   │   │   └── CreateNovelModal.tsx
│   │   ├── reader/
│   │   │   ├── BookmarkButton.tsx
│   │   │   ├── CommentSection.tsx
│   │   │   ├── EndingPoster.tsx
│   │   │   ├── IntroPoster.tsx
│   │   │   ├── LikeButton.tsx
│   │   │   └── TitlePage.tsx
│   │   ├── studio/                   # ⚠️ EMPTY
│   │   ├── ui/
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Skeleton.tsx
│   │   └── webtoon/
│   │       └── CreateWebtoonModal.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx            # Auth provider + useAuth
│   ├── hooks/
│   │   ├── useAuth.ts                 # Re-export from AuthContext
│   │   ├── useChapters.ts             # Real-time chapters subscription
│   │   ├── useDebounce.ts             # Generic debounce hook
│   │   ├── useEpisodes.ts             # Real-time episodes subscription
│   │   ├── useFirestore.ts            # Generic Firestore read hooks
│   │   ├── useInfiniteScroll.ts       # Intersection Observer hook
│   │   ├── useNovels.ts               # Real-time novels subscription
│   │   └── useWebtoons.ts             # Real-time webtoons subscription
│   ├── lib/
│   │   ├── tokens.ts                  # Token costs & charging
│   │   ├── firebase/
│   │   │   ├── admin.ts               # Admin-specific Firestore ops
│   │   │   ├── auth.ts                # Auth functions
│   │   │   ├── config.ts              # Firebase initialization
│   │   │   ├── engagement.ts          # Views, likes, comments
│   │   │   ├── firestore.ts           # Main Firestore service (1055 lines)
│   │   │   ├── storage.ts             # Firebase Storage uploads
│   │   │   └── wallet.ts              # Wallet/withdrawal functions
│   │   └── utils/
│   │       ├── cn.ts                  # clsx + twMerge utility
│   │       ├── constants.ts           # App constants, packages, roles
│   │       ├── formatters.ts          # Date, count, currency formatters
│   │       └── time.ts               # Time utilities
│   ├── store/
│   │   └── useAppStore.ts             # Zustand global store
│   └── types/
│       ├── index.ts                   # Re-exports
│       ├── comment.ts                 # Comment, Report types
│       ├── novel.ts                   # Novel, Chapter types
│       ├── transaction.ts             # Transaction, Withdrawal, CoinPackage
│       ├── user.ts                    # UserProfile, Bookmark, History
│       └── webtoon.ts                 # Webtoon, Episode types
├── storage.rules                      # Firebase Storage rules
└── tailwind.config.ts                 # Tailwind CSS v3 config
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.2.9 |
| **Language** | TypeScript (strict) | ^5 |
| **UI Library** | React | 19.2.4 |
| **Styling** | Tailwind CSS | 3.4.19 |
| **UI Primitives** | Radix UI | Various (avatar, dialog, dropdown, scroll-area, select, tabs, tooltip) |
| **Icons** | lucide-react | 1.21.0 |
| **State Management** | Zustand (persist) | 5.0.14 |
| **Forms** | react-hook-form + zod | 7.80.0 / 4.4.3 |
| **Auth/DB/Storage** | Firebase (client SDK) | 12.15.0 |
| **Rich Text Editor** | TipTap | 3.27.1 |
| **Animation** | Framer Motion | 12.41.0 |
| **Charts** | Recharts | 3.9.0 |
| **DnD** | @dnd-kit (core + sortable) | 6.3.1 / 10.0.0 |
| **Carousel** | Embla Carousel | 8.6.0 |
| **PDF** | jsPDF | 4.2.1 |
| **Date** | date-fns | 4.4.0 |
| **Toast** | react-hot-toast | 2.6.0 |
| **PWA** | next-pwa | 5.6.0 |
| **Scroll** | react-intersection-observer | 10.0.3 |
| **AI** | Anthropic SDK | 0.105.0 |
| **CSS Utils** | clsx + tailwind-merge | 2.1.1 / 3.6.0 |

---

## Third-Party Services & Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| **Firebase Auth** | Email/password + Google + GitHub login | ✅ Configured |
| **Cloud Firestore** | Primary database (NoSQL) | ✅ Active |
| **Firebase Storage** | Image uploads (covers, panels, avatars) | ✅ Active |
| **Firebase Data Connect** | PostgreSQL connector | 🔴 Unused (config present, not wired) |
| **Anthropic Claude** | AI story assistant + synopsis generation | ✅ Active (claude-haiku-4-5, claude-sonnet-4-6) |
| **Stability AI** | AI image generation (covers/banners) | ✅ Active (v2beta/ultra) |
| **Razorpay** | Payment gateway (INR) | ✅ Active (orders + webhooks) |
| **Vercel** | Deployment target | 🟡 Assumed (Next.js patterns, .vercel in gitignore) |
| **Google Fonts** | Inter font family | ✅ Active (CSS import) |

---

## Environment Variables

| Variable | Scope | Required | Present in .env.example |
|----------|-------|----------|------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Client | Optional | ✅ |
| `NEXT_PUBLIC_APP_URL` | Client | ✅ | ✅ |
| `NEXT_PUBLIC_APP_NAME` | Client | Optional | ✅ |
| `FIREBASE_PROJECT_ID` | Server | Optional | ✅ |
| `FIREBASE_CLIENT_EMAIL` | Server | Optional | ✅ |
| `FIREBASE_PRIVATE_KEY` | Server | Optional | ✅ |
| `ANTHROPIC_API_KEY` | Server | ✅ (for AI) | ❌ Missing |
| `STABILITY_API_KEY` | Server | ✅ (for images) | ❌ Missing |
| `RAZORPAY_KEY_ID` | Server | ✅ (for payments) | ❌ Missing |
| `RAZORPAY_KEY_SECRET` | Server | ✅ (for payments) | ❌ Missing |
| `RAZORPAY_WEBHOOK_SECRET` | Server | ✅ (for webhooks) | ❌ Missing |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client | ✅ (for checkout) | ❌ Missing |

> [!WARNING]
> `.env.example` is missing 6 critical server-side variables (Anthropic, Stability AI, Razorpay). New developers cannot configure the project without guessing.
