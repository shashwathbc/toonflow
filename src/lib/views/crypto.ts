// HMAC signing + hashing for the view pipeline. SERVER ONLY.
// Secret: VIEW_TOKEN_SECRET, falling back to a hash of the Admin private key
// so no extra env var is strictly required.
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'

function secret(): string {
  const explicit = process.env.VIEW_TOKEN_SECRET
  if (explicit) return explicit
  const pk = process.env.FIREBASE_PRIVATE_KEY
  if (!pk) throw new Error('Set VIEW_TOKEN_SECRET (or FIREBASE_PRIVATE_KEY) for view-token signing.')
  return createHash('sha256').update('tf-view-secret:' + pk).digest('hex')
}

export function hmac(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Privacy-preserving hash for IPs / user agents stored in view logs. */
export function saltedHash(value: string): string {
  return createHash('sha256').update(secret() + '|' + value).digest('hex').slice(0, 32)
}

export function randomId(): string {
  return randomBytes(16).toString('base64url')
}

// ── Signed anonymous visitor id: "<id>.<hmac(id)>" ────────────

export function signVisitorId(id: string): string {
  return `${id}.${hmac('vid:' + id)}`
}

/** Returns the visitor id if the cookie is authentic, else null. */
export function verifyVisitorCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null
  const dot = cookieValue.lastIndexOf('.')
  if (dot <= 0) return null
  const id = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) return null
  return safeEqual(sig, hmac('vid:' + id)) ? id : null
}

// ── Signed view token: base64url(JSON payload) + "." + hmac ───

export interface ViewTokenPayload {
  /** content id */
  c: string
  /** content type */
  t: string
  /** salted hash of the visitor id the token was issued to */
  v: string
  /** issue time (server clock, ms) */
  iat: number
  /** nonce */
  n: string
}

export function signViewToken(payload: ViewTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${hmac('vtk:' + body)}`
}

export function verifyViewToken(token: string): ViewTokenPayload | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0 || token.length > 2048) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!safeEqual(sig, hmac('vtk:' + body))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as ViewTokenPayload
    if (
      typeof payload.c !== 'string' || typeof payload.t !== 'string' ||
      typeof payload.v !== 'string' || typeof payload.iat !== 'number' ||
      typeof payload.n !== 'string'
    ) return null
    return payload
  } catch {
    return null
  }
}
