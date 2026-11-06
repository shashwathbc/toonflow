'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import Modal from '@/components/ui/Modal'
import {
  createAnimeProject,
  createScene,
  defaultSettings,
  DEFAULT_PROJECT_DEFAULTS,
} from '@/lib/firebase/anime'
import { ANIME_STYLES, ASPECT_RATIOS } from '@/lib/anime/presets'
import type { AnimeTemplate } from '@/lib/anime/templates'
import { track } from '@/lib/analytics/events'
import type { AspectRatio } from '@/types/anime'

/**
 * Create a project, optionally seeded from a template.
 *
 * A template only pre-fills PROMPTS and preset choices — the scenes it creates
 * start in `idle` with no clip attached, exactly like ones typed by hand.
 * Nothing is generated here.
 */
export default function NewProjectDialog({
  open,
  onClose,
  template,
}: {
  open: boolean
  onClose: () => void
  template: AnimeTemplate | null
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? `New project — ${template.label}` : 'New anime project'}
      description={
        template
          ? `${template.scenes.length} scene prompts will be added for you. Nothing is generated until you choose to.`
          : 'A project holds every clip for one story. You can add as many scenes as you need.'
      }
      className="max-w-lg"
    >
      {/* Keyed + conditionally mounted so the form REMOUNTS with fresh state
          whenever the dialog opens or the template changes. React's recommended
          way to reset state on a prop change — an effect that re-seeds fields
          would be a synchronous setState inside an effect body. */}
      {open && (
        <NewProjectForm key={template?.id ?? 'blank'} template={template} onClose={onClose} />
      )}
    </Modal>
  )
}

function NewProjectForm({
  template,
  onClose,
}: {
  template: AnimeTemplate | null
  onClose: () => void
}) {
  const router = useRouter()
  const { firebaseUser, userProfile } = useAuth()

  // Seeded once from the template at mount — no effect needed.
  const [title, setTitle] = useState(template?.projectTitle ?? '')
  const [description, setDescription] = useState('')
  const [animeStyle, setAnimeStyle] = useState<string>(
    template?.settings.animeStyle ?? DEFAULT_PROJECT_DEFAULTS.animeStyle,
  )
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    template?.settings.aspectRatio ?? DEFAULT_PROJECT_DEFAULTS.aspectRatio,
  )
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !firebaseUser) return

    setSubmitting(true)
    try {
      const defaults = { ...DEFAULT_PROJECT_DEFAULTS, animeStyle, aspectRatio }
      const projectId = await createAnimeProject(
        firebaseUser.uid,
        userProfile?.displayName ?? 'Creator',
        { title: trimmed.slice(0, 120), description: description.trim().slice(0, 2000), defaults },
      )

      if (template) {
        const base = defaultSettings(defaults)
        // Sequential rather than parallel: each createScene also bumps the
        // project's sceneCount in a transaction, and firing them all at once
        // would make those transactions contend on one document.
        for (let i = 0; i < template.scenes.length; i++) {
          const scene = template.scenes[i]
          await createScene(projectId, firebaseUser.uid, {
            title: scene.title,
            prompt: scene.prompt,
            settings: {
              ...base,
              ...template.settings,
              prompt: scene.prompt,
              durationSec: scene.durationSec,
              cameraMovement: scene.cameraMovement,
              aspectRatio,
              animeStyle,
            },
            order: i,
          })
        }
      }

      track('create_anime_project', {
        projectId,
        aspectRatio,
        sceneCount: template?.scenes.length ?? 0,
        surface: template ? 'template' : 'blank',
      })

      toast.success('Project created')
      onClose()
      router.push(`/create/anime/project/${projectId}`)
    } catch (err) {
      console.error('[NewProjectDialog]', err)
      toast.error('Could not create that project. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="project-title" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Project name
          </label>
          <input
            id="project-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="My Anime Story"
            className="input-base w-full"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="project-description" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Description <span className="text-text-muted">(optional)</span>
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="What is this story about?"
            className="input-base w-full resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project-style" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Anime style
            </label>
            <select
              id="project-style"
              value={animeStyle}
              onChange={(event) => setAnimeStyle(event.target.value)}
              className="input-base w-full"
            >
              {ANIME_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-aspect" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Aspect ratio
            </label>
            <select
              id="project-aspect"
              value={aspectRatio}
              onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
              className="input-base w-full"
            >
              {ASPECT_RATIOS.map((ratio) => (
                <option key={ratio.id} value={ratio.id}>
                  {ratio.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          These become the defaults for every new scene. You can override them per scene later.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={submitting || !title.trim()} className="btn-accent px-4 py-2 text-sm">
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
    </form>
  )
}
