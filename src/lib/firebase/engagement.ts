import {
  doc, getDoc, setDoc, deleteDoc, updateDoc,
  collection, getDocs, query, where, limit,
  increment, serverTimestamp, addDoc,
} from 'firebase/firestore'
import { db } from './config'
import type { Comment } from '@/types'

// ── View Tracking ────────────────────────────────────────────
// Dedup: one view per user (or anon session) per content per UTC day.

function todayKey() {
  return new Date().toISOString().slice(0, 10) // "2026-06-27"
}

function getAnonId(): string {
  const key = 'tf_anon_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
}

/** Call once when the reader mounts. Returns true if a new view was counted. */
export async function trackView(
  contentId: string,
  contentType: 'novel' | 'webtoon' | 'chapter' | 'episode',
  parentId: string | null, // novelId or webtoonId for chapters/episodes
  uid: string | null,
): Promise<boolean> {
  const viewerId = uid ?? getAnonId()
  const localKey = `tf_view_${contentId}_${todayKey()}`

  // Prevent counting multiple times in the same browser session today
  if (typeof window !== 'undefined' && localStorage.getItem(localKey)) return false

  const viewDocId = `${viewerId}_${contentId}_${todayKey()}`
  const viewRef = doc(db, 'views', viewDocId)

  try {
    const snap = await getDoc(viewRef)
    if (snap.exists()) {
      if (typeof window !== 'undefined') localStorage.setItem(localKey, '1')
      return false
    }

    // Record the view
    await setDoc(viewRef, {
      viewerId,
      contentId,
      contentType,
      parentId,
      date: todayKey(),
      createdAt: serverTimestamp(),
    })

    // Increment viewCount on the content
    const collName = contentType === 'chapter'
      ? `novels/${parentId}/chapters`
      : contentType === 'episode'
      ? `webtoons/${parentId}/episodes`
      : contentType === 'novel' ? 'novels' : 'webtoons'

    await updateDoc(doc(db, collName, contentId), { viewCount: increment(1) })

    // Also increment viewCount on parent novel/webtoon
    if (parentId && (contentType === 'chapter' || contentType === 'episode')) {
      const parentColl = contentType === 'chapter' ? 'novels' : 'webtoons'
      await updateDoc(doc(db, parentColl, parentId), { viewCount: increment(1) })
    }

    if (typeof window !== 'undefined') localStorage.setItem(localKey, '1')
    return true
  } catch {
    return false
  }
}

// ── Like System ───────────────────────────────────────────────
// Likes stored as `likes/{uid}_{contentType}_{contentId}`.

function likeDocId(uid: string, contentType: string, contentId: string) {
  return `${uid}_${contentType}_${contentId}`
}

function contentRef(contentType: 'novel' | 'webtoon' | 'chapter' | 'episode', contentId: string, parentId?: string) {
  if (contentType === 'chapter' && parentId) return doc(db, 'novels', parentId, 'chapters', contentId)
  if (contentType === 'episode' && parentId) return doc(db, 'webtoons', parentId, 'episodes', contentId)
  if (contentType === 'novel') return doc(db, 'novels', contentId)
  return doc(db, 'webtoons', contentId)
}

export async function toggleLike(
  uid: string,
  contentType: 'novel' | 'webtoon' | 'chapter' | 'episode' | 'comment',
  contentId: string,
  parentId?: string,
): Promise<boolean> {
  const likeRef = doc(db, 'likes', likeDocId(uid, contentType, contentId))
  const snap = await getDoc(likeRef)

  if (snap.exists()) {
    await deleteDoc(likeRef)
    if (contentType === 'comment') {
      await updateDoc(doc(db, 'comments', contentId), { likeCount: increment(-1) })
    } else {
      await updateDoc(contentRef(contentType as 'novel' | 'webtoon' | 'chapter' | 'episode', contentId, parentId), { likeCount: increment(-1) })
    }
    return false
  } else {
    await setDoc(likeRef, {
      uid,
      contentType,
      contentId,
      parentId: parentId ?? null,
      createdAt: serverTimestamp(),
    })
    if (contentType === 'comment') {
      await updateDoc(doc(db, 'comments', contentId), { likeCount: increment(1) })
    } else {
      await updateDoc(contentRef(contentType as 'novel' | 'webtoon' | 'chapter' | 'episode', contentId, parentId), { likeCount: increment(1) })
    }
    return true
  }
}

export async function isLiked(uid: string, contentType: string, contentId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'likes', likeDocId(uid, contentType, contentId)))
  return snap.exists()
}

export async function getLikedIds(uid: string, contentType: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const results = await Promise.all(
    ids.map((id) => getDoc(doc(db, 'likes', likeDocId(uid, contentType, id))))
  )
  return new Set(ids.filter((_, i) => results[i].exists()))
}

// ── Comment Replies ──────────────────────────────────────────

export async function getReplies(parentCommentId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'comments'),
    where('parentId', '==', parentCommentId),
    limit(50),
  )
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Comment)
    .sort((a, b) => {
      const ts = (v: unknown) => (v && typeof v === 'object' && 'seconds' in (v as object)) ? (v as { seconds: number }).seconds : 0
      return ts(a.createdAt) - ts(b.createdAt)
    })
}

export async function addReply(
  data: Omit<Comment, 'id' | 'likeCount' | 'isEdited' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'comments'), {
    ...data,
    likeCount: 0,
    isEdited: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}
