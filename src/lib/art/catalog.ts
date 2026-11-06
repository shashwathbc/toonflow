// The merchandise catalogue: what can be printed, on what fabric, where the
// design may sit, and what a variant costs to MAKE. Shared by the product
// designer, the publish flow, the marketplace and the server-side listing
// validator, so a product the UI can build is always a product the API accepts.
//
// Prices are in MINOR UNITS (paise). Money never touches a float.
//
// ── The two numbers that are NOT the same thing ──────────────
// `productionCostMinor` is what it costs the platform to print and deliver one
// unit. `suggestedRetailMinor` is what we recommend the creator charge. Earlier
// revisions of this file had a single `basePriceMinor` doing both jobs, which
// made every physical sale a loss (the creator's percentage was taken off the
// gross with production never subtracted). Retail price, production cost and
// creator earnings are now three distinct quantities — see lib/art/pricing.
import type { PrintPlacement, ProductType } from '@/types/art'

export interface ProductColor {
  id: string
  name: string
  /** Garment colour, used to tint the mockup. */
  hex: string
  /** True when the garment is dark — the mockup switches its shadow treatment. */
  dark: boolean
}

/**
 * The printable rectangle on the mockup, as fractions (0–1) of the mockup box.
 * The designer clamps artwork to this, and the server re-clamps on save.
 */
export interface PrintArea {
  x: number
  y: number
  width: number
  height: number
}

// ── Fabrics ─────────────────────────────────────────────────
// A material changes what the item costs to produce, so it is priced here and
// nowhere else. The publish flow shows the delta; the server re-derives it.

export const MATERIAL_IDS = [
  'cotton',
  'organic-cotton',
  'cotton-blend',
  'polyester',
  'dry-fit',
  'premium',
] as const
export type MaterialId = (typeof MATERIAL_IDS)[number]

export interface ProductMaterial {
  id: MaterialId
  name: string
  /** One line the creator reads while choosing — no marketing filler. */
  description: string
  /** Fabric weight, where the concept applies (null for accessories). */
  gsm: number | null
  /** Added to the product's production cost, in paise. May be negative. */
  costDeltaMinor: number
}

export const MATERIALS: Record<MaterialId, ProductMaterial> = {
  cotton: {
    id: 'cotton',
    name: 'Cotton',
    description: 'Combed ring-spun cotton. Soft, breathable, prints sharply.',
    gsm: 180,
    costDeltaMinor: 0,
  },
  'organic-cotton': {
    id: 'organic-cotton',
    name: 'Organic Cotton',
    description: 'GOTS-style organic cotton. Heavier hand-feel, lower impact.',
    gsm: 220,
    costDeltaMinor: 8000,
  },
  'cotton-blend': {
    id: 'cotton-blend',
    name: 'Cotton Blend',
    description: '60/40 cotton–poly. Holds shape, resists shrinking.',
    gsm: 190,
    costDeltaMinor: -3000,
  },
  polyester: {
    id: 'polyester',
    name: 'Polyester',
    description: 'Full-sublimation polyester. Best for edge-to-edge colour.',
    gsm: 160,
    costDeltaMinor: -2000,
  },
  'dry-fit': {
    id: 'dry-fit',
    name: 'Dry Fit',
    description: 'Moisture-wicking performance knit built for training.',
    gsm: 150,
    costDeltaMinor: 6000,
  },
  premium: {
    id: 'premium',
    name: 'Premium Heavyweight',
    description: 'Heavyweight boxy knit with a structured drape.',
    gsm: 260,
    costDeltaMinor: 15000,
  },
}

export interface ProductDefinition {
  type: ProductType
  label: string
  /** Short marketing line shown on the product picker. */
  blurb: string
  category: 'digital' | 'clothing' | 'gym' | 'accessory'
  sizes: readonly string[]
  colors: readonly ProductColor[]
  materials: readonly MaterialId[]
  defaultMaterial: MaterialId
  placements: readonly PrintPlacement[]
  printAreas: Record<PrintPlacement, PrintArea>
  /**
   * What one unit costs the platform to produce and deliver, in paise, on the
   * DEFAULT material. This is a cost, never a price.
   */
  productionCostMinor: number
  /** What we recommend the creator charges, in paise. Always > production. */
  suggestedRetailMinor: number
  /** Per-size production surcharge in paise (XXL uses more fabric). */
  sizeSurchargeMinor: Record<string, number>
  /** Minimum artwork resolution accepted for a crisp print. */
  minArtworkPx: { width: number; height: number }
}

const APPAREL_COLORS: readonly ProductColor[] = [
  { id: 'black', name: 'Black', hex: '#141414', dark: true },
  { id: 'white', name: 'White', hex: '#F5F5F5', dark: false },
  { id: 'navy', name: 'Navy', hex: '#1B2540', dark: true },
  { id: 'sand', name: 'Sand', hex: '#D9CBB4', dark: false },
  { id: 'forest', name: 'Forest', hex: '#22392C', dark: true },
  { id: 'maroon', name: 'Maroon', hex: '#4A1D24', dark: true },
]

/** Performance wear ships in a tighter, sportier palette. */
const GYM_COLORS: readonly ProductColor[] = [
  { id: 'black', name: 'Black', hex: '#141414', dark: true },
  { id: 'charcoal', name: 'Charcoal', hex: '#2E3134', dark: true },
  { id: 'white', name: 'White', hex: '#F5F5F5', dark: false },
  { id: 'navy', name: 'Navy', hex: '#1B2540', dark: true },
  { id: 'volt', name: 'Volt', hex: '#C7F04A', dark: false },
]

const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
const HOODIE_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const
const GYM_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
const ONE_SIZE = ['One Size'] as const
const POSTER_SIZES = ['A3', 'A2', 'A1'] as const

/** Front/back torso print box shared by every top. */
const TORSO_AREA: PrintArea = { x: 0.3, y: 0.24, width: 0.4, height: 0.44 }
const SLEEVE_AREA: PrintArea = { x: 0.06, y: 0.3, width: 0.14, height: 0.16 }
const CAP_AREA: PrintArea = { x: 0.34, y: 0.42, width: 0.32, height: 0.2 }
const POSTER_AREA: PrintArea = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }
const DIGITAL_AREA: PrintArea = { x: 0, y: 0, width: 1, height: 1 }
/** Shorts print on the thigh panel, not the torso. */
const THIGH_AREA: PrintArea = { x: 0.12, y: 0.5, width: 0.2, height: 0.22 }

const NO_SURCHARGE: Record<string, number> = {}
const APPAREL_SURCHARGE: Record<string, number> = { XXL: 6000 }

const COTTON_MATERIALS: readonly MaterialId[] = [
  'cotton',
  'organic-cotton',
  'cotton-blend',
  'premium',
]
const GYM_MATERIALS: readonly MaterialId[] = ['dry-fit', 'polyester', 'cotton-blend']

export const PRODUCT_CATALOG: readonly ProductDefinition[] = [
  {
    type: 'digital',
    label: 'Digital Artwork',
    blurb: 'Sell the artwork itself — no printing, no shipping.',
    category: 'digital',
    sizes: ONE_SIZE,
    colors: [],
    materials: [],
    defaultMaterial: 'cotton',
    placements: ['front'],
    printAreas: {
      front: DIGITAL_AREA,
      back: DIGITAL_AREA,
      'left-sleeve': DIGITAL_AREA,
      'right-sleeve': DIGITAL_AREA,
    },
    // A download has no unit cost. The platform fee is the only deduction.
    productionCostMinor: 0,
    suggestedRetailMinor: 19900,
    sizeSurchargeMinor: NO_SURCHARGE,
    minArtworkPx: { width: 1200, height: 1200 },
  },
  {
    type: 'tshirt',
    label: 'T-Shirt',
    blurb: 'Classic fit cotton tee.',
    category: 'clothing',
    sizes: TEE_SIZES,
    colors: APPAREL_COLORS,
    materials: COTTON_MATERIALS,
    defaultMaterial: 'cotton',
    placements: ['front', 'back', 'left-sleeve', 'right-sleeve'],
    printAreas: {
      front: TORSO_AREA,
      back: TORSO_AREA,
      'left-sleeve': SLEEVE_AREA,
      'right-sleeve': { ...SLEEVE_AREA, x: 0.8 },
    },
    productionCostMinor: 39900,
    suggestedRetailMinor: 79900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 2000, height: 2000 },
  },
  {
    type: 'oversized-tshirt',
    label: 'Oversized T-Shirt',
    blurb: 'Drop-shoulder relaxed fit — the streetwear cut.',
    category: 'clothing',
    sizes: TEE_SIZES,
    colors: APPAREL_COLORS,
    materials: COTTON_MATERIALS,
    defaultMaterial: 'premium',
    placements: ['front', 'back', 'left-sleeve', 'right-sleeve'],
    printAreas: {
      front: { x: 0.26, y: 0.22, width: 0.48, height: 0.48 },
      back: { x: 0.26, y: 0.2, width: 0.48, height: 0.52 },
      'left-sleeve': SLEEVE_AREA,
      'right-sleeve': { ...SLEEVE_AREA, x: 0.8 },
    },
    productionCostMinor: 49900,
    suggestedRetailMinor: 99900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 2400, height: 2400 },
  },
  {
    type: 'hoodie',
    label: 'Hoodie',
    blurb: 'Heavyweight fleece with a lined hood.',
    category: 'clothing',
    sizes: HOODIE_SIZES,
    colors: APPAREL_COLORS,
    materials: COTTON_MATERIALS,
    defaultMaterial: 'premium',
    placements: ['front', 'back'],
    printAreas: {
      front: { x: 0.32, y: 0.28, width: 0.36, height: 0.3 },
      back: { x: 0.28, y: 0.22, width: 0.44, height: 0.48 },
      'left-sleeve': SLEEVE_AREA,
      'right-sleeve': { ...SLEEVE_AREA, x: 0.8 },
    },
    productionCostMinor: 89900,
    suggestedRetailMinor: 179900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 2400, height: 2400 },
  },
  {
    type: 'sweatshirt',
    label: 'Sweatshirt',
    blurb: 'Crew-neck fleece, no hood.',
    category: 'clothing',
    sizes: HOODIE_SIZES,
    colors: APPAREL_COLORS,
    materials: COTTON_MATERIALS,
    defaultMaterial: 'cotton-blend',
    placements: ['front', 'back'],
    printAreas: {
      front: TORSO_AREA,
      back: TORSO_AREA,
      'left-sleeve': SLEEVE_AREA,
      'right-sleeve': { ...SLEEVE_AREA, x: 0.8 },
    },
    productionCostMinor: 74900,
    suggestedRetailMinor: 149900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 2400, height: 2400 },
  },
  {
    type: 'gym-tshirt',
    label: 'Gym T-Shirt',
    blurb: 'Moisture-wicking training tee with an athletic cut.',
    category: 'gym',
    sizes: GYM_SIZES,
    colors: GYM_COLORS,
    materials: GYM_MATERIALS,
    defaultMaterial: 'dry-fit',
    placements: ['front', 'back', 'left-sleeve', 'right-sleeve'],
    printAreas: {
      front: { x: 0.32, y: 0.26, width: 0.36, height: 0.38 },
      back: { x: 0.3, y: 0.24, width: 0.4, height: 0.44 },
      'left-sleeve': SLEEVE_AREA,
      'right-sleeve': { ...SLEEVE_AREA, x: 0.8 },
    },
    productionCostMinor: 44900,
    suggestedRetailMinor: 89900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 2000, height: 2000 },
  },
  {
    type: 'gym-tank',
    label: 'Gym Tank',
    blurb: 'Cut-away sleeveless vest for heavy training days.',
    category: 'gym',
    sizes: GYM_SIZES,
    colors: GYM_COLORS,
    materials: GYM_MATERIALS,
    defaultMaterial: 'dry-fit',
    // No sleeves to print on — the placement list is what the API enforces.
    placements: ['front', 'back'],
    printAreas: {
      front: { x: 0.36, y: 0.28, width: 0.28, height: 0.34 },
      back: { x: 0.36, y: 0.26, width: 0.28, height: 0.38 },
      'left-sleeve': THIGH_AREA,
      'right-sleeve': THIGH_AREA,
    },
    productionCostMinor: 39900,
    suggestedRetailMinor: 79900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 1800, height: 1800 },
  },
  {
    type: 'gym-shorts',
    label: 'Gym Shorts',
    blurb: 'Four-way stretch training shorts with a thigh print panel.',
    category: 'gym',
    sizes: GYM_SIZES,
    colors: GYM_COLORS,
    materials: GYM_MATERIALS,
    defaultMaterial: 'polyester',
    placements: ['front', 'back'],
    printAreas: {
      front: THIGH_AREA,
      back: { ...THIGH_AREA, x: 0.68 },
      'left-sleeve': THIGH_AREA,
      'right-sleeve': THIGH_AREA,
    },
    productionCostMinor: 49900,
    suggestedRetailMinor: 99900,
    sizeSurchargeMinor: APPAREL_SURCHARGE,
    minArtworkPx: { width: 1400, height: 1400 },
  },
  {
    type: 'cap',
    label: 'Cap',
    blurb: 'Six-panel embroidered cap.',
    category: 'accessory',
    sizes: ONE_SIZE,
    colors: APPAREL_COLORS.slice(0, 4),
    materials: ['cotton', 'cotton-blend'],
    defaultMaterial: 'cotton',
    placements: ['front', 'back'],
    printAreas: {
      front: CAP_AREA,
      back: { ...CAP_AREA, width: 0.2, x: 0.4 },
      'left-sleeve': CAP_AREA,
      'right-sleeve': CAP_AREA,
    },
    productionCostMinor: 34900,
    suggestedRetailMinor: 69900,
    sizeSurchargeMinor: NO_SURCHARGE,
    minArtworkPx: { width: 1200, height: 800 },
  },
  {
    type: 'poster',
    label: 'Poster',
    blurb: 'Matte fine-art print.',
    category: 'accessory',
    sizes: POSTER_SIZES,
    colors: [],
    materials: [],
    defaultMaterial: 'cotton',
    placements: ['front'],
    printAreas: {
      front: POSTER_AREA,
      back: POSTER_AREA,
      'left-sleeve': POSTER_AREA,
      'right-sleeve': POSTER_AREA,
    },
    productionCostMinor: 24900,
    suggestedRetailMinor: 49900,
    sizeSurchargeMinor: { A2: 8000, A1: 20000 },
    minArtworkPx: { width: 2480, height: 3508 },
  },
]

export const PRODUCT_TYPES = PRODUCT_CATALOG.map((p) => p.type)

/** Picker groupings. `gym` is surfaced as its own lane, per the studio brief. */
export const PRODUCT_CATEGORY_LABELS: Record<ProductDefinition['category'], string> = {
  digital: 'Digital',
  clothing: 'Apparel',
  gym: 'Gym & Athleisure',
  accessory: 'Accessories',
}

export function productDefinition(type: ProductType): ProductDefinition | null {
  return PRODUCT_CATALOG.find((p) => p.type === type) ?? null
}

export function materialsFor(def: ProductDefinition): ProductMaterial[] {
  return def.materials.map((id) => MATERIALS[id])
}

/** Materials a product supports; falls back to its default for unsupported ids. */
export function resolveMaterial(def: ProductDefinition, id: string | null | undefined): MaterialId {
  return def.materials.includes(id as MaterialId) ? (id as MaterialId) : def.defaultMaterial
}

/**
 * What ONE unit costs to make: base production + size surcharge + fabric delta.
 * Pure integer arithmetic — this figure is subtracted from real money.
 */
export function productionCostMinor(
  def: ProductDefinition,
  size: string,
  material: MaterialId = def.defaultMaterial,
): number {
  const fabric = def.materials.includes(material) ? MATERIALS[material].costDeltaMinor : 0
  return Math.max(0, def.productionCostMinor + (def.sizeSurchargeMinor[size] ?? 0) + fabric)
}

/** ₹ display string from paise. */
export function formatMinor(minor: number, currency: 'INR' = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100)
}

/** Creator-set price bounds, in paise. Guards both nonsense and fraud. */
export const PRICE_BOUNDS = { minMinor: 4900, maxMinor: 5_000_000 } as const
