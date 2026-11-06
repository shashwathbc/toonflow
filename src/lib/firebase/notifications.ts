import {
  collection, addDoc, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch,
  query, where, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from './db'
import type { NotificationType, NotificationTargetType } from '@/types'

// ── Notifications ─────────────────────────────────────────────
// Live in-app notifications live under `users/{recipientId}/notifications`.
// They're written cross-user by the ACTOR (Firestore rules bind actorId to the
// caller and cap the payload), mirroring how the followers subcollection and
// conversation unread counters are written. Nothing money- or role-sensitive
// lives here, so a client write is the right trust level.

/** Denormalized snapshot of the person who triggered a notification. */
export interface NotificationActor {
  uid: string
  displayName: string
  photoURL?: string | null
}

interface CreateNotificationInput {
  recipientId: string | null | undefined
  actor: NotificationActor | null | undefined
  type: NotificationType
  link: string
  targetType?: NotificationTargetType
  targetId?: string
  targetTitle?: string
  preview?: string
  /** Fixed doc id → the notification collapses (overwrites) instead of stacking.
   * Used for message notifications so a chatty thread is one bell entry. */
  docId?: string
}

/**
 * Best-effort write of a notification into the recipient's feed. NEVER throws —
 * a notification failure must not roll back the follow/like/comment that
 * triggered it. No-ops when the actor would be notifying themselves.
 */
async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { recipientId, actor } = input
  if (!recipientId || !actor?.uid || recipientId === actor.uid) return

  const data: Record<string, unknown> = {
    type: input.type,
    actorId: actor.uid,
    actorName: (actor.displayName || 'Someone').slice(0, 120),
    actorPhotoURL: actor.photoURL ?? null,
    link: input.link.slice(0, 300),
    read: false,
    createdAt: serverTimestamp(),
  }
  if (input.targetType) data.targetType = input.targetType
  if (input.targetId) data.targetId = input.targetId
  if (input.targetTitle) data.targetTitle = input.targetTitle.slice(0, 140)
  if (input.preview) data.preview = input.preview.replace(/\s+/g, ' ').trim().slice(0, 280)

  try {
    if (input.docId) {
      // Deterministic id → overwrite the existing entry (collapse) and re-surface it.
      await setDoc(doc(db, 'users', recipientId, 'notifications', input.docId), data)
    } else {
      await addDoc(collection(db, 'users', recipientId, 'notifications'), data)
    }
  } catch (e) {
    console.error('[notifications] create failed:', e)
  }
}

/** Someone followed/subscribed to `recipientId`. */
export function notifyFollow(recipientId: string, actor: NotificationActor): Promise<void> {
  return createNotification({
    recipientId,
    actor,
    type: 'follow',
    link: `/profile/${actor.uid}`,
  })
}

/** Build the reader/detail route for a piece of content. */
function contentLink(
  contentType: NotificationTargetType,
  contentId: string,
  parentId?: string,
): string {
  switch (contentType) {
    case 'novel': return `/novel/${contentId}`
    case 'webtoon': return `/webtoon/${contentId}`
    case 'chapter': return `/novel/${parentId}/chapter/${contentId}`
    case 'episode': return `/webtoon/${parentId}/episode/${contentId}`
    case 'artwork': return `/artwork/${contentId}`
    case 'product': return `/product/${contentId}`
  }
}

/** Someone liked one of `recipientId`'s works. */
export function notifyLike(params: {
  recipientId: string
  actor: NotificationActor
  contentType: NotificationTargetType
  contentId: string
  /** novelId / webtoonId — required to deep-link a chapter/episode like. */
  parentId?: string
  title?: string
}): Promise<void> {
  const { recipientId, actor, contentType, contentId, parentId, title } = params
  return createNotification({
    recipientId,
    actor,
    type: 'like',
    link: contentLink(contentType, contentId, parentId),
    targetType: contentType,
    targetId: contentId,
    targetTitle: title,
  })
}

/** Someone commented on one of `recipientId`'s works. */
export function notifyComment(params: {
  recipientId: string
  actor: NotificationActor
  targetType: NotificationTargetType
  targetId: string
  parentId?: string
  title?: string
  /** The comment body — shown as a snippet in the feed. */
  preview: string
  /** Explicit canonical link (the page knows its own URL); overrides the derived one. */
  link?: string
}): Promise<void> {
  const { recipientId, actor, targetType, targetId, parentId, title, preview, link } = params
  return createNotification({
    recipientId,
    actor,
    type: 'comment',
    link: link ?? contentLink(targetType, targetId, parentId),
    targetType,
    targetId,
    targetTitle: title,
    preview,
  })
}

/** Deterministic notification id for a conversation's message notification, so
 * every message in a thread collapses into ONE bell entry. */
function messageNotificationId(cid: string): string {
  return `msg_${cid}`
}

/**
 * Someone sent `recipientId` a message. Collapses per conversation (fixed id):
 * a new message overwrites the same entry with the latest preview and re-marks
 * it unread, rather than stacking a fresh notification for every message.
 */
export function notifyMessage(params: {
  recipientId: string
  actor: NotificationActor
  conversationId: string
  /** Latest message text (or e.g. "📷 Photo" for an image). */
  preview: string
}): Promise<void> {
  const { recipientId, actor, conversationId, preview } = params
  return createNotification({
    recipientId,
    actor,
    type: 'message',
    link: `/messages/${conversationId}`,
    preview,
    docId: messageNotificationId(conversationId),
  })
}

/** Mark a conversation's message notification read (e.g. when the thread is
 * opened). Best-effort — the entry may not exist yet. */
export async function markMessageNotificationRead(uid: string, conversationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', messageNotificationId(conversationId)), { read: true })
  } catch {
    /* no notification for this thread yet — nothing to mark */
  }
}

// ── Reader-side mutations (owner only) ───────────────────────

/** Flip a single notification to read. */
export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true })
}

/** Flip every currently-unread notification to read in one batch. */
export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'notifications'), where('read', '==', false), limit(400)),
  )
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}

/** Remove a single notification from the feed. */
export async function deleteNotification(uid: string, notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'notifications', notificationId))
}
