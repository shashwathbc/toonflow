import Image from 'next/image'
import logoMain from '@/assets/logomain.png'
import { cn } from '@/lib/utils/cn'

/**
 * The Toonflow wordmark: logo mark + optional type. Static import means Next
 * emits width/height into the <img>, so the mark reserves its box before the
 * bitmap decodes — no CLS on first paint.
 *
 * The mark is decorative when the wordmark text is visible beside it (the text
 * already names the brand), so it carries alt="" to avoid a duplicate
 * announcement. When `showText` is false the mark IS the only brand cue, so it
 * takes a real alt. The enclosing <Link> supplies the accessible name.
 */

const MARK_SIZES = {
  sm: 24,
  md: 30,
  lg: 38,
} as const

const TEXT_SIZES = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-lg',
} as const

interface LogoProps {
  /** Render the "TOONFLOW STUDIO PAINT" type next to the mark. */
  showText?: boolean
  /** Shorter type for constrained shells (studio sidebar). */
  variant?: 'full' | 'studio'
  size?: keyof typeof MARK_SIZES
  className?: string
  /** Hide the type below this breakpoint; the mark always stays visible. */
  textClassName?: string
  /**
   * Eager-load the mark. True for the header (it's in the first viewport and
   * competes with LCP); leave false anywhere below the fold — a priority hint
   * on an offscreen image just steals bandwidth from what's actually visible.
   */
  priority?: boolean
}

export function Logo({
  showText = true,
  variant = 'full',
  size = 'md',
  className,
  textClassName,
  priority = false,
}: LogoProps) {
  const px = MARK_SIZES[size]

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src={logoMain}
        alt={showText ? '' : 'Toonflow Studio Paint'}
        aria-hidden={showText || undefined}
        width={px}
        height={px}
        priority={priority}
        sizes={`${px}px`}
        className="object-contain shrink-0"
      />
      {showText && (
        <span
          className={cn(
            'font-extrabold tracking-[-0.02em] text-text leading-none whitespace-nowrap',
            TEXT_SIZES[size],
            textClassName
          )}
        >
          {variant === 'studio' ? (
            <>
              TOONFLOW <span className="text-text-secondary">STUDIO</span>
            </>
          ) : (
            <>
              TOONFLOW <span className="text-text-secondary">STUDIO PAINT</span>
            </>
          )}
        </span>
      )}
    </span>
  )
}

export default Logo
