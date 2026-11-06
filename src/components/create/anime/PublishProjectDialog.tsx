'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Check, Globe, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { GENRES } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import type { AnimeProject, AnimeScene } from '@/types/anime'

const MAX_GENRES = 5

/**
 * Take a project into the public catalog.
 *
 * The server (`/api/anime/publish`) refuses to publish a project with no
 * generated scene, so this dialog shows that requirement up front rather than
 * letting the creator fill in a form and be rejected at the end.
 */
export default function PublishProjectDialog({
  open,
  onClose,
  project,
  scenes,
  onPublished,
}: {
  open: boolean
  onClose: () => void
  project: AnimeProject
  scenes: AnimeScene[]
  onPublished: () => void
}) {
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description)
  const [genres, setGenres] = useState<string[]>(project.genres ?? [])
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const playable = scenes.filter((scene) => scene.status === 'ready' && scene.storageKey)
  const isPublished = project.status === 'published'
  const canPublish =
    playable.length > 0 && title.trim().length >= 2 && genres.length > 0 && rightsConfirmed

  const toggleGenre = (genre: string) => {
    setGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre)
      if (prev.length >= MAX_GENRES) return prev
      return [...prev, genre]
    })
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/anime/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          title: title.trim(),
          description: description.trim(),
          genres,
          visibility,
          rightsConfirmed: true,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error ?? 'Could not publish this project')
        return
      }
      toast.success('Published — your anime is live in Browse')
      onPublished()
      onClose()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const unpublish = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/anime/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, action: 'unpublish' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error ?? 'Could not unpublish this project')
        return
      }
      toast.success('Unpublished — it is private again')
      onPublished()
      onClose()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isPublished ? 'Manage publication' : 'Publish to Browse'}
      description={
        isPublished
          ? 'This title is live. Unpublishing removes it from Browse and immediately stops public playback.'
          : 'Published anime appears in Browse, on the home page and in Originals, next to novels and webtoons.'
      }
      className="max-w-lg"
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {/* The hard requirement, stated before the form. */}
        {playable.length === 0 ? (
          <div className="rounded-xl border border-warning/25 bg-warning/[0.07] p-4" role="status">
            <p className="text-sm font-semibold text-text">Nothing to play yet</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              A published title has to actually play something, so at least one scene must be generated
              first. Right now this project has {scenes.length}{' '}
              {scenes.length === 1 ? 'scene' : 'scenes'} and none of them have video.
            </p>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/[0.07] px-3.5 py-2.5 text-xs text-text-secondary">
            <Check size={13} className="shrink-0 text-success" aria-hidden="true" />
            {playable.length} {playable.length === 1 ? 'scene plays' : 'scenes play'} — viewers will watch
            them back to back.
          </p>
        )}

        <div>
          <label htmlFor="publish-title" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Title
          </label>
          <input
            id="publish-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className="input-base w-full"
          />
        </div>

        <div>
          <label
            htmlFor="publish-description"
            className="mb-1.5 block text-sm font-medium text-text-secondary"
          >
            Synopsis
          </label>
          <textarea
            id="publish-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="What happens in this story?"
            className="input-base w-full resize-none"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-secondary">
            Genres <span className="text-text-muted">({genres.length}/{MAX_GENRES})</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((genre) => {
              const selected = genres.includes(genre)
              const atLimit = !selected && genres.length >= MAX_GENRES
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  disabled={atLimit}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime',
                    selected
                      ? 'border-studio-anime/45 bg-studio-anime/15 text-studio-anime'
                      : 'border-bg-border text-text-secondary hover:text-text',
                    atLimit && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {genre.replace('-', ' ')}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-secondary">Visibility</legend>
          <div className="space-y-2">
            {(
              [
                ['public', 'Public', 'Appears in Browse, Home, Originals and search.'],
                ['unlisted', 'Unlisted', 'Only people with the link can watch. Kept out of search.'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
                  visibility === value ? 'border-studio-anime/45 bg-studio-anime/[0.07]' : 'border-bg-border',
                )}
              >
                <input
                  type="radio"
                  name="anime-visibility"
                  value={value}
                  checked={visibility === value}
                  onChange={() => setVisibility(value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-studio-anime"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">{label}</span>
                  <span className="block text-xs text-text-secondary">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-bg-border p-3">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(event) => setRightsConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-bg-border-strong bg-bg-elevated accent-studio-anime"
          />
          <span className="text-xs leading-relaxed text-text-secondary">
            I confirm this is my work and that it complies with the{' '}
            <Link
              href="/ai-policy"
              target="_blank"
              className="text-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              AI content policy
            </Link>
            .
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-bg-border pt-4">
        {isPublished && (
          <button
            type="button"
            onClick={() => void unpublish()}
            disabled={submitting}
            className="btn-ghost mr-auto px-4 py-2 text-sm text-danger"
          >
            Unpublish
          </button>
        )}
        <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canPublish || submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-studio-anime px-5 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
        >
          {submitting ? (
            <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Globe size={15} aria-hidden="true" />
          )}
          {submitting ? 'Publishing…' : isPublished ? 'Update listing' : 'Publish'}
        </button>
      </div>
    </Modal>
  )
}
