'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { useNovels } from '@/hooks/useNovels'
import {
  deleteNovel,
  publishNovel,
  unpublishNovel,
} from '@/lib/firebase/firestore'
import dynamic from 'next/dynamic'

const CreateNovelModal = dynamic(
  () => import('@/components/novel/CreateNovelModal').then((m) => ({ default: m.CreateNovelModal })),
  { ssr: false }
)
import {
  Plus,
  Search,
  BookOpen,
  Eye,
  Layers,
  MoreVertical,
  Edit3,
  Trash2,
  Globe,
  EyeOff,
  ArrowLeft,
  SortAsc,
  Filter,
  ChevronDown,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import type { Novel } from '@/types'

type FilterStatus = 'all' | 'draft' | 'published' | 'ongoing' | 'completed' | 'hiatus'
type SortOrder = 'updated' | 'views' | 'alpha' | 'chapters'

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
]

const SORT_OPTIONS: { label: string; value: SortOrder }[] = [
  { label: 'Last Updated', value: 'updated' },
  { label: 'Most Viewed', value: 'views' },
  { label: 'Alphabetical', value: 'alpha' },
  { label: 'Most Chapters', value: 'chapters' },
]

function statusBadge(status: Novel['status']) {
  const map: Record<string, string> = {
    draft: 'bg-white/10 text-white/60 border border-white/10',
    published: 'bg-white text-bg font-semibold',
    ongoing: 'bg-white/15 text-white border border-white/20',
    completed: 'bg-white/15 text-white border border-white/20',
    hiatus: 'bg-warning/15 text-warning border border-warning/20',
  }
  return map[status] ?? 'bg-white/10 text-white/60'
}

function formatRelative(ts: Novel['updatedAt'] | null | undefined): string {
  if (!ts) return '—'
  const seconds = typeof ts === 'object' && 'seconds' in ts ? (ts as { seconds: number }).seconds : 0
  if (!seconds) return '—'
  return formatDistanceToNow(new Date(seconds * 1000), { addSuffix: true })
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function NovelCardSkeleton() {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[2/3] bg-bg-elevated" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-bg-elevated rounded w-3/4" />
        <div className="h-3 bg-bg-elevated rounded w-1/2" />
        <div className="h-3 bg-bg-elevated rounded w-2/3" />
      </div>
    </div>
  )
}

interface NovelCardProps {
  novel: Novel
  onOpen: (id: string) => void
  onEdit: (novel: Novel) => void
  onDelete: (id: string, title: string) => void
  onPublish: (id: string) => void
  onUnpublish: (id: string) => void
}

function NovelCard({ novel, onOpen, onEdit, onDelete, onPublish, onUnpublish }: NovelCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPublished = novel.status !== 'draft'

  return (
    <article
      className="group bg-bg-card border border-bg-border rounded-xl overflow-hidden hover:border-white/20 transition-all duration-200 cursor-pointer relative"
      onClick={() => onOpen(novel.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(novel.id)}
      tabIndex={0}
      role="article"
      aria-label={`Novel: ${novel.title || 'Untitled'}`}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        {novel.coverURL ? (
        <Image
            src={novel.coverURL}
          alt={novel.title || 'Novel cover'}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <BookOpen size={32} className="text-white/20" aria-hidden="true" />
            <span className="text-xs text-white/30 font-medium">No Cover</span>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${statusBadge(novel.status)}`}>
            {novel.status}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(novel.id) }}
            className="btn-accent text-xs px-3 py-1.5"
            aria-label={`Open ${novel.title}`}
          >
            <Edit3 size={12} aria-hidden="true" />
            Open Editor
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-white line-clamp-2 leading-tight mb-1">
          {novel.title || <span className="text-white/40 italic">Untitled Novel</span>}
        </h3>

        {novel.genres?.length > 0 && (
          <p className="text-[11px] text-white/50 mb-2 truncate">
            {novel.genres.slice(0, 2).join(' · ')}
          </p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-white/50 mb-2">
          <span className="flex items-center gap-1">
            <Layers size={10} aria-hidden="true" />
            {novel.chapterCount}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={10} aria-hidden="true" />
            {formatCount(novel.viewCount)}
          </span>
        </div>

        <p className="text-[10px] text-white/35">
          {formatRelative(novel.updatedAt)}
        </p>
      </div>

      {/* Action menu */}
      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Novel actions"
            aria-haspopup="menu"
            {...(menuOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
          >
            <MoreVertical size={14} className="text-white" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 top-8 w-44 bg-bg-elevated border border-bg-border rounded-xl shadow-2xl z-20 overflow-hidden animate-scale-in"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onOpen(novel.id) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Edit3 size={13} aria-hidden="true" /> Open Editor
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onEdit(novel) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Filter size={13} aria-hidden="true" /> Edit Details
                </button>
                {isPublished ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onUnpublish(novel.id) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <EyeOff size={13} aria-hidden="true" /> Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onPublish(novel.id) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <Globe size={13} aria-hidden="true" /> Publish
                  </button>
                )}
                <div className="h-px bg-bg-border mx-2" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onDelete(novel.id, novel.title) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                >
                  <Trash2 size={13} aria-hidden="true" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

interface DeleteConfirmProps {
  title: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteConfirmDialog({ title, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus the cancel button on open (safe default focus)
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loading, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6 max-w-sm w-full animate-scale-in">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-danger" aria-hidden="true" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="font-semibold text-white text-base">
              Delete Novel
            </h2>
            <p id="delete-dialog-desc" className="text-sm text-white/60 mt-1">
              &ldquo;{title || 'Untitled'}&rdquo; and all its chapters will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="btn-ghost text-sm px-3 py-2"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-danger text-sm px-3 py-2"
            disabled={loading}
            aria-label="Confirm delete"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NovelDashboardPage() {
  const { firebaseUser, loading: authLoading } = useAuth()
  const { novels, loading: novelsLoading } = useNovels(firebaseUser?.uid ?? '')
  const router = useRouter()

  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortOrder>('updated')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editNovel, setEditNovel] = useState<Novel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  // Close sort dropdown on Escape
  useEffect(() => {
    if (!sortOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSortOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sortOpen])

  const filtered = useMemo(() => {
    let result = [...novels]
    if (filter !== 'all') result = result.filter((n) => n.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.synopsis?.toLowerCase().includes(q) ||
          n.genres?.some((g) => g.toLowerCase().includes(q))
      )
    }
    switch (sort) {
      case 'views':
        return result.sort((a, b) => b.viewCount - a.viewCount)
      case 'alpha':
        return result.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
      case 'chapters':
        return result.sort((a, b) => b.chapterCount - a.chapterCount)
      default:
        return result
    }
  }, [novels, filter, sort, search])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteNovel(deleteTarget.id)
      toast.success('Novel deleted')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete novel')
    } finally {
      setDeleting(false)
    }
  }

  async function handlePublish(id: string) {
    const novel = novels.find((n) => n.id === id)
    if (!novel) return
    if (!novel.coverURL) {
      toast.error('Add a cover image before publishing')
      return
    }
    if (!novel.synopsis?.trim()) {
      toast.error('Add a description before publishing')
      return
    }
    if (novel.chapterCount < 1) {
      toast.error('Add at least one chapter before publishing')
      return
    }
    const loadingToast = toast.loading('Publishing…')
    try {
      await publishNovel(id)
      toast.success('Novel published!', { id: loadingToast })
    } catch {
      toast.error('Failed to publish', { id: loadingToast })
    }
  }

  async function handleUnpublish(id: string) {
    const loadingToast = toast.loading('Unpublishing…')
    try {
      await unpublishNovel(id)
      toast.success('Novel unpublished', { id: loadingToast })
    } catch {
      toast.error('Failed to unpublish', { id: loadingToast })
    }
  }

  const isLoading = authLoading || novelsLoading

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort'

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-bg-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/create"
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white rounded"
              aria-label="Back to Creator Hub"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Creator Hub</span>
            </Link>
            <span className="text-bg-border" aria-hidden="true">/</span>
            <h1 className="text-sm font-semibold text-white">Novel Studio</h1>
          </div>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-accent text-xs px-3 py-1.5"
            aria-label="Create new novel"
          >
            <Plus size={14} aria-hidden="true" />
            New Novel
          </button>
        </div>
      </header>

      <main id="main-content" className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6" tabIndex={-1}>
        {/* Stats bar */}
        {!isLoading && novels.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Novels', value: novels.length },
              {
                label: 'Published',
                value: novels.filter((n) => n.status !== 'draft').length,
              },
              {
                label: 'Total Chapters',
                value: novels.reduce((s, n) => s + n.chapterCount, 0),
              },
              {
                label: 'Total Views',
                value: formatCount(novels.reduce((s, n) => s + n.viewCount, 0)),
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-bg-card border border-bg-border rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search novels…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-8 text-sm"
              aria-label="Search novels"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="btn-ghost gap-2 text-sm border border-bg-border"
              aria-haspopup="listbox"
              {...(sortOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
              aria-label={`Sort by: ${sortLabel}`}
            >
              <SortAsc size={14} aria-hidden="true" />
              {sortLabel}
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} aria-hidden="true" />
                <div role="listbox" aria-label="Sort order options" className="absolute right-0 top-10 w-44 bg-bg-elevated border border-bg-border rounded-xl shadow-2xl z-20 overflow-hidden animate-scale-in">
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = sort === opt.value
                    return isSelected ? (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected="true"
                        onClick={() => { setSort(opt.value); setSortOpen(false) }}
                        className="w-full text-left px-3 py-2.5 text-sm transition-colors text-white bg-white/10 font-medium"
                      >
                        {opt.label}
                      </button>
                    ) : (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => { setSort(opt.value); setSortOpen(false) }}
                        className="w-full text-left px-3 py-2.5 text-sm transition-colors text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div
          role="tablist"
          aria-label="Filter by status"
          className="flex items-center gap-0.5 mb-6 border-b border-bg-border overflow-x-auto scrollbar-none pb-px"
        >
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'all'
              ? novels.length
              : novels.filter((n) => n.status === f.value).length
            const isSelected = filter === f.value
            return isSelected ? (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected="true"
                onClick={() => setFilter(f.value)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white rounded-t border-white text-white"
              >
                {f.label}
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-bg">
                    {count}
                  </span>
                )}
              </button>
            ) : (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected="false"
                onClick={() => setFilter(f.value)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white rounded-t border-transparent text-white/50 hover:text-white/80"
              >
                {f.label}
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <NovelCardSkeleton key={i} />
            ))}
          </div>
        ) : novels.length === 0 ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center py-24 text-center"
            role="status"
          >
            <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center mb-5">
              <BookOpen size={32} className="text-white/20" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No novels yet</h2>
            <p className="text-sm text-white/50 max-w-xs mb-6">
              Start your writing journey. Create your first novel and build your audience on Toonflow.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => setShowCreate(true)} className="btn-accent">
                <Plus size={15} aria-hidden="true" />
                Create your first novel
              </button>
              <Link href="/create/seed" className="btn-ghost border border-bg-border text-sm flex items-center justify-center gap-2">
                <Sparkles size={14} aria-hidden="true" />
                Seed Ravana Demo
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* No results */
          <div className="flex flex-col items-center justify-center py-24 text-center" role="status">
            <Search size={32} className="text-white/20 mb-4" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white mb-2">No results found</h2>
            <p className="text-sm text-white/50">
              Try adjusting your search or filter.
            </p>
          </div>
        ) : (
          /* Grid */
          <div
            role="tabpanel"
            aria-label={`${filter === 'all' ? 'All' : filter} novels`}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
          >
            {filtered.map((novel) => (
              <NovelCard
                key={novel.id}
                novel={novel}
                onOpen={(id) => router.push(`/create/novel/${id}`)}
                onEdit={setEditNovel}
                onDelete={(id, title) => setDeleteTarget({ id, title })}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreate && (
        <CreateNovelModal
          authorId={firebaseUser?.uid ?? ''}
          authorName={firebaseUser?.displayName ?? 'Anonymous'}
          authorPhotoURL={firebaseUser?.photoURL ?? null}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            router.push(`/create/novel/${id}`)
          }}
        />
      )}

      {editNovel && (
        <CreateNovelModal
          authorId={firebaseUser?.uid ?? ''}
          authorName={firebaseUser?.displayName ?? 'Anonymous'}
          authorPhotoURL={firebaseUser?.photoURL ?? null}
          editNovel={editNovel}
          onClose={() => setEditNovel(null)}
          onCreated={() => setEditNovel(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          title={deleteTarget.title}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
