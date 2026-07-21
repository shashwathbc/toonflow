/**
 * Toonflow service worker (hand-rolled, replaces next-pwa/workbox).
 *
 * Strategy:
 *  - Navigations:        network-first, cache fallback when offline.
 *  - /_next/static, fonts, icons, images: cache-first (content-hashed or immutable).
 *  - Everything else (APIs, Firebase, auth): never intercepted.
 *
 * Bump CACHE_VERSION to invalidate all runtime caches on deploy.
 */
// v2 (2026-07-20): purges the previous icon cache. The old /icons/* files were
// JPEGs mis-named .png; bumping this is the ONLY eviction mechanism this SW has
// (see the activate handler below), so it is required whenever a cached asset
// changes at a path that isn't content-hashed.
const CACHE_VERSION = 'v2'
const STATIC_CACHE = `tf-static-${CACHE_VERSION}`
const PAGE_CACHE = `tf-pages-${CACHE_VERSION}`
const KNOWN_CACHES = [STATIC_CACHE, PAGE_CACHE]

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop old workbox/next-pwa caches and any versioned caches we no longer use.
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// Cache-first, cache-forever. Only safe for URLs that are content-hashed or
// filename-versioned — anything else becomes permanently un-updatable in the
// field, because there is no revalidation and no expiry here.
//
// Deliberately NOT listed:
//   /manifest.json — the one file that must be able to change; caching it
//                    forever would pin the icon list even after icons update.
//   /favicon.ico   — unhashed path; HTTP caching handles it fine at 26KB.
//   /og-image.png  — path retired; the App Router opengraph-image convention
//                    replaces it and is content-hashed.
// App Router icon conventions (/icon.png, /apple-icon.png, /opengraph-image.png)
// intentionally match nothing here — Next content-hashes their URLs, so they
// self-bust and must not be trapped in a cache-forever branch.
const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//, // safe: filenames are versioned (icon-192.v2.png)
  /^\/images\//,
]

function isStaticAsset(url) {
  return STATIC_PATTERNS.some((re) => re.test(url.pathname))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE)
          cache.put(request, response.clone())
        }
        return response
      })()
    )
    return
  }

  // Page navigations: network-first with cache fallback for offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok) {
            const cache = await caches.open(PAGE_CACHE)
            cache.put(request, response.clone())
          }
          return response
        } catch {
          const cached = await caches.match(request)
          if (cached) return cached
          throw new Error('offline and not cached')
        }
      })()
    )
  }
})
