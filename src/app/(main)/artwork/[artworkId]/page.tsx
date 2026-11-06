import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Eye, Palette } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import ListingViewTracker from '@/components/marketplace/ListingViewTracker'
import LikeButton from '@/components/reader/LikeButton'
import ShareButton from '@/components/ui/ShareButton'
import CommentSection from '@/components/reader/CommentSection'
import { adminDb } from '@/lib/firebase/serverApp'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import type { Artwork } from '@/types/art'

// Rendered per request. A listing's price, availability and published state can
// change at any moment, and an ISR-cached storefront page would keep serving a
// withdrawn or repriced item until its window lapsed.
//
// NOTE: notFound() currently responds 200 (with the 404 body) on this Next
// build — verified against `next start`, and unrelated to caching, since it
// persists under force-dynamic. The SEO protection that actually matters is
// already in place: generateMetadata returns `robots: noindex, nofollow` for a
// missing or unpublished listing, so a soft-404 is never indexed.
export const dynamic = 'force-dynamic'

/** Only PUBLISHED artwork is reachable — drafts stay private even by direct id. */
async function getPublishedArtwork(artworkId: string): Promise<Artwork | null> {
  try {
    const snap = await adminDb().collection('artworks').doc(artworkId).get()
    if (!snap.exists || snap.get('status') !== 'published') return null
    return JSON.parse(
      JSON.stringify({ id: snap.id, ...snap.data(), createdAt: null, updatedAt: null, publishedAt: null }),
    ) as Artwork
  } catch (err) {
    console.error('[artwork page] read failed', err)
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ artworkId: string }>
}): Promise<Metadata> {
  const { artworkId } = await params
  const artwork = await getPublishedArtwork(artworkId)
  if (!artwork) return { title: 'Artwork not found', robots: { index: false, follow: false } }

  const title = `${toTitleCase(artwork.title)} by ${artwork.ownerName}`
  const description =
    artwork.description.slice(0, 155) ||
    `${toTitleCase(artwork.title)} — original ${artwork.category.replace('-', ' ')} by ${artwork.ownerName}.`

  return {
    title,
    description,
    alternates: { canonical: `/artwork/${artwork.id}` },
    // `unlisted` artwork is reachable by link but must stay out of search.
    robots: artwork.visibility === 'public' ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${APP_URL}/artwork/${artwork.id}`,
      siteName: APP_NAME,
      images: artwork.imageURL ? [{ url: artwork.imageURL, alt: artwork.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      site: SOCIAL_HANDLE,
      title,
      description,
      images: artwork.imageURL ? [artwork.imageURL] : undefined,
    },
  }
}

export default async function ArtworkPage({ params }: { params: Promise<{ artworkId: string }> }) {
  const { artworkId } = await params
  const artwork = await getPublishedArtwork(artworkId)
  if (!artwork) notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <ListingViewTracker kind="artwork" id={artwork.id} />

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'VisualArtwork',
          name: artwork.title,
          description: artwork.description || undefined,
          image: artwork.imageURL ?? undefined,
          creator: { '@type': 'Person', name: artwork.ownerName },
          artform: artwork.category.replace('-', ' '),
          width: `${artwork.width} px`,
          height: `${artwork.height} px`,
          url: `${APP_URL}/artwork/${artwork.id}`,
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-text-secondary">
        <ol className="flex flex-wrap items-center gap-1.5" role="list">
          <li>
            <Link href="/marketplace" className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Marketplace
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/marketplace/art" className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Artwork
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text" aria-current="page">
            {toTitleCase(artwork.title)}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative w-full overflow-hidden rounded-2xl border border-bg-border bg-bg-elevated">
          {artwork.imageURL ? (
            <Image
              src={artwork.imageURL}
              alt={artwork.title}
              width={artwork.width || 1200}
              height={artwork.height || 1200}
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="h-auto w-full object-contain"
              priority
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-text-muted">
              <Palette size={32} aria-hidden="true" />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase capitalize tracking-wider text-studio-art">
            {artwork.category.replace('-', ' ')}
          </p>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-text lg:text-3xl">
            {toTitleCase(artwork.title)}
          </h1>

          <Link
            href={`/profile/${artwork.ownerId}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg text-sm text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {artwork.ownerPhotoURL && (
              <Image
                src={artwork.ownerPhotoURL}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
              />
            )}
            by <span className="font-semibold text-text">{artwork.ownerName}</span>
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <LikeButton
              contentType="artwork"
              contentId={artwork.id}
              initialCount={artwork.likeCount}
              size="sm"
              authorId={artwork.ownerId}
              contentTitle={artwork.title}
            />
            <ShareButton
              title={artwork.title}
              url={`${APP_URL}/artwork/${artwork.id}`}
              text={`${toTitleCase(artwork.title)} by ${artwork.ownerName}`}
            />
            <dl className="flex items-center gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <Eye size={12} aria-hidden="true" />
                <dt className="sr-only">Views</dt>
                <dd>{formatCount(artwork.viewCount)}</dd>
              </div>
              <div>
                <dt className="sr-only">Dimensions</dt>
                <dd className="tabular-nums">
                  {artwork.width}×{artwork.height}
                </dd>
              </div>
            </dl>
          </div>

          {artwork.source === 'ai' && (
            // AI disclosure is a policy commitment on this platform, so it is
            // stated on the listing rather than buried in metadata.
            <p className="mt-4 rounded-lg border border-bg-border bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
              This artwork was created with AI assistance.
            </p>
          )}

          {artwork.description && (
            <section className="mt-6" aria-labelledby="artwork-description">
              <h2 id="artwork-description" className="mb-2 text-sm font-bold text-text">
                About
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {artwork.description}
              </p>
            </section>
          )}

          {artwork.tags.length > 0 && (
            <section className="mt-6" aria-labelledby="artwork-tags">
              <h2 id="artwork-tags" className="mb-2 text-sm font-bold text-text">
                Tags
              </h2>
              <ul className="flex flex-wrap gap-1.5" role="list">
                {artwork.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-bg-border px-2.5 py-1 text-[11px] text-text-secondary"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link
            href={`/profile/${artwork.ownerId}`}
            className="btn-ghost mt-7 inline-flex px-4 py-2 text-sm"
          >
            See more from {artwork.ownerName}
          </Link>
        </div>
      </div>

      <section className="mt-12 border-t border-bg-border pt-8" aria-labelledby="artwork-comments">
        <h2 id="artwork-comments" className="sr-only">
          Comments
        </h2>
        <CommentSection
          targetId={artwork.id}
          targetType="artwork"
          creatorId={artwork.ownerId}
          contentTitle={artwork.title}
          contentLink={`/artwork/${artwork.id}`}
        />
      </section>
    </div>
  )
}
