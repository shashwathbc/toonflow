'use client'

import { useMemo, useState } from 'react'
import { Calculator, IndianRupee, Landmark, ReceiptText, Server, TrendingUp } from 'lucide-react'
import AnimatedNumber, { type NumberFormatter } from '@/components/ui/AnimatedNumber'
import { REVENUE_CONFIG, revenueBreakdown, fmtInr } from '@/lib/revenue/config'
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

type Model = 'subscription' | 'ads'

const MODELS: { id: Model; label: string; share: string }[] = [
  { id: 'subscription', label: 'Subscription pool', share: `${REVENUE_CONFIG.creatorSharePct}% / ${REVENUE_CONFIG.platformSharePct}%` },
  { id: 'ads', label: 'Ad revenue', share: `${REVENUE_CONFIG.adCreatorSharePct}% / ${REVENUE_CONFIG.adPlatformSharePct}%` },
]

const inrRounded: NumberFormatter = (n) => fmtInr(n, 0)

function BreakdownRow({ icon: Icon, label, value, emphasis }: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className={cn('flex items-center gap-2 text-sm', emphasis ? 'font-semibold text-text' : 'text-text-secondary')}>
        <Icon size={13} aria-hidden="true" /> {label}
      </span>
      <span className={cn('tabular-nums text-sm', emphasis ? 'font-bold text-text' : 'text-text-secondary')}>
        <AnimatedNumber value={value} format={inrRounded} duration={0.5} />
      </span>
    </div>
  )
}

/**
 * Interactive earnings calculator. All rates come from REVENUE_CONFIG —
 * change one constant and every number here follows.
 */
export default function RevenueCalculator() {
  const [views, setViews] = useState(1_000_000)
  const [customInput, setCustomInput] = useState('')
  const [model, setModel] = useState<Model>('subscription')

  const breakdown = useMemo(() => revenueBreakdown(views, model), [views, model])

  const handleCustom = (raw: string) => {
    setCustomInput(raw)
    const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(parsed) && parsed >= 0) setViews(Math.min(parsed, 10_000_000_000))
  }

  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-bg-border">
        <h3 className="flex items-center gap-2 text-base font-bold text-text">
          <Calculator size={16} aria-hidden="true" /> Revenue Calculator
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Assumes {fmtInr(REVENUE_CONFIG.grossPerViewInr)} gross per validated view and a ₹{REVENUE_CONFIG.subscriptionPriceInr}/month
          reader subscription funding the revenue pool. All rates are configurable platform-side.
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
            <legend className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2.5">Revenue model</legend>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {MODELS.map(({ id, label, share }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModel(id)}
                  {...(model === id ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    model === id ? 'border-accent bg-accent/5' : 'border-bg-border hover:border-text-muted/40',
                  )}
                >
                  <span className="block text-sm font-semibold text-text">{label}</span>
                  <span className="block text-[11px] text-text-muted mt-0.5">Creator / platform · {share}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Results */}
        <div>
          <div className="bg-bg-elevated/60 border border-bg-border rounded-2xl p-5 mb-4">
            <p className="text-xs font-medium text-text-muted mb-1">
              You earn on {views.toLocaleString('en-IN')} views
            </p>
            <p className="text-4xl font-bold text-text leading-tight">
              <AnimatedNumber value={breakdown.creatorInr} format={inrRounded} duration={0.6} />
            </p>
            <p className="text-[11px] text-text-muted mt-1.5">
              {model === 'subscription' ? REVENUE_CONFIG.creatorSharePct : REVENUE_CONFIG.adCreatorSharePct}% of gross ·
              deductions are carried by the platform&apos;s share
            </p>
          </div>

          <div className="divide-y divide-bg-border/50 px-1">
            <BreakdownRow icon={TrendingUp} label="Estimated gross revenue" value={breakdown.grossInr} emphasis />
            <BreakdownRow icon={IndianRupee} label="Creator earnings" value={breakdown.creatorInr} emphasis />
            <BreakdownRow icon={Landmark} label="Platform revenue" value={breakdown.platformGrossInr} />
            <BreakdownRow icon={ReceiptText} label={`Payment gateway fees (${REVENUE_CONFIG.paymentGatewayFeePct}%)`} value={breakdown.gatewayFeesInr} />
            <BreakdownRow icon={ReceiptText} label={`Taxes (${REVENUE_CONFIG.taxPct}% GST on platform share)`} value={breakdown.taxesInr} />
            <BreakdownRow icon={Server} label={`Operational cost (${REVENUE_CONFIG.operationalCostPct}%)`} value={breakdown.operationalInr} />
            <BreakdownRow icon={Landmark} label="Platform profit" value={breakdown.platformProfitInr} />
          </div>

          <p className="text-[10px] text-text-muted mt-4" role="note">
            Estimates only — actual earnings depend on validated views, reader mix and applicable taxes. TDS may apply on payouts.
          </p>
        </div>
      </div>
    </div>
  )
}
