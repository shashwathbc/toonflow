// Resolve a user's entitlement tier SERVER-SIDE, from the database.
//
// The tier decides how long, how large and how many videos an account may
// generate — i.e. how much vendor money it can spend. So it is read from
// users/{uid} with the Admin SDK and never accepted from the request: a body
// field like `{ tier: 'admin' }` would be a one-line quota bypass.
import { adminDb } from '@/lib/firebase/serverApp'
import type { EntitlementTier } from '@/lib/anime/limits'

export async function resolveTier(uid: string): Promise<EntitlementTier> {
  try {
    const snap = await adminDb().collection('users').doc(uid).get()
    if (!snap.exists) return 'free'
    const role = snap.get('role') as string | undefined
    if (role === 'admin' || role === 'superadmin') return 'admin'
    if (snap.get('isCreator') === true || role === 'creator') return 'creator'
    return 'free'
  } catch (err) {
    // Fail CLOSED: an unreadable profile drops to the tightest limits rather
    // than granting the most expensive ones.
    console.error('[entitlements] tier lookup failed, defaulting to free:', err)
    return 'free'
  }
}
