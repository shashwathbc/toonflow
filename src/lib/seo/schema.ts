// schema.org JSON-LD builders for rich search results.
//
// These return plain objects rendered by <JsonLd> (src/components/seo/JsonLd.tsx).
// Keep them pure and free of `undefined` values — a stray `undefined` serialises
// away, but half-built nodes confuse validators, so only include a key when we
// have a real value for it. One source of truth for brand identity (APP_NAME /
// APP_URL) so every page emits a consistent Organization/WebSite entity.
import { APP_NAME, APP_URL } from '@/lib/utils/constants'

/** Absolute URL for a site-relative path (schema.org wants absolute URLs). */
function abs(path: string): string {
  return path.startsWith('http') ? path : `${APP_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Brand's official profiles — drives the `sameAs` graph edge for the Organization
 *  entity (same accounts the Footer links). Update both if these ever change. */
const SOCIAL_PROFILES = [
  'https://www.instagram.com/toonflowstudiopaint/',
  'https://www.linkedin.com/company/toonflow-studio-paint/',
]

/** Organization entity — makes Toonflow eligible for a brand knowledge panel. */
export function organizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: APP_NAME,
    url: APP_URL,
    logo: abs('/icon.png'),
    description:
      'AI-powered platform to create and publish webtoons, manga, and novels, and read originals from creators worldwide.',
    sameAs: SOCIAL_PROFILES,
  }
}

/** WebSite entity with a sitelinks search box wired to /browse?q=. */
export function websiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: APP_NAME,
    url: APP_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${APP_URL}/browse?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** A creation tool as a WebApplication — used on the AI generator landing pages.
 *  We intentionally omit aggregateRating (we won't fabricate ratings), so this
 *  aids entity understanding without claiming a star rating we don't have. */
export function softwareAppSchema(opts: {
  name: string
  description: string
  path: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: APP_NAME,
      url: APP_URL,
    },
  }
}

export interface FaqItem {
  q: string
  a: string
}

/** FAQPage entity — mirror the visible on-page FAQ exactly (Google requires the
 *  answer text to be present in the rendered HTML). */
export function faqPageSchema(faqs: readonly FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

/** BreadcrumbList — helps Google render the URL as a breadcrumb trail. */
export function breadcrumbSchema(
  items: readonly { name: string; path: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  }
}
