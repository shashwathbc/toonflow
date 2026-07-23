'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getOrCreateConversation } from '@/lib/firebase/messaging'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils/cn'

const LOCKED_MESSAGE = 'You can message only users who follow you back.'

interface MessageButtonProps {
  targetUid: string
  /** Both users follow each other — messaging is only allowed for friends. */
  isMutual: boolean
  /** Called right before navigating away (e.g. to close the dialog). */
  onNavigate?: () => void
  className?: string
}

/**
 * Opens (or creates) the 1:1 conversation with a user and navigates to the
 * thread. Enabled only for mutual followers; when locked it stays focusable and
 * shows an explanatory tooltip instead of using the `disabled` attribute (so
 * the tooltip is reachable by pointer and keyboard).
 */
export default function MessageButton({ targetUid, isMutual, onNavigate, className }: MessageButtonProps) {
  const router = useRouter()
  const { firebaseUser } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (!isMutual) {
      toast.error(LOCKED_MESSAGE)
      return
    }
    if (!firebaseUser) {
      toast.error('Sign in to send messages')
      return
    }
    setLoading(true)
    try {
      const cid = await getOrCreateConversation(firebaseUser.uid, targetUid)
      onNavigate?.()
      router.push(`/messages/${cid}`)
      // Intentionally leave `loading` true — we're navigating away.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open conversation')
      setLoading(false)
    }
  }

  return (
    <Tooltip label={isMutual ? 'Send a message' : LOCKED_MESSAGE}>
      <button
        type="button"
        onClick={handleClick}
        {...(isMutual ? {} : { 'aria-disabled': 'true' })}
        aria-label={isMutual ? 'Message this user' : 'Messaging locked — they do not follow you back'}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium px-3 py-1.5 border transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          isMutual
            ? 'border-bg-border text-text-secondary hover:text-text hover:border-accent/50'
            : 'border-bg-border text-text-muted opacity-60 cursor-not-allowed',
          className
        )}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <MessageCircle size={12} aria-hidden="true" />
        )}
        Message
      </button>
    </Tooltip>
  )
}
