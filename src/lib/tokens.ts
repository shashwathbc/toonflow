import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase/db'

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
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return 0
  return (snap.data().balance as number) ?? 0
}

export async function chargeTokens(
  uid: string,
  action: TokenAction,
  description: string
): Promise<{ ok: true } | { ok: false; balance: number; required: number }> {
  const cost = TOKEN_COSTS[action]
  const balance = await getUserBalance(uid)

  if (balance < cost) {
    return { ok: false, balance, required: cost }
  }

  await Promise.all([
    updateDoc(doc(db, 'users', uid), { balance: increment(-cost) }),
    addDoc(collection(db, 'transactions'), {
      userId: uid,
      type: 'ai_usage',
      amount: 0,
      coins: -cost,
      description,
      createdAt: serverTimestamp(),
    }),
  ])

  return { ok: true }
}
