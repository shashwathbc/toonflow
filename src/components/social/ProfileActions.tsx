'use client'

import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal, Ban, ShieldOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useBlock } from '@/hooks/useBlock'
import { getFriendship } from '@/lib/firebase/social'
import SubscribeButton from './SubscribeButton'
import MessageButton from './MessageButton'

interface ProfileActionsProps {
  targetUid: string
  /** Bubble follower-count changes up to the profile header. */
  onFollowToggled?: (delta: 1 | -1) => void
}

/**
 * The action cluster on someone else's profile header: Subscribe, Message
 * (enabled only for mutual followers), and an overflow menu with Block. When
 * the viewer has blocked this user, everything collapses to an Unblock control.
 */
export default function ProfileActions({ targetUid, onFollowToggled }: ProfileActionsProps) {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null
  const { blocked, pending: blockPending, canBlock, toggle: toggleBlock } = useBlock(targetUid)
  const [viewerFollows, setViewerFollows] = useState(false)
  const [followsViewer, setFollowsViewer] = useState(false)
  const isMutual = viewerFollows && followsViewer

  useEffect(() => {
    if (!uid || uid === targetUid) return
    let cancelled = false
    getFriendship(uid, targetUid)
      .then((f) => {
        if (cancelled) return
        setViewerFollows(f.viewerFollows)
        setFollowsViewer(f.followsViewer)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [uid, targetUid])

  if (uid === targetUid) return null // own profile — handled elsewhere

  const handleBlock = async () => {
    const r = await toggleBlock()
    if (r === true) toast.success('User blocked')
    else if (r === false) toast.success('User unblocked')
    else if (r === null) toast.error('Could not update block status')
  }

  if (blocked) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Blocked</span>
        <button
          type="button"
          onClick={handleBlock}
          disabled={blockPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-bg-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {blockPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ShieldOff size={14} aria-hidden="true" />}
          Unblock
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <SubscribeButton
        targetUid={targetUid}
        onToggled={(delta) => { setViewerFollows(delta > 0); onFollowToggled?.(delta) }}
      />
      <MessageButton targetUid={targetUid} isMutual={isMutual} />
      {canBlock && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="More options"
              className="btn-ghost rounded-full border border-bg-border p-2"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-40 rounded-xl border border-bg-border bg-bg-card p-1.5 shadow-xl data-[state=open]:animate-fade-in"
            >
              <DropdownMenu.Item
                onSelect={handleBlock}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-danger outline-none hover:bg-danger/10 focus-visible:bg-danger/10"
              >
                <Ban size={14} aria-hidden="true" /> Block user
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  )
}
