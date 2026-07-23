import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, EMAIL_COOKIE_NAME, SUPER_ADMIN_EMAIL, FEATURE_FLAGS } from '@/lib/utils/constants'

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

  // Release gate — Webtoon Studio deep links redirect to Coming Soon.
  // (/create hub stays reachable: its Webtoon card renders locked; /wallet renders its own in-place lock.)
  if (!FEATURE_FLAGS.webtoonStudio && pathname.startsWith('/create/webtoon')) {
    const url = new URL('/coming-soon', request.url)
    url.searchParams.set('feature', 'studio')
    return NextResponse.redirect(url)
  }

  // Authenticated-user gate
  if (pathname.startsWith('/create') || pathname.startsWith('/dashboard') || pathname.startsWith('/wallet')) {
    if (!authToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/create/:path*', '/dashboard/:path*', '/admin/:path*', '/wallet/:path*'],
}
