'use client'

import { useMemo, useState } from 'react'
import { Calculator, MonitorPlay, Crown, Gem, Heart } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import AnimatedNumber, { type NumberFormatter } from '@/components/ui/AnimatedNumber'
import { CREATOR_RPM, fmtInr } from '@/lib/revenue/config'
import { estimateMonthlyEarnings, ESTIMATE_STREAM_MIX } from '@/lib/revenue/estimates'
import { cn } from '@/lib/utils/cn'

const PRESETS = [
  { label: '10K', views: 10_000 },
  { label: '50K', views: 50_000 },
  { label: '100K', views: 100_000 },
  { label: '500K', views: 500_000 },
  { label: '1M', views: 1_000_000 },
  { label: '5M', views: 5_000_000 },
  { label: '10M', views: 10_000_000 },
  { label: '50M', views: 50_000_000 },
  { label: '100M', views: 100_000_000 },
]

const SUBSCRIBER_PRESETS = [
  { label: '1K', subs: 1_000 },
  { label: '5K', subs: 5_000 },
  { label: '25K', subs: 25_000 },
  { label: '100K', subs: 100_000 },
  { label: '500K', subs: 500_000 },
  { label: '1M', subs: 1_000_000 },
]

const inrRounded: NumberFormatter = (n) => fmtInr(n, 0)

// Illustrative per-stream accent + icon for the estimate breakdown.
const STREAM_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>; bar: string; text: string }> = {
  ads: { icon: MonitorPlay, bar: 'bg-sky-400', text: 'text-sky-400' },
  subscriptions: { icon: Crown, bar: 'bg-amber-400', text: 'text-amber-400' },
  premium: { icon: Gem, bar: 'bg-teal-400', text: 'text-teal-400' },
  tips: { icon: Heart, bar: 'bg-rose-400', text: 'text-rose-400' },
}

/**
 * Illustrative monthly earnings estimator. Blends every revenue stream (ads,
 * premium chapters, subscription share and tips) into a low–high band, sourced
 * from the shared EARNING_ESTIMATE_TIERS so it matches the dashboard exactly.
 * These are estimates — real per-view payouts come from REVENUE_CONFIG.
 */
export default function RevenueCalculator() {
  const reduce = useReducedMotion()
  const [views, setViews] = useState(1_000_000)
  const [customInput, setCustomInput] = useState('')
  const [subs, setSubs] = useState(25_000)
  const [subsCustom, setSubsCustom] = useState('')

  const { lowInr, highInr } = useMemo(() => estimateMonthlyEarnings(subs, views), [subs, views])
  const midInr = (lowInr + highInr) / 2

  const handleCustom = (raw: string) => {
    setCustomInput(raw)
    const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(parsed) && parsed >= 0) setViews(Math.min(parsed, 10_000_000_000))
  }

  const handleCustomSubs = (raw: string) => {
    setSubsCustom(raw)
    const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(parsed) && parsed >= 0) setSubs(Math.min(parsed, 1_000_000_000))
  }

  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-bg-border">
        <h3 className="flex items-center gap-2 text-base font-bold text-text">
          <Calculator size={16} aria-hidden="true" /> Earnings Estimator
        </h3>
        <p className="text-xs text-text-muted mt-1">
          A realistic monthly estimate blended across advertisements, premium chapters, subscription share and reader
          tips. Illustrative only — actual earnings depend on the revenue your content generates.
        </p>
      </div>

      <div className="p-6 grid gap-8 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2.5">Monthly views</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ label, views: v }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setViews(v); setCustomInput('') }}
                  {...(views === v && customInput === '' ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all',
                    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    views === v && customInput === ''
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-bg-elevated text-text-secondary border-bg-border hover:text-text hover:border-text-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="calc-custom-views" className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
              Or enter exact views
            </label>
            <input
              id="calc-custom-views"
              type="text"
              inputMode="numeric"
              value={customInput}
              onChange={(e) => handleCustom(e.target.value)}
              placeholder="e.g. 2500000"
              className="w-full max-w-xs bg-bg-elevated border border-bg-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2.5">Subscribers</legend>
            <div className="flex flex-wrap gap-2">
              {SUBSCRIBER_PRESETS.map(({ label, subs: s }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setSubs(s); setSubsCustom('') }}
                  {...(subs === s && subsCustom === '' ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all',
                    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    subs === s && subsCustom === ''
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-bg-elevated text-text-secondary border-bg-border hover:text-text hover:border-text-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="calc-custom-subs" className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
              Or enter exact subscribers
            </label>
            <input
              id="calc-custom-subs"
              type="text"
              inputMode="numeric"
              value={subsCustom}
              onChange={(e) => handleCustomSubs(e.target.value)}
              placeholder="e.g. 25000"
              className="w-full max-w-xs bg-bg-elevated border border-bg-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </div>

          <p className="text-[11px] text-text-muted leading-relaxed max-w-xs">
            Earnings scale with the <span className="text-text-secondary font-medium">lower</span> of your subscribers and
            views — both must grow to unlock higher tiers. Every 1,000 validated views still pays at least
            {' '}{fmtInr(CREATOR_RPM, 0)} from the subscription pool.
          </p>
        </div>

        {/* Results */}
        <div>
          <div className="bg-bg-elevated/60 border border-bg-border rounded-2xl p-5 mb-4">
            <p className="text-xs font-medium text-text-muted mb-1">
              Estimated monthly earnings for {subs.toLocaleString('en-IN')} subscribers · {views.toLocaleString('en-IN')} views
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-text leading-tight tabular-nums">
              <AnimatedNumber value={lowInr} format={inrRounded} duration={0.6} />
              <span className="text-text-muted font-semibold mx-1.5">–</span>
              <AnimatedNumber value={highInr} format={inrRounded} duration={0.6} />
            </p>
            <p className="text-[11px] text-text-muted mt-1.5">
              Blended across ads, premium chapters, subscriptions and tips · not a guaranteed payout
            </p>
          </div>

          {/* Illustrative stream breakdown of the mid-range */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2.5">
            Typical revenue mix
          </p>
          <div className="space-y-3">
            {ESTIMATE_STREAM_MIX.map(({ key, label, pct }) => {
              const meta = STREAM_META[key]
              const Icon = meta.icon
              return (
                <div key={key}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="flex items-center gap-2 text-sm text-text-secondary">
                      <Icon size={13} className={meta.text} aria-hidden="true" /> {label}
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-text">
                      <AnimatedNumber value={midInr * (pct / 100)} format={inrRounded} duration={0.5} />
                      <span className="text-[11px] text-text-muted font-normal ml-1">~{pct}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-border/60 overflow-hidden" aria-hidden="true">
                    <motion.div
                      className={cn('h-full rounded-full', meta.bar)}
                      initial={{ width: reduce ? `${pct}%` : 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: reduce ? 0 : 0.9, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[10px] text-text-muted mt-4" role="note">
            Estimates only — actual earnings depend on validated views, reader engagement, the mix of active revenue
            streams and applicable taxes. TDS may apply on payouts.
          </p>
        </div>
      </div>
    </div>
  )
}
