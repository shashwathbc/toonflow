'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ImageIcon, Search, ChevronDown, Loader2, ExternalLink,
  Trash2, EyeOff, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getAllWebtoons, adminDeleteWebtoon, adminSoftDeleteNovel, createAuditLog } from '@/lib/firebase/admin'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { formatCount, formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { Webtoon } from '@/types'

const STATUS_OPTIONS = ['all', 'draft', 'ongoing', 'completed', 'hiatus']
const STATUS_COLORS: Record<string, string> = {
  ongoing: 'bg-accent/10 text-accent',
  completed: 'bg-purple-500/10 text-purple-400',
  draft: 'bg-bg-elevated text-text-muted',
  hiatus: 'bg-warning/10 text-warning',
}
type ConfirmType = { type: 'delete' | 'softdelete' | 'restore'; webtoon: Webtoon }

export default function AdminWebtoonsPage() {
  const { firebaseUser } = useAuth()
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirm, setConfirm] = useState<ConfirmType | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllWebtoons({ status: statusFilter, search: search.trim() }, 100)
      setWebtoons(data)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const id = setTimeout(load, 300)
    return () => clearTimeout(id)
  }, [load])

  const handleConfirm = async () => {
    if (!confirm || !firebaseUser) return
    setActionLoading(true)
    try {
      const { type, webtoon } = confirm
      if (type === 'delete') {
        await adminDeleteWebtoon(webtoon.id)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'delete_webtoon', resource: 'webtoons', resourceId: webtoon.id, details: `Permanently deleted: "${webtoon.title}"` })
        toast.success('Webtoon permanently deleted')
        setWebtoons((prev) => prev.filter((w) => w.id !== webtoon.id))
      } else if (type === 'softdelete') {
        await adminSoftDeleteNovel(webtoon.id, true)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'softdelete_webtoon', resource: 'webtoons', resourceId: webtoon.id, details: `Soft deleted: "${webtoon.title}"` })
        toast.success('Webtoon hidden from public')
        setWebtoons((prev) => prev.map((w) => w.id === webtoon.id ? { ...w, softDeleted: true } : w))
      } else if (type === 'restore') {
        await adminSoftDeleteNovel(webtoon.id, false)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'restore_webtoon', resource: 'webtoons', resourceId: webtoon.id, details: `Restored: "${webtoon.title}"` })
        toast.success('Webtoon restored')
        setWebtoons((prev) => prev.map((w) => w.id === webtoon.id ? { ...w, softDeleted: false } : w))
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ImageIcon size={18} aria-hidden="true" /> Webtoon Moderation
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">{webtoons.length} webtoons · global view</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by title or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Search webtoons"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      </div>

      <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : webtoons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
            <ImageIcon size={24} />
            <p className="text-sm">No webtoons found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]" role="table">
              <thead>
                <tr className="border-b border-bg-border bg-bg-elevated/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted" scope="col">Webtoon</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Author</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Views</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Episodes</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Created</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-muted" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webtoons.map((w) => {
                  const softDeleted = (w as Webtoon & { softDeleted?: boolean }).softDeleted
                  return (
                    <tr key={w.id} className={cn(
                      'border-b border-bg-border/50 last:border-0 transition-colors',
                      softDeleted ? 'opacity-50' : 'hover:bg-bg-elevated/30'
                    )}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-10 rounded-lg bg-bg-elevated flex-shrink-0 overflow-hidden">
                            {w.coverURL
                              ? <Image src={w.coverURL} alt="" width={32} height={40} className="object-cover w-full h-full" />
                              : <ImageIcon size={14} className="m-auto mt-1.5 text-text-muted" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text line-clamp-1">{w.title || 'Untitled'}</p>
                            {softDeleted && <span className="text-[10px] text-danger">hidden</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{w.authorName}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[w.status] ?? 'bg-bg-elevated text-text-muted')}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{formatCount(w.viewCount)}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">{w.episodeCount ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {w.createdAt ? formatDate(w.createdAt) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Link
                            href={`/webtoon/${w.id}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                            aria-label={`Open "${w.title}"`}
                          >
                            <ExternalLink size={14} />
                          </Link>
                          {softDeleted ? (
                            <button
                              onClick={() => setConfirm({ type: 'restore', webtoon: w })}
                              className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                              aria-label={`Restore "${w.title}"`}
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirm({ type: 'softdelete', webtoon: w })}
                              className="p-1.5 rounded-lg text-warning hover:bg-warning/10 transition-colors focus-visible:ring-2 focus-visible:ring-warning focus-visible:outline-none"
                              aria-label={`Hide "${w.title}"`}
                            >
                              <EyeOff size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirm({ type: 'delete', webtoon: w })}
                            className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                            aria-label={`Delete "${w.title}" permanently`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'delete' ? `Permanently delete "${confirm.webtoon.title}"?` :
          confirm?.type === 'softdelete' ? `Hide "${confirm?.webtoon.title}"?` :
          `Restore "${confirm?.webtoon.title}"?`
        }
        description={
          confirm?.type === 'delete'
            ? 'This permanently deletes the webtoon and all episodes. Cannot be undone.'
            : confirm?.type === 'softdelete'
            ? 'The webtoon will be hidden from all public listings. Data is preserved and can be restored.'
            : 'The webtoon will be visible to readers again.'
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete Forever' : confirm?.type === 'softdelete' ? 'Hide Webtoon' : 'Restore'}
        danger={confirm?.type === 'delete' || confirm?.type === 'softdelete'}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
