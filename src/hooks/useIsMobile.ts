'use client'

import { useEffect, useState } from 'react'

/**
 * True when the viewport is narrower than Tailwind's `lg` breakpoint (1024px) —
 * i.e. phones and portrait tablets, where the editor's three-column desktop
 * layout doesn't fit and the overlay/bottom-bar chrome takes over.
 *
 * Starts `false` so server render and first paint match the desktop markup, then
 * corrects on mount (and on resize / orientation change).
 */
export function useIsMobile(query = '(max-width: 1023px)'): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return isMobile
}
