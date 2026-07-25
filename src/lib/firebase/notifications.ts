import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch,
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
    await addDoc(collection(db, 'users', recipientId, 'notifications'), data)
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
