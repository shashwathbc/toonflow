'use client'

import { useEffect, useState } from 'react'
import { subscribeToChapters } from '@/lib/firebase/firestore'
import type { Chapter } from '@/types'

export function useChapters(novelId: string) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!novelId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeToChapters(
      novelId,
      (data) => {
        setChapters(data)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return unsub
  }, [novelId])

  return { chapters, loading, error }
}
