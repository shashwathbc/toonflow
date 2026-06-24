import type { FirestoreTimestamp } from './user'

export type TransactionType =
  | 'coin_purchase'
  | 'chapter_unlock'
  | 'episode_unlock'
  | 'tip'
  | 'ad_revenue'
  | 'subscription_revenue'
  | 'withdrawal'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  coins: number
  description: string
  relatedContentId?: string
  relatedContentType?: 'novel' | 'webtoon'
  createdAt: FirestoreTimestamp
}

export type WithdrawalMethod = 'upi' | 'bank_transfer' | 'paypal' | 'wise'
export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected'

export interface Withdrawal {
  id: string
  creatorId: string
  amount: number
  method: WithdrawalMethod
  accountDetails: Record<string, string>
  status: WithdrawalStatus
  notes?: string
  processedBy?: string
  createdAt: FirestoreTimestamp
  processedAt?: FirestoreTimestamp
}

export interface CoinPackage {
  id: string
  coins: number
  priceInr: number
  priceUsd: number
  bonus: number
  isPopular: boolean
  isActive: boolean
}
