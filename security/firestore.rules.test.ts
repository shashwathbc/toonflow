// Firestore security-rules regression tests.
//
// These run against the Firestore EMULATOR, not the unit-test suite, because
// they need a real rules engine (`npm run test:rules`). CI deploys
// firestore.rules automatically on every push to main, so this file is the gate
// that stops an authorization regression from shipping with it.
//
// Every `it` below corresponds to a finding in SECURITY.md. A test that starts
// passing for the wrong reason is worse than no test, so each fix is paired with
// a positive case proving the legitimate path still works.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const ALICE = 'alice'
const BOB = 'bob'
const NOVEL = 'novel1'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'toonflow-rules-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Seed as admin (rules bypassed) so each test starts from a known state.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, email: 'alice@example.com', displayName: 'Alice', role: 'creator',
      balance: 500, totalEarnings: 1234, followerCount: 0, followingCount: 0,
    })
    await setDoc(doc(db, 'users', BOB), {
      uid: BOB, email: 'bob@example.com', displayName: 'Bob', role: 'user',
      balance: 0, totalEarnings: 0, followerCount: 0, followingCount: 0,
    })
    await setDoc(doc(db, 'novels', NOVEL), {
      title: 'A Story', authorId: ALICE, viewCount: 100, likeCount: 5,
      rating: 3, ratingCount: 10, status: 'published', visibility: 'public',
    })
  })
})

const asAlice = () => env.authenticatedContext(ALICE, { email: 'alice@example.com' }).firestore()
const asBob = () => env.authenticatedContext(BOB, { email: 'bob@example.com' }).firestore()
const asAnon = () => env.unauthenticatedContext().firestore()

// ── F-15: server-managed content fields ────────────────────────
describe('novels: server-managed fields are not author-writable', () => {
  it('lets the author edit real content fields', async () => {
    await assertSucceeds(updateDoc(doc(asAlice(), 'novels', NOVEL), { title: 'A Better Story' }))
  })

  it('blocks the author inflating viewCount (drives payouts and ranking)', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'novels', NOVEL), { viewCount: 9_999_999 }))
  })

  it('blocks the author writing the rating aggregate', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'novels', NOVEL), { rating: 5, ratingCount: 9999 }))
  })

  it('blocks the author reassigning authorId', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'novels', NOVEL), { authorId: BOB }))
  })

  it('blocks a title edit that smuggles a viewCount bump alongside it', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'novels', NOVEL), { title: 'x', viewCount: 500 }))
  })

  it('still blocks a non-author from editing at all', async () => {
    await assertFails(updateDoc(doc(asBob(), 'novels', NOVEL), { title: 'hijacked' }))
  })
})

// ── F-16: likeCount must follow a real like edge ───────────────
describe('likes: counter is bound to the caller own like edge', () => {
  const likeId = (uid: string) => `${uid}_novel_${NOVEL}`

  it('allows a genuine like: edge created and counter +1 in one commit', async () => {
    const db = asBob()
    const batch = writeBatch(db)
    batch.set(doc(db, 'likes', likeId(BOB)), {
      uid: BOB, contentType: 'novel', contentId: NOVEL, parentId: null,
    })
    batch.update(doc(db, 'novels', NOVEL), { likeCount: 6 })
    await assertSucceeds(batch.commit())
  })

  it('blocks a bare +1 with no like edge (the replay/inflation attack)', async () => {
    await assertFails(updateDoc(doc(asBob(), 'novels', NOVEL), { likeCount: 6 }))
  })

  it('blocks a bare -1 with no unlike (griefing a rival down to zero)', async () => {
    await assertFails(updateDoc(doc(asBob(), 'novels', NOVEL), { likeCount: 4 }))
  })

  it('blocks re-liking when the edge already exists', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'likes', likeId(BOB)), {
        uid: BOB, contentType: 'novel', contentId: NOVEL,
      })
    })
    const db = asBob()
    const batch = writeBatch(db)
    batch.set(doc(db, 'likes', likeId(BOB)), {
      uid: BOB, contentType: 'novel', contentId: NOVEL,
    })
    batch.update(doc(db, 'novels', NOVEL), { likeCount: 6 })
    await assertFails(batch.commit())
  })

  it('allows an unlike: edge removed and counter -1 in one commit', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'likes', likeId(BOB)), {
        uid: BOB, contentType: 'novel', contentId: NOVEL,
      })
    })
    const db = asBob()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'likes', likeId(BOB)))
    batch.update(doc(db, 'novels', NOVEL), { likeCount: 4 })
    await assertSucceeds(batch.commit())
  })

  it('blocks an arbitrary jump even with a valid edge', async () => {
    const db = asBob()
    const batch = writeBatch(db)
    batch.set(doc(db, 'likes', likeId(BOB)), {
      uid: BOB, contentType: 'novel', contentId: NOVEL,
    })
    batch.update(doc(db, 'novels', NOVEL), { likeCount: 999_999 })
    await assertFails(batch.commit())
  })

  it('blocks a like edge stored at an id that is not {uid}_{type}_{id}', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'likes', 'anything-i-want'), {
        uid: BOB, contentType: 'novel', contentId: NOVEL,
      }),
    )
  })

  it('blocks minting a like edge attributed to another user', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'likes', likeId(ALICE)), {
        uid: ALICE, contentType: 'novel', contentId: NOVEL,
      }),
    )
  })
})

// ── F-17: users collection is not bulk-readable ────────────────
describe('users: per-document get, admin-only list', () => {
  it('allows reading one known profile (profile pages, follower rows)', async () => {
    await assertSucceeds(getDoc(doc(asAnon(), 'users', ALICE)))
  })

  it('blocks anonymous enumeration of the whole collection', async () => {
    await assertFails(getDocs(collection(asAnon(), 'users')))
  })

  it('blocks a signed-in non-admin enumerating the collection', async () => {
    await assertFails(getDocs(collection(asBob(), 'users')))
  })

  it('still blocks self-granting balance or role on your own document', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { balance: 1_000_000 }))
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { role: 'superadmin' }))
  })

  it('allows editing your own profile fields', async () => {
    await assertSucceeds(updateDoc(doc(asAlice(), 'users', ALICE), { bio: 'hello' }))
  })
})

// ── F-18: reports are shape-validated ──────────────────────────
describe('reports: bound to the reporter and size-capped', () => {
  const valid = {
    targetId: NOVEL, targetType: 'novel', reporterId: BOB,
    reason: 'spam', details: 'repeated', status: 'pending',
  }

  it('accepts a well-formed report from the reporter', async () => {
    await assertSucceeds(setDoc(doc(asBob(), 'reports', 'r1'), valid))
  })

  it('blocks filing a report under another user reporterId', async () => {
    await assertFails(setDoc(doc(asBob(), 'reports', 'r2'), { ...valid, reporterId: ALICE }))
  })

  it('blocks a self-resolved report', async () => {
    await assertFails(setDoc(doc(asBob(), 'reports', 'r3'), { ...valid, status: 'resolved' }))
  })

  it('blocks an unbounded details blob', async () => {
    await assertFails(setDoc(doc(asBob(), 'reports', 'r4'), { ...valid, details: 'x'.repeat(5001) }))
  })

  it('keeps the queue private to admins', async () => {
    await assertFails(getDocs(collection(asBob(), 'reports')))
  })
})

// ── Withdrawals / transactions: money paths stay server-only ───
describe('money paths', () => {
  it('blocks a client-forged transaction record', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'transactions', 't1'), {
        userId: BOB, type: 'coin_purchase', coins: 10_000,
      }),
    )
  })

  it('blocks a self-approved withdrawal', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'withdrawals', 'w1'), {
        creatorId: ALICE, amount: 100, status: 'approved',
      }),
    )
  })

  it('blocks an absurd withdrawal amount', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'withdrawals', 'w2'), {
        creatorId: ALICE, amount: 1e12, status: 'pending',
      }),
    )
  })

  it('allows a normal pending withdrawal request', async () => {
    await assertSucceeds(
      setDoc(doc(asAlice(), 'withdrawals', 'w3'), {
        creatorId: ALICE, amount: 100, status: 'pending',
      }),
    )
  })

  it('blocks reading another user private collections', async () => {
    await assertFails(getDoc(doc(asBob(), 'chapterViews', 'anything')))
    await assertFails(deleteDoc(doc(asBob(), 'users', ALICE)))
  })
})
