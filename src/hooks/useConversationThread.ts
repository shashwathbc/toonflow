'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FirestoreError } from 'firebase/firestore'
import {
  listenMessages,
  listenConversation,
  sendMessage,
  markConversationRead,
  setTyping,
  THREAD_WINDOW,
  TYPING_TTL_MS,
} from '@/lib/firebase/messaging'
import type { Conversation, ConversationMessage } from '@/types'

export interface UseConversationThreadResult {
  conversation: Conversation | null
  messages: ConversationMessage[]
  loading: boolean
  /** Non-null when the thread can't be read (permission denied / network). */
  error: string | null
  /** True once the conversation doc has loaded and the viewer is a participant. */
  isParticipant: boolean
  /** The other participant's uid (once the conversation is known). */
  otherUid: string | null
  /** The other participant is currently typing. */
  otherTyping: boolean
  /** True when the other participant has read up to the latest message. */
  seenByOther: boolean
  /** There may be older messages beyond the loaded window. */
  canLoadOlder: boolean
  send: (text: string) => Promise<void>
  markRead: () => void
  loadOlder: () => void
  /** Throttled typing signal (call on input). */
  notifyTyping: () => void
  /** Clear our typing flag (call on blur). */
  stopTyping: () => void
}

function mapError(err: FirestoreError): string {
  if (err.code === 'permission-denied') return "You don't have access to this conversation."
  return 'Something went wrong loading this conversation.'
}

const TYPING_THROTTLE_MS = 4000

/**
 * Live 1:1 conversation thread. Subscribes to the conversation doc and the last
 * `windowSize` messages, and exposes send, markRead, typing signals, a derived
 * typing/seen state, and load-older (grows the message window).
 */
export function useConversationThread(
  cid: string,
  viewerId: string | null | undefined
): UseConversationThreadResult {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowSize, setWindowSize] = useState(THREAD_WINDOW)
  const [otherTyping, setOtherTyping] = useState(false)
  const lastTypingWrite = useRef(0)

  // Messages subscription (re-subscribes when the window grows).
  useEffect(() => {
    if (!cid) return
    const unsub = listenMessages(
      cid,
      (m) => { setMessages(m); setLoading(false) },
      (e) => { setError(mapError(e)); setLoading(false) },
      windowSize
    )
    return () => unsub()
  }, [cid, windowSize])

  // Conversation doc subscription.
  useEffect(() => {
    if (!cid) return
    const unsub = listenConversation(
      cid,
      (c) => setConversation(c),
      (e) => { setError(mapError(e)); setLoading(false) }
    )
    return () => unsub()
  }, [cid])

  const otherUid = useMemo(
    () => (conversation && viewerId ? conversation.participants.find((p) => p !== viewerId) ?? null : null),
    [conversation, viewerId]
  )

  const isParticipant = !!viewerId && !!conversation?.participants.includes(viewerId)

  // Typing indicator is time-sensitive (a stamp expires after TYPING_TTL_MS), so
  // it's recomputed on an interval inside the effect — never with Date.now()
  // during render. setState happens only in async callbacks.
  useEffect(() => {
    let cancelled = false
    const compute = () => {
      if (cancelled) return
      const ts = otherUid ? conversation?.typing?.[otherUid] ?? 0 : 0
      setOtherTyping(ts > 0 && Date.now() - ts < TYPING_TTL_MS)
    }
    const initial = setTimeout(compute, 0) // async → not a synchronous effect setState
    const id = setInterval(compute, 1500)
    return () => { cancelled = true; clearTimeout(initial); clearInterval(id) }
  }, [conversation, otherUid])

  // "Seen" = the other participant has no unread left AND the newest message is mine.
  const seenByOther = useMemo(() => {
    if (!conversation || !otherUid || messages.length === 0) return false
    const last = messages[messages.length - 1]
    return last.senderId === viewerId && (conversation.unreadCount?.[otherUid] ?? 0) === 0
  }, [conversation, otherUid, messages, viewerId])

  const send = useCallback(
    async (text: string) => {
      if (!viewerId) throw new Error('You must be signed in to send messages')
      await sendMessage(cid, viewerId, text)
    },
    [cid, viewerId]
  )

  const markRead = useCallback(() => {
    if (!viewerId) return
    markConversationRead(cid, viewerId).catch((e) => console.error('[useConversationThread] markRead failed:', e))
  }, [cid, viewerId])

  const notifyTyping = useCallback(() => {
    if (!viewerId) return
    const now = Date.now()
    if (now - lastTypingWrite.current < TYPING_THROTTLE_MS) return
    lastTypingWrite.current = now
    setTyping(cid, viewerId, true).catch(() => {})
  }, [cid, viewerId])

  const stopTyping = useCallback(() => {
    if (!viewerId) return
    lastTypingWrite.current = 0
    setTyping(cid, viewerId, false).catch(() => {})
  }, [cid, viewerId])

  const loadOlder = useCallback(() => setWindowSize((w) => w + THREAD_WINDOW), [])
  const canLoadOlder = messages.length >= windowSize

  return {
    conversation,
    messages,
    loading,
    error,
    isParticipant,
    otherUid,
    otherTyping,
    seenByOther,
    canLoadOlder,
    send,
    markRead,
    loadOlder,
    notifyTyping,
    stopTyping,
  }
}
