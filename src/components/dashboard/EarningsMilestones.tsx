'use client'

import { useId } from 'react'
import Link from 'next/link'
import {
  Users, Eye, IndianRupee, BookOpen, Star, Rocket, BadgeCheck,
  CalendarCheck, Flame, Sparkles, Crown, Gem, ShieldCheck, Award,
  Lock, Unlock, CheckCircle2, Circle, ArrowRight, Trophy,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { formatCount } from '@/lib/utils/formatters'

// ── Live stats fed by the dashboard (all client-derived, no extra fetch) ─────

export interface MilestoneStats {
  subscribers: number
  views: number
  earningsInr: number
  publishedChapters: number
  profileComplete: boolean
  hasPublishedContent: boolean
  avgRating: number
  ratingCount: number
  hasOriginals: boolean
  recentlyActive: boolean
  /** likes ÷ views, expressed 0–100 */
  engagementRatePct: number
}

// ── Accent themes: gold, purple, green ───────────────────────────────────────

type Accent = 'green' | 'gold' | 'purple'

interface Theme {
  /** ring + accent text/icon color */
  text: string
  /** soft chip background */
  chip: string
  /** reward-badge pill when earned */
  badge: string
  /** decorative corner glow */
  glow: string
  /** gradient wash across the card face */
  wash: string
  /** hover border tint */
  hoverBorder: string
  /** CTA button fill */
  button: string
}

const THEMES: Record<Accent, Theme> = {
  green: {
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    glow: 'bg-emerald-500/20',
    wash: 'from-emerald-500/[0.08]',
    hoverBorder: 'hover:border-emerald-400/40',
    button: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950',
  },
  gold: {
    text: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    glow: 'bg-amber-500/20',
    wash: 'from-amber-500/[0.08]',
    hoverBorder: 'hover:border-amber-400/40',
    button: 'bg-amber-400 hover:bg-amber-300 text-amber-950',
  },
  purple: {
    text: 'text-purple-400',
    chip: 'bg-purple-500/10 text-purple-300',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
    glow: 'bg-purple-500/20',
    wash: 'from-purple-500/[0.08]',
    hoverBorder: 'hover:border-purple-400/40',
    button: 'bg-purple-500 hover:bg-purple-400 text-white',
  },
}

// ── Requirement + milestone model ────────────────────────────────────────────

interface Requirement {
  icon: LucideIcon
  label: string
  met: boolean
  /** progress 0–1 toward this requirement (booleans are 0 or 1) */
  progress: number
  /** optional "current / target" caption for measurable requirements */
  detail?: string
}

interface Milestone {
  id: string
  emoji: string
  title: string
  targetLabel: string
  targetInr: number
  accent: Accent
  icon: LucideIcon
  badgeLabel: string
  badgeIcon: LucideIcon
  requirements: Requirement[]
  footer?: string
  cta?: { label: string; href: string }
}

// ── pure helpers (module scope keeps React Compiler happy) ────────────────────

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const ratio = (current: number, target: number) => clamp01(current / target)
// Mirrors the wallet cards' fmtInr (up to 2 decimals) so tiny earnings like ₹0.02
// show precisely instead of rounding to ₹0.
const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

function countReq(icon: LucideIcon, label: string, current: number, target: number): Requirement {
  const p = ratio(current, target)
  return { icon, label, met: current >= target, progress: p, detail: `${formatCount(current)} / ${formatCount(target)}` }
}

function boolReq(icon: LucideIcon, label: string, done: boolean): Requirement {
  return { icon, label, met: done, progress: done ? 1 : 0 }
}

/** Builds the five tiers with live progress woven in from `stats`. */
function buildMilestones(s: MilestoneStats): Milestone[] {
  return [
    {
      id: 'getting-started',
      emoji: '🚀',
      title: 'Getting Started',
      targetLabel: '₹1,000',
      targetInr: 1_000,
      accent: 'green',
      icon: Rocket,
      badgeLabel: 'Monetization Unlocked',
      badgeIcon: ShieldCheck,
      requirements: [
        countReq(Users, '1,000 Subscribers', s.subscribers, 1_000),
        countReq(Eye, '1,000 Views', s.views, 1_000),
        boolReq(BadgeCheck, 'Creator profile completed', s.profileComplete),
        boolReq(Rocket, 'Publish your first Webtoon or Novel', s.hasPublishedContent),
      ],
      footer: 'Once completed, you can start earning from your content.',
      cta: { label: 'Start Creating', href: '/create' },
    },
    {
      id: 'rising-creator',
      emoji: '🌱',
      title: 'Rising Creator',
      targetLabel: '₹10,000',
      targetInr: 10_000,
      accent: 'gold',
      icon: Sparkles,
      badgeLabel: 'Creator Partner',
      badgeIcon: BadgeCheck,
      requirements: [
        countReq(Users, '5,000 Subscribers', s.subscribers, 5_000),
        countReq(Eye, '50,000 Views', s.views, 50_000),
        countReq(BookOpen, '10 Published Chapters', s.publishedChapters, 10),
        boolReq(Star, 'Good Community Rating', s.avgRating >= 4 && s.ratingCount >= 1),
      ],
    },
    {
      id: 'professional-creator',
      emoji: '⭐',
      title: 'Professional Creator',
      targetLabel: '₹1,00,000',
      targetInr: 100_000,
      accent: 'purple',
      icon: Award,
      badgeLabel: 'Verified Creator',
      badgeIcon: ShieldCheck,
      requirements: [
        countReq(Users, '25,000 Subscribers', s.subscribers, 25_000),
        countReq(Eye, '5,00,000 Views', s.views, 500_000),
        countReq(BookOpen, '50 Published Chapters', s.publishedChapters, 50),
        boolReq(CalendarCheck, 'Consistent Monthly Activity', s.recentlyActive),
      ],
    },
    {
      id: 'elite-creator',
      emoji: '👑',
      title: 'Elite Creator',
      targetLabel: '₹10,00,000',
      targetInr: 1_000_000,
      accent: 'gold',
      icon: Crown,
      badgeLabel: 'Elite Partner',
      badgeIcon: Crown,
      requirements: [
        countReq(Users, '1,00,000 Subscribers', s.subscribers, 100_000),
        countReq(Eye, '50,00,000 Views', s.views, 5_000_000),
        countReq(BookOpen, '100 Published Chapters', s.publishedChapters, 100),
        boolReq(Flame, 'High Engagement Rate', s.engagementRatePct >= 3),
      ],
    },
    {
      id: 'legendary-creator',
      emoji: '💎',
      title: 'Legendary Creator',
      targetLabel: '₹1 Crore+',
      targetInr: 10_000_000,
      accent: 'purple',
      icon: Gem,
      badgeLabel: 'Legend Status',
      badgeIcon: Trophy,
      requirements: [
        countReq(Users, '10,00,000 Subscribers', s.subscribers, 1_000_000),
        countReq(Eye, '10 Crore+ Views', s.views, 100_000_000),
        boolReq(Star, 'Top Rated Creator', s.avgRating >= 4.5 && s.ratingCount >= 10),
        boolReq(Sparkles, 'Exclusive Originals Published', s.hasOriginals),
      ],
      cta: { label: 'Become a Legend', href: '/earnings' },
    },
  ]
}

// ── Circular progress ring ───────────────────────────────────────────────────

function CircularProgress({ pct, theme, unlocked }: { pct: number; theme: Theme; unlocked: boolean }) {
  const reduce = useReducedMotion()
  const size = 68
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (clamp01(pct / 100) * c)

  return (
    <div className="relative flex-shrink-0 w-[68px] h-[68px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={stroke} className="stroke-bg-elevated"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={stroke} strokeLinecap="round"
          className={cn(theme.text, 'stroke-current')}
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: reduce ? 0 : 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {unlocked ? (
          <Unlock size={20} className={theme.text} aria-hidden="true" />
        ) : (
          <span className="text-sm font-bold text-text tabular-nums">{Math.round(pct)}%</span>
        )}
      </div>
    </div>
  )
}

// ── Requirement checklist row ────────────────────────────────────────────────

function RequirementRow({ req, theme }: { req: Requirement; theme: Theme }) {
  const Icon = req.icon
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
          req.met ? theme.chip : 'bg-bg-elevated text-text-muted'
        )}
      >
        <Icon size={13} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs font-medium leading-tight truncate', req.met ? 'text-text' : 'text-text-secondary')}>
          {req.label}
        </p>
        {req.detail && (
          <p className="text-[10px] text-text-muted tabular-nums mt-0.5">{req.detail}</p>
        )}
      </div>
      {req.met ? (
        <CheckCircle2 size={15} className={cn('flex-shrink-0', theme.text)} aria-hidden="true" />
      ) : (
        <Circle size={15} className="text-text-muted/50 flex-shrink-0" aria-hidden="true" />
      )}
      <span className="sr-only">{req.met ? '— completed' : '— not yet completed'}</span>
    </li>
  )
}

// ── One milestone card ───────────────────────────────────────────────────────

function MilestoneCard({ milestone, index }: { milestone: Milestone; index: number }) {
  const reduce = useReducedMotion()
  const theme = THEMES[milestone.accent]
  const barId = useId()

  const total = milestone.requirements.length
  const metCount = milestone.requirements.filter((r) => r.met).length
  const pct = Math.round(
    (milestone.requirements.reduce((sum, r) => sum + r.progress, 0) / total) * 100
  )
  const unlocked = metCount === total
  const BadgeIcon = milestone.badgeIcon
  const TitleIcon = milestone.icon

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: Math.min(index * 0.07, 0.35) }}
      whileHover={reduce ? undefined : { y: -5 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl h-full',
        'border border-bg-border bg-bg-card/60 backdrop-blur-xl',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] transition-colors duration-300',
        theme.hoverBorder
      )}
    >
      {/* gradient wash + corner glow */}
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80', theme.wash)} aria-hidden="true" />
      <div className={cn('pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500', theme.glow)} aria-hidden="true" />

      <div className="relative p-5 flex flex-col gap-4 h-full">
        {/* top row: identity + lock state */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full mb-2', theme.chip)}>
              <TitleIcon size={12} aria-hidden="true" />
              Tier {index + 1}
            </div>
            <h3 className="text-base font-bold text-text flex items-center gap-1.5 leading-tight">
              <span aria-hidden="true">{milestone.emoji}</span>
              <span className="truncate">{milestone.title}</span>
            </h3>
            <p className={cn('mt-1 text-2xl font-extrabold tabular-nums tracking-tight', theme.text)}>
              {milestone.targetLabel}
              <span className="ml-1 text-[11px] font-medium text-text-muted align-middle">target</span>
            </p>
          </div>

          <CircularProgress pct={pct} theme={theme} unlocked={unlocked} />
        </div>

        {/* lock / unlock status pill */}
        <div
          className={cn(
            'inline-flex items-center gap-1.5 self-start text-[11px] font-semibold px-2.5 py-1 rounded-full border',
            unlocked ? theme.badge : 'bg-bg-elevated text-text-muted border-bg-border'
          )}
        >
          {unlocked ? <Unlock size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
          {unlocked ? 'Unlocked' : `${metCount}/${total} requirements met`}
        </div>

        {/* checklist */}
        <ul className="flex flex-col gap-2.5">
          {milestone.requirements.map((req) => (
            <RequirementRow key={req.label} req={req} theme={theme} />
          ))}
        </ul>

        {/* progress bar */}
        <div className="mt-auto pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Completion</span>
            <span className={cn('text-[11px] font-bold tabular-nums', theme.text)}>{pct}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-bg-elevated overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-labelledby={barId}
          >
            <motion.div
              className={cn('h-full rounded-full', theme.text, 'bg-current')}
              initial={reduce ? false : { width: 0 }}
              whileInView={{ width: `${pct}%` }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.15 }}
            />
          </div>
          <span id={barId} className="sr-only">{milestone.title} milestone completion</span>
        </div>

        {/* reward badge */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2 border',
            unlocked ? theme.badge : 'bg-bg-elevated/60 text-text-secondary border-bg-border'
          )}
        >
          <BadgeIcon size={16} className={unlocked ? '' : 'opacity-60'} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] text-text-muted leading-none mb-0.5">
              {unlocked ? 'Reward earned' : 'Reward'}
            </p>
            <p className="text-xs font-semibold truncate">{milestone.badgeLabel}</p>
          </div>
        </div>

        {milestone.footer && (
          <p className="text-[11px] text-text-muted leading-relaxed">{milestone.footer}</p>
        )}

        {milestone.cta && (
          <Link
            href={milestone.cta.href}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              theme.button
            )}
          >
            {milestone.cta.label}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>
    </motion.article>
  )
}

// ── "Your Progress" live stat card ───────────────────────────────────────────

function LiveStatCard({ emoji, label, value, icon: Icon, accent }: {
  emoji: string
  label: string
  value: string
  icon: LucideIcon
  accent: Accent
}) {
  const theme = THEMES[accent]
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-bg-border bg-bg-card/60 backdrop-blur-xl p-4"
    >
      <div className={cn('pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-40', theme.glow)} aria-hidden="true" />
      <div className="relative flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', theme.chip)}>
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-text tabular-nums leading-tight truncate">{value}</p>
          <p className="text-[11px] text-text-secondary flex items-center gap-1">
            <span aria-hidden="true">{emoji}</span> {label}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function EarningsMilestones({ stats, minWithdrawalInr }: {
  stats: MilestoneStats
  /** platform minimum withdrawal (REVENUE_CONFIG.minWithdrawalInr) — keeps the note in sync with the Withdraw modal */
  minWithdrawalInr: number
}) {
  const milestones = buildMilestones(stats)

  return (
    <section aria-labelledby="milestones-heading" className="space-y-6">
      {/* heading */}
      <div className="max-w-2xl">
        <h2 id="milestones-heading" className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2">
          <span aria-hidden="true">💰</span> Start Your Creator Journey
        </h2>
        <p className="text-sm text-text-secondary mt-1.5">
          Complete the required milestones to unlock monetization and reach higher earning tiers.
        </p>
      </div>

      {/* Your Progress — live stats */}
      <div>
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Your Progress</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <LiveStatCard emoji="👥" label="Subscribers" value={formatCount(stats.subscribers)} icon={Users} accent="purple" />
          <LiveStatCard emoji="👁" label="Views" value={formatCount(stats.views)} icon={Eye} accent="green" />
          <LiveStatCard emoji="💰" label="Earnings" value={inr(stats.earningsInr)} icon={IndianRupee} accent="gold" />
          <LiveStatCard emoji="📚" label="Published Chapters" value={stats.publishedChapters.toLocaleString('en-IN')} icon={BookOpen} accent="green" />
        </div>
      </div>

      {/* milestone grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {milestones.map((m, i) => (
          <MilestoneCard key={m.id} milestone={m} index={i} />
        ))}
      </div>

      {/* informational note */}
      <div className="flex items-start gap-3 rounded-2xl border border-bg-border bg-bg-card/60 backdrop-blur-xl p-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center flex-shrink-0">
          <IndianRupee size={16} aria-hidden="true" />
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          You earn from every validated view. You can withdraw once your available balance reaches the{' '}
          <span className="font-semibold text-text">{inr(minWithdrawalInr)}</span> minimum and you meet the platform
          requirements. Keep publishing quality content to reach the{' '}
          <span className="font-semibold text-text">{milestones[0].targetLabel}</span> Getting Started milestone and
          unlock higher creator tiers with additional rewards.
        </p>
      </div>
    </section>
  )
}
