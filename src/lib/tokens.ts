// Server-side token accounting. Runs ONLY in API routes and uses the Admin SDK
// so it bypasses Firestore rules (clients can never write `balance`) and so the
// read-then-decrement is a single atomic transaction — no TOCTOU race lets a
// user spend past their balance with concurrent requests.
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebase/serverApp'

export const TOKEN_COSTS = {
  'synopsis-generate': 3,
  'synopsis-improve': 2,
  'synopsis-expand': 2,
  'image-prompt': 1,
  'image-generate': 15,
  'novel-assist': 2,
} as const

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
