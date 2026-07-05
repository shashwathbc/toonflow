// Session cookie mint/clear. The idToken is VERIFIED with the Admin SDK before
// any cookie is set, and role/email are derived server-side from the verified
// token + Firestore — never trusted from the request body. The middleware
// (src/proxy.ts) gates /admin and /admin/super on these cookies, so a
// client-spoofable role/email here would be a full auth bypass.
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME, EMAIL_COOKIE_NAME, SUPER_ADMIN_EMAIL } from '@/lib/utils/constants'

export const runtime = 'nodejs'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
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

  // Verify the token is authentic and unexpired before minting a session.
  let uid: string
  let email: string
  try {
    const decoded = await adminAuth().verifyIdToken(idToken)
    uid = decoded.uid
    email = decoded.email ?? ''
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
  response.cookies.set(AUTH_COOKIE_NAME, idToken, COOKIE_OPTIONS)
  response.cookies.set(ROLE_COOKIE_NAME, role, COOKIE_OPTIONS)
  response.cookies.set(EMAIL_COOKIE_NAME, email, COOKIE_OPTIONS)
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' })
  response.cookies.delete(AUTH_COOKIE_NAME)
  response.cookies.delete(ROLE_COOKIE_NAME)
  response.cookies.delete(EMAIL_COOKIE_NAME)
  return response
}
