export const SUPER_ADMIN_EMAIL = 'shashwathbc@gmail.com'

export const AUTH_COOKIE_NAME = 'toonflow-auth-token'
export const ROLE_COOKIE_NAME = 'toonflow-user-role'
export const EMAIL_COOKIE_NAME = 'toonflow-user-email'

/**
 * Feature flags for release gating.
 * Locked features redirect to /coming-soon (super admin bypasses the lock).
 * Flip to true when the feature is ready to ship.
 */
export const FEATURE_FLAGS = {
  webtoonStudio: false, // /create/webtoon/** — Webtoon Studio (locked → Coming Soon)
  wallet: false, // /wallet/** — token purchases & payouts (locked in place)
  buyCoins: false, // dashboard "+ Buy" coins — temporarily locked
} as const

export const APP_NAME = 'Toonflow Studio Paint'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://toonflowstudiopaint.com'

/** Public support inbox. Shown on Terms, Privacy, AI Policy, the Footer and the
 *  support modal, and used as the From/Reply-To on the auto-reply email. */
export const SUPPORT_EMAIL = 'toonflowstudiopaint@gmail.com'

/** X/Twitter handle — drives the twitter:site and twitter:creator card tags. */
export const SOCIAL_HANDLE = '@toonflowstudiopaint'

/** Effective date shown on all three legal pages. Declared once so Terms,
 *  Privacy and AI Policy can never drift apart. Update when any of them change. */
export const LEGAL_LAST_UPDATED = 'July 23, 2026'

/**
 * Registered company details, shown verbatim on /terms and /privacy. Sourced
 * from the LLP's incorporation (LLPIN) and GST registration certificates.
 */
export const LEGAL_ENTITY_NAME = 'Toonflow Studio Paint LLP'
export const LEGAL_ADDRESS =
  'No 10, Sri Mata, 5th Main, Adithya Nagar, JP Nagar 8th Phase, Anjanapura, Bengaluru South, Bengaluru, Karnataka 560078, India'
export const LEGAL_JURISDICTION = 'Bengaluru, Karnataka'
/** GST Identification Number — displayed on the legal pages (a GSTIN must be
 *  prominently displayed at the place of business). */
export const LEGAL_GSTIN = '29AAZFT9560H1Z3'
/** LLP Identification Number from the Certificate of Incorporation. */
export const LEGAL_LLPIN = 'ACX-3877'

export const PAGINATION_LIMIT = 20
export const BROWSE_LIMIT = 24
export const TRENDING_LIMIT = 12
export const HISTORY_LIMIT = 20

export const GENRES = [
  'action',
  'adventure',
  'romance',
  'fantasy',
  'horror',
  'comedy',
  'thriller',
  'mystery',
  'sci-fi',
  'slice-of-life',
  'historical',
  'isekai',
  'wuxia',
  'drama',
  'psychological',
] as const

export const CONTENT_STATUSES = [
  'draft',
  'published',
  'ongoing',
  'completed',
  'hiatus',
] as const

export const USER_ROLES = ['user', 'creator', 'admin', 'superadmin'] as const

export const COIN_PACKAGES = [
  { id: 'starter', coins: 100, priceInr: 99, priceUsd: 1.2, bonus: 0, isPopular: false },
  { id: 'popular', coins: 550, priceInr: 499, priceUsd: 5.9, bonus: 50, isPopular: true },
  { id: 'value', coins: 1200, priceInr: 999, priceUsd: 11.9, bonus: 200, isPopular: false },
  { id: 'mega', coins: 3000, priceInr: 1999, priceUsd: 23.9, bonus: 800, isPopular: false },
] as const

// NOTE: the creator/platform revenue split lives in src/lib/revenue/config.ts
// (REVENUE_CONFIG.creatorSharePct / platformSharePct), which is the single
// source of truth for every rate on the platform. A duplicate REVENUE_SPLIT
// constant used to sit here, unreferenced — removed so the two can't drift.
