import {
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, getCountFromServer,
  writeBatch, serverTimestamp, addDoc, setDoc,
  type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from './config'
import { db } from './db'
import type { UserProfile, Novel, Webtoon, FirestoreTimestamp } from '@/types'

function fromDoc<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T
}

// ── Audit Logging ────────────────────────────────────────────

export interface AuditLog {
  id?: string
  adminUid: string
  adminEmail: string
  action: string
  resource: string
  resourceId?: string
  details?: string
  createdAt: unknown
}

export async function createAuditLog(
  log: Omit<AuditLog, 'id' | 'createdAt'>
): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), { ...log, createdAt: serverTimestamp() })
}

export async function getAuditLogs(limitCount = 50): Promise<AuditLog[]> {
  const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(limitCount))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<AuditLog>(d))
}

// ── Platform Analytics ───────────────────────────────────────

export interface PlatformStats {
  totalUsers: number
  totalNovels: number
  publishedNovels: number
  draftNovels: number
  totalWebtoons: number
  publishedWebtoons: number
  draftWebtoons: number
  totalComments: number
  totalReports: number
  pendingReports: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [
    totalUsers, totalNovels, publishedNovels, draftNovels,
    totalWebtoons, publishedWebtoons, draftWebtoons,
    totalComments, totalReports, pendingReports,
  ] = await Promise.all([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(collection(db, 'novels')),
    getCountFromServer(query(collection(db, 'novels'), where('status', 'in', ['published', 'ongoing', 'completed']))),
    getCountFromServer(query(collection(db, 'novels'), where('status', '==', 'draft'))),
    getCountFromServer(collection(db, 'webtoons')),
    getCountFromServer(query(collection(db, 'webtoons'), where('status', 'in', ['published', 'ongoing', 'completed']))),
    getCountFromServer(query(collection(db, 'webtoons'), where('status', '==', 'draft'))),
    getCountFromServer(collection(db, 'comments')),
    getCountFromServer(collection(db, 'reports')),
    getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'pending'))),
  ])

  return {
    totalUsers: totalUsers.data().count,
    totalNovels: totalNovels.data().count,
    publishedNovels: publishedNovels.data().count,
    draftNovels: draftNovels.data().count,
    totalWebtoons: totalWebtoons.data().count,
    publishedWebtoons: publishedWebtoons.data().count,
    draftWebtoons: draftWebtoons.data().count,
    totalComments: totalComments.data().count,
    totalReports: totalReports.data().count,
    pendingReports: pendingReports.data().count,
  }
}

// ── Support Requests ─────────────────────────────────────────

export interface SupportRequest {
  id: string
  type: 'question' | 'issue'
  name: string
  email: string
  subject: string
  message: string
  userId: string | null
  status: 'open' | 'in-progress' | 'resolved'
  emailSent: boolean
  createdAt: FirestoreTimestamp | null
}

export async function getSupportRequests(status?: SupportRequest['status']): Promise<SupportRequest[]> {
  const base = collection(db, 'supportRequests')
  const q = status
    ? query(base, where('status', '==', status), orderBy('createdAt', 'desc'), limit(100))
    : query(base, orderBy('createdAt', 'desc'), limit(100))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<SupportRequest>(d))
}

export async function updateSupportRequestStatus(
  id: string,
  status: SupportRequest['status']
): Promise<void> {
  await updateDoc(doc(db, 'supportRequests', id), { status, updatedAt: serverTimestamp() })
}

export async function deleteSupportRequest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'supportRequests', id))
}

// ── User Management ──────────────────────────────────────────

export async function getAllUsers(limitCount = 50): Promise<UserProfile[]> {
  // No orderBy('createdAt') here: Firestore silently excludes docs missing the
  // field, which hides users created by older signup flows. Sort client-side.
  const q = query(collection(db, 'users'), limit(limitCount))
  const snaps = await getDocs(q)
  const toSeconds = (ts: unknown): number =>
    ts && typeof ts === 'object' && 'seconds' in ts ? (ts as { seconds: number }).seconds : 0
  return snaps.docs
    .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
    .sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt))
}

export async function getUserCount(): Promise<number> {
  const snap = await getCountFromServer(collection(db, 'users'))
  return snap.data().count
}

export async function searchUsers(searchQuery: string): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), limit(200))
  const snaps = await getDocs(q)
  const lower = searchQuery.toLowerCase()
  return snaps.docs
    .map((d) => fromDoc<UserProfile>(d))
    .filter((u) =>
      u.displayName?.toLowerCase().includes(lower) ||
      u.email?.toLowerCase().includes(lower) ||
      u.uid?.toLowerCase().includes(lower)
    )
    .slice(0, 50)
}

export async function setUserRole(
  uid: string,
  role: UserProfile['role']
): Promise<void> {
  const isCreator = ['creator', 'admin', 'superadmin'].includes(role)
  await updateDoc(doc(db, 'users', uid), { role, isCreator, updatedAt: serverTimestamp() })
}

export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { disabled, updatedAt: serverTimestamp() })
}

export async function sendUserPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export async function deleteUserData(uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', uid))
  // Note: deleting auth user requires Firebase Admin SDK (server-side only)
  await batch.commit()
}

// ── Novel Moderation ─────────────────────────────────────────

export async function getAllNovels(filters: {
  status?: string; search?: string
} = {}, limitCount = 50): Promise<Novel[]> {
  let q
  if (filters.status && filters.status !== 'all') {
    q = query(collection(db, 'novels'), where('status', '==', filters.status), limit(limitCount * 2))
  } else {
    q = query(collection(db, 'novels'), limit(limitCount * 2))
  }
  const snaps = await getDocs(q)
  let novels = snaps.docs.map((d) => fromDoc<Novel>(d))
  if (filters.search) {
    const lower = filters.search.toLowerCase()
    novels = novels.filter((n) =>
      n.title?.toLowerCase().includes(lower) ||
      n.authorName?.toLowerCase().includes(lower)
    )
  }
  return novels.slice(0, limitCount)
}

export async function adminDeleteNovel(novelId: string): Promise<void> {
  const batch = writeBatch(db)
  // Delete chapters
  const chapters = await getDocs(collection(db, 'novels', novelId, 'chapters'))
  chapters.docs.forEach((d) => batch.delete(d.ref))
  // Delete novel document
  batch.delete(doc(db, 'novels', novelId))
  await batch.commit()
}

export async function adminSoftDeleteNovel(novelId: string, deleted: boolean): Promise<void> {
  await updateDoc(doc(db, 'novels', novelId), {
    softDeleted: deleted,
    updatedAt: serverTimestamp(),
  })
}

// ── Webtoon Moderation ───────────────────────────────────────

export async function getAllWebtoons(filters: {
  status?: string; search?: string
} = {}, limitCount = 50): Promise<Webtoon[]> {
  let q
  if (filters.status && filters.status !== 'all') {
    q = query(collection(db, 'webtoons'), where('status', '==', filters.status), limit(limitCount * 2))
  } else {
    q = query(collection(db, 'webtoons'), limit(limitCount * 2))
  }
  const snaps = await getDocs(q)
  let webtoons = snaps.docs.map((d) => fromDoc<Webtoon>(d))
  if (filters.search) {
    const lower = filters.search.toLowerCase()
    webtoons = webtoons.filter((w) =>
      w.title?.toLowerCase().includes(lower) ||
      w.authorName?.toLowerCase().includes(lower)
    )
  }
  return webtoons.slice(0, limitCount)
}

export async function adminDeleteWebtoon(webtoonId: string): Promise<void> {
  const batch = writeBatch(db)
  const episodes = await getDocs(collection(db, 'webtoons', webtoonId, 'episodes'))
  episodes.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'webtoons', webtoonId))
  await batch.commit()
}

// ── Reports / Requests ───────────────────────────────────────

export interface AdminReport {
  id: string
  reporterId: string
  reporterName?: string
  targetId: string
  targetType: 'novel' | 'webtoon' | 'comment' | 'user'
  reason: string
  details?: string
  status: 'pending' | 'resolved' | 'dismissed'
  createdAt: import('@/types').FirestoreTimestamp | null
}

export async function getAdminReports(status?: AdminReport['status']): Promise<AdminReport[]> {
  const q = status
    ? query(collection(db, 'reports'), where('status', '==', status), limit(100))
    : query(collection(db, 'reports'), limit(100))
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<AdminReport>(d))
    .sort((a: AdminReport, b: AdminReport) => {
      const getTs = (v: unknown) => (v && typeof v === 'object' && 'seconds' in (v as object)) ? (v as { seconds: number }).seconds : 0
      return getTs(b.createdAt) - getTs(a.createdAt)
    })
}

export async function updateReportStatus(
  reportId: string,
  status: AdminReport['status']
): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), { status, resolvedAt: serverTimestamp() })
}

// ── Platform Settings ────────────────────────────────────────

export interface PlatformSettings {
  maintenanceMode: boolean
  maintenanceMessage: string
  allowNewSignups: boolean
  allowContentCreation: boolean
  maxUploadSizeMB: number
  aiGenerationsPerDay: number
  announcementBanner: string
  announcementVisible: boolean
  defaultUserRole: 'user' | 'creator'
}

const SETTINGS_DEFAULT: PlatformSettings = {
  maintenanceMode: false,
  maintenanceMessage: 'We\'ll be back shortly.',
  allowNewSignups: true,
  allowContentCreation: true,
  maxUploadSizeMB: 10,
  aiGenerationsPerDay: 20,
  announcementBanner: '',
  announcementVisible: false,
  defaultUserRole: 'user',
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snap = await getDoc(doc(db, 'settings', 'platform'))
  if (!snap.exists()) return SETTINGS_DEFAULT
  return { ...SETTINGS_DEFAULT, ...(snap.data() as Partial<PlatformSettings>) }
}

export async function updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<void> {
  await setDoc(doc(db, 'settings', 'platform'), { ...settings, updatedAt: serverTimestamp() }, { merge: true })
}

// ── Recent data for dashboard tables ────────────────────────

export async function getRecentUsers(limitCount = 10): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(limitCount))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromDoc<UserProfile>(d))
}

export async function getRecentNovels(limitCount = 10): Promise<Novel[]> {
  const q = query(collection(db, 'novels'), limit(limitCount * 2))
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<Novel>(d))
    .sort((a, b) => {
      const getTs = (v: unknown) => (v && typeof v === 'object' && 'seconds' in (v as object)) ? (v as { seconds: number }).seconds : 0
      return getTs(b.createdAt) - getTs(a.createdAt)
    })
    .slice(0, limitCount)
}

export async function getRecentWebtoons(limitCount = 10): Promise<Webtoon[]> {
  const q = query(collection(db, 'webtoons'), limit(limitCount * 2))
  const snaps = await getDocs(q)
  return snaps.docs
    .map((d) => fromDoc<Webtoon>(d))
    .sort((a, b) => {
      const getTs = (v: unknown) => (v && typeof v === 'object' && 'seconds' in (v as object)) ? (v as { seconds: number }).seconds : 0
      return getTs(b.createdAt) - getTs(a.createdAt)
    })
    .slice(0, limitCount)
}
