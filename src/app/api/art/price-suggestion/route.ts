// POST /api/art/price-suggestion — recommend a price for a listing.
//
// Server-side for two reasons. The platform rate card is admin-configurable and
// not shipped to the browser, and the "similar listings" median is drawn from
// published products the client would otherwise have to enumerate.
//
// This route ADVISES. It never writes a price, and the creator's own figure is
// only ever changed by their explicit action in the UI — a pricing tool that
// silently moves a creator's price is a tool that costs them money.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminDb } from '@/lib/firebase/serverApp'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { MATERIAL_IDS, PRODUCT_TYPES, productDefinition, resolveMaterial } from '@/lib/art/catalog'
import { loadMarketplaceEconomics } from '@/lib/art/economics.server'
import { suggestPrice } from '@/lib/art/pricing'
import { PRODUCTS } from '@/lib/firebase/art'
import type { ProductType } from '@/types/art'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 4 * 1024
/** Enough comparables for a stable median without an expensive scan. */
const COMPARABLE_LIMIT = 40

const suggestionSchema = z.object({
  productType: z.enum(PRODUCT_TYPES as [string, ...string[]]),
  materialId: z.enum(MATERIAL_IDS).optional(),
  size: z.string().min(1).max(16).optional(),
  designComplexity: z.enum(['simple', 'standard', 'detailed']).optional(),
})

/** Median, not mean: one ₹50,000 novelty listing must not move the advice. */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { allowed } = await checkRateLimitAsync(`art:price:${uid}`, 120, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many pricing requests. Please try again shortly.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = suggestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const def = productDefinition(parsed.data.productType as ProductType)
  if (!def) return NextResponse.json({ error: 'Unknown product type' }, { status: 400 })

  const material = resolveMaterial(def, parsed.data.materialId)
  // Quote against the product's MID size, which is what most orders are, rather
  // than the cheapest size — otherwise the headline number understates cost.
  const size =
    parsed.data.size && def.sizes.includes(parsed.data.size)
      ? parsed.data.size
      : def.sizes[Math.floor(def.sizes.length / 2)]

  // ── Live comparables ──────────────────────────────────────
  // Same product type, published, priced. Best-effort: a missing index or a
  // cold collection must degrade to "no market signal", never to an error —
  // the heuristic is perfectly usable without comparables.
  let comparableMedianMinor: number | null = null
  let comparableCount = 0
  try {
    const snap = await adminDb()
      .collection(PRODUCTS)
      .where('status', '==', 'published')
      .where('productType', '==', def.type)
      .limit(COMPARABLE_LIMIT)
      .get()
    const prices = snap.docs
      .map((doc) => doc.get('fromPriceMinor') as number)
      .filter((price): price is number => typeof price === 'number' && price > 0)
    comparableCount = prices.length
    // Below three listings the "median" is noise dressed as data.
    if (prices.length >= 3) comparableMedianMinor = median(prices)
  } catch (error) {
    console.error('[art/price-suggestion] comparables lookup failed', error)
  }

  const economics = await loadMarketplaceEconomics()
  const suggestion = suggestPrice({
    def,
    material,
    size,
    designComplexity: parsed.data.designComplexity,
    comparableMedianMinor,
    economics,
  })

  return NextResponse.json({
    ...suggestion,
    size,
    materialId: material,
    // The live rate card, so the publish flow can recompute the split as the
    // creator drags the price slider without a round trip per pixel. The server
    // still re-derives everything on save — this is for display only.
    economics,
    // Surfaced so the UI can say "based on 12 similar listings" or, honestly,
    // say nothing at all rather than implying market data that does not exist.
    comparableCount,
    usedComparables: comparableMedianMinor !== null,
  })
}
