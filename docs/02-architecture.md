# Phase 2 — Software Architecture

## High-Level System Architecture

```mermaid
graph TB
    subgraph Users
        Reader["Reader"]
        Creator["Creator"]
        Admin["Admin/SuperAdmin"]
    end

    subgraph Frontend["Frontend — Next.js 16 App Router"]
        direction TB
        MainRoutes["(main) Public Pages"]
        AuthRoutes["(auth) Login/Signup"]
        StudioRoutes["(studio) Dashboard/Admin"]
        NovelRoutes["(novel) Novel Editor"]
        ReaderRoutes["(reader) Chapter Reader"]
        APIRoutes["API Routes (Server)"]
    end

    subgraph Services["Backend Services"]
        SessionAPI["Session API<br>/api/session"]
        AIAPI["AI API<br>/api/ai/*"]
        PaymentAPI["Payment API<br>/api/payments/*"]
        WebhookAPI["Webhook API<br>/api/webhooks"]
    end

    subgraph External["External Services"]
        Anthropic["Anthropic Claude<br>Story AI"]
        StabilityAI["Stability AI<br>Image Generation"]
        Razorpay["Razorpay<br>Payment Gateway"]
    end

    subgraph Firebase["Firebase"]
        FirebaseAuth["Firebase Auth<br>Email + Google + GitHub"]
        Firestore["Cloud Firestore<br>NoSQL Database"]
        FirebaseStorage["Firebase Storage<br>Image Uploads"]
    end

    subgraph Deployment["Deployment"]
        Vercel["Vercel<br>Next.js Hosting"]
    end

    Reader --> MainRoutes
    Reader --> ReaderRoutes
    Creator --> StudioRoutes
    Creator --> NovelRoutes
    Admin --> StudioRoutes

    MainRoutes --> Firestore
    AuthRoutes --> FirebaseAuth
    StudioRoutes --> Firestore
    NovelRoutes --> Firestore
    ReaderRoutes --> Firestore

    SessionAPI --> FirebaseAuth
    AIAPI --> Anthropic
    AIAPI --> StabilityAI
    PaymentAPI --> Razorpay
    WebhookAPI --> Razorpay
    WebhookAPI --> Firestore

    Frontend --> Vercel
```

---

## Frontend Architecture

```mermaid
graph TB
    subgraph AppRouter["Next.js App Router"]
        RootLayout["Root Layout<br>AuthProvider + Toaster"]

        subgraph RouteGroups["Route Groups"]
            Auth["(auth)<br>Login / Signup"]
            Main["(main)<br>Home / Browse / Profile / Content"]
            Studio["(studio)<br>Dashboard / Admin / Wallet"]
            Novel["(novel)<br>Novel Editor"]
            Reader["(reader)<br>Chapter Reader"]
        end

        API["API Routes<br>/api/session, /api/ai/*, /api/payments/*, /api/webhooks"]
    end

    subgraph StateLayer["State Management"]
        AuthContext["AuthContext<br>Firebase Auth State"]
        AppStore["useAppStore (Zustand)<br>fontSize, filters, nav, search"]
    end

    subgraph ServiceLayer["Service Layer (lib/)"]
        FirestoreService["firestore.ts<br>1055 lines, all CRUD"]
        AdminService["admin.ts<br>Platform stats, moderation"]
        EngagementService["engagement.ts<br>Views, likes, comments"]
        StorageService["storage.ts<br>File uploads"]
        WalletService["wallet.ts<br>Transactions, withdrawals"]
        AuthService["auth.ts<br>Sign in/out/up"]
        TokenService["tokens.ts<br>AI token charging"]
    end

    subgraph Hooks["Custom Hooks"]
        UseAuth["useAuth"]
        UseNovels["useNovels"]
        UseWebtoons["useWebtoons"]
        UseChapters["useChapters"]
        UseEpisodes["useEpisodes"]
        UseFirestore["useFirestore"]
        UseDebounce["useDebounce"]
        UseInfiniteScroll["useInfiniteScroll"]
    end

    RootLayout --> RouteGroups
    RootLayout --> AuthContext
    RouteGroups --> Hooks
    Hooks --> ServiceLayer
    ServiceLayer --> Firebase["Firebase SDK"]
```

---

## Database Architecture (Firestore Collections)

```mermaid
erDiagram
    USERS ||--o{ NOVELS : "creates"
    USERS ||--o{ WEBTOONS : "creates"
    USERS ||--o{ COMMENTS : "writes"
    USERS ||--o{ BOOKMARKS : "bookmarks"
    USERS ||--o{ READING_HISTORY : "reads"
    USERS ||--o{ FOLLOWS : "follows"
    USERS ||--o{ TRANSACTIONS : "has"
    USERS ||--o{ WITHDRAWALS : "requests"
    USERS ||--o{ LIKES : "likes"
    USERS ||--o{ REPORTS : "reports"

    NOVELS ||--o{ CHAPTERS : "contains"
    WEBTOONS ||--o{ EPISODES : "contains"

    COMMENTS ||--o{ COMMENTS : "replies to"

    USERS {
        string uid PK
        string email
        string displayName
        string photoURL
        string bannerURL
        string role "user|creator|admin|superadmin"
        boolean isCreator
        string bio
        object socialLinks
        number followerCount
        number followingCount
        number totalViews
        number totalEarnings
        number balance
        timestamp createdAt
        timestamp updatedAt
    }

    NOVELS {
        string id PK
        string authorId FK
        string authorName
        string title
        string slug
        string synopsis
        string coverURL
        string bannerURL
        string status "draft|published|ongoing|completed|hiatus"
        string visibility "public|private"
        array genres
        array tags
        boolean isPremium
        boolean isFeatured
        boolean isOriginal
        number viewCount
        number likeCount
        number bookmarkCount
        number chapterCount
        number rating
        number ratingCount
        timestamp createdAt
        timestamp updatedAt
        timestamp publishedAt
    }

    CHAPTERS {
        string id PK
        string novelId FK
        string title
        number chapterNumber
        string content
        number wordCount
        boolean isPremium
        number coinCost
        number viewCount
        string status "draft|published"
        timestamp createdAt
        timestamp publishedAt
    }

    WEBTOONS {
        string id PK
        string authorId FK
        string authorName
        string title
        string slug
        string synopsis
        string coverURL
        string status "draft|published|ongoing|completed|hiatus"
        string visibility "public|unlisted|private"
        array genres
        array tags
        boolean isPremium
        boolean isFeatured
        boolean isOriginal
        number viewCount
        number likeCount
        number bookmarkCount
        number episodeCount
        number rating
        number ratingCount
        timestamp createdAt
        timestamp updatedAt
        timestamp publishedAt
    }

    EPISODES {
        string id PK
        string webtoonId FK
        string title
        number episodeNumber
        array panels
        string thumbnailURL
        boolean isPremium
        number coinCost
        number viewCount
        string status "draft|published"
        timestamp createdAt
        timestamp publishedAt
    }

    COMMENTS {
        string id PK
        string targetId FK
        string targetType "novel|webtoon|chapter|episode"
        string authorId FK
        string authorName
        string content
        number likeCount
        boolean isEdited
        string parentId "nullable for replies"
        timestamp createdAt
        timestamp updatedAt
    }

    BOOKMARKS {
        string id PK
        string contentId FK
        string contentType "novel|webtoon"
        timestamp addedAt
    }

    READING_HISTORY {
        string id PK
        string contentId FK
        string contentType "novel|webtoon"
        string lastChapterId
        number lastChapterNumber
        timestamp lastRead
    }

    FOLLOWS {
        string id PK "followerId_followingId"
        string followerId FK
        string followingId FK
        timestamp createdAt
    }

    LIKES {
        string id PK "uid_contentType_contentId"
        string uid FK
        string contentType
        string contentId
        string parentId
        timestamp createdAt
    }

    TRANSACTIONS {
        string id PK
        string userId FK
        string type "coin_purchase|ai_usage|chapter_unlock|..."
        number amount
        number coins
        string description
        string relatedContentId
        string razorpayPaymentId
        timestamp createdAt
    }

    WITHDRAWALS {
        string id PK
        string creatorId FK
        number amount
        string method "upi|bank_transfer|paypal|wise"
        object accountDetails
        string status "pending|approved|processing|completed|rejected"
        timestamp createdAt
        timestamp processedAt
    }

    VIEWS {
        string id PK "viewerId_contentId_date"
        string viewerId
        string contentId
        string contentType
        string parentId
        string date
        timestamp createdAt
    }

    REPORTS {
        string id PK
        string targetId FK
        string targetType "novel|webtoon|comment|user"
        string reporterId FK
        string reason
        string details
        string status "pending|reviewed|resolved|dismissed"
        timestamp createdAt
    }

    AUDIT_LOGS {
        string id PK
        string adminUid FK
        string adminEmail
        string action
        string resource
        string resourceId
        string details
        timestamp createdAt
    }

    SETTINGS {
        string id PK "platform"
        boolean maintenanceMode
        string maintenanceMessage
        boolean allowNewSignups
        boolean allowContentCreation
        number maxUploadSizeMB
        number aiGenerationsPerDay
        string announcementBanner
        boolean announcementVisible
        string defaultUserRole
    }

    NOVEL_AI_CHATS {
        string novelId PK
        subcollection messages
    }
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant FA as Firebase Auth
    participant FS as Firestore
    participant API as /api/session

    U->>FE: Click Login (Email/Google/GitHub)
    FE->>FA: signInWithEmailAndPassword / signInWithPopup
    FA-->>FE: FirebaseUser + idToken

    FE->>FS: createUserDocument(user) [if not exists]
    FE->>FS: getUserProfile(uid)
    FS-->>FE: UserProfile

    FE->>FA: getIdToken()
    FA-->>FE: idToken

    FE->>API: POST /api/session {idToken, role, email}
    API-->>FE: Set httpOnly cookies (auth, role, email)

    Note over FE: AuthContext resolves with<br>isAuthenticated, isCreator, isAdmin, isSuperAdmin
```

---

## AI Generation Pipeline

```mermaid
sequenceDiagram
    participant C as Creator
    participant FE as Frontend
    participant API as API Routes
    participant TK as Token Service
    participant AI as Anthropic Claude
    participant SI as Stability AI

    C->>FE: Request synopsis generation
    FE->>API: POST /api/ai/novel-content
    API->>TK: chargeTokens(userId, 'synopsis-generate', 3 tokens)
    alt Insufficient tokens
        TK-->>API: {ok: false, balance, required}
        API-->>FE: 402 Insufficient tokens
    else Tokens available
        TK-->>API: {ok: true}
        API->>AI: claude-haiku-4-5 → generate synopsis
        AI-->>API: Synopsis text
        API-->>FE: {result: synopsis}
    end

    C->>FE: Request cover image
    FE->>API: POST /api/ai/generate-image {action: 'prompt'}
    API->>TK: chargeTokens(userId, 'image-prompt', 1 token)
    API->>AI: claude-haiku-4-5 → generate image prompt
    AI-->>API: Image prompt text

    FE->>API: POST /api/ai/generate-image {action: 'generate'}
    API->>TK: chargeTokens(userId, 'image-generate', 15 tokens)
    API->>SI: Stability AI Ultra → generate image
    SI-->>API: Base64 image
    API-->>FE: {imageBase64: ...}
```

---

## Payment Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Wallet)
    participant API as /api/payments/create-order
    participant RP as Razorpay
    participant WH as /api/webhooks
    participant FS as Firestore

    U->>FE: Select coin package
    FE->>API: POST {packageId, priceInr}
    API->>RP: Create Order (amount in paise)
    RP-->>API: {orderId, amount, currency}
    API-->>FE: Order details

    FE->>RP: Open Razorpay Checkout (orderId)
    U->>RP: Complete payment
    RP-->>FE: Payment success callback

    RP->>WH: POST webhook (payment.captured)
    WH->>WH: Verify HMAC signature
    WH->>FS: Check idempotency (razorpayPaymentId)
    WH->>FS: Credit tokens to user balance
    WH->>FS: Create transaction record
```

---

## Publishing Flow

```mermaid
graph LR
    subgraph Creator
        A[Create Novel/Webtoon] --> B[Edit Metadata<br>Title, Synopsis, Cover, Genres]
        B --> C[Add Chapters/Episodes]
        C --> D[Write Content / Upload Panels]
        D --> E{Publish?}
        E -->|Yes| F[Status: ongoing<br>publishedAt set]
        E -->|No| G[Status: draft]
        F --> H[Visible in Browse/Originals/Home]
    end
```

---

## Creator Workflow

```mermaid
graph TB
    Login["Login / Signup"] --> Dashboard["Creator Dashboard"]
    Dashboard --> CreateNovel["Create Novel"]
    Dashboard --> CreateWebtoon["Create Webtoon"]
    Dashboard --> ViewStats["View Analytics"]
    Dashboard --> ManageContent["Manage Content"]

    CreateNovel --> NovelEditor["Novel Editor<br>TipTap Rich Text"]
    NovelEditor --> AIAssist["AI Assistant<br>Chat + Synopsis + Image"]
    NovelEditor --> ChapterMgmt["Chapter Management<br>Reorder, Duplicate, Delete"]
    NovelEditor --> Publish["Publish Novel"]

    CreateWebtoon --> WebtoonEditor["Webtoon Editor"]
    WebtoonEditor --> EpisodeMgmt["Episode Management<br>Upload Panels, Reorder"]
    WebtoonEditor --> PublishWebtoon["Publish Webtoon"]

    Dashboard --> Wallet["Wallet<br>Buy Tokens, View Transactions"]
    Wallet --> BuyTokens["Purchase Tokens<br>Razorpay Checkout"]
    Wallet --> WithdrawEarnings["Request Withdrawal"]
```

---

## Admin Workflow

```mermaid
graph TB
    AdminLogin["Admin Login"] --> AdminDash["Admin Dashboard<br>/admin"]
    AdminDash --> SuperAdmin["Super Admin<br>/admin/super"]

    SuperAdmin --> Overview["Platform Overview<br>Stats + Charts"]
    SuperAdmin --> UserMgmt["User Management<br>Roles, Disable, Delete"]
    SuperAdmin --> NovelMod["Novel Moderation<br>Status, Featured, Delete"]
    SuperAdmin --> WebtoonMod["Webtoon Moderation<br>Status, Featured, Delete"]
    SuperAdmin --> Reports["Report Management<br>Review, Resolve, Dismiss"]
    SuperAdmin --> Seed["Seed Data<br>Generate test content"]
    SuperAdmin --> Settings["Platform Settings<br>Maintenance, Limits, Announcements"]
```
