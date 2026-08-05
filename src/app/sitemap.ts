import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/utils/constants'

export const revalidate = 3600 // rebuild the sitemap at most hourly

// Public, crawlable routes. /earnings is a public marketing page linked from the
// footer — it was missing here, so it was never submitted for indexing.
// (/login and /signup are excluded deliberately: robots.ts disallows them.)
const STATIC_ROUTES = ['', '/browse', '/originals', '/earnings', '/ai-policy', '/privacy', '/terms']

// Keyword-targeted "create with AI" landing pages. Higher priority than the rest
// of the static set — these are the primary acquisition surfaces for creation
// search intent (ai novel/webtoon/manga generator).
const LANDING_ROUTES = ['/ai-novel-generator', '/ai-webtoon-generator', '/ai-manga-generator']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const routes: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))

  for (const path of LANDING_ROUTES) {
    routes.push({
      url: `${APP_URL}${path}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    })
  }

  // Best-effort: include published novels AND webtoons. Webtoons were omitted
  // before, so half the catalog was never submitted for indexing. Never let a
  // Firestore/credential failure break the sitemap — fall back to static routes.
  //
  // STOPGAP (audit P2): a single sitemap file holds at most 50,000 URLs. The cap
  // below keeps static + landing + both collections under that ceiling. Once the
  // published catalog approaches this size, split into a sitemap INDEX with
  // paginated child sitemaps via Next's `generateSitemaps()` — until then this
  // just ensures far more than the old 5k/collection is actually submitted.
  const MAX_URLS_PER_COLLECTION = 20_000
  try {
    const { adminDb } = await import('@/lib/firebase/serverApp')
    const db = adminDb()
    const PUBLISHED = ['published', 'ongoing', 'completed']
    const [novelSnap, webtoonSnap] = await Promise.all([
      db.collection('novels').where('status', 'in', PUBLISHED).select('updatedAt').limit(MAX_URLS_PER_COLLECTION).get(),
      db.collection('webtoons').where('status', 'in', PUBLISHED).select('updatedAt').limit(MAX_URLS_PER_COLLECTION).get(),
    ])
    for (const [prefix, snap] of [['/novel', novelSnap], ['/webtoon', webtoonSnap]] as const) {
      for (const doc of snap.docs) {
        const updated = doc.data().updatedAt
        routes.push({
          url: `${APP_URL}${prefix}/${doc.id}`,
          lastModified: updated?.toDate?.() ?? now,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
    }
  } catch {
    // static routes only
  }

  return routes
}
