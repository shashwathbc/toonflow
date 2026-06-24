import type { FirestoreTimestamp } from '@/types'

export function fromTimestamp(ts: FirestoreTimestamp): Date {
  return new Date(ts.seconds * 1000)
}

export function formatRelativeTime(ts: FirestoreTimestamp): string {
  const now = Date.now()
  const ms = fromTimestamp(ts).getTime()
  const diff = Math.floor((now - ms) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`
  return `${Math.floor(diff / 31536000)}y ago`
}

export function formatDate(ts: FirestoreTimestamp): string {
  return fromTimestamp(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatCurrency(amountInPaise: number, currency: 'INR' | 'USD' = 'INR'): string {
  const amount = currency === 'INR' ? amountInPaise / 100 : amountInPaise / 100
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function readingTime(wordCountNum: number): string {
  const minutes = Math.ceil(wordCountNum / 200)
  return `${minutes} min read`
}
