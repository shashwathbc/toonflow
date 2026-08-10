'use client'

// Cover image with a retry and a graceful fallback. next/image with no onError
// handler renders the browser's broken-image glyph when a request fails — and
// because `fill` images have no intrinsic box, the alt text spills out over the
// card's badges and past its edge. Two things go wrong in practice:
//
//  1. The optimizer route (`/_next/image`) itself fails — it re-fetches the
//     upstream file, resizes it with sharp, and gives up on slow or oversized
//     sources (several covers here are 2–4 MB PNGs). One card breaks while its
//     neighbours load, which is exactly the symptom that gets reported.
//  2. The file is genuinely gone (deleted Storage object, dead third-party host).
//
// So a failure retries ONCE with `unoptimized`, loading the original bytes
// straight from Storage — that recovers case 1 for real instead of papering over
// it with a placeholder. Only when the direct load fails too (case 2) do we show
// the clean "No Cover" placeholder. The retry carries a cache-busting param so
// the browser can't hand back the failed response it already has.
//
// Isolated as a small client component so the surrounding cards stay Server
// Components (no client JS for the rest of the card).
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
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

/** Distinct URL for the retry so a cached failure isn't replayed. */
function bustCache(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}_r=1`
}

export default function CoverImage({ src, alt, sizes, className, priority }: CoverImageProps) {
  // 0 = optimizer, 1 = direct/unoptimized retry, 2 = give up. Tracked together
  // with the src it belongs to so a new cover starts fresh without an effect —
  // cards are reused in place when a list is re-filtered or re-sorted.
  const [tries, setTries] = useState<{ src: string | null | undefined; attempt: number }>({ src, attempt: 0 })
  const attempt = tries.src === src ? tries.attempt : 0
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current)
  }, [])

  function handleError() {
    // Small delay: an instant retry tends to hit whatever transient condition
    // (cold optimizer, upstream throttle) just failed.
    retryTimer.current = setTimeout(() => setTries({ src, attempt: attempt + 1 }), 500)
  }

  if (!src || attempt > 1) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
        <ImageOff size={32} aria-hidden="true" />
        <span className="text-xs">No Cover</span>
      </div>
    )
  }

  return (
    <Image
      // Remounting on retry is what forces the browser to issue a new request.
      key={attempt}
      src={attempt === 0 ? src : bustCache(src)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={attempt > 0}
      className={className}
      onError={handleError}
    />
  )
}
