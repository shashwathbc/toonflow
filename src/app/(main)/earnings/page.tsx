import type { Metadata } from 'next'
import Link from 'next/link'
import RevenueCalculator from '@/components/revenue/RevenueCalculator'
import HowEarningsWork from '@/components/revenue/HowEarningsWork'
import HowToonflowMakesMoney from '@/components/revenue/HowToonflowMakesMoney'
import WhereMoneyGoes from '@/components/revenue/WhereMoneyGoes'
import { REVENUE_CONFIG } from '@/lib/revenue/config'

export const metadata: Metadata = {
  title: 'Creator Earnings',
  description:
    'How creators earn on Toonflow Studio Paint — revenue share, payout schedule, an interactive earnings calculator, and full transparency on where the money goes.',
}

export default function EarningsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10 space-y-16">
      {/* Hero */}
      <section aria-labelledby="earnings-hero-heading" className="text-center max-w-2xl mx-auto space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Creator-first economics
        </p>
        <h1 id="earnings-hero-heading" className="text-3xl sm:text-5xl font-extrabold text-text leading-tight tracking-tight">
          Your stories.<br />Your {REVENUE_CONFIG.creatorSharePct}% share.
        </h1>
        <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
          Toonflow pays creators the majority of every rupee their stories generate.
          Estimate your earnings, see exactly how the model works, and follow where
          every subscription goes.
        </p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Link href="/create" className="btn-accent text-sm">Start creating</Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-bg-elevated border border-bg-border text-text hover:border-text-muted/40 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Open dashboard
          </Link>
        </div>
      </section>

      <RevenueCalculator />
      <HowEarningsWork />
      <HowToonflowMakesMoney />
      <WhereMoneyGoes />
    </div>
  )
}
