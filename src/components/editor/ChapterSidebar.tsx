'use client'

import { useState } from 'react'
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
  FileText,
  Loader2,
  Globe,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createChapter,
  deleteChapter,
  duplicateChapter,
  reorderChapters,
  publishChapter,
  unpublishChapter,
} from '@/lib/firebase/firestore'
import { nowTimestamp } from '@/lib/utils/time'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Chapter } from '@/types'

interface ChapterSidebarProps {
  novelId: string
  chapters: Chapter[]
  activeChapterId: string | null
  onSelectChapter: (chapter: Chapter) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

interface SortableChapterRowProps {
  chapter: Chapter
  isActive: boolean
  pendingDeleteId: string | null
  onSelect: () => void
  onDuplicate: () => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onTogglePublish: () => void
}

function SortableChapterRow({
  chapter,
  isActive,
  pendingDeleteId,
  onSelect,
  onDuplicate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onTogglePublish,
}: SortableChapterRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  // dnd-kit computes drag transforms at runtime, so these two must stay inline
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const wordCount = chapter.wordCount ?? 0

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg transition-colors ${
        isActive ? 'bg-white/10' : 'hover:bg-white/5'
      } ${isDragging ? 'z-10 opacity-40' : ''}`}
    >
      <div className="flex items-start gap-1 p-2">
        {/* Drag handle */}
        <Tooltip label="Drag to reorder" side="right">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-0.5 p-0.5 rounded text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none focus-visible:ring-1 focus-visible:ring-white"
            aria-label={`Reorder chapter ${chapter.chapterNumber}`}
          >
            <GripVertical size={14} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Chapter info */}
        <button
          onClick={onSelect}
          className="flex-1 text-left min-w-0 focus-visible:ring-1 focus-visible:ring-white rounded"
          aria-label={`Open chapter ${chapter.chapterNumber}: ${chapter.title || 'Untitled'}`}
          aria-current={isActive ? 'true' : undefined}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-white/40 flex-shrink-0">
              Ch.{chapter.chapterNumber}
            </span>
            <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${
              chapter.status === 'published'
                ? 'bg-accent text-accent-foreground'
                : 'bg-white/10 text-white/40'
            }`}>
              {chapter.status === 'published' ? 'PUB' : 'DRAFT'}
            </span>
          </div>
          <p className={`text-xs leading-tight truncate ${isActive ? 'text-white font-medium' : 'text-white/70'}`}>
            {chapter.title || 'Untitled Chapter'}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {wordCount.toLocaleString()} words
          </p>
        </button>

        {/* Actions */}
        {pendingDeleteId === chapter.id ? (
          <div className="flex-shrink-0 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onConfirmDelete() }}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-danger/20 text-danger hover:bg-danger/30 transition-colors focus-visible:ring-1 focus-visible:ring-danger"
              aria-label="Confirm delete chapter"
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
            {/* Publish toggle — always visible */}
            <Tooltip label={chapter.status === 'published' ? 'Unpublish chapter' : 'Publish chapter'}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTogglePublish() }}
                className={`p-1 rounded transition-colors focus-visible:ring-1 focus-visible:ring-white ${
                  chapter.status === 'published'
                    ? 'text-accent hover:text-white/60 hover:bg-white/5'
                    : 'text-white/25 hover:text-accent hover:bg-white/5'
                }`}
                aria-label={chapter.status === 'published' ? `Unpublish chapter ${chapter.chapterNumber}` : `Publish chapter ${chapter.chapterNumber}`}
              >
                {chapter.status === 'published'
                  ? <Globe size={11} aria-hidden="true" />
                  : <Globe size={11} aria-hidden="true" />
                }
              </button>
            </Tooltip>
            {/* Copy + delete — always visible */}
            <div className="flex items-center gap-0.5">
              <Tooltip label="Duplicate chapter">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate() }}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-white"
                  aria-label={`Duplicate chapter ${chapter.chapterNumber}`}
                >
                  <Copy size={11} aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip label="Delete chapter">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRequestDelete() }}
                  className="p-1 rounded hover:bg-danger/10 text-white/40 hover:text-danger transition-colors focus-visible:ring-1 focus-visible:ring-white"
                  aria-label={`Delete chapter ${chapter.chapterNumber}`}
                >
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

export function ChapterSidebar({
  novelId,
  chapters,
  activeChapterId,
  onSelectChapter,
  collapsed,
  onToggleCollapse,
}: ChapterSidebarProps) {
  const [creating, setCreating] = useState(false)
  const [localOrder, setLocalOrder] = useState<string[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const orderedChapters = localOrder.length > 0
    ? [...chapters].sort(
        (a, b) => localOrder.indexOf(a.id) - localOrder.indexOf(b.id)
      )
    : chapters

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  async function handleAddChapter() {
    setCreating(true)
    try {
      const chapterNumber = chapters.length + 1
      const id = await createChapter(novelId, {
        title: `Chapter ${chapterNumber}`,
        chapterNumber,
        content: '',
        wordCount: 0,
        status: 'draft',
      })
      const newChapter: Chapter = {
        id,
        novelId,
        title: `Chapter ${chapterNumber}`,
        chapterNumber,
        content: '',
        wordCount: 0,
        isPremium: false,
        coinCost: 0,
        viewCount: 0,
        likeCount: 0,
        status: 'draft',
        createdAt: nowTimestamp(),
        publishedAt: null,
      }
      onSelectChapter(newChapter)
    } catch {
      toast.error('Failed to create chapter')
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmDelete(chapter: Chapter) {
    setPendingDeleteId(null)
    try {
      await deleteChapter(novelId, chapter.id)
      toast.success('Chapter deleted')
    } catch {
      toast.error('Failed to delete chapter')
    }
  }

  async function handleTogglePublish(chapter: Chapter) {
    try {
      if (chapter.status === 'published') {
        await unpublishChapter(novelId, chapter.id)
        toast.success('Chapter unpublished')
      } else {
        await publishChapter(novelId, chapter.id)
        toast.success('Chapter published — readers can now see it!')
      }
    } catch {
      toast.error('Failed to update chapter status')
    }
  }

  async function handleDuplicate(chapter: Chapter) {
    try {
      await duplicateChapter(novelId, chapter.id, chapter.chapterNumber)
      toast.success('Chapter duplicated')
    } catch {
      toast.error('Failed to duplicate chapter')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIds = orderedChapters.map((c) => c.id)
    const oldIndex = oldIds.indexOf(active.id as string)
    const newIndex = oldIds.indexOf(over.id as string)
    const newOrder = arrayMove(oldIds, oldIndex, newIndex)

    setLocalOrder(newOrder)

    try {
      await reorderChapters(novelId, newOrder)
    } catch {
      toast.error('Failed to reorder chapters')
      setLocalOrder([])
    }
  }

  if (collapsed) {
    return (
      <aside
        className="w-10 border-r border-bg-border hidden lg:flex flex-col items-center pt-3 gap-2 bg-bg"
        aria-label="Chapter list (collapsed)"
      >
        <Tooltip label="Expand sidebar" side="right">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Expand chapter sidebar"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </Tooltip>
        <div className="flex flex-col gap-1 mt-2">
          {orderedChapters.map((ch) => (
            <Tooltip key={ch.id} label={ch.title || `Chapter ${ch.chapterNumber}`} side="right">
              <button
                type="button"
                onClick={() => onSelectChapter(ch)}
                className={`w-7 h-7 rounded text-[10px] font-bold transition-colors focus-visible:ring-1 focus-visible:ring-white ${
                  ch.id === activeChapterId
                    ? 'bg-white text-bg'
                    : 'text-white/40 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={`Chapter ${ch.chapterNumber}`}
                aria-current={ch.id === activeChapterId ? 'true' : undefined}
              >
                {ch.chapterNumber}
              </button>
            </Tooltip>
          ))}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="w-full lg:w-72 border-r border-bg-border flex flex-col bg-bg flex-shrink-0"
      aria-label="Chapter management"
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-white/50" aria-hidden="true" />
          <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">
            Chapters
          </span>
          <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full">
            {chapters.length}
          </span>
        </div>
        <Tooltip label="Collapse sidebar" side="left">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-6 h-6 rounded hover:bg-white/10 hidden lg:flex items-center justify-center text-white/40 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-white"
            aria-label="Collapse chapter sidebar"
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {chapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText size={24} className="text-white/15 mb-2" aria-hidden="true" />
            <p className="text-xs text-white/30">No chapters yet</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedChapters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-0.5" role="list" aria-label="Chapter list">
                {orderedChapters.map((chapter) => (
                  <SortableChapterRow
                    key={chapter.id}
                    chapter={chapter}
                    isActive={chapter.id === activeChapterId}
                    pendingDeleteId={pendingDeleteId}
                    onSelect={() => onSelectChapter(chapter)}
                    onTogglePublish={() => handleTogglePublish(chapter)}
                    onDuplicate={() => handleDuplicate(chapter)}
                    onRequestDelete={() => setPendingDeleteId(chapter.id)}
                    onConfirmDelete={() => handleConfirmDelete(chapter)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add chapter button */}
      <div className="px-3 py-3 border-t border-bg-border">
        <button
          onClick={handleAddChapter}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 border border-dashed border-bg-border hover:border-white/20 transition-colors focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          aria-label="Add new chapter"
        >
          {creating ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus size={12} aria-hidden="true" />
          )}
          {creating ? 'Creating…' : 'Add Chapter'}
        </button>
      </div>
    </aside>
  )
}
