import type { FirestoreTimestamp } from '@/types'

export function now(): number {
  return Date.now()
}

export function nowTimestamp(): FirestoreTimestamp {
  return { seconds: Date.now() / 1000, nanoseconds: 0 }
}
