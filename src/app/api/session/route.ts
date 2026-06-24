import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME, EMAIL_COOKIE_NAME } from '@/lib/utils/constants'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { idToken?: string; role?: string; email?: string }
    const { idToken, role, email } = body

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    const response = NextResponse.json({ status: 'ok' })
    response.cookies.set(AUTH_COOKIE_NAME, idToken, COOKIE_OPTIONS)
    response.cookies.set(ROLE_COOKIE_NAME, role ?? 'user', COOKIE_OPTIONS)
    response.cookies.set(EMAIL_COOKIE_NAME, email ?? '', COOKIE_OPTIONS)

    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' })
  response.cookies.delete(AUTH_COOKIE_NAME)
  response.cookies.delete(ROLE_COOKIE_NAME)
  response.cookies.delete(EMAIL_COOKIE_NAME)
  return response
}
