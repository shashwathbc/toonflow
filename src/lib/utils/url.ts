// URL safety helpers. User-supplied links (profile "website", etc.) must never
// be rendered into an href unchecked — a value like `javascript:...` or
// `data:text/html,...` becomes a stored-XSS click target for other visitors.

/**
 * Returns a normalized absolute http(s) URL if `raw` is a safe web link,
 * otherwise null. Bare hosts ("example.com") are upgraded to https://.
 * Rejects javascript:, data:, vbscript:, file:, and any non-web scheme.
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Treat a scheme-less value as an https host (common in user profile input).
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return parsed.toString()
}
