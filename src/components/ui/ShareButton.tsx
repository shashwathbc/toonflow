'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import toast from 'react-hot-toast'

interface ShareButtonProps {
  /** Title used by the native share sheet. */
  title: string
  /** Optional descriptive text for the native share sheet. */
  text?: string
  /** URL to share. Defaults to the current page URL. */
  url?: string
  size?: 'sm' | 'md'
  /** Show a visible "Share" label alongside the icon (else icon-only + tooltip). */
  showLabel?: boolean
  className?: string
}

/**
 * Share the current page. Uses the native share sheet where available (mobile,
 * some desktops) and falls back to copying the link to the clipboard with a
 * toast. Purely client-side — no analytics, no network.
 */
export default function ShareButton({
  title, text, url, size = 'md', showLabel = false, className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')
    if (!shareUrl) return

    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    if (nav?.share) {
      try {
        await nav.share({ title, text, url: shareUrl })
        return
      } catch (e) {
        // User dismissed the sheet — do nothing. Any other failure falls through
        // to the clipboard path so sharing still works.
        if ((e as Error).name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const iconSize = size === 'sm' ? 13 : 16

  return (
    <Tooltip label="Share" disabled={showLabel}>
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share"
        className={cn(
          'flex items-center gap-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          'text-text-muted bg-bg-elevated hover:text-text hover:bg-bg-elevated/80',
          size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          className,
        )}
      >
        {copied
          ? <Check size={iconSize} className="text-accent" aria-hidden="true" />
          : <Share2 size={iconSize} aria-hidden="true" />}
        {showLabel && <span>{copied ? 'Copied' : 'Share'}</span>}
      </button>
    </Tooltip>
  )
}
