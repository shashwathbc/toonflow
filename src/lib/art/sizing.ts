// Garment measurements for the size guide.
//
// These are GARMENT measurements (the flat dimensions of the item), not body
// measurements — the distinction matters because a buyer measures a shirt they
// already own and compares. Every table says which it is.
//
// Stored in centimetres, converted for display. One canonical unit means the
// inch column can never drift out of sync with the cm column.
import type { ProductType } from '@/types/art'

/** Every dimension we publish. A product declares only the ones that apply. */
export const MEASUREMENT_KEYS = [
  'chest',
  'shoulder',
  'length',
  'sleeve',
  'waist',
  'hip',
  'inseam',
  'head',
] as const
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number]

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  chest: 'Chest',
  shoulder: 'Shoulder',
  length: 'Length',
  sleeve: 'Sleeve',
  waist: 'Waist',
  hip: 'Hip',
  inseam: 'Inseam',
  head: 'Head',
}

/** How each dimension is taken — shown as help text so numbers are checkable. */
export const MEASUREMENT_HELP: Record<MeasurementKey, string> = {
  chest: 'Measured flat, armpit to armpit, then doubled.',
  shoulder: 'Seam to seam across the back.',
  length: 'High point of the shoulder straight down to the hem.',
  sleeve: 'Shoulder seam to sleeve opening.',
  waist: 'Flat across the waistband, then doubled. Unstretched.',
  hip: 'Flat across the widest point below the waistband, then doubled.',
  inseam: 'Crotch seam to the bottom of the leg opening.',
  head: 'Internal circumference of the closed band.',
}

export type SizeRow = Partial<Record<MeasurementKey, number>>

/** Product type → size code → measurements in CM. */
export type SizeTable = Record<string, SizeRow>

const TEE_TABLE: SizeTable = {
  XS: { chest: 91, shoulder: 40, length: 66, sleeve: 18 },
  S: { chest: 96, shoulder: 42, length: 69, sleeve: 19 },
  M: { chest: 101, shoulder: 44, length: 71, sleeve: 20 },
  L: { chest: 106, shoulder: 46, length: 74, sleeve: 21 },
  XL: { chest: 112, shoulder: 48, length: 76, sleeve: 22 },
  XXL: { chest: 117, shoulder: 50, length: 79, sleeve: 23 },
}

const OVERSIZED_TABLE: SizeTable = {
  XS: { chest: 102, shoulder: 47, length: 68, sleeve: 20 },
  S: { chest: 107, shoulder: 49, length: 70, sleeve: 21 },
  M: { chest: 112, shoulder: 51, length: 72, sleeve: 22 },
  L: { chest: 117, shoulder: 53, length: 74, sleeve: 23 },
  XL: { chest: 122, shoulder: 55, length: 76, sleeve: 24 },
  XXL: { chest: 127, shoulder: 57, length: 78, sleeve: 25 },
}

const HOODIE_TABLE: SizeTable = {
  S: { chest: 108, shoulder: 48, length: 68, sleeve: 60 },
  M: { chest: 113, shoulder: 50, length: 70, sleeve: 61 },
  L: { chest: 118, shoulder: 52, length: 72, sleeve: 63 },
  XL: { chest: 123, shoulder: 54, length: 74, sleeve: 64 },
  XXL: { chest: 128, shoulder: 56, length: 76, sleeve: 65 },
}

const SWEATSHIRT_TABLE: SizeTable = {
  S: { chest: 106, shoulder: 47, length: 67, sleeve: 59 },
  M: { chest: 111, shoulder: 49, length: 69, sleeve: 60 },
  L: { chest: 116, shoulder: 51, length: 71, sleeve: 62 },
  XL: { chest: 121, shoulder: 53, length: 73, sleeve: 63 },
  XXL: { chest: 126, shoulder: 55, length: 75, sleeve: 64 },
}

/** Athletic cut: trimmer through the body than the classic tee. */
const GYM_TEE_TABLE: SizeTable = {
  XS: { chest: 88, shoulder: 39, length: 65, sleeve: 17 },
  S: { chest: 93, shoulder: 41, length: 67, sleeve: 18 },
  M: { chest: 98, shoulder: 43, length: 70, sleeve: 19 },
  L: { chest: 103, shoulder: 45, length: 72, sleeve: 20 },
  XL: { chest: 108, shoulder: 47, length: 74, sleeve: 21 },
  XXL: { chest: 113, shoulder: 49, length: 77, sleeve: 22 },
}

const GYM_TANK_TABLE: SizeTable = {
  XS: { chest: 86, shoulder: 31, length: 64 },
  S: { chest: 91, shoulder: 33, length: 66 },
  M: { chest: 96, shoulder: 35, length: 69 },
  L: { chest: 101, shoulder: 37, length: 71 },
  XL: { chest: 106, shoulder: 39, length: 73 },
  XXL: { chest: 111, shoulder: 41, length: 76 },
}

const GYM_SHORTS_TABLE: SizeTable = {
  XS: { waist: 68, hip: 92, length: 42, inseam: 18 },
  S: { waist: 73, hip: 97, length: 44, inseam: 19 },
  M: { waist: 78, hip: 102, length: 45, inseam: 19 },
  L: { waist: 83, hip: 107, length: 47, inseam: 20 },
  XL: { waist: 88, hip: 112, length: 48, inseam: 21 },
  XXL: { waist: 93, hip: 117, length: 50, inseam: 21 },
}

const CAP_TABLE: SizeTable = {
  'One Size': { head: 58 },
}

/**
 * Posters are sold by SHEET size, which is a width × height pair rather than a
 * set of body measurements. Kept in its own shape instead of forced through
 * SizeRow — a poster has no chest.
 */
export interface SheetSize {
  widthCm: number
  heightCm: number
}

export const POSTER_SHEETS: Record<string, SheetSize> = {
  A3: { widthCm: 29.7, heightCm: 42 },
  A2: { widthCm: 42, heightCm: 59.4 },
  A1: { widthCm: 59.4, heightCm: 84.1 },
}

const TABLES: Partial<Record<ProductType, SizeTable>> = {
  tshirt: TEE_TABLE,
  'oversized-tshirt': OVERSIZED_TABLE,
  hoodie: HOODIE_TABLE,
  sweatshirt: SWEATSHIRT_TABLE,
  'gym-tshirt': GYM_TEE_TABLE,
  'gym-tank': GYM_TANK_TABLE,
  'gym-shorts': GYM_SHORTS_TABLE,
  cap: CAP_TABLE,
}

export function sizeTableFor(productType: ProductType): SizeTable | null {
  return TABLES[productType] ?? null
}

/**
 * The measurement columns a product's table actually populates, in the canonical
 * order. Derived from the data rather than declared twice, so a table that gains
 * a dimension gains its column automatically.
 */
export function measurementColumns(table: SizeTable): MeasurementKey[] {
  const present = new Set<MeasurementKey>()
  for (const row of Object.values(table)) {
    for (const key of MEASUREMENT_KEYS) {
      if (typeof row[key] === 'number') present.add(key)
    }
  }
  return MEASUREMENT_KEYS.filter((key) => present.has(key))
}

export type SizeUnit = 'cm' | 'in'

/** 1 in = 2.54 cm exactly. Displayed to one decimal — half-inch precision is
 *  the most a tape measure honestly supports. */
export function toUnit(cm: number, unit: SizeUnit): number {
  return unit === 'cm' ? Math.round(cm * 10) / 10 : Math.round((cm / 2.54) * 10) / 10
}

export function formatMeasurement(cm: number | undefined, unit: SizeUnit): string {
  if (typeof cm !== 'number') return '—'
  return `${toUnit(cm, unit)}`
}

/** Posters carry sheet dimensions instead of body measurements. */
export function isSheetSized(productType: ProductType): boolean {
  return productType === 'poster'
}
