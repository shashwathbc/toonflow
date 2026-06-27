import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from './config'
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

export async function purchaseCoins(
  uid: string,
  packageId: string,
  coins: number,
  priceInr: number,
): Promise<void> {
  await addDoc(collection(db, 'transactions'), {
    userId: uid,
    type: 'coin_purchase',
    amount: priceInr,
    coins,
    description: `Purchased ${coins} coins`,
    relatedContentId: packageId,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'users', uid), {
    balance: increment(coins),
  })
}
