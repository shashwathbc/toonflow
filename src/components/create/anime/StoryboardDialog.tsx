'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, Wand2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { requestStoryboard } from '@/lib/anime/client'
import { ANIME_STYLES, labelOf, CAMERA_MOVEMENTS, MOOD_PRESETS } from '@/lib/anime/presets'
import { HARD_LIMITS } from '@/lib/anime/limits'
import { track } from '@/lib/analytics/events'
import type { StoryboardBeat } from '@/types/anime'

/**
 * AI Storyboard — turn one story description into a sequence of scene beats.
 *
 * This produces PLANS, not video. The creator reviews the beats, can drop any of
 * them, and only then are scenes created — still ungenerated. That separation is
 * deliberate: planning is cheap and always available, generation is expensive
 * and gated.
 */
export default function StoryboardDialog({
  open,
  onClose,
  projectId,
  animeStyle,
  onAccept,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  animeStyle: string
  onAccept: (beats: StoryboardBeat[]) => Promise<void>
}) {
  const [story, setStory] = useState('')
  const [targetDurationSec, setTargetDurationSec] = useState(60)
  const [beats, setBeats] = useState<StoryboardBeat[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  const reset = () => {
    setBeats(null)
    setSelected(new Set())
  }

  const plan = async () => {
    const trimmed = story.trim()
    if (trimmed.length < 12) {
      toast.error('Describe the story in a little more detail')
      return
    }
    setLoading(true)
    reset()
    const result = await requestStoryboard({
      projectId,
      story: trimmed,
      targetDurationSec,
      animeStyle,
    })
    setLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setBeats(result.beats)
    setSelected(new Set(result.beats.map((_, index) => index)))
    track('storyboard_generated', { projectId, sceneCount: result.beats.length })
  }

  const accept = async () => {
    if (!beats) return
    const chosen = beats.filter((_, index) => selected.has(index))
    if (chosen.length === 0) {
      toast.error('Pick at least one scene')
      return
    }
    setAdding(true)
    try {
      await onAccept(chosen)
      toast.success(`${chosen.length} ${chosen.length === 1 ? 'scene' : 'scenes'} added`)
      setStory('')
      reset()
      onClose()
    } catch {
      toast.error('Could not add those scenes')
    } finally {
      setAdding(false)
    }
  }

  const totalSelectedSec = beats
    ? beats.reduce((sum, beat, index) => (selected.has(index) ? sum + beat.durationSec : sum), 0)
    : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI Storyboard"
      description="Describe your story and AI will break it into scenes. Nothing is generated — you'll get editable prompts you can generate one at a time."
      className="max-w-2xl"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label htmlFor="storyboard-story" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Your story
          </label>
          <textarea
            id="storyboard-story"
            value={story}
            onChange={(event) => setStory(event.target.value.slice(0, HARD_LIMITS.promptMaxChars))}
            rows={4}
            placeholder="Create a 60-second anime battle between two rival warriors."
            className="input-base w-full resize-none text-sm"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="storyboard-duration" className="text-sm font-medium text-text-secondary">
              Target length
            </label>
            <span className="text-sm font-semibold tabular-nums text-text">{targetDurationSec}s</span>
          </div>
          <input
            id="storyboard-duration"
            type="range"
            min={10}
            max={300}
            step={5}
            value={targetDurationSec}
            onChange={(event) => setTargetDurationSec(Number(event.target.value))}
            className="w-full accent-studio-anime"
          />
        </div>

        <button
          type="button"
          onClick={() => void plan()}
          disabled={loading || story.trim().length < 12}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-studio-anime px-4 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Wand2 size={16} aria-hidden="true" />
          )}
          {loading ? 'Planning scenes…' : beats ? 'Plan again' : 'Plan scenes'}
        </button>

        {beats && (
          <section aria-labelledby="storyboard-results">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 id="storyboard-results" className="text-sm font-bold text-text">
                {beats.length} scenes planned
              </h3>
              <p className="text-xs tabular-nums text-text-muted">
                {selected.size} selected · {totalSelectedSec}s total
              </p>
            </div>

            <ul className="space-y-2" role="list">
              {beats.map((beat, index) => {
                const checked = selected.has(index)
                return (
                  <li key={`${beat.title}-${index}`}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                        checked
                          ? 'border-studio-anime/40 bg-studio-anime/[0.07]'
                          : 'border-bg-border hover:border-bg-border-strong'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = new Set(selected)
                          if (event.target.checked) next.add(index)
                          else next.delete(index)
                          setSelected(next)
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-bg-border-strong bg-bg-elevated accent-studio-anime"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text">{beat.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{beat.prompt}</p>
                        <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-text-muted">
                          <span className="tabular-nums">{beat.durationSec}s</span>
                          <span>{labelOf(CAMERA_MOVEMENTS, beat.cameraMovement)}</span>
                          <span>{labelOf(MOOD_PRESETS, beat.mood)}</span>
                        </p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>

            <p className="mt-3 text-xs text-text-muted">
              Style: {labelOf(ANIME_STYLES, animeStyle)}. Each scene is added as an editable prompt — generate
              them one at a time, or all together.
            </p>
          </section>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-bg-border pt-4">
        <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void accept()}
          disabled={!beats || selected.size === 0 || adding}
          className="btn-accent px-4 py-2 text-sm"
        >
          {adding ? 'Adding…' : `Add ${selected.size || ''} ${selected.size === 1 ? 'scene' : 'scenes'}`}
        </button>
      </div>
    </Modal>
  )
}
