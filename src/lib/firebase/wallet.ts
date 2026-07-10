import {
  collection, addDoc, getDocs,
  query, where, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from './db'
import { CREATOR_EARNINGS_PER_VIEW, viewsToCreatorInr } from '@/lib/revenue/config'
import { compareTimestampsDesc } from '@/lib/utils/timestamps'
import type { Transaction, Withdrawal, WithdrawalMethod } from '@/types'

// Creator earnings per view — derived from the central revenue config
// (platform gross × creator share). Re-exported here for existing callers.
export const EARNINGS_PER_VIEW = CREATOR_EARNINGS_PER_VIEW

export const viewsToInr = viewsToCreatorInr

export async function getUserTransactions(uid: string, limitCount = 20): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', uid),
    limit(limitCount),
  )
  const snaps = await getDocs(q)
  const results = snaps.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)
  results.sort((a, b) => compareTimestampsDesc(a.createdAt, b.createdAt))
  return results
}

export async function getUserWithdrawals(uid: string): Promise<Withdrawal[]> {
  const q = query(
    collection(db, 'withdrawals'),
    where('creatorId', '==', uid),
    limit(50),
  )
  const snaps = await getDocs(q)
  const results = snaps.docs.map((d) => ({ id: d.id, ...d.data() }) as Withdrawal)
  results.sort((a, b) => compareTimestampsDesc(a.createdAt, b.createdAt))
  return results
}

export async function createWithdrawal(
  uid: string,
  amount: number,
  method: WithdrawalMethod,
  accountDetails: Record<string, string>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'withdrawals'), {
    creatorId: uid,
    amount,
    method,
    accountDetails,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// NOTE: coins are credited only by the verified Razorpay webhook
// (src/app/api/webhooks) via the Admin SDK. There is deliberately no
// client-side crediting function — a browser must never be able to write
// `balance` (Firestore rules forbid it).
