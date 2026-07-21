import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * An icon + number pair (views, chapters, likes, rating…).
 *
 * The problem this solves: these stats render as a bare glyph next to a digit.
 * Sighted users have to guess what the icon means, and screen readers announced
 * a naked "2 4 5.0" because every icon was `aria-hidden` with no text
 * alternative anywhere.
 *
 * Hover uses the native `title` attribute rather than the Radix <Tooltip>. That
 * is deliberate: these stats sit INSIDE the card's <Link>, and a Radix tooltip
 * trigger is a focusable button — nesting one inside an anchor is invalid HTML,
 * breaks card clicks, and produces a nested-interactive-control a11y violation.
 * `title` works on non-interactive elements, costs no JS, and shows the icon's
 * name on hover, which is what's needed here. Use <Tooltip> for actual buttons.
 *
 * `srText` is exposed to screen readers as "Views: 1.2K". Note that when this
 * sits inside an element carrying its own `aria-label` (as the content cards
 * do), that label wins and this text is not announced — which is why the cards
 * also fold the stats into their link label.
 */
interface StatProps {
  icon: LucideIcon
  /** The formatted figure, e.g. "1.2K" or "5.0". */
  value: React.ReactNode
  /** What the icon means, e.g. "Views". Shown on hover; names the icon. */
  label: string
  /** Icon px size. Cards use 9–10, detail pages 13. */
  size?: number
  className?: string
  iconClassName?: string
}

export function Stat({
  icon: Icon,
  value,
  label,
  size = 10,
  className,
  iconClassName,
}: StatProps) {
  return (
    <span
      className={cn('flex items-center gap-1', className)}
      title={label}
    >
      <Icon size={size} className={iconClassName} aria-hidden="true" />
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">{`${label}: ${value}`}</span>
    </span>
  )
}

export default Stat
