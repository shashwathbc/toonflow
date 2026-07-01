'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toggleLike, isLiked } from '@/lib/firebase/engagement'
import { formatCount } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

interface LikeButtonProps {
  contentType: 'novel' | 'webtoon' | 'chapter' | 'episode' | 'comment'
  contentId: string
  parentId?: string
  initialCount: number
  size?: 'sm' | 'md'
  showCount?: boolean
}

export default function LikeButton({
  contentType, contentId, parentId,
  initialCount, size = 'md', showCount = true,
}: LikeButtonProps) {
  const { firebaseUser } = useAuth()
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    isLiked(firebaseUser.uid, contentType, contentId)
      .then(setLiked)
      .catch(() => {})
  }, [firebaseUser, contentType, contentId])

  const handleToggle = async () => {
    if (!firebaseUser) {
      toast.error('Sign in to like')
      return
    }
    if (loading) return
    setLoading(true)
    const prev = liked
    setLiked(!prev)
    setCount((c) => prev ? c - 1 : c + 1)
    try {
      await toggleLike(firebaseUser.uid, contentType, contentId, parentId)
    } catch {
      setLiked(prev)
      setCount((c) => prev ? c + 1 : c - 1)
      toast.error('Failed to update like')
    } finally {
      setLoading(false)
    }
  }

  const iconSize = size === 'sm' ? 13 : 16

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      aria-label={liked ? 'Unlike' : 'Like'}
      {...(liked ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
      className={cn(
        'flex items-center gap-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        liked
          ? 'text-danger bg-danger/10 hover:bg-danger/20'
          : 'text-text-muted bg-bg-elevated hover:text-text hover:bg-bg-elevated/80'
      )}
    >
      <Heart
        size={iconSize}
        aria-hidden="true"
        className={cn('transition-all', liked && 'fill-current')}
      />
      {showCount && <span className="tabular-nums">{formatCount(count)}</span>}
    </button>
  )
}
