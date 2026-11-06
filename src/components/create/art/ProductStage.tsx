'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { productDefinition, type ProductColor } from '@/lib/art/catalog'
import { cn } from '@/lib/utils/cn'
import type { PrintPlacement, ProductType } from '@/types/art'

/**
 * The holographic product stage: a garment floating in the centre of the editor
 * with the creator's design mapped into its print area.
 *
 * ── Why the design is a CHILD, not a picture of one ──────────
 * The design canvas is rendered live inside the print rectangle rather than
 * composited as a flat preview image. That means the same DOM the creator drags
 * layers around in IS the thing sitting on the shirt — there is no preview that
 * can fall out of sync with the canvas, and no round trip to see a change.
 *
 * The print rectangle comes from the SAME catalogue entry the server validates
 * against (`printAreas[placement]`), so what is framed here is what gets
 * printed.
 */
export interface ProductStageProps {
  productType: ProductType
  placement: PrintPlacement
  color: ProductColor | null
  showPrintArea: boolean
  /** The live design surface, scaled by this component to fill the print area. */
  children: ReactNode
  /** Intrinsic design size in px, used to preserve the artwork's aspect ratio. */
  designWidth: number
  designHeight: number
  className?: string
}

/**
 * Garment silhouettes. Inline SVG rather than photographic mockups: the CSP
 * forbids external image hosts, the shapes tint to any colour without a
 * per-colour asset, and they stay crisp at every zoom level.
 *
 * `shade` paths are painted over the body at low opacity to suggest fabric
 * curvature — the cheap version of the folds a real mockup photo would carry.
 */
const GARMENTS: Record<
  ProductType,
  { body: string; detail?: string; shade?: string; viewBox: string }
> = {
  digital: { body: 'M20 20 H380 V380 H20 Z', viewBox: '0 0 400 400' },
  tshirt: {
    body: 'M140 40 L100 30 L40 70 L70 130 L100 112 V370 H300 V112 L330 130 L360 70 L300 30 L260 40 C250 62 218 72 200 72 C182 72 150 62 140 40 Z',
    detail: 'M140 40 C155 58 180 66 200 66 C220 66 245 58 260 40',
    shade: 'M100 112 V370 H150 C138 300 136 190 148 118 Z M300 112 V370 H250 C262 300 264 190 252 118 Z',
    viewBox: '0 0 400 400',
  },
  'oversized-tshirt': {
    body: 'M132 38 L88 28 L24 76 L60 142 L92 122 V376 H308 V122 L340 142 L376 76 L312 28 L268 38 C256 64 220 76 200 76 C180 76 144 64 132 38 Z',
    detail: 'M132 38 C150 60 178 70 200 70 C222 70 250 60 268 38',
    shade: 'M92 122 V376 H146 C132 300 130 196 142 128 Z M308 122 V376 H254 C268 300 270 196 258 128 Z',
    viewBox: '0 0 400 400',
  },
  hoodie: {
    body: 'M140 52 L96 40 L34 84 L66 148 L98 128 V376 H302 V128 L334 148 L366 84 L304 40 L260 52 C250 76 220 86 200 86 C180 86 150 76 140 52 Z',
    detail: 'M140 52 C150 96 175 112 200 112 C225 112 250 96 260 52 M200 112 V150 M170 300 H230',
    shade: 'M98 128 V376 H150 C136 300 134 198 146 134 Z M302 128 V376 H250 C264 300 266 198 254 134 Z',
    viewBox: '0 0 400 400',
  },
  sweatshirt: {
    body: 'M138 44 L94 32 L32 78 L64 142 L96 122 V372 H304 V122 L336 142 L368 78 L306 32 L262 44 C252 66 220 76 200 76 C180 76 148 66 138 44 Z',
    detail: 'M138 44 C154 62 180 70 200 70 C220 70 246 62 262 44',
    shade: 'M96 122 V372 H148 C134 298 132 194 144 128 Z M304 122 V372 H252 C266 298 268 194 256 128 Z',
    viewBox: '0 0 400 400',
  },
  'gym-tshirt': {
    body: 'M144 42 L106 32 L52 72 L80 128 L106 112 V368 C140 374 260 374 294 368 V112 L320 128 L348 72 L294 32 L256 42 C246 62 218 72 200 72 C182 72 154 62 144 42 Z',
    detail: 'M144 42 C158 58 180 66 200 66 C220 66 242 58 256 42',
    shade: 'M106 112 V368 C120 371 136 372 150 373 C140 300 138 190 150 118 Z M294 112 V368 C280 371 264 372 250 373 C260 300 262 190 250 118 Z',
    viewBox: '0 0 400 400',
  },
  'gym-tank': {
    body: 'M150 40 C150 74 176 88 200 88 C224 88 250 74 250 40 L286 30 C300 44 306 70 306 96 V366 C260 374 140 374 94 366 V96 C94 70 100 44 114 30 Z',
    detail: 'M150 40 C160 62 180 74 200 74 C220 74 240 62 250 40',
    shade: 'M94 96 V366 C110 370 126 372 142 373 C132 300 130 190 142 100 Z M306 96 V366 C290 370 274 372 258 373 C268 300 270 190 258 100 Z',
    viewBox: '0 0 400 400',
  },
  'gym-shorts': {
    body: 'M92 96 H308 V128 C308 128 300 240 296 320 L292 356 H214 L200 210 L186 356 H108 L104 320 C100 240 92 128 92 128 Z',
    detail: 'M92 112 H308 M200 128 V210',
    shade: 'M92 128 C92 128 100 240 104 320 L108 356 H140 L128 220 L118 128 Z',
    viewBox: '0 0 400 400',
  },
  cap: {
    body: 'M60 250 C60 150 130 96 200 96 C270 96 340 150 340 250 L340 262 H60 Z M50 262 H350 C368 262 378 276 372 290 C300 312 100 312 28 290 C22 276 32 262 50 262 Z',
    detail: 'M200 96 V250 M130 120 C160 170 160 210 158 254 M270 120 C240 170 240 210 242 254',
    shade: 'M60 250 C60 150 130 96 200 96 V250 Z',
    viewBox: '0 0 400 400',
  },
  poster: { body: 'M60 20 H340 V380 H60 Z', viewBox: '0 0 400 400' },
}

export default function ProductStage({
  productType,
  placement,
  color,
  showPrintArea,
  children,
  designWidth,
  designHeight,
  className,
}: ProductStageProps) {
  const def = productDefinition(productType)
  const garment = GARMENTS[productType]
  const area = def?.printAreas[placement] ?? null

  /**
   * The design is authored at its intrinsic pixel size (2048² by default) but
   * has to be drawn at whatever size the print box currently occupies on
   * screen. Measuring the box and scaling the child means layer coordinates stay
   * in design space — a layer at x:1024 is still at x:1024 whether the editor is
   * on a phone or a 4K monitor.
   */
  const slotRef = useRef<HTMLDivElement>(null)
  const [slotWidth, setSlotWidth] = useState(0)

  useEffect(() => {
    const element = slotRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSlotWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const scale = slotWidth > 0 ? slotWidth / designWidth : 0

  /**
   * Fit the design's aspect ratio inside the print rectangle without cropping.
   * The print area is expressed in fractions of a SQUARE mockup box, so its real
   * aspect ratio is width/height of those fractions.
   */
  const fitted = useMemo(() => {
    if (!area) return null
    const areaAspect = area.width / area.height
    const designAspect = designWidth / designHeight
    // Wider than the box → pin to full width; taller → pin to full height.
    return designAspect >= areaAspect
      ? { width: 100, height: (areaAspect / designAspect) * 100 }
      : { width: (designAspect / areaAspect) * 100, height: 100 }
  }, [area, designWidth, designHeight])

  if (!def || !area || !fitted) return null

  const fill = color?.hex ?? '#141414'
  const isDark = color?.dark ?? true
  const stroke = isDark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.25)'

  return (
    <div className={cn('relative aspect-square w-full max-w-[min(78vh,42rem)]', className)}>
      {/* Holographic ground: a soft radial pool the garment appears to float in. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[2rem]"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(0,200,150,.10) 0%, rgba(0,200,150,.04) 38%, transparent 68%)',
        }}
      />
      {/* Contact shadow, so the garment reads as hovering rather than pasted on. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[18%] bottom-[6%] h-[6%] rounded-[50%] blur-xl"
        style={{ background: 'rgba(0,0,0,.55)' }}
      />

      <svg
        viewBox={garment.viewBox}
        className="absolute inset-0 h-full w-full drop-shadow-2xl"
        role="img"
        aria-label={`${def.label} mockup, ${placement.replace('-', ' ')}${color ? `, ${color.name}` : ''}`}
      >
        <defs>
          {/* Top-lit gradient — the light source sits above and slightly left,
              matching the contact shadow below. */}
          <linearGradient id="tf-garment-light" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity={isDark ? 0.14 : 0.5} />
            <stop offset="55%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>

        <path d={garment.body} fill={fill} stroke={stroke} strokeWidth="2" />
        {/* Fabric curvature: darkened flanks, then the light pass over the top. */}
        {garment.shade && <path d={garment.shade} fill="#000" opacity={0.16} />}
        <path d={garment.body} fill="url(#tf-garment-light)" />
        {garment.detail && (
          <path d={garment.detail} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>

      {/* Print area — positioned in catalogue fractions of the mockup box. */}
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
            className="pointer-events-none absolute -inset-px rounded-sm border border-dashed border-accent/45"
          />
        )}

        {/* The live design, centred and aspect-fitted inside the print box. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={slotRef}
            className="relative overflow-hidden"
            style={{ width: `${fitted.width}%`, height: `${fitted.height}%` }}
          >
            {/* Scaled from design space to screen space. Hidden until measured,
                so the first paint never flashes a full-size 2048px canvas. */}
            <div
              style={{
                width: designWidth,
                height: designHeight,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                visibility: scale > 0 ? 'visible' : 'hidden',
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
