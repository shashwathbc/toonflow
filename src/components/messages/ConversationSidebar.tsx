'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PenSquare, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useConversations, type ConversationRow } from '@/hooks/useConversations'
import { useDebounce } from '@/hooks/useDebounce'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import Avatar from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import NewMessageDialog from './NewMessageDialog'
import { formatRelativeTime } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

export default function ConversationSidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null
  const { rows, loading, hasMore, loadMore } = useConversations(uid)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const debounced = useDebounce(search, 200)
  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading })

  const activeId = pathname.startsWith('/messages/') ? pathname.split('/')[2] : null

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => (r.other?.displayName ?? '').toLowerCase().includes(q) || r.otherUid.slice(0, 8).includes(q)
    )
  }, [rows, debounced])

  return (
    <aside className={cn('flex-col bg-bg-card', className)} aria-label="Conversations">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
        <h1 className="text-base font-bold text-text">Messages</h1>
        <Tooltip label="New message">
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            aria-label="New message"
            className="btn-ghost rounded-lg p-1.5"
          >
            <PenSquare size={18} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="border-b border-bg-border px-3 py-2">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages"
            aria-label="Search conversations"
            className="input-base h-9 pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-border">
        {loading ? (
          <SidebarSkeletons />
        ) : filtered.length === 0 ? (
          debounced.trim() ? (
            <SidebarEmpty text="No conversations found." />
          ) : (
            <SidebarEmpty
              text="Start a conversation with your mutual followers."
              action={
                <button type="button" onClick={() => setNewOpen(true)} className="btn-accent mt-3 text-sm">
                  New message
                </button>
              }
            />
          )
        ) : (
          <ul>
            {filtered.map((r) => (
              <ConversationItem key={r.conversation.id} row={r} uid={uid} active={activeId === r.conversation.id} />
            ))}
            {hasMore && (
              <li className="py-3 text-center">
                <div ref={sentinelRef} aria-hidden="true" />
                <button type="button" onClick={loadMore} className="text-xs font-medium text-accent hover:underline">
                  Load more
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {newOpen && <NewMessageDialog open onClose={() => setNewOpen(false)} viewerId={uid} />}
    </aside>
  )
}

function ConversationItem({ row, uid, active }: { row: ConversationRow; uid: string | null; active: boolean }) {
  const { conversation, other, unread } = row
  const name = other?.displayName ?? 'Unknown user'
  const last = conversation.lastMessage
  const mine = last?.senderId === uid
  const preview = last ? `${mine ? 'You: ' : ''}${last.text}` : 'No messages yet'
  const time = conversation.updatedAt ? formatRelativeTime(conversation.updatedAt) : ''

  return (
    <li>
      <Link
        href={`/messages/${conversation.id}`}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:bg-bg-elevated',
          active && 'bg-bg-elevated'
        )}
      >
        <Avatar src={other?.photoURL} name={name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-sm text-text', unread > 0 ? 'font-bold' : 'font-semibold')}>
              {name}
            </span>
            <span className="shrink-0 text-[11px] text-text-muted">{time}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-xs', unread > 0 ? 'font-medium text-text' : 'text-text-muted')}>
              {preview}
            </span>
            {unread > 0 && (
              <span
                className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground"
                aria-label={`${unread} unread`}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}

function SidebarEmpty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm text-text-secondary">{text}</p>
      {action}
    </div>
  )
}

function SidebarSkeletons() {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-bg-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-bg-elevated" />
            <div className="h-2.5 w-40 animate-pulse rounded bg-bg-elevated" />
          </div>
        </li>
      ))}
    </ul>
  )
}
