// Session cookie mint/clear. The idToken is VERIFIED with the Admin SDK, then
// exchanged for a REVOCABLE Firebase session cookie (audit M1) — we no longer
// store the raw ID token, so a signed-out or admin-revoked session stops working
// immediately instead of staying valid until token expiry. Role/email are
// derived server-side from the verified token + Firestore — never trusted from
// the request body. The middleware (src/proxy.ts) gates /admin and /admin/super
// on these cookies, so a client-spoofable role/email here would be a full auth
// bypass.
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME, EMAIL_COOKIE_NAME, SUPER_ADMIN_EMAIL } from '@/lib/utils/constants'

export const runtime = 'nodejs'

// Session-cookie lifetime. Firebase allows 5 min – 14 days; 7 days matches the
// cookie maxAge below. Kept in ms for createSessionCookie and in s for the cookie.
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7 // 7 days
const SESSION_EXPIRES_IN_MS = SESSION_MAX_AGE_S * 1000

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_S,
}

const VALID_ROLES = ['user', 'creator', 'admin', 'superadmin'] as const
type Role = (typeof VALID_ROLES)[number]

export async function POST(request: NextRequest) {
  let idToken: string | undefined
  try {
    ;({ idToken } = (await request.json()) as { idToken?: string })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
  }

  // Verify the token is authentic and unexpired, then exchange it for a revocable
  // session cookie. Both must succeed before we mint anything.
  let uid: string
  let email: string
  let sessionCookie: string
  try {
    const decoded = await adminAuth().verifyIdToken(idToken)
    uid = decoded.uid
    email = decoded.email ?? ''
    sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Role comes from Firestore (the source of truth), not the client.
  let role: Role = 'user'
  try {
    const snap = await adminDb().doc(`users/${uid}`).get()
    const stored = snap.data()?.role
    if (typeof stored === 'string' && (VALID_ROLES as readonly string[]).includes(stored)) {
      role = stored as Role
    }
  } catch {
    // Fall back to 'user' — never elevate on a lookup failure.
  }
  if (email === SUPER_ADMIN_EMAIL) role = 'superadmin'

  const response = NextResponse.json({ status: 'ok' })
  response.cookies.set(AUTH_COOKIE_NAME, sessionCookie, COOKIE_OPTIONS)
  response.cookies.set(ROLE_COOKIE_NAME, role, COOKIE_OPTIONS)
  response.cookies.set(EMAIL_COOKIE_NAME, email, COOKIE_OPTIONS)
  return response
}

export async function DELETE(request: NextRequest) {
  // Best-effort revocation: revoking the refresh tokens makes any outstanding
  // session cookie fail its checkRevoked verification and blocks re-minting, so
  // sign-out is a real server-side kill switch (M1), not just a cleared cookie.
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (sessionCookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(sessionCookie)
      await adminAuth().revokeRefreshTokens(decoded.uid)
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  const response = NextResponse.json({ status: 'ok' })
  response.cookies.delete(AUTH_COOKIE_NAME)
  response.cookies.delete(ROLE_COOKIE_NAME)
  response.cookies.delete(EMAIL_COOKIE_NAME)
  return response
}
