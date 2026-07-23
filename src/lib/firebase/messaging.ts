import {
  doc,
  collection,
  runTransaction,
  writeBatch,
  updateDoc,
  serverTimestamp,
  increment,
  onSnapshot,
  query,
  orderBy,
  limitToLast,
  type FirestoreError,
} from 'firebase/firestore'
import { db } from './db'
import type { Conversation, ConversationMessage } from '@/types'

export const MESSAGE_MAX_LENGTH = 5000
export const THREAD_WINDOW = 50
/** A `typing` timestamp within this many ms of now means the user is typing. */
export const TYPING_TTL_MS = 5000

export const NOT_FRIENDS_ERROR = 'You can message only users who follow you back.'

/**
 * Deterministic 1:1 conversation id: the two uids sorted and joined with `_`.
 * Firebase Auth uids are alphanumeric (no `_`), so this is reversible by split
 * and lets "open existing or create" be a single doc read with no query/index.
 */
export function conversationIdFor(a: string, b: string): string {
  return [a, b].sort().join('_')
}

/**
 * Open the existing conversation between two users, or create it. Creation is
 * gated on a mutual follow (both `follows` edges must exist) — enforced here in
 * a transaction AND independently by the Firestore rules. Returns the id to
 * navigate to (`/messages/{id}`).
 */
export async function getOrCreateConversation(
  viewerId: string,
  otherId: string
): Promise<string> {
  if (viewerId === otherId) throw new Error('You cannot message yourself')
  const cid = conversationIdFor(viewerId, otherId)
  const convRef = doc(db, 'conversations', cid)

  await runTransaction(db, async (tx) => {
    const convSnap = await tx.get(convRef)
    if (convSnap.exists()) return // already exists — nothing to write

    // Reads must precede writes: confirm the mutual follow before creating.
    const [aFollowsB, bFollowsA] = await Promise.all([
      tx.get(doc(db, 'follows', `${viewerId}_${otherId}`)),
      tx.get(doc(db, 'follows', `${otherId}_${viewerId}`)),
    ])
    if (!aFollowsB.exists() || !bFollowsA.exists()) {
      throw new Error(NOT_FRIENDS_ERROR)
    }

    tx.set(convRef, {
      participants: [viewerId, otherId].sort(),
      lastMessage: null,
      unreadCount: { [viewerId]: 0, [otherId]: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  return cid
}

/**
 * Append a message and update the conversation preview + the recipient's unread
 * counter in one atomic batch. The recipient is derived from the deterministic
 * conversation id (no extra read needed).
 */
export async function sendMessage(cid: string, senderId: string, text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Message cannot be empty')
  if (trimmed.length > MESSAGE_MAX_LENGTH) throw new Error('Message is too long')

  const participants = cid.split('_')
  if (!participants.includes(senderId)) {
    throw new Error('You are not a participant of this conversation')
  }
  const other = participants.find((p) => p !== senderId)
  if (!other) throw new Error('Invalid conversation')

  const batch = writeBatch(db)
  const msgRef = doc(collection(db, 'conversations', cid, 'messages'))
  batch.set(msgRef, { senderId, text: trimmed, type: 'text', createdAt: serverTimestamp() })
  batch.update(doc(db, 'conversations', cid), {
    lastMessage: { text: trimmed, senderId, createdAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
    [`unreadCount.${other}`]: increment(1),
    // Sending clears our own typing flag so the peer stops seeing "typing…".
    [`typing.${senderId}`]: 0,
  })
  await batch.commit()
}

/** Send an image message (uploaded URL + intrinsic dimensions). Mirrors
 * {@link sendMessage} for the conversation-doc bookkeeping. */
export async function sendImageMessage(
  cid: string,
  senderId: string,
  image: { url: string; width: number; height: number }
): Promise<void> {
  const participants = cid.split('_')
  if (!participants.includes(senderId)) {
    throw new Error('You are not a participant of this conversation')
  }
  const other = participants.find((p) => p !== senderId)
  if (!other) throw new Error('Invalid conversation')

  const batch = writeBatch(db)
  const msgRef = doc(collection(db, 'conversations', cid, 'messages'))
  batch.set(msgRef, {
    senderId,
    text: '',
    type: 'image',
    imageURL: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'conversations', cid), {
    lastMessage: { text: '📷 Photo', senderId, createdAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
    [`unreadCount.${other}`]: increment(1),
    [`typing.${senderId}`]: 0,
  })
  await batch.commit()
}

/** Zero the viewer's unread counter. Intentionally does NOT touch updatedAt so
 * reading a thread never reorders a future inbox. */
export async function markConversationRead(cid: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', cid), { [`unreadCount.${uid}`]: 0 })
}

/** Best-effort typing signal: stamps (or clears) `typing.{uid}` on the
 * conversation. Callers throttle this; failures are non-fatal. */
export async function setTyping(cid: string, uid: string, isTyping: boolean): Promise<void> {
  await updateDoc(doc(db, 'conversations', cid), {
    [`typing.${uid}`]: isTyping ? Date.now() : 0,
  })
}

/** Live subscription to the last `windowSize` messages, oldest first. */
export function listenMessages(
  cid: string,
  onChange: (messages: ConversationMessage[]) => void,
  onError?: (err: FirestoreError) => void,
  windowSize: number = THREAD_WINDOW
): () => void {
  const q = query(
    collection(db, 'conversations', cid, 'messages'),
    orderBy('createdAt', 'asc'),
    limitToLast(windowSize)
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConversationMessage, 'id'>) }))),
    onError
  )
}

/** Live subscription to the conversation doc (participants, unread, preview). */
export function listenConversation(
  cid: string,
  onChange: (conversation: Conversation | null) => void,
  onError?: (err: FirestoreError) => void
): () => void {
  return onSnapshot(
    doc(db, 'conversations', cid),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Conversation, 'id'>) }) : null),
    onError
  )
}
