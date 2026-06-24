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
  type QueryDocumentSnapshot,
  type DocumentData,
  type FirestoreError,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './config'
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
  FirestoreTimestamp,
} from '@/types'
import { SUPER_ADMIN_EMAIL, TRENDING_LIMIT, BROWSE_LIMIT } from '@/lib/utils/constants'

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
  if (snap.exists()) return

  const isSuperAdmin = firebaseUser.email === SUPER_ADMIN_EMAIL

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
    orderBy('viewCount', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Novel>(d))
}

export async function getNovelsByAuthor(uid: string): Promise<Novel[]> {
  const q = query(collection(db, 'novels'), where('authorId', '==', uid), orderBy('createdAt', 'desc'))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Novel>(d))
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

export async function deleteChapter(novelId: string, chapterId: string): Promise<void> {
  await deleteDoc(doc(db, 'novels', novelId, 'chapters', chapterId))
  await updateDoc(doc(db, 'novels', novelId), {
    chapterCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
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
    status: 'draft',
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
    orderBy('viewCount', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Webtoon>(d))
}

export async function getWebtoonsByAuthor(uid: string): Promise<Webtoon[]> {
  const q = query(collection(db, 'webtoons'), where('authorId', '==', uid), orderBy('createdAt', 'desc'))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Webtoon>(d))
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
    where('targetType', '==', targetType),
    where('parentId', '==', null),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Comment>(d))
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
  genre?: string
  status?: string
  sortBy?: 'trending' | 'newest' | 'rating'
  limitCount?: number
}

export interface BrowseResult {
  novels: Novel[]
  webtoons: Webtoon[]
}

export async function browseContent(options: BrowseOptions = {}): Promise<BrowseResult> {
  const { contentType = 'all', genre, status, sortBy = 'trending', limitCount = BROWSE_LIMIT } = options

  const buildQuery = (col: string) => {
    const constraints = [
      where('status', 'in', ['published', 'ongoing', 'completed']),
    ]
    if (genre) constraints.push(where('genres', 'array-contains', genre))
    if (status && status !== 'all') constraints.push(where('status', '==', status))

    const sortField = sortBy === 'newest' ? 'createdAt' : sortBy === 'rating' ? 'rating' : 'viewCount'
    return query(collection(db, col), ...constraints, orderBy(sortField, 'desc'), limit(limitCount))
  }

  const [novels, webtoons] = await Promise.all([
    contentType === 'webtoon' ? [] : getDocs(buildQuery('novels')).then((s) => s.docs.map((d) => fromDoc<Novel>(d))),
    contentType === 'novel' ? [] : getDocs(buildQuery('webtoons')).then((s) => s.docs.map((d) => fromDoc<Webtoon>(d))),
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
    where('authorId', '==', authorId),
    orderBy('updatedAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Novel))),
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
