'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToUserProjects } from '@/lib/firebase/anime'
import type { AnimeProject } from '@/types/anime'

export interface UseAnimeProjects {
  projects: AnimeProject[]
  loading: boolean
  error: string | null
}

/** Stable empty array so a signed-out render doesn't churn a new reference. */
const NONE: AnimeProject[] = []

/**
 * Live list of the signed-in creator's anime projects.
 *
 * The query is owner-scoped, which the Firestore rules also REQUIRE — an
 * unfiltered listen simply fails rather than returning other people's work.
 *
 * State is only ever written from the SUBSCRIPTION CALLBACK, never synchronously
 * in the effect body: `loading` and the visible list are derived from which uid
 * the snapshot belongs to. That keeps the React Compiler happy and, more
 * importantly, means a uid change can't flash the previous account's projects.
 */
export function useAnimeProjects(): UseAnimeProjects {
  const { firebaseUser, loading: authLoading } = useAuth()
  const uid = firebaseUser?.uid ?? null

  const [snapshot, setSnapshot] = useState<{ uid: string; projects: AnimeProject[] } | null>(null)
  const [failure, setFailure] = useState<{ uid: string; message: string } | null>(null)

  useEffect(() => {
    if (!uid) return
    return subscribeToUserProjects(
      uid,
      (next) => setSnapshot({ uid, projects: next }),
      (err) => {
        console.error('[useAnimeProjects]', err)
        setFailure({ uid, message: 'Could not load your projects.' })
      },
    )
  }, [uid])

  const fresh = snapshot?.uid === uid
  const error = failure?.uid === uid ? failure.message : null

  return {
    projects: fresh ? snapshot.projects : NONE,
    // Signed out is a settled state, not a loading one.
    loading: authLoading || (!!uid && !fresh && !error),
    error,
  }
}
