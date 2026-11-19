import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  writeBatch,
  runTransaction,
  type QueryDocumentSnapshot,
  type DocumentData,
  type FirestoreError,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './db'
import { reconcileViewCount } from '@/lib/views/reconcileClient'
import type { User as FirebaseUser } from 'firebase/auth'
import type {
  UserProfile,
  UserRole,
  Novel,
  Chapter,
  Webtoon,
  Episode,
  Comment,
  Report,
  Withdrawal,
  BookmarkItem,
  ReadingHistoryItem,
  FollowRecord,
  Transaction,
  FirestoreTimestamp,
  CanvasProject,
  Character,
} from '@/types'
import { SUPER_ADMIN_EMAIL, TRENDING_LIMIT, BROWSE_LIMIT } from '@/lib/utils/constants'
// compareTimestamps here sorts NEWEST first — preserve that by aliasing the
// shared descending comparator.
import { compareTimestampsDesc as compareTimestamps } from '@/lib/utils/timestamps'

function fromDoc<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T
}

// ── Users ──────────────────────────────────────────────────

export async function createUserDocument(
  firebaseUser: FirebaseUser,
  extra?: Partial<UserProfile>
): Promise<void> {
  const ref = doc(db, 'users', firebaseUser.uid)
  const snap = await getDoc(ref)
  const isSuperAdmin = firebaseUser.email === SUPER_ADMIN_EMAIL

  if (snap.exists()) {
    // Backfill fields that older signup flows never wrote — role drives the
    // Firestore rules isAdmin() check and createdAt drives admin list queries.
    const data = snap.data()
    const patch: Record<string, unknown> = {}
    if (!data.role) patch.role = isSuperAdmin ? 'superadmin' : 'user'
    if (isSuperAdmin && data.role !== 'superadmin') patch.role = 'superadmin'
    if (data.isCreator === undefined) patch.isCreator = isSuperAdmin
    if (!data.createdAt) patch.createdAt = serverTimestamp()
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp()
      await setDoc(ref, patch, { merge: true })
    }
    return
  }

  await setDoc(ref, {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: extra?.displayName ?? firebaseUser.displayName ?? 'Anonymous',
    photoURL: firebaseUser.photoURL ?? null,
    bannerURL: null,
    role: isSuperAdmin ? 'superadmin' : 'user',
    isCreator: isSuperAdmin,
    bio: '',
    socialLinks: {},
    followerCount: 0,
    followingCount: 0,
    totalViews: 0,
    totalEarnings: 0,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() })
}

/**
 * Propagate a creator's display name + avatar onto every novel and webtoon they
 * authored. `authorName`/`authorPhotoURL` are denormalized onto content docs for
 * fast reads, so renaming the profile must fan out — otherwise old works keep the
 * stale name. Call after a profile update whenever displayName/photoURL changed.
 */
export async function syncAuthorContent(
  uid: string,
  authorName: string,
  authorPhotoURL: string | null
): Promise<void> {
  const [novels, webtoons] = await Promise.all([
    getDocs(query(collection(db, 'novels'), where('authorId', '==', uid))),
    getDocs(query(collection(db, 'webtoons'), where('authorId', '==', uid))),
  ])

  const refs = [...novels.docs, ...webtoons.docs].map((d) => d.ref)
  if (refs.length === 0) return

  // Firestore caps a batch at 500 writes — chunk to stay safely under.
  const CHUNK = 400
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(i, i + CHUNK)) {
      batch.update(ref, { authorName, authorPhotoURL })
    }
    await batch.commit()
  }
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  const isCreator = ['creator', 'admin', 'superadmin'].includes(role)
  await updateDoc(doc(db, 'users', uid), { role, isCreator, updatedAt: serverTimestamp() })
}

// ── Novels ──────────────────────────────────────────────────

export async function getNovelById(id: string): Promise<Novel | null> {
  const snap = await getDoc(doc(db, 'novels', id))
  return snap.exists() ? fromDoc<Novel>(snap as QueryDocumentSnapshot<DocumentData>) : null
}

export async function createNovel(
  authorId: string,
  authorName: string,
  authorPhotoURL: string | null,
  data: Partial<Omit<Novel, 'id' | 'authorId' | 'authorName' | 'authorPhotoURL' | 'createdAt' | 'updatedAt'>>
): Promise<string> {
  const ref = await addDoc(collection(db, 'novels'), {
    authorId,
    authorName,
    authorPhotoURL,
    title: '',
    slug: '',
    synopsis: '',
    coverURL: null,
    bannerURL: null,
    language: 'en',
    visibility: 'public',
    status: 'draft',
    genres: [],
    tags: [],
    isPremium: false,
    isFeatured: false,
    isOriginal: false,
    viewCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    chapterCount: 0,
    rating: 0,
    ratingCount: 0,
    publishedAt: null,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateNovel(id: string, data: Partial<Novel>): Promise<void> {
  await updateDoc(doc(db, 'novels', id), { ...data, updatedAt: serverTimestamp() })
}

export async function getTrendingNovels(limitCount = TRENDING_LIMIT): Promise<Novel[]> {
  const q = query(
    collection(db, 'novels'),
    where('status', 'in', ['published', 'ongoing']),
    limit(limitCount * 4)
  )
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<Novel>(d))
    .filter((n) => n.visibility === 'public')
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limitCount)
}

export async function getNovelsByAuthor(uid: string): Promise<Novel[]> {
  const q = query(collection(db, 'novels'), where('authorId', '==', uid))
  const snaps = await getDocs(q)
  const novels = snaps.docs.map((d) => fromDoc<Novel>(d))
  novels.sort((a, b) => compareTimestamps(a.createdAt, b.createdAt))
  return novels
}

// ── Chapters ────────────────────────────────────────────────

export async function getChaptersByNovel(novelId: string): Promise<Chapter[]> {
  const q = query(
    collection(db, 'novels', novelId, 'chapters'),
    orderBy('chapterNumber', 'asc')
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Chapter>(d))
}

export async function createChapter(
  novelId: string,
  data: Partial<Chapter>
): Promise<string> {
  const ref = await addDoc(collection(db, 'novels', novelId, 'chapters'), {
    title: '',
    chapterNumber: 1,
    content: '',
    wordCount: 0,
    isPremium: false,
    coinCost: 0,
    viewCount: 0,
    status: 'draft',
    publishedAt: null,
    ...data,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'novels', novelId), {
    chapterCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateChapter(
  novelId: string,
  chapterId: string,
  data: Partial<Chapter>
): Promise<void> {
  await updateDoc(doc(db, 'novels', novelId, 'chapters', chapterId), data)
}

export async function publishChapter(novelId: string, chapterId: string): Promise<void> {
  await updateDoc(doc(db, 'novels', novelId, 'chapters', chapterId), {
    status: 'published',
    publishedAt: serverTimestamp(),
  })
}

export async function unpublishChapter(novelId: string, chapterId: string): Promise<void> {
  await updateDoc(doc(db, 'novels', novelId, 'chapters', chapterId), {
    status: 'draft',
    publishedAt: null,
  })
}

export async function deleteChapter(novelId: string, chapterId: string): Promise<void> {
  await deleteDoc(doc(db, 'novels', novelId, 'chapters', chapterId))
  await updateDoc(doc(db, 'novels', novelId), {
    chapterCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  await reconcileViewCount('novel', novelId)
}

// ── Webtoons ────────────────────────────────────────────────

export async function getWebtoonById(id: string): Promise<Webtoon | null> {
  const snap = await getDoc(doc(db, 'webtoons', id))
  return snap.exists() ? fromDoc<Webtoon>(snap as QueryDocumentSnapshot<DocumentData>) : null
}

export async function createWebtoon(
  authorId: string,
  authorName: string,
  authorPhotoURL: string | null,
  data: Partial<Omit<Webtoon, 'id' | 'authorId' | 'authorName' | 'authorPhotoURL' | 'createdAt' | 'updatedAt'>>
): Promise<string> {
  const ref = await addDoc(collection(db, 'webtoons'), {
    authorId,
    authorName,
    authorPhotoURL,
    title: '',
    slug: '',
    synopsis: '',
    coverURL: null,
    bannerURL: null,
    status: 'draft',
    visibility: 'public',
    genres: [],
    tags: [],
    isPremium: false,
    isFeatured: false,
    isOriginal: false,
    viewCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    episodeCount: 0,
    rating: 0,
    ratingCount: 0,
    publishedAt: null,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateWebtoon(id: string, data: Partial<Webtoon>): Promise<void> {
  await updateDoc(doc(db, 'webtoons', id), { ...data, updatedAt: serverTimestamp() })
}

export async function getTrendingWebtoons(limitCount = TRENDING_LIMIT): Promise<Webtoon[]> {
  const q = query(
    collection(db, 'webtoons'),
    where('status', 'in', ['published', 'ongoing']),
    limit(limitCount * 4)
  )
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<Webtoon>(d))
    .filter((w) => w.visibility === 'public')
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limitCount)
}

export async function getWebtoonsByAuthor(uid: string): Promise<Webtoon[]> {
  const q = query(collection(db, 'webtoons'), where('authorId', '==', uid))
  const snaps = await getDocs(q)
  const webtoons = snaps.docs.map((d) => fromDoc<Webtoon>(d))
  webtoons.sort((a, b) => compareTimestamps(a.createdAt, b.createdAt))
  return webtoons
}

// ── Episodes ────────────────────────────────────────────────

export async function getEpisodesByWebtoon(webtoonId: string): Promise<Episode[]> {
  const q = query(
    collection(db, 'webtoons', webtoonId, 'episodes'),
    orderBy('episodeNumber', 'asc')
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Episode>(d))
}

export async function createEpisode(
  webtoonId: string,
  data: Partial<Episode>
): Promise<string> {
  const ref = await addDoc(collection(db, 'webtoons', webtoonId, 'episodes'), {
    title: '',
    episodeNumber: 1,
    panels: [],
    thumbnailURL: null,
    isPremium: false,
    coinCost: 0,
    viewCount: 0,
    status: 'draft',
    publishedAt: null,
    ...data,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'webtoons', webtoonId), {
    episodeCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

// ── Bookmarks ───────────────────────────────────────────────

export async function toggleBookmark(
  uid: string,
  contentId: string,
  contentType: 'novel' | 'webtoon'
): Promise<boolean> {
  const ref = doc(db, 'bookmarks', uid, 'items', contentId)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await deleteDoc(ref)
    return false
  }
  await setDoc(ref, {
    contentId,
    contentType,
    addedAt: serverTimestamp(),
  })
  return true
}

export async function isBookmarked(uid: string, contentId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'bookmarks', uid, 'items', contentId))
  return snap.exists()
}

export async function getUserBookmarks(uid: string): Promise<BookmarkItem[]> {
  const q = query(
    collection(db, 'bookmarks', uid, 'items'),
    orderBy('addedAt', 'desc'),
    limit(50)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<BookmarkItem>(d))
}

// ── Reading History ─────────────────────────────────────────

export async function upsertReadingHistory(
  uid: string,
  entry: Omit<ReadingHistoryItem, 'id' | 'lastRead'>
): Promise<void> {
  await setDoc(
    doc(db, 'readingHistory', uid, 'items', entry.contentId),
    { ...entry, lastRead: serverTimestamp() },
    { merge: true }
  )
}

export async function getReadingHistory(uid: string, limitCount = 20): Promise<ReadingHistoryItem[]> {
  const q = query(
    collection(db, 'readingHistory', uid, 'items'),
    orderBy('lastRead', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<ReadingHistoryItem>(d))
}

// ── Comments ────────────────────────────────────────────────

export async function getComments(targetId: string, targetType: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'comments'),
    where('targetId', '==', targetId),
    limit(200)
  )
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<Comment>(d))
    .filter((c) => c.targetType === targetType && c.parentId == null)
    .sort((a, b) => compareTimestamps(a.createdAt, b.createdAt))
}

export async function addComment(
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

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', commentId))
}

// ── Browse ──────────────────────────────────────────────────

export interface BrowseOptions {
  contentType?: 'novel' | 'webtoon' | 'all'
  /** Single genre (legacy). Prefer `genres` for multi-select. */
  genre?: string
  /** Any-of genre filter — an item matches when it has ≥1 of these genres. */
  genres?: string[]
  status?: string
  sortBy?: 'trending' | 'newest' | 'rating'
  limitCount?: number
}

export interface BrowseResult {
  novels: Novel[]
  webtoons: Webtoon[]
}

export async function browseContent(options: BrowseOptions = {}): Promise<BrowseResult> {
  const { contentType = 'all', genre, genres, status, sortBy = 'trending', limitCount = BROWSE_LIMIT } = options

  // Normalize to a single any-of genre list (supports the legacy `genre` too).
  const genreList = (genres && genres.length ? genres : genre ? [genre] : []).slice(0, 10)

  const PUBLISHED_STATUSES = ['published', 'ongoing', 'completed']
  const sortKey = sortBy === 'newest' ? 'createdAt' : sortBy === 'rating' ? 'rating' : 'viewCount'

  // Single-field where clause so Firestore auto-indexes handle it;
  // all secondary filters and sorting happen client-side to avoid composite index requirements.
  const fetchCol = async <T extends Novel | Webtoon>(col: string): Promise<T[]> => {
    let q
    if (genreList.length) {
      // array-contains-any = OR across selected genres (max 10 values).
      q = query(collection(db, col), where('genres', 'array-contains-any', genreList), limit(limitCount * 4))
    } else if (status && status !== 'all') {
      q = query(collection(db, col), where('status', '==', status), limit(limitCount * 4))
    } else {
      q = query(collection(db, col), where('visibility', '==', 'public'), limit(limitCount * 4))
    }

    const snaps = await getDocs(q)
    let items = snaps.docs.map((d) => fromDoc<T>(d))

    items = items.filter((item) => (item as Novel).visibility === 'public')
    if (genreList.length) {
      items = items.filter((item) => (item.genres ?? []).some((g) => genreList.includes(g)))
    }
    if (status && status !== 'all') {
      items = items.filter((item) => (item as Novel).status === status)
    } else {
      items = items.filter((item) => PUBLISHED_STATUSES.includes((item as Novel).status))
    }

    items.sort((a, b) => {
      if (sortKey === 'createdAt') {
        return compareTimestamps((a as Novel).createdAt, (b as Novel).createdAt)
      }
      const av = ((a as unknown as Record<string, number>)[sortKey]) ?? 0
      const bv = ((b as unknown as Record<string, number>)[sortKey]) ?? 0
      return bv - av
    })

    return items.slice(0, limitCount)
  }

  const [novels, webtoons] = await Promise.all([
    contentType === 'webtoon' ? ([] as Novel[]) : fetchCol<Novel>('novels'),
    contentType === 'novel' ? ([] as Webtoon[]) : fetchCol<Webtoon>('webtoons'),
  ])

  return { novels, webtoons }
}

// ── Admin ───────────────────────────────────────────────────

export async function getReports(status?: Report['status']): Promise<Report[]> {
  const constraints = status ? [where('status', '==', status)] : []
  const q = query(collection(db, 'reports'), ...constraints, orderBy('createdAt', 'desc'), limit(50))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Report>(d))
}

export async function createReport(
  data: Omit<Report, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'reports'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getWithdrawals(status?: Withdrawal['status']): Promise<Withdrawal[]> {
  const constraints = status ? [where('status', '==', status)] : []
  const q = query(collection(db, 'withdrawals'), ...constraints, orderBy('createdAt', 'desc'), limit(50))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Withdrawal>(d))
}

export async function updateWithdrawal(
  id: string,
  data: Partial<Withdrawal>
): Promise<void> {
  await updateDoc(doc(db, 'withdrawals', id), { ...data, processedAt: serverTimestamp() })
}

// ── Novel Management (extended) ─────────────────────────

export async function deleteNovel(id: string): Promise<void> {
  const chapters = await getChaptersByNovel(id)
  const batch = writeBatch(db)
  chapters.forEach((ch) => {
    batch.delete(doc(db, 'novels', id, 'chapters', ch.id))
  })
  batch.delete(doc(db, 'novels', id))
  await batch.commit()
}

export async function publishNovel(id: string): Promise<void> {
  await updateDoc(doc(db, 'novels', id), {
    status: 'ongoing',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function unpublishNovel(id: string): Promise<void> {
  await updateDoc(doc(db, 'novels', id), {
    status: 'draft',
    publishedAt: null,
    updatedAt: serverTimestamp(),
  })
}

export async function reorderChapters(
  novelId: string,
  chapterIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  chapterIds.forEach((chapterId, index) => {
    batch.update(doc(db, 'novels', novelId, 'chapters', chapterId), {
      chapterNumber: index + 1,
    })
  })
  await batch.commit()
  await updateDoc(doc(db, 'novels', novelId), { updatedAt: serverTimestamp() })
}

export async function duplicateChapter(
  novelId: string,
  chapterId: string,
  afterNumber: number
): Promise<string> {
  const snap = await getDoc(doc(db, 'novels', novelId, 'chapters', chapterId))
  if (!snap.exists()) throw new Error('Chapter not found')
  const data = snap.data() as Chapter
  const ref = await addDoc(collection(db, 'novels', novelId, 'chapters'), {
    title: `${data.title} (Copy)`,
    content: data.content,
    wordCount: data.wordCount,
    chapterNumber: afterNumber + 0.5,
    isPremium: false,
    coinCost: 0,
    viewCount: 0,
    status: 'draft',
    publishedAt: null,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'novels', novelId), {
    chapterCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateChapterContent(
  novelId: string,
  chapterId: string,
  content: string,
  wordCount: number
): Promise<void> {
  await updateDoc(doc(db, 'novels', novelId, 'chapters', chapterId), {
    content,
    wordCount,
    updatedAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'novels', novelId), { updatedAt: serverTimestamp() })
}

// ── Real-time Listeners ─────────────────────────────────

export function subscribeToNovels(
  authorId: string,
  callback: (novels: Novel[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  const q = query(
    collection(db, 'novels'),
    where('authorId', '==', authorId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const novels = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Novel))
      novels.sort((a, b) => compareTimestamps(a.updatedAt, b.updatedAt))
      callback(novels)
    },
    onError
  )
}

export function subscribeToChapters(
  novelId: string,
  callback: (chapters: Chapter[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  const q = query(
    collection(db, 'novels', novelId, 'chapters'),
    orderBy('chapterNumber', 'asc')
  )
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chapter))),
    onError
  )
}

// ── Novel AI Chat ───────────────────────────────────────

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: FirestoreTimestamp
}

export async function getNovelAIChatHistory(novelId: string): Promise<AIMessage[]> {
  const q = query(
    collection(db, 'novel_ai_chats', novelId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() } as AIMessage))
}

export async function addNovelAIMessage(
  novelId: string,
  message: Omit<AIMessage, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'novel_ai_chats', novelId, 'messages'), {
    ...message,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function clearNovelAIChat(novelId: string): Promise<void> {
  const q = query(collection(db, 'novel_ai_chats', novelId, 'messages'))
  const snaps = await getDocs(q)
  const batch = writeBatch(db)
  snaps.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

// ── Webtoon Listeners & Management ──────────────────────

export function subscribeToWebtoons(
  authorId: string,
  callback: (webtoons: Webtoon[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  const q = query(
    collection(db, 'webtoons'),
    where('authorId', '==', authorId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const webtoons = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Webtoon))
      webtoons.sort((a, b) => compareTimestamps(a.updatedAt, b.updatedAt))
      callback(webtoons)
    },
    onError
  )
}

export function subscribeToEpisodes(
  webtoonId: string,
  callback: (episodes: Episode[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  const q = query(
    collection(db, 'webtoons', webtoonId, 'episodes')
  )
  return onSnapshot(
    q,
    (snap) => {
      const episodes = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Episode))
      episodes.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
      callback(episodes)
    },
    onError
  )
}

export async function deleteWebtoon(id: string): Promise<void> {
  const episodes = await getEpisodesByWebtoon(id)
  const batch = writeBatch(db)
  episodes.forEach((ep) => {
    batch.delete(doc(db, 'webtoons', id, 'episodes', ep.id))
  })
  batch.delete(doc(db, 'webtoons', id))
  await batch.commit()
}

export async function publishWebtoon(id: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'webtoons', id), {
    status: 'ongoing',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  // Auto-publish all draft episodes that have at least one panel so the
  // series immediately shows content to readers.
  const episodes = await getEpisodesByWebtoon(id)
  for (const ep of episodes) {
    if (ep.status === 'draft' && (ep.panels?.length ?? 0) > 0) {
      batch.update(doc(db, 'webtoons', id, 'episodes', ep.id), {
        status: 'published',
        publishedAt: serverTimestamp(),
      })
    }
  }
  await batch.commit()
}

export async function unpublishWebtoon(id: string): Promise<void> {
  await updateDoc(doc(db, 'webtoons', id), {
    status: 'draft',
    publishedAt: null,
    updatedAt: serverTimestamp(),
  })
}

export async function publishEpisode(webtoonId: string, episodeId: string): Promise<void> {
  await updateDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId), {
    status: 'published',
    publishedAt: serverTimestamp(),
  })
}

export async function unpublishEpisode(webtoonId: string, episodeId: string): Promise<void> {
  await updateDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId), {
    status: 'draft',
    publishedAt: null,
  })
}

export async function updateEpisode(
  webtoonId: string,
  episodeId: string,
  data: Partial<Episode>
): Promise<void> {
  await updateDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId), data)
  await updateDoc(doc(db, 'webtoons', webtoonId), { updatedAt: serverTimestamp() })
}

/**
 * Autosave the infinite-canvas project for one episode. Writes the rich source
 * (pages + elements + reading order) plus a server timestamp; images inside the
 * project are already Storage URLs so the document stays small.
 */
export async function saveEpisodeCanvas(
  webtoonId: string,
  episodeId: string,
  canvasProject: CanvasProject
): Promise<void> {
  await updateDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId), {
    canvasProject,
    canvasUpdatedAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'webtoons', webtoonId), { updatedAt: serverTimestamp() })
}

// ── Characters (per-webtoon roster) ─────────────────────────

export async function createCharacter(webtoonId: string, data: Partial<Character>): Promise<string> {
  const ref = await addDoc(collection(db, 'webtoons', webtoonId, 'characters'), {
    name: 'New Character',
    role: '',
    color: '#4C9AFF',
    imageUrl: null,
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * One-shot read of a webtoon's character roster. Used by the agent workflow to
 * dedupe before auto-creating cast members (the live UI uses the
 * subscribeToCharacters listener instead).
 */
export async function listCharacters(webtoonId: string): Promise<Character[]> {
  const snaps = await getDocs(collection(db, 'webtoons', webtoonId, 'characters'))
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() } as Character))
}

export async function updateCharacter(
  webtoonId: string,
  characterId: string,
  data: Partial<Character>
): Promise<void> {
  await updateDoc(doc(db, 'webtoons', webtoonId, 'characters', characterId), data)
}

export async function deleteCharacter(webtoonId: string, characterId: string): Promise<void> {
  await deleteDoc(doc(db, 'webtoons', webtoonId, 'characters', characterId))
}

export function subscribeToCharacters(
  webtoonId: string,
  callback: (characters: Character[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  const q = query(collection(db, 'webtoons', webtoonId, 'characters'))
  return onSnapshot(
    q,
    (snap) => {
      const characters = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Character))
      characters.sort(
        (a, b) =>
          (a.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER) -
          (b.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER)
      )
      callback(characters)
    },
    onError
  )
}

export async function deleteEpisode(webtoonId: string, episodeId: string): Promise<void> {
  await deleteDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId))
  await updateDoc(doc(db, 'webtoons', webtoonId), {
    episodeCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  await reconcileViewCount('webtoon', webtoonId)
}

export async function reorderEpisodes(
  webtoonId: string,
  episodeIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  episodeIds.forEach((episodeId, index) => {
    batch.update(doc(db, 'webtoons', webtoonId, 'episodes', episodeId), {
      episodeNumber: index + 1,
    })
  })
  await batch.commit()
  await updateDoc(doc(db, 'webtoons', webtoonId), { updatedAt: serverTimestamp() })
}

// ── Followers ───────────────────────────────────────────────
//
// A subscription writes three documents in ONE transaction so counters can
// never drift from the actual relationship docs:
//   users/{authorId}/followers/{followerId}   — who follows this creator
//   users/{followerId}/following/{authorId}   — who this user follows
//   follows/{followerId_followingId}          — flat edge (legacy + fast lookup)
// plus followerCount / followingCount increments on both user docs.
// The transaction reads the edge first and no-ops when it already exists, so a
// double-click (or replayed request) can never double-increment a counter.

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) throw new Error('You cannot subscribe to yourself')
  await runTransaction(db, async (tx) => {
    const edgeRef = doc(db, 'follows', `${followerId}_${followingId}`)
    const followingRef = doc(db, 'users', followerId, 'following', followingId)
    const [edgeSnap, followingSnap] = await Promise.all([tx.get(edgeRef), tx.get(followingRef)])
    if (edgeSnap.exists() || followingSnap.exists()) return // already subscribed — idempotent

    tx.set(edgeRef, {
      followerId,
      followingId,
      createdAt: serverTimestamp(),
    })
    tx.set(doc(db, 'users', followingId, 'followers', followerId), {
      followerId,
      createdAt: serverTimestamp(),
    })
    tx.set(followingRef, {
      followingId,
      createdAt: serverTimestamp(),
    })
    tx.update(doc(db, 'users', followingId), { followerCount: increment(1) })
    tx.update(doc(db, 'users', followerId), { followingCount: increment(1) })
  })
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const edgeRef = doc(db, 'follows', `${followerId}_${followingId}`)
    const followingRef = doc(db, 'users', followerId, 'following', followingId)
    const [edgeSnap, followingSnap] = await Promise.all([tx.get(edgeRef), tx.get(followingRef)])
    if (!edgeSnap.exists() && !followingSnap.exists()) return // nothing to remove

    tx.delete(edgeRef)
    tx.delete(doc(db, 'users', followingId, 'followers', followerId))
    tx.delete(followingRef)
    tx.update(doc(db, 'users', followingId), { followerCount: increment(-1) })
    tx.update(doc(db, 'users', followerId), { followingCount: increment(-1) })
  })
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'follows', `${followerId}_${followingId}`))
  return snap.exists()
}

export async function getFollowers(uid: string, limitCount = 50): Promise<FollowRecord[]> {
  const q = query(
    collection(db, 'follows'),
    where('followingId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as FollowRecord))
}

export async function getFollowing(uid: string, limitCount = 50): Promise<FollowRecord[]> {
  const q = query(
    collection(db, 'follows'),
    where('followerId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as FollowRecord))
}

// ── Transactions ─────────────────────────────────────────────

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'transactions'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// Token balance mutations are server-only (Admin SDK): AI spend lives in
// src/lib/tokens.ts and purchases are credited by the Razorpay webhook.
// Clients cannot write `balance` — Firestore rules forbid it.

export async function getCreatorWithdrawals(creatorId: string): Promise<Withdrawal[]> {
  const q = query(
    collection(db, 'withdrawals'),
    where('creatorId', '==', creatorId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Withdrawal>(d))
}

// ── Search ────────────────────────────────────────────────────

/** Size of the candidate pool fetched per collection before client-side ranking.
 * The old Firestore range query on `title` was case-sensitive and prefix-only,
 * so it silently missed every title not stored lowercase (e.g. "Karna…") and
 * any mid-title word. We instead pull a bounded pool of public works and match
 * case-insensitively over title/synopsis/genres/tags — instant and typo-friendly
 * at this scale. (If the catalog grows past a few thousand works, move to a
 * dedicated search index / lowercased token field.) */
const SEARCH_POOL = 400

/** Case-insensitive relevance score, or 0 when the item doesn't match ALL terms.
 * Title hits rank highest (exact > prefix > substring), then other fields. */
function searchScore(item: Novel | Webtoon, terms: string[]): number {
  const title = item.title.toLowerCase()
  const rest = [
    (item as Novel).synopsis ?? '',
    (item.genres ?? []).join(' '),
    (item.tags ?? []).join(' '),
    item.authorName ?? '',
  ]
    .join(' ')
    .toLowerCase()

  let score = 0
  for (const t of terms) {
    if (title === t) score += 100
    else if (title.startsWith(t)) score += 60
    else if (title.includes(t)) score += 40
    else if (rest.includes(t)) score += 10
    else return 0 // every term must match somewhere → AND semantics
  }
  return score
}

/**
 * Search public, live novels + webtoons by title/synopsis/genres/tags.
 * Case-insensitive, substring, multi-word (all words must appear). Results are
 * ranked by relevance then popularity.
 */
export async function searchContent(
  searchQuery: string,
  limitCount = 20
): Promise<{ novels: Novel[]; webtoons: Webtoon[] }> {
  const q = searchQuery.toLowerCase().trim()
  if (!q) return { novels: [], webtoons: [] }
  const terms = q.split(/\s+/).filter(Boolean)

  const LIVE = ['published', 'ongoing', 'completed']

  // Single-field `visibility` filter (auto-indexed); status/text matched client
  // side so no composite index is needed — same approach as browseContent.
  const [novelSnaps, webtoonSnaps] = await Promise.all([
    getDocs(query(collection(db, 'novels'), where('visibility', '==', 'public'), limit(SEARCH_POOL))),
    getDocs(query(collection(db, 'webtoons'), where('visibility', '==', 'public'), limit(SEARCH_POOL))),
  ])

  const rank = <T extends Novel | Webtoon>(docs: T[]): T[] =>
    docs
      .filter((it) => LIVE.includes(it.status))
      .map((it) => ({ it, score: searchScore(it, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (b.it.viewCount ?? 0) - (a.it.viewCount ?? 0))
      .slice(0, limitCount)
      .map((r) => r.it)

  return {
    novels: rank(novelSnaps.docs.map((d) => fromDoc<Novel>(d))),
    webtoons: rank(webtoonSnaps.docs.map((d) => fromDoc<Webtoon>(d))),
  }
}

export async function getNewReleases(limitCount = 6): Promise<{ novels: Novel[]; webtoons: Webtoon[] }> {
  const LIVE = ['published', 'ongoing', 'completed']
  const [novelSnaps, webtoonSnaps] = await Promise.all([
    getDocs(query(collection(db, 'novels'), where('visibility', '==', 'public'), limit(limitCount * 4))),
    getDocs(query(collection(db, 'webtoons'), where('visibility', '==', 'public'), limit(limitCount * 4))),
  ])
  // Sort by publishedAt, falling back to createdAt: items published straight
  // from creation (e.g. ongoing works that never went through a publish step)
  // can have an empty publishedAt, which would collapse to 0 and scramble the
  // "newest first" order. createdAt is always set, so it keeps recency correct.
  const novels = novelSnaps.docs
    .map((d) => fromDoc<Novel>(d))
    .filter((n) => LIVE.includes(n.status))
    .sort((a, b) => compareTimestamps(a.publishedAt ?? a.createdAt, b.publishedAt ?? b.createdAt))
    .slice(0, limitCount)
  const webtoons = webtoonSnaps.docs
    .map((d) => fromDoc<Webtoon>(d))
    .filter((w) => LIVE.includes(w.status))
    .sort((a, b) => compareTimestamps(a.publishedAt ?? a.createdAt, b.publishedAt ?? b.createdAt))
    .slice(0, limitCount)
  return { novels, webtoons }
}

export async function getFeaturedNovels(limitCount = 6): Promise<Novel[]> {
  const LIVE = ['published', 'ongoing', 'completed']
  const q = query(collection(db, 'novels'), where('visibility', '==', 'public'), limit(limitCount * 4))
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<Novel>(d))
    .filter((n) => LIVE.includes(n.status))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limitCount)
}

export async function duplicateEpisode(
  webtoonId: string,
  episodeId: string,
  afterNumber: number
): Promise<string> {
  const snap = await getDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId))
  if (!snap.exists()) throw new Error('Episode not found')
  const data = snap.data() as Episode
  const ref = await addDoc(collection(db, 'webtoons', webtoonId, 'episodes'), {
    title: `${data.title} (Copy)`,
    panels: data.panels ?? [],
    thumbnailURL: data.thumbnailURL ?? null,
    // Branding-page text overrides travel with the episode ({} = defaults)
    intro: data.intro ?? {},
    outro: data.outro ?? {},
    episodeNumber: afterNumber + 0.5,
    isPremium: false,
    coinCost: 0,
    viewCount: 0,
    status: 'draft',
    publishedAt: null,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'webtoons', webtoonId), {
    episodeCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}
