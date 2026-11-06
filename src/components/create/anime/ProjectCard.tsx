'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Clapperboard, Clock, Copy, Film, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { AnimeProject } from '@/types/anime'
import { formatRelativeTime, fromTimestamp } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
}

const STATUS_STYLE: Record<AnimeProject['status'], string> = {
  draft: 'border-bg-border bg-bg-elevated text-text-secondary',
  published: 'border-success/25 bg-success/10 text-success',
  archived: 'border-bg-border bg-bg-elevated text-text-muted',
}

export interface ProjectCardActions {
  onRename: (project: AnimeProject) => void
  onDuplicate: (project: AnimeProject) => void
  onDelete: (project: AnimeProject) => void
}

export default function ProjectCard({
  project,
  actions,
}: {
  project: AnimeProject
  actions: ProjectCardActions
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  // serverTimestamp() resolves to null on the local echo of a fresh write, so
  // guard before formatting — otherwise a just-created project throws here.
  const updated = project.updatedAt?.seconds ? fromTimestamp(project.updatedAt) : null

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-card transition-colors',
        'hover:border-studio-anime/40 focus-within:border-studio-anime/40',
      )}
    >
      <Link
        href={`/create/anime/project/${project.id}`}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
        aria-label={`Open project ${project.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-bg-elevated">
          {project.thumbnailURL ? (
            <Image
              src={project.thumbnailURL}
              alt={`Poster frame for ${project.title}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
            />
          ) : (
            // No poster yet is the HONEST default for a project whose scenes
            // haven't been generated — never a stock image standing in for one.
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-muted">
              <Clapperboard size={28} aria-hidden="true" />
              <span className="text-xs">No preview yet</span>
            </div>
          )}
          <span
            className={cn(
              'absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              STATUS_STYLE[project.status],
            )}
          >
            {project.status}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-text lg:text-base">
            <Link
              href={`/create/anime/project/${project.id}`}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
            >
              {project.title}
            </Link>
          </h3>

          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="-mr-1 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Actions for ${project.title}`}
              >
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[180px] rounded-xl border border-bg-border bg-bg-card p-1 shadow-xl animate-scale-in"
              >
                <DropdownMenu.Item
                  onSelect={() => actions.onRename(project)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Pencil size={14} aria-hidden="true" />
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => actions.onDuplicate(project)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Copy size={14} aria-hidden="true" />
                  Duplicate
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />
                <DropdownMenu.Item
                  onSelect={() => actions.onDelete(project)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger/10"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {project.description && (
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{project.description}</p>
        )}

        <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Film size={13} aria-hidden="true" />
            <dt className="sr-only">Scenes</dt>
            <dd>
              {project.sceneCount} {project.sceneCount === 1 ? 'scene' : 'scenes'}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} aria-hidden="true" />
            <dt className="sr-only">Duration</dt>
            <dd>{formatDuration(project.durationSec)}</dd>
          </div>
          {updated && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Last edited</dt>
              <dd>
                <time dateTime={updated.toISOString()}>{formatRelativeTime(project.updatedAt)}</time>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/create/anime/project/${project.id}`}
            className="flex-1 rounded-lg border border-bg-border px-3 py-2 text-center text-xs font-semibold text-text-secondary transition-colors hover:border-studio-anime/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
          >
            Scenes
          </Link>
          <Link
            href={`/create/anime/editor/${project.id}`}
            className="flex-1 rounded-lg bg-studio-anime px-3 py-2 text-center text-xs font-bold text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
          >
            Edit
          </Link>
        </div>
      </div>
    </article>
  )
}
