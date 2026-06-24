'use client'

import { useEffect, useState, useCallback } from 'react'
import { subscribeToNovels } from '@/lib/firebase/firestore'
import type { Novel } from '@/types'

export function useNovels(uid: string) {
  const [novels, setNovels] = useState<Novel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeToNovels(
      uid,
      (data) => {
        setNovels(data)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return unsub
  }, [uid])

  return { novels, loading, error }
}
