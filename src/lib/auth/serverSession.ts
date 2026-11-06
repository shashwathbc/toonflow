// Verify the session cookie from a SERVER COMPONENT (which has no NextRequest).
//
// Mirrors verifiedUid() in ./serverUser exactly — same cookie, same revocation
// check — but reads through next/headers instead. Kept as a separate function
// rather than overloading verifiedUid so the request-based path stays usable in
// middleware and route handlers without pulling in next/headers.
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME } from '@/lib/utils/constants'

export async function verifiedUidFromCookies(): Promise<string | null> {
  const sessionCookie = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  if (!sessionCookie) return null
  try {
    return (await adminAuth().verifySessionCookie(sessionCookie, true)).uid
  } catch {
    return null // expired / revoked / invalid → treat as unauthenticated
  }
}
