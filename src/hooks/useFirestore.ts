import { useState, useEffect } from 'react'
import { getNovelById, getWebtoonById, getUserProfile } from '@/lib/firebase/firestore'
import type { Novel, Webtoon, UserProfile } from '@/types'

export function useNovel(id: string | null) {
  const [novel, setNovel] = useState<Novel | null>(null)
  const [error, setError] = useState<Error | null>(null)
  // loading is derived from "has the current id finished fetching" so the
  // effect never calls setState synchronously (react-hooks/set-state-in-effect)
  const [fetchedId, setFetchedId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getNovelById(id)
      .then((data) => { if (!cancelled) setNovel(data) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setFetchedId(id) })
    return () => { cancelled = true }
  }, [id])

  return { novel, loading: !!id && fetchedId !== id, error }
}

export function useWebtoon(id: string | null) {
  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [fetchedId, setFetchedId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getWebtoonById(id)
      .then((data) => { if (!cancelled) setWebtoon(data) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setFetchedId(id) })
    return () => { cancelled = true }
  }, [id])

  return { webtoon, loading: !!id && fetchedId !== id, error }
}

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [fetchedUid, setFetchedUid] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getUserProfile(uid)
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setFetchedUid(uid) })
    return () => { cancelled = true }
  }, [uid])

  return { profile, loading: !!uid && fetchedUid !== uid, error }
}
