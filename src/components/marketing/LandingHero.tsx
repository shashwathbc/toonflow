import Link from 'next/link'
import { Sparkles, ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Cta {
  label: string
  href: string
}

interface LandingHeroProps {
  /** Small pill above the headline (e.g. "AI Novel Generator"). */
  eyebrow: string
  /** The page's single <h1>. Keep the primary keyword near the front. */
  title: string
  subtitle: string
  primaryCta: Cta
  secondaryCta?: Cta
  /** Optional icon shown in the eyebrow pill. Defaults to Sparkles. */
  Icon?: LucideIcon
}

/** Above-the-fold hero for a marketing/landing page. Server Component — no
 *  client JS. Owns the page's one <h1>. */
export function LandingHero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  Icon = Sparkles,
}: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient background glows (decorative). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-accent/[0.03] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Icon size={12} aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight text-text sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-text-secondary lg:text-lg">
          {subtitle}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={primaryCta.href}
            className="btn-accent px-6 py-3 text-base"
          >
            {primaryCta.label}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold',
                'text-text-secondary hover:text-text transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
              )}
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
