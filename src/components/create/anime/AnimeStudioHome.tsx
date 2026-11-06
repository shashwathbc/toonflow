'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Clapperboard,
  FolderOpen,
  LayoutTemplate,
  Play,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAnimeProjects } from '@/hooks/useAnimeProjects'
import Skeleton from '@/components/ui/Skeleton'
import Modal from '@/components/ui/Modal'
import GenerationNotice from './GenerationNotice'
import ProjectCard from './ProjectCard'
import NewProjectDialog from './NewProjectDialog'
import { ANIME_TEMPLATES, type AnimeTemplate } from '@/lib/anime/templates'
import { deleteAnimeProject, duplicateAnimeProject, updateAnimeProject } from '@/lib/firebase/anime'
import type { AnimeProject } from '@/types/anime'

/** One of the five entry points on the landing card. */
function ActionTile({
  href,
  onClick,
  icon,
  title,
  subtitle,
  primary,
}: {
  href?: string
  onClick?: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  primary?: boolean
}) {
  const className = primary
    ? 'group flex items-center gap-3 rounded-2xl bg-studio-anime p-4 text-left text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
    : 'group flex items-center gap-3 rounded-2xl border border-bg-border bg-bg-card p-4 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime'

  const content = (
    <>
      <span className={primary ? 'shrink-0' : 'shrink-0 text-studio-anime'} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${primary ? '' : 'text-text'}`}>{title}</span>
        <span className={`block truncate text-xs ${primary ? 'opacity-80' : 'text-text-secondary'}`}>
          {subtitle}
        </span>
      </span>
      <ArrowRight
        size={15}
        className="ml-auto shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden="true"
      />
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

export default function AnimeStudioHome({ providerConnected }: { providerConnected: boolean }) {
  const router = useRouter()
  const { firebaseUser, userProfile } = useAuth()
  const { projects, loading, error } = useAnimeProjects()

  const [createOpen, setCreateOpen] = useState(false)
  const [seedTemplate, setSeedTemplate] = useState<AnimeTemplate | null>(null)
  const [renaming, setRenaming] = useState<AnimeProject | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<AnimeProject | null>(null)
  const [busy, setBusy] = useState(false)

  const recent = useMemo(() => projects.slice(0, 6), [projects])
  // "Continue editing" is the most recently touched project that has anything
  // in it — sending someone back to an empty shell isn't continuing anything.
  const continueProject = useMemo(() => projects.find((p) => p.sceneCount > 0) ?? projects[0], [projects])

  const openTemplate = (template: AnimeTemplate) => {
    setSeedTemplate(template)
    setCreateOpen(true)
  }

  const handleRename = async () => {
    if (!renaming) return
    const title = renameValue.trim()
    if (!title) return
    setBusy(true)
    try {
      await updateAnimeProject(renaming.id, { title: title.slice(0, 120) })
      toast.success('Project renamed')
      setRenaming(null)
    } catch {
      toast.error('Could not rename the project')
    } finally {
      setBusy(false)
    }
  }

  // Plain function, not useCallback: the React Compiler can't preserve manual
  // memoization around an async body with try/finally, and it memoizes event
  // handlers automatically anyway. (Same for the other async handlers here.)
  const handleDuplicate = async (project: AnimeProject) => {
    if (!firebaseUser) return
    setBusy(true)
    const pending = toast.loading('Duplicating project…')
    try {
      const id = await duplicateAnimeProject(
        firebaseUser.uid,
        userProfile?.displayName ?? 'Creator',
        project,
      )
      toast.success('Project duplicated', { id: pending })
      router.push(`/create/anime/project/${id}`)
    } catch {
      toast.error('Could not duplicate that project', { id: pending })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteAnimeProject(deleting.id)
      toast.success('Project deleted')
      setDeleting(null)
    } catch {
      toast.error('Could not delete that project')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* ── Landing card ─────────────────────────────────── */}
      {/* Flat tonal surface, Material-style — no blur glows. Depth comes from the
          surface step and a hairline border, not from light bloom. */}
      <section
        className="rounded-3xl border border-bg-border bg-bg-card p-6 sm:p-9 lg:p-12"
        aria-labelledby="anime-studio-heading"
      >
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-studio-anime/25 px-3 py-1 text-xs font-semibold text-studio-anime">
              <Sparkles size={12} aria-hidden="true" />
              AI Video Creation
            </p>
            <h1
              id="anime-studio-heading"
              className="text-3xl font-black tracking-tight text-text sm:text-4xl lg:text-5xl"
            >
              Anime Studio
            </h1>
            <p className="mt-2 text-base font-semibold text-studio-anime lg:text-lg">
              Create anime videos with AI
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary lg:text-base">
              Turn your ideas into anime scenes, stories, trailers, shorts, and cinematic sequences
              using AI. Build a project, generate as many clips as you need, then cut them together
              on a real multi-track timeline.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <ActionTile
              primary
              onClick={() => {
                setSeedTemplate(null)
                setCreateOpen(true)
              }}
              icon={<Plus size={20} />}
              title="Create Video"
              subtitle="Start a new project from a prompt"
            />
            <ActionTile
              href="/create/anime/projects"
              icon={<FolderOpen size={20} />}
              title="My Projects"
              subtitle={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
            />
            {continueProject ? (
              <ActionTile
                href={`/create/anime/editor/${continueProject.id}`}
                icon={<Play size={20} />}
                title="Continue Editing"
                subtitle={continueProject.title}
              />
            ) : (
              <ActionTile
                href="/create/anime/projects"
                icon={<Play size={20} />}
                title="Continue Editing"
                subtitle="Nothing in progress yet"
              />
            )}
            <ActionTile
              href="/create/anime/projects#characters"
              icon={<Users size={20} />}
              title="Characters"
              subtitle="Reusable casts for consistency"
            />
          </div>
        </div>
      </section>

      <div className="mt-6">
        <GenerationNotice connected={providerConnected} />
      </div>

      {/* ── Recent projects ──────────────────────────────── */}
      <section className="mt-10" aria-labelledby="recent-projects-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="recent-projects-heading" className="text-lg font-bold text-text lg:text-xl">
            Recent Projects
          </h2>
          {projects.length > 0 && (
            <Link
              href="/create/anime/projects"
              className="rounded text-sm font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View all
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-bg-border bg-bg-card">
                <Skeleton className="aspect-video w-full rounded-none" aria-label="Loading project…" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-14 text-center">
            <Clapperboard size={32} className="text-text-muted" aria-hidden="true" />
            <h3 className="mt-4 text-base font-bold text-text">No projects yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
              A project holds all the clips for one story. Start with a blank prompt or pick a template
              below.
            </p>
            <button
              type="button"
              onClick={() => {
                setSeedTemplate(null)
                setCreateOpen(true)
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-studio-anime px-4 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Plus size={16} aria-hidden="true" />
              Create your first video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                actions={{
                  onRename: (p) => {
                    setRenaming(p)
                    setRenameValue(p.title)
                  },
                  onDuplicate: handleDuplicate,
                  onDelete: setDeleting,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Templates ────────────────────────────────────── */}
      <section className="mt-12" aria-labelledby="templates-heading">
        <div className="mb-4 flex items-center gap-2">
          <LayoutTemplate size={18} className="text-studio-anime" aria-hidden="true" />
          <h2 id="templates-heading" className="text-lg font-bold text-text lg:text-xl">
            Templates
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {ANIME_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => openTemplate(template)}
              className="group flex h-full flex-col rounded-xl border border-bg-border bg-bg-card p-4 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
            >
              <span className="text-sm font-bold text-text">{template.label}</span>
              <span className="mt-1.5 flex-1 text-xs leading-relaxed text-text-secondary">
                {template.description}
              </span>
              <span className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-studio-anime">
                {template.scenes.length} {template.scenes.length === 1 ? 'scene' : 'scenes'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <NewProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        template={seedTemplate}
      />

      {/* Rename */}
      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename project"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleRename()
          }}
        >
          <label htmlFor="rename-project" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Project name
          </label>
          <input
            id="rename-project"
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
            <button type="submit" disabled={busy || !renameValue.trim()} className="btn-accent px-4 py-2 text-sm">
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation — destructive, so it always asks. */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete project?"
        description={
          deleting
            ? `“${deleting.title}” and its ${deleting.sceneCount} ${deleting.sceneCount === 1 ? 'scene' : 'scenes'} will be permanently deleted. This can't be undone.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDeleting(null)} className="btn-ghost px-4 py-2 text-sm">
            Keep project
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="btn-danger px-4 py-2 text-sm"
          >
            Delete permanently
          </button>
        </div>
      </Modal>
    </div>
  )
}
