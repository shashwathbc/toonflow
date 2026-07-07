'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { getUserProfile } from '@/lib/firebase/firestore'
import { formatCount } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import SubscribeButton from './SubscribeButton'

interface AuthorCardProps {
  authorId: string
  /** Denormalized name from the content doc — shown before the profile loads. */
  authorName: string
  authorPhotoURL?: string | null
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Author identity block: avatar, name, live follower count and a Subscribe
 * button. The count updates optimistically when the viewer toggles.
 */
export default function AuthorCard({ authorId, authorName, authorPhotoURL, size = 'md', className }: AuthorCardProps) {
  const [photoURL, setPhotoURL] = useState<string | null>(authorPhotoURL ?? null)
  const [displayName, setDisplayName] = useState(authorName)
  const [followerCount, setFollowerCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getUserProfile(authorId)
      .then((profile) => {
        if (cancelled || !profile) return
        setDisplayName(profile.displayName || authorName)
        setPhotoURL(profile.photoURL ?? null)
        setFollowerCount(profile.followerCount ?? 0)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authorId, authorName])

  const initials = (displayName || '?').trim().charAt(0).toUpperCase()
  const avatarPx = size === 'sm' ? 36 : 44

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Link
        href={`/profile/${authorId}`}
        className="flex items-center gap-3 min-w-0 group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded-full"
        aria-label={`View ${displayName}'s profile`}
      >
        <span
          className="relative rounded-full bg-bg-elevated border border-bg-border overflow-hidden flex-shrink-0"
          style={{ width: avatarPx, height: avatarPx }}
        >
          {photoURL ? (
            <Image src={photoURL} alt={`${displayName}'s avatar`} fill sizes={`${avatarPx}px`} className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text-secondary" aria-hidden="true">
              {initials}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className={cn(
            'block font-semibold text-text group-hover:text-accent transition-colors truncate',
            size === 'sm' ? 'text-sm' : 'text-base',
          )}>
            {displayName}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Users size={11} aria-hidden="true" />
            {followerCount === null ? '—' : `${formatCount(followerCount)} ${followerCount === 1 ? 'Follower' : 'Followers'}`}
          </span>
        </span>
      </Link>
      <SubscribeButton
        targetUid={authorId}
        size={size}
        className="ml-auto flex-shrink-0"
        onToggled={(delta) => setFollowerCount((c) => Math.max(0, (c ?? 0) + delta))}
      />
    </div>
  )
}
