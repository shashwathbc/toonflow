'use client'

// Immersive-reader chrome controller — shared by the novel chapter reader and
// the webtoon episode reader so both behave identically.
//
// Goal: a distraction-free "smooth reading" surface. The top bar and bottom
// bar are chrome that gets OUT OF THE WAY while the reader is actually reading:
//   • scrolling down (into the story) hides the chrome
//   • scrolling up (a natural "give me the controls" gesture) reveals it
//   • a single tap anywhere on the reading surface toggles it
// There is deliberately NO auto-show-on-idle timer — popping the bars back up
// while someone has paused to read is the opposite of immersive.
import { useCallback, useEffect, useRef, useState } from 'react'

// Distance (px) scrolled in one direction before we react — filters out the
// jitter of a finger resting on a touch screen.
const SCROLL_DELTA = 8
// Below this scroll position the chrome always stays visible (top of content).
const TOP_ZONE = 120

export interface ReaderChrome {
  /** Whether the top + bottom bars are currently shown. */
  chromeVisible: boolean
  /** Reading progress through the page, 0–100. */
  progress: number
  /** Flip the chrome on/off (e.g. an explicit control). */
  toggleChrome: () => void
  /** Force the chrome visible. */
  showChrome: () => void
  /** Force the chrome hidden. */
  hideChrome: () => void
  /**
   * onClick handler for the scrollable reading surface. Toggles the chrome but
   * ignores clicks that land on interactive elements or that finish a text
   * selection, so links, buttons and copy-selecting still work normally.
   */
  handleSurfaceClick: (e: React.MouseEvent) => void
}

/**
 * @param onHide Optional callback fired once each time the chrome transitions
 * from visible to hidden — e.g. to collapse any open header panels. Invoked
 * from scroll / tap event handlers (never from an effect), so it is safe to
 * call setState inside it.
 */
export function useReaderChrome(onHide?: () => void): ReaderChrome {
  const [chromeVisible, setChromeVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const lastScrollY = useRef(0)
  // Mirrors chromeVisible so event handlers read the latest value without a
  // stale closure, and so we can detect the visible→hidden transition.
  const visibleRef = useRef(true)
  const onHideRef = useRef(onHide)
  useEffect(() => { onHideRef.current = onHide }, [onHide])

  // Single funnel for every visibility change. Runs only on an actual
  // transition, and fires onHide on the way down.
  const applyVisible = useCallback((next: boolean) => {
    if (visibleRef.current === next) return
    visibleRef.current = next
    setChromeVisible(next)
    if (!next) onHideRef.current?.()
  }, [])

  const toggleChrome = useCallback(() => applyVisible(!visibleRef.current), [applyVisible])
  const showChrome = useCallback(() => applyVisible(true), [applyVisible])
  const hideChrome = useCallback(() => applyVisible(false), [applyVisible])

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      setProgress(maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0)

      if (scrollY > lastScrollY.current + SCROLL_DELTA && scrollY > TOP_ZONE) {
        applyVisible(false)
      } else if (scrollY < lastScrollY.current - SCROLL_DELTA) {
        applyVisible(true)
      }
      lastScrollY.current = scrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [applyVisible])

  const handleSurfaceClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null
    // Never toggle when the reader is interacting with real controls or content.
    if (target?.closest('a, button, input, textarea, select, label, [role="button"]')) return
    // Don't hijack a text selection drag as a "tap".
    const selection = typeof window !== 'undefined' ? window.getSelection() : null
    if (selection && selection.toString().length > 0) return
    applyVisible(!visibleRef.current)
  }, [applyVisible])

  return { chromeVisible, progress, toggleChrome, showChrome, hideChrome, handleSurfaceClick }
}
