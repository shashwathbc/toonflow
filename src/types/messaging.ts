import type { FirestoreTimestamp } from './user'

/** Denormalized preview of the most recent message, stored on the conversation
 * doc so an inbox/thread header can render without reading the messages
 * subcollection. Null until the first message is sent. */
export interface ConversationPreview {
  text: string
  senderId: string
  createdAt: FirestoreTimestamp
}

/**
 * A 1:1 conversation. The doc id is deterministic — the two participant uids
 * sorted and joined with `_` (see conversationIdFor) — so "open existing or
 * create" is a single doc read with no query or index.
 */
export interface Conversation {
  id: string
  /** Exactly two uids, sorted ascending (matches the doc id). */
  participants: string[]
  lastMessage: ConversationPreview | null
  /** Per-participant unread counter, keyed by uid. */
  unreadCount: Record<string, number>
  /** Per-participant "last typed at" epoch ms; used to show a typing indicator
   * (a value within a few seconds of now means that user is typing). */
  typing?: Record<string, number>
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

/** A single immutable message inside conversations/{id}/messages. */
export interface ConversationMessage {
  id: string
  senderId: string
  /** Body text; may be empty for an image-only message. */
  text: string
  /** Message kind. */
  type?: 'text' | 'image'
  /** Download URL for an image message (type === 'image'). */
  imageURL?: string
  /** Intrinsic image dimensions, so the bubble reserves the right box. */
  imageWidth?: number
  imageHeight?: number
  createdAt: FirestoreTimestamp | null
}
