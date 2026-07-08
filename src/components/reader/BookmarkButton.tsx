'use client'

import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toggleBookmark, isBookmarked } from '@/lib/firebase/firestore'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import toast from 'react-hot-toast'

interface BookmarkButtonProps {
  contentId: string
  contentType: 'novel' | 'webtoon'
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export default function BookmarkButton({
  contentId, contentType, size = 'md', showLabel = false,
}: BookmarkButtonProps) {
  const { firebaseUser } = useAuth()
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    isBookmarked(firebaseUser.uid, contentId)
      .then(setSaved)
      .catch(() => {})
  }, [firebaseUser, contentId])

  const handleToggle = async () => {
    if (!firebaseUser) {
      toast.error('Sign in to bookmark')
      return
    }
    if (loading) return
    setLoading(true)
    const prev = saved
    setSaved(!prev)
    try {
      await toggleBookmark(firebaseUser.uid, contentId, contentType)
      toast.success(prev ? 'Removed from bookmarks' : 'Bookmarked!')
    } catch {
      setSaved(prev)
      toast.error('Failed to update bookmark')
    } finally {
      setLoading(false)
    }
  }

  const iconSize = size === 'sm' ? 13 : 16

  return (
    <Tooltip label={saved ? 'Remove bookmark' : 'Bookmark'} disabled={showLabel}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
        {...(saved ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
        className={cn(
          'flex items-center gap-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          saved
            ? 'text-accent bg-accent/10 hover:bg-accent/20'
            : 'text-text-muted bg-bg-elevated hover:text-text hover:bg-bg-elevated/80'
        )}
      >
        <Bookmark
          size={iconSize}
          aria-hidden="true"
          className={cn('transition-all', saved && 'fill-current')}
        />
        {showLabel && <span>{saved ? 'Saved' : 'Save'}</span>}
      </button>
    </Tooltip>
  )
}
