'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
import { trackView } from '@/lib/firebase/engagement'
import LikeButton from '@/components/reader/LikeButton'
import BookmarkButton from '@/components/reader/BookmarkButton'
import CommentSection from '@/components/reader/CommentSection'
import { IntroPoster } from '@/components/reader/IntroPoster'
import { TitlePage } from '@/components/reader/TitlePage'
import { EndingPoster } from '@/components/reader/EndingPoster'
import { cn } from '@/lib/utils/cn'
import type { Novel, Chapter } from '@/types'

// ── Font size options ─────────────────────────────────────────
const FONT_OPTIONS = [
  { label: 'S',  size: '1rem',    lineH: '1.85' },
  { label: 'M',  size: '1.125rem', lineH: '1.9' },
  { label: 'L',  size: '1.25rem', lineH: '1.95' },
  { label: 'XL', size: '1.5rem',  lineH: '2.0' },
]

// ── Render chapter content with paragraph animations ──────────
function renderContent(content: string, centered: boolean, fontOpt: typeof FONT_OPTIONS[0]) {
  const lines = content.split('\n')
  let paraIndex = 0

  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-5" />

    if (line.startsWith('# ')) {
      return (
        <h2
          key={i}
          className="reader-paragraph text-white font-black mt-12 mb-4 leading-tight"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontFamily: 'Georgia, serif' }}
        >
          {line.slice(2)}
        </h2>
      )
    }
    if (line.startsWith('## ')) {
      return (
        <h3
          key={i}
          className="reader-paragraph text-white font-bold mt-8 mb-3"
          style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontFamily: 'Georgia, serif' }}
        >
          {line.slice(3)}
        </h3>
      )
    }
    if (line.startsWith('--- ') || line === '---') {
      return (
        <div key={i} className="reader-paragraph flex items-center justify-center gap-4 my-10">
          <div className="h-px w-16 bg-white/15" />
          <span className="text-white/20 text-xs">✦</span>
          <div className="h-px w-16 bg-white/15" />
        </div>
      )
    }

    const isFirst = paraIndex === 0
    paraIndex++

    return (
      <p
        key={i}
        className={cn(
          'reader-paragraph text-white/85 leading-loose',
          isFirst && 'reader-drop-cap',
          centered ? 'text-center' : '',
        )}
        style={{ fontSize: fontOpt.size, lineHeight: fontOpt.lineH, marginBottom: '1.1em' }}
      >
        {line}
      </p>
    )
  })
}

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

  const viewTracked   = useRef(false)
  const headerTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef    = useRef<HTMLDivElement>(null)
  const lastScrollY   = useRef(0)

  // ── Load data ───────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getNovelById(id), getChaptersByNovel(id)])
      .then(([n, chs]) => {
        setNovel(n)
        const published = chs
          .filter((c) => c.status === 'published')
          .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
        setChapters(published)
        setChapter(published.find((c) => c.id === chapterId) ?? null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, chapterId])

  // ── Track view + reading history ────────────────────────────
  useEffect(() => {
    if (!chapter || viewTracked.current) return
    viewTracked.current = true
    trackView(chapterId, 'chapter', id, firebaseUser?.uid ?? null).catch(() => {})
    if (firebaseUser) {
      upsertReadingHistory(firebaseUser.uid, {
        contentId: id,
        contentType: 'novel',
        lastChapterId: chapterId,
        lastChapterNumber: chapter.chapterNumber ?? 1,
      }).catch(() => {})
    }
  }, [chapter, chapterId, id, firebaseUser])

  // ── Paragraph fade-in via IntersectionObserver ───────────────
  useEffect(() => {
    if (!contentRef.current) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.08 }
    )
    const paragraphs = contentRef.current.querySelectorAll('.reader-paragraph')
    paragraphs.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [chapter])

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
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // ── Derived ──────────────────────────────────────────────────
  const currentIndex = chapters.findIndex((c) => c.id === chapterId)
  const prevChapter  = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter  = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null
  const isFirstChapter = currentIndex === 0
  const isLastChapter  = currentIndex === chapters.length - 1 && chapters.length > 0
  const fontOpt = FONT_OPTIONS[fontIdx]

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
        className="reader-progress-bar"
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
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
            <Link
              href={`/novel/${id}`}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Back to novel"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Link>
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
            <button
              type="button"
              onClick={() => { setShowSettings((v) => !v); setShowChapterList(false) }}
              aria-label="Reading settings"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <Settings2 size={14} aria-hidden="true" />
            </button>
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

      {/* ── Cinematic intro (chapter 1 only) ─────────────── */}
      {isFirstChapter && <IntroPoster novel={novel} />}
      {isFirstChapter && (
        <TitlePage
          novel={novel}
          chapterTitle={chapter.title}
          chapterNumber={chapter.chapterNumber ?? 1}
        />
      )}

      {/* ── Chapter content ───────────────────────────────── */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-[680px] mx-auto px-5 sm:px-8 pt-20 pb-8"
        ref={contentRef}
      >
        {/* Chapter heading */}
        <header className="mb-12 text-center reader-paragraph">
          <p className="text-[10px] tracking-[0.5em] text-white/25 uppercase mb-3">
            Chapter {chapter.chapterNumber}
          </p>
          <h1
            className="font-black text-white leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontFamily: 'Georgia, serif' }}
          >
            {chapter.title || `Chapter ${chapter.chapterNumber}`}
          </h1>
          {chapter.wordCount > 0 && (
            <p className="text-[11px] text-white/25 mt-3">
              {chapter.wordCount.toLocaleString()} words · ~{Math.ceil(chapter.wordCount / 200)} min read
            </p>
          )}
          <div className="h-px w-12 bg-white/15 mx-auto mt-6" />
        </header>

        {/* Story text */}
        {chapter.content ? (
          <div className="space-y-0">
            {renderContent(chapter.content, centered, fontOpt)}
          </div>
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

      {/* ── Cinematic ending (last chapter only) ─────────── */}
      {isLastChapter && <EndingPoster novel={novel} />}

      {/* ── Floating chapter nav (mobile) ────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
        {prevChapter && (
          <Link
            href={`/novel/${id}/chapter/${prevChapter.id}`}
            className="w-10 h-10 rounded-full bg-black/70 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            aria-label="Previous chapter"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
        )}

        <div className="px-4 py-2 rounded-full bg-black/70 border border-white/15 backdrop-blur-md text-[11px] text-white/50 font-medium tabular-nums">
          {Math.round(progress)}%
        </div>

        {nextChapter && (
          <Link
            href={`/novel/${id}/chapter/${nextChapter.id}`}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:bg-white/90 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            aria-label="Next chapter"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}
