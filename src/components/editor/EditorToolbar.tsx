'use client'

import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Download,
  Eye,
  Check,
  Loader2,
  FileText,
  Maximize2,
  ChevronDown,
  BookCopy,
  MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Novel, Chapter } from '@/types'

export type PDFExportScope = 'all' | 'current'

interface EditorToolbarProps {
  novel: Novel | null
  chapter: Chapter | null
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onSave: () => void
  onPublish: () => void
  onUnpublish: () => void
  onPublishChapter: () => void
  onUnpublishChapter: () => void
  onExportPDF: (scope: PDFExportScope) => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
  chapterPublishing?: boolean
}

function SaveIndicator({ state }: { state: EditorToolbarProps['saveState'] }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/40" aria-live="polite">
        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
        Saving…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/40" aria-live="polite">
        <Check size={11} aria-hidden="true" />
        Saved
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger" aria-live="polite" role="alert">
        Save failed
      </span>
    )
  }
  return null
}

export function EditorToolbar({
  novel,
  chapter,
  saveState,
  onSave,
  onPublish,
  onUnpublish,
  onPublishChapter,
  onUnpublishChapter,
  onExportPDF,
  onToggleFullscreen,
  isFullscreen,
  chapterPublishing = false,
}: EditorToolbarProps) {
  const isPublished = novel?.status !== 'draft' && novel?.status !== undefined
  const isChapterPublished = chapter?.status === 'published'

  return (
    <header
      className="h-14 bg-bg border-b border-bg-border flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 flex-shrink-0 sticky top-0 z-20"
      role="banner"
    >
      {/* Left: back + novel title */}
      <div className="flex items-center gap-2 min-w-0">
        {!isFullscreen && (
          <Tooltip label="Back to Novel Studio" side="bottom">
            <Link
              href="/create/novel"
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Back to Novel Studio"
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </Link>
          </Tooltip>
        )}

        <div className="min-w-0">
          <p className="text-xs text-white/40 truncate leading-none mb-0.5">
            {novel?.title || 'Untitled Novel'}
          </p>
          <p className="text-sm font-medium text-white truncate leading-tight">
            {chapter?.title || 'No chapter selected'}
          </p>
        </div>
      </div>

      {/* Center: save state */}
      <div className="flex-1 flex items-center justify-center">
        <SaveIndicator state={saveState} />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Secondary utilities — inline on desktop, folded into an overflow
            menu on mobile so the Publish CTAs stay unobstructed */}
        <div className="hidden sm:flex items-center gap-1">
        <Tooltip label="Save changes" side="bottom">
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === 'saving'}
            className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
            aria-label="Save chapter"
          >
            <Save size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </Tooltip>

        <DropdownMenu.Root>
          <Tooltip label="Download PDF" side="bottom">
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
                aria-label="Download PDF options"
              >
                <Download size={13} aria-hidden="true" />
                <span className="hidden lg:inline">PDF</span>
                <ChevronDown size={11} aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={cn(
                'z-50 min-w-52 bg-bg-card border border-bg-border rounded-xl p-1.5 shadow-xl',
                'data-[state=open]:animate-fade-in'
              )}
              side="bottom"
              align="end"
              sideOffset={8}
              role="menu"
              aria-label="PDF download options"
            >
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 text-sm text-text rounded-lg cursor-pointer',
                  'hover:bg-white/10 focus-visible:bg-white/10 outline-none'
                )}
                onSelect={() => onExportPDF('all')}
                role="menuitem"
              >
                <BookCopy size={14} aria-hidden="true" />
                Download all chapters
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 text-sm text-text rounded-lg',
                  chapter
                    ? 'cursor-pointer hover:bg-white/10 focus-visible:bg-white/10'
                    : 'opacity-40 cursor-not-allowed',
                  'outline-none'
                )}
                disabled={!chapter}
                onSelect={() => onExportPDF('current')}
                role="menuitem"
              >
                <FileText size={14} aria-hidden="true" />
                Download current chapter
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Tooltip label="Preview (opens in new tab)" side="bottom">
          <Link
            href={novel ? `/novel/${novel.id}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
            aria-label="Preview novel (opens in new tab)"
          >
            <Eye size={13} aria-hidden="true" />
            <span className="hidden lg:inline">Preview</span>
          </Link>
        </Tooltip>

        <Tooltip label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} side="bottom">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="btn-ghost text-xs px-2.5 py-1.5"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen writing mode'}
          >
            <Maximize2 size={13} aria-hidden="true" />
          </button>
        </Tooltip>
        </div>

        {/* Mobile overflow — same utilities collapsed into one menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="sm:hidden btn-ghost text-xs w-8 h-8 items-center justify-center flex"
              aria-label="More editor actions"
            >
              <MoreVertical size={16} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={cn(
                'z-50 min-w-56 bg-bg-card border border-bg-border rounded-xl p-1.5 shadow-xl',
                'data-[state=open]:animate-fade-in'
              )}
              side="bottom"
              align="end"
              sideOffset={8}
              role="menu"
              aria-label="Editor actions"
            >
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2 text-sm text-text rounded-lg cursor-pointer',
                  'hover:bg-white/10 focus-visible:bg-white/10 outline-none disabled:opacity-40'
                )}
                disabled={saveState === 'saving'}
                onSelect={onSave}
                role="menuitem"
              >
                <Save size={15} aria-hidden="true" />
                Save changes
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2 text-sm text-text rounded-lg cursor-pointer',
                  'hover:bg-white/10 focus-visible:bg-white/10 outline-none'
                )}
                onSelect={() => onExportPDF('all')}
                role="menuitem"
              >
                <BookCopy size={15} aria-hidden="true" />
                Download all chapters
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2 text-sm text-text rounded-lg outline-none',
                  chapter
                    ? 'cursor-pointer hover:bg-white/10 focus-visible:bg-white/10'
                    : 'opacity-40 cursor-not-allowed'
                )}
                disabled={!chapter}
                onSelect={() => onExportPDF('current')}
                role="menuitem"
              >
                <FileText size={15} aria-hidden="true" />
                Download current chapter
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild role="menuitem">
                <Link
                  href={novel ? `/novel/${novel.id}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 text-sm text-text rounded-lg cursor-pointer',
                    'hover:bg-white/10 focus-visible:bg-white/10 outline-none'
                  )}
                >
                  <Eye size={15} aria-hidden="true" />
                  Preview novel
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2 text-sm text-text rounded-lg cursor-pointer',
                  'hover:bg-white/10 focus-visible:bg-white/10 outline-none'
                )}
                onSelect={onToggleFullscreen}
                role="menuitem"
              >
                <Maximize2 size={15} aria-hidden="true" />
                {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Chapter publish toggle */}
        {chapter && (
          <>
            <div className="w-px h-5 bg-bg-border mx-0.5 sm:mx-1" aria-hidden="true" />
            {isChapterPublished ? (
              <Tooltip label="Chapter is live — click to unpublish" side="bottom">
                <button
                  type="button"
                  onClick={onUnpublishChapter}
                  disabled={chapterPublishing}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-white/10 hover:text-white/60 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
                  aria-label="Unpublish this chapter"
                >
                  {chapterPublishing
                    ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    : <Globe size={11} aria-hidden="true" />
                  }
                  <span className="whitespace-nowrap">Chapter Live</span>
                </button>
              </Tooltip>
            ) : (
              <Tooltip label="Publish chapter so readers can see it" side="bottom">
                <button
                  type="button"
                  onClick={onPublishChapter}
                  disabled={chapterPublishing}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
                  aria-label="Publish this chapter"
                >
                  {chapterPublishing
                    ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    : <Globe size={11} aria-hidden="true" />
                  }
                  <span className="whitespace-nowrap">Publish Chapter</span>
                </button>
              </Tooltip>
            )}
          </>
        )}

        <div className="w-px h-5 bg-bg-border mx-0.5 sm:mx-1" aria-hidden="true" />

        {isPublished ? (
          <Tooltip label="Unpublish novel" side="bottom">
            <button
              type="button"
              onClick={onUnpublish}
              className="btn-ghost text-xs px-3 py-1.5 gap-1.5 text-warning hover:text-warning hover:bg-warning/10"
              aria-label="Unpublish novel"
            >
              <EyeOff size={13} aria-hidden="true" />
              <span className="whitespace-nowrap">Unpublish</span>
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Publish novel to Browse" side="bottom">
            <button
              type="button"
              onClick={onPublish}
              className="btn-accent text-xs px-3 py-1.5"
              aria-label="Publish novel"
            >
              <Globe size={13} aria-hidden="true" />
              Publish
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  )
}
