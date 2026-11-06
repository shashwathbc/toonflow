// Browser-side client for the Anime Studio API routes.
//
// Every call goes through the app's own /api surface — the browser never talks
// to an AI vendor directly, so no provider key is ever present in the bundle.
// Errors are returned as values (never thrown) with the server's machine-
// readable `code` intact, so the UI can distinguish "not connected yet" from
// "you hit your quota" from "that failed, try again".
import type { GenerationJobStatus, GenerationSettings, StoryboardBeat } from '@/types/anime'

export interface ApiFailure {
  ok: false
  status: number
  code?: string
  error: string
}
export type ApiResult<T> = ({ ok: true } & T) | ApiFailure

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data.code === 'string' ? data.code : undefined,
        error: typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.',
      }
    }
    return { ok: true, ...(data as T) }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, status: 0, code: 'aborted', error: 'Request cancelled.' }
    }
    return { ok: false, status: 0, code: 'network', error: 'Network error — check your connection and try again.' }
  }
}

export function startGeneration(input: {
  projectId: string
  sceneId: string
  settings: GenerationSettings
  intent?: 'generate' | 'regenerate' | 'extend'
}) {
  return postJson<{ jobId: string; duplicate: boolean }>('/api/anime/jobs', input)
}

export interface JobStatus {
  jobId: string
  status: GenerationJobStatus
  progress: number
  error: { code: string; message: string } | null
  sceneId: string
  projectId: string
}

/**
 * Poll one job. This request is also what DRIVES it: the route submits a queued
 * job or asks the vendor for progress, so a client that stops polling simply
 * stops advancing — nothing is lost, and the next poll picks up where it left
 * off (including from another device).
 */
export async function pollJob(jobId: string, signal?: AbortSignal): Promise<ApiResult<JobStatus>> {
  try {
    const res = await fetch(`/api/anime/jobs/${encodeURIComponent(jobId)}`, { signal, cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data.code === 'string' ? data.code : undefined,
        error: typeof data.error === 'string' ? data.error : 'Could not read generation status.',
      }
    }
    return { ok: true, ...(data as JobStatus) }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, status: 0, code: 'aborted', error: 'Cancelled.' }
    }
    return { ok: false, status: 0, code: 'network', error: 'Network error while checking progress.' }
  }
}

export async function cancelGeneration(jobId: string): Promise<ApiResult<{ cancelled?: boolean }>> {
  try {
    const res = await fetch(`/api/anime/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error ?? 'Could not cancel that job.' }
    }
    return { ok: true, cancelled: true }
  } catch {
    return { ok: false, status: 0, code: 'network', error: 'Network error while cancelling.' }
  }
}

export function requestStoryboard(input: {
  projectId: string
  story: string
  targetDurationSec: number
  animeStyle: string
  sceneCount?: number
}) {
  return postJson<{ beats: StoryboardBeat[] }>('/api/anime/storyboard', input)
}

/**
 * Exchange a scene for a SHORT-LIVED playback URL. The caller must treat the
 * result as perishable — cache it against `expiresAt`, never persist it, and
 * never put it in a link the user could share (it is a bearer credential for
 * the duration of its life).
 */
export function signSceneAsset(input: { projectId: string; sceneId: string; kind?: 'video' | 'poster' }) {
  return postJson<{ url: string; expiresAt: number }>('/api/anime/assets', input)
}
