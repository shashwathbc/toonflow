import {
  doc, getDoc, setDoc, deleteDoc, updateDoc,
  collection, getDocs, query, where, limit,
  increment, serverTimestamp, addDoc, runTransaction,
} from 'firebase/firestore'
import { db } from './db'
import type { Comment } from '@/types'

// ── View Tracking ────────────────────────────────────────────
// Views are recorded SERVER-SIDE via POST /api/views (see
// src/hooks/useViewTracking.ts). Client code must never write viewCount
// directly — Firestore rules reject it.

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

// ── Rating System ─────────────────────────────────────────────
// Ratings stored as `ratings/{uid}_{contentType}_{contentId}` (value 1–5);
// content doc keeps the aggregate `rating` (average) + `ratingCount`.

function ratingDocId(uid: string, contentType: string, contentId: string) {
  return `${uid}_${contentType}_${contentId}`
}

export interface RatingResult {
  rating: number
  ratingCount: number
  userRating: number | null
}

/** Set (or update) the user's 1–5 star rating. Re-selecting the same value clears it. */
export async function setRating(
  uid: string,
  contentType: 'novel' | 'webtoon',
  contentId: string,
  value: number,
): Promise<RatingResult> {
  const ratingRef = doc(db, 'ratings', ratingDocId(uid, contentType, contentId))
  const cRef = doc(db, contentType === 'novel' ? 'novels' : 'webtoons', contentId)

  return runTransaction(db, async (tx) => {
    const [rSnap, cSnap] = await Promise.all([tx.get(ratingRef), tx.get(cRef)])
    if (!cSnap.exists()) throw new Error('Content not found')

    const count = (cSnap.data().ratingCount as number) ?? 0
    let sum = ((cSnap.data().rating as number) ?? 0) * count
    let newCount = count
    let userRating: number | null = value

    if (rSnap.exists()) {
      const prev = (rSnap.data().value as number) ?? 0
      if (prev === value) {
        // Same star clicked again → remove the rating
        tx.delete(ratingRef)
        sum -= prev
        newCount = Math.max(0, count - 1)
        userRating = null
      } else {
        tx.update(ratingRef, { value, updatedAt: serverTimestamp() })
        sum += value - prev
      }
    } else {
      tx.set(ratingRef, {
        uid, contentType, contentId, value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      sum += value
      newCount = count + 1
    }

    const rating = newCount > 0 ? Math.round((sum / newCount) * 10) / 10 : 0
    tx.update(cRef, { rating, ratingCount: newCount })
    return { rating, ratingCount: newCount, userRating }
  })
}

export async function getUserRating(
  uid: string,
  contentType: 'novel' | 'webtoon',
  contentId: string,
): Promise<number | null> {
  const snap = await getDoc(doc(db, 'ratings', ratingDocId(uid, contentType, contentId)))
  return snap.exists() ? ((snap.data().value as number) ?? null) : null
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
