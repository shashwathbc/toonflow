'use client'

import { useRouter } from 'next/navigation'
import { Bell, Heart, MessageSquare, UserPlus, CheckCheck, Send } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/firebase/notifications'
import { formatRelativeTimestamp } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { safeInternalPath } from '@/lib/utils/url'
import { Tooltip } from '@/components/ui/Tooltip'
import Avatar from '@/components/ui/Avatar'
import type { AppNotification } from '@/types'

const TYPE_LABEL: Record<AppNotification['targetType'] & string, string> = {
  novel: 'novel',
  webtoon: 'webtoon',
  chapter: 'chapter',
  episode: 'episode',
}

/** Human sentence for a notification, rendered with the actor name in bold. */
function notificationText(n: AppNotification): React.ReactNode {
  const target = n.targetType ? TYPE_LABEL[n.targetType] : 'content'
  switch (n.type) {
    case 'follow':
      return <>started following you</>
    case 'like':
      return <>liked your {target}</>
    case 'comment':
      return <>commented on your {target}</>
    case 'message':
      return <>sent you a message</>
  }
}

function TypeBadge({ type }: { type: AppNotification['type'] }) {
  const base = 'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-bg-card'
  if (type === 'like') {
    return (
      <span className={cn(base, 'bg-danger text-white')} aria-hidden="true">
        <Heart size={9} className="fill-current" />
      </span>
    )
  }
  if (type === 'comment') {
    return (
      <span className={cn(base, 'bg-sky-500 text-white')} aria-hidden="true">
        <MessageSquare size={9} className="fill-current" />
      </span>
    )
  }
  if (type === 'message') {
    return (
      <span className={cn(base, 'bg-violet-500 text-white')} aria-hidden="true">
        <Send size={9} />
      </span>
    )
  }
  return (
    <span className={cn(base, 'bg-accent text-accent-foreground')} aria-hidden="true">
      <UserPlus size={9} />
    </span>
  )
}

export default function NotificationBell() {
  const router = useRouter()
  const { firebaseUser, isAuthenticated } = useAuth()
  const { notifications, unreadCount, loading } = useNotifications()
  const uid = firebaseUser?.uid ?? null

  if (!isAuthenticated) return null

  const badge = unreadCount > 9 ? '9+' : unreadCount

  const handleOpen = (n: AppNotification) => {
    if (uid && !n.read) markNotificationRead(uid, n.id).catch(() => {})
    // `link` is attacker-reachable: any signed-in user may write a notification
    // into any other user's feed, and the rules can only bound its length. An
    // absolute URL here would make the bell a one-click redirect to a phishing
    // clone (or, for a javascript: value, a script sink via router.push →
    // window.location). Navigate only to a verified in-app path.
    const target = safeInternalPath(n.link)
    if (target) router.push(target)
  }

  const handleMarkAll = () => {
    if (uid) markAllNotificationsRead(uid).catch(() => {})
  }

  return (
    <DropdownMenu.Root>
      <Tooltip label="Notifications">
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="relative btn-ghost rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-2 ring-bg"
                aria-hidden="true"
              >
                {badge}
              </span>
            )}
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'z-50 w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-bg-border bg-bg-card shadow-xl',
            'data-[state=open]:animate-fade-in',
          )}
          role="menu"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-bg-border px-3 py-2.5">
            <p className="text-sm font-bold text-text">Notifications</p>
            {unreadCount > 0 && (
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault()
                  handleMarkAll()
                }}
                className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-accent outline-none hover:bg-accent/10 focus-visible:bg-accent/10"
              >
                <CheckCheck size={13} aria-hidden="true" />
                Mark all read
              </DropdownMenu.Item>
            )}
          </div>

          {/* Feed */}
          <div className="max-h-[min(70vh,26rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-bg-border">
            {loading ? (
              <FeedSkeletons />
            ) : notifications.length === 0 ? (
              <EmptyFeed />
            ) : (
              notifications.map((n) => (
                <DropdownMenu.Item
                  key={n.id}
                  onSelect={() => handleOpen(n)}
                  className={cn(
                    'flex cursor-pointer gap-3 px-3 py-2.5 outline-none transition-colors',
                    'hover:bg-bg-elevated focus-visible:bg-bg-elevated',
                    !n.read && 'bg-accent/[0.06]',
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar src={n.actorPhotoURL} name={n.actorName} size={40} />
                    <TypeBadge type={n.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-text">
                      <span className="font-semibold">{n.actorName}</span>{' '}
                      <span className="text-text-secondary">{notificationText(n)}</span>
                    </p>
                    {(n.preview || n.targetTitle) && (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {n.preview ? `“${n.preview}”` : n.targetTitle}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {formatRelativeTimestamp(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                      aria-label="Unread"
                    />
                  )}
                </DropdownMenu.Item>
              ))
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Bell size={28} className="mb-3 text-text-muted opacity-40" aria-hidden="true" />
      <p className="text-sm font-medium text-text-secondary">You&apos;re all caught up</p>
      <p className="mt-1 text-xs text-text-muted">
        Follows, likes and comments on your work show up here.
      </p>
    </div>
  )
}

function FeedSkeletons() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-2.5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-bg-elevated" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-bg-elevated" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  )
}
