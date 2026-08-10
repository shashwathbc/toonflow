'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, Send, Loader2, MessageCircleOff,
  ImagePlus, Phone, Video, CheckCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useConversationThread } from '@/hooks/useConversationThread'
import { getUserProfile } from '@/lib/firebase/firestore'
import { MESSAGE_MAX_LENGTH, sendImageMessage } from '@/lib/firebase/messaging'
import { notifyMessage, markMessageNotificationRead } from '@/lib/firebase/notifications'
import { uploadMessageImage } from '@/lib/firebase/storage'
import Avatar from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import EmojiPicker from '@/components/messages/EmojiPicker'
import { cn } from '@/lib/utils/cn'
import { safeHttpUrl } from '@/lib/utils/url'
import type { ConversationMessage, FirestoreTimestamp, UserProfile } from '@/types'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024

async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file)
    const dims = { width: bmp.width, height: bmp.height }
    bmp.close()
    return dims
  } catch {
    return { width: 800, height: 600 }
  }
}

export default function ThreadClient({ conversationId }: { conversationId: string }) {
  const { firebaseUser, userProfile, loading: authLoading } = useAuth()
  const uid = firebaseUser?.uid ?? null

  const {
    conversation, messages, error, isParticipant, otherUid,
    otherTyping, seenByOther, canLoadOlder,
    send, markRead, loadOlder, notifyTyping, stopTyping,
  } = useConversationThread(conversationId, uid)

  const [other, setOther] = useState<UserProfile | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load the other participant's profile for the header.
  useEffect(() => {
    if (!otherUid) return
    let cancelled = false
    getUserProfile(otherUid)
      .then((p) => { if (!cancelled) setOther(p) })
      .catch((e) => console.error('[Thread] failed to load participant:', e))
    return () => { cancelled = true }
  }, [otherUid])

  // Clear our unread counter whenever there's something unread, and dismiss the
  // matching bell entry so the two stay in sync.
  useEffect(() => {
    if (conversation && uid && (conversation.unreadCount?.[uid] ?? 0) > 0) {
      markRead()
      markMessageNotificationRead(uid, conversationId).catch(() => {})
    }
  }, [conversation, uid, conversationId, markRead])

  // Fire a live bell notification to the recipient (best-effort, never blocks).
  const pingRecipient = (preview: string) => {
    if (!uid || !otherUid) return
    void notifyMessage({
      recipientId: otherUid,
      actor: {
        uid,
        displayName: userProfile?.displayName ?? 'Someone',
        photoURL: userProfile?.photoURL ?? null,
      },
      conversationId,
      preview,
    })
  }

  // Keep the newest message in view (and when the typing indicator appears).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, otherTyping])

  const autoGrow = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    try {
      await send(value)
      setText('')
      stopTyping()
      requestAnimationFrame(autoGrow)
      pingRecipient(value)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(text.slice(0, start) + emoji + text.slice(end))
    notifyTyping()
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
      autoGrow()
    })
  }

  const handleImagePick = async (file: File) => {
    if (!uid) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    if (file.size > IMAGE_MAX_BYTES) { toast.error('Image must be under 10MB'); return }
    setUploading(true)
    try {
      const dims = await readImageSize(file)
      const url = await uploadMessageImage(conversationId, uid, file)
      await sendImageMessage(conversationId, uid, { url, width: dims.width, height: dims.height })
      pingRecipient('📷 Photo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── States ────────────────────────────────────────────────
  if (authLoading) return <ThreadSkeleton />

  if (!uid) {
    return (
      <CenteredNotice
        title="Sign in to view messages"
        body="You need to be signed in to open this conversation."
        action={<Link href="/login" className="btn-accent text-sm">Sign in</Link>}
      />
    )
  }

  if (error || (conversation && !isParticipant)) {
    return (
      <CenteredNotice
        title="Conversation unavailable"
        body={error ?? "You don't have access to this conversation."}
        action={<Link href="/messages" className="btn-ghost text-sm">Back to messages</Link>}
      />
    )
  }

  if (!conversation) return <ThreadSkeleton />

  const otherName = other?.displayName ?? 'Conversation'

  return (
    <div className="flex h-full w-full flex-col bg-bg-card">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-bg-border px-4 py-2.5">
        <Link href="/messages" aria-label="Back to messages" className="btn-ghost rounded-lg p-1.5 md:hidden">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        {otherUid ? (
          <Link
            href={`/profile/${otherUid}`}
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Avatar src={other?.photoURL} name={otherName} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{otherName}</p>
              {/* Online presence is future-ready — no live status yet. */}
              <p className="truncate text-xs text-text-muted">
                {otherTyping ? <span className="text-accent">typing…</span> : `@${otherUid.slice(0, 8)}`}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar src={null} name={otherName} size={38} />
            <p className="text-sm font-semibold text-text">{otherName}</p>
          </div>
        )}

        {/* Voice / video placeholders (future) */}
        <div className="ml-auto flex items-center gap-1">
          <PlaceholderButton label="Voice call — coming soon" icon={<Phone size={17} aria-hidden="true" />} />
          <PlaceholderButton label="Video call — coming soon" icon={<Video size={17} aria-hidden="true" />} />
        </div>
      </header>

      {/* Messages */}
      <div
        className="flex-1 space-y-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-bg-border"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${otherName}`}
      >
        {canLoadOlder && (
          <div className="pb-2 text-center">
            <button
              type="button"
              onClick={loadOlder}
              className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-text-muted">
            <MessageCircleOff size={32} className="mb-3 opacity-60" aria-hidden="true" />
            <p className="text-sm">Send your first message.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === uid
            const prev = messages[i - 1]
            const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                )}
                <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  {m.type === 'image' && m.imageURL ? (
                    <ImageBubble message={m} mine={mine} />
                  ) : (
                    <div
                      className={cn(
                        'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm',
                        mine ? 'rounded-br-sm bg-accent text-accent-foreground' : 'rounded-bl-sm bg-bg-elevated text-text'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <MessageTime ts={m.createdAt} mine={mine} className="mt-0.5 block text-right" />
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Read receipt under my latest message */}
        {seenByOther && (
          <div className="flex items-center justify-end gap-1 pr-1 text-[11px] text-text-muted">
            <CheckCheck size={12} aria-hidden="true" /> Seen
          </div>
        )}

        {/* Typing indicator */}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-bg-elevated px-3.5 py-2.5" aria-label={`${otherName} is typing`}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5 border-t border-bg-border p-3">
        <EmojiPicker onSelect={insertEmoji} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Attach an image"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImagePick(f) }}
        />
        <Tooltip label="Attach image">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach image"
            className="btn-ghost rounded-lg p-2 text-text-muted hover:text-text disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
          </button>
        </Tooltip>
        <label htmlFor="message-input" className="sr-only">Message</label>
        <textarea
          id="message-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); notifyTyping(); autoGrow() }}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Write a message…"
          className="input-base max-h-32 flex-1 resize-none py-2"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send message"
          className="btn-accent shrink-0 rounded-full p-2.5 disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
        </button>
      </form>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function PlaceholderButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-disabled="true"
        aria-label={label}
        className="btn-ghost rounded-lg p-2 text-text-muted opacity-60"
        onClick={() => toast('Coming soon')}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

function ImageBubble({ message, mine }: { message: ConversationMessage; mine: boolean }) {
  const iw = message.imageWidth && message.imageWidth > 0 ? message.imageWidth : 4
  const ih = message.imageHeight && message.imageHeight > 0 ? message.imageHeight : 3
  const dispW = Math.min(240, iw)
  const dispH = Math.max(1, Math.round(dispW * (ih / iw)))
  const time = timeLabel(message.createdAt)
  // `imageURL` comes straight off the message document. Firestore rules bound it
  // to a string under 2000 chars but cannot check its SCHEME, and the sender is
  // an untrusted counterparty — so `javascript:...` in this href would be a
  // click-to-execute XSS on the recipient. Anything that is not an http(s) URL
  // renders as a non-link.
  const href = safeHttpUrl(message.imageURL)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open shared image in a new tab"
      className={cn(
        'relative block overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        mine ? 'rounded-br-sm' : 'rounded-bl-sm'
      )}
    >
      <Image
        src={href}
        alt="Shared image"
        width={dispW}
        height={dispH}
        className="h-auto max-w-full object-cover"
      />
      {/* Time overlaid on the image with a scrim for legibility (WhatsApp-style). */}
      {time && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/55 to-transparent px-2 pb-1 pt-5">
          <time dateTime={isoLabel(message.createdAt)} className="text-[10px] leading-none tabular-nums text-white/90">
            {time}
          </time>
        </span>
      )}
    </a>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
    </span>
  )
}

/** Small per-bubble timestamp, e.g. "10:30 PM". Hidden while a message is still
 *  pending (no server timestamp yet), so nothing renders until it resolves. */
function MessageTime({ ts, mine, className }: { ts: FirestoreTimestamp | null; mine: boolean; className?: string }) {
  const label = timeLabel(ts)
  if (!label) return null
  return (
    <time
      dateTime={isoLabel(ts)}
      className={cn(
        'text-[10px] leading-none tabular-nums',
        mine ? 'text-accent-foreground/70' : 'text-text-muted',
        className
      )}
    >
      {label}
    </time>
  )
}

function timeLabel(ts: FirestoreTimestamp | null): string {
  if (!ts?.seconds) return ''
  return new Date(ts.seconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isoLabel(ts: FirestoreTimestamp | null): string | undefined {
  return ts?.seconds ? new Date(ts.seconds * 1000).toISOString() : undefined
}

function dayKey(ts: FirestoreTimestamp | null): string {
  if (!ts?.seconds) return 'pending'
  return new Date(ts.seconds * 1000).toDateString()
}

function dayLabel(ts: FirestoreTimestamp | null): string {
  if (!ts?.seconds) return ''
  const d = new Date(ts.seconds * 1000)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

function ThreadSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-bg-card">
      <div className="flex items-center gap-3 border-b border-bg-border px-4 py-2.5">
        <div className="h-9 w-9 animate-pulse rounded-full bg-bg-elevated" />
        <div className="h-4 w-32 animate-pulse rounded bg-bg-elevated" />
      </div>
      <div className="flex-1 space-y-3 p-4">
        {['w-3/5', 'w-2/5', 'w-3/4', 'w-1/2', 'w-8/12'].map((w, i) => (
          <div key={w} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
            <div className={cn('h-9 animate-pulse rounded-2xl bg-bg-elevated', w)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CenteredNotice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-bg-card px-6 py-16 text-center">
      <h1 className="mb-2 text-lg font-bold text-text">{title}</h1>
      <p className="mb-5 max-w-sm text-sm text-text-secondary">{body}</p>
      {action}
    </div>
  )
}

// Keep an unused import from tripping tree-shakers off — ConversationMessage is
// referenced only via the hook's types, re-exported here for clarity.
export type { ConversationMessage }
