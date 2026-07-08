'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Eye,
  Check,
  Loader2,
  Maximize2,
} from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Webtoon, Episode } from '@/types'

interface WebtoonToolbarProps {
  webtoon: Webtoon | null
  episode: Episode | null
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onSave: () => void
  onPublish: () => void
  onUnpublish: () => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
}

function SaveIndicator({ state }: { state: WebtoonToolbarProps['saveState'] }) {
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

export function WebtoonToolbar({
  webtoon,
  episode,
  saveState,
  onSave,
  onPublish,
  onUnpublish,
  onToggleFullscreen,
  isFullscreen,
}: WebtoonToolbarProps) {
  const isPublished = webtoon?.status !== 'draft' && webtoon?.status !== undefined

  return (
    <header
      className="h-14 bg-bg border-b border-bg-border flex items-center gap-2 px-4 flex-shrink-0 sticky top-0 z-20"
      role="banner"
    >
      {/* Left: back + webtoon title */}
      <div className="flex items-center gap-2 min-w-0">
        {!isFullscreen && (
          <Tooltip label="Back to Webtoon Studio" side="bottom">
            <Link
              href="/create/webtoon"
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Back to Webtoon Studio"
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </Link>
          </Tooltip>
        )}

        <div className="min-w-0">
          <p className="text-xs text-white/40 truncate leading-none mb-0.5">
            {webtoon?.title || 'Untitled Webtoon'}
          </p>
          <p className="text-sm font-medium text-white truncate leading-tight">
            {episode?.title || 'No episode selected'}
          </p>
        </div>
      </div>

      {/* Center: save state */}
      <div className="flex-1 flex items-center justify-center">
        <SaveIndicator state={saveState} />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <Tooltip label="Save changes" side="bottom">
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === 'saving'}
            className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
            aria-label="Save episode"
          >
            <Save size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </Tooltip>

        <Tooltip label="Preview (opens in new tab)" side="bottom">
          <Link
            href={webtoon ? `/webtoon/${webtoon.id}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5"
            aria-label="Preview webtoon (opens in new tab)"
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
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen mode'}
          >
            <Maximize2 size={13} aria-hidden="true" />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-bg-border mx-1" aria-hidden="true" />

        {isPublished ? (
          <Tooltip label="Unpublish webtoon" side="bottom">
            <button
              type="button"
              onClick={onUnpublish}
              className="btn-ghost text-xs px-3 py-1.5 gap-1.5 text-warning hover:text-warning hover:bg-warning/10"
              aria-label="Unpublish webtoon"
            >
              <EyeOff size={13} aria-hidden="true" />
              <span className="hidden sm:inline">Unpublish</span>
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Publish webtoon to Browse" side="bottom">
            <button
              type="button"
              onClick={onPublish}
              className="btn-accent text-xs px-3 py-1.5"
              aria-label="Publish webtoon"
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
