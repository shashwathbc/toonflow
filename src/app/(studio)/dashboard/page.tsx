'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BookOpen, ImageIcon, Eye, Heart, Plus, Loader2, TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getNovelsByAuthor, getWebtoonsByAuthor } from '@/lib/firebase/firestore'
import CreatorAnalyticsSection from '@/components/dashboard/CreatorAnalyticsSection'
import { formatCount } from '@/lib/utils/formatters'
import { canUseWebtoonStudio } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import type { Novel, Webtoon } from '@/types'

function CoverThumb({ coverURL, type }: { coverURL: string | null; type: 'novel' | 'webtoon' }) {
  const [failed, setFailed] = useState(false)
  if (!coverURL || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        {type === 'novel' ? <BookOpen size={12} /> : <ImageIcon size={12} />}
      </div>
    )
  }
  return (
    <Image
      src={coverURL}
      alt=""
      width={32}
      height={40}
      className="object-cover w-full h-full"
      onError={() => setFailed(true)}
    />
  )
}

function ContentRow({ item, type }: {
  item: Novel | Webtoon; type: 'novel' | 'webtoon'
}) {
  const href = type === 'novel' ? `/create/novel/${item.id}` : `/create/webtoon/${item.id}`
  return (
    <tr className="border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-10 rounded-lg bg-bg-elevated flex-shrink-0 overflow-hidden">
            <CoverThumb coverURL={item.coverURL} type={type} />
          </div>
          <div className="min-w-0">
            <Link href={href} className="text-sm font-medium text-text hover:text-accent transition-colors line-clamp-1">
              {item.title || 'Untitled'}
            </Link>
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              item.status === 'draft' ? 'bg-bg-elevated text-text-muted' :
              item.status === 'ongoing' ? 'bg-accent/10 text-accent' :
              'bg-purple-500/10 text-purple-400'
            )}>{item.status}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary text-right tabular-nums">
        <div className="flex items-center justify-end gap-1">
          <Eye size={11} aria-hidden="true" />
          {formatCount(item.viewCount ?? 0)}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted text-right">
        <div className="flex items-center justify-end gap-1">
          <Heart size={11} aria-hidden="true" />
          {formatCount(item.likeCount ?? 0)}
        </div>
      </td>
    </tr>
  )
}

export default function DashboardPage() {
  const { firebaseUser, userProfile, loading: authLoading } = useAuth()
  const canUseWebtoon = canUseWebtoonStudio(firebaseUser?.email)
  const [novels, setNovels] = useState<Novel[]>([])
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  // loading derives from "has the current user's data been loaded" so the load
  // effect never calls setState synchronously (react-hooks/set-state-in-effect)
  const [loadedUid, setLoadedUid] = useState<string | null>(null)
  const loading = !firebaseUser || loadedUid !== firebaseUser.uid

  const load = useCallback(() => {
    if (!firebaseUser) return
    const uid = firebaseUser.uid
    Promise.all([
      getNovelsByAuthor(uid),
      getWebtoonsByAuthor(uid),
    ])
      .then(([n, w]) => {
        setNovels(n)
        setWebtoons(w)
      })
      .catch((e) => console.error(e))
      .finally(() => setLoadedUid(uid))
  }, [firebaseUser])

  useEffect(() => {
    if (!authLoading && firebaseUser) load()
  }, [authLoading, firebaseUser, load])

  const allContent = [
    ...novels.map((n) => ({ item: n as Novel | Webtoon, type: 'novel' as const })),
    ...webtoons.map((w) => ({ item: w as Novel | Webtoon, type: 'webtoon' as const })),
  ].sort((a, b) => (b.item.viewCount ?? 0) - (a.item.viewCount ?? 0))

  const totalViews = allContent.reduce((s, { item }) => s + (item.viewCount ?? 0), 0)

  if (authLoading || loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  )

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6 sm:space-y-7 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bg-elevated overflow-hidden flex-shrink-0 border border-bg-border">
            {userProfile?.photoURL
              ? <Image src={userProfile.photoURL} alt="" width={40} height={40} className="object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-sm font-bold text-text-muted">
                  {userProfile?.displayName?.[0]?.toUpperCase() ?? '?'}
                </span>
            }
          </div>
          <div>
            <h1 className="text-lg font-bold text-text">
              {userProfile?.displayName ?? 'Creator'}&apos;s Dashboard
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/create/novel" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-bg-elevated text-text hover:bg-bg-card border border-bg-border transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
            <Plus size={14} aria-hidden="true" /> Novel
          </Link>
          {canUseWebtoon && (
            <Link href="/create/webtoon" className="btn-accent flex items-center gap-1.5 text-sm">
              <Plus size={14} aria-hidden="true" /> Webtoon
            </Link>
          )}
        </div>
      </div>

      {/* Creator analytics — views, readers and subscribers */}
      <div data-tour="dashboard-analytics">
        <CreatorAnalyticsSection />
      </div>

      {/* Content Performance */}
      <section aria-labelledby="performance-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
          <h2 id="performance-heading" className="text-sm font-semibold text-text flex items-center gap-2">
            <TrendingUp size={14} aria-hidden="true" /> Content Performance
          </h2>
          <span className="text-xs text-text-muted">{allContent.length} works</span>
        </div>

        {allContent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-text-muted gap-2">
            <BookOpen size={22} />
            <p className="text-sm">No content yet</p>
            <div className="flex gap-3 mt-1">
              <Link href="/create/novel" className="text-xs text-accent hover:underline">Write a novel →</Link>
              {canUseWebtoon && <Link href="/create/webtoon" className="text-xs text-accent hover:underline">Create a webtoon →</Link>}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]" role="table">
              <thead>
                <tr className="border-b border-bg-border bg-bg-elevated/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Title</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Views</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Likes</th>
                </tr>
              </thead>
              <tbody>
                {allContent.map(({ item, type }) => (
                  <ContentRow
                    key={item.id}
                    item={item}
                    type={type}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-bg-border bg-bg-elevated/30">
                  <td className="px-4 py-2.5 text-xs font-semibold text-text-secondary" colSpan={1}>Total</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-text text-right tabular-nums">{formatCount(totalViews)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
