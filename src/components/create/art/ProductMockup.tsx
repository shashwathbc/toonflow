'use client'

import { useMemo } from 'react'
import type { DesignPlacement, PrintPlacement, ProductType } from '@/types/art'
import { productDefinition, type ProductColor } from '@/lib/art/catalog'

/**
 * Product mockups drawn as inline SVG garment silhouettes.
 *
 * Inline SVG rather than photographic mockups on purpose: the CSP forbids
 * external image hosts, the shapes tint to any garment colour without a
 * per-colour asset, and they stay crisp at every size. The print area is drawn
 * from the SAME catalogue rectangle the server validates against, so what the
 * creator positions is what gets printed.
 */
const GARMENT_PATHS: Record<ProductType, { body: string; detail?: string; viewBox: string }> = {
  digital: { body: 'M20 20 H380 V380 H20 Z', viewBox: '0 0 400 400' },
  tshirt: {
    body: 'M140 40 L100 30 L40 70 L70 130 L100 112 V370 H300 V112 L330 130 L360 70 L300 30 L260 40 C250 62 218 72 200 72 C182 72 150 62 140 40 Z',
    detail: 'M140 40 C155 58 180 66 200 66 C220 66 245 58 260 40',
    viewBox: '0 0 400 400',
  },
  'oversized-tshirt': {
    body: 'M132 38 L88 28 L24 76 L60 142 L92 122 V376 H308 V122 L340 142 L376 76 L312 28 L268 38 C256 64 220 76 200 76 C180 76 144 64 132 38 Z',
    detail: 'M132 38 C150 60 178 70 200 70 C222 70 250 60 268 38',
    viewBox: '0 0 400 400',
  },
  hoodie: {
    body: 'M140 52 L96 40 L34 84 L66 148 L98 128 V376 H302 V128 L334 148 L366 84 L304 40 L260 52 C250 76 220 86 200 86 C180 86 150 76 140 52 Z',
    detail: 'M140 52 C150 96 175 112 200 112 C225 112 250 96 260 52 M200 112 V150 M170 300 H230',
    viewBox: '0 0 400 400',
  },
  sweatshirt: {
    body: 'M138 44 L94 32 L32 78 L64 142 L96 122 V372 H304 V122 L336 142 L368 78 L306 32 L262 44 C252 66 220 76 200 76 C180 76 148 66 138 44 Z',
    detail: 'M138 44 C154 62 180 70 200 70 C220 70 246 62 262 44',
    viewBox: '0 0 400 400',
  },
  // Athletic cut: narrower shoulders and a tapered waist versus the classic tee.
  'gym-tshirt': {
    body: 'M144 42 L106 32 L52 72 L80 128 L106 112 V368 C140 374 260 374 294 368 V112 L320 128 L348 72 L294 32 L256 42 C246 62 218 72 200 72 C182 72 154 62 144 42 Z',
    detail: 'M144 42 C158 58 180 66 200 66 C220 66 242 58 256 42',
    viewBox: '0 0 400 400',
  },
  // Sleeveless: the armholes are cut away rather than capped.
  'gym-tank': {
    body: 'M150 40 C150 74 176 88 200 88 C224 88 250 74 250 40 L286 30 C300 44 306 70 306 96 V366 C260 374 140 374 94 366 V96 C94 70 100 44 114 30 Z',
    detail: 'M150 40 C160 62 180 74 200 74 C220 74 240 62 250 40',
    viewBox: '0 0 400 400',
  },
  // Shorts: waistband, two legs, a centre rise. The print sits on the thigh.
  'gym-shorts': {
    body: 'M92 96 H308 V128 C308 128 300 240 296 320 L292 356 H214 L200 210 L186 356 H108 L104 320 C100 240 92 128 92 128 Z',
    detail: 'M92 112 H308 M200 128 V210',
    viewBox: '0 0 400 400',
  },
  cap: {
    body: 'M60 250 C60 150 130 96 200 96 C270 96 340 150 340 250 L340 262 H60 Z M50 262 H350 C368 262 378 276 372 290 C300 312 100 312 28 290 C22 276 32 262 50 262 Z',
    detail: 'M200 96 V250 M130 120 C160 170 160 210 158 254 M270 120 C240 170 240 210 242 254',
    viewBox: '0 0 400 400',
  },
  poster: { body: 'M60 20 H340 V380 H60 Z', viewBox: '0 0 400 400' },
}

export interface ProductMockupProps {
  productType: ProductType
  placement: PrintPlacement
  color?: ProductColor | null
  designs: DesignPlacement[]
  /** artworkId → image URL, so a mockup can carry more than one design. */
  artworkUrls: Record<string, string>
  /** Draw the print-area outline. On by default in the designer, off for listings. */
  showPrintArea?: boolean
  className?: string
}

export default function ProductMockup({
  productType,
  placement,
  color,
  designs,
  artworkUrls,
  showPrintArea = true,
  className,
}: ProductMockupProps) {
  const def = productDefinition(productType)
  const garment = GARMENT_PATHS[productType]
  const area = def?.printAreas[placement]

  const visible = useMemo(
    () => designs.filter((design) => design.placement === placement && artworkUrls[design.artworkId]),
    [designs, placement, artworkUrls],
  )

  if (!def || !area) return null

  const fill = color?.hex ?? (productType === 'poster' || productType === 'digital' ? '#F5F5F5' : '#141414')
  const strokeColor = color?.dark === false ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.22)'

  return (
    <div className={`relative w-full ${className ?? ''}`} style={{ aspectRatio: '1 / 1' }}>
      <svg
        viewBox={garment.viewBox}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${def.label} mockup, ${placement.replace('-', ' ')} view${color ? `, ${color.name}` : ''}`}
      >
        <path d={garment.body} fill={fill} stroke={strokeColor} strokeWidth="2" />
        {garment.detail && (
          <path d={garment.detail} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>

      {/* Print area + designs, positioned in print-area fractions */}
      <div
        className="absolute"
        style={{
          left: `${area.x * 100}%`,
          top: `${area.y * 100}%`,
          width: `${area.width * 100}%`,
          height: `${area.height * 100}%`,
        }}
      >
        {showPrintArea && (
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-sm border border-dashed border-accent/35"
          />
        )}
        {visible.map((design) => (
          <div
            key={`${design.artworkId}-${design.placement}`}
            className="absolute"
            style={{
              left: `${design.x * 100}%`,
              top: `${design.y * 100}%`,
              width: `${design.scale * 100}%`,
              transform: `translate(-50%, -50%) rotate(${design.rotation}deg)`,
            }}
          >
            {/* Plain <img>: sources are Storage URLs already sized for print, and
                next/image can't participate inside a fraction-positioned overlay
                without a fixed intrinsic box. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artworkUrls[design.artworkId]}
              alt=""
              className="block w-full select-none"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
