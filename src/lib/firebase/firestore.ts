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
  WithdrawalMethod,
  BookmarkItem,
  ReadingHistoryItem,
  FollowRecord,
  Transaction,
  TransactionType,
  FirestoreTimestamp,
} from '@/types'
import { SUPER_ADMIN_EMAIL, TRENDING_LIMIT, BROWSE_LIMIT } from '@/lib/utils/constants'

function fromDoc<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T
}

function compareTimestamps(a: unknown, b: unknown): number {
  const getSeconds = (ts: unknown) => {
    if (!ts) return 0
    if (typeof ts === 'object') {
      if (ts !== null && 'seconds' in ts) return (ts as { seconds: number }).seconds
      if (ts instanceof Date) return Math.floor(ts.getTime() / 1000)
    }
    if (typeof ts === 'number') return Math.floor(ts / 1000)
    if (typeof ts === 'string') return Math.floor(new Date(ts).getTime() / 1000)
    return 0
  }
  return getSeconds(b) - getSeconds(a)
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
    orderBy('viewCount', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Novel>(d))
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
      where('visibility', '==', 'public'),
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
  await updateDoc(doc(db, 'webtoons', id), {
    status: 'ongoing',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function unpublishWebtoon(id: string): Promise<void> {
  await updateDoc(doc(db, 'webtoons', id), {
    status: 'draft',
    publishedAt: null,
    updatedAt: serverTimestamp(),
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

export async function deleteEpisode(webtoonId: string, episodeId: string): Promise<void> {
  await deleteDoc(doc(db, 'webtoons', webtoonId, 'episodes', episodeId))
  await updateDoc(doc(db, 'webtoons', webtoonId), {
    episodeCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
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

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const batch = writeBatch(db)
  const followRef = doc(db, 'follows', `${followerId}_${followingId}`)
  batch.set(followRef, {
    followerId,
    followingId,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', followingId), { followerCount: increment(1) })
  batch.update(doc(db, 'users', followerId), { followingCount: increment(1) })
  await batch.commit()
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'follows', `${followerId}_${followingId}`))
  batch.update(doc(db, 'users', followingId), { followerCount: increment(-1) })
  batch.update(doc(db, 'users', followerId), { followingCount: increment(-1) })
  await batch.commit()
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

export async function getUserTransactions(uid: string, limitCount = 50): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Transaction>(d))
}

export async function deductTokens(
  uid: string,
  coins: number,
  type: TransactionType,
  description: string
): Promise<void> {
  const batch = writeBatch(db)
  const txRef = doc(collection(db, 'transactions'))
  batch.set(txRef, {
    userId: uid,
    type,
    amount: 0,
    coins: -coins,
    description,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', uid), { balance: increment(-coins) })
  await batch.commit()
}

export async function creditTokens(
  uid: string,
  coins: number,
  amount: number,
  type: TransactionType,
  description: string
): Promise<void> {
  const batch = writeBatch(db)
  const txRef = doc(collection(db, 'transactions'))
  batch.set(txRef, {
    userId: uid,
    type,
    amount,
    coins,
    description,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', uid), { balance: increment(coins) })
  await batch.commit()
}

// ── Withdrawal Requests ───────────────────────────────────────

export async function createWithdrawalRequest(
  creatorId: string,
  amount: number,
  method: WithdrawalMethod,
  accountDetails: Record<string, string>
): Promise<string> {
  const ref = await addDoc(collection(db, 'withdrawals'), {
    creatorId,
    amount,
    method,
    accountDetails,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

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

export async function searchContent(
  searchQuery: string,
  limitCount = 20
): Promise<{ novels: Novel[]; webtoons: Webtoon[] }> {
  const q = searchQuery.toLowerCase().trim()
  if (!q) return { novels: [], webtoons: [] }

  // Firestore doesn't support full-text search natively.
  // Query by title range (prefix match) as a lightweight substitute.
  const titleEnd = q.replace(/.$/, (c) => String.fromCharCode(c.charCodeAt(0) + 1))

  const novelQ = query(
    collection(db, 'novels'),
    where('status', 'in', ['published', 'ongoing', 'completed']),
    where('visibility', '==', 'public'),
    where('title', '>=', q),
    where('title', '<', titleEnd),
    limit(limitCount)
  )
  const webtoonQ = query(
    collection(db, 'webtoons'),
    where('status', 'in', ['published', 'ongoing', 'completed']),
    where('visibility', '==', 'public'),
    where('title', '>=', q),
    where('title', '<', titleEnd),
    limit(limitCount)
  )

  const [novelSnaps, webtoonSnaps] = await Promise.all([getDocs(novelQ), getDocs(webtoonQ)])
  return {
    novels: novelSnaps.docs.map((d) => fromDoc<Novel>(d)),
    webtoons: webtoonSnaps.docs.map((d) => fromDoc<Webtoon>(d)),
  }
}

// ── Originals ─────────────────────────────────────────────────

export async function getOriginals(limitCount = 20): Promise<{ novels: Novel[]; webtoons: Webtoon[] }> {
  const [novelSnaps, webtoonSnaps] = await Promise.all([
    getDocs(query(
      collection(db, 'novels'),
      where('isOriginal', '==', true),
      where('status', 'in', ['published', 'ongoing', 'completed']),
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    )),
    getDocs(query(
      collection(db, 'webtoons'),
      where('isOriginal', '==', true),
      where('status', 'in', ['published', 'ongoing', 'completed']),
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    )),
  ])
  return {
    novels: novelSnaps.docs.map((d) => fromDoc<Novel>(d)),
    webtoons: webtoonSnaps.docs.map((d) => fromDoc<Webtoon>(d)),
  }
}

export async function getFeaturedNovels(limitCount = 6): Promise<Novel[]> {
  const q = query(
    collection(db, 'novels'),
    where('status', 'in', ['published', 'ongoing', 'completed']),
    where('visibility', '==', 'public'),
    orderBy('viewCount', 'desc'),
    limit(limitCount)
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<Novel>(d))
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
