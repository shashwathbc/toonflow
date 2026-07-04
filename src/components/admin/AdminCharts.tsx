'use client'

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { PlatformStats } from '@/lib/firebase/admin'
import type { Novel, Webtoon } from '@/types'

const ACCENT = '#00C896'
const WARN = '#F59E0B'
const MUTED = '#4B5563'

interface Props {
  stats: PlatformStats
  novels: Novel[]
  webtoons: Webtoon[]
}

export default function AdminCharts({ stats, novels, webtoons }: Props) {
  // Content breakdown pie
  const contentPie = [
    { name: 'Published Novels', value: stats.publishedNovels },
    { name: 'Draft Novels', value: stats.draftNovels },
    { name: 'Published Webtoons', value: stats.publishedWebtoons },
    { name: 'Draft Webtoons', value: stats.draftWebtoons },
  ].filter((d) => d.value > 0)

  const PIE_COLORS = [ACCENT, MUTED, WARN, '#6366F1']

  // Content over time (using novel/webtoon mock buckets if data is sparse)
  const contentBar = [
    { name: 'Novels', total: stats.totalNovels, published: stats.publishedNovels, draft: stats.draftNovels },
    { name: 'Webtoons', total: stats.totalWebtoons, published: stats.publishedWebtoons, draft: stats.draftWebtoons },
  ]

  // Top genres from novels
  const genreMap: Record<string, number> = {}
  novels.forEach((n) => n.genres?.forEach((g) => { genreMap[g] = (genreMap[g] ?? 0) + 1 }))
  webtoons.forEach((w) => w.genres?.forEach((g) => { genreMap[g] = (genreMap[g] ?? 0) + 1 }))
  const genreData = Object.entries(genreMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const tooltipStyle = {
    backgroundColor: '#1A1A2E',
    border: '1px solid #2D2D44',
    borderRadius: '12px',
    color: '#E2E8F0',
    fontSize: 12,
  }

  const axisStyle = { fontSize: 11, fill: '#6B7280' }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Content Breakdown Bar */}
      <div className="lg:col-span-2 bg-bg-card border border-bg-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Content Overview</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={contentBar} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="published" name="Published" fill={ACCENT} radius={[4, 4, 0, 0]} />
            <Bar dataKey="draft" name="Draft" fill={MUTED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Content Pie */}
      <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Distribution</h3>
        {contentPie.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={contentPie}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {contentPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9CA3AF' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-sm text-text-muted">No data yet</div>
        )}
      </div>

      {/* Top Genres */}
      {genreData.length > 0 && (
        <div className="lg:col-span-3 bg-bg-card border border-bg-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Top Genres</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={genreData} layout="vertical" margin={{ top: 0, right: 8, left: 56, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={axisStyle} axisLine={false} tickLine={false} width={56} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Works" fill={ACCENT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
