'use client'

import { useId, useState } from 'react'
import { Ruler } from 'lucide-react'
import {
  formatMeasurement,
  measurementColumns,
  MEASUREMENT_HELP,
  MEASUREMENT_LABELS,
  POSTER_SHEETS,
  sizeTableFor,
  toUnit,
  type SizeUnit,
} from '@/lib/art/sizing'
import { cn } from '@/lib/utils/cn'
import type { ProductType } from '@/types/art'

/**
 * The measurement chart for a product, in cm or inches.
 *
 * These are GARMENT measurements taken flat, which is stated on the panel — a
 * buyer comparing against their own body would otherwise size up incorrectly.
 * Both unit columns derive from the same centimetre source, so they cannot
 * drift apart.
 */
export interface SizeGuideProps {
  productType: ProductType
  /** Sizes the listing actually offers. Others are dimmed, not hidden, so the
   *  buyer can see where their size sits in the range. */
  availableSizes?: readonly string[]
  className?: string
}

export default function SizeGuide({ productType, availableSizes, className }: SizeGuideProps) {
  const [unit, setUnit] = useState<SizeUnit>('cm')
  const headingId = useId()

  if (productType === 'poster') {
    return (
      <section aria-labelledby={headingId} className={cn('rounded-xl border border-bg-border p-4', className)}>
        <SizeGuideHeader id={headingId} unit={unit} onUnit={setUnit} />
        <table className="mt-3 w-full text-left text-xs">
          <caption className="sr-only">Poster sheet sizes in {unit === 'cm' ? 'centimetres' : 'inches'}</caption>
          <thead>
            <tr className="text-text-secondary">
              <th scope="col" className="pb-2 font-semibold">
                Size
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Width ({unit})
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Height ({unit})
              </th>
            </tr>
          </thead>
          <tbody className="text-text">
            {Object.entries(POSTER_SHEETS).map(([size, sheet]) => (
              <tr key={size} className="border-t border-bg-border">
                <th scope="row" className="py-2 font-bold">
                  {size}
                </th>
                <td className="py-2 text-right tabular-nums">{toUnit(sheet.widthCm, unit)}</td>
                <td className="py-2 text-right tabular-nums">{toUnit(sheet.heightCm, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  const table = sizeTableFor(productType)
  if (!table) return null
  const columns = measurementColumns(table)
  if (columns.length === 0) return null

  return (
    <section aria-labelledby={headingId} className={cn('rounded-xl border border-bg-border p-4', className)}>
      <SizeGuideHeader id={headingId} unit={unit} onUnit={setUnit} />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-xs">
          <caption className="sr-only">
            Garment measurements in {unit === 'cm' ? 'centimetres' : 'inches'}, measured flat
          </caption>
          <thead>
            <tr className="text-text-secondary">
              <th scope="col" className="pb-2 pr-3 font-semibold">
                Size
              </th>
              {columns.map((key) => (
                <th key={key} scope="col" className="pb-2 pl-3 text-right font-semibold">
                  <abbr title={MEASUREMENT_HELP[key]} className="no-underline">
                    {MEASUREMENT_LABELS[key]}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(table).map(([size, row]) => {
              const offered = !availableSizes || availableSizes.includes(size)
              return (
                <tr
                  key={size}
                  className={cn('border-t border-bg-border', offered ? 'text-text' : 'text-text-muted')}
                >
                  <th scope="row" className="py-2 pr-3 font-bold">
                    {size}
                    {!offered && <span className="sr-only"> (not offered on this listing)</span>}
                  </th>
                  {columns.map((key) => (
                    <td key={key} className="py-2 pl-3 text-right tabular-nums">
                      {formatMeasurement(row[key], unit)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
        Measurements are of the garment itself, taken flat, and may vary by up to 2 cm between units.
        To compare, measure a similar item you already own rather than your body.
      </p>
    </section>
  )
}

function SizeGuideHeader({
  id,
  unit,
  onUnit,
}: {
  id: string
  unit: SizeUnit
  onUnit: (unit: SizeUnit) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id={id} className="flex items-center gap-2 text-sm font-bold text-text">
        <Ruler className="h-4 w-4 text-studio-art" aria-hidden="true" />
        Size guide
      </h3>

      <div
        className="inline-flex rounded-lg border border-bg-border p-0.5"
        role="group"
        aria-label="Measurement unit"
      >
        {(['cm', 'in'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onUnit(option)}
            aria-pressed={unit === option}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              unit === option ? 'bg-studio-art/15 text-studio-art' : 'text-text-secondary hover:text-text',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
