import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Eye, Shirt } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import ListingViewTracker from '@/components/marketplace/ListingViewTracker'
import ProductPurchasePanel from '@/components/marketplace/ProductPurchasePanel'
import SizeGuide from '@/components/marketplace/SizeGuide'
import LikeButton from '@/components/reader/LikeButton'
import ShareButton from '@/components/ui/ShareButton'
import CommentSection from '@/components/reader/CommentSection'
import { adminDb } from '@/lib/firebase/serverApp'
import { isFulfillmentConfigured } from '@/lib/art/fulfillment'
import { MATERIALS, formatMinor, productDefinition, resolveMaterial } from '@/lib/art/catalog'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import type { Product } from '@/types/art'

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

/**
 * Read a PUBLISHED product. Anything else returns null, so a draft can never be
 * reached by guessing its id — the same rule the Firestore listing rules apply,
 * enforced again here because this page renders with the Admin SDK (which
 * bypasses those rules).
 */
async function getPublishedProduct(productId: string): Promise<Product | null> {
  try {
    const snap = await adminDb().collection('products').doc(productId).get()
    if (!snap.exists || snap.get('status') !== 'published') return null
    return JSON.parse(
      JSON.stringify({
        id: snap.id,
        ...snap.data(),
        createdAt: null,
        updatedAt: null,
        publishedAt: null,
      }),
    ) as Product
  } catch (err) {
    console.error('[product page] read failed', err)
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>
}): Promise<Metadata> {
  const { productId } = await params
  const product = await getPublishedProduct(productId)
  if (!product) {
    // A missing or unpublished listing must never be indexed.
    return { title: 'Product not found', robots: { index: false, follow: false } }
  }

  const title = `${toTitleCase(product.title)} — ${productDefinition(product.productType)?.label ?? 'Product'}`
  const description =
    product.description.slice(0, 155) ||
    `${toTitleCase(product.title)} by ${product.ownerName}, from ${formatMinor(product.fromPriceMinor)}.`
  const url = `${APP_URL}/product/${product.id}`

  return {
    title,
    description,
    alternates: { canonical: `/product/${product.id}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: APP_NAME,
      images: product.previewURL ? [{ url: product.previewURL, alt: product.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      site: SOCIAL_HANDLE,
      title,
      description,
      images: product.previewURL ? [product.previewURL] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  const product = await getPublishedProduct(productId)
  if (!product) notFound()

  const def = productDefinition(product.productType)
  const fulfillmentConnected = isFulfillmentConfigured()
  const isDigital = product.productType === 'digital'

  // Fabric is stored on the listing; `resolveMaterial` covers listings created
  // before the field existed by falling back to the product's default.
  const material = def ? MATERIALS[resolveMaterial(def, product.materialId)] : null
  // Sizes this listing actually offers, in catalogue order — the size guide
  // dims the rest rather than hiding them, so the range stays legible.
  const availableSizes = def
    ? def.sizes.filter((size) => product.variants.some((variant) => variant.size === size))
    : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <ListingViewTracker kind="product" id={product.id} />

      {/* Product structured data. `availability` reflects REALITY: without a
          fulfilment provider, physical stock genuinely cannot be shipped, and
          claiming InStock would be a false signal to shopping surfaces. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.title,
          description: product.description || undefined,
          image: product.previewURL ? [product.previewURL] : undefined,
          brand: { '@type': 'Brand', name: APP_NAME },
          category: def?.label,
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: product.currency,
            lowPrice: (product.fromPriceMinor / 100).toFixed(2),
            highPrice: (
              Math.max(...product.variants.map((variant) => variant.priceMinor), product.fromPriceMinor) / 100
            ).toFixed(2),
            offerCount: product.variants.length,
            availability:
              isDigital || fulfillmentConnected
                ? 'https://schema.org/InStock'
                : 'https://schema.org/PreOrder',
            url: `${APP_URL}/product/${product.id}`,
          },
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
            <Link
              href={isDigital ? '/marketplace/art' : '/marketplace/merch'}
              className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {isDigital ? 'Artwork' : 'Merch'}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text" aria-current="page">
            {toTitleCase(product.title)}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Preview */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-bg-border bg-bg-elevated">
          {product.previewURL ? (
            <Image
              src={product.previewURL}
              alt={`${product.title} — ${def?.label ?? 'product'} preview`}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-text-muted">
              <Shirt size={32} aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-studio-art">{def?.label}</p>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-text lg:text-3xl">
            {toTitleCase(product.title)}
          </h1>

          <Link
            href={`/profile/${product.ownerId}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg text-sm text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {product.ownerPhotoURL && (
              <Image
                src={product.ownerPhotoURL}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
              />
            )}
            by <span className="font-semibold text-text">{product.ownerName}</span>
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <LikeButton
              contentType="product"
              contentId={product.id}
              initialCount={product.likeCount}
              size="sm"
              authorId={product.ownerId}
              contentTitle={product.title}
            />
            <ShareButton
              title={product.title}
              url={`${APP_URL}/product/${product.id}`}
              text={`${toTitleCase(product.title)} by ${product.ownerName}`}
            />
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <Eye size={12} aria-hidden="true" />
              <span className="sr-only">Views</span>
              {formatCount(product.viewCount)}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-bg-border bg-bg-card p-5">
            <ProductPurchasePanel product={product} fulfillmentConnected={fulfillmentConnected} />
          </div>

          {product.description && (
            <section className="mt-6" aria-labelledby="product-description">
              <h2 id="product-description" className="mb-2 text-sm font-bold text-text">
                About this design
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {product.description}
              </p>
            </section>
          )}

          {/* Fabric and fit. A buyer choosing a size needs the measurements on
              the page they buy from, not behind a link. */}
          {def && def.materials.length > 0 && material && (
            <section className="mt-6" aria-labelledby="product-material">
              <h2 id="product-material" className="mb-2 text-sm font-bold text-text">
                Fabric
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                <span className="font-semibold text-text">{material.name}</span>
                {material.gsm && <span className="text-text-muted"> · {material.gsm} GSM</span>}
                <br />
                {material.description}
              </p>
            </section>
          )}

          {def && def.category !== 'digital' && (
            <SizeGuide
              productType={product.productType}
              availableSizes={availableSizes}
              className="mt-6"
            />
          )}

          {product.tags.length > 0 && (
            <section className="mt-6" aria-labelledby="product-tags">
              <h2 id="product-tags" className="mb-2 text-sm font-bold text-text">
                Tags
              </h2>
              <ul className="flex flex-wrap gap-1.5" role="list">
                {product.tags.map((tag) => (
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
        </div>
      </div>

      <section className="mt-12 border-t border-bg-border pt-8" aria-labelledby="product-comments">
        <h2 id="product-comments" className="sr-only">
          Comments
        </h2>
        <CommentSection
          targetId={product.id}
          targetType="product"
          creatorId={product.ownerId}
          contentTitle={product.title}
          contentLink={`/product/${product.id}`}
        />
      </section>
    </div>
  )
}
