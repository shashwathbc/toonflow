'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Download,
  Eye,
  Settings,
  Check,
  Loader2,
  FileText,
  Maximize2,
} from 'lucide-react'
import type { Novel, Chapter } from '@/types'

interface EditorToolbarProps {
  novel: Novel | null
  chapter: Chapter | null
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onSave: () => void
  onPublish: () => void
  onUnpublish: () => void
  onPublishChapter: () => void
  onUnpublishChapter: () => void
  onExportPDF: () => void
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
      className="h-14 bg-bg border-b border-bg-border flex items-center gap-2 px-4 flex-shrink-0 sticky top-0 z-20"
      role="banner"
    >
      {/* Left: back + novel title */}
      <div className="flex items-center gap-2 min-w-0">
        {!isFullscreen && (
          <Link
            href="/create/novel"
            className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Back to Novel Studio"
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </Link>
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
      <div className="flex items-center gap-1">
        <button
          onClick={onSave}
          disabled={saveState === 'saving'}
          className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
          aria-label="Save chapter"
        >
          <Save size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <button
          onClick={onExportPDF}
          className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
          aria-label="Export as PDF"
          title="Export PDF"
        >
          <Download size={13} aria-hidden="true" />
          <span className="hidden lg:inline">PDF</span>
        </button>

        <Link
          href={novel ? `/novel/${novel.id}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
          aria-label="Preview novel (opens in new tab)"
          title="Preview"
        >
          <Eye size={13} aria-hidden="true" />
          <span className="hidden lg:inline">Preview</span>
        </Link>

        <button
          onClick={onToggleFullscreen}
          className="btn-ghost text-xs px-2.5 py-1.5"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen writing mode'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <Maximize2 size={13} aria-hidden="true" />
        </button>

        {/* Chapter publish toggle */}
        {chapter && (
          <>
            <div className="w-px h-5 bg-bg-border mx-1" aria-hidden="true" />
            {isChapterPublished ? (
              <button
                type="button"
                onClick={onUnpublishChapter}
                disabled={chapterPublishing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-white/10 hover:text-white/60 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
                aria-label="Unpublish this chapter"
                title="Chapter is live — click to unpublish"
              >
                {chapterPublishing
                  ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                  : <Globe size={11} aria-hidden="true" />
                }
                <span className="hidden sm:inline">Chapter Live</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onPublishChapter}
                disabled={chapterPublishing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
                aria-label="Publish this chapter"
                title="Publish chapter so readers can see it"
              >
                {chapterPublishing
                  ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                  : <Globe size={11} aria-hidden="true" />
                }
                <span className="hidden sm:inline">Publish Chapter</span>
              </button>
            )}
          </>
        )}

        <div className="w-px h-5 bg-bg-border mx-1" aria-hidden="true" />

        {isPublished ? (
          <button
            onClick={onUnpublish}
            className="btn-ghost text-xs px-3 py-1.5 gap-1.5 text-warning hover:text-warning hover:bg-warning/10"
            aria-label="Unpublish novel"
          >
            <EyeOff size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Unpublish</span>
          </button>
        ) : (
          <button
            onClick={onPublish}
            className="btn-accent text-xs px-3 py-1.5"
            aria-label="Publish novel"
          >
            <Globe size={13} aria-hidden="true" />
            Publish
          </button>
        )}
      </div>
    </header>
  )
}
