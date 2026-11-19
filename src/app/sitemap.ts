import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/utils/constants'
import { PUBLIC_STATUSES, isIndexable } from '@/lib/seo/contentMeta'

export const revalidate = 3600 // rebuild the sitemap at most hourly

// Public, crawlable routes.
// (/login and /signup are excluded deliberately: robots.ts disallows them.)
const STATIC_ROUTES = [
  '',
  '/originals',
  '/browse',
  '/marketplace',
  '/marketplace/art',
  '/marketplace/merch',
  '/ai-policy',
  '/privacy',
  '/terms',
]

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
    const [novelSnap, webtoonSnap] = await Promise.all([
      db.collection('novels').where('status', 'in', [...PUBLIC_STATUSES]).select('updatedAt', 'status', 'visibility').limit(MAX_URLS_PER_COLLECTION).get(),
      db.collection('webtoons').where('status', 'in', [...PUBLIC_STATUSES]).select('updatedAt', 'status', 'visibility').limit(MAX_URLS_PER_COLLECTION).get(),
    ])
    for (const [prefix, snap] of [['/novel', novelSnap], ['/webtoon', webtoonSnap]] as const) {
      for (const doc of snap.docs) {
        const data = doc.data()
        // Status alone isn't enough: a `private` novel or an `unlisted` webtoon
        // can still be `published`, and submitting those told Google to index
        // content the creator deliberately kept out of search. isIndexable() is
        // the same predicate the pages use for their robots meta, so the sitemap
        // and the page can never disagree. Filtered here rather than in the
        // query so this needs no new composite index.
        if (!isIndexable(data.status, data.visibility)) continue
        routes.push({
          url: `${APP_URL}${prefix}/${doc.id}`,
          lastModified: data.updatedAt?.toDate?.() ?? now,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
    }

    // Marketplace listings. ONLY `published` documents are queried, and artwork
    // is additionally filtered to `public` visibility — an `unlisted` piece is
    // reachable by link but deliberately kept out of search, the same contract
    // the artwork page's robots meta states.
    const MAX_MARKETPLACE_URLS = 10_000
    const [artSnap, productSnap] = await Promise.all([
      db
        .collection('artworks')
        .where('status', '==', 'published')
        .select('updatedAt', 'visibility')
        .limit(MAX_MARKETPLACE_URLS)
        .get(),
      db
        .collection('products')
        .where('status', '==', 'published')
        .select('updatedAt')
        .limit(MAX_MARKETPLACE_URLS)
        .get(),
    ])

    for (const doc of artSnap.docs) {
      const data = doc.data()
      if (data.visibility !== 'public') continue
      routes.push({
        url: `${APP_URL}/artwork/${doc.id}`,
        lastModified: data.updatedAt?.toDate?.() ?? now,
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    }
    for (const doc of productSnap.docs) {
      const data = doc.data()
      routes.push({
        url: `${APP_URL}/product/${doc.id}`,
        lastModified: data.updatedAt?.toDate?.() ?? now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  } catch {
    // static routes only
  }

  return routes
}
