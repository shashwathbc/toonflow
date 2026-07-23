'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserCheck, ExternalLink } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import FollowButton from './FollowButton'
import MessageButton from './MessageButton'
import { formatCount } from '@/lib/utils/formatters'
import type { SocialUser } from '@/types'

interface SocialUserRowProps {
  user: SocialUser
  viewerId: string | null
  /** Close the dialog when navigating to a profile or thread. */
  onNavigate?: () => void
}

/**
 * One row in a followers/following list: avatar, name + handle, truncated bio,
 * follower/following counts, a Friends badge for mutual follows, and Follow /
 * Message / View-profile actions. Follow state is tracked locally so the badge
 * and Message enablement react immediately to a follow/unfollow.
 */
export default function SocialUserRow({ user, viewerId, onNavigate }: SocialUserRowProps) {
  const isSelf = viewerId === user.uid
  const [viewerFollows, setViewerFollows] = useState(user.viewerFollows)
  const [followerCount, setFollowerCount] = useState(user.followerCount)
  const isMutual = viewerFollows && user.followsViewer
  const handle = `@${user.uid.slice(0, 8)}`
  const profileHref = `/profile/${user.uid}`

  const handleToggled = (following: boolean) => {
    setViewerFollows(following)
    setFollowerCount((c) => Math.max(0, c + (following ? 1 : -1)))
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <Link
        href={profileHref}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden="true"
        className="shrink-0 rounded-full focus-visible:outline-none"
      >
        <Avatar src={user.photoURL} name={user.displayName} size={44} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={profileHref}
            onClick={onNavigate}
            className="truncate text-sm font-semibold text-text hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {user.displayName}
          </Link>
          {isMutual && !isSelf && (
            <Badge variant="accent" className="gap-1 shrink-0">
              <UserCheck size={10} aria-hidden="true" /> Friends
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-text-muted">{handle}</p>
        {user.bio && <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{user.bio}</p>}
        <p className="mt-0.5 text-[11px] text-text-muted">
          <span className="font-medium text-text-secondary">{formatCount(followerCount)}</span> followers
          {' · '}
          <span className="font-medium text-text-secondary">{formatCount(user.followingCount)}</span> following
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isSelf && (
          <>
            <FollowButton
              targetUid={user.uid}
              initialFollowing={user.viewerFollows}
              onToggled={handleToggled}
            />
            <MessageButton targetUid={user.uid} isMutual={isMutual} onNavigate={onNavigate} />
          </>
        )}
        <Tooltip label="View profile">
          <Link
            href={profileHref}
            onClick={onNavigate}
            aria-label={`View ${user.displayName}'s profile`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-elevated hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </Tooltip>
      </div>
    </li>
  )
}
