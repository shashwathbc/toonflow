import type { FirestoreTimestamp } from './user'

/** What kind of engagement produced the notification. A follow/subscribe is a
 * single action in this app (see followUser) and maps to `'follow'`. A
 * `'message'` notification collapses per conversation (see notifyMessage). */
export type NotificationType = 'follow' | 'like' | 'comment' | 'message'

/** Content a like/comment notification points at. */
export type NotificationTargetType =
  | 'novel'
  | 'webtoon'
  | 'chapter'
  | 'episode'
  // Marketplace listings notify their creator on the same path as stories.
  | 'artwork'
  | 'product'

/**
 * A live in-app notification, stored under `users/{recipientId}/notifications`.
 * The actor's name/photo and the target title are denormalized so the bell can
 * render the whole feed without any secondary reads.
 */
export interface AppNotification {
  id: string
  type: NotificationType
  /** uid of the person who triggered the notification. */
  actorId: string
  actorName: string
  actorPhotoURL: string | null
  /** Present for like/comment notifications (absent for follows). */
  targetType?: NotificationTargetType
  targetId?: string
  targetTitle?: string
  /** Comment body snippet (comment notifications only). */
  preview?: string
  /** In-app route opened when the notification is clicked. */
  link: string
  read: boolean
  createdAt: FirestoreTimestamp | null
}
