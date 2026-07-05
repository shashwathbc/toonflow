import {
  collection, addDoc, getDocs,
  query, where, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from './db'
import type { Transaction, Withdrawal, WithdrawalMethod } from '@/types'

// ₹0.007 per view (platform earns ₹0.01; creator keeps 70%)
export const EARNINGS_PER_VIEW = 0.007

export function viewsToInr(views: number): number {
  return Math.floor(views * EARNINGS_PER_VIEW * 100) / 100
}

export async function getUserTransactions(uid: string, limitCount = 20): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', uid),
    limit(limitCount),
  )
  const snaps = await getDocs(q)
  const results = snaps.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)
  results.sort((a, b) => {
    const ts = (v: unknown) =>
      v && typeof v === 'object' && 'seconds' in (v as object) ? (v as { seconds: number }).seconds : 0
    return ts(b.createdAt) - ts(a.createdAt)
  })
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
  results.sort((a, b) => {
    const ts = (v: unknown) =>
      v && typeof v === 'object' && 'seconds' in (v as object) ? (v as { seconds: number }).seconds : 0
    return ts(b.createdAt) - ts(a.createdAt)
  })
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
