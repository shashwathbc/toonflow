export const SUPER_ADMIN_EMAIL = 'shashwathbc@gmail.com'

export const AUTH_COOKIE_NAME = 'toonflow-auth-token'
export const ROLE_COOKIE_NAME = 'toonflow-user-role'
export const EMAIL_COOKIE_NAME = 'toonflow-user-email'

export const APP_NAME = 'Toonflow Studio Paint'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://toonflowstudiopaint.com'

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

export const REVENUE_SPLIT = {
  CREATOR: 0.7,
  PLATFORM: 0.3,
} as const
