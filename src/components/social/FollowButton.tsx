'use client'

import { Check, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFollow } from '@/hooks/useFollow'
import { cn } from '@/lib/utils/cn'

interface FollowButtonProps {
  targetUid: string
  /** Known follow state, so the button doesn't re-fetch it per row. */
  initialFollowing: boolean
  /** Fired with the confirmed new state after a successful toggle. */
  onToggled?: (following: boolean) => void
  className?: string
}

/**
 * Compact Follow / Following toggle for list rows. Reuses the shared
 * {@link useFollow} hook (optimistic + transactional backend), seeded with the
 * known state to avoid an extra read per row. Renders nothing for the viewer's
 * own row.
 */
export default function FollowButton({ targetUid, initialFollowing, onToggled, className }: FollowButtonProps) {
  const { following, pending, isSelf, signedIn, toggle } = useFollow(targetUid, { initialFollowing })

  if (isSelf) return null

  const handleClick = async () => {
    if (!signedIn) {
      toast.error('Sign in to follow people')
      return
    }
    const result = await toggle()
    if (result === null) return
    onToggled?.(result)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={following ? 'Unfollow this user' : 'Follow this user'}
      {...(following ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1.5 transition-all',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed',
        following
          ? 'bg-bg-elevated text-text border border-bg-border hover:border-danger/40 hover:text-danger'
          : 'bg-accent text-accent-foreground hover:bg-accent-hover',
        className
      )}
    >
      {pending ? (
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      ) : following ? (
        <Check size={12} aria-hidden="true" />
      ) : (
        <Plus size={12} aria-hidden="true" />
      )}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
