import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, EMAIL_COOKIE_NAME, ROLE_COOKIE_NAME, SUPER_ADMIN_EMAIL, canUseWebtoonStudio } from '@/lib/utils/constants'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const userEmail = request.cookies.get(EMAIL_COOKIE_NAME)?.value

  // Super admin gate
  if (pathname.startsWith('/admin/super')) {
    if (!authToken || userEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Admin gate — /admin/** requires an admin/superadmin ROLE cookie (server-set
  // in /api/session from the verified token; a client can't forge it because
  // it's derived from Firestore, not the request body). This closes the gap
  // where /admin was in the matcher but only /admin/super was enforced (audit
  // M2). Defense-in-depth for routing only — data access is independently
  // governed by Firestore rules' isAdmin().
  if (pathname.startsWith('/admin')) {
    const role = request.cookies.get(ROLE_COOKIE_NAME)?.value
    if (!authToken || (role !== 'admin' && role !== 'superadmin')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Release gate — Webtoon Studio deep links are allowlist-only while gated
  // (see canUseWebtoonStudio). Non-allowlisted visitors redirect to Coming Soon.
  // (/create hub stays reachable: its Webtoon card renders locked for them.)
  if (pathname.startsWith('/create/webtoon') && !canUseWebtoonStudio(userEmail)) {
    const url = new URL('/coming-soon', request.url)
    url.searchParams.set('feature', 'studio')
    return NextResponse.redirect(url)
  }

  // Authenticated-user gate
  if (
    pathname.startsWith('/create') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/wallet') ||
    pathname.startsWith('/messages')
  ) {
    if (!authToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/create/:path*', '/dashboard/:path*', '/admin/:path*', '/wallet/:path*', '/messages/:path*'],
}
