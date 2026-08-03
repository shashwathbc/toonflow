'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTourStore } from '@/store/useTourStore'
import { hasSeenTour, readTourIndex } from '@/lib/tour/storage'
import { trackTour } from '@/lib/tour/analytics'
import TourOverlay from './TourOverlay'

/**
 * Mounted once in the root layout (inside AuthProvider). Auto-starts the product
 * tour the first time a signed-in user without `hasOnboarded` shows up — on
 * whatever page they land on — and always renders the overlay so a manual replay
 * (Account menu → Product tour) works anywhere.
 *
 * `start()` is a Zustand action, not React state, so triggering it from this
 * effect doesn't violate react-hooks/set-state-in-effect.
 */
export default function TourManager() {
  const { firebaseUser, userProfile, loading } = useAuth()
  const start = useTourStore((s) => s.start)
  const autoStarted = useRef(false)

  useEffect(() => {
    if (loading || !firebaseUser || !userProfile) return
    if (userProfile.hasOnboarded) return
    if (autoStarted.current) return
    if (hasSeenTour(firebaseUser.uid)) return
    autoStarted.current = true
    const resumeAt = readTourIndex(firebaseUser.uid)
    start(resumeAt)
    trackTour('tour_started', { resumeAt, auto: true })
  }, [loading, firebaseUser, userProfile, start])

  return <TourOverlay />
}
