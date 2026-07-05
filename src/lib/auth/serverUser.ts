// Verify the Firebase session cookie server-side and return the authenticated
// uid. The uid MUST come from the verified token, never from the request body —
// billing and ownership decisions depend on it.
import type { NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME } from '@/lib/utils/constants'

export async function verifiedUid(req: NextRequest): Promise<string | null> {
  const idToken = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!idToken) return null
  try {
    return (await adminAuth().verifyIdToken(idToken)).uid
  } catch {
    return null // expired/invalid → treat as unauthenticated
  }
}
