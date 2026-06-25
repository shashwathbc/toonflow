'use client'

import { useEffect, useState } from 'react'
import { subscribeToWebtoons } from '@/lib/firebase/firestore'
import type { Webtoon } from '@/types'

export function useWebtoons(uid: string) {
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeToWebtoons(
      uid,
      (data) => {
        setWebtoons(data)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return unsub
  }, [uid])

  return { webtoons, loading, error }
}
