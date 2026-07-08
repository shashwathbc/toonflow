'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { setRating, getUserRating } from '@/lib/firebase/engagement'
import { formatCount } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import toast from 'react-hot-toast'

interface RatingControlProps {
  contentType: 'novel' | 'webtoon'
  contentId: string
  initialRating: number
  initialCount: number
  /** Notifies the parent so aggregate displays (details tile, hero meta) stay in sync */
  onRated?: (rating: number, ratingCount: number) => void
}

export default function RatingControl({
  contentType, contentId, initialRating, initialCount, onRated,
}: RatingControlProps) {
  const { firebaseUser } = useAuth()
  const [fetchedRating, setFetchedRating] = useState<number | null>(null)
  const [average, setAverage] = useState(initialRating)
  const [count, setCount] = useState(initialCount)
  const [hovered, setHovered] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  // signed-out users never have an own-rating; deriving this (instead of
  // resetting state in the effect) keeps the effect free of sync setState
  const userRating = firebaseUser ? fetchedRating : null

  useEffect(() => {
    if (!firebaseUser) return
    let cancelled = false
    getUserRating(firebaseUser.uid, contentType, contentId)
      .then((r) => { if (!cancelled) setFetchedRating(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [firebaseUser, contentType, contentId])

  const handleRate = async (value: number) => {
    if (!firebaseUser) {
      toast.error('Sign in to rate')
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const res = await setRating(firebaseUser.uid, contentType, contentId, value)
      setFetchedRating(res.userRating)
      setAverage(res.rating)
      setCount(res.ratingCount)
      onRated?.(res.rating, res.ratingCount)
      toast.success(res.userRating ? `Rated ${res.userRating} star${res.userRating > 1 ? 's' : ''}` : 'Rating removed')
    } catch {
      toast.error('Failed to save rating')
    } finally {
      setLoading(false)
    }
  }

  // Stars preview the hover target, else show the user's own rating, else the average
  const displayed = hovered ?? userRating ?? Math.round(average)

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated"
      role="group"
      aria-label={`Rate this ${contentType}. Current average ${average > 0 ? average.toFixed(1) : 'not rated'}${userRating ? `, your rating ${userRating} stars` : ''}`}
    >
      <div className="flex items-center" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Tooltip key={value} label={userRating === value ? 'Remove your rating' : `Rate ${value} star${value > 1 ? 's' : ''}`}>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRate(value)}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onBlur={() => setHovered(null)}
              aria-label={`Rate ${value} star${value > 1 ? 's' : ''}${userRating === value ? ' (your rating — select again to remove)' : ''}`}
              {...(userRating === value ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
              className="p-0.5 rounded transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
            >
              <Star
                size={16}
                aria-hidden="true"
                className={cn(
                  'transition-colors',
                  value <= displayed
                    ? hovered !== null || userRating !== null
                      ? 'text-warning fill-warning'
                      : 'text-warning/60 fill-warning/60'
                    : 'text-text-muted/40'
                )}
              />
            </button>
          </Tooltip>
        ))}
      </div>
      <span className="text-xs text-text-secondary tabular-nums whitespace-nowrap">
        {average > 0 ? (
          <>
            <span className="font-semibold text-text">{average.toFixed(1)}</span>
            {' '}({formatCount(count)})
          </>
        ) : 'Rate'}
      </span>
    </div>
  )
}
