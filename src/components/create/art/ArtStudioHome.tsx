'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Brush,
  Globe,
  ImagePlus,
  Palette,
  Plus,
  Shirt,
  Sparkles,
  Store,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import {
  createArtwork,
  deleteArtwork,
  subscribeToUserArtworks,
  subscribeToUserProducts,
  updateArtwork,
} from '@/lib/firebase/art'
import { uploadArtworkOriginal } from '@/lib/firebase/storage'
import { validateArtworkFile, validateDimensions } from '@/lib/art/validation'
import { formatMinor } from '@/lib/art/catalog'
import { track } from '@/lib/analytics/events'
import { ART_CATEGORIES, type Artwork, type Product } from '@/types/art'

/** Read an image's real pixel dimensions in the browser. */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    image.src = url
  })
}

function ActionTile({
  href,
  onClick,
  icon,
  title,
  subtitle,
  primary,
}: {
  href?: string
  onClick?: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  primary?: boolean
}) {
  const className = primary
    ? 'group flex items-center gap-3 rounded-2xl bg-studio-art p-4 text-left text-bg transition-colors hover:bg-studio-art/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
    : 'group flex items-center gap-3 rounded-2xl border border-bg-border bg-bg-card p-4 text-left transition-colors hover:border-studio-art/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art'

  const content = (
    <>
      <span className={primary ? 'shrink-0' : 'shrink-0 text-studio-art'} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${primary ? '' : 'text-text'}`}>{title}</span>
        <span className={`block truncate text-xs ${primary ? 'opacity-80' : 'text-text-secondary'}`}>
          {subtitle}
        </span>
      </span>
      <ArrowRight
        size={15}
        className="ml-auto shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden="true"
      />
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

const STATUS_STYLE: Record<Artwork['status'], string> = {
  draft: 'border-bg-border bg-bg-elevated text-text-secondary',
  published: 'border-success/25 bg-success/10 text-success',
  archived: 'border-bg-border bg-bg-elevated text-text-muted',
  removed: 'border-danger/25 bg-danger/10 text-danger',
}

export default function ArtStudioHome({ fulfillmentConnected }: { fulfillmentConnected: boolean }) {
  const router = useRouter()
  const { firebaseUser, userProfile } = useAuth()
  const uid = firebaseUser?.uid ?? null

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [products, setProducts] = useState<Product[]>([])
  // `loading` is DERIVED from which uid the current list belongs to, so nothing
  // is set synchronously in the effect body (react-hooks/set-state-in-effect).
  const [loadedUid, setLoadedUid] = useState<string | null>(null)
  const loading = uid !== null && loadedUid !== uid
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleting, setDeleting] = useState<Artwork | null>(null)

  useEffect(() => {
    if (!uid) return
    const unsubArt = subscribeToUserArtworks(uid, (next) => {
      setArtworks(next)
      setLoadedUid(uid)
    })
    const unsubProducts = subscribeToUserProducts(uid, setProducts)
    return () => {
      unsubArt()
      unsubProducts()
    }
  }, [uid])

  // Plain functions rather than useCallback: the React Compiler cannot preserve
  // manual memoization around an async body, and it memoizes handlers itself.
  const handleUpload = async (file: File) => {
      if (!uid) return

      // Validate BEFORE uploading: sniff the real container from the bytes, so a
      // renamed file never reaches storage. The publish route repeats this check
      // server-side on the stored object — this pass is for instant feedback,
      // not for security.
      const check = await validateArtworkFile(file)
      if (!check.ok) {
        toast.error(check.message ?? 'That file could not be used')
        return
      }
      if (check.detectedMime === 'image/svg+xml') {
        toast.error('SVG uploads are coming soon — please export a PNG or WebP for now.')
        return
      }

      setUploading(true)
      setUploadProgress(0)
      try {
        const { width, height } = await readDimensions(file)
        const dimensions = validateDimensions(width, height)
        if (!dimensions.ok) {
          toast.error(dimensions.message ?? 'Those dimensions are not supported')
          return
        }

        const artworkId = await createArtwork(uid, userProfile?.displayName ?? 'Creator', userProfile?.photoURL ?? null, {
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Untitled',
          category: 'illustration',
          source: 'upload',
          width,
          height,
          sizeBytes: file.size,
          mimeType: check.detectedMime ?? file.type,
          storageKey: null,
          imageURL: null,
          thumbnailURL: null,
        })

        const url = await uploadArtworkOriginal(uid, artworkId, file, (p) => setUploadProgress(p.progress))
        await updateArtwork(artworkId, { imageURL: url, thumbnailURL: url })

        track('artwork_created', { artworkId, source: 'upload' })
        toast.success('Artwork uploaded')
        router.push(`/create/art/editor/${artworkId}`)
      } catch (err) {
        console.error('[ArtStudioHome] upload failed', err)
        toast.error(describeArtError(err, 'Upload').message)
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
  }

  const handleBlankCanvas = async () => {
    if (!uid) return
    try {
      const artworkId = await createArtwork(uid, userProfile?.displayName ?? 'Creator', userProfile?.photoURL ?? null, {
        title: 'Untitled design',
        category: 'illustration',
        source: 'drawn',
        width: 2048,
        height: 2048,
        sizeBytes: 0,
        mimeType: 'image/png',
        storageKey: null,
        imageURL: null,
        thumbnailURL: null,
      })
      track('artwork_created', { artworkId, source: 'drawn' })
      router.push(`/create/art/editor/${artworkId}`)
    } catch (err) {
      const described = describeArtError(err, 'Creating the canvas')
      // Operational failures are configuration, not user error — log them at
      // error level so they surface in monitoring rather than dying in a toast.
      if (described.operational) console.error('[ArtStudioHome] blank canvas blocked', err)
      toast.error(described.message)
    }
  }

  const publishedCount = artworks.filter((art) => art.status === 'published').length

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* ── Landing card ─────────────────────────────────── */}
      {/* Flat tonal surface, Material-style — see the note in AnimeStudioHome. */}
      <section
        className="rounded-3xl border border-bg-border bg-bg-card p-6 sm:p-9 lg:p-12"
        aria-labelledby="art-studio-heading"
      >
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-studio-art/25 px-3 py-1 text-xs font-semibold text-studio-art">
              <Sparkles size={12} aria-hidden="true" />
              Art &amp; Merchandise
            </p>
            <h1 id="art-studio-heading" className="text-3xl font-black tracking-tight text-text sm:text-4xl lg:text-5xl">
              Art Studio
            </h1>
            <p className="mt-2 text-base font-semibold text-studio-art lg:text-lg">
              Create. Design. Publish. Sell.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary lg:text-base">
              Create and publish your artwork, clothing designs, caps, posters, merchandise, and other
              creative products.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <label
              className={`group flex cursor-pointer items-center gap-3 rounded-2xl bg-studio-art p-4 text-left text-bg transition-colors hover:bg-studio-art/90 focus-within:ring-2 focus-within:ring-studio-art focus-within:ring-offset-2 focus-within:ring-offset-bg ${uploading ? 'pointer-events-none opacity-70' : ''}`}
            >
              <Upload size={20} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  {uploading ? `Uploading… ${Math.round(uploadProgress)}%` : 'Upload artwork'}
                </span>
                <span className="block truncate text-xs opacity-80">PNG, JPG or WebP · up to 25 MB</span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void handleUpload(file)
                }}
              />
            </label>

            <ActionTile
              onClick={() => void handleBlankCanvas()}
              icon={<Brush size={20} />}
              title="Start drawing"
              subtitle="Blank canvas with layers & shapes"
            />
            <ActionTile
              href="/create/art/publish"
              icon={<Globe size={20} />}
              title="Publish & sell"
              subtitle={`${publishedCount} published`}
            />
            <ActionTile
              href="/marketplace"
              icon={<Store size={20} />}
              title="Marketplace"
              subtitle="See what other creators are selling"
            />
          </div>
        </div>
      </section>

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full bg-studio-art transition-[width] duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-muted">Uploading artwork — {Math.round(uploadProgress)}%</p>
        </div>
      )}

      {/* Fulfilment boundary */}
      {!fulfillmentConnected && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] p-4" role="status">
          <Shirt size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-text">Merch printing isn&apos;t connected yet</p>
            <p className="mt-1 leading-relaxed text-text-secondary">
              You can design products, preview them on real mockups and list them — but physical orders are
              refused at checkout rather than taking money for something that can&apos;t be shipped. Digital
              artwork is unaffected.
            </p>
          </div>
        </div>
      )}

      {/* ── Library ──────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="artworks-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="artworks-heading" className="text-lg font-bold text-text lg:text-xl">
            Your artwork
          </h2>
          <p className="text-xs text-text-muted lg:text-sm">
            {artworks.length} {artworks.length === 1 ? 'piece' : 'pieces'}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square w-full" aria-label="Loading artwork…" />
            ))}
          </div>
        ) : artworks.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-14 text-center">
            <Palette size={32} className="text-text-muted" aria-hidden="true" />
            <h3 className="mt-4 text-base font-bold text-text">No artwork yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
              Upload a design or start from a blank canvas. Once it&apos;s ready you can publish it or put it
              on merch.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" role="list">
            {artworks.map((artwork) => (
              <li
                key={artwork.id}
                className="group overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-colors hover:border-studio-art/40"
              >
                <Link
                  href={`/create/art/editor/${artwork.id}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art"
                  aria-label={`Edit ${artwork.title}`}
                >
                  <div className="relative aspect-square w-full bg-bg-elevated">
                    {artwork.thumbnailURL ? (
                      <Image
                        src={artwork.thumbnailURL}
                        alt={artwork.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-muted">
                        <ImagePlus size={22} aria-hidden="true" />
                      </span>
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${STATUS_STYLE[artwork.status]}`}
                    >
                      {artwork.status}
                    </span>
                  </div>
                </Link>
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold text-text">{artwork.title}</p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-text-muted">
                    {artwork.width}×{artwork.height}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <Link
                      href={`/create/art/editor/${artwork.id}`}
                      className="flex-1 rounded-md border border-bg-border py-1 text-center text-[10px] font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleting(artwork)}
                      className="rounded-md border border-bg-border px-2 py-1 text-text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                      aria-label={`Delete ${artwork.title}`}
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Products ─────────────────────────────────────── */}
      <section className="mt-12" aria-labelledby="products-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="products-heading" className="text-lg font-bold text-text lg:text-xl">
            Your products
          </h2>
          <Link
            href="/create/art/publish"
            className="inline-flex items-center gap-1.5 rounded-lg border border-bg-border px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:border-studio-art/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art"
          >
            <Plus size={15} aria-hidden="true" />
            New product
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-10 text-center">
            <Shirt size={26} className="mx-auto text-text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-text">No products yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">
              Put a design on a tee, hoodie, cap or poster — or list the artwork itself as a digital product.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" role="list">
            {products.map((product) => (
              <li key={product.id} className="overflow-hidden rounded-xl border border-bg-border bg-bg-card">
                <div className="relative aspect-square w-full bg-bg-elevated">
                  {product.previewURL ? (
                    <Image
                      src={product.previewURL}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 20vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-text-muted">
                      <Shirt size={22} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold text-text">{product.title}</p>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {formatMinor(product.fromPriceMinor)} · {product.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete artwork?"
        description={
          deleting
            ? `“${deleting.title}” will be permanently deleted. Any products using it will stop working. This can't be undone.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDeleting(null)} className="btn-ghost px-4 py-2 text-sm">
            Keep artwork
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!deleting) return
              try {
                await deleteArtwork(deleting.id)
                toast.success('Artwork deleted')
              } catch {
                toast.error('Could not delete that artwork')
              } finally {
                setDeleting(null)
              }
            }}
            className="btn-danger px-4 py-2 text-sm"
          >
            Delete permanently
          </button>
        </div>
      </Modal>
    </div>
  )
}

export { ART_CATEGORIES }
