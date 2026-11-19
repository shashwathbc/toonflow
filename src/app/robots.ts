import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/utils/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private/authenticated surfaces should never be crawled. `/create`
      // covers the Novel and Webtoon studios — a creator's unreleased projects,
      // drafts and prompts must stay out of search. The PUBLIC results of that
      // work (/marketplace, /product/**, /artwork/**) are deliberately absent
      // from this list so they can be indexed.
      disallow: ['/admin', '/dashboard', '/create', '/api', '/login', '/signup'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
