import Image from 'next/image'
import logoMain from '@/assets/logomain.png'
import { cn } from '@/lib/utils/cn'

/**
 * The Toonflow lockup: brand mark + "Toonflow Studio Paint" wordmark.
 *
 * Static image import so Next emits intrinsic width/height and the mark reserves
 * its box before the bitmap decodes (no CLS). The mark is decorative here —
 * alt="" / aria-hidden — because the enclosing <Link> supplies the accessible
 * name and the wordmark text already spells the brand.
 *
 * The wordmark is a single white colour (no two-tone): "Studio Paint" reads in
 * the same text colour as "Toonflow".
 */

const MARK_SIZES = {
  sm: 24,
  md: 30,
  lg: 40,
} as const

const TEXT_SIZES = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-xl',
} as const

interface LogoProps {
  /** 'studio' drops "Paint" for the narrower studio sidebar/header. */
  variant?: 'full' | 'studio'
  size?: keyof typeof MARK_SIZES
  className?: string
  /** Eager-load the mark — true for the header (first viewport, near LCP). */
  priority?: boolean
}

export function Logo({ variant = 'full', size = 'md', className, priority = false }: LogoProps) {
  const px = MARK_SIZES[size]

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src={logoMain}
        alt=""
        aria-hidden
        width={px}
        height={px}
        priority={priority}
        sizes={`${px}px`}
        className="object-contain shrink-0"
      />
      <span
        className={cn(
          'font-extrabold tracking-[-0.01em] leading-none whitespace-nowrap text-text',
          TEXT_SIZES[size]
        )}
      >
        {variant === 'studio' ? 'Toonflow Studio' : 'Toonflow Studio Paint'}
      </span>
    </span>
  )
}

export default Logo
