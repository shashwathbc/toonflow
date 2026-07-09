'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  GripVertical,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Globe,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createEpisode,
  deleteEpisode,
  duplicateEpisode,
  reorderEpisodes,
  publishEpisode,
  unpublishEpisode,
} from '@/lib/firebase/firestore'
import { nowTimestamp } from '@/lib/utils/time'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Episode } from '@/types'

interface EpisodeSidebarProps {
  webtoonId: string
  episodes: Episode[]
  activeEpisodeId: string | null
  onSelectEpisode: (episode: Episode) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

interface SortableEpisodeRowProps {
  episode: Episode
  isActive: boolean
  pendingDeleteId: string | null
  onSelect: () => void
  onDuplicate: () => void
  onTogglePublish: () => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function SortableEpisodeRow({
  episode,
  isActive,
  pendingDeleteId,
  onSelect,
  onDuplicate,
  onTogglePublish,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: SortableEpisodeRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: episode.id })

  const nodeRef = useRef<HTMLLIElement>(null)

  const setRefs = useCallback((node: HTMLLIElement | null) => {
    setNodeRef(node)
    nodeRef.current = node
  }, [setNodeRef])

  useEffect(() => {
    if (!nodeRef.current) return
    nodeRef.current.style.transform = CSS.Transform.toString(transform) ?? ''
    nodeRef.current.style.transition = transition ?? ''
  }, [transform, transition])

  const panelsCount = episode.panels?.length ?? 0

  return (
    <li
      ref={setRefs}
      className={`group relative rounded-lg transition-colors ${
        isDragging ? 'opacity-40 z-10' : 'opacity-100'
      } ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
    >
      <div className="flex items-start gap-1 p-2">
        {/* Drag handle */}
        <Tooltip label="Drag to reorder" side="right">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-0.5 p-0.5 rounded text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none focus-visible:ring-1 focus-visible:ring-white"
            aria-label={`Reorder episode ${episode.episodeNumber}`}
          >
            <GripVertical size={14} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Episode info */}
        <button
          onClick={onSelect}
          className="flex-1 text-left min-w-0 focus-visible:ring-1 focus-visible:ring-white rounded"
          aria-label={`Open episode ${episode.episodeNumber}: ${episode.title || 'Untitled'}`}
          aria-current={isActive ? 'true' : undefined}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-white/40 flex-shrink-0">
              Ep.{episode.episodeNumber}
            </span>
            {episode.status === 'published' && (
              <span className="text-[9px] bg-white text-bg px-1 py-0.5 rounded font-semibold">
                PUB
              </span>
            )}
          </div>
          <p className={`text-xs leading-tight truncate ${isActive ? 'text-white font-medium' : 'text-white/70'}`}>
            {episode.title || 'Untitled Episode'}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {panelsCount} {panelsCount === 1 ? 'panel' : 'panels'}
          </p>
        </button>

        {/* Actions */}
        {pendingDeleteId === episode.id ? (
          <div className="flex-shrink-0 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onConfirmDelete() }}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-danger/20 text-danger hover:bg-danger/30 transition-colors focus-visible:ring-1 focus-visible:ring-danger"
              aria-label="Confirm delete episode"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCancelDelete() }}
              className="px-1.5 py-0.5 rounded text-[10px] text-white/50 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-white"
              aria-label="Cancel delete"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center gap-0.5">
            <Tooltip label={episode.status === 'published' ? 'Unpublish episode' : 'Publish episode'}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTogglePublish() }}
                className={`p-1 rounded transition-colors focus-visible:ring-1 focus-visible:ring-white ${
                  episode.status === 'published'
                    ? 'text-accent hover:text-warning hover:bg-warning/10'
                    : 'text-white/40 hover:text-accent hover:bg-accent/10'
                }`}
                aria-label={episode.status === 'published' ? `Unpublish episode ${episode.episodeNumber}` : `Publish episode ${episode.episodeNumber}`}
              >
                {episode.status === 'published' ? <EyeOff size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}
              </button>
            </Tooltip>
            <Tooltip label="Duplicate episode">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDuplicate() }}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-white"
                aria-label={`Duplicate episode ${episode.episodeNumber}`}
              >
                <Copy size={11} aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip label="Delete episode">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRequestDelete() }}
                className="p-1 rounded hover:bg-danger/10 text-white/40 hover:text-danger transition-colors focus-visible:ring-1 focus-visible:ring-white"
                aria-label={`Delete episode ${episode.episodeNumber}`}
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </li>
  )
}

export function EpisodeSidebar({
  webtoonId,
  episodes,
  activeEpisodeId,
  onSelectEpisode,
  collapsed,
  onToggleCollapse,
}: EpisodeSidebarProps) {
  const [creating, setCreating] = useState(false)
  const [localOrder, setLocalOrder] = useState<string[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const orderedEpisodes = localOrder.length > 0
    ? [...episodes].sort(
        (a, b) => localOrder.indexOf(a.id) - localOrder.indexOf(b.id)
      )
    : episodes

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  async function handleAddEpisode() {
    setCreating(true)
    try {
      const episodeNumber = episodes.length + 1
      const id = await createEpisode(webtoonId, {
        title: `Episode ${episodeNumber}`,
        episodeNumber,
        panels: [],
        thumbnailURL: null,
        status: 'draft',
      })
      const newEpisode: Episode = {
        id,
        webtoonId,
        title: `Episode ${episodeNumber}`,
        episodeNumber,
        panels: [],
        thumbnailURL: null,
        isPremium: false,
        coinCost: 0,
        viewCount: 0,
        status: 'draft',
        createdAt: nowTimestamp(),
        publishedAt: null,
      }
      onSelectEpisode(newEpisode)
    } catch {
      toast.error('Failed to create episode')
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmDelete(episode: Episode) {
    setPendingDeleteId(null)
    try {
      await deleteEpisode(webtoonId, episode.id)
      toast.success('Episode deleted')
    } catch {
      toast.error('Failed to delete episode')
    }
  }

  async function handleDuplicate(episode: Episode) {
    try {
      await duplicateEpisode(webtoonId, episode.id, episode.episodeNumber)
      toast.success('Episode duplicated')
    } catch {
      toast.error('Failed to duplicate episode')
    }
  }

  async function handleTogglePublish(episode: Episode) {
    try {
      if (episode.status === 'published') {
        await unpublishEpisode(webtoonId, episode.id)
        toast.success(`Episode ${episode.episodeNumber} unpublished`)
      } else {
        await publishEpisode(webtoonId, episode.id)
        toast.success(`Episode ${episode.episodeNumber} published`)
      }
    } catch {
      toast.error('Failed to update episode status')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIds = orderedEpisodes.map((e) => e.id)
    const oldIndex = oldIds.indexOf(active.id as string)
    const newIndex = oldIds.indexOf(over.id as string)
    const newOrder = arrayMove(oldIds, oldIndex, newIndex)

    setLocalOrder(newOrder)

    try {
      await reorderEpisodes(webtoonId, newOrder)
    } catch {
      toast.error('Failed to reorder episodes')
      setLocalOrder([])
    }
  }

  if (collapsed) {
    return (
      <aside
        className="w-10 border-r border-bg-border flex flex-col items-center pt-3 gap-2 bg-bg"
        aria-label="Episode list (collapsed)"
      >
        <Tooltip label="Expand sidebar" side="right">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Expand episode sidebar"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </Tooltip>
        <div className="flex flex-col gap-1 mt-2">
          {orderedEpisodes.map((ep) => (
            <Tooltip key={ep.id} label={ep.title || `Episode ${ep.episodeNumber}`} side="right">
              <button
                type="button"
                onClick={() => onSelectEpisode(ep)}
                className={`w-7 h-7 rounded text-[10px] font-bold transition-colors focus-visible:ring-1 focus-visible:ring-white ${
                  ep.id === activeEpisodeId
                    ? 'bg-white text-bg'
                    : 'text-white/40 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={`Episode ${ep.episodeNumber}`}
                aria-current={ep.id === activeEpisodeId ? 'true' : undefined}
              >
                {ep.episodeNumber}
              </button>
            </Tooltip>
          ))}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="w-72 border-r border-bg-border flex flex-col bg-bg flex-shrink-0"
      aria-label="Episode management"
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-white/50" aria-hidden="true" />
          <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">
            Episodes
          </span>
          <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full">
            {episodes.length}
          </span>
        </div>
        <Tooltip label="Collapse sidebar" side="left">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-white"
            aria-label="Collapse episode sidebar"
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Episode list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {episodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ImageIcon size={24} className="text-white/15 mb-2" aria-hidden="true" />
            <p className="text-xs text-white/30">No episodes yet</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedEpisodes.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-0.5" role="list" aria-label="Episode list">
                {orderedEpisodes.map((episode) => (
                  <SortableEpisodeRow
                    key={episode.id}
                    episode={episode}
                    isActive={episode.id === activeEpisodeId}
                    pendingDeleteId={pendingDeleteId}
                    onSelect={() => onSelectEpisode(episode)}
                    onDuplicate={() => handleDuplicate(episode)}
                    onTogglePublish={() => handleTogglePublish(episode)}
                    onRequestDelete={() => setPendingDeleteId(episode.id)}
                    onConfirmDelete={() => handleConfirmDelete(episode)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add episode button */}
      <div className="px-3 py-3 border-t border-bg-border">
        <button
          onClick={handleAddEpisode}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 border border-dashed border-bg-border hover:border-white/20 transition-colors focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          aria-label="Add new episode"
        >
          {creating ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus size={12} aria-hidden="true" />
          )}
          {creating ? 'Creating…' : 'Add Episode'}
        </button>
      </div>
    </aside>
  )
}
