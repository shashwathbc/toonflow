// Heuristic bot / crawler / prefetch detection for view counting. SERVER ONLY.
// These requests are silently accepted (200) but never counted, so bots get
// no signal that they were filtered.
import type { NextRequest } from 'next/server'

const BOT_UA_PATTERN = new RegExp(
  [
    'bot', 'crawl', 'spider', 'slurp', 'archiver', 'indexer',
    'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 'webdriver',
    'python-requests', 'python-urllib', 'aiohttp', 'httpx', 'scrapy',
    'curl', 'wget', 'libwww', 'okhttp', 'go-http-client', 'java/', 'apache-httpclient',
    'axios', 'node-fetch', 'undici', 'postmanruntime', 'insomnia', 'httpie',
    'facebookexternalhit', 'whatsapp', 'telegrambot', 'discordbot', 'slackbot',
    'googleother', 'adsbot', 'mediapartners', 'bingpreview', 'yandex', 'baiduspider',
    'duckduckgo', 'semrush', 'ahrefs', 'mj12', 'dotbot', 'petalbot', 'bytespider',
    'gptbot', 'claudebot', 'ccbot', 'anthropic-ai', 'perplexitybot', 'amazonbot',
  ].join('|'),
  'i'
)

export interface BotCheck {
  isBot: boolean
  reason?: string
}

export function detectBot(req: NextRequest, clientWebdriver?: boolean): BotCheck {
  const ua = req.headers.get('user-agent') ?? ''

  if (!ua || ua.length < 12) return { isBot: true, reason: 'missing-or-short-user-agent' }
  if (BOT_UA_PATTERN.test(ua)) return { isBot: true, reason: 'bot-user-agent' }

  // Prefetch / speculation requests must never count as views
  const purpose = req.headers.get('sec-purpose') ?? req.headers.get('purpose') ?? ''
  if (/prefetch|prerender|preview/i.test(purpose)) return { isBot: true, reason: 'prefetch' }
  if (req.headers.get('x-moz') === 'prefetch') return { isBot: true, reason: 'prefetch' }
  if (req.headers.get('next-router-prefetch')) return { isBot: true, reason: 'prefetch' }

  // Our client sends JSON via fetch: browsers attach sec-fetch-mode. API tools
  // and plain scripts usually don't (header is browser-controlled, unforgeable in-page).
  const fetchMode = req.headers.get('sec-fetch-mode')
  if (fetchMode && fetchMode !== 'cors' && fetchMode !== 'same-origin') {
    return { isBot: true, reason: 'unexpected-sec-fetch-mode' }
  }

  // Real browsers send accept-language on fetch requests
  if (!req.headers.get('accept-language')) return { isBot: true, reason: 'missing-accept-language' }

  // navigator.webdriver reported by the client (defence-in-depth, not trusted alone)
  if (clientWebdriver === true) return { isBot: true, reason: 'navigator-webdriver' }

  return { isBot: false }
}

/**
 * CSRF guard: browser requests to this API must originate from our own site.
 *
 * Behind Firebase App Hosting / Cloud Run, `req.nextUrl.host` is frequently the
 * INTERNAL Cloud Run host (e.g. `…run.app` / `localhost:8080`), not the public
 * domain the browser actually loaded. Comparing the browser's `Origin`
 * (`toonflowstudiopaint.com`) against that internal host fails for EVERY real
 * visitor, so views silently never count in production (they returned
 * `{counted:false}` with no log). We therefore accept the request against the
 * full set of hosts that legitimately identify this site:
 *   - the proxy-supplied public host (`x-forwarded-host` / `host`)
 *   - the internal routing host (`req.nextUrl.host`)
 *   - the configured public URL (`NEXT_PUBLIC_APP_URL`, server-set, unspoofable)
 *
 * This does NOT weaken browser-CSRF protection: a cross-origin page cannot set
 * `x-forwarded-host` (custom headers trigger a CORS preflight this API rejects),
 * and its `Origin` is always its own real domain — which won't be in this set.
 */
function allowedHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>()
  hosts.add(req.nextUrl.host)
  const fwd = req.headers.get('x-forwarded-host')
  if (fwd) fwd.split(',').forEach((h) => hosts.add(h.trim()))
  const host = req.headers.get('host')
  if (host) hosts.add(host)
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) hosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host)
  } catch { /* ignore a malformed env value */ }
  hosts.delete('')
  return hosts
}

export function isSameOrigin(req: NextRequest): boolean {
  // sendBeacon / keepalive requests always carry Origin; some carry only Referer.
  const candidate = req.headers.get('origin') ?? req.headers.get('referer')
  if (!candidate) return false
  try {
    return allowedHosts(req).has(new URL(candidate).host)
  } catch {
    return false
  }
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
