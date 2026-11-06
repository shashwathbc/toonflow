'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import ScenePlayer from './ScenePlayer'
import SceneStatusBadge from './SceneStatusBadge'
import { labelOf, ANIME_STYLES, CAMERA_MOVEMENTS } from '@/lib/anime/presets'
import { cn } from '@/lib/utils/cn'
import type { AnimeScene } from '@/types/anime'

export interface SceneCardActions {
  onGenerate: (scene: AnimeScene, intent: 'generate' | 'regenerate' | 'extend') => void
  onCancel: (scene: AnimeScene) => void
  onEdit: (scene: AnimeScene) => void
  onRename: (scene: AnimeScene) => void
  onDuplicate: (scene: AnimeScene) => void
  onDelete: (scene: AnimeScene) => void
  onDownload: (scene: AnimeScene) => void
  onAddToTimeline: (scene: AnimeScene) => void
  onMove: (scene: AnimeScene, direction: -1 | 1) => void
}

export default function SceneCard({
  projectId,
  scene,
  index,
  total,
  actions,
  progress,
  dragHandleProps,
  isDragging,
}: {
  projectId: string
  scene: AnimeScene
  index: number
  total: number
  actions: SceneCardActions
  progress?: number
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isDragging?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isBusy = scene.status === 'queued' || scene.status === 'processing'
  const hasClip = scene.status === 'ready' && Boolean(scene.storageKey)

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-card transition-colors',
        'hover:border-studio-anime/30 focus-within:border-studio-anime/40',
        isDragging && 'opacity-60 ring-2 ring-studio-anime',
      )}
      aria-label={`Scene ${index + 1}: ${scene.title}`}
    >
      <div className="relative">
        <ScenePlayer projectId={projectId} scene={scene} className="rounded-none" controls={hasClip} />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-bg/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-text backdrop-blur">
            {String(index + 1).padStart(2, '0')}
          </span>
          <SceneStatusBadge status={scene.status} progress={progress} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          {dragHandleProps && (
            <button
              type="button"
              {...dragHandleProps}
              className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
              aria-label={`Reorder ${scene.title}`}
            >
              <GripVertical size={15} aria-hidden="true" />
            </button>
          )}
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-text">{scene.title}</h3>

          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="-mr-1 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Actions for ${scene.title}`}
              >
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[200px] rounded-xl border border-bg-border bg-bg-card p-1 shadow-xl animate-scale-in"
              >
                <DropdownMenu.Item
                  onSelect={() => actions.onEdit(scene)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Pencil size={14} aria-hidden="true" />
                  Edit prompt & settings
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => actions.onRename(scene)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Scissors size={14} aria-hidden="true" />
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => actions.onDuplicate(scene)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Copy size={14} aria-hidden="true" />
                  Duplicate
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />

                <DropdownMenu.Item
                  disabled={isBusy}
                  onSelect={() => actions.onGenerate(scene, 'regenerate')}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Regenerate
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={isBusy || !hasClip}
                  onSelect={() => actions.onGenerate(scene, 'extend')}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  AI Extend
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />

                <DropdownMenu.Item
                  onSelect={() => actions.onAddToTimeline(scene)}
                  disabled={!hasClip}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add to timeline
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => actions.onDownload(scene)}
                  disabled={!hasClip}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <Download size={14} aria-hidden="true" />
                  Download
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />

                <DropdownMenu.Item
                  disabled={index === 0}
                  onSelect={() => actions.onMove(scene, -1)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <ArrowUp size={14} aria-hidden="true" />
                  Move up
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={index === total - 1}
                  onSelect={() => actions.onMove(scene, 1)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text"
                >
                  <ArrowDown size={14} aria-hidden="true" />
                  Move down
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />

                <DropdownMenu.Item
                  onSelect={() => actions.onDelete(scene)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger/10"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete scene
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {scene.prompt || <span className="italic text-text-muted">No prompt yet</span>}
        </p>

        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
          <span>{labelOf(ANIME_STYLES, scene.settings.animeStyle)}</span>
          <span>{labelOf(CAMERA_MOVEMENTS, scene.settings.cameraMovement)}</span>
          <span className="tabular-nums">
            {scene.durationSec > 0 ? `${scene.durationSec.toFixed(1)}s` : `${scene.settings.durationSec}s target`}
          </span>
        </p>

        <div className="mt-4 flex gap-2">
          {isBusy ? (
            <button
              type="button"
              onClick={() => actions.onCancel(scene)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-bg-border px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            >
              <X size={13} aria-hidden="true" />
              Cancel generation
            </button>
          ) : (
            <button
              type="button"
              onClick={() => actions.onGenerate(scene, hasClip ? 'regenerate' : 'generate')}
              disabled={!scene.prompt.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-studio-anime px-3 py-2 text-xs font-bold text-bg transition-colors hover:bg-studio-anime/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
            >
              {hasClip ? <RefreshCw size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
              {hasClip ? 'Generate again' : 'Generate'}
            </button>
          )}
          <button
            type="button"
            onClick={() => actions.onEdit(scene)}
            className="rounded-lg border border-bg-border px-3 py-2 text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Edit ${scene.title}`}
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
