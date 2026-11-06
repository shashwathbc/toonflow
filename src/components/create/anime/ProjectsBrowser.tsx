'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Clapperboard, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAnimeProjects } from '@/hooks/useAnimeProjects'
import Skeleton from '@/components/ui/Skeleton'
import Modal from '@/components/ui/Modal'
import ProjectCard from './ProjectCard'
import NewProjectDialog from './NewProjectDialog'
import CharacterManager from './CharacterManager'
import { deleteAnimeProject, duplicateAnimeProject, updateAnimeProject } from '@/lib/firebase/anime'
import type { AnimeProject, AnimeProjectStatus } from '@/types/anime'

const FILTERS: { id: 'all' | AnimeProjectStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
]

export default function ProjectsBrowser() {
  const router = useRouter()
  const { firebaseUser, userProfile } = useAuth()
  const { projects, loading, error } = useAnimeProjects()

  const [filter, setFilter] = useState<'all' | AnimeProjectStatus>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [renaming, setRenaming] = useState<AnimeProject | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<AnimeProject | null>(null)
  const [busy, setBusy] = useState(false)

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return projects.filter((project) => {
      if (filter !== 'all' && project.status !== filter) return false
      if (!needle) return true
      return (
        project.title.toLowerCase().includes(needle) ||
        project.description.toLowerCase().includes(needle)
      )
    })
  }, [projects, filter, search])

  // Plain functions, not useCallback: the React Compiler can't preserve manual
  // memoization around an async body with try/finally, and memoizes handlers
  // itself.
  const handleDuplicate = async (project: AnimeProject) => {
    if (!firebaseUser) return
    setBusy(true)
    const pending = toast.loading('Duplicating project…')
    try {
      const id = await duplicateAnimeProject(firebaseUser.uid, userProfile?.displayName ?? 'Creator', project)
      toast.success('Project duplicated', { id: pending })
      router.push(`/create/anime/project/${id}`)
    } catch {
      toast.error('Could not duplicate that project', { id: pending })
    } finally {
      setBusy(false)
    }
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
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text lg:text-3xl">My Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Every anime project you&apos;ve started, newest first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-studio-anime px-4 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Plus size={16} aria-hidden="true" />
          New project
        </button>
      </header>

      {/* Filters + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="tablist"
          aria-label="Filter projects by status"
          className="flex gap-1 overflow-x-auto rounded-xl border border-bg-border bg-bg-card p-1"
        >
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                filter === item.id
                  ? 'bg-studio-anime/12 text-studio-anime'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <label htmlFor="project-search" className="sr-only">
            Search your projects
          </label>
          <input
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
            className="input-base w-full pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
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
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-16 text-center">
          <Clapperboard size={32} className="text-text-muted" aria-hidden="true" />
          <h2 className="mt-4 text-base font-bold text-text">
            {projects.length === 0 ? 'No projects yet' : 'Nothing matches that'}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
            {projects.length === 0
              ? 'Start a project to write scenes, plan a storyboard and generate clips.'
              : 'Try a different search or filter.'}
          </p>
          {projects.length === 0 && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-studio-anime px-4 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Plus size={16} aria-hidden="true" />
              New project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((project) => (
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

      <div className="mt-14 border-t border-bg-border pt-10">
        <CharacterManager />
      </div>

      <NewProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} template={null} />

      <Modal open={renaming !== null} onClose={() => setRenaming(null)} title="Rename project">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleRename()
          }}
        >
          <label htmlFor="rename-project-input" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Project name
          </label>
          <input
            id="rename-project-input"
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
