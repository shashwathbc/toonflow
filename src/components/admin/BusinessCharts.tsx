'use client'

// Business analytics charts for the super admin dashboard.
// Series colors are a CVD-validated categorical set for the #1A1A1A surface
// (validated with the dataviz palette checker): blue, aqua, amber, violet.
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const SERIES_1 = '#3987e5' // blue
const SERIES_2 = '#199e70' // aqua
const SERIES_3 = '#c98500' // amber
const SERIES_4 = '#9085e9' // violet

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

export interface BusinessAnalytics {
  liveUsers: number
  readers14d: number
  views14d: number
  avgEngagementSec: number
  avgScrollPct: number
  authViews: number
  anonViews: number
  traffic: { date: string; views: number; readers: number }[]
  signups: { date: string; users: number }[]
  topContent: { title: string; type: 'novel' | 'webtoon'; views: number }[]
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function BusinessCharts({ data }: { data: BusinessAnalytics }) {
  const traffic = data.traffic.map((t) => ({ ...t, label: shortDate(t.date) }))
  const signups = data.signups.map((s) => ({ ...s, label: shortDate(s.date) }))
  const audience = [
    { name: 'Signed-in views', value: data.authViews },
    { name: 'Anonymous views', value: data.anonViews },
  ].filter((d) => d.value > 0)
  const topContent = data.topContent.map((c) => ({
    ...c,
    label: c.title.length > 22 ? `${c.title.slice(0, 22)}…` : c.title,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Traffic — daily views & unique readers */}
      <div className="lg:col-span-2 bg-bg-card border border-bg-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text mb-1">Traffic — last 14 days</h3>
        <p className="text-[11px] text-text-muted mb-4">Validated reader views per day and unique readers</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={traffic} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#3F3F3F' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#AAAAAA' }} />
            <Area type="monotone" dataKey="views" name="Views" stroke={SERIES_1} strokeWidth={2} fill={SERIES_1} fillOpacity={0.12} dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="readers" name="Unique readers" stroke={SERIES_2} strokeWidth={2} fill={SERIES_2} fillOpacity={0.12} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Audience split donut */}
      <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text mb-1">Audience</h3>
        <p className="text-[11px] text-text-muted mb-4">Signed-in vs anonymous views (14 days)</p>
        {audience.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={audience} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value" stroke="#1A1A1A" strokeWidth={2}>
                <Cell fill={SERIES_1} />
                <Cell fill={SERIES_2} />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#AAAAAA' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-text-muted">No views yet</div>
        )}
      </div>

      {/* Signups per day */}
      <div className="lg:col-span-2 bg-bg-card border border-bg-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text mb-1">New signups — last 14 days</h3>
        <p className="text-[11px] text-text-muted mb-4">Accounts created per day</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={signups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="users" name="Signups" fill={SERIES_3} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top content by all-time views */}
      <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text mb-1">Top content</h3>
        <p className="text-[11px] text-text-muted mb-4">All-time views · novels &amp; webtoons</p>
        {topContent.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topContent} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ ...axisTick, fill: '#AAAAAA' }} axisLine={false} tickLine={false} width={130} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="views" name="Views" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {topContent.map((c, i) => (
                  <Cell key={i} fill={c.type === 'novel' ? SERIES_1 : SERIES_4} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 flex items-center justify-center text-sm text-text-muted">No content yet</div>
        )}
        <div className="flex items-center gap-4 mt-2 text-[11px] text-text-secondary" aria-hidden="true">
          {/* swatch classes must stay in sync with SERIES_1 / SERIES_4 above */}
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#3987e5]" /> Novel</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#9085e9]" /> Webtoon</span>
        </div>
      </div>
    </div>
  )
}
