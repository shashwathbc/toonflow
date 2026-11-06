'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { useWebtoons } from '@/hooks/useWebtoons'
import {
  deleteWebtoon,
  publishWebtoon,
  unpublishWebtoon,
} from '@/lib/firebase/firestore'
import dynamic from 'next/dynamic'

const CreateWebtoonModal = dynamic(
  () => import('@/components/webtoon/CreateWebtoonModal').then((m) => ({ default: m.CreateWebtoonModal })),
  { ssr: false }
)
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  Filter,
  FolderOpen,
  Globe,
  ImageIcon,
  Layers,
  Library,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  SortAsc,
  Sparkles,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Webtoon } from '@/types'
import { formatCount, formatRelativeTimestamp } from '@/lib/utils/formatters'
import { Tooltip } from '@/components/ui/Tooltip'

type FilterStatus = 'all' | 'draft' | 'live' | 'ongoing' | 'completed' | 'hiatus'
type SortOrder = 'updated' | 'views' | 'alpha' | 'episodes'

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Live', value: 'live' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
]

const SORT_OPTIONS: { label: string; value: SortOrder }[] = [
  { label: 'Last Updated', value: 'updated' },
  { label: 'Most Viewed', value: 'views' },
  { label: 'Alphabetical', value: 'alpha' },
  { label: 'Most Episodes', value: 'episodes' },
]

function statusBadge(status: Webtoon['status']) {
  const map: Record<string, string> = {
    draft: 'border-bg-border bg-bg-elevated text-text-secondary',
    published: 'border-studio-webtoon/25 bg-studio-webtoon/10 text-studio-webtoon',
    ongoing: 'border-studio-webtoon/25 bg-studio-webtoon/10 text-studio-webtoon',
    completed: 'border-success/25 bg-success/10 text-success',
    hiatus: 'border-warning/25 bg-warning/10 text-warning',
  }
  return map[status] ?? 'border-bg-border bg-bg-elevated text-text-secondary'
}

/**
 * One entry point on the landing card — same shape and behaviour as the tiles in
 * Anime, Art and Novel Studio, tinted `studio-webtoon`.
 */
function ActionTile({
  href,
  onClick,
  icon,
  title,
  subtitle,
  primary,
}: {
  href?: string
  onClick?: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  primary?: boolean
}) {
  const className = primary
    ? 'group flex items-center gap-3 rounded-2xl bg-studio-webtoon p-4 text-left text-bg transition-colors hover:bg-studio-webtoon/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
    : 'group flex items-center gap-3 rounded-2xl border border-bg-border bg-bg-card p-4 text-left transition-colors hover:border-studio-webtoon/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon'

  const content = (
    <>
      <span className={primary ? 'shrink-0' : 'shrink-0 text-studio-webtoon'} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${primary ? '' : 'text-text'}`}>{title}</span>
        <span className={`block truncate text-xs ${primary ? 'opacity-80' : 'text-text-secondary'}`}>
          {subtitle}
        </span>
      </span>
      <ArrowRight
        size={15}
        className="ml-auto shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden="true"
      />
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

function WebtoonCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-bg-border bg-bg-card">
      <div className="aspect-[2/3] bg-bg-elevated" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-bg-elevated" />
        <div className="h-3 w-1/2 rounded bg-bg-elevated" />
        <div className="h-3 w-2/3 rounded bg-bg-elevated" />
      </div>
    </div>
  )
}

interface WebtoonCardProps {
  webtoon: Webtoon
  onEdit: (webtoon: Webtoon) => void
  onDelete: (id: string, title: string) => void
  onPublish: (id: string) => void
  onUnpublish: (id: string) => void
}

function WebtoonCard({ webtoon, onEdit, onDelete, onPublish, onUnpublish }: WebtoonCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPublished = webtoon.status !== 'draft'
  const title = webtoon.title || 'Untitled Webtoon'

  return (
    <li className="group relative overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-colors hover:border-studio-webtoon/40">
      {/* Cover — the whole cover is the link into the canvas editor, so the card
          needs no click handler of its own (a clickable <article> is not
          focusable for keyboards or announced as actionable). */}
      <Link
        href={`/create/webtoon/${webtoon.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon"
        aria-label={`Open ${title} in the editor`}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-bg-elevated">
          {webtoon.coverURL ? (
            <Image
              src={webtoon.coverURL}
              alt={`Cover of ${title}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
              <ImageIcon size={30} aria-hidden="true" />
              <span className="text-xs font-medium">No cover</span>
            </span>
          )}

          <span
            className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusBadge(webtoon.status)}`}
          >
            {webtoon.status}
          </span>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight text-text">
          {webtoon.title || <span className="italic text-text-muted">Untitled Webtoon</span>}
        </h3>

        {webtoon.genres?.length > 0 && (
          <p className="mb-2 truncate text-[11px] text-text-secondary">
            {webtoon.genres.slice(0, 2).join(' · ')}
          </p>
        )}

        <div className="mb-2 flex items-center gap-3 text-[11px] text-text-secondary">
          <span className="flex items-center gap-1">
            <Layers size={10} aria-hidden="true" />
            {webtoon.episodeCount} Ep
          </span>
          <span className="flex items-center gap-1">
            <Eye size={10} aria-hidden="true" />
            {formatCount(webtoon.viewCount)}
          </span>
        </div>

        <p className="text-[10px] text-text-muted">{formatRelativeTimestamp(webtoon.updatedAt)}</p>

        <div className="mt-2.5 flex gap-1.5">
          <Link
            href={`/create/webtoon/${webtoon.id}`}
            className="flex-1 rounded-md border border-bg-border py-1 text-center text-[10px] font-semibold text-text-secondary transition-colors hover:border-studio-webtoon/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon"
          >
            Open editor
          </Link>
        </div>
      </div>

      {/* Action menu */}
      <div className="absolute right-2 top-2">
        <div className="relative">
          <Tooltip label="More options">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg/70 backdrop-blur-sm transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon"
              aria-label={`Actions for ${title}`}
              aria-haspopup="menu"
              {...(menuOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
            >
              <MoreVertical size={14} className="text-text" aria-hidden="true" />
            </button>
          </Tooltip>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 top-8 z-20 w-44 animate-scale-in overflow-hidden rounded-xl border border-bg-border bg-bg-elevated shadow-2xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onEdit(webtoon) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text transition-colors hover:bg-bg-card"
                >
                  <Filter size={13} aria-hidden="true" /> Edit details
                </button>
                {isPublished ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onUnpublish(webtoon.id) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text transition-colors hover:bg-bg-card"
                  >
                    <EyeOff size={13} aria-hidden="true" /> Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onPublish(webtoon.id) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text transition-colors hover:bg-bg-card"
                  >
                    <Globe size={13} aria-hidden="true" /> Publish
                  </button>
                )}
                <div className="mx-2 h-px bg-bg-border" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onDelete(webtoon.id, webtoon.title) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  <Trash2 size={13} aria-hidden="true" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

interface DeleteConfirmProps {
  title: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteConfirmDialog({ title, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  // Close on Escape — destructive dialogs must always have a keyboard way out.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loading, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-bg-border bg-bg-elevated p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle size={18} className="text-danger" aria-hidden="true" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-base font-semibold text-text">
              Delete Webtoon
            </h2>
            <p id="delete-dialog-desc" className="mt-1 text-sm text-text-secondary">
              &ldquo;{title || 'Untitled'}&rdquo; and all its episodes will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost px-3 py-2 text-sm"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-danger px-3 py-2 text-sm"
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

export default function WebtoonDashboardPage() {
  const { firebaseUser, loading: authLoading } = useAuth()
  const { webtoons, loading: webtoonsLoading } = useWebtoons(firebaseUser?.uid ?? '')
  const router = useRouter()

  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortOrder>('updated')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editWebtoon, setEditWebtoon] = useState<Webtoon | null>(null)
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
    let result = [...webtoons]
    if (filter === 'live') result = result.filter((w) => w.status !== 'draft')
    else if (filter !== 'all') result = result.filter((w) => w.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (w) =>
          w.title?.toLowerCase().includes(q) ||
          w.synopsis?.toLowerCase().includes(q) ||
          w.genres?.some((g) => g.toLowerCase().includes(q))
      )
    }
    switch (sort) {
      case 'views':
        return result.sort((a, b) => b.viewCount - a.viewCount)
      case 'alpha':
        return result.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
      case 'episodes':
        return result.sort((a, b) => b.episodeCount - a.episodeCount)
      default:
        return result
    }
  }, [webtoons, filter, sort, search])

  // "Continue drawing" is the most recently touched webtoon that has something
  // in it — sending someone back to an empty canvas isn't continuing anything.
  const continueWebtoon = useMemo(
    () => webtoons.find((w) => w.episodeCount > 0) ?? webtoons[0],
    [webtoons]
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteWebtoon(deleteTarget.id)
      toast.success('Webtoon deleted')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete webtoon')
    } finally {
      setDeleting(false)
    }
  }

  async function handlePublish(id: string) {
    const wt = webtoons.find((w) => w.id === id)
    if (!wt) return
    if (!wt.coverURL) {
      toast.error('Add a cover image before publishing')
      return
    }
    if (!wt.synopsis?.trim()) {
      toast.error('Add a description before publishing')
      return
    }
    if (wt.episodeCount < 1) {
      toast.error('Add at least one episode before publishing')
      return
    }
    const loadingToast = toast.loading('Publishing…')
    try {
      await publishWebtoon(id)
      toast.success('Webtoon published!', { id: loadingToast })
    } catch {
      toast.error('Failed to publish', { id: loadingToast })
    }
  }

  async function handleUnpublish(id: string) {
    const loadingToast = toast.loading('Unpublishing…')
    try {
      await unpublishWebtoon(id)
      toast.success('Webtoon unpublished', { id: loadingToast })
    } catch {
      toast.error('Failed to unpublish', { id: loadingToast })
    }
  }

  const isLoading = authLoading || webtoonsLoading
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort'
  const publishedCount = webtoons.filter((w) => w.status !== 'draft').length

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* ── Landing card ─────────────────────────────────── */}
      {/* Flat tonal surface, Material-style — the same shape Anime, Art and
          Novel Studio use, so the four studios read as one product. */}
      <section
        className="rounded-3xl border border-bg-border bg-bg-card p-6 sm:p-9 lg:p-12"
        aria-labelledby="webtoon-studio-heading"
      >
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-studio-webtoon/25 px-3 py-1 text-xs font-semibold text-studio-webtoon">
              <Sparkles size={12} aria-hidden="true" />
              Comics &amp; Episodes
            </p>
            <h1
              id="webtoon-studio-heading"
              className="text-3xl font-black tracking-tight text-text sm:text-4xl lg:text-5xl"
            >
              Webtoon Studio
            </h1>
            <p className="mt-2 text-base font-semibold text-studio-webtoon lg:text-lg">
              Draw. Letter. Publish. Earn.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary lg:text-base">
              Lay out panels on an infinite vertical canvas with lettering, speech bubbles and AI
              art, then publish finished episodes in one tap.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <ActionTile
              primary
              onClick={() => setShowCreate(true)}
              icon={<Plus size={20} />}
              title="New webtoon"
              subtitle="Start a series on a blank canvas"
            />
            {continueWebtoon ? (
              <ActionTile
                href={`/create/webtoon/${continueWebtoon.id}`}
                icon={<PenLine size={20} />}
                title="Continue drawing"
                subtitle={continueWebtoon.title || 'Untitled Webtoon'}
              />
            ) : (
              <ActionTile
                href="#webtoon-library"
                icon={<PenLine size={20} />}
                title="Continue drawing"
                subtitle="Nothing in progress yet"
              />
            )}
            <ActionTile
              href="#webtoon-library"
              icon={<FolderOpen size={20} />}
              title="Your webtoons"
              subtitle={`${webtoons.length} in your library · ${publishedCount} published`}
            />
            <ActionTile
              href="/browse"
              icon={<Library size={20} />}
              title="Browse Toonflow"
              subtitle="See what other creators are publishing"
            />
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────── */}
      {!isLoading && webtoons.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total webtoons', value: webtoons.length },
            { label: 'Published', value: publishedCount },
            { label: 'Total episodes', value: webtoons.reduce((s, w) => s + w.episodeCount, 0) },
            { label: 'Total views', value: formatCount(webtoons.reduce((s, w) => s + w.viewCount, 0)) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-bg-border bg-bg-card p-4">
              <p className="text-2xl font-bold tabular-nums text-text">{value}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Library ──────────────────────────────────────── */}
      <section id="webtoon-library" className="mt-10 scroll-mt-20" aria-labelledby="webtoons-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="webtoons-heading" className="text-lg font-bold text-text lg:text-xl">
            Your webtoons
          </h2>
          <p className="text-xs text-text-muted lg:text-sm">
            {webtoons.length} {webtoons.length === 1 ? 'series' : 'titles'}
          </p>
        </div>

        {/* Controls */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search webtoons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-8 text-sm"
              aria-label="Search webtoons"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="btn-ghost gap-2 border border-bg-border text-sm"
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
                <div
                  role="listbox"
                  aria-label="Sort order options"
                  className="absolute right-0 top-10 z-20 w-44 animate-scale-in overflow-hidden rounded-xl border border-bg-border bg-bg-elevated shadow-2xl"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = sort === opt.value
                    return isSelected ? (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected="true"
                        onClick={() => { setSort(opt.value); setSortOpen(false) }}
                        className="w-full bg-studio-webtoon/10 px-3 py-2.5 text-left text-sm font-medium text-studio-webtoon transition-colors"
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
                        className="w-full px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-bg-card hover:text-text"
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
          aria-label="Filter by release status"
          className="mb-6 flex items-center gap-0.5 overflow-x-auto border-b border-bg-border pb-px scrollbar-none"
        >
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'all'
              ? webtoons.length
              : f.value === 'live'
              ? publishedCount
              : webtoons.filter((w) => w.status === f.value).length
            const isSelected = filter === f.value
            return isSelected ? (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected="true"
                onClick={() => setFilter(f.value)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-t border-b-2 border-studio-webtoon px-3 py-2 text-sm font-medium text-studio-webtoon transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon"
              >
                {f.label}
                {count > 0 && (
                  <span className="rounded-full bg-studio-webtoon px-1.5 py-0.5 text-[10px] tabular-nums text-bg">
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
                className="flex items-center gap-1.5 whitespace-nowrap rounded-t border-b-2 border-transparent px-3 py-2 text-sm font-medium text-text-secondary transition-all hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {f.label}
                {count > 0 && (
                  <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] tabular-nums text-text-secondary">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <WebtoonCardSkeleton key={i} />
            ))}
          </div>
        ) : webtoons.length === 0 ? (
          <div
            className="flex flex-col items-center rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-14 text-center"
            role="status"
          >
            <ImageIcon size={32} className="text-text-muted" aria-hidden="true" />
            <h3 className="mt-4 text-base font-bold text-text">No webtoons yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
              Start laying out your panels on the infinite canvas and share your story with the world.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-studio-webtoon px-4 py-2.5 text-sm font-bold text-bg transition-colors hover:bg-studio-webtoon/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-webtoon focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <Plus size={16} aria-hidden="true" />
                Create your first webtoon
              </button>
              <Link
                href="/create/seed"
                className="btn-ghost flex items-center justify-center gap-2 border border-bg-border text-sm"
              >
                <Sparkles size={14} aria-hidden="true" />
                Seed Ravana Demo
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-14 text-center"
            role="status"
          >
            <Search size={32} className="text-text-muted" aria-hidden="true" />
            <h3 className="mt-4 text-base font-bold text-text">No results found</h3>
            <p className="mt-1.5 text-sm text-text-secondary">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <ul
            role="list"
            aria-label={`${filter === 'all' ? 'All' : filter} webtoons`}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
          >
            {filtered.map((w) => (
              <WebtoonCard
                key={w.id}
                webtoon={w}
                onEdit={setEditWebtoon}
                onDelete={(id, title) => setDeleteTarget({ id, title })}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Creation Modal */}
      {(showCreate || editWebtoon) && (
        <CreateWebtoonModal
          authorId={firebaseUser?.uid ?? ''}
          authorName={firebaseUser?.displayName ?? 'Anonymous'}
          authorPhotoURL={firebaseUser?.photoURL ?? null}
          editWebtoon={editWebtoon}
          onClose={() => {
            setShowCreate(false)
            setEditWebtoon(null)
          }}
          onCreated={(id) => {
            router.push(`/create/webtoon/${id}`)
          }}
        />
      )}

      {/* Delete Dialog */}
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
