/**
 * Per-device localStorage fallbacks for the product tour. The user's Firestore
 * `hasOnboarded` flag is the cross-device source of truth; these keep the tour
 * from re-nagging on the same browser (even before that write lands) and let a
 * user who closes mid-way resume from where they left off.
 *
 * Module-scope + typeof-window guards so the impure localStorage reads never run
 * during React render (react-hooks/purity) or on the server.
 */

const seenKey = (uid: string) => `toonflow:tour:seen:${uid}`
const indexKey = (uid: string) => `toonflow:tour:index:${uid}`

export function hasSeenTour(uid: string): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(seenKey(uid)) === '1' } catch { return false }
}

export function markTourSeen(uid: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(seenKey(uid), '1')
    window.localStorage.removeItem(indexKey(uid))
  } catch { /* private mode / quota — non-fatal */ }
}

/** Remember the step to resume from when the user closes the tour mid-way. */
export function saveTourIndex(uid: string, index: number): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(indexKey(uid), String(index)) } catch { /* non-fatal */ }
}

export function readTourIndex(uid: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(indexKey(uid))
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch { return 0 }
}
