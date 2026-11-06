'use client'

import { Eye, EyeOff, Layers, Shirt } from 'lucide-react'
import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORY_LABELS,
  productDefinition,
} from '@/lib/art/catalog'
import { cn } from '@/lib/utils/cn'
import type { ArtDocumentSurface, PrintPlacement, ProductType } from '@/types/art'

/**
 * Product controls for the editor stage: what the design is going ON, in what
 * colour, seen from which side.
 *
 * Only products with a real print area appear — `digital` is the flat-canvas
 * mode and is offered by the surface toggle instead, and posters have no
 * garment to rotate.
 */
const STAGE_PRODUCTS = PRODUCT_CATALOG.filter(
  (product) => product.category === 'clothing' || product.category === 'gym' || product.type === 'cap',
)

const PLACEMENT_LABELS: Record<PrintPlacement, string> = {
  front: 'Front',
  back: 'Back',
  'left-sleeve': 'Left sleeve',
  'right-sleeve': 'Right sleeve',
}

export interface ProductBarProps {
  surface: ArtDocumentSurface
  onSurfaceMode: (mode: ArtDocumentSurface['mode']) => void
  onProductType: (productType: ProductType, colorId: string, placement: PrintPlacement) => void
  onColor: (colorId: string) => void
  onPlacement: (placement: PrintPlacement) => void
  onTogglePrintArea: () => void
  className?: string
}

export default function ProductBar({
  surface,
  onSurfaceMode,
  onProductType,
  onColor,
  onPlacement,
  onTogglePrintArea,
  className,
}: ProductBarProps) {
  const def = productDefinition(surface.productType)
  const isProduct = surface.mode === 'product'

  /**
   * Switching product must also settle colour and placement, because the new
   * product may not offer either. Doing it in the same handler means the stage
   * can never render a cap tinted with a colour caps don't come in.
   */
  const pickProduct = (next: ProductType) => {
    const nextDef = productDefinition(next)
    if (!nextDef) return
    const colorId = nextDef.colors.some((color) => color.id === surface.colorId)
      ? surface.colorId
      : (nextDef.colors[0]?.id ?? 'black')
    const placement = nextDef.placements.includes(surface.placement)
      ? surface.placement
      : nextDef.placements[0]
    onProductType(next, colorId, placement)
  }

  return (
    <div className={cn('flex flex-col gap-3 border-b border-bg-border bg-bg-card/70 px-3 py-2.5', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Surface mode */}
        <div
          className="inline-flex shrink-0 rounded-lg border border-bg-border p-0.5"
          role="group"
          aria-label="Design surface"
        >
          <button
            type="button"
            onClick={() => onSurfaceMode('product')}
            aria-pressed={isProduct}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
              isProduct ? 'bg-studio-art/15 text-studio-art' : 'text-text-secondary hover:text-text',
            )}
          >
            <Shirt size={13} aria-hidden="true" />
            Product
          </button>
          <button
            type="button"
            onClick={() => onSurfaceMode('flat')}
            aria-pressed={!isProduct}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
              !isProduct ? 'bg-studio-art/15 text-studio-art' : 'text-text-secondary hover:text-text',
            )}
          >
            <Layers size={13} aria-hidden="true" />
            Flat canvas
          </button>
        </div>

        {isProduct && (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <span className="sr-only" id="stage-product-label">
                Product
              </span>
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-labelledby="stage-product-label"
              >
                {STAGE_PRODUCTS.map((product) => (
                  <button
                    key={product.type}
                    type="button"
                    onClick={() => pickProduct(product.type)}
                    aria-pressed={surface.productType === product.type}
                    title={`${PRODUCT_CATEGORY_LABELS[product.category]} · ${product.label}`}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                      surface.productType === product.type
                        ? 'border-studio-art/45 bg-studio-art/12 text-studio-art'
                        : 'border-bg-border text-text-secondary hover:text-text',
                    )}
                  >
                    {product.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onTogglePrintArea}
              aria-pressed={surface.showPrintArea}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-bg-border px-2.5 py-1.5',
                'text-[11px] font-semibold text-text-secondary transition-colors hover:text-text',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
              )}
            >
              {surface.showPrintArea ? (
                <Eye size={13} aria-hidden="true" />
              ) : (
                <EyeOff size={13} aria-hidden="true" />
              )}
              Print area
            </button>
          </>
        )}
      </div>

      {isProduct && def && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Colour */}
          {def.colors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-text-muted" id="stage-color-label">
                Colour
              </span>
              <div className="flex items-center gap-1.5" role="group" aria-labelledby="stage-color-label">
                {def.colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => onColor(color.id)}
                    aria-pressed={surface.colorId === color.id}
                    aria-label={color.name}
                    title={color.name}
                    className={cn(
                      'h-5 w-5 rounded-full border transition-transform',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card',
                      surface.colorId === color.id
                        ? 'scale-110 border-studio-art ring-1 ring-studio-art'
                        : 'border-bg-border-strong hover:scale-105',
                    )}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* View / placement */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-text-muted" id="stage-view-label">
              View
            </span>
            <div className="flex items-center gap-1.5" role="group" aria-labelledby="stage-view-label">
              {def.placements.map((placement) => (
                <button
                  key={placement}
                  type="button"
                  onClick={() => onPlacement(placement)}
                  aria-pressed={surface.placement === placement}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art',
                    surface.placement === placement
                      ? 'border-studio-art/45 bg-studio-art/12 text-studio-art'
                      : 'border-bg-border text-text-secondary hover:text-text',
                  )}
                >
                  {PLACEMENT_LABELS[placement]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
