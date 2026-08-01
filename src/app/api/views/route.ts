// View-tracking API — the ONLY path that can change public view counts.
//
// Two-phase protocol:
//   POST { phase: 'begin', ... }    → issues a signed view token bound to this
//                                     visitor+content, records server issue time,
//                                     and sets the signed anonymous visitor cookie.
//   POST { phase: 'complete', ... } → validates the token, server-measured dwell,
//                                     engagement, bot signals and rate limits,
//                                     then atomically records the view.
//
// The server clock (token iat) decides dwell time — the client cannot fake
// "20 seconds on page" because the token simply isn't old enough.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAuth } from '@/lib/firebase/serverApp'
import { VIEW_CONFIG, isViewContentType } from '@/lib/views/config'
import {
  randomId, saltedHash, signVisitorId, verifyVisitorCookie,
  signViewToken, verifyViewToken,
} from '@/lib/views/crypto'
import { detectBot, isSameOrigin, getClientIp } from '@/lib/views/botDetection'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { recordView, logSuspiciousActivity } from '@/lib/views/viewService'
import { AUTH_COOKIE_NAME } from '@/lib/utils/constants'

export const runtime = 'nodejs'

const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)

const beginSchema = z.object({
  phase: z.literal('begin'),
  contentType: z.string(),
  contentId: idSchema,
  parentId: idSchema,
  webdriver: z.boolean().optional(),
})

const completeSchema = z.object({
  phase: z.literal('complete'),
  token: z.string().min(20).max(2048),
  contentType: z.string(),
  contentId: idSchema,
  parentId: idSchema,
  sessionId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  engagementDurationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  scrollPercentage: z.number().min(0).max(100),
  webdriver: z.boolean().optional(),
})

/** Verify the Firebase session cookie from the auth cookie; anonymous on any
 *  failure. checkRevoked is deliberately FALSE here (unlike the sensitive
 *  AI/payment surface): view tracking is very high volume, and a revoked session
 *  merely attributing a view for up to its 7-day lifetime is a negligible risk
 *  next to an Admin lookup on every single view. Raise to `true` if that ever
 *  matters. */
async function getVerifiedUid(req: NextRequest): Promise<string | null> {
  const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!sessionCookie) return null
  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, false)
    return decoded.uid
  } catch {
    return null // expired/invalid cookie → treat as anonymous, never trust it
  }
}

// Rejections return 200 {counted:false} on purpose: abusive clients get no
// oracle for which check they tripped.
function notCounted(): NextResponse {
  return NextResponse.json({ counted: false })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  if (!isSameOrigin(req)) {
    // Real views should always be same-origin; a rejection here means either a
    // cross-site attempt or a host/proxy misconfig. Logged (not silent) so a
    // legitimate deployment issue is visible in Cloud Run logs instead of
    // manifesting only as "views never count".
    console.warn('[views] rejected: not same-origin', {
      origin: req.headers.get('origin'),
      forwardedHost: req.headers.get('x-forwarded-host'),
      nextUrlHost: req.nextUrl.host,
    })
    return notCounted()
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const phase = (body as { phase?: string })?.phase
  if (phase === 'begin') return handleBegin(req, body, ip)
  if (phase === 'complete') return handleComplete(req, body, ip, ua)
  return NextResponse.json({ error: 'Unknown phase' }, { status: 400 })
}

async function handleBegin(req: NextRequest, body: unknown, ip: string) {
  const parsed = beginSchema.safeParse(body)
  if (!parsed.success || !isViewContentType(parsed.data.contentType)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { beginPerIp } = VIEW_CONFIG.rateLimits
  if (!(await checkRateLimitAsync(`begin:ip:${ip}`, beginPerIp.limit, beginPerIp.windowMs)).allowed) {
    return notCounted()
  }

  const bot = detectBot(req, parsed.data.webdriver)
  if (bot.isBot) return notCounted()

  // Reuse the authenticated visitor cookie or mint a new signed one
  let visitorId = verifyVisitorCookie(req.cookies.get(VIEW_CONFIG.visitorCookieName)?.value)
  const isNewVisitor = !visitorId
  if (!visitorId) visitorId = randomId()

  const token = signViewToken({
    c: parsed.data.contentId,
    t: parsed.data.contentType,
    v: saltedHash(visitorId),
    iat: Date.now(),
    n: randomId(),
  })

  const res = NextResponse.json({ token })
  if (isNewVisitor) {
    res.cookies.set(VIEW_CONFIG.visitorCookieName, signVisitorId(visitorId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: VIEW_CONFIG.visitorCookieMaxAgeSec,
    })
  }
  return res
}

async function handleComplete(req: NextRequest, body: unknown, ip: string, ua: string) {
  const parsed = completeSchema.safeParse(body)
  if (!parsed.success || !isViewContentType(parsed.data.contentType)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const data = parsed.data
  const contentType = data.contentType as 'chapter' | 'episode'

  const bot = detectBot(req, data.webdriver)
  if (bot.isBot) {
    logSuspiciousActivity({
      reason: `bot:${bot.reason}`, contentId: data.contentId, contentType,
      hashedIp: saltedHash(ip), userAgentHash: saltedHash(ua),
    })
    return notCounted()
  }

  // The visitor cookie must exist and verify — it was set during begin
  const visitorId = verifyVisitorCookie(req.cookies.get(VIEW_CONFIG.visitorCookieName)?.value)
  if (!visitorId) return notCounted()

  // Rate limits: per IP, per visitor, per session
  const rl = VIEW_CONFIG.rateLimits
  const limits: Array<[string, { limit: number; windowMs: number }]> = [
    [`complete:ip:${ip}`, rl.completePerIp],
    [`complete:vis:${visitorId}`, rl.completePerVisitor],
    [`complete:ses:${data.sessionId}`, rl.completePerSession],
  ]
  for (const [key, { limit, windowMs }] of limits) {
    const result = await checkRateLimitAsync(key, limit, windowMs)
    if (!result.allowed) {
      if (result.blocked) {
        logSuspiciousActivity({
          reason: 'rate-limit-block', contentId: data.contentId, contentType,
          hashedIp: saltedHash(ip), userAgentHash: saltedHash(ua),
        })
      }
      return notCounted()
    }
  }

  // Token: authentic, matches this content, bound to this visitor, not stale
  const token = verifyViewToken(data.token)
  if (
    !token ||
    token.c !== data.contentId ||
    token.t !== contentType ||
    token.v !== saltedHash(visitorId)
  ) {
    logSuspiciousActivity({
      reason: 'invalid-view-token', contentId: data.contentId, contentType,
      hashedIp: saltedHash(ip), userAgentHash: saltedHash(ua),
    })
    return notCounted()
  }

  const dwellMs = Date.now() - token.iat
  if (dwellMs < 0 || dwellMs > VIEW_CONFIG.tokenMaxAgeMs) return notCounted()

  // Engagement gate — dwell is measured by OUR clock, not claimed by the client
  const qualifies =
    dwellMs >= VIEW_CONFIG.minDwellMs ||
    (data.scrollPercentage >= VIEW_CONFIG.minScrollPercent && dwellMs >= VIEW_CONFIG.minDwellWithScrollMs)
  if (!qualifies) return notCounted()

  // Claimed visible-time can never exceed real elapsed time (plus small slack)
  const engagementMs = Math.min(data.engagementDurationMs, dwellMs + 5_000)

  const userId = await getVerifiedUid(req)

  try {
    const result = await recordView({
      contentType,
      contentId: data.contentId,
      parentId: data.parentId,
      userId,
      anonymousVisitorId: visitorId,
      sessionId: data.sessionId,
      ip,
      userAgent: ua,
      engagementDurationMs: engagementMs,
      scrollPercentage: data.scrollPercentage,
    })
    return NextResponse.json({ counted: result.counted })
  } catch (err) {
    console.error('[views] recordView failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
