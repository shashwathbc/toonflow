'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Eye, Users, TrendingUp, Timer, Percent,
  Repeat, BarChart3, BookOpen, RefreshCw,
} from 'lucide-react'
import AnimatedNumber, { type NumberFormatter } from '@/components/ui/AnimatedNumber'
import { formatCount } from '@/lib/utils/formatters'
import type { CreatorAnalytics } from '@/types/analytics'

// recharts is heavy — load the chart chunk lazily so the dashboard shell paints first
const CreatorCharts = dynamic(() => import('./CreatorCharts'), {
  ssr: false,
  loading: () => <div className="h-[480px] bg-bg-card border border-bg-border rounded-2xl animate-pulse" aria-hidden="true" />,
})

const compactFormat: NumberFormatter = (n) => formatCount(Math.round(n))

function StatTile({ label, value, format, suffix, icon: Icon, hint }: {
  label: string
  value: number
  format?: NumberFormatter
  suffix?: string
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>
  hint?: string
}) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mb-1.5">
        <Icon size={12} aria-hidden="true" /> {label}
      </p>
      <p className="text-xl font-bold text-text">
        <AnimatedNumber value={value} format={format} />
        {suffix && <span className="text-sm font-medium text-text-secondary ml-0.5">{suffix}</span>}
      </p>
      {hint && <p className="text-[10px] text-text-muted mt-1">{hint}</p>}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-[92px] bg-bg-card border border-bg-border rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-[280px] bg-bg-card border border-bg-border rounded-2xl animate-pulse" />
    </div>
  )
}

export default function CreatorAnalyticsSection() {
  const [data, setData] = useState<CreatorAnalytics | null>(null)
  const [error, setError] = useState(false)
  const [loadCount, setLoadCount] = useState(0)

  // Only async continuations set state here — no synchronous setState in the
  // effect body (react-hooks/set-state-in-effect). The retry button clears the
  // error flag from its event handler instead.
  const load = useCallback(() => {
    fetch('/api/creator/analytics')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<CreatorAnalytics>
      })
      .then(setData)
      .catch((err) => {
        console.error('[CreatorAnalytics] load failed:', err)
        setError(true)
      })
  }, [])

  useEffect(() => { load() }, [load, loadCount])

  if (error) {
    return (
      <section aria-labelledby="analytics-heading" className="bg-bg-card border border-bg-border rounded-2xl p-8 text-center">
        <h2 id="analytics-heading" className="text-sm font-semibold text-text mb-1">Analytics unavailable</h2>
        <p className="text-xs text-text-muted mb-4">We couldn&apos;t load your analytics. Please try again.</p>
        <button
          type="button"
          onClick={() => { setError(false); setLoadCount((c) => c + 1) }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
        >
          <RefreshCw size={12} aria-hidden="true" /> Retry
        </button>
      </section>
    )
  }

  if (!data) {
    return (
      <section aria-labelledby="analytics-heading" aria-busy="true">
        <h2 id="analytics-heading" className="sr-only">Creator analytics</h2>
        <SkeletonGrid />
      </section>
    )
  }

  const hasViews = data.lifetimeViews > 0

  return (
    <section aria-labelledby="analytics-heading" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 id="analytics-heading" className="text-sm font-semibold text-text flex items-center gap-2">
          <BarChart3 size={14} aria-hidden="true" /> Creator Analytics
        </h2>
      </div>

      {/* View + audience tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Today's views" value={data.todayViews} format={compactFormat} icon={Eye} />
        <StatTile label="This week" value={data.weekViews} format={compactFormat} icon={Eye} hint="Last 7 days" />
        <StatTile label="This month" value={data.monthViews} format={compactFormat} icon={Eye} hint="Last 30 days" />
        <StatTile label="Lifetime views" value={data.lifetimeViews} format={compactFormat} icon={TrendingUp} />
        <StatTile label="Subscribers" value={data.followerCount} format={compactFormat} icon={Users} />
        <StatTile label="Avg read time" value={data.avgReadTimeSec} suffix="s" icon={Timer} hint="Last 30 days" />
        <StatTile label="Completion rate" value={data.completionRatePct} suffix="%" icon={Percent} hint="Avg scroll depth" />
      </div>

      {/* Audience quality strip */}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <StatTile label="Unique readers (30d)" value={data.uniqueReaders30d} format={compactFormat} icon={Users} />
        <StatTile label="Returning readers" value={data.returningReaders30d} format={compactFormat} icon={Repeat} hint="Read on 2+ days" />
      </div>

      {hasViews ? (
        <>
          <CreatorCharts daily={data.daily} topStories={data.topStories} />

          {/* Top performing chapters */}
          {data.topChapters.length > 0 && (
            <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <h3 className="text-sm font-semibold text-text">Top chapters — last 90 days</h3>
              </div>
              <ol className="divide-y divide-bg-border/50">
                {data.topChapters.map((ch, i) => (
                  <li key={ch.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-6 text-xs font-bold text-text-muted tabular-nums" aria-hidden="true">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text truncate">{ch.title}</p>
                      <p className="text-[11px] text-text-muted truncate">{ch.parentTitle}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-text-secondary tabular-nums flex-shrink-0">
                      <Eye size={11} aria-hidden="true" /> {formatCount(ch.views)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <div className="bg-bg-card border border-bg-border rounded-2xl p-10 text-center">
          <BookOpen size={28} className="mx-auto mb-3 text-text-muted opacity-40" aria-hidden="true" />
          <p className="text-sm font-medium text-text">No reader activity yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Charts appear once readers start viewing your published chapters.
          </p>
        </div>
      )}
    </section>
  )
}
