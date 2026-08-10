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

/**
 * True if the value contains a C0 control character or a space. URL parsers
 * strip these before resolving, so a value can mean something different to the
 * browser than it does to a prefix check (`/<TAB>javascript:...`). Written as a
 * code-point scan rather than a regex so the source carries no literal control
 * bytes.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Returns `raw` if it is a SAME-ORIGIN, in-app path safe to hand to
 * `router.push()`, otherwise null.
 *
 * Notification `link` values are written cross-user: Firestore rules let any
 * signed-in user drop a notification into any other user's feed (that is what
 * makes "X liked your chapter" work), and rules can only bound the field's TYPE
 * and LENGTH — not its meaning. Every link the app itself writes is a relative
 * in-app route (`/profile/{uid}`, `/novel/{id}/chapter/{cid}`, …), so requiring
 * that shape costs nothing and removes the whole class:
 *   • `https://evil.test/login` — a "notification" that silently navigates the
 *     victim to a credential-harvesting clone of our own login page.
 *   • `javascript:…` — router.push hands an off-origin URL to
 *     `window.location.href`, which is a script-execution context.
 *
 * Rejected: absolute URLs of any scheme, protocol-relative `//host`, backslash
 * variants (`/\host`, which several URL parsers normalise to `//host`), and
 * anything not starting with a single `/`.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  // Must be rooted, and the second character must not turn it into an authority.
  if (!trimmed.startsWith('/')) return null
  if (trimmed[1] === '/' || trimmed[1] === '\\') return null
  if (hasControlChars(trimmed)) return null

  // Final authority: resolve against a throwaway origin and confirm nothing in
  // the value moved it off that origin.
  try {
    const base = 'https://internal.invalid'
    const resolved = new URL(trimmed, base)
    if (resolved.origin !== base) return null
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return null
  }
}
