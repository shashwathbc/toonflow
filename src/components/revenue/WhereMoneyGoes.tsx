'use client'

// "Where Your Money Goes" — animated allocation cards. Percentages and line
// items come from REVENUE_CONFIG.allocation so finance updates are one edit.
import { motion, useReducedMotion } from 'framer-motion'
import { Quote } from 'lucide-react'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { REVENUE_CONFIG } from '@/lib/revenue/config'

const pctFormat = (n: number) => `${Math.round(n)}`

export default function WhereMoneyGoes() {
  const reduceMotion = useReducedMotion()

  return (
    <section aria-labelledby="money-goes-heading" className="space-y-6">
      <div>
        <h2 id="money-goes-heading" className="text-2xl font-bold text-text">Where your money goes</h2>
        <p className="text-sm text-text-secondary mt-2 max-w-2xl">
          Full transparency on how platform revenue is reinvested — most of it goes straight back
          into the tools and infrastructure creators use every day.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REVENUE_CONFIG.allocation.map(({ pct, title, items }) => (
          <div key={title} className="bg-bg-card border border-bg-border rounded-2xl p-5">
            <p className="text-3xl font-bold text-text">
              <AnimatedNumber value={pct} format={pctFormat} duration={0.7} />
              <span className="text-lg font-semibold text-text-secondary">%</span>
            </p>
            <h3 className="text-sm font-bold text-text mt-1 mb-3">{title}</h3>
            <div
              className="h-1.5 rounded-full bg-bg-elevated overflow-hidden mb-4"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${title}: ${pct}% of platform revenue`}
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: reduceMotion ? `${pct}%` : 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true, margin: '-32px' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <ul className="flex flex-wrap gap-1.5" role="list">
              {items.map((item) => (
                <li key={item} className="text-[11px] text-text-secondary bg-bg-elevated border border-bg-border rounded-full px-2 py-0.5">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <figure className="bg-bg-card border border-bg-border rounded-2xl p-6 sm:p-8 text-center">
        <Quote size={18} className="mx-auto mb-3 text-text-muted" aria-hidden="true" />
        <blockquote className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
          Every subscription directly helps improve Toonflow Studio Paint, build better AI tools,
          support creators, and grow the global storytelling ecosystem.
        </blockquote>
      </figure>
    </section>
  )
}
