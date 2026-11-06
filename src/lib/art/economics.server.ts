// Loads the marketplace rate card. SERVER ONLY (Admin SDK).
//
// The rates are configurable from the admin dashboard (`settings/marketplace`)
// rather than baked into the bundle, because a platform fee is a business
// decision that changes without a deploy. `lib/art/pricing` holds the defaults
// and the clamping; this module only fetches and caches.
//
// Never import this from a client component — `settings/*` is admin-read-only in
// firestore.rules, and the rates a buyer sees must come from the server anyway.
import 'server-only'
import { adminDb } from '@/lib/firebase/serverApp'
import { DEFAULT_ECONOMICS, normalizeEconomics, type MarketplaceEconomics } from './pricing'

const SETTINGS_DOC = 'settings/marketplace'
/** Rates change rarely; re-reading them on every checkout is a wasted round trip. */
const CACHE_TTL_MS = 60_000

let cached: { value: MarketplaceEconomics; expiresAt: number } | null = null

/**
 * Current rate card. Falls back to the compiled defaults if the settings
 * document is missing or unreadable — a checkout must never fail because an
 * optional config document is absent, and the defaults are always valid.
 */
export async function loadMarketplaceEconomics(): Promise<MarketplaceEconomics> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  let value = DEFAULT_ECONOMICS
  try {
    const snap = await adminDb().doc(SETTINGS_DOC).get()
    if (snap.exists) {
      // normalizeEconomics clamps every field, so a bad admin edit degrades to
      // the default rather than zeroing creator payouts.
      value = normalizeEconomics(snap.data() as Partial<MarketplaceEconomics>)
    }
  } catch (error) {
    console.error('[art/economics] falling back to default rates', error)
  }

  cached = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}

/** Drop the cache after an admin writes new rates, so the change lands at once. */
export function invalidateEconomicsCache(): void {
  cached = null
}
