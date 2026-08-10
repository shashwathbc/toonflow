// Same-origin image proxy helpers.
//
// Firebase Storage panel art is served from `firebasestorage.googleapis.com`
// with a 1-year cache header. Reading those pixels into a canvas (editor export,
// reader download) requires the response to carry CORS headers — and even once
// the bucket CORS is set, browsers keep serving the *cached* pre-CORS copy,
// which taints the canvas. Routing the image through our own origin
// (`/api/img?u=…`) sidesteps both problems: a same-origin image never taints,
// and the fresh proxy URL isn't in the stale cache.
//
// SECURITY — why this allowlist is BUCKET-scoped, not host-scoped.
// This used to accept any URL on `storage.googleapis.com`, `*.appspot.com` or
// `*.firebasestorage.app`. Every one of those namespaces is open to public
// registration: anyone can create a GCS bucket or a Firebase project and get a
// hostname inside them. That made /api/img an OPEN RELAY that echoed
// attacker-controlled bytes — including attacker-controlled `Content-Type` —
// back out of *our* origin, which is same-origin script execution on
// toonflowstudiopaint.com (see SECURITY.md F-14). The proxy must therefore
// resolve the target's BUCKET and require it to be one of ours.

/**
 * Buckets this deployment is willing to proxy. Derived from config rather than
 * hardcoded so preview/staging projects lock to their own bucket automatically.
 * Firebase migrated bucket naming from `<project>.appspot.com` to
 * `<project>.firebasestorage.app`, and old download URLs still carry the legacy
 * name, so both spellings of OUR project are accepted — but nothing else is.
 */
function allowedBuckets(): Set<string> {
  const configured = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const buckets = new Set<string>()
  if (configured) buckets.add(configured.toLowerCase())
  if (project) {
    buckets.add(`${project.toLowerCase()}.appspot.com`)
    buckets.add(`${project.toLowerCase()}.firebasestorage.app`)
  }
  return buckets
}

/**
 * Extract the bucket a Storage/GCS URL addresses, or null if the URL isn't a
 * recognised Storage read at all. The bucket can appear in three places:
 *   • `firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>` — download URLs
 *   • `storage.googleapis.com/<bucket>/<path>`               — direct GCS
 *   • `<bucket>/<path>` (the host IS the bucket)             — domain-style
 */
function bucketOf(url: URL): string | null {
  const host = url.hostname.toLowerCase()

  if (host === 'firebasestorage.googleapis.com') {
    // /v0/b/<bucket>/o/<object>
    const m = /^\/v0\/b\/([^/]+)\/o(?:\/|$)/.exec(url.pathname)
    return m ? decodeURIComponent(m[1]).toLowerCase() : null
  }

  if (host === 'storage.googleapis.com') {
    // /<bucket>/<object>
    const m = /^\/([^/]+)\//.exec(url.pathname)
    return m ? decodeURIComponent(m[1]).toLowerCase() : null
  }

  // Domain-style access: the hostname itself is the bucket.
  if (host.endsWith('.firebasestorage.app') || host.endsWith('.appspot.com')) {
    return host
  }

  return null
}

/**
 * True only for URLs that read an object out of a bucket THIS deployment owns.
 * Everything else — other people's buckets, other hosts, non-HTTPS, embedded
 * credentials, non-default ports — is refused.
 */
export function isStorageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  // `https://storage.googleapis.com@evil.test/…` parses with hostname evil.test,
  // but credentials in a proxy target are never legitimate here — refuse them
  // outright rather than reasoning about how each parser handles them.
  if (parsed.username || parsed.password) return false
  if (parsed.port) return false

  const bucket = bucketOf(parsed)
  return bucket !== null && allowedBuckets().has(bucket)
}

/** Same-origin proxy URL for a remote Storage image. */
export function proxyImageUrl(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`
}
