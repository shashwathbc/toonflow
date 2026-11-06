'use client'

import { useState, useEffect } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { Heart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toggleLike, isLiked, likeTargetRef, type LikeableType } from '@/lib/firebase/engagement'
import { notifyLike } from '@/lib/firebase/notifications'
import { formatCount } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import toast from 'react-hot-toast'

interface LikeButtonProps {
  contentType: LikeableType
  contentId: string
  parentId?: string
  initialCount: number
  size?: 'sm' | 'md'
  showCount?: boolean
  /** Creator to notify when liked. Omit (e.g. comment likes) to skip notifying. */
  authorId?: string
  /** Content title shown in the notification (e.g. the novel/webtoon name). */
  contentTitle?: string
}

export default function LikeButton({
  contentType, contentId, parentId,
  initialCount, size = 'md', showCount = true,
  authorId, contentTitle,
}: LikeButtonProps) {
  const { firebaseUser, userProfile } = useAuth()
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  // Live like count — the authoritative value from the target document, so the
  // number reflects EVERY user's likes in real time (not just this session's own
  // toggle) and can never drift or show a stale/negative figure. `initialCount`
  // seeds it so there's no flash before the first snapshot arrives.
  useEffect(() => {
    const unsub = onSnapshot(
      likeTargetRef(contentType, contentId, parentId),
      (snap) => {
        const v = snap.data()?.likeCount
        if (typeof v === 'number') setCount(v)
      },
      () => { /* transient listener errors are non-fatal — keep the last count */ },
    )
    return unsub
  }, [contentType, contentId, parentId])

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
    const willLike = !prev
    // Optimistic UI: flip the heart AND move the count in the same tick, so the
    // number reacts the instant it's clicked instead of lagging a full Firestore
    // roundtrip behind the heart. The live listener reconciles to the
    // authoritative value moments later — they agree once the transaction
    // commits, so there's no visible correction.
    setLiked(willLike)
    setCount((c) => Math.max(0, c + (willLike ? 1 : -1)))
    try {
      const nowLiked = await toggleLike(firebaseUser.uid, contentType, contentId, parentId)
      // Notify the creator on a NEW like (not an unlike), best-effort.
      if (nowLiked && authorId && contentType !== 'comment') {
        void notifyLike({
          recipientId: authorId,
          actor: {
            uid: firebaseUser.uid,
            displayName: userProfile?.displayName ?? 'Someone',
            photoURL: userProfile?.photoURL ?? null,
          },
          contentType,
          contentId,
          parentId,
          title: contentTitle,
        })
      }
    } catch {
      setLiked(prev)
      setCount((c) => Math.max(0, c + (willLike ? -1 : 1))) // undo the optimistic bump
      toast.error('Failed to update like')
    } finally {
      setLoading(false)
    }
  }

  const iconSize = size === 'sm' ? 13 : 16

  return (
    <Tooltip label={liked ? 'Unlike' : 'Like'}>
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
    </Tooltip>
  )
}
