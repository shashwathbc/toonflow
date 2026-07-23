'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Search, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getFollowConnections } from '@/lib/firebase/social'
import { getOrCreateConversation } from '@/lib/firebase/messaging'
import { useDebounce } from '@/hooks/useDebounce'
import Avatar from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils/cn'
import type { SocialUser } from '@/types'

interface NewMessageDialogProps {
  open: boolean
  onClose: () => void
  viewerId: string | null
}

/**
 * Pick a mutual follower to start (or open) a conversation with. Loads the
 * viewer's following list filtered to mutual follows (= friends, the only people
 * they may message), searchable by name/handle.
 */
export default function NewMessageDialog({ open, onClose, viewerId }: NewMessageDialogProps) {
  const router = useRouter()
  const [friends, setFriends] = useState<SocialUser[] | null>(null) // null = loading
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)
  const debounced = useDebounce(search, 200)

  useEffect(() => {
    if (!viewerId) return
    let cancelled = false
    getFollowConnections({ profileUid: viewerId, type: 'following', viewerId })
      .then((page) => { if (!cancelled) setFriends(page.users.filter((u) => u.isMutual)) })
      .catch((e) => { if (!cancelled) { console.error('[NewMessage] load friends failed:', e); setError(true) } })
    return () => { cancelled = true }
  }, [viewerId])

  const filtered = useMemo(() => {
    const list = friends ?? []
    const q = debounced.trim().toLowerCase()
    if (!q) return list
    return list.filter((u) => u.displayName.toLowerCase().includes(q) || u.uid.slice(0, 8).includes(q))
  }, [friends, debounced])

  const start = async (targetUid: string) => {
    if (!viewerId) return
    setOpeningId(targetUid)
    try {
      const cid = await getOrCreateConversation(viewerId, targetUid)
      onClose()
      router.push(`/messages/${cid}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start conversation')
      setOpeningId(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-bg-card text-text',
            'inset-0 rounded-none border-0',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[70vh] sm:max-h-[560px] sm:w-full sm:max-w-md',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-bg-border sm:shadow-2xl',
            'focus:outline-none data-[state=open]:animate-fade-in'
          )}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-bg-border px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-text">New message</Dialog.Title>
            <Tooltip label="Close" side="bottom">
              <Dialog.Close asChild>
                <button type="button" className="btn-ghost -mr-1.5 rounded-lg p-1.5" aria-label="Close dialog">
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </Tooltip>
          </div>

          <div className="px-5 py-3">
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
                placeholder="Search mutual followers"
                aria-label="Search mutual followers"
                className="input-base pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-thumb-bg-border">
            {error ? (
              <div className="flex flex-col items-center justify-center py-14 text-center" role="alert">
                <AlertCircle size={32} className="mb-3 text-danger" aria-hidden="true" />
                <p className="text-sm text-text-secondary">Couldn&apos;t load your mutual followers.</p>
              </div>
            ) : friends === null ? (
              <ul aria-hidden="true" className="px-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-bg-elevated" />
                    <div className="h-3 w-32 animate-pulse rounded bg-bg-elevated" />
                  </li>
                ))}
              </ul>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <p className="text-sm text-text-secondary">
                  {debounced.trim()
                    ? 'No mutual followers match your search.'
                    : 'No mutual followers yet. You can message people who follow you back.'}
                </p>
              </div>
            ) : (
              <ul className="px-1">
                {filtered.map((u) => (
                  <li key={u.uid}>
                    <button
                      type="button"
                      onClick={() => start(u.uid)}
                      disabled={openingId !== null}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                    >
                      <Avatar src={u.photoURL} name={u.displayName} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{u.displayName}</p>
                        <p className="truncate text-xs text-text-muted">@{u.uid.slice(0, 8)}</p>
                      </div>
                      {openingId === u.uid && (
                        <Loader2 size={16} className="animate-spin text-text-muted" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
