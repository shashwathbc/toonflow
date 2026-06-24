import { useEffect, useRef, useCallback } from 'react'

export function useInfiniteScroll(
  onLoadMore: () => void,
  options: { threshold?: number; enabled?: boolean } = {}
) {
  const { threshold = 300, enabled = true } = options
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (enabled && entries[0]?.isIntersecting) {
        onLoadMore()
      }
    },
    [enabled, onLoadMore]
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: `${threshold}px`,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleIntersect, threshold])

  return sentinelRef
}
