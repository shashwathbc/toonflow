import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { detectBot, isSameOrigin, getClientIp } from './botDetection'

const HOST = 'toonflowstudiopaint.com'
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// detectBot / isSameOrigin / getClientIp only touch req.headers.get and
// req.nextUrl.host, so a minimal shape is enough.
function makeReq(headers: Record<string, string>, host = HOST): NextRequest {
  return { headers: new Headers(headers), nextUrl: { host } } as unknown as NextRequest
}

describe('detectBot', () => {
  const good = {
    'user-agent': BROWSER_UA,
    'accept-language': 'en-US,en;q=0.9',
    'sec-fetch-mode': 'cors',
  }

  it('passes a normal browser fetch', () => {
    expect(detectBot(makeReq(good))).toEqual({ isBot: false })
  })

  it('flags missing or too-short user agents', () => {
    expect(detectBot(makeReq({ 'accept-language': 'en' })).reason).toBe('missing-or-short-user-agent')
    expect(detectBot(makeReq({ 'user-agent': 'short', 'accept-language': 'en' })).reason).toBe(
      'missing-or-short-user-agent',
    )
  })

  it('flags known bot / automation user agents', () => {
    expect(detectBot(makeReq({ ...good, 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' })).reason).toBe('bot-user-agent')
    expect(detectBot(makeReq({ ...good, 'user-agent': 'python-requests/2.31.0' })).reason).toBe('bot-user-agent')
    expect(detectBot(makeReq({ ...good, 'user-agent': 'Mozilla/5.0 HeadlessChrome/120.0' })).reason).toBe('bot-user-agent')
  })

  it('flags prefetch / prerender requests', () => {
    expect(detectBot(makeReq({ ...good, 'sec-purpose': 'prefetch;prerender' })).reason).toBe('prefetch')
    expect(detectBot(makeReq({ ...good, 'next-router-prefetch': '1' })).reason).toBe('prefetch')
  })

  it('flags an unexpected sec-fetch-mode', () => {
    expect(detectBot(makeReq({ ...good, 'sec-fetch-mode': 'navigate' })).reason).toBe('unexpected-sec-fetch-mode')
  })

  it('flags a fetch missing accept-language', () => {
    expect(detectBot(makeReq({ 'user-agent': BROWSER_UA, 'sec-fetch-mode': 'cors' })).reason).toBe('missing-accept-language')
  })

  it('honours the client navigator.webdriver signal', () => {
    expect(detectBot(makeReq(good), true).reason).toBe('navigator-webdriver')
  })
})

describe('isSameOrigin', () => {
  it('accepts a same-origin Origin header', () => {
    expect(isSameOrigin(makeReq({ origin: `https://${HOST}` }))).toBe(true)
  })

  it('accepts via the Referer fallback', () => {
    expect(isSameOrigin(makeReq({ referer: `https://${HOST}/novel/x` }))).toBe(true)
  })

  it('rejects a cross-site origin', () => {
    expect(isSameOrigin(makeReq({ origin: 'https://evil.example' }))).toBe(false)
  })

  it('rejects when neither Origin nor Referer is present', () => {
    expect(isSameOrigin(makeReq({}))).toBe(false)
  })

  it('accepts the proxy-supplied x-forwarded-host even when nextUrl.host is internal', () => {
    const req = makeReq({ origin: `https://${HOST}`, 'x-forwarded-host': HOST }, 'toonflow--internal.a.run.app')
    expect(isSameOrigin(req)).toBe(true)
  })
})

describe('getClientIp', () => {
  it('takes the first hop of x-forwarded-for', () => {
    expect(getClientIp(makeReq({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to "unknown"', () => {
    expect(getClientIp(makeReq({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(getClientIp(makeReq({}))).toBe('unknown')
  })
})
