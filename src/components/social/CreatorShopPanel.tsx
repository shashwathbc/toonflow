'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Palette, Shirt } from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import { listCreatorPublished } from '@/lib/firebase/art'
import { formatMinor } from '@/lib/art/catalog'
import { toTitleCase } from '@/lib/utils/formatters'
import type { Artwork, Product } from '@/types/art'

/**
 * A creator's public storefront, shown as a tab on their profile.
 *
 * Reads PUBLISHED items only — the same predicate the Firestore rules enforce —
 * so a visitor never sees another creator's drafts, and the panel is safe to
 * render for the profile owner and strangers alike.
 */
export default function CreatorShopPanel({
  uid,
  isOwnProfile,
}: {
  uid: string
  isOwnProfile: boolean
}) {
  // Tagged with the uid it was fetched for, so `loading` can be derived instead
  // of flipped synchronously inside the effect (react-hooks/set-state-in-effect),
  // and a uid change never shows the previous creator's shop.
  const [loaded, setLoaded] = useState<{ uid: string; artworks: Artwork[]; products: Product[] } | null>(
    null,
  )

  useEffect(() => {
    let active = true
    void listCreatorPublished(uid)
      .then((result) => {
        if (!active) return
        setLoaded({ uid, artworks: result.artworks, products: result.products })
      })
      .catch((err) => {
        console.error('[CreatorShopPanel]', err)
        if (active) setLoaded({ uid, artworks: [], products: [] })
      })
    return () => {
      active = false
    }
  }, [uid])

  const fresh = loaded?.uid === uid ? loaded : null
  const loading = fresh === null
  const artworks = fresh?.artworks ?? []
  const products = fresh?.products ?? []

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="aspect-square w-full" aria-label="Loading shop…" />
        ))}
      </div>
    )
  }

  if (artworks.length === 0 && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Palette size={36} className="mb-4 text-white/20" aria-hidden="true" />
        <p className="text-sm text-white/50">
          {isOwnProfile ? "You haven't published any artwork or products yet." : 'Nothing published yet.'}
        </p>
        {isOwnProfile && (
          <Link href="/create/art" className="btn-accent mt-4 text-sm">
            Open Art Studio
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {products.length > 0 && (
        <section aria-labelledby="creator-products">
          <h2 id="creator-products" className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/60">
            Products
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" role="list">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/product/${product.id}`}
                  className="group block overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-colors hover:border-studio-art/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art"
                >
                  <span className="relative block aspect-square w-full bg-bg-elevated">
                    {product.previewURL ? (
                      <Image
                        src={product.previewURL}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 16vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-muted">
                        <Shirt size={20} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="block p-2.5">
                    <span className="block truncate text-xs font-semibold text-text">
                      {toTitleCase(product.title)}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold tabular-nums text-studio-art">
                      {formatMinor(product.fromPriceMinor)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {artworks.length > 0 && (
        <section aria-labelledby="creator-artwork">
          <h2 id="creator-artwork" className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/60">
            Artwork
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" role="list">
            {artworks.map((artwork) => (
              <li key={artwork.id}>
                <Link
                  href={`/artwork/${artwork.id}`}
                  className="group block overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-colors hover:border-studio-art/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art"
                >
                  <span className="relative block aspect-square w-full bg-bg-elevated">
                    {artwork.imageURL ? (
                      <Image
                        src={artwork.imageURL}
                        alt={artwork.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 16vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-muted">
                        <Palette size={20} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="block p-2.5">
                    <span className="block truncate text-xs font-semibold text-text">
                      {toTitleCase(artwork.title)}
                    </span>
                    <span className="mt-0.5 block text-[11px] capitalize text-text-muted">
                      {artwork.category.replace('-', ' ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
