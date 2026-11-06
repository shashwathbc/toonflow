'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelGeneration, pollJob, type JobStatus } from '@/lib/anime/client'
import type { GenerationJobStatus } from '@/types/anime'

/**
 * Track one generation job to completion.
 *
 * Polling uses an escalating interval — fast at first (the user is watching),
 * slowing as the wait stretches on. A fixed 1s poll would multiply into hundreds
 * of pointless requests across a long render, and every poll costs a vendor
 * status call.
 *
 * Progress state is written only from the poll callback and is TAGGED with the
 * job id it belongs to, so switching jobs can't briefly show the previous job's
 * progress and nothing is set synchronously inside the effect body.
 */
const POLL_SCHEDULE_MS = [1500, 1500, 2000, 3000, 4000, 5000, 8000] as const
const MAX_POLL_MS = 10_000

function delayForAttempt(attempt: number): number {
  return POLL_SCHEDULE_MS[Math.min(attempt, POLL_SCHEDULE_MS.length - 1)] ?? MAX_POLL_MS
}

interface Tracked {
  jobId: string
  status: GenerationJobStatus | null
  progress: number
  error: string | null
}

export interface UseGenerationJob {
  status: GenerationJobStatus | null
  progress: number
  error: string | null
  isActive: boolean
  cancel: () => Promise<void>
}

export function useGenerationJob(
  jobId: string | null,
  onComplete?: (result: JobStatus) => void,
): UseGenerationJob {
  const [tracked, setTracked] = useState<Tracked | null>(null)

  // Kept in a ref so a caller re-rendering with a new closure doesn't restart
  // the poll loop (which would double the request rate).
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!jobId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    let attempt = 0
    // Transient network blips shouldn't kill a render the server is still
    // working on — only give up after several consecutive failures.
    let consecutiveFailures = 0
    const MAX_FAILURES = 5

    const tick = () => {
      void pollJob(jobId, controller.signal).then((result) => {
        if (cancelled) return

        if (!result.ok) {
          if (result.code === 'aborted') return
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_FAILURES) {
            setTracked({ jobId, status: 'failed', progress: 0, error: result.error })
            return
          }
          timer = setTimeout(tick, delayForAttempt(++attempt))
          return
        }

        consecutiveFailures = 0
        setTracked({
          jobId,
          status: result.status,
          progress: result.progress,
          error: result.error?.message ?? null,
        })

        if (result.status === 'queued' || result.status === 'processing') {
          timer = setTimeout(tick, delayForAttempt(++attempt))
          return
        }
        onCompleteRef.current?.(result)
      })
    }

    tick()

    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [jobId])

  const cancel = useCallback(async () => {
    if (!jobId) return
    const result = await cancelGeneration(jobId)
    setTracked((prev) =>
      result.ok
        ? { jobId, status: 'cancelled', progress: prev?.progress ?? 0, error: null }
        : { jobId, status: prev?.status ?? null, progress: prev?.progress ?? 0, error: result.error },
    )
  }, [jobId])

  const current = tracked?.jobId === jobId ? tracked : null
  const status = current?.status ?? null

  return {
    status,
    progress: current?.progress ?? 0,
    error: current?.error ?? null,
    isActive: status === 'queued' || status === 'processing',
    cancel,
  }
}
