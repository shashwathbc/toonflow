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

/** CSRF guard: browser requests to this API must originate from our own site. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) {
    // sendBeacon / keepalive requests always carry Origin; direct tools often don't.
    // Fall back to referer.
    const referer = req.headers.get('referer')
    if (!referer) return false
    try { return new URL(referer).host === req.nextUrl.host } catch { return false }
  }
  try { return new URL(origin).host === req.nextUrl.host } catch { return false }
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
