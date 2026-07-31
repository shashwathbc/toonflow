'use client'

// Cover image with a graceful fallback. next/image with no onError handler
// renders the browser's broken-image glyph when a URL is dead or slow to fail
// (e.g. flaky third-party hosts, deleted Storage files, hosts not in
// next.config remotePatterns). This swaps to the clean "No Cover" placeholder
// instead — so a broken cover never shows a jarring glyph, and the fallback
// paints instantly rather than hanging on a URL that will never resolve.
//
// Isolated as a small client component so the surrounding cards stay Server
// Components (no client JS for the rest of the card).
import Image from 'next/image'
import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface CoverImageProps {
  src: string | null | undefined
  alt: string
  /** Responsive sizes hint for the optimizer (same value the card used inline). */
  sizes?: string
  className?: string
  /** Set on above-the-fold covers to improve LCP; lazy otherwise (default). */
  priority?: boolean
}

export default function CoverImage({ src, alt, sizes, className, priority }: CoverImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
        <ImageOff size={32} aria-hidden="true" />
        <span className="text-xs">No Cover</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
