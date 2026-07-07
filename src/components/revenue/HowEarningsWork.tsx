// "How Creator Earnings Work" — static explainer, rendered on the server.
import {
  Eye, Crown, Megaphone, Lock, Gift, Shirt, ScrollText, Clapperboard,
  BookOpen, PieChart, CalendarClock, Wallet,
} from 'lucide-react'
import { REVENUE_CONFIG, CREATOR_RPM, fmtInr } from '@/lib/revenue/config'
import { cn } from '@/lib/utils/cn'

type StreamStatus = 'live' | 'soon' | 'future'

const STATUS_BADGE: Record<StreamStatus, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-success/10 text-success border-success/20' },
  soon: { label: 'Coming soon', className: 'bg-warning/10 text-warning border-warning/20' },
  future: { label: 'Roadmap', className: 'bg-bg-elevated text-text-muted border-bg-border' },
}

const STREAMS: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>
  title: string
  description: string
  status: StreamStatus
}[] = [
  { icon: Eye, title: 'Views', description: `Every validated read earns you money — ${fmtInr(CREATOR_RPM)} per 1,000 views, paid from the subscription revenue pool.`, status: 'live' },
  { icon: Crown, title: 'Subscriptions', description: `Reader subscriptions (₹${REVENUE_CONFIG.subscriptionPriceInr}/month) fund the revenue pool — ${REVENUE_CONFIG.creatorSharePct}% of it goes to creators, split by watch share.`, status: 'live' },
  { icon: Megaphone, title: 'Ads', description: `Ad revenue on your stories splits ${REVENUE_CONFIG.adCreatorSharePct}/${REVENUE_CONFIG.adPlatformSharePct} in your favor once ads roll out.`, status: 'soon' },
  { icon: Lock, title: 'Premium chapters', description: 'Lock chapters behind coins — readers unlock, you earn the majority of every unlock.', status: 'soon' },
  { icon: Gift, title: 'Tips', description: 'Readers will be able to tip creators directly on any story or chapter.', status: 'soon' },
  { icon: Shirt, title: 'Merchandise', description: 'Sell merch for your characters and worlds through the marketplace.', status: 'future' },
  { icon: ScrollText, title: 'Licensing', description: 'License your IP for adaptations, translations and spin-offs.', status: 'future' },
  { icon: Clapperboard, title: 'Animation rights', description: 'Top stories get animation deals — you keep the rights and the majority share.', status: 'future' },
  { icon: BookOpen, title: 'Publishing rights', description: 'Print publishing partnerships for breakout novels and webtoons.', status: 'future' },
]

export default function HowEarningsWork() {
  return (
    <section aria-labelledby="how-earnings-heading" className="space-y-6">
      <div>
        <h2 id="how-earnings-heading" className="text-2xl font-bold text-text">How creator earnings work</h2>
        <p className="text-sm text-text-secondary mt-2 max-w-2xl">
          Your stories earn from multiple revenue streams. Views are the engine: readers generate
          validated views, views draw from the revenue pool, and your share lands in your wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STREAMS.map(({ icon: Icon, title, description, status }) => (
          <div key={title} className="bg-bg-card border border-bg-border rounded-2xl p-5 hover:border-text-muted/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center text-text-secondary">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[status].className)}>
                {STATUS_BADGE[status].label}
              </span>
            </div>
            <h3 className="text-sm font-bold text-text mb-1">{title}</h3>
            <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      {/* Revenue share / payout facts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2">
            <PieChart size={12} aria-hidden="true" /> Revenue share
          </p>
          <p className="text-2xl font-bold text-text">{REVENUE_CONFIG.creatorSharePct}%</p>
          <p className="text-xs text-text-secondary mt-1">
            of the subscription pool goes to creators ({REVENUE_CONFIG.adCreatorSharePct}% on ad revenue)
          </p>
        </div>
        <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2">
            <CalendarClock size={12} aria-hidden="true" /> Payout schedule
          </p>
          <p className="text-2xl font-bold text-text">{REVENUE_CONFIG.payoutSchedule}</p>
          <p className="text-xs text-text-secondary mt-1">after a withdrawal request is approved — UPI or bank transfer</p>
        </div>
        <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2">
            <Wallet size={12} aria-hidden="true" /> Minimum withdrawal
          </p>
          <p className="text-2xl font-bold text-text">{fmtInr(REVENUE_CONFIG.minWithdrawalInr, 0)}</p>
          <p className="text-xs text-text-secondary mt-1">available balance required before you can request a payout</p>
        </div>
      </div>
    </section>
  )
}
