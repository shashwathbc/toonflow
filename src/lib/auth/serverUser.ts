// Verify the Firebase SESSION COOKIE server-side and return the authenticated
// uid. The uid MUST come from the verified cookie, never from the request body —
// billing and ownership decisions depend on it.
//
// Session cookies (minted by /api/session via createSessionCookie) are revocable:
// verifying with checkRevoked=true rejects a signed-out or admin-revoked session
// immediately, unlike a raw ID token which stayed valid until its ~1h expiry no
// matter what (audit finding M1). The revocation check costs one Admin lookup per
// authenticated request — acceptable on the sensitive AI/payment surface this
// helper guards; relax to `false` only if it ever shows up on latency.
import type { NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME } from '@/lib/utils/constants'

export async function verifiedUid(req: NextRequest): Promise<string | null> {
  const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!sessionCookie) return null
  try {
    return (await adminAuth().verifySessionCookie(sessionCookie, true)).uid
  } catch {
    return null // expired / revoked / invalid → treat as unauthenticated
  }
}
