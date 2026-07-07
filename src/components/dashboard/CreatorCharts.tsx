'use client'

// Creator analytics charts. Series colors are the same CVD-validated
// categorical set used by the admin dashboard for the #1A1A1A surface
// (validated with the dataviz palette checker): blue, aqua, amber, violet.
import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils/cn'
import { fmtInr } from '@/lib/revenue/config'
import type { AnalyticsDay, TopStory } from '@/types/analytics'

const SERIES_1 = '#3987e5' // blue — views
const SERIES_2 = '#199e70' // aqua — readers / revenue
const SERIES_4 = '#9085e9' // violet — subscribers

const GRID = '#2A2A2A'
const AXIS_INK = '#717171'

const tooltipStyle = {
  backgroundColor: '#212121',
  border: '1px solid #3F3F3F',
  borderRadius: '12px',
  color: '#FFFFFF',
  fontSize: 12,
}

const axisTick = { fontSize: 11, fill: AXIS_INK }

type Range = 'daily' | 'weekly' | 'monthly'

const RANGES: { id: Range; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

interface Bucket { label: string; views: number; readers: number; revenueInr: number }

/** Aggregate the daily series into the selected granularity. */
function bucketize(daily: AnalyticsDay[], range: Range): Bucket[] {
  if (range === 'daily') {
    return daily.slice(-14).map((d) => ({
      label: shortDate(d.date), views: d.views, readers: d.readers, revenueInr: d.revenueInr,
    }))
  }
  if (range === 'weekly') {
    const out: Bucket[] = []
    // 7-day buckets counted back from the most recent day
    for (let end = daily.length; end > 0 && out.length < 12; end -= 7) {
      const slice = daily.slice(Math.max(0, end - 7), end)
      out.unshift({
        label: shortDate(slice[0].date),
        views: slice.reduce((s, d) => s + d.views, 0),
        readers: slice.reduce((s, d) => s + d.readers, 0),
        revenueInr: slice.reduce((s, d) => s + d.revenueInr, 0),
      })
    }
    return out
  }
  const byMonth = new Map<string, Bucket>()
  daily.forEach((d) => {
    const key = d.date.slice(0, 7)
    const bucket = byMonth.get(key) ?? { label: monthLabel(d.date), views: 0, readers: 0, revenueInr: 0 }
    bucket.views += d.views
    bucket.readers += d.readers
    bucket.revenueInr += d.revenueInr
    byMonth.set(key, bucket)
  })
  return [...byMonth.values()]
}

function ChartCard({ title, subtitle, children, action }: {
  title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function CreatorCharts({ daily, topStories }: {
  daily: AnalyticsDay[]
  topStories: TopStory[]
}) {
  const [range, setRange] = useState<Range>('daily')
  const buckets = useMemo(() => bucketize(daily, range), [daily, range])
  const revenue14 = useMemo(() => bucketize(daily, 'daily'), [daily])
  const followers = useMemo(
    () => daily.slice(-30).map((d) => ({ label: shortDate(d.date), subscribers: d.cumulativeFollowers })),
    [daily],
  )
  const stories = useMemo(
    () => topStories.slice(0, 6).map((s) => ({
      ...s,
      label: s.title.length > 20 ? `${s.title.slice(0, 20)}…` : s.title,
    })),
    [topStories],
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Views — daily / weekly / monthly */}
      <div className="lg:col-span-2">
        <ChartCard
          title="Views"
          subtitle="Validated reader views and unique readers"
          action={
            <div role="group" aria-label="Chart time range" className="flex rounded-lg border border-bg-border overflow-hidden">
              {RANGES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id)}
                  {...(range === id ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    range === id ? 'bg-bg-elevated text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={buckets} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#3F3F3F' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#AAAAAA' }} />
              <Area type="monotone" dataKey="views" name="Views" stroke={SERIES_1} strokeWidth={2} fill={SERIES_1} fillOpacity={0.1} dot={false} activeDot={{ r: 4, stroke: '#1A1A1A', strokeWidth: 2 }} />
              <Area type="monotone" dataKey="readers" name="Unique readers" stroke={SERIES_2} strokeWidth={2} fill={SERIES_2} fillOpacity={0.1} dot={false} activeDot={{ r: 4, stroke: '#1A1A1A', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Subscriber growth */}
      <ChartCard title="Subscribers" subtitle="Follower growth — last 30 days">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={followers} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} domain={['dataMin', 'auto']} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#3F3F3F' }} />
            <Line type="monotone" dataKey="subscribers" name="Subscribers" stroke={SERIES_4} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#1A1A1A', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Revenue */}
      <div className="lg:col-span-2">
        <ChartCard title="Revenue" subtitle="Estimated creator earnings per day — last 14 days">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenue14} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: '#3F3F3F' }}
                formatter={(value) => [fmtInr(Number(value)), 'Earnings']}
              />
              <Area type="monotone" dataKey="revenueInr" name="Earnings" stroke={SERIES_2} strokeWidth={2} fill={SERIES_2} fillOpacity={0.1} dot={false} activeDot={{ r: 4, stroke: '#1A1A1A', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top performing stories */}
      <ChartCard title="Top stories" subtitle="All-time views per work">
        {stories.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stories} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...axisTick, fill: '#AAAAAA' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="views" name="Views" fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-text-muted">
            Publish your first story to see it here
          </div>
        )}
      </ChartCard>
    </div>
  )
}
