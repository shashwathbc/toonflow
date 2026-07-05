import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/utils/constants'

export const revalidate = 3600 // rebuild the sitemap at most hourly

const STATIC_ROUTES = ['', '/browse', '/originals', '/ai-policy', '/privacy', '/terms']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const routes: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))

  // Best-effort: include published novels. Never let a Firestore/credential
  // failure break the sitemap — fall back to the static routes.
  try {
    const { adminDb } = await import('@/lib/firebase/serverApp')
    const snap = await adminDb()
      .collection('novels')
      .where('status', 'in', ['published', 'ongoing', 'completed'])
      .select('updatedAt')
      .limit(5000)
      .get()
    for (const doc of snap.docs) {
      const updated = doc.data().updatedAt
      routes.push({
        url: `${APP_URL}/novel/${doc.id}`,
        lastModified: updated?.toDate?.() ?? now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  } catch {
    // static routes only
  }

  return routes
}
