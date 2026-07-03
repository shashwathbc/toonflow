'use client'

import { useEffect, useState } from 'react'
import { subscribeToWebtoons } from '@/lib/firebase/firestore'
import type { Webtoon } from '@/types'

export function useWebtoons(uid: string) {
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [error, setError] = useState<string | null>(null)
  // loading derives from "has the current uid received its first snapshot",
  // so the effect never calls setState synchronously
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    const unsub = subscribeToWebtoons(
      uid,
      (data) => {
        setWebtoons(data)
        setLoadedUid(uid)
      },
      (err) => {
        setError(err.message)
        setLoadedUid(uid)
      }
    )

    return unsub
  }, [uid])

  return { webtoons, loading: !!uid && loadedUid !== uid, error }
}
