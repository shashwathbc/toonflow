'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Users, BookOpen, ImageIcon, MessageSquare, Flag,
  TrendingUp, Eye, Heart, Bookmark, Star, Loader2,
  AlertCircle, FileText,
} from 'lucide-react'
import { formatCount } from '@/lib/utils/formatters'
import StatCard from '@/components/admin/StatCard'
import {
  getPlatformStats, getRecentUsers, getRecentNovels, getRecentWebtoons,
  type PlatformStats,
} from '@/lib/firebase/admin'
import type { UserProfile, Novel, Webtoon } from '@/types'
import Image from 'next/image'
import Link from 'next/link'

const BusinessCharts = dynamic(() => import('@/components/admin/BusinessCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-bg-card border border-bg-border rounded-2xl p-5 h-64 animate-pulse" />
      ))}
    </div>
  ),
})

const AdminCharts = dynamic(() => import('@/components/admin/AdminCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-bg-card border border-bg-border rounded-2xl p-5 h-64 animate-pulse" />
      ))}
    </div>
  ),
})

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([])
  const [recentNovels, setRecentNovels] = useState<Novel[]>([])
  const [recentWebtoons, setRecentWebtoons] = useState<Webtoon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<import('@/components/admin/BusinessCharts').BusinessAnalytics | null>(null)

  // Business analytics — refreshed every 60s so "live users" stays current
  useEffect(() => {
    let cancelled = false
    const fetchAnalytics = () =>
      fetch('/api/admin/analytics')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && d) setAnalytics(d) })
        .catch(() => { /* analytics are non-critical; stat tiles show — */ })
    fetchAnalytics()
    const id = setInterval(fetchAnalytics, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    Promise.all([
      getPlatformStats(),
      getRecentUsers(8),
      getRecentNovels(5),
      getRecentWebtoons(5),
    ])
      .then(([s, u, n, w]) => { setStats(s); setRecentUsers(u); setRecentNovels(n); setRecentWebtoons(w) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 size={24} className="animate-spin text-text-muted" />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-danger bg-danger/10 border border-danger/20 rounded-xl p-4">
        <AlertCircle size={16} /> <span className="text-sm">{error}</span>
      </div>
    </div>
  )

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6 sm:space-y-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Star size={20} className="text-warning" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-secondary">Platform overview</p>
        </div>
      </div>

      {/* Stats Grid */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Platform statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            label="Total Users"
            value={formatCount(stats?.totalUsers)}
            icon={<Users size={16} />}
            color="accent"
          />
          <StatCard
            label="Total Novels"
            value={formatCount(stats?.totalNovels)}
            sub={`${formatCount(stats?.publishedNovels)} published · ${formatCount(stats?.draftNovels)} draft`}
            icon={<BookOpen size={16} />}
          />
          <StatCard
            label="Total Webtoons"
            value={formatCount(stats?.totalWebtoons)}
            sub={`${formatCount(stats?.publishedWebtoons)} published · ${formatCount(stats?.draftWebtoons)} draft`}
            icon={<ImageIcon size={16} />}
          />
          <StatCard
            label="Comments"
            value={formatCount(stats?.totalComments)}
            icon={<MessageSquare size={16} />}
          />
          <StatCard
            label="Pending Reports"
            value={formatCount(stats?.pendingReports)}
            sub={`${formatCount(stats?.totalReports)} total`}
            icon={<Flag size={16} />}
            color={stats?.pendingReports ? 'danger' : 'default'}
          />
        </div>
      </section>

      {/* Business analytics */}
      <section aria-labelledby="biz-heading">
        <h2 id="biz-heading" className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Business Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
          <StatCard
            label="Live Users (5 min)"
            value={analytics ? String(analytics.liveUsers) : '—'}
            sub="active readers right now"
            icon={<TrendingUp size={16} />}
            color="accent"
          />
          <StatCard
            label="Readers (14 days)"
            value={analytics ? formatCount(analytics.readers14d) : '—'}
            sub="unique visitors"
            icon={<Users size={16} />}
          />
          <StatCard
            label="Views (14 days)"
            value={analytics ? formatCount(analytics.views14d) : '—'}
            sub="validated reader views"
            icon={<Eye size={16} />}
          />
          <StatCard
            label="Avg Engagement"
            value={analytics ? `${analytics.avgEngagementSec}s` : '—'}
            sub="per view"
            icon={<Heart size={16} />}
          />
          <StatCard
            label="Avg Scroll Depth"
            value={analytics ? `${analytics.avgScrollPct}%` : '—'}
            sub="how far readers scroll"
            icon={<Bookmark size={16} />}
          />
        </div>
        {analytics && <BusinessCharts data={analytics} />}
      </section>

      {/* Charts */}
      <section aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Content Analytics</h2>
        <AdminCharts stats={stats!} novels={recentNovels} webtoons={recentWebtoons} />
      </section>

      {/* Recent Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Users */}
        <section aria-labelledby="recent-users-heading" className="xl:col-span-1 bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
            <h2 id="recent-users-heading" className="text-sm font-semibold text-text">New Users</h2>
            <Link href="/admin/super/users" className="text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded">
              View all
            </Link>
          </div>
          <ul>
            {recentUsers.map((u) => (
              <li key={u.uid} className="px-5 py-3 flex items-center gap-3 border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-bg-elevated flex-shrink-0 overflow-hidden">
                  {u.photoURL
                    ? <Image src={u.photoURL} alt={u.displayName} width={32} height={32} className="object-cover" />
                    : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted">{u.displayName?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{u.displayName}</p>
                  <p className="text-[11px] text-text-muted truncate">{u.email}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  u.role === 'superadmin' ? 'bg-warning/10 text-warning' :
                  u.role === 'admin' ? 'bg-accent/10 text-accent' :
                  'bg-bg-elevated text-text-muted'
                }`}>
                  {u.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent Novels */}
        <section aria-labelledby="recent-novels-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
            <h2 id="recent-novels-heading" className="text-sm font-semibold text-text">Recent Novels</h2>
            <Link href="/admin/super/novels" className="text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded">
              View all
            </Link>
          </div>
          <ul>
            {recentNovels.map((n) => (
              <li key={n.id} className="px-5 py-3 flex items-center gap-3 border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/50 transition-colors">
                <div className="w-8 h-10 rounded-lg bg-bg-elevated flex-shrink-0 overflow-hidden">
                  {n.coverURL
                    ? <Image src={n.coverURL} alt={n.title} width={32} height={40} className="object-cover w-full h-full" />
                    : <FileText size={14} className="m-auto mt-1.5 text-text-muted" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{n.title}</p>
                  <p className="text-[11px] text-text-muted truncate">{n.authorName}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Eye size={10} aria-hidden="true" />
                  {formatCount(n.viewCount)}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent Webtoons */}
        <section aria-labelledby="recent-webtoons-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
            <h2 id="recent-webtoons-heading" className="text-sm font-semibold text-text">Recent Webtoons</h2>
            <Link href="/admin/super/webtoons" className="text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded">
              View all
            </Link>
          </div>
          <ul>
            {recentWebtoons.map((w) => (
              <li key={w.id} className="px-5 py-3 flex items-center gap-3 border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/50 transition-colors">
                <div className="w-8 h-10 rounded-lg bg-bg-elevated flex-shrink-0 overflow-hidden">
                  {w.coverURL
                    ? <Image src={w.coverURL} alt={w.title} width={32} height={40} className="object-cover w-full h-full" />
                    : <ImageIcon size={14} className="m-auto mt-1.5 text-text-muted" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{w.title}</p>
                  <p className="text-[11px] text-text-muted truncate">{w.authorName}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Eye size={10} aria-hidden="true" />
                  {formatCount(w.viewCount)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
