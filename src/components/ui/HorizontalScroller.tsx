'use client'

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface HorizontalScrollerProps {
  children: ReactNode
  /** Accessible label for the scrollable region. */
  ariaLabel: string
  className?: string
}

/**
 * A horizontally scrollable row with left/right arrow controls (Netflix-style).
 * Arrows appear only when there's overflow in that direction; the track also
 * scrolls natively (trackpad / touch / shift-wheel) and snaps to items. The
 * scrollbar is hidden — navigation is via the arrows or native gestures.
 */
export function HorizontalScroller({ children, ariaLabel, className }: HorizontalScrollerProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  const page = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className={cn('group/scroller relative overflow-hidden', className)}>
      <ArrowButton side="left" show={canLeft} onClick={() => page(-1)} />

      <div
        ref={trackRef}
        role="group"
        aria-label={ariaLabel}
        className={cn(
          'flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory',
          // Hide the scrollbar across engines without relying on a plugin.
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {children}
      </div>

      <ArrowButton side="right" show={canRight} onClick={() => page(1)} />
    </div>
  )
}

function ArrowButton({
  side,
  show,
  onClick,
}: {
  side: 'left' | 'right'
  show: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      aria-label={side === 'left' ? 'Scroll left' : 'Scroll right'}
      className={cn(
        'absolute top-[38%] -translate-y-1/2 z-10 hidden md:flex h-10 w-10 items-center justify-center rounded-full',
        'bg-bg-elevated/90 border border-bg-border text-text shadow-lg backdrop-blur-sm',
        'hover:bg-bg-elevated hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'transition-opacity duration-200',
        side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
        show ? 'opacity-0 group-hover/scroller:opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {side === 'left'
        ? <ChevronLeft size={20} aria-hidden="true" />
        : <ChevronRight size={20} aria-hidden="true" />}
    </button>
  )
}
