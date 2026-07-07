'use client'

import { Check, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFollow } from '@/hooks/useFollow'
import { cn } from '@/lib/utils/cn'

interface SubscribeButtonProps {
  /** Creator being subscribed to. */
  targetUid: string
  size?: 'sm' | 'md'
  /** Fired with +1 / -1 after a confirmed toggle so callers can bump counts. */
  onToggled?: (delta: 1 | -1) => void
  className?: string
}

/**
 * One-click Subscribe / Subscribed button with optimistic UI, an in-flight
 * guard and a transactional backend (see followUser). Renders nothing when
 * the viewer IS the creator.
 */
export default function SubscribeButton({ targetUid, size = 'md', onToggled, className }: SubscribeButtonProps) {
  const { following, pending, isSelf, signedIn, toggle } = useFollow(targetUid)

  if (isSelf) return null

  const handleClick = async () => {
    if (!signedIn) {
      toast.error('Sign in to subscribe to creators')
      return
    }
    const result = await toggle()
    if (result === null) return
    onToggled?.(result ? 1 : -1)
    toast.success(result ? 'Subscribed!' : 'Unsubscribed')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={following ? 'Unsubscribe from this creator' : 'Subscribe to this creator'}
      {...(following ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold rounded-full transition-all',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2',
        following
          ? 'bg-bg-elevated text-text border border-bg-border hover:border-danger/40 hover:text-danger'
          : 'bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm',
        className,
      )}
    >
      {pending ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" aria-hidden="true" />
      ) : following ? (
        <Check size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      ) : (
        <Plus size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      )}
      {following ? 'Subscribed' : 'Subscribe'}
    </button>
  )
}
