import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  getDocs,
  documentId,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './db'
import { isFollowing } from './firestore'
import type { SocialUser, UserProfile, FirestoreTimestamp } from '@/types'

export const FOLLOW_PAGE_SIZE = 20

export type FollowListType = 'followers' | 'following'

export interface FollowConnectionsPage {
  users: SocialUser[]
  /** Pass back as `cursor` to fetch the next page; null when exhausted. */
  nextCursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

/** Firestore `in` supports up to 30 values per query. */
function chunk<T>(arr: T[], size = 30): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Fetch user docs for a set of uids, returned as a uid→profile map. Missing
 * (e.g. deleted) accounts are simply absent from the map. */
async function fetchProfiles(uids: string[]): Promise<Map<string, UserProfile>> {
  const map = new Map<string, UserProfile>()
  if (uids.length === 0) return map
  await Promise.all(
    chunk(uids).map(async (ids) => {
      const snap = await getDocs(
        query(collection(db, 'users'), where(documentId(), 'in', ids))
      )
      snap.forEach((d) => map.set(d.id, d.data() as UserProfile))
    })
  )
  return map
}

/** Which of `edgeIds` exist in the flat `follows` collection. Signed-in only
 * (matches the follows read rule), so callers pass edge ids only when a viewer
 * is authenticated. */
async function existingEdges(edgeIds: string[]): Promise<Set<string>> {
  const set = new Set<string>()
  if (edgeIds.length === 0) return set
  await Promise.all(
    chunk(edgeIds).map(async (ids) => {
      const snap = await getDocs(
        query(collection(db, 'follows'), where(documentId(), 'in', ids))
      )
      snap.forEach((d) => set.add(d.id))
    })
  )
  return set
}

/**
 * Load one page of a user's followers or following list, hydrated with each
 * user's public profile and, when a viewer is signed in, their relationship to
 * the viewer (follow state + mutual/friends).
 *
 * Reads the PUBLIC `users/{uid}/{followers|following}` subcollections (ordered
 * by `createdAt` — a single-field index, so no composite index is needed), not
 * the signed-in-only flat `follows` collection. This keeps the lists viewable
 * by signed-out visitors; only the viewer-relationship flags require auth.
 */
export async function getFollowConnections({
  profileUid,
  type,
  viewerId,
  cursor,
}: {
  profileUid: string
  type: FollowListType
  viewerId?: string | null
  cursor?: QueryDocumentSnapshot<DocumentData> | null
}): Promise<FollowConnectionsPage> {
  const sub = collection(db, 'users', profileUid, type)
  const constraints = [orderBy('createdAt', 'desc'), limit(FOLLOW_PAGE_SIZE)]
  const snap = await getDocs(
    cursor ? query(sub, ...constraints, startAfter(cursor)) : query(sub, ...constraints)
  )

  // The subcollection doc id IS the related uid (followUser writes it that way).
  const entries = snap.docs.map((d) => ({
    uid: d.id,
    followedAt: (d.data().createdAt ?? null) as FirestoreTimestamp | null,
  }))
  const uids = entries.map((e) => e.uid)

  // Profiles are public; relationship flags need the signed-in viewer.
  const targets = viewerId ? uids.filter((u) => u !== viewerId) : []
  const [profiles, viewerFollowsSet, followsViewerSet] = await Promise.all([
    fetchProfiles(uids),
    viewerId ? existingEdges(targets.map((u) => `${viewerId}_${u}`)) : Promise.resolve(new Set<string>()),
    viewerId ? existingEdges(targets.map((u) => `${u}_${viewerId}`)) : Promise.resolve(new Set<string>()),
  ])

  const users: SocialUser[] = []
  for (const { uid, followedAt } of entries) {
    const p = profiles.get(uid)
    if (!p) continue // deleted/unavailable account — drop the row rather than show a dead entry
    const viewerFollows = viewerFollowsSet.has(`${viewerId}_${uid}`)
    const followsViewer = followsViewerSet.has(`${uid}_${viewerId}`)
    users.push({
      uid: p.uid,
      displayName: p.displayName,
      photoURL: p.photoURL ?? null,
      bio: p.bio ?? '',
      followerCount: p.followerCount ?? 0,
      followingCount: p.followingCount ?? 0,
      followedAt,
      viewerFollows,
      followsViewer,
      isMutual: viewerFollows && followsViewer,
    })
  }

  return {
    users,
    nextCursor: snap.docs.length === FOLLOW_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === FOLLOW_PAGE_SIZE,
  }
}

/** Mutual-follow (friendship) check between two users, used to gate messaging. */
export async function getFriendship(
  viewerId: string,
  otherId: string
): Promise<{ viewerFollows: boolean; followsViewer: boolean; isMutual: boolean }> {
  const [viewerFollows, followsViewer] = await Promise.all([
    isFollowing(viewerId, otherId),
    isFollowing(otherId, viewerId),
  ])
  return { viewerFollows, followsViewer, isMutual: viewerFollows && followsViewer }
}
