// Server-side token accounting. Runs ONLY in API routes and uses the Admin SDK
// so it bypasses Firestore rules (clients can never write `balance`) and so the
// read-then-decrement is a single atomic transaction — no TOCTOU race lets a
// user spend past their balance with concurrent requests.
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebase/serverApp'

// All AI features are currently FREE for every user — the story assistant,
// cover/banner image generation, and synopsis generate/improve/expand no longer
// charge tokens, so this map is intentionally empty. The charging machinery
// below (and the wallet/balance/transactions product) is kept dormant: to make
// a feature paid again, add its `action: cost` here and call chargeTokens() from
// that route.
export const TOKEN_COSTS = {} as const

export type TokenAction = keyof typeof TOKEN_COSTS

export async function getUserBalance(uid: string): Promise<number> {
  const snap = await adminDb().doc(`users/${uid}`).get()
  if (!snap.exists) return 0
  return (snap.data()?.balance as number) ?? 0
}

export async function chargeTokens(
  uid: string,
  action: TokenAction,
  description: string
): Promise<{ ok: true } | { ok: false; balance: number; required: number }> {
  const cost = TOKEN_COSTS[action]
  const db = adminDb()
  const userRef = db.doc(`users/${uid}`)

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef)
      const balance = (snap.data()?.balance as number) ?? 0
      if (balance < cost) {
        return { ok: false as const, balance, required: cost }
      }
      tx.update(userRef, { balance: FieldValue.increment(-cost) })
      tx.set(db.collection('transactions').doc(), {
        userId: uid,
        type: 'ai_usage',
        amount: 0,
        coins: -cost,
        description,
        createdAt: FieldValue.serverTimestamp(),
      })
      return { ok: true as const }
    })
  } catch {
    // A transaction failure must never silently grant free usage.
    return { ok: false, balance: 0, required: cost }
  }
}
