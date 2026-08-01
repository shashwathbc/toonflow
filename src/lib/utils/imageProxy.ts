// Same-origin image proxy helpers.
//
// Firebase Storage panel art is served from `firebasestorage.googleapis.com`
// with a 1-year cache header. Reading those pixels into a canvas (editor export,
// reader download) requires the response to carry CORS headers — and even once
// the bucket CORS is set, browsers keep serving the *cached* pre-CORS copy,
// which taints the canvas. Routing the image through our own origin
// (`/api/img?u=…`) sidesteps both problems: a same-origin image never taints,
// and the fresh proxy URL isn't in the stale cache.

const STORAGE_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com']

/** True for Firebase Storage / GCS URLs we're willing to proxy. */
export function isStorageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return (
      STORAGE_HOSTS.includes(hostname) ||
      hostname.endsWith('.firebasestorage.app') ||
      hostname.endsWith('.appspot.com')
    )
  } catch {
    return false
  }
}

/** Same-origin proxy URL for a remote Storage image. */
export function proxyImageUrl(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`
}
