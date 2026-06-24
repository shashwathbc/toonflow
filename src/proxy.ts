import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME, EMAIL_COOKIE_NAME, SUPER_ADMIN_EMAIL } from '@/lib/utils/constants'

const ADMIN_ROLES = ['admin', 'superadmin']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const userRole = request.cookies.get(ROLE_COOKIE_NAME)?.value
  const userEmail = request.cookies.get(EMAIL_COOKIE_NAME)?.value

  // Super admin gate
  if (pathname.startsWith('/admin/super')) {
    if (!authToken || userEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Admin gate
  if (pathname.startsWith('/admin')) {
    if (!authToken || !ADMIN_ROLES.includes(userRole ?? '')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Authenticated-user gate
  if (pathname.startsWith('/create') || pathname.startsWith('/dashboard')) {
    if (!authToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/create/:path*', '/dashboard/:path*', '/admin/:path*'],
}
