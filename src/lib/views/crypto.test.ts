import { describe, it, expect } from 'vitest'

// secret() reads the signing key lazily (per call), so setting it here — before
// any crypto fn runs — is enough. Mirrors how the route supplies VIEW_TOKEN_SECRET.
process.env.VIEW_TOKEN_SECRET = 'unit-test-view-secret-000000000000000000'

import {
  hmac,
  saltedHash,
  randomId,
  signVisitorId,
  verifyVisitorCookie,
  signViewToken,
  verifyViewToken,
  type ViewTokenPayload,
} from './crypto'

describe('view-pipeline crypto', () => {
  it('hmac is deterministic, url-safe, and input-sensitive', () => {
    expect(hmac('abc')).toBe(hmac('abc'))
    expect(hmac('abc')).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(hmac('abc')).not.toBe(hmac('abd'))
  })

  it('saltedHash is deterministic, 32 chars, and value-dependent', () => {
    expect(saltedHash('1.2.3.4')).toBe(saltedHash('1.2.3.4'))
    expect(saltedHash('1.2.3.4')).toHaveLength(32)
    expect(saltedHash('1.2.3.4')).not.toBe(saltedHash('1.2.3.5'))
  })

  it('signs and verifies a view token round-trip', () => {
    const payload: ViewTokenPayload = {
      c: 'chapter-1',
      t: 'chapter',
      v: saltedHash('visitor'),
      iat: Date.now(),
      n: randomId(),
    }
    expect(verifyViewToken(signViewToken(payload))).toEqual(payload)
  })

  it('rejects a token whose body was tampered with (content-id swap)', () => {
    const token = signViewToken({ c: 'c', t: 'chapter', v: 'v', iat: 1, n: 'n' })
    const sig = token.slice(token.lastIndexOf('.') + 1)
    const forgedBody = Buffer.from(
      JSON.stringify({ c: 'HACKED', t: 'chapter', v: 'v', iat: 1, n: 'n' }),
    ).toString('base64url')
    expect(verifyViewToken(`${forgedBody}.${sig}`)).toBeNull()
  })

  it('rejects a token with a valid-shaped but wrong signature', () => {
    const token = signViewToken({ c: 'c', t: 'chapter', v: 'v', iat: 1, n: 'n' })
    const body = token.slice(0, token.lastIndexOf('.'))
    expect(verifyViewToken(`${body}.${hmac('wrong-message')}`)).toBeNull()
  })

  it('rejects malformed and oversized tokens', () => {
    expect(verifyViewToken('no-dot')).toBeNull()
    expect(verifyViewToken('.onlysig')).toBeNull()
    expect(verifyViewToken('a'.repeat(2049) + '.sig')).toBeNull()
  })

  it('rejects an authentically-signed body missing required fields', () => {
    // Correct signature, but the payload is incomplete — verify must still reject.
    const body = Buffer.from(JSON.stringify({ c: 'only-c' })).toString('base64url')
    expect(verifyViewToken(`${body}.${hmac('vtk:' + body)}`)).toBeNull()
  })

  it('signs and verifies the anonymous visitor cookie', () => {
    const id = randomId()
    expect(verifyVisitorCookie(signVisitorId(id))).toBe(id)
  })

  it('rejects tampered, empty, or short-id visitor cookies', () => {
    const id = randomId()
    expect(verifyVisitorCookie(`${id}.${hmac('wrong')}`)).toBeNull()
    expect(verifyVisitorCookie(undefined)).toBeNull()
    expect(verifyVisitorCookie('short.somesig')).toBeNull() // id fails the {10,64} guard
  })
})
