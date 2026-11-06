'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, Globe, Loader2, Shirt, Sparkles, Tag } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Skeleton from '@/components/ui/Skeleton'
import ProductMockup from './ProductMockup'
import PriceBreakdown from './PriceBreakdown'
import SizeGuide from './SizeGuide'
import { subscribeToUserArtworks } from '@/lib/firebase/art'
import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORY_LABELS,
  PRICE_BOUNDS,
  MATERIALS,
  formatMinor,
  productDefinition,
  productionCostMinor,
  type MaterialId,
  type ProductDefinition,
} from '@/lib/art/catalog'
import {
  DEFAULT_ECONOMICS,
  minimumRetailMinor,
  type MarketplaceEconomics,
} from '@/lib/art/pricing'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'
import { ART_CATEGORIES, type ArtCategory, type Artwork, type DesignPlacement, type PrintPlacement, type ProductType } from '@/types/art'

type Step = 'create' | 'preview' | 'details' | 'pricing' | 'publish'

const STEPS: { id: Step; label: string }[] = [
  { id: 'create', label: 'Create' },
  { id: 'preview', label: 'Preview' },
  { id: 'details', label: 'Details' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'publish', label: 'Publish' },
]

const CATEGORY_LABELS: Record<ArtCategory, string> = {
  illustration: 'Illustration',
  'character-design': 'Character design',
  'concept-art': 'Concept art',
  'manga-panel': 'Manga panel',
  chibi: 'Chibi',
  'pixel-art': 'Pixel art',
  poster: 'Poster',
  pattern: 'Pattern',
  typography: 'Typography',
  photography: 'Photography',
}

export default function PublishFlow({ fulfillmentConnected }: { fulfillmentConnected: boolean }) {
  const searchParams = useSearchParams()
  const { firebaseUser } = useAuth()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  // Settled once the subscription has delivered (or auth resolved to nobody).
  // Derived rather than a flag set inside the effect body.
  const [settled, setSettled] = useState(false)
  const [step, setStep] = useState<Step>('create')

  const [artworkId, setArtworkId] = useState<string>(searchParams.get('artworkId') ?? '')
  const [productType, setProductType] = useState<ProductType>('digital')
  const [materialId, setMaterialId] = useState<MaterialId>('cotton')
  const [placement, setPlacement] = useState<PrintPlacement>('front')
  const [colorIds, setColorIds] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [design, setDesign] = useState({ x: 0.5, y: 0.5, scale: 0.75, rotation: 0 })

  /**
   * The live rate card and the recommended price, fetched from the server.
   * `economics` starts at the compiled defaults so the breakdown renders
   * immediately; the server's answer replaces it and is authoritative.
   */
  const [economics, setEconomics] = useState<MarketplaceEconomics>(DEFAULT_ECONOMICS)
  const [suggestion, setSuggestion] = useState<{
    suggestedMinor: number
    rationale: string[]
    comparableCount: number
    usedComparables: boolean
  } | null>(null)
  const [suggesting, setSuggesting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ArtCategory>('illustration')
  const [tagsInput, setTagsInput] = useState('')
  const [priceMinor, setPriceMinor] = useState(19900)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [publishedProductId, setPublishedProductId] = useState<string | null>(null)

  const artwork = artworks.find((item) => item.id === artworkId) ?? null
  const def: ProductDefinition | null = productDefinition(productType)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeToUserArtworks(firebaseUser.uid, (next) => {
      setArtworks(next)
      setSettled(true)
      // Preselect the newest piece so the flow opens on something usable —
      // only when the URL didn't already name one.
      setArtworkId((current) => current || next[0]?.id || '')
    })
  }, [firebaseUser])

  const loading = Boolean(firebaseUser) && !settled

  /**
   * Switch product type and reset every choice that belongs to the old one, in a
   * single event handler. Doing this on the CHANGE rather than in an effect
   * means a hoodie can never briefly render with a cap's colour list, and there
   * is no synchronous setState inside an effect body.
   */
  const chooseProductType = (next: ProductType) => {
    const definition = productDefinition(next)
    setProductType(next)
    if (!definition) return
    setSizes(
      definition.sizes.length === 1
        ? [...definition.sizes]
        : [definition.sizes[Math.floor(definition.sizes.length / 2)]],
    )
    setColorIds(definition.colors.length > 0 ? [definition.colors[0].id] : [])
    setPlacement(definition.placements[0])
    setMaterialId(definition.defaultMaterial)
    setPriceMinor(definition.suggestedRetailMinor)
    // The old product's suggestion says nothing about the new one.
    setSuggestion(null)
  }

  /** Changing fabric changes production cost, so the old advice is stale. */
  const chooseMaterial = (next: MaterialId) => {
    setMaterialId(next)
    setSuggestion(null)
  }

  const chooseArtwork = (next: string) => {
    setArtworkId(next)
    // Seed the listing title from the artwork, unless the creator typed one.
    const picked = artworks.find((item) => item.id === next)
    if (picked) setTitle((current) => current || picked.title)
  }

  const artworkUrls = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of artworks) {
      if (item.imageURL) map[item.id] = item.imageURL
    }
    return map
  }, [artworks])

  const designs: DesignPlacement[] = useMemo(
    () => (artworkId ? [{ placement, artworkId, ...design }] : []),
    [artworkId, placement, design],
  )

  const selectedColor = def?.colors.find((color) => colorIds.includes(color.id)) ?? null

  const resolutionWarning =
    def && artwork && productType !== 'digital'
      ? artwork.width < def.minArtworkPx.width || artwork.height < def.minArtworkPx.height
      : false

  // ── Pricing ─────────────────────────────────────────────
  // The creator's single price applies to the SMALLEST size they offer; larger
  // sizes add their own production delta. Mirrors the server exactly.
  const baseSize = sizes.length > 0 ? sizes[0] : (def?.sizes[0] ?? '')
  const baseProductionMinor = def && baseSize ? productionCostMinor(def, baseSize, materialId) : 0
  const floorMinor = def ? minimumRetailMinor(baseProductionMinor, economics) : PRICE_BOUNDS.minMinor

  /**
   * Ask the server what to charge. Deliberately an explicit action rather than
   * something that fires as the creator types — pricing advice that arrives
   * unbidden reads as the platform setting the price.
   */
  const fetchSuggestion = async () => {
    if (!def) return
    setSuggesting(true)
    try {
      const response = await fetch('/api/art/price-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          materialId,
          size: baseSize,
          // A layered design is a more valuable one; a single flat image is not.
          designComplexity: 'standard',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not calculate a suggestion.')
      if (data.economics) setEconomics(data.economics as MarketplaceEconomics)
      setSuggestion({
        suggestedMinor: data.suggestedMinor,
        rationale: data.rationale ?? [],
        comparableCount: data.comparableCount ?? 0,
        usedComparables: Boolean(data.usedComparables),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not calculate a suggestion.')
    } finally {
      setSuggesting(false)
    }
  }

  // Plain derivation rather than useMemo: it is a switch over primitives, and
  // manual memoization here blocks the React Compiler from optimizing the whole
  // component for no measurable gain.
  const canContinue = ((): boolean => {
    switch (step) {
      case 'create':
        return Boolean(artworkId && def)
      case 'preview':
        return Boolean(artworkId) && sizes.length > 0
      case 'details':
        return title.trim().length >= 2
      case 'pricing':
        return priceMinor >= floorMinor
      default:
        return false
    }
  })()

  const goNext = () => {
    const index = STEPS.findIndex((item) => item.id === step)
    if (index < STEPS.length - 1) setStep(STEPS[index + 1].id)
  }
  const goBack = () => {
    const index = STEPS.findIndex((item) => item.id === step)
    if (index > 0) setStep(STEPS[index - 1].id)
  }

  /**
   * Publish the artwork first (the server verifies the stored bytes), then list
   * it. A plain function, not useCallback: the React Compiler can't preserve
   * manual memoization around an async body and memoizes handlers itself.
   */
  const publish = async () => {
    if (!artwork || !def) return
    if (!rightsConfirmed) {
      toast.error('Please confirm you own the rights to this artwork')
      return
    }
    setSubmitting(true)
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12)

    try {
      // 1) Artwork must be public before a product can show it.
      const artResponse = await fetch('/api/art/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artworkId: artwork.id,
          title: title.trim(),
          description: description.trim(),
          category,
          tags,
          rightsConfirmed: true,
          visibility: 'public',
        }),
      })
      const artData = await artResponse.json().catch(() => ({}))
      if (!artResponse.ok) {
        toast.error(artData.error ?? 'Could not publish that artwork')
        return
      }
      track('artwork_published', { artworkId: artwork.id, category })

      // 2) Then the listing itself.
      const productResponse = await fetch('/api/art/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artworkId: artwork.id,
          title: title.trim(),
          description: description.trim(),
          productType,
          materialId,
          tags,
          designs,
          priceMinor,
          sizes,
          colorIds,
          previewURL: artwork.imageURL,
          publish: true,
          rightsConfirmed: true,
        }),
      })
      const productData = await productResponse.json().catch(() => ({}))
      if (!productResponse.ok) {
        toast.error(productData.error ?? 'Could not create that product')
        return
      }

      track('product_published', { productId: productData.productId, productType })
      setPublishedProductId(productData.productId)
      setStep('publish')
      toast.success('Published to the marketplace')
    } catch (err) {
      console.error('[PublishFlow] publish failed', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-10 sm:px-6">
        <Skeleton className="h-9 w-56" aria-label="Loading…" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (artworks.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Tag size={30} className="mx-auto text-text-muted" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-text">Nothing to publish yet</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Upload or create some artwork in the Art Studio first, then come back to list it.
        </p>
        <Link href="/create/art" className="btn-accent mt-6 inline-flex px-4 py-2 text-sm">
          Open Art Studio
        </Link>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href="/create/art"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-xs font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Art Studio
      </Link>

      <h1 className="text-2xl font-black tracking-tight text-text lg:text-3xl">Publish &amp; sell</h1>

      {/* Step indicator */}
      <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Publishing steps">
        {STEPS.map((item, index) => {
          const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo'
          return (
            <li key={item.id} className="flex items-center gap-2">
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                  state === 'done' && 'border-success/30 bg-success/10 text-success',
                  state === 'current' && 'border-studio-art/40 bg-studio-art/15 text-studio-art',
                  state === 'todo' && 'border-bg-border text-text-muted',
                )}
              >
                {state === 'done' ? (
                  <Check size={11} aria-hidden="true" />
                ) : (
                  <span className="tabular-nums">{index + 1}</span>
                )}
                {item.label}
              </span>
              {index < STEPS.length - 1 && (
                <ArrowRight size={11} className="text-text-muted" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Step body ─────────────────────────────────── */}
        <div className="rounded-2xl border border-bg-border bg-bg-card p-5 lg:p-6">
          {step === 'create' && (
            <div className="space-y-6">
              <section aria-labelledby="pick-artwork">
                <h2 id="pick-artwork" className="mb-3 text-base font-bold text-text">
                  Choose artwork
                </h2>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" role="list">
                  {artworks.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => chooseArtwork(item.id)}
                        aria-pressed={artworkId === item.id}
                        className={cn(
                          'block w-full overflow-hidden rounded-lg border transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                          artworkId === item.id
                            ? 'border-studio-art ring-2 ring-studio-art/40'
                            : 'border-bg-border hover:border-bg-border-strong',
                        )}
                      >
                        <span className="relative block aspect-square w-full bg-bg-elevated">
                          {item.thumbnailURL ? (
                            <Image
                              src={item.thumbnailURL}
                              alt={item.title}
                              fill
                              sizes="120px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] text-text-muted">
                              No render
                            </span>
                          )}
                        </span>
                        <span className="block truncate px-1.5 py-1 text-[10px] text-text-secondary">
                          {item.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {artwork && !artwork.imageURL && (
                  <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning" role="alert">
                    This artwork hasn&apos;t been rendered yet. Open it in the editor and press
                    &ldquo;Render &amp; publish&rdquo; first.
                  </p>
                )}
              </section>

              <section aria-labelledby="pick-product">
                <h2 id="pick-product" className="mb-3 text-base font-bold text-text">
                  Choose a product
                </h2>
                {/* Grouped by category so apparel, gym wear and accessories read
                    as distinct lanes rather than one undifferentiated grid. */}
                <div className="space-y-4">
                  {(['clothing', 'gym', 'accessory', 'digital'] as const).map((group) => {
                    const products = PRODUCT_CATALOG.filter((product) => product.category === group)
                    if (products.length === 0) return null
                    return (
                      <div key={group}>
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                          {PRODUCT_CATEGORY_LABELS[group]}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {products.map((product) => (
                            <button
                              key={product.type}
                              type="button"
                              onClick={() => chooseProductType(product.type)}
                              aria-pressed={productType === product.type}
                              className={cn(
                                'rounded-xl border p-3 text-left transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                                productType === product.type
                                  ? 'border-studio-art/50 bg-studio-art/10'
                                  : 'border-bg-border hover:border-bg-border-strong',
                              )}
                            >
                              <span className="block text-sm font-bold text-text">{product.label}</span>
                              <span className="mt-0.5 block text-[11px] text-text-secondary">
                                {product.blurb}
                              </span>
                              <span className="mt-1.5 block text-[11px] font-semibold text-studio-art">
                                around {formatMinor(product.suggestedRetailMinor)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {step === 'preview' && def && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-text">Position your design</h2>

              {def.placements.length > 1 && (
                <div role="tablist" aria-label="Print placement" className="flex flex-wrap gap-1.5">
                  {def.placements.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={placement === option}
                      onClick={() => setPlacement(option)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                        placement === option
                          ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                          : 'border-bg-border text-text-secondary hover:text-text',
                      )}
                    >
                      {option.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {(
                  [
                    ['scale', 'Size', 0.1, 1, 0.01],
                    ['x', 'Horizontal', 0, 1, 0.01],
                    ['y', 'Vertical', 0, 1, 0.01],
                    ['rotation', 'Rotation', -180, 180, 1],
                  ] as const
                ).map(([key, label, min, max, stepSize]) => (
                  <div key={key} className="grid grid-cols-[84px_1fr_44px] items-center gap-2">
                    <label htmlFor={`design-${key}`} className="text-xs text-text-secondary">
                      {label}
                    </label>
                    <input
                      id={`design-${key}`}
                      type="range"
                      min={min}
                      max={max}
                      step={stepSize}
                      value={design[key]}
                      onChange={(event) =>
                        setDesign((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                      }
                      className="w-full accent-studio-art"
                    />
                    <span className="text-right text-[10px] tabular-nums text-text-muted">
                      {stepSize < 1 ? design[key].toFixed(2) : Math.round(design[key])}
                    </span>
                  </div>
                ))}
              </div>

              {def.colors.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-text-secondary">Colours</legend>
                  <div className="flex flex-wrap gap-2">
                    {def.colors.map((color) => {
                      const active = colorIds.includes(color.id)
                      return (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() =>
                            setColorIds((prev) =>
                              active ? prev.filter((id) => id !== color.id) : [...prev, color.id],
                            )
                          }
                          aria-pressed={active}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                            active ? 'border-studio-art text-text' : 'border-bg-border text-text-secondary',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="h-3.5 w-3.5 rounded-full border border-bg-border-strong"
                            style={{ backgroundColor: color.hex }}
                          />
                          {color.name}
                          {active && <Check size={10} aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              {def.materials.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-text-secondary">Fabric</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {def.materials.map((id) => {
                      const material = MATERIALS[id]
                      const active = materialId === id
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => chooseMaterial(id)}
                          aria-pressed={active}
                          className={cn(
                            'rounded-lg border p-2.5 text-left transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                            active
                              ? 'border-studio-art/40 bg-studio-art/10'
                              : 'border-bg-border hover:border-bg-border-strong',
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold text-text">{material.name}</span>
                            {material.gsm && (
                              <span className="text-[10px] tabular-nums text-text-muted">
                                {material.gsm} GSM
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-text-secondary">
                            {material.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    Fabric changes what the item costs to make, which changes your minimum price.
                  </p>
                </fieldset>
              )}

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-text-secondary">Sizes</legend>
                <div className="flex flex-wrap gap-1.5">
                  {def.sizes.map((size) => {
                    const active = sizes.includes(size)
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setSizes((prev) => {
                            const next = active ? prev.filter((s) => s !== size) : [...prev, size]
                            // Keep the list in CATALOGUE order, not click order.
                            // The base price applies to sizes[0], so a creator
                            // who taps XXL before S must not accidentally price
                            // the whole listing off the largest size.
                            return def.sizes.filter((option) => next.includes(option))
                          })
                        }
                        aria-pressed={active}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                          active
                            ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                            : 'border-bg-border text-text-secondary hover:text-text',
                        )}
                      >
                        {size}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <SizeGuide productType={productType} availableSizes={sizes} />

              {resolutionWarning && def && artwork && (
                <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning" role="alert">
                  This artwork is {artwork.width}×{artwork.height}px. A {def.label.toLowerCase()} needs at
                  least {def.minArtworkPx.width}×{def.minArtworkPx.height}px to print cleanly — the server
                  will refuse to list it below that.
                </p>
              )}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-text">Listing details</h2>
              <div>
                <label htmlFor="listing-title" className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Title
                </label>
                <input
                  id="listing-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  className="input-base w-full"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="listing-description"
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
                >
                  Description
                </label>
                <textarea
                  id="listing-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  className="input-base w-full resize-none"
                  placeholder="What is this design about? What inspired it?"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="listing-category"
                    className="mb-1.5 block text-sm font-medium text-text-secondary"
                  >
                    Category
                  </label>
                  <select
                    id="listing-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as ArtCategory)}
                    className="input-base w-full"
                  >
                    {ART_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {CATEGORY_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="listing-tags" className="mb-1.5 block text-sm font-medium text-text-secondary">
                    Tags
                  </label>
                  <input
                    id="listing-tags"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    className="input-base w-full"
                    placeholder="anime, cyberpunk, streetwear"
                    aria-describedby="listing-tags-hint"
                  />
                  <p id="listing-tags-hint" className="mt-1 text-[11px] text-text-muted">
                    Comma separated, up to 12.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'pricing' && def && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-text">Pricing</h2>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="listing-price" className="text-sm font-medium text-text-secondary">
                    Your price{sizes.length > 1 && ` (${baseSize})`}
                  </label>
                  <span className="text-sm font-bold tabular-nums text-text">{formatMinor(priceMinor)}</span>
                </div>
                <input
                  id="listing-price"
                  type="range"
                  min={floorMinor}
                  max={Math.min(PRICE_BOUNDS.maxMinor, Math.max(floorMinor * 4, def.suggestedRetailMinor * 4))}
                  step={1000}
                  value={Math.max(priceMinor, floorMinor)}
                  onChange={(event) => setPriceMinor(Number(event.target.value))}
                  className="w-full accent-studio-art"
                  aria-describedby="listing-price-hint"
                />
                <p id="listing-price-hint" className="mt-1.5 text-[11px] text-text-muted">
                  Minimum {formatMinor(floorMinor)} — enough to cover {formatMinor(baseProductionMinor)}{' '}
                  production plus the platform fee and still leave you a margin. The server enforces this
                  floor.
                </p>
              </div>

              {/* ── AI price suggestion ─────────────────────────
                  Advisory only: applying it is a separate, explicit click, and
                  the creator's own number is never overwritten silently. */}
              <div className="rounded-xl border border-studio-art/25 bg-studio-art/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-text">
                    <Sparkles className="h-4 w-4 text-studio-art" aria-hidden="true" />
                    Suggested price
                  </h3>
                  <button
                    type="button"
                    onClick={() => void fetchSuggestion()}
                    disabled={suggesting}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border border-studio-art/40 px-2.5 py-1.5',
                      'text-[11px] font-bold text-studio-art transition-colors hover:bg-studio-art/10',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                      'disabled:opacity-60',
                    )}
                  >
                    {suggesting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {suggestion ? 'Recalculate' : 'Calculate'}
                  </button>
                </div>

                {suggestion ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-2xl font-black tabular-nums text-studio-art">
                        {formatMinor(suggestion.suggestedMinor)}
                      </span>
                      {priceMinor !== suggestion.suggestedMinor && (
                        <button
                          type="button"
                          onClick={() => setPriceMinor(suggestion.suggestedMinor)}
                          className={cn(
                            'rounded-md bg-studio-art px-2.5 py-1 text-[11px] font-bold text-bg',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                          )}
                        >
                          Use this price
                        </button>
                      )}
                    </div>
                    <ul className="mt-2.5 space-y-1" role="list">
                      {suggestion.rationale.map((reason) => (
                        <li key={reason} className="text-[11px] leading-relaxed text-text-secondary">
                          • {reason}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2.5 text-[11px] text-text-muted">
                      {suggestion.usedComparables
                        ? `Based on ${suggestion.comparableCount} similar live listings.`
                        : 'No similar listings yet, so this is based on cost and category alone.'}{' '}
                      It&apos;s a recommendation — your price is yours to set.
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
                    Work out a price from production cost, the platform fee and what comparable listings
                    are charging. You can ignore it.
                  </p>
                )}
              </div>

              <PriceBreakdown
                retailMinor={priceMinor}
                productionMinor={baseProductionMinor}
                economics={economics}
                floorMinor={floorMinor}
              />

              {sizes.length > 1 && (
                <div className="rounded-lg border border-bg-border p-3">
                  <p className="mb-2 text-xs font-semibold text-text">Variant pricing</p>
                  <ul className="space-y-1 text-xs text-text-secondary" role="list">
                    {sizes.map((size) => (
                      <li key={size} className="flex justify-between">
                        <span>{size}</span>
                        <span className="tabular-nums">
                          {formatMinor(
                            priceMinor + (productionCostMinor(def, size, materialId) - baseProductionMinor),
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-text-muted">
                    Larger sizes cost more to make; the difference is added to the price so your margin
                    stays the same on every size.
                  </p>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-bg-border p-3">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(event) => setRightsConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-bg-border-strong bg-bg-elevated accent-studio-art"
                />
                <span className="text-xs leading-relaxed text-text-secondary">
                  I confirm I created this artwork or hold the rights to sell it, and that it does not
                  infringe anyone else&apos;s copyright or trademarks.
                </span>
              </label>

              {productType !== 'digital' && !fulfillmentConnected && (
                <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning" role="status">
                  Printing and delivery aren&apos;t connected yet, so this listing will show as
                  unavailable to buy. It stays visible in the marketplace and starts selling the moment
                  fulfilment is live.
                </p>
              )}
            </div>
          )}

          {step === 'publish' && (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <Check size={26} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text">Published</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
                &ldquo;{title}&rdquo; is live in the marketplace.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {publishedProductId && (
                  <Link
                    href={`/product/${publishedProductId}`}
                    className="btn-accent inline-flex px-4 py-2 text-sm"
                  >
                    View listing
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStep('create')
                    setPublishedProductId(null)
                    setRightsConfirmed(false)
                  }}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  Publish another
                </button>
              </div>
            </div>
          )}

          {step !== 'publish' && (
            <div className="mt-6 flex justify-between gap-3 border-t border-bg-border pt-5">
              <button
                type="button"
                onClick={goBack}
                disabled={stepIndex === 0}
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
              >
                Back
              </button>
              {step === 'pricing' ? (
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={submitting || !rightsConfirmed || !canContinue}
                  className="inline-flex items-center gap-2 rounded-xl bg-studio-art px-5 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-art/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Globe size={15} aria-hidden="true" />
                  )}
                  {submitting ? 'Publishing…' : 'Publish'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinue}
                  className="inline-flex items-center gap-2 rounded-xl bg-studio-art px-5 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-art/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
                >
                  Continue
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Live preview ──────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Product preview">
          <div className="rounded-2xl border border-bg-border bg-bg-card p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-text">
              <Shirt size={15} className="text-studio-art" aria-hidden="true" />
              Preview
            </h2>
            {artworkId ? (
              <ProductMockup
                productType={productType}
                placement={placement}
                color={selectedColor}
                designs={designs}
                artworkUrls={artworkUrls}
                showPrintArea={step === 'preview'}
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-bg-border text-xs text-text-muted">
                Pick an artwork to preview
              </div>
            )}

            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-muted">Product</dt>
                <dd className="font-medium text-text">{def?.label ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Variants</dt>
                <dd className="font-medium tabular-nums text-text">
                  {Math.max(1, sizes.length) * Math.max(1, colorIds.length || 1)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">From</dt>
                <dd className="font-bold tabular-nums text-studio-art">{formatMinor(priceMinor)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
