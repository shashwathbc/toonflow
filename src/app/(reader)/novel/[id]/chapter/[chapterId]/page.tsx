'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, BookOpen, Loader2, List,
  Settings2, AlignLeft, AlignCenter, Home, Type,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  getNovelById,
  getChaptersByNovel,
  upsertReadingHistory,
} from '@/lib/firebase/firestore'
import { useViewTracking } from '@/hooks/useViewTracking'
import LikeButton from '@/components/reader/LikeButton'
import BookmarkButton from '@/components/reader/BookmarkButton'
import CommentSection from '@/components/reader/CommentSection'
import { CreditsPoster } from '@/components/reader/CreditsPoster'
import { TitlePage } from '@/components/reader/TitlePage'
import { EndingPoster } from '@/components/reader/EndingPoster'
import { cn } from '@/lib/utils/cn'
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Novel, Chapter } from '@/types'

// ── Font size options ─────────────────────────────────────────
const FONT_OPTIONS = [
  { label: 'S',  cls: 'reader-content-sm' },
  { label: 'M',  cls: 'reader-content-md' },
  { label: 'L',  cls: 'reader-content-lg' },
  { label: 'XL', cls: 'reader-content-xl' },
]


// ── Main Page ─────────────────────────────────────────────────
export default function ChapterReaderPage() {
  const { id, chapterId } = useParams<{ id: string; chapterId: string }>()
  const { firebaseUser } = useAuth()

  const [novel, setNovel]     = useState<Novel | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapter, setChapter]   = useState<Chapter | null>(null)
  const [loading, setLoading]   = useState(true)

  // Reader settings
  const [fontIdx, setFontIdx]   = useState(1)
  const [centered, setCentered] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showChapterList, setShowChapterList] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  // Sanitize the stored HTML once per chapter (defends readers against a
  // creator embedding a script/onerror payload in their own content doc).
  const safeContent = useMemo(() => sanitizeHtml(chapter?.content), [chapter?.content])

  const headerTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef    = useRef<HTMLDivElement>(null)
  const lastScrollY   = useRef(0)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Width/valuenow are set via the DOM: static-analysis a11y linters reject
  // JSX expressions in aria-* and inline style attributes
  useEffect(() => {
    const el = progressBarRef.current
    if (!el) return
    el.style.width = `${progress}%`
    el.setAttribute('aria-valuemin', '0')
    el.setAttribute('aria-valuemax', '100')
    el.setAttribute('aria-valuenow', String(Math.round(progress)))
  }, [progress])

  // ── Load data ───────────────────────────────────────────────
  useEffect(() => {
    // Guards against both unmount and a fast chapter-to-chapter navigation
    // landing an older response over a newer one.
    let cancelled = false

    Promise.all([getNovelById(id), getChaptersByNovel(id)])
      .then(([n, chs]) => {
        if (cancelled) return
        setNovel(n)
        const published = chs
          .filter((c) => c.status === 'published')
          .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
        setChapters(published)
        setChapter(published.find((c) => c.id === chapterId) ?? null)
      })
      .catch((e) => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id, chapterId])

  // ── Track view (server-validated) + reading history ────────
  useViewTracking(chapter ? { contentType: 'chapter', contentId: chapterId, parentId: id } : null)

  useEffect(() => {
    if (!chapter) return
    if (firebaseUser) {
      upsertReadingHistory(firebaseUser.uid, {
        contentId: id,
        contentType: 'novel',
        lastChapterId: chapterId,
        lastChapterNumber: chapter.chapterNumber ?? 1,
      }).catch(() => {})
    }
  }, [chapter, chapterId, id, firebaseUser])


  // ── Reading progress + header auto-hide ─────────────────────
  const handleScroll = useCallback(() => {
    const scrollY  = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    setProgress(maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0)

    // Hide header when scrolling down, show when scrolling up
    if (scrollY > lastScrollY.current + 8 && scrollY > 120) {
      setHeaderVisible(false)
      setShowSettings(false)
      setShowChapterList(false)
    } else if (scrollY < lastScrollY.current - 8) {
      setHeaderVisible(true)
    }
    lastScrollY.current = scrollY

    // Auto-show header after 2.5s idle
    if (headerTimer.current) clearTimeout(headerTimer.current)
    headerTimer.current = setTimeout(() => setHeaderVisible(true), 2500)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      // The listener is removed above, but the last scroll already scheduled a
      // 2.5s "re-show header" timer. Without this it survives unmount and fires
      // setHeaderVisible on a dead component, keeping the whole reader closure
      // (chapters + content) reachable until it does.
      if (headerTimer.current) clearTimeout(headerTimer.current)
    }
  }, [handleScroll])

  // ── Derived ──────────────────────────────────────────────────
  // Memoized because this component re-renders on EVERY scroll event (setProgress
  // above), and without it the findIndex + both lookups re-ran each frame.
  const { prevChapter, nextChapter } = useMemo(() => {
    const idx = chapters.findIndex((c) => c.id === chapterId)
    return {
      prevChapter: idx > 0 ? chapters[idx - 1] : null,
      nextChapter: idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null,
    }
  }, [chapters, chapterId])

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-white/30" />
    </div>
  )

  if (!chapter || !novel) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white/40">
      <BookOpen size={40} className="opacity-30" />
      <p className="text-sm">Chapter not found</p>
      <Link href={`/novel/${id}`} className="text-xs text-white/50 hover:text-white underline underline-offset-4">
        ← Back to novel
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Reading progress bar (always visible at top) ── */}
      <div
        ref={progressBarRef}
        className="reader-progress-bar"
        role="progressbar"
        aria-label="Reading progress"
      />

      {/* ── Sticky reader header ─────────────────────────── */}
      <header
        className={cn(
          'reader-header fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/8',
          !headerVisible && 'hidden'
        )}
        role="banner"
      >
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          {/* Left */}
          <div className="flex items-center gap-2 min-w-0">
            <Tooltip label="Back to novel" side="bottom">
              <Link
                href={`/novel/${id}`}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                aria-label="Back to novel"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Link>
            </Tooltip>
            <Tooltip label="Chapter list" side="bottom">
              <button
                type="button"
                onClick={() => { setShowChapterList((v) => !v); setShowSettings(false) }}
                className="flex items-center gap-1.5 min-w-0 group focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded"
                aria-label="Chapter list"
              >
                <List size={13} className="text-white/30 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors truncate max-w-[120px] sm:max-w-[200px] hidden sm:block">
                  {novel.title}
                </span>
              </button>
            </Tooltip>
          </div>

          {/* Centre: chapter title */}
          <p className="text-xs font-medium text-white/70 truncate text-center flex-1 px-2">
            Ch.{chapter.chapterNumber} · {chapter.title || 'Untitled'}
          </p>

          {/* Right */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <LikeButton
              contentType="chapter"
              contentId={chapterId}
              parentId={id}
              initialCount={chapter.viewCount ?? 0}
              size="sm"
              showCount={false}
            />
            <Tooltip label="Reading settings" side="bottom">
              <button
                type="button"
                onClick={() => { setShowSettings((v) => !v); setShowChapterList(false) }}
                aria-label="Reading settings"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <Settings2 size={14} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── Settings panel ── */}
        {showSettings && (
          <div className="border-t border-white/8 px-4 py-3 max-w-3xl mx-auto flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Type size={12} className="text-white/30" aria-hidden="true" />
              <span className="text-[11px] text-white/40">Size</span>
              <div className="flex gap-1" role="group" aria-label="Font size">
                {FONT_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setFontIdx(i)}
                    className={cn(
                      'w-7 h-7 rounded text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
                      fontIdx === i
                        ? 'bg-white text-black'
                        : 'bg-white/8 text-white/40 hover:text-white'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCentered((v) => !v)}
                aria-label={centered ? 'Left align' : 'Center align'}
                className={cn(
                  'flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
                  centered ? 'bg-white text-black' : 'bg-white/8 text-white/40 hover:text-white'
                )}
              >
                {centered ? <AlignCenter size={12} aria-hidden="true" /> : <AlignLeft size={12} aria-hidden="true" />}
                {centered ? 'Centered' : 'Left'}
              </button>
            </div>
          </div>
        )}

        {/* ── Chapter list dropdown ── */}
        {showChapterList && chapters.length > 0 && (
          <div className="border-t border-white/8 max-w-3xl mx-auto max-h-64 overflow-y-auto">
            {chapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/novel/${id}/chapter/${ch.id}`}
                onClick={() => setShowChapterList(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  ch.id === chapterId
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                )}
              >
                <span className="text-[11px] text-white/30 w-6 flex-shrink-0 tabular-nums">
                  {ch.chapterNumber}
                </span>
                <span className="truncate">{ch.title || `Chapter ${ch.chapterNumber}`}</span>
                {ch.id === chapterId && (
                  <span className="ml-auto text-[10px] text-white/30">reading</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── Opening branded pages — shown before every chapter ── */}
      <CreditsPoster novel={novel} chapterNumber={chapter.chapterNumber ?? 1} />
      <TitlePage
        novel={novel}
        chapterTitle={chapter.title}
        chapterNumber={chapter.chapterNumber ?? 1}
      />

      {/* ── Chapter content ───────────────────────────────── */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-[680px] mx-auto px-5 sm:px-8 pt-20 pb-8"
        ref={contentRef}
      >
        {/* Chapter heading */}
        <header className="mb-12 text-center reader-chapter-heading">
          <div className="canvas-beam" aria-hidden="true" />
          <p className="text-[10px] tracking-[0.5em] text-white/25 uppercase mb-3">
            Chapter {chapter.chapterNumber}
          </p>
          <h1 className="reader-chapter-title font-black text-white leading-tight">
            {chapter.title || `Chapter ${chapter.chapterNumber}`}
          </h1>
          {chapter.wordCount > 0 && (
            <p className="text-[11px] text-white/25 mt-3">
              {chapter.wordCount.toLocaleString()} words · ~{Math.ceil(chapter.wordCount / 200)} min read
            </p>
          )}
          <div className="h-px w-12 bg-white/15 mx-auto mt-6" />
        </header>

        {/* Story text — HTML from TipTap rendered with reader styles */}
        {chapter.content ? (
          <div
            className={cn('reader-content', FONT_OPTIONS[fontIdx].cls, centered && 'text-center')}
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />
        ) : (
          <p className="text-white/30 italic text-center py-16">This chapter has no content yet.</p>
        )}

        {/* Chapter end divider */}
        <div className="flex items-center justify-center gap-4 my-16">
          <div className="h-px w-20 bg-white/10" />
          <span className="text-white/15 text-xs">✦</span>
          <div className="h-px w-20 bg-white/10" />
        </div>

        {/* ── Actions bar ─────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 mb-16 flex-wrap">
          <LikeButton contentType="chapter" contentId={chapterId} parentId={id} initialCount={chapter.viewCount ?? 0} />
          <BookmarkButton contentId={id} contentType="novel" showLabel />
        </div>

        {/* ── Chapter navigation ───────────────────────────── */}
        <nav aria-label="Chapter navigation" className="grid grid-cols-2 gap-3 mb-20">
          {prevChapter ? (
            <Link
              href={`/novel/${id}/chapter/${prevChapter.id}`}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border border-white/10 hover:border-white/25 hover:bg-white/4 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <span className="flex items-center gap-1 text-[10px] text-white/30 uppercase tracking-widest">
                <ChevronLeft size={10} aria-hidden="true" /> Previous
              </span>
              <span className="text-sm font-medium text-white/70 truncate w-full">
                Ch.{prevChapter.chapterNumber} · {prevChapter.title || 'Untitled'}
              </span>
            </Link>
          ) : (
            <Link
              href={`/novel/${id}`}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border border-white/10 hover:border-white/25 hover:bg-white/4 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <span className="flex items-center gap-1 text-[10px] text-white/30 uppercase tracking-widest">
                <Home size={10} aria-hidden="true" /> Novel Page
              </span>
              <span className="text-sm font-medium text-white/50 truncate w-full">{novel.title}</span>
            </Link>
          )}

          {nextChapter ? (
            <Link
              href={`/novel/${id}/chapter/${nextChapter.id}`}
              className="flex flex-col items-end gap-1 px-4 py-3 rounded-2xl bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <span className="flex items-center gap-1 text-[10px] text-black/50 uppercase tracking-widest">
                Next <ChevronRight size={10} aria-hidden="true" />
              </span>
              <span className="text-sm font-bold truncate w-full text-right">
                Ch.{nextChapter.chapterNumber} · {nextChapter.title || 'Untitled'}
              </span>
            </Link>
          ) : (
            <Link
              href={`/novel/${id}`}
              className="flex flex-col items-end gap-1 px-4 py-3 rounded-2xl border border-white/10 hover:border-white/25 hover:bg-white/4 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <span className="flex items-center gap-1 text-[10px] text-white/30 uppercase tracking-widest">
                All Chapters <List size={10} aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-white/50 truncate w-full text-right">{novel.title}</span>
            </Link>
          )}
        </nav>

        {/* ── Comments ─────────────────────────────────────── */}
        <div className="border-t border-white/8 pt-12 mb-8">
          <CommentSection targetId={chapterId} targetType="chapter" creatorId={novel.authorId} />
        </div>
      </main>

      {/* ── Cinematic ending — shown after every chapter ─── */}
      <EndingPoster novel={novel} />

      {/* ── Floating chapter nav (mobile) ────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
        {prevChapter && (
          <Tooltip label="Previous chapter" side="top">
            <Link
              href={`/novel/${id}/chapter/${prevChapter.id}`}
              className="w-10 h-10 rounded-full bg-black/70 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Previous chapter"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Link>
          </Tooltip>
        )}

        <div className="px-4 py-2 rounded-full bg-black/70 border border-white/15 backdrop-blur-md text-[11px] text-white/50 font-medium tabular-nums">
          {Math.round(progress)}%
        </div>

        {nextChapter && (
          <Tooltip label="Next chapter" side="top">
            <Link
              href={`/novel/${id}/chapter/${nextChapter.id}`}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:bg-white/90 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Next chapter"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
