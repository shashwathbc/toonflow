'use client'

import { useId } from 'react'
import {
  Info, Lock, Unlock, ShieldCheck, Users, Eye, BookOpen,
  UserCheck, Fingerprint, CheckCircle2, MonitorPlay, Gem, Heart, Crown,
  Rocket, Sprout, Star, Calendar, CalendarDays,
  Hourglass, Wallet, Percent, Calculator, ArrowDown,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { formatCount } from '@/lib/utils/formatters'
import { EARNING_ESTIMATE_TIERS } from '@/lib/revenue/estimates'

// ── Live stats fed by the dashboard (client-derived, no extra fetch) ─────────

export interface MonetizationStats {
  // Unlock requirements (live)
  subscribers: number
  views: number
  publishedChapters: number
  profileComplete: boolean
  identityVerified: boolean
  goodStanding: boolean
  // Current earnings (live)
  todayRevenueInr: number
  monthRevenueInr: number
  pendingPayoutInr: number
  lifetimeEarningsInr: number
  premiumSalesInr: number
  tipsInr: number
  adRevenueInr: number
  // Config
  creatorSharePct: number
  platformSharePct: number
}

// ── Accent tones (teal + gold lead the palette) ──────────────────────────────

type Tone = 'teal' | 'gold' | 'green' | 'blue' | 'rose' | 'cyan'

interface ToneClasses {
  text: string
  chip: string
  glow: string
  bar: string
  wash: string
  border: string
  ring: string
}

const TONES: Record<Tone, ToneClasses> = {
  teal: { text: 'text-teal-400', chip: 'bg-teal-500/10 text-teal-300', glow: 'bg-teal-500/25', bar: 'bg-teal-400', wash: 'from-teal-500/[0.10]', border: 'hover:border-teal-400/40', ring: 'ring-teal-400' },
  gold: { text: 'text-amber-400', chip: 'bg-amber-500/10 text-amber-300', glow: 'bg-amber-500/25', bar: 'bg-amber-400', wash: 'from-amber-500/[0.10]', border: 'hover:border-amber-400/40', ring: 'ring-amber-400' },
  green: { text: 'text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-300', glow: 'bg-emerald-500/25', bar: 'bg-emerald-400', wash: 'from-emerald-500/[0.10]', border: 'hover:border-emerald-400/40', ring: 'ring-emerald-400' },
  blue: { text: 'text-sky-400', chip: 'bg-sky-500/10 text-sky-300', glow: 'bg-sky-500/25', bar: 'bg-sky-400', wash: 'from-sky-500/[0.10]', border: 'hover:border-sky-400/40', ring: 'ring-sky-400' },
  rose: { text: 'text-rose-400', chip: 'bg-rose-500/10 text-rose-300', glow: 'bg-rose-500/25', bar: 'bg-rose-400', wash: 'from-rose-500/[0.10]', border: 'hover:border-rose-400/40', ring: 'ring-rose-400' },
  cyan: { text: 'text-cyan-400', chip: 'bg-cyan-500/10 text-cyan-300', glow: 'bg-cyan-500/25', bar: 'bg-cyan-400', wash: 'from-cyan-500/[0.10]', border: 'hover:border-cyan-400/40', ring: 'ring-cyan-400' },
}

// ── pure helpers (module scope keeps React Compiler happy) ────────────────────

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const pct = (current: number, target: number) => Math.round(clamp01(current / target) * 100)
const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
const intIN = (n: number) => n.toLocaleString('en-IN')

// ── Shared primitives ────────────────────────────────────────────────────────

/** Fade-up on scroll, reduced-motion aware. */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}

/** Glassmorphism surface with a tinted gradient wash + corner glow. */
function Glass({ tone, className, children, hover }: {
  tone?: Tone; className?: string; children: React.ReactNode; hover?: boolean
}) {
  const t = tone ? TONES[tone] : null
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-bg-border bg-bg-card/60 backdrop-blur-xl',
        hover && 'transition-colors duration-300',
        hover && t?.border,
        className,
      )}
    >
      {t && <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80', t.wash)} aria-hidden="true" />}
      {t && <div className={cn('pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-40', hover && 'group-hover:opacity-70 transition-opacity duration-500', t.glow)} aria-hidden="true" />}
      <div className="relative">{children}</div>
    </div>
  )
}

/** Animated circular progress ring. */
function ProgressRing({ value, tone, unlocked }: { value: number; tone: Tone; unlocked?: boolean }) {
  const reduce = useReducedMotion()
  const t = TONES[tone]
  const size = 76
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (clamp01(value / 100) * c)
  return (
    <div className="relative flex-shrink-0 w-[76px] h-[76px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-bg-elevated" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={cn(t.text, 'stroke-current')}
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: reduce ? 0 : 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {unlocked
          ? <Unlock size={22} className={t.text} aria-hidden="true" />
          : <span className="text-base font-bold text-text tabular-nums">{value}%</span>}
      </div>
    </div>
  )
}

/** Animated horizontal progress bar with an accessible progressbar role. */
function Bar({ value, tone, label }: { value: number; tone: Tone; label: string }) {
  const reduce = useReducedMotion()
  const id = useId()
  return (
    <div
      className="h-2 rounded-full bg-bg-elevated overflow-hidden"
      role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-labelledby={id}
    >
      <span id={id} className="sr-only">{label}</span>
      <motion.div
        className={cn('h-full rounded-full', TONES[tone].bar)}
        initial={{ width: reduce ? `${value}%` : 0 }}
        whileInView={{ width: `${value}%` }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: reduce ? 0 : 1, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

function SectionHeading({ emoji, title, subtitle, id }: { emoji?: string; title: string; subtitle?: string; id: string }) {
  return (
    <div className="max-w-3xl">
      <h3 id={id} className="text-lg sm:text-xl font-bold text-text flex items-center gap-2">
        {emoji && <span aria-hidden="true">{emoji}</span>} {title}
      </h3>
      {subtitle && <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">{subtitle}</p>}
    </div>
  )
}

// ── Section 2 — Unlock Monetization ──────────────────────────────────────────

interface UnlockReq {
  icon: LucideIcon
  label: string
  tone: Tone
  met: boolean
  progress: number
  status: string
}

function buildUnlockReqs(s: MonetizationStats): UnlockReq[] {
  return [
    { icon: Users, label: '1,000 Subscribers', tone: 'teal', met: s.subscribers >= 1_000, progress: pct(s.subscribers, 1_000), status: `${intIN(s.subscribers)} / 1,000` },
    { icon: Eye, label: '10,000 Total Views', tone: 'blue', met: s.views >= 10_000, progress: pct(s.views, 10_000), status: `${intIN(s.views)} / 10,000` },
    { icon: BookOpen, label: 'Publish 10 Chapters', tone: 'gold', met: s.publishedChapters >= 10, progress: pct(s.publishedChapters, 10), status: `${intIN(s.publishedChapters)} / 10` },
    { icon: UserCheck, label: 'Complete Creator Profile', tone: 'green', met: s.profileComplete, progress: s.profileComplete ? 100 : 0, status: s.profileComplete ? 'Completed' : 'Incomplete' },
    { icon: Fingerprint, label: 'Identity Verification', tone: 'cyan', met: s.identityVerified, progress: s.identityVerified ? 100 : 0, status: s.identityVerified ? 'Completed' : 'Pending' },
    { icon: ShieldCheck, label: 'No Community Guideline Violations', tone: 'rose', met: s.goodStanding, progress: s.goodStanding ? 100 : 0, status: s.goodStanding ? 'Good' : 'Under review' },
  ]
}

const UNLOCK_REWARDS = ['Monetization Enabled', 'Creator Dashboard', 'Revenue Analytics', 'Monthly Payout Eligibility']

function UnlockMonetization({ stats }: { stats: MonetizationStats }) {
  const reqs = buildUnlockReqs(stats)
  const metCount = reqs.filter((r) => r.met).length
  const overall = Math.round(reqs.reduce((sum, r) => sum + r.progress, 0) / reqs.length)
  const unlocked = metCount === reqs.length

  return (
    <Glass tone="teal" hover className="p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* left: identity + ring */}
        <div className="lg:w-72 flex-shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full mb-2', TONES.teal.chip)}>
                <Rocket size={12} aria-hidden="true" /> Milestone
              </div>
              <h4 className="text-lg font-bold text-text flex items-center gap-1.5">
                <span aria-hidden="true">🚀</span> Unlock Monetization
              </h4>
            </div>
            <ProgressRing value={overall} tone="teal" unlocked={unlocked} />
          </div>

          <div className={cn('inline-flex items-center gap-1.5 self-start text-[11px] font-semibold px-2.5 py-1 rounded-full border',
            unlocked ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' : 'bg-bg-elevated text-text-muted border-bg-border')}>
            {unlocked ? <Unlock size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
            {unlocked ? 'Monetization unlocked' : `${metCount}/${reqs.length} requirements met`}
          </div>

          {/* reward list */}
          <div className="rounded-xl border border-bg-border bg-bg-elevated/40 p-4">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2.5">Unlocks</p>
            <ul className="space-y-2">
              {UNLOCK_REWARDS.map((reward) => (
                <li key={reward} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={14} className={cn('flex-shrink-0', unlocked ? 'text-emerald-400' : 'text-text-muted/60')} aria-hidden="true" />
                  <span className={unlocked ? 'text-text font-medium' : 'text-text-secondary'}>{reward}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* right: per-requirement progress */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 content-start">
          {reqs.map((req) => {
            const Icon = req.icon
            const t = TONES[req.tone]
            return (
              <div key={req.label}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', req.met ? t.chip : 'bg-bg-elevated text-text-muted')}>
                    <Icon size={12} aria-hidden="true" />
                  </span>
                  <span className={cn('text-xs font-medium flex-1 min-w-0 truncate', req.met ? 'text-text' : 'text-text-secondary')}>{req.label}</span>
                  {req.met && <CheckCircle2 size={14} className={t.text} aria-hidden="true" />}
                </div>
                <Bar value={req.progress} tone={req.tone} label={`${req.label}: ${req.status}`} />
                <p className={cn('text-[11px] tabular-nums mt-1', req.met ? t.text : 'text-text-muted')}>{req.status}</p>
              </div>
            )
          })}
        </div>
      </div>
    </Glass>
  )
}

// ── Section 3 — How You Earn ─────────────────────────────────────────────────

const REVENUE_STREAMS: { emoji: string; icon: LucideIcon; title: string; body: string; tone: Tone }[] = [
  { emoji: '📺', icon: MonitorPlay, title: 'Advertisement Revenue', tone: 'blue', body: 'Earn money from advertisements displayed while readers enjoy your webtoons and novels.' },
  { emoji: '💎', icon: Gem, title: 'Premium Chapter Revenue', tone: 'teal', body: 'Earn whenever readers unlock premium chapters using Toonflow Coins.' },
  { emoji: '❤️', icon: Heart, title: 'Reader Tips', tone: 'rose', body: 'Readers can directly support their favorite creators with tips.' },
  { emoji: '👑', icon: Crown, title: 'Toonflow Premium', tone: 'gold', body: 'Receive a share of subscription revenue based on reader engagement with your content.' },
]

function HowYouEarn() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {REVENUE_STREAMS.map((s, i) => {
        const Icon = s.icon
        const t = TONES[s.tone]
        return (
          <Reveal key={s.title} delay={i * 0.06}>
            <motion.div whileHover={{ y: -4 }} className="h-full">
              <Glass tone={s.tone} hover className="p-5 h-full">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-3', t.chip)}>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h4 className="text-sm font-bold text-text flex items-center gap-1.5 mb-1.5">
                  <span aria-hidden="true">{s.emoji}</span> {s.title}
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">{s.body}</p>
              </Glass>
            </motion.div>
          </Reveal>
        )
      })}
    </div>
  )
}

// ── Section 4 — Revenue Sharing ──────────────────────────────────────────────

function RevenueShare({ creatorPct, platformPct }: { creatorPct: number; platformPct: number }) {
  const reduce = useReducedMotion()
  return (
    <Glass tone="teal" className="p-5 sm:p-6">
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-4">Example revenue split</p>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl border border-teal-400/20 bg-teal-500/[0.07] p-4">
          <p className="text-xs text-text-secondary mb-1">Creator receives</p>
          <p className="text-3xl sm:text-4xl font-extrabold text-teal-300 tabular-nums">{creatorPct}%</p>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-4">
          <p className="text-xs text-text-secondary mb-1">Toonflow Platform</p>
          <p className="text-3xl sm:text-4xl font-extrabold text-amber-300 tabular-nums">{platformPct}%</p>
        </div>
      </div>
      {/* stacked split bar */}
      <div className="h-3 rounded-full overflow-hidden bg-bg-elevated flex" role="img" aria-label={`Creator ${creatorPct} percent, platform ${platformPct} percent`}>
        <motion.div
          className="h-full bg-gradient-to-r from-teal-500 to-teal-400"
          initial={{ width: reduce ? `${creatorPct}%` : 0 }}
          whileInView={{ width: `${creatorPct}%` }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: reduce ? 0 : 1, ease: 'easeOut' }}
        />
        <div className="h-full flex-1 bg-gradient-to-r from-amber-400 to-amber-300" />
      </div>
      <p className="text-xs text-text-secondary leading-relaxed mt-4">
        The revenue share helps cover platform development, AI infrastructure, payment processing, moderation,
        customer support, hosting, and creator tools.
      </p>
    </Glass>
  )
}

// ── Section 5 — Estimated Monthly Earnings ───────────────────────────────────
// Rows come from the shared EARNING_ESTIMATE_TIERS, the same source the /earnings
// calculator interpolates — so the table and the calculator can never disagree.

const inr0 = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function EstimatedEarnings() {
  return (
    <Glass className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-b border-bg-border bg-bg-elevated/50 text-left">
              <th scope="col" className="px-4 sm:px-5 py-3 text-xs font-semibold text-text-muted">Subscribers</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-xs font-semibold text-text-muted">Monthly Views</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-xs font-semibold text-text-muted text-right">Estimated Revenue Range</th>
            </tr>
          </thead>
          <tbody>
            {EARNING_ESTIMATE_TIERS.map((tier) => (
              <tr key={tier.subscribers} className="border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/30 transition-colors">
                <td className="px-4 sm:px-5 py-3 font-medium text-text tabular-nums">{tier.subscribers.toLocaleString('en-IN')}</td>
                <td className="px-4 sm:px-5 py-3 text-text-secondary tabular-nums">{tier.monthlyViews.toLocaleString('en-IN')}</td>
                <td className="px-4 sm:px-5 py-3 text-right font-semibold tabular-nums bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-teal-300">
                  {tier.highInr == null ? `${inr0(tier.lowInr)}+` : `${inr0(tier.lowInr)} – ${inr0(tier.highInr)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Glass>
  )
}

// ── Section 6 — Creator Journey (timeline) ───────────────────────────────────

const JOURNEY: { emoji: string; icon: LucideIcon; title: string; subs: number; views: number; rewards: string[]; tone: Tone }[] = [
  { emoji: '🚀', icon: Rocket, title: 'Monetization Enabled', subs: 1_000, views: 10_000, rewards: ['Revenue Sharing'], tone: 'green' },
  { emoji: '🌱', icon: Sprout, title: 'Creator Partner', subs: 5_000, views: 100_000, rewards: ['Priority Creator Support'], tone: 'blue' },
  { emoji: '⭐', icon: Star, title: 'Verified Creator', subs: 25_000, views: 1_000_000, rewards: ['Verified Badge', 'Early Feature Access'], tone: 'teal' },
  { emoji: '👑', icon: Crown, title: 'Elite Creator', subs: 100_000, views: 10_000_000, rewards: ['Featured Creator', 'Higher Visibility'], tone: 'gold' },
  { emoji: '💎', icon: Gem, title: 'Legend Creator', subs: 1_000_000, views: 100_000_000, rewards: ['Gold Verified Badge', 'Exclusive Events', 'Priority Promotion', 'Dedicated Creator Manager'], tone: 'cyan' },
]

function CreatorJourney({ stats }: { stats: MonetizationStats }) {
  const achieved = JOURNEY.map((tier) => stats.subscribers >= tier.subs && stats.views >= tier.views)
  // current = highest achieved tier, else the first (in-progress) tier
  const lastAchieved = achieved.lastIndexOf(true)
  const currentIndex = lastAchieved >= 0 ? lastAchieved : 0

  return (
    <ol className="relative">
      {JOURNEY.map((tier, i) => {
        const Icon = tier.icon
        const t = TONES[tier.tone]
        const isAchieved = achieved[i]
        const isCurrent = i === currentIndex
        const isLast = i === JOURNEY.length - 1
        return (
          <li key={tier.title} className="relative pl-14 sm:pl-16 pb-6 last:pb-0">
            {/* connector line */}
            {!isLast && (
              <span
                className={cn('absolute left-[22px] sm:left-[26px] top-11 bottom-0 w-0.5', isAchieved ? t.bar : 'bg-bg-border')}
                aria-hidden="true"
              />
            )}
            {/* node */}
            <span
              className={cn(
                'absolute left-0 top-0 w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-2xl flex items-center justify-center border text-lg',
                isAchieved ? cn(t.chip, 'border-transparent') : 'bg-bg-elevated text-text-muted border-bg-border',
                isCurrent && cn('ring-2 ring-offset-2 ring-offset-bg', t.ring),
              )}
              aria-hidden="true"
            >
              {isAchieved ? <span>{tier.emoji}</span> : <Icon size={18} />}
            </span>

            <Reveal delay={Math.min(i * 0.06, 0.3)}>
              <Glass tone={isAchieved ? tier.tone : undefined} hover={isAchieved} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-text flex items-center gap-1.5">
                        <span aria-hidden="true">{tier.emoji}</span> {tier.title}
                      </h4>
                      {isCurrent && (
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', t.chip)}>You are here</span>
                      )}
                      {isAchieved && !isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">Achieved</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 tabular-nums">
                      {formatCount(tier.subs)} subscribers · {formatCount(tier.views)} views
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                    {tier.rewards.map((reward) => (
                      <span key={reward} className={cn('text-[10px] font-medium px-2 py-1 rounded-lg border',
                        isAchieved ? cn(t.chip, 'border-transparent') : 'bg-bg-elevated/60 text-text-secondary border-bg-border')}>
                        {reward}
                      </span>
                    ))}
                  </div>
                </div>
              </Glass>
            </Reveal>

            {!isLast && (
              <div className="flex justify-start pl-[10px] sm:pl-[14px] pt-3" aria-hidden="true">
                <ArrowDown size={14} className="text-text-muted" />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Section 7 — Current Earnings Dashboard ───────────────────────────────────

function StatCard({ icon: Icon, label, value, tone, delay }: {
  icon: LucideIcon; label: string; value: string; tone: Tone; delay: number
}) {
  const t = TONES[tone]
  return (
    <Reveal delay={delay}>
      <motion.div whileHover={{ y: -3 }} className="h-full">
        <Glass tone={tone} hover className="p-4 h-full">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', t.chip)}>
            <Icon size={16} aria-hidden="true" />
          </div>
          <p className="text-lg font-bold text-text tabular-nums leading-tight truncate">{value}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">{label}</p>
        </Glass>
      </motion.div>
    </Reveal>
  )
}

function EarningsDashboard({ stats }: { stats: MonetizationStats }) {
  const cards: { icon: LucideIcon; label: string; value: string; tone: Tone }[] = [
    { icon: Calendar, label: "Today's Revenue", value: inr(stats.todayRevenueInr), tone: 'green' },
    { icon: CalendarDays, label: 'This Month', value: inr(stats.monthRevenueInr), tone: 'blue' },
    { icon: Hourglass, label: 'Pending Payout', value: inr(stats.pendingPayoutInr), tone: 'gold' },
    { icon: Wallet, label: 'Lifetime Earnings', value: inr(stats.lifetimeEarningsInr), tone: 'teal' },
    { icon: Users, label: 'Total Subscribers', value: formatCount(stats.subscribers), tone: 'cyan' },
    { icon: Eye, label: 'Total Views', value: formatCount(stats.views), tone: 'blue' },
    { icon: Gem, label: 'Premium Sales', value: inr(stats.premiumSalesInr), tone: 'teal' },
    { icon: Heart, label: 'Tips Received', value: inr(stats.tipsInr), tone: 'rose' },
    { icon: MonitorPlay, label: 'Ad Revenue', value: inr(stats.adRevenueInr), tone: 'blue' },
    { icon: Percent, label: 'Revenue Share', value: `${stats.creatorSharePct}%`, tone: 'gold' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} tone={c.tone} delay={Math.min(i * 0.04, 0.3)} />
      ))}
    </div>
  )
}

// ── Root section ─────────────────────────────────────────────────────────────

export default function CreatorMonetization({ stats }: { stats: MonetizationStats }) {
  return (
    <section aria-labelledby="monetization-heading" className="space-y-12">
      {/* SECTION 1 — Creator Monetization */}
      <div className="space-y-4">
        <div className="max-w-3xl">
          <h2 id="monetization-heading" className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2">
            <span aria-hidden="true">💰</span> Creator Monetization
          </h2>
          <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
            Your earnings are based on the actual revenue generated by your content. Meeting the minimum requirements
            unlocks monetization—it does not guarantee a fixed income.
          </p>
        </div>
        <Reveal>
          <Glass tone="gold" className="p-4 flex items-start gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', TONES.gold.chip)}>
              <Info size={16} aria-hidden="true" />
            </div>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              To start earning on Toonflow Studio Paint, you must first unlock monetization by meeting the minimum
              creator requirements. Once approved, you&apos;ll earn a share of the revenue generated from your content.
            </p>
          </Glass>
        </Reveal>
      </div>

      {/* SECTION 2 — Unlock Monetization */}
      <Reveal className="space-y-4">
        <SectionHeading emoji="🚀" title="Unlock Monetization" id="unlock-heading" subtitle="Track your progress toward every requirement below. All must be met to enable payouts." />
        <UnlockMonetization stats={stats} />
      </Reveal>

      {/* SECTION 3 — How You Earn */}
      <div className="space-y-4">
        <Reveal><SectionHeading title="How You Earn" id="earn-heading" subtitle="Four revenue streams contribute to your creator income." /></Reveal>
        <HowYouEarn />
      </div>

      {/* SECTION 4 — Revenue Sharing */}
      <div className="space-y-4">
        <Reveal><SectionHeading title="Revenue Sharing" id="share-heading" subtitle="A transparent split between creators and the platform." /></Reveal>
        <Reveal><RevenueShare creatorPct={stats.creatorSharePct} platformPct={stats.platformSharePct} /></Reveal>
      </div>

      {/* SECTION 5 — Estimated Monthly Earnings */}
      <div className="space-y-4">
        <Reveal>
          <SectionHeading emoji="📊" title="Estimated Monthly Earnings" id="estimate-heading"
            subtitle="These estimates are illustrative only. Your actual earnings depend on advertising revenue, premium purchases, subscriptions, reader engagement, tips, refunds, taxes, and other factors." />
        </Reveal>
        <Reveal><EstimatedEarnings /></Reveal>
        <Reveal>
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
            <Info size={15} className="text-amber-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-text-secondary leading-relaxed">
              These figures are estimates and are not guaranteed payouts. Actual earnings depend on revenue generated
              by your content and overall platform performance.
            </p>
          </div>
        </Reveal>
      </div>

      {/* SECTION 6 — Creator Journey */}
      <div className="space-y-4">
        <Reveal><SectionHeading title="Creator Journey" id="journey-heading" subtitle="Grow through five tiers, each unlocking new rewards and visibility." /></Reveal>
        <CreatorJourney stats={stats} />
      </div>

      {/* SECTION 7 — Current Earnings Dashboard */}
      <div className="space-y-4">
        <Reveal><SectionHeading emoji="📈" title="Current Earnings Dashboard" id="current-heading" subtitle="A live snapshot of your revenue across every stream." /></Reveal>
        <EarningsDashboard stats={stats} />
      </div>

      {/* SECTION 8 — Transparency */}
      <div className="space-y-4">
        <Reveal>
          <Glass tone="teal" className="p-5 sm:p-6 flex items-start gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', TONES.teal.chip)}>
              <Calculator size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text mb-2">How Earnings Are Calculated</h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Your earnings are calculated from the actual revenue generated by your content through advertisements,
                premium chapter purchases, subscriptions, and reader tips. Toonflow deducts the platform revenue share
                before calculating your payout. All earnings shown in your dashboard are updated regularly and are fully
                transparent.
              </p>
            </div>
          </Glass>
        </Reveal>
      </div>
    </section>
  )
}
