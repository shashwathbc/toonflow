'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Film, Globe, Plus, Sparkles, Wand2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import GenerationNotice from './GenerationNotice'
import PromptComposer from './PromptComposer'
import SceneCard from './SceneCard'
import StoryboardDialog from './StoryboardDialog'
import PublishProjectDialog from './PublishProjectDialog'
import {
  createScene,
  defaultSettings,
  deleteScene,
  getAnimeProject,
  reorderScenes,
  subscribeToCharacters,
  subscribeToScenes,
  syncProjectTotals,
  updateScene,
} from '@/lib/firebase/anime'
import { cancelGeneration, signSceneAsset, startGeneration } from '@/lib/anime/client'
import { track } from '@/lib/analytics/events'
import type { EntitlementTier } from '@/lib/anime/limits'
import type { AnimeCharacter, AnimeProject, AnimeScene, GenerationSettings, StoryboardBeat } from '@/types/anime'

/** How often a scene's in-flight job is polled, in ms. */
const JOB_POLL_MS = 2500

export default function ProjectWorkspace({
  projectId,
  providerConnected,
  tier,
}: {
  projectId: string
  providerConnected: boolean
  tier: EntitlementTier
}) {
  const router = useRouter()
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null

  const [project, setProject] = useState<AnimeProject | null>(null)
  const [scenes, setScenes] = useState<AnimeScene[]>([])
  const [characters, setCharacters] = useState<AnimeCharacter[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [composer, setComposer] = useState<GenerationSettings | null>(null)
  const [editingScene, setEditingScene] = useState<AnimeScene | null>(null)
  const [editingSettings, setEditingSettings] = useState<GenerationSettings | null>(null)
  const [renaming, setRenaming] = useState<AnimeScene | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<AnimeScene | null>(null)
  const [storyboardOpen, setStoryboardOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /** sceneId → live progress, driven by the poll loop below. */
  const [progress, setProgress] = useState<Record<string, number>>({})
  /** sceneId → jobId for anything currently in flight. */
  const activeJobs = useRef<Map<string, string>>(new Map())

  // ── Load ────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    void getAnimeProject(projectId).then((data) => {
      if (!active) return
      if (!data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setProject(data)
      setComposer(defaultSettings(data.defaults))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [projectId])

  useEffect(() => {
    return subscribeToScenes(projectId, setScenes, (err) => {
      console.error('[ProjectWorkspace] scenes', err)
      toast.error('Could not load scenes')
    })
  }, [projectId])

  useEffect(() => {
    if (!uid) return
    return subscribeToCharacters(uid, setCharacters)
  }, [uid])

  // ── Job polling ─────────────────────────────────────────
  // One interval for the whole page rather than a hook per card: a project with
  // twenty scenes would otherwise open twenty independent poll loops, and every
  // poll costs a vendor status call. Scenes are the source of truth for status
  // (the server writes it), so this only has to drive the progress numbers.
  useEffect(() => {
    const inFlight = scenes.filter(
      (scene) => (scene.status === 'queued' || scene.status === 'processing') && scene.generationJobId,
    )
    for (const scene of inFlight) {
      if (scene.generationJobId) activeJobs.current.set(scene.id, scene.generationJobId)
    }
    for (const [sceneId] of activeJobs.current) {
      if (!inFlight.some((scene) => scene.id === sceneId)) activeJobs.current.delete(sceneId)
    }
    if (inFlight.length === 0) return

    let cancelled = false
    const controller = new AbortController()

    const poll = async () => {
      const { pollJob } = await import('@/lib/anime/client')
      const entries = Array.from(activeJobs.current.entries())
      const results = await Promise.all(
        entries.map(([, jobId]) => pollJob(jobId, controller.signal)),
      )
      if (cancelled) return
      setProgress((prev) => {
        const next = { ...prev }
        results.forEach((result, index) => {
          if (result.ok) next[entries[index][0]] = result.progress
        })
        return next
      })
    }

    void poll()
    const timer = setInterval(() => void poll(), JOB_POLL_MS)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
    }
  }, [scenes])

  // ── Actions ─────────────────────────────────────────────
  const addScene = useCallback(
    async (settings: GenerationSettings, title?: string) => {
      if (!uid || !project) return null
      const sceneId = await createScene(projectId, uid, {
        title: title ?? `Scene ${String(scenes.length + 1).padStart(2, '0')}`,
        prompt: settings.prompt,
        settings,
        order: scenes.length,
      })
      return sceneId
    },
    [uid, project, projectId, scenes.length],
  )

  const runGeneration = useCallback(
    async (scene: AnimeScene, intent: 'generate' | 'regenerate' | 'extend') => {
      setSubmitting(true)
      track('generate_video_started', {
        projectId,
        sceneId: scene.id,
        intent,
        durationSec: scene.settings.durationSec,
        resolution: scene.settings.resolution,
      })

      const result = await startGeneration({
        projectId,
        sceneId: scene.id,
        settings: { ...scene.settings, prompt: scene.prompt || scene.settings.prompt },
        intent,
      })
      setSubmitting(false)

      if (!result.ok) {
        track('generate_video_failed', { projectId, sceneId: scene.id, errorCode: result.code ?? 'unknown' })
        // The provider-not-connected case gets a longer, explanatory toast: it
        // isn't the creator's mistake and there's nothing for them to retry.
        toast.error(result.error, { duration: result.code === 'provider_not_configured' ? 8000 : 5000 })
        return
      }
      if (result.duplicate) {
        toast('That generation is already running', { icon: '⏳' })
        return
      }
      activeJobs.current.set(scene.id, result.jobId)
      toast.success('Generation queued')
    },
    [projectId],
  )

  const handleCreateAndGenerate = useCallback(async () => {
    if (!composer) return
    if (!composer.prompt.trim()) {
      toast.error('Describe the scene first')
      return
    }
    setSubmitting(true)
    try {
      const sceneId = await addScene(composer)
      if (!sceneId) return
      // Re-read the scene we just wrote rather than constructing one locally, so
      // generation always submits the persisted state (and inherits the server's
      // view of ownership).
      const created: AnimeScene = {
        id: sceneId,
        projectId,
        ownerId: uid ?? '',
        title: `Scene ${String(scenes.length + 1).padStart(2, '0')}`,
        prompt: composer.prompt,
        settings: composer,
        generationJobId: null,
        status: 'idle',
        storageKey: null,
        posterKey: null,
        durationSec: 0,
        order: scenes.length,
        metadata: {},
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      }
      await runGeneration(created, 'generate')
      setComposer((prev) => (prev ? { ...prev, prompt: '' } : prev))
    } catch (err) {
      console.error('[ProjectWorkspace] create+generate', err)
      toast.error('Could not create that scene')
    } finally {
      setSubmitting(false)
    }
  }, [composer, addScene, projectId, uid, scenes.length, runGeneration])

  const handleAddSceneOnly = useCallback(async () => {
    if (!composer?.prompt.trim()) {
      toast.error('Describe the scene first')
      return
    }
    try {
      await addScene(composer)
      toast.success('Scene added')
      setComposer((prev) => (prev ? { ...prev, prompt: '' } : prev))
    } catch {
      toast.error('Could not add that scene')
    }
  }, [composer, addScene])

  const handleCancel = useCallback(async (scene: AnimeScene) => {
    const jobId = scene.generationJobId
    if (!jobId) return
    const result = await cancelGeneration(jobId)
    if (result.ok) {
      track('generate_video_cancelled', { sceneId: scene.id })
      toast.success('Generation cancelled')
    } else {
      toast.error(result.error)
    }
  }, [])

  const handleDownload = useCallback(
    async (scene: AnimeScene) => {
      const result = await signSceneAsset({ projectId, sceneId: scene.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // Navigate rather than fetch-and-blob: the signed URL is short-lived and a
      // direct hit lets the browser stream it straight to disk.
      const link = document.createElement('a')
      link.href = result.url
      link.download = `${scene.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      track('video_exported', { projectId, sceneId: scene.id, surface: 'scene-download' })
    },
    [projectId],
  )

  const handleMove = useCallback(
    async (scene: AnimeScene, direction: -1 | 1) => {
      const index = scenes.findIndex((item) => item.id === scene.id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= scenes.length) return
      const next = [...scenes]
      ;[next[index], next[target]] = [next[target], next[index]]
      setScenes(next) // optimistic — the listener reconciles
      try {
        await reorderScenes(projectId, next.map((item) => item.id))
      } catch {
        toast.error('Could not reorder scenes')
      }
    },
    [scenes, projectId],
  )

  const handleDuplicateScene = useCallback(
    async (scene: AnimeScene) => {
      if (!uid) return
      try {
        await createScene(projectId, uid, {
          title: `${scene.title} (copy)`.slice(0, 120),
          prompt: scene.prompt,
          settings: scene.settings,
          order: scenes.length,
        })
        toast.success('Scene duplicated')
      } catch {
        toast.error('Could not duplicate that scene')
      }
    },
    [uid, projectId, scenes.length],
  )

  const handleAcceptStoryboard = useCallback(
    async (beats: StoryboardBeat[]) => {
      if (!uid || !project) return
      const base = defaultSettings(project.defaults)
      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i]
        await createScene(projectId, uid, {
          title: beat.title,
          prompt: beat.prompt,
          settings: {
            ...base,
            prompt: beat.prompt,
            durationSec: beat.durationSec,
            cameraMovement: beat.cameraMovement,
            mood: beat.mood,
          },
          order: scenes.length + i,
        })
      }
    },
    [uid, project, projectId, scenes.length],
  )

  const totalDuration = useMemo(
    () => scenes.reduce((sum, scene) => sum + (scene.durationSec || scene.settings.durationSec), 0),
    [scenes],
  )

  // Keep the project's denormalized totals honest. Generation writes each
  // scene's real `durationSec` server-side, so the parent document can only
  // learn the new total from a client that is already listening to the scenes.
  // The ref guard stops the write from re-triggering itself through the
  // project listener.
  const lastSynced = useRef<string>('')
  useEffect(() => {
    if (!project || scenes.length === 0) return
    const generated = scenes.reduce((sum, scene) => sum + scene.durationSec, 0)
    const signature = `${scenes.length}:${generated.toFixed(1)}`
    if (lastSynced.current === signature) return
    const drifted =
      scenes.length !== project.sceneCount || Math.abs(generated - project.durationSec) >= 0.5
    if (!drifted) return
    lastSynced.current = signature
    void syncProjectTotals(projectId, scenes.length, generated).catch(() => undefined)
  }, [scenes, project, projectId])

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-text">Project not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          It may have been deleted, or it belongs to another account.
        </p>
        <Link href="/create/anime/projects" className="btn-accent mt-6 inline-flex px-4 py-2 text-sm">
          Back to projects
        </Link>
      </div>
    )
  }

  if (loading || !project || !composer) {
    return (
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-64" aria-label="Loading project…" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/create/anime/projects"
          className="mb-3 inline-flex items-center gap-1.5 rounded text-xs font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          All projects
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-text lg:text-3xl">
              {project.title}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} ·{' '}
              <span className="tabular-nums">{Math.round(totalDuration)}s</span> ·{' '}
              {scenes.filter((scene) => scene.status === 'ready').length} generated
              {project.status === 'published' && (
                <>
                  {' · '}
                  <Link
                    href={`/anime/${projectId}`}
                    className="font-medium text-success underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Live in Browse
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStoryboardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-bg-border px-3.5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-studio-anime/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
            >
              <Wand2 size={15} aria-hidden="true" />
              AI Storyboard
            </button>
            <Link
              href={`/create/anime/editor/${projectId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-bg-border px-3.5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-studio-anime/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
            >
              <Film size={15} aria-hidden="true" />
              Open editor
            </Link>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-studio-anime px-3.5 py-2 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Globe size={15} aria-hidden="true" />
              {project.status === 'published' ? 'Manage listing' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <GenerationNotice connected={providerConnected} />
      </div>

      {/* ── Step 1: Prompt ───────────────────────────────── */}
      <section
        className="rounded-2xl border border-bg-border bg-bg-card p-5 lg:p-6"
        aria-labelledby="new-scene-heading"
      >
        <h2 id="new-scene-heading" className="mb-4 flex items-center gap-2 text-base font-bold text-text">
          <Sparkles size={17} className="text-studio-anime" aria-hidden="true" />
          New scene
        </h2>
        <PromptComposer
          settings={composer}
          onChange={setComposer}
          characters={characters}
          tier={tier}
          footer={
            <>
              <button
                type="button"
                onClick={() => void handleCreateAndGenerate()}
                disabled={submitting || !composer.prompt.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-studio-anime px-5 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                <Sparkles size={16} aria-hidden="true" />
                {submitting ? 'Working…' : 'Generate'}
              </button>
              <button
                type="button"
                onClick={() => void handleAddSceneOnly()}
                disabled={!composer.prompt.trim()}
                className="inline-flex items-center gap-2 rounded-xl border border-bg-border px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Plus size={15} aria-hidden="true" />
                Add without generating
              </button>
            </>
          }
        />
      </section>

      {/* ── Scene library ────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="scenes-heading">
        <h2 id="scenes-heading" className="mb-4 text-lg font-bold text-text lg:text-xl">
          Scenes
        </h2>

        {scenes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-14 text-center">
            <Film size={30} className="mx-auto text-text-muted" aria-hidden="true" />
            <h3 className="mt-4 text-base font-bold text-text">No scenes yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-secondary">
              Write a prompt above, or let AI Storyboard break a story into scenes for you. You can keep
              adding clips to this same project — no need to start over.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                projectId={projectId}
                scene={scene}
                index={index}
                total={scenes.length}
                progress={progress[scene.id]}
                actions={{
                  onGenerate: (target, intent) => void runGeneration(target, intent),
                  onCancel: (target) => void handleCancel(target),
                  onEdit: (target) => {
                    setEditingScene(target)
                    setEditingSettings({ ...target.settings, prompt: target.prompt })
                  },
                  onRename: (target) => {
                    setRenaming(target)
                    setRenameValue(target.title)
                  },
                  onDuplicate: (target) => void handleDuplicateScene(target),
                  onDelete: setDeleting,
                  onDownload: (target) => void handleDownload(target),
                  onAddToTimeline: () => router.push(`/create/anime/editor/${projectId}`),
                  onMove: (target, direction) => void handleMove(target, direction),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Edit scene */}
      <Modal
        open={editingScene !== null}
        onClose={() => setEditingScene(null)}
        title={editingScene ? `Edit ${editingScene.title}` : 'Edit scene'}
        className="max-w-3xl"
      >
        {editingSettings && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PromptComposer
              settings={editingSettings}
              onChange={setEditingSettings}
              characters={characters}
              tier={tier}
              compact
            />
            <div className="mt-5 flex justify-end gap-2 border-t border-bg-border pt-4">
              <button type="button" onClick={() => setEditingScene(null)} className="btn-ghost px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editingScene || !editingSettings) return
                  try {
                    await updateScene(projectId, editingScene.id, {
                      prompt: editingSettings.prompt,
                      settings: editingSettings,
                    })
                    toast.success('Scene updated')
                    setEditingScene(null)
                  } catch {
                    toast.error('Could not save that scene')
                  }
                }}
                className="btn-accent px-4 py-2 text-sm"
              >
                Save changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Rename scene */}
      <Modal open={renaming !== null} onClose={() => setRenaming(null)} title="Rename scene">
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (!renaming || !renameValue.trim()) return
            try {
              await updateScene(projectId, renaming.id, { title: renameValue.trim().slice(0, 120) })
              toast.success('Scene renamed')
              setRenaming(null)
            } catch {
              toast.error('Could not rename that scene')
            }
          }}
        >
          <label htmlFor="rename-scene" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Scene name
          </label>
          <input
            id="rename-scene"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            maxLength={120}
            className="input-base w-full"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setRenaming(null)} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={!renameValue.trim()} className="btn-accent px-4 py-2 text-sm">
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete scene */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete scene?"
        description={
          deleting
            ? `“${deleting.title}” will be permanently deleted${deleting.storageKey ? ', including its generated clip' : ''}. This can't be undone.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDeleting(null)} className="btn-ghost px-4 py-2 text-sm">
            Keep scene
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!deleting) return
              try {
                await deleteScene(projectId, deleting.id)
                toast.success('Scene deleted')
              } catch {
                toast.error('Could not delete that scene')
              } finally {
                setDeleting(null)
              }
            }}
            className="btn-danger px-4 py-2 text-sm"
          >
            Delete permanently
          </button>
        </div>
      </Modal>

      <StoryboardDialog
        open={storyboardOpen}
        onClose={() => setStoryboardOpen(false)}
        projectId={projectId}
        animeStyle={project.defaults.animeStyle}
        onAccept={handleAcceptStoryboard}
      />

      <PublishProjectDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        project={project}
        scenes={scenes}
        // Publication state is server-written, so re-read the project rather
        // than patching it locally — that keeps the badge honest.
        onPublished={() => {
          void getAnimeProject(projectId).then((fresh) => {
            if (fresh) setProject(fresh)
          })
        }}
      />
    </div>
  )
}
