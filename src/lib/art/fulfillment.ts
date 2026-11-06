// Print-on-demand fulfilment boundary. SERVER ONLY.
//
// ═══════════════ INTEGRATION BOUNDARY ═══════════════
// No fulfilment provider ships with this repository. Orders for PHYSICAL
// products therefore cannot be produced or shipped yet, and the app says so
// plainly: physical variants are listed with `availability: 'unknown'`, checkout
// for them is refused with code `fulfillment_not_configured`, and no order is
// ever recorded as `submitted` without a provider actually accepting it.
//
// Digital artwork does NOT go through here — it needs no fulfilment.
//
// To connect one: implement `FulfillmentProvider`, register it below, and set
// FULFILLMENT_PROVIDER plus that vendor's credentials as SERVER-SIDE env vars.
// Never expose them to the client; the browser must never talk to the vendor.
// ════════════════════════════════════════════════════
import type { Order, ProductType } from '@/types/art'

export interface FulfillmentLine {
  productId: string
  variantId: string
  productType: ProductType
  quantity: number
  /** Print-ready asset, resolved server-side to a signed, short-lived URL. */
  printFileUrl: string
}

export interface ShippingAddress {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
}

export type FulfillmentResult =
  | { ok: true; providerOrderId: string; estimatedShipDays: number }
  | { ok: false; code: 'not_configured' | 'rejected' | 'unavailable'; message: string }

export interface FulfillmentProvider {
  readonly id: string
  readonly label: string
  isConfigured(): boolean
  /** Ask the vendor whether a variant can actually be produced right now. */
  checkAvailability(productType: ProductType, variantId: string): Promise<boolean>
  submitOrder(args: {
    orderId: string
    lines: FulfillmentLine[]
    address: ShippingAddress
  }): Promise<FulfillmentResult>
  /** Tracking lookup for the buyer's order page. */
  getTracking(providerOrderId: string): Promise<{ status: Order['fulfillmentStatus']; trackingUrl: string | null }>
}

/** Registered implementations. Empty by design — see the boundary note above. */
const PROVIDERS: Record<string, FulfillmentProvider> = {}

export function activeFulfillmentProvider(): FulfillmentProvider | null {
  const requested = process.env.FULFILLMENT_PROVIDER?.trim()
  if (requested) {
    const provider = PROVIDERS[requested]
    if (!provider?.isConfigured()) {
      console.error(`[art/fulfillment] FULFILLMENT_PROVIDER="${requested}" is not registered or not configured`)
      return null
    }
    return provider
  }
  return Object.values(PROVIDERS).find((p) => p.isConfigured()) ?? null
}

export function isFulfillmentConfigured(): boolean {
  return activeFulfillmentProvider() !== null
}

/** Digital products need no fulfilment, so they are always orderable. */
export function requiresFulfillment(productType: ProductType): boolean {
  return productType !== 'digital'
}
