'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Loader2, ShoppingBag } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { formatMinor } from '@/lib/art/catalog'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'
import type { Product, ProductVariant } from '@/types/art'

/**
 * Variant picker + checkout entry point.
 *
 * Prices come from the product document and are re-derived server-side at
 * checkout — this panel sends ids and a quantity only, so a tampered payload
 * cannot change what anything costs.
 */
export default function ProductPurchasePanel({
  product,
  fulfillmentConnected,
}: {
  product: Product
  fulfillmentConnected: boolean
}) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  const sizes = useMemo(
    () => Array.from(new Set(product.variants.map((variant) => variant.size))),
    [product.variants],
  )
  const colors = useMemo(
    () =>
      Array.from(
        new Map(product.variants.map((variant) => [variant.colorId, variant.colorName])).entries(),
      ),
    [product.variants],
  )

  const [size, setSize] = useState(sizes[0] ?? '')
  const [colorId, setColorId] = useState(colors[0]?.[0] ?? '')
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const variant: ProductVariant | undefined = product.variants.find(
    (item) => item.size === size && item.colorId === colorId,
  )

  const isDigital = product.productType === 'digital'
  const blocked = !isDigital && !fulfillmentConnected

  const checkout = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/product/${product.id}`)
      return
    }
    if (!variant) {
      toast.error('Pick a size and colour first')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/art/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: product.id, variantId: variant.id, quantity }],
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error ?? 'Could not start checkout', {
          duration: data.code === 'fulfillment_not_configured' ? 8000 : 5000,
        })
        return
      }
      track('purchase_completed', { orderId: data.orderId, productId: product.id })
      // The order exists but no money has moved — say exactly that rather than
      // showing a success screen for a payment that hasn't happened.
      toast.success(
        `Order ${String(data.orderId).slice(0, 8)} reserved. Payment for marketplace orders isn't live yet — you'll be emailed when it opens.`,
        { duration: 9000 },
      )
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-2xl font-black tabular-nums text-text">
        {formatMinor(variant?.priceMinor ?? product.fromPriceMinor)}
      </p>

      {colors.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-secondary">Colour</legend>
          <div className="flex flex-wrap gap-1.5">
            {colors.map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => setColorId(id)}
                aria-pressed={colorId === id}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                  colorId === id
                    ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                    : 'border-bg-border text-text-secondary hover:text-text',
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {sizes.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-secondary">Size</legend>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSize(option)}
                aria-pressed={size === option}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                  size === option
                    ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                    : 'border-bg-border text-text-secondary hover:text-text',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="product-quantity" className="text-xs font-medium text-text-secondary">
          Quantity
        </label>
        <input
          id="product-quantity"
          type="number"
          min={1}
          max={10}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
          className="input-base w-20 text-sm"
        />
      </div>

      {/* Availability is stated plainly, with an icon and words — never colour
          alone, and never an optimistic "In stock" we can't back up. */}
      {blocked ? (
        <div className="rounded-xl border border-warning/25 bg-warning/[0.07] p-3.5" role="status">
          <p className="text-sm font-semibold text-text">Not orderable yet</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Printing and delivery for physical merch are still being connected, so this design can&apos;t
            be shipped today. It stays listed and becomes orderable the moment fulfilment goes live.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void checkout()}
          disabled={submitting || !variant}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-studio-art px-5 py-3 text-sm font-bold text-bg transition-colors hover:bg-studio-art/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ShoppingBag size={16} aria-hidden="true" />
          )}
          {submitting ? 'Starting checkout…' : isAuthenticated ? 'Buy now' : 'Sign in to buy'}
        </button>
      )}

      {variant?.availability === 'unknown' && !blocked && (
        <p className="text-[11px] text-text-muted">
          Availability is confirmed with the print partner at checkout.
        </p>
      )}
    </div>
  )
}
