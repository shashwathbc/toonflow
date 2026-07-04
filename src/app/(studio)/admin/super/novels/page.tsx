'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BookOpen, Search, ChevronDown, ChevronRight, Loader2, ExternalLink,
  Trash2, EyeOff, RotateCcw, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getAllNovels, adminDeleteNovel, adminSoftDeleteNovel, createAuditLog } from '@/lib/firebase/admin'
import { getChaptersByNovel, deleteChapter } from '@/lib/firebase/firestore'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { formatCount, formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { Novel, Chapter } from '@/types'

const STATUS_OPTIONS = ['all', 'draft', 'ongoing', 'completed', 'hiatus']

const STATUS_COLORS: Record<string, string> = {
  ongoing: 'bg-accent/10 text-accent',
  completed: 'bg-purple-500/10 text-purple-400',
  draft: 'bg-bg-elevated text-text-muted',
  hiatus: 'bg-warning/10 text-warning',
  published: 'bg-accent/10 text-accent',
}

type ConfirmType =
  | { type: 'delete' | 'softdelete' | 'restore'; novel: Novel }
  | { type: 'deleteChapter'; novel: Novel; chapter: Chapter }

export default function AdminNovelsPage() {
  const { firebaseUser } = useAuth()
  const [novels, setNovels] = useState<Novel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirm, setConfirm] = useState<ConfirmType | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [chaptersMap, setChaptersMap] = useState<Record<string, Chapter[]>>({})
  const [chaptersLoading, setChaptersLoading] = useState<string | null>(null)

  const toggleExpand = async (novel: Novel) => {
    if (expandedId === novel.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(novel.id)
    if (!chaptersMap[novel.id]) {
      setChaptersLoading(novel.id)
      try {
        const chapters = await getChaptersByNovel(novel.id)
        setChaptersMap((prev) => ({ ...prev, [novel.id]: chapters }))
      } catch (e: unknown) {
        toast.error((e as Error).message)
      } finally {
        setChaptersLoading(null)
      }
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllNovels({ status: statusFilter, search: search.trim() }, 100)
      setNovels(data)
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
      const { type, novel } = confirm
      if (type === 'deleteChapter') {
        const { chapter } = confirm
        await deleteChapter(novel.id, chapter.id)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'delete_chapter', resource: 'chapters', resourceId: chapter.id, details: `Deleted chapter ${chapter.chapterNumber} "${chapter.title}" from novel "${novel.title}"` })
        toast.success('Chapter deleted')
        setChaptersMap((prev) => ({
          ...prev,
          [novel.id]: (prev[novel.id] ?? []).filter((c) => c.id !== chapter.id),
        }))
        setNovels((prev) => prev.map((n) => n.id === novel.id ? { ...n, chapterCount: Math.max(0, (n.chapterCount ?? 1) - 1) } : n))
      } else if (type === 'delete') {
        await adminDeleteNovel(novel.id)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'delete_novel', resource: 'novels', resourceId: novel.id, details: `Permanently deleted: "${novel.title}"` })
        toast.success('Novel permanently deleted')
        setNovels((prev) => prev.filter((n) => n.id !== novel.id))
      } else if (type === 'softdelete') {
        await adminSoftDeleteNovel(novel.id, true)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'softdelete_novel', resource: 'novels', resourceId: novel.id, details: `Soft deleted: "${novel.title}"` })
        toast.success('Novel hidden from public')
        setNovels((prev) => prev.map((n) => n.id === novel.id ? { ...n, softDeleted: true } : n))
      } else if (type === 'restore') {
        await adminSoftDeleteNovel(novel.id, false)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'restore_novel', resource: 'novels', resourceId: novel.id, details: `Restored: "${novel.title}"` })
        toast.success('Novel restored')
        setNovels((prev) => prev.map((n) => n.id === novel.id ? { ...n, softDeleted: false } : n))
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
          <BookOpen size={18} aria-hidden="true" /> Novel Moderation
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">{novels.length} novels · global view</p>
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
            aria-label="Search novels"
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
        ) : novels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
            <BookOpen size={24} />
            <p className="text-sm">No novels found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]" role="table">
              <thead>
                <tr className="border-b border-bg-border bg-bg-elevated/50">
                  <th className="w-10 px-3 py-3" scope="col"><span className="sr-only">Expand</span></th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted" scope="col">Novel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Author</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Views</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Chapters</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Created</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-muted" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {novels.map((n) => {
                  const softDeleted = (n as Novel & { softDeleted?: boolean }).softDeleted
                  const isExpanded = expandedId === n.id
                  const chapters = chaptersMap[n.id]
                  return (
                    <React.Fragment key={n.id}>
                    <tr className={cn(
                      'border-b border-bg-border/50 last:border-0 transition-colors',
                      softDeleted ? 'opacity-50' : 'hover:bg-bg-elevated/30'
                    )}>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(n)}
                          aria-label={isExpanded ? `Collapse chapters of "${n.title}"` : `Show chapters of "${n.title}"`}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-10 rounded-lg bg-bg-elevated flex-shrink-0 overflow-hidden">
                            {n.coverURL
                              ? <Image src={n.coverURL} alt="" width={32} height={40} className="object-cover w-full h-full" />
                              : <FileText size={14} className="m-auto mt-1.5 text-text-muted" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text line-clamp-1">{n.title || 'Untitled'}</p>
                            {softDeleted && <span className="text-[10px] text-danger">hidden</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{n.authorName}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[n.status] ?? 'bg-bg-elevated text-text-muted')}>
                          {n.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{formatCount(n.viewCount)}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">{n.chapterCount ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {n.createdAt ? formatDate(n.createdAt) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Link
                            href={`/novel/${n.id}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                            aria-label={`Open novel "${n.title}"`}
                          >
                            <ExternalLink size={14} />
                          </Link>
                          {softDeleted ? (
                            <button
                              onClick={() => setConfirm({ type: 'restore', novel: n })}
                              className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                              aria-label={`Restore "${n.title}"`}
                              title="Restore novel"
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirm({ type: 'softdelete', novel: n })}
                              className="p-1.5 rounded-lg text-warning hover:bg-warning/10 transition-colors focus-visible:ring-2 focus-visible:ring-warning focus-visible:outline-none"
                              aria-label={`Hide "${n.title}" from public`}
                              title="Soft delete (hide)"
                            >
                              <EyeOff size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirm({ type: 'delete', novel: n })}
                            className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                            aria-label={`Permanently delete "${n.title}"`}
                            title="Permanently delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-bg-border/50 last:border-0 bg-bg-elevated/20">
                        <td colSpan={8} className="px-5 py-3">
                          {chaptersLoading === n.id ? (
                            <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading chapters…
                            </div>
                          ) : !chapters || chapters.length === 0 ? (
                            <p className="text-xs text-text-muted py-2">No chapters in this novel.</p>
                          ) : (
                            <table className="w-full" aria-label={`Chapters of "${n.title}"`}>
                              <thead>
                                <tr className="text-[11px] text-text-muted">
                                  <th className="text-left py-1.5 pr-4 font-medium w-12" scope="col">#</th>
                                  <th className="text-left py-1.5 pr-4 font-medium" scope="col">Chapter Title</th>
                                  <th className="text-left py-1.5 pr-4 font-medium" scope="col">Status</th>
                                  <th className="text-left py-1.5 pr-4 font-medium" scope="col">Created</th>
                                  <th className="text-right py-1.5 font-medium" scope="col">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chapters.map((c) => (
                                  <tr key={c.id} className="border-t border-bg-border/40">
                                    <td className="py-2 pr-4 text-xs text-text-muted tabular-nums">{c.chapterNumber}</td>
                                    <td className="py-2 pr-4 text-xs text-text">{c.title || 'Untitled chapter'}</td>
                                    <td className="py-2 pr-4">
                                      <span className={cn(
                                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                                        c.status === 'published' ? 'bg-accent/10 text-accent' : 'bg-bg-elevated text-text-muted'
                                      )}>
                                        {c.status ?? 'draft'}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-4 text-xs text-text-muted whitespace-nowrap">
                                      {c.createdAt ? formatDate(c.createdAt) : '—'}
                                    </td>
                                    <td className="py-2 text-right">
                                      <div className="flex items-center gap-1.5 justify-end">
                                        <Link
                                          href={`/novel/${n.id}/chapter/${c.id}`}
                                          target="_blank"
                                          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                                          aria-label={`Open chapter ${c.chapterNumber} "${c.title}"`}
                                        >
                                          <ExternalLink size={13} />
                                        </Link>
                                        <button
                                          type="button"
                                          onClick={() => setConfirm({ type: 'deleteChapter', novel: n, chapter: c })}
                                          className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                                          aria-label={`Delete chapter ${c.chapterNumber} "${c.title}"`}
                                          title="Delete chapter"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
          confirm?.type === 'deleteChapter' ? `Delete chapter ${confirm.chapter.chapterNumber} "${confirm.chapter.title}"?` :
          confirm?.type === 'delete' ? `Permanently delete "${confirm.novel.title}"?` :
          confirm?.type === 'softdelete' ? `Hide "${confirm?.novel.title}" from public?` :
          `Restore "${confirm?.novel.title}"?`
        }
        description={
          confirm?.type === 'deleteChapter'
            ? `This permanently deletes this single chapter from "${confirm.novel.title}". This action CANNOT be undone.`
            : confirm?.type === 'delete'
            ? 'This permanently deletes the novel and all its chapters. This action CANNOT be undone.'
            : confirm?.type === 'softdelete'
            ? 'The novel will be hidden from all public listings but its data is preserved. You can restore it later.'
            : 'The novel will be visible to readers again.'
        }
        confirmLabel={
          confirm?.type === 'deleteChapter' ? 'Delete Chapter' :
          confirm?.type === 'delete' ? 'Delete Forever' :
          confirm?.type === 'softdelete' ? 'Hide Novel' :
          'Restore'
        }
        danger={confirm?.type === 'delete' || confirm?.type === 'softdelete' || confirm?.type === 'deleteChapter'}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
