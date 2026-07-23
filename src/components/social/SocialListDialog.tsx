'use client'

import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { X, Search, SlidersHorizontal, Check, Users, AlertCircle, RotateCw } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useFollowList } from '@/hooks/useFollowList'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { Tabs } from '@/components/ui/Tabs'
import { Tooltip } from '@/components/ui/Tooltip'
import SocialUserRow from './SocialUserRow'
import { cn } from '@/lib/utils/cn'
import type { FollowListType } from '@/lib/firebase/social'
import type { SocialUser } from '@/types'

type SortMode = 'recent' | 'username' | 'followers' | 'friends'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: 'Recently followed' },
  { value: 'username', label: 'Username A–Z' },
  { value: 'followers', label: 'Most followers' },
  { value: 'friends', label: 'Friends only' },
]

interface SocialListDialogProps {
  open: boolean
  onClose: () => void
  profileUid: string
  profileName: string
  followerCount: number
  followingCount: number
  initialTab: FollowListType
  viewerId: string | null
}

/**
 * Instagram/X-style followers & following dialog: a responsive Radix Dialog
 * (centered on desktop, full-screen sheet on mobile) with tabs, instant search,
 * sort/filter, paginated + infinite-scrolling rows, skeletons, empty and error
 * states. Search and sort operate over the rows loaded so far (progressive),
 * not the entire follower set.
 */
export default function SocialListDialog({
  open,
  onClose,
  profileUid,
  profileName,
  followerCount,
  followingCount,
  initialTab,
  viewerId,
}: SocialListDialogProps) {
  const [tab, setTab] = useState<FollowListType>(initialTab)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const debouncedSearch = useDebounce(search, 250)

  const { users, loading, loadingMore, hasMore, error, loadMore, retry } = useFollowList({
    profileUid,
    type: tab,
    viewerId,
    enabled: open,
  })

  const visible = useMemo(() => applySearchSort(users, debouncedSearch, sort), [users, debouncedSearch, sort])

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: open && hasMore && !loading && !error })

  const emptyMessage = getEmptyMessage(tab, sort, debouncedSearch.trim().length > 0)

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-bg-card text-text',
            // Mobile: full-screen sheet
            'inset-0 rounded-none border-0',
            // Desktop: centered dialog
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[80vh] sm:max-h-[640px] sm:w-full sm:max-w-lg',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-bg-border sm:shadow-2xl',
            'focus:outline-none data-[state=open]:animate-fade-in'
          )}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4">
            <Dialog.Title className="text-base font-semibold text-text">
              {profileName}
            </Dialog.Title>
            <Tooltip label="Close" side="bottom">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="btn-ghost -mr-1.5 rounded-lg p-1.5"
                  aria-label="Close dialog"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </Tooltip>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-3">
            <Tabs<FollowListType>
              items={[
                { id: 'followers', label: 'Followers', count: followerCount },
                { id: 'following', label: 'Following', count: followingCount },
              ]}
              value={tab}
              onChange={setTab}
              ariaLabel="Followers and following"
              idBase="social"
            />
          </div>

          {/* Search + sort */}
          <div className="flex items-center gap-2 px-5 py-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or username"
                aria-label="Search this list"
                className="input-base pl-9"
              />
            </div>
            <DropdownMenu.Root>
              <Tooltip label="Sort & filter">
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
                    aria-label="Sort and filter"
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
              </Tooltip>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-[60] min-w-52 rounded-xl border border-bg-border bg-bg-card p-1.5 shadow-xl data-[state=open]:animate-fade-in"
                >
                  <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-text-muted">
                    Sort & filter
                  </DropdownMenu.Label>
                  <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenu.RadioItem
                        key={opt.value}
                        value={opt.value}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary outline-none hover:bg-bg-elevated hover:text-text focus-visible:bg-bg-elevated data-[state=checked]:text-text"
                      >
                        {opt.label}
                        <DropdownMenu.ItemIndicator>
                          <Check size={14} className="text-accent" aria-hidden="true" />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 scrollbar-thin scrollbar-thumb-bg-border">
            {error ? (
              <ErrorState onRetry={retry} />
            ) : loading ? (
              <RowSkeletons />
            ) : visible.length === 0 ? (
              <EmptyState message={emptyMessage} />
            ) : (
              <>
                <ul className="divide-y divide-bg-border">
                  {visible.map((u) => (
                    <SocialUserRow key={u.uid} user={u} viewerId={viewerId} onNavigate={onClose} />
                  ))}
                </ul>
                {/* Infinite-scroll sentinel + explicit fallback */}
                {hasMore && (
                  <div ref={sentinelRef} className="py-4 text-center">
                    {loadingMore ? (
                      <span className="text-xs text-text-muted">Loading…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={loadMore}
                        className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Client-side search (name + handle) and sort/filter over the loaded rows. */
function applySearchSort(users: SocialUser[], search: string, sort: SortMode): SocialUser[] {
  const q = search.trim().toLowerCase()
  let list = users
  if (q) {
    list = list.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.uid.slice(0, 8).toLowerCase().includes(q)
    )
  }
  if (sort === 'friends') list = list.filter((u) => u.isMutual)

  if (sort === 'username') {
    return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  if (sort === 'followers') {
    return [...list].sort((a, b) => b.followerCount - a.followerCount)
  }
  return list // 'recent' / 'friends' preserve server (recently-followed) order
}

function getEmptyMessage(tab: FollowListType, sort: SortMode, searching: boolean): string {
  if (searching) return 'No users match your search.'
  if (sort === 'friends') return 'No mutual friends yet.'
  return tab === 'followers' ? 'No followers yet.' : 'Not following anyone.'
}

function RowSkeletons() {
  return (
    <ul className="divide-y divide-bg-border" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-bg-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-bg-elevated" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-bg-elevated" />
          </div>
          <div className="h-7 w-16 animate-pulse rounded-full bg-bg-elevated" />
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Users size={36} className="mb-3 text-text-muted/50" aria-hidden="true" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
      <AlertCircle size={36} className="mb-3 text-danger" aria-hidden="true" />
      <p className="mb-4 text-sm text-text-secondary">Couldn&apos;t load this list.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg bg-bg-elevated px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-border focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <RotateCw size={13} aria-hidden="true" /> Try again
      </button>
    </div>
  )
}
