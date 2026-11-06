import type { FirestoreTimestamp } from './user'

// ── Art Studio domain types ─────────────────────────────────
//
// An ARTWORK is the creative asset (uploaded, drawn, or AI-generated). A PRODUCT
// is a listing built from an artwork — either the digital artwork itself or a
// physical item (tee, hoodie, cap, poster) carrying the design. ORDERS are
// written server-side only; nothing here is client-writable once money is
// involved.

export type ArtworkStatus = 'draft' | 'published' | 'archived' | 'removed'
export type ArtworkVisibility = 'private' | 'unlisted' | 'public'

/** How the artwork came to exist — surfaced on listings for AI disclosure. */
export type ArtworkSource = 'upload' | 'drawn' | 'ai'

export const ART_CATEGORIES = [
  'illustration',
  'character-design',
  'concept-art',
  'manga-panel',
  'chibi',
  'pixel-art',
  'poster',
  'pattern',
  'typography',
  'photography',
] as const
export type ArtCategory = (typeof ART_CATEGORIES)[number]

export interface Artwork {
  id: string
  ownerId: string
  ownerName: string
  ownerPhotoURL: string | null
  title: string
  description: string
  category: ArtCategory
  tags: string[]
  source: ArtworkSource
  /**
   * Public Storage download URL. Only ever set for `published` artwork —
   * private drafts live under a private prefix and are read through a
   * short-lived signed URL instead (see `storageKey`).
   */
  imageURL: string | null
  /** Private object path for drafts / originals. */
  storageKey: string | null
  thumbnailURL: string | null
  width: number
  height: number
  /** Bytes of the stored original — used for quota accounting. */
  sizeBytes: number
  mimeType: string
  status: ArtworkStatus
  visibility: ArtworkVisibility
  /** Creator asserted they own/are licensed for this work. Required to publish. */
  rightsConfirmed: boolean
  /** Server-managed counters — clients may never write these. */
  viewCount: number
  likeCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

// ── Products & merchandise ──────────────────────────────────

export type ProductType =
  | 'digital'
  | 'tshirt'
  | 'oversized-tshirt'
  | 'hoodie'
  | 'sweatshirt'
  | 'gym-tshirt'
  | 'gym-tank'
  | 'gym-shorts'
  | 'cap'
  | 'poster'

export type ProductStatus = 'draft' | 'published' | 'unavailable' | 'removed'

/** Where a design sits on a garment. Sleeve is only offered where supported. */
export type PrintPlacement = 'front' | 'back' | 'left-sleeve' | 'right-sleeve'

/** Placement of one artwork inside a product's print area, in print-area fractions. */
export interface DesignPlacement {
  placement: PrintPlacement
  artworkId: string
  /** Centre of the design, as a fraction (0–1) of the print area. */
  x: number
  y: number
  /** Width as a fraction (0–1) of the print area width. */
  scale: number
  rotation: number
}

export interface ProductVariant {
  /** Stable id, `${size}-${colorId}` for apparel or `${size}` for posters. */
  id: string
  size: string
  colorId: string
  colorName: string
  /** Price in the smallest currency unit (paise) to avoid float drift. */
  priceMinor: number
  /**
   * What this variant costs to produce, in paise, snapshotted at listing time.
   * Stored on the variant rather than recomputed at checkout so a catalogue
   * price change can never retroactively alter a live listing's economics.
   */
  productionCostMinor: number
  /**
   * Fulfilment availability as reported by the provider. `unknown` until a
   * fulfilment integration is connected — never displayed as "in stock".
   */
  availability: 'unknown' | 'available' | 'unavailable'
}

export interface Product {
  id: string
  ownerId: string
  ownerName: string
  ownerPhotoURL: string | null
  /** Primary artwork — the listing thumbnail source. */
  artworkId: string
  title: string
  description: string
  productType: ProductType
  /** Fabric the creator chose. Drives production cost, so it is server-derived. */
  materialId: string
  tags: string[]
  designs: DesignPlacement[]
  variants: ProductVariant[]
  /** Lowest variant price, denormalized for marketplace sort/filter. */
  fromPriceMinor: number
  currency: 'INR'
  previewURL: string | null
  status: ProductStatus
  /** Server-managed counters. */
  viewCount: number
  likeCount: number
  salesCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

// ── Orders ──────────────────────────────────────────────────
//
// The state machine itself — legal transitions, terminal states, and the rule
// deciding when earnings are withdrawable — lives in lib/art/orderLifecycle.
// These are the persisted shapes only.

export type {
  PaymentStatus,
  FulfillmentStatus,
  EarningStatus,
} from '@/lib/art/orderLifecycle'

import type {
  EarningStatus,
  FulfillmentStatus,
  PaymentStatus,
} from '@/lib/art/orderLifecycle'

/** How the buyer paid. Cash and tokens are separate ledgers and never mix. */
export type PaymentMethod = 'money' | 'tokens'

export interface OrderItem {
  productId: string
  variantId: string
  title: string
  productType: ProductType
  quantity: number
  unitPriceMinor: number
  creatorId: string
  /**
   * The full split for this line at time of purchase, per unit. Snapshotted so
   * a later change to platform rates never rewrites a settled order — what the
   * creator was promised is what the creator is paid.
   */
  unitProductionCostMinor: number
  unitPlatformFeeMinor: number
  /** Creator's earnings for the WHOLE line (unit earnings × quantity). */
  creatorEarningsMinor: number
}

export interface Order {
  id: string
  buyerId: string
  items: OrderItem[]
  subtotalMinor: number
  totalMinor: number
  currency: 'INR'
  paymentMethod: PaymentMethod
  /** Token cost when paymentMethod is 'tokens'; 0 otherwise. Never conflated
   *  with the minor-unit cash fields above. */
  tokenCost: number
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  /** Carrier tracking, set by the fulfilment webhook. */
  trackingUrl: string | null
  /** Fulfilment provider id that accepted the order, or null while unconnected. */
  fulfillmentProvider: string | null
  /** Set when the order reaches `delivered` — starts the earnings hold clock. */
  deliveredAt: FirestoreTimestamp | null
  /** Caller-supplied idempotency key, so a retried checkout cannot double-charge. */
  idempotencyKey: string | null
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

/**
 * One creator's earnings from one order line. A separate document rather than a
 * field on the order because it is queried by a different party (the creator,
 * who cannot read the buyer's order) and has its own lifecycle.
 *
 * Written ONLY by the server. This is the ledger a withdrawal is paid from.
 */
export interface CreatorEarning {
  id: string
  creatorId: string
  orderId: string
  productId: string
  variantId: string
  /** Denormalised for the earnings table, so it renders without N lookups. */
  productTitle: string
  quantity: number
  grossMinor: number
  productionCostMinor: number
  platformFeeMinor: number
  /** What the creator actually earns. gross − production − platformFee. */
  netMinor: number
  status: EarningStatus
  /** When this becomes withdrawable. Null until the order is delivered. */
  availableAt: FirestoreTimestamp | null
  /** Set when a withdrawal sweeps this line. */
  withdrawalId: string | null
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

// ── Editor document (Art Studio canvas) ─────────────────────

export type ArtLayerKind = 'image' | 'text' | 'shape' | 'drawing'

export interface ArtLayer {
  id: string
  kind: ArtLayerKind
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  /** image layers — data URL or Storage download URL. */
  src?: string
  /** text layers */
  text?: string
  fontFamily?: string
  fontSize?: number
  fill?: string
  align?: 'left' | 'center' | 'right'
  /** shape layers */
  shape?: 'rect' | 'ellipse' | 'triangle' | 'line'
  stroke?: string
  strokeWidth?: number
  /** drawing layers — flattened brush strokes as a data URL. */
  filter?: ArtFilterId
}

export type ArtFilterId =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'saturate'
  | 'contrast'
  | 'blur'
  | 'anime'

/**
 * The surface the creator is designing ON.
 *
 * `flat` is a plain transparent canvas — the right default for artwork sold as
 * a download. `product` renders the design inside a garment's print area so
 * what the creator draws is framed by what will actually be printed. The choice
 * is persisted with the document, so reopening a design restores the garment
 * rather than dropping the creator back onto a blank rectangle.
 */
export interface ArtDocumentSurface {
  mode: 'flat' | 'product'
  productType: ProductType
  /** Catalogue colour id for the garment tint. */
  colorId: string
  placement: PrintPlacement
  /** Draw the print-area boundary. On by default while designing. */
  showPrintArea: boolean
}

export interface ArtDocument {
  version: 1
  width: number
  height: number
  background: string | null
  layers: ArtLayer[]
  /** Absent on documents created before the product surface existed. */
  surface?: ArtDocumentSurface
}
