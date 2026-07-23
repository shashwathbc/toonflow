import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './db'
import { isFollowing, unfollowUser } from './firestore'

// Block model: users/{blockerId}/blocked/{targetId} (owner-private). Blocking
// also drops the blocker's OWN follow of the target so the pair is no longer
// mutual (messaging requires mutual follow). The target's follow edge can't be
// removed client-side (rules bind edge deletes to the follower), so it's left
// in place — harmless, since the block doc gates messaging and re-following in
// firestore.rules regardless.

export async function blockUser(blockerId: string, targetId: string): Promise<void> {
  if (blockerId === targetId) throw new Error('You cannot block yourself')
  try {
    if (await isFollowing(blockerId, targetId)) await unfollowUser(blockerId, targetId)
  } catch (e) {
    console.error('[blockUser] unfollow-on-block failed:', e)
  }
  await setDoc(doc(db, 'users', blockerId, 'blocked', targetId), {
    uid: targetId,
    createdAt: serverTimestamp(),
  })
}

export async function unblockUser(blockerId: string, targetId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', blockerId, 'blocked', targetId))
}

export async function isBlocked(blockerId: string, targetId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', blockerId, 'blocked', targetId))
  return snap.exists()
}
