import type { FirestoreTimestamp } from './user'

export interface Comment {
  id: string
  targetId: string
  targetType: 'novel' | 'webtoon' | 'chapter' | 'episode'
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  content: string
  likeCount: number
  isEdited: boolean
  parentId: string | null
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

export interface Report {
  id: string
  targetId: string
  targetType: 'novel' | 'webtoon' | 'comment' | 'user'
  reporterId: string
  reason: string
  details?: string
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  createdAt: FirestoreTimestamp
  reviewedAt?: FirestoreTimestamp
  reviewedBy?: string
}
