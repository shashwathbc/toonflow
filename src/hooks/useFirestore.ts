import { useState, useEffect } from 'react'
import { getNovelById, getWebtoonById, getUserProfile } from '@/lib/firebase/firestore'
import type { Novel, Webtoon, UserProfile } from '@/types'

export function useNovel(id: string | null) {
  const [novel, setNovel] = useState<Novel | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getNovelById(id)
      .then(setNovel)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  return { novel, loading, error }
}

export function useWebtoon(id: string | null) {
  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getWebtoonById(id)
      .then(setWebtoon)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  return { webtoon, loading, error }
}

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(!!uid)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    getUserProfile(uid)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [uid])

  return { profile, loading, error }
}
