'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useChapters } from '@/hooks/useChapters'
import {
  getNovelById,
  updateChapterContent,
  publishNovel,
  unpublishNovel,
  publishChapter,
  unpublishChapter,
} from '@/lib/firebase/firestore'
import dynamic from 'next/dynamic'
import { ChapterSidebar } from '@/components/editor/ChapterSidebar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { CreditsPoster } from '@/components/reader/CreditsPoster'
import { TitlePage } from '@/components/reader/TitlePage'
import { EndingPoster } from '@/components/reader/EndingPoster'
import { BookOpen, Loader2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Novel, Chapter } from '@/types'

const NovelRichEditor = dynamic(
  () => import('@/components/editor/NovelRichEditor').then((m) => ({ default: m.NovelRichEditor })),
  { ssr: false, loading: () => <div className="flex-1 bg-bg-card" aria-hidden="true" /> }
)

const AIAssistant = dynamic(
  () => import('@/components/editor/AIAssistant').then((m) => ({ default: m.AIAssistant })),
  { ssr: false, loading: () => <div className="w-64 bg-bg-card border-l border-bg-border shrink-0" aria-hidden="true" /> }
)

const AUTOSAVE_DELAY_MS = 5000

interface PageProps {
  params: Promise<{ novelId: string }>
}

export default function NovelEditorPage({ params }: PageProps) {
  const { novelId } = use(params)
  const { firebaseUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const { chapters, loading: chaptersLoading } = useChapters(novelId)

  const [novel, setNovel] = useState<Novel | null>(null)
  // loading derives from "has the current novelId been fetched" so the effect
  // never calls setState synchronously (react-hooks/set-state-in-effect)
  const [fetchedId, setFetchedId] = useState<string | null>(null)
  const novelLoading = fetchedId !== novelId
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)
  const [chapterTitle, setChapterTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [, setPublishing] = useState(false)
  const [chapterPublishing, setChapterPublishing] = useState(false)

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef('')

  // Load novel
  useEffect(() => {
    getNovelById(novelId)
      .then((n) => {
        setNovel(n)
        if (n && firebaseUser && n.authorId !== firebaseUser.uid) {
          toast.error('You do not have permission to edit this novel.')
          router.push('/create/novel')
        }
      })
      .catch(() => toast.error('Failed to load novel'))
      .finally(() => setFetchedId(novelId))
  }, [novelId, firebaseUser, router])

  // Auto-select first chapter when chapters load
  useEffect(() => {
    if (chapters.length > 0 && !activeChapter) {
      selectChapter(chapters[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters])

  // Keep active chapter status in sync with the live chapter subscription.
  // Render-time state adjustment — the React-sanctioned alternative to
  // calling setState synchronously inside an effect.
  const freshActive = activeChapter ? chapters.find((c) => c.id === activeChapter.id) : undefined
  if (activeChapter && freshActive && freshActive.status !== activeChapter.status) {
    setActiveChapter(freshActive)
  }

  // Keyboard shortcut: Ctrl+S = save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveChapter()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter, editorContent, chapterTitle])

  function selectChapter(chapter: Chapter) {
    // Save current before switching
    if (
      activeChapter &&
      (editorContent !== lastSavedContent.current)
    ) {
      triggerSave(activeChapter.id, editorContent, wordCount, false)
    }
    setActiveChapter(chapter)
    setChapterTitle(chapter.title ?? '')
    setEditorContent(chapter.content ?? '')
    lastSavedContent.current = chapter.content ?? ''
  }

  function handleApplyAIChapter(html: string) {
    // Word count from the generated HTML (tags stripped)
    const text = html.replace(/<[^>]+>/g, ' ')
    const wc = text.split(/\s+/).filter(Boolean).length
    handleEditorChange(html, wc)
    if (activeChapter) {
      triggerSave(activeChapter.id, html, wc, true)
    }
  }

  function handleEditorChange(html: string, wc: number) {
    setEditorContent(html)
    setWordCount(wc)

    // Schedule autosave
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      if (activeChapter) {
        triggerSave(activeChapter.id, html, wc, true)
      }
    }, AUTOSAVE_DELAY_MS)
  }

  async function triggerSave(
    chapterId: string,
    html: string,
    wc: number,
    isAuto: boolean
  ) {
    if (!novel) return
    setSaveState('saving')
    try {
      // Save chapter title if changed
      if (chapterTitle !== activeChapter?.title) {
        const { updateChapter } = await import('@/lib/firebase/firestore')
        await updateChapter(novelId, chapterId, { title: chapterTitle })
      }
      await updateChapterContent(novelId, chapterId, html, wc)
      lastSavedContent.current = html
      setSaveState('saved')
      if (!isAuto) toast.success('Saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
      if (!isAuto) toast.error('Failed to save')
    }
  }

  async function saveChapter() {
    if (!activeChapter) {
      toast('No chapter selected')
      return
    }
    await triggerSave(activeChapter.id, editorContent, wordCount, false)
  }

  async function handlePublish() {
    if (!novel) return
    if (!novel.coverURL) { toast.error('Add a cover image before publishing'); return }
    if (!novel.synopsis?.trim()) { toast.error('Add a description before publishing'); return }
    if (chapters.length === 0) { toast.error('Add at least one chapter before publishing'); return }

    setPublishing(true)
    try {
      await publishNovel(novelId)
      setNovel((prev) => prev ? { ...prev, status: 'ongoing' } : prev)
      toast.success('Novel published! Now visible on Browse.')
    } catch {
      toast.error('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  async function handleUnpublish() {
    setPublishing(true)
    try {
      await unpublishNovel(novelId)
      setNovel((prev) => prev ? { ...prev, status: 'draft' } : prev)
      toast.success('Novel unpublished')
    } catch {
      toast.error('Failed to unpublish')
    } finally {
      setPublishing(false)
    }
  }

  async function handlePublishChapter() {
    if (!activeChapter) return
    setChapterPublishing(true)
    try {
      await publishChapter(novelId, activeChapter.id)
      // chapters state is driven by useChapters onSnapshot — will update automatically
      toast.success('Chapter published! Readers can now see it.')
    } catch {
      toast.error('Failed to publish chapter')
    } finally {
      setChapterPublishing(false)
    }
  }

  async function handleUnpublishChapter() {
    if (!activeChapter) return
    setChapterPublishing(true)
    try {
      await unpublishChapter(novelId, activeChapter.id)
      toast.success('Chapter unpublished')
    } catch {
      toast.error('Failed to unpublish chapter')
    } finally {
      setChapterPublishing(false)
    }
  }

  const handleExportPDF = useCallback(async (scope: 'all' | 'current') => {
    if (!novel) return
    if (scope === 'current' && !activeChapter) {
      toast('No chapter selected')
      return
    }

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const margin = 20
    const pageWidth = 210
    const usableWidth = pageWidth - margin * 2
    const lineHeight = 7
    let y = margin

    const addText = (text: string, fontSize: number, bold = false, extraPadding = 0) => {
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, usableWidth) as string[]
      lines.forEach((line) => {
        if (y + lineHeight > 297 - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += lineHeight
      })
      y += extraPadding
    }

    const htmlToPlainText = (html: string) => html
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()

    const addChapter = (num: number | undefined, title: string, contentHtml: string, newPage: boolean) => {
      if (newPage) {
        doc.addPage()
        y = margin
      }
      addText(`Chapter ${num ?? '?'}: ${title || 'Untitled'}`, 16, true, 6)
      addText(htmlToPlainText(contentHtml), 11, false, 4)
    }

    // Title page
    addText(novel.title || 'Untitled Novel', 24, true, 8)
    addText(`by ${novel.authorName}`, 14, false, 6)
    if (novel.synopsis) addText(novel.synopsis, 11, false, 10)

    let filename = `${novel.title || 'novel'}.pdf`

    if (scope === 'current' && activeChapter) {
      // Use the live editor state so unsaved edits are included
      addChapter(activeChapter.chapterNumber, chapterTitle || activeChapter.title, editorContent, true)
      filename = `${novel.title || 'novel'} - Chapter ${activeChapter.chapterNumber ?? ''}.pdf`
    } else {
      chapters.forEach((ch) => {
        // Current chapter may have unsaved edits — export what's on screen
        const isActive = ch.id === activeChapter?.id
        addChapter(
          ch.chapterNumber,
          isActive ? (chapterTitle || ch.title) : ch.title,
          isActive ? editorContent : (ch.content ?? ''),
          true,
        )
      })
    }

    doc.save(filename)
    toast.success(scope === 'current' ? 'Chapter PDF downloaded' : 'PDF downloaded')
  }, [novel, chapters, activeChapter, chapterTitle, editorContent])

  // The reader wraps the story in mandatory branding pages: CreditsPoster +
  // TitlePage before chapter 1, EndingPoster after the final chapter. The
  // canvas previews them in the same positions, locked (they are structural —
  // pure functions of novel data — so nothing in the editor can remove them).
  const isFirstChapter =
    !!activeChapter && chapters.length > 0 && chapters[0].id === activeChapter.id
  const isLastChapter =
    !!activeChapter && chapters.length > 0 && chapters[chapters.length - 1].id === activeChapter.id

  const isLoading = authLoading || novelLoading || chaptersLoading

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg" role="status" aria-label="Loading editor">
        <Loader2 size={24} className="text-white/30 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!novel) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg flex-col gap-4">
        <BookOpen size={32} className="text-white/20" aria-hidden="true" />
        <p className="text-white/50">Novel not found</p>
        <button type="button" onClick={() => router.push('/create/novel')} className="btn-accent text-sm">
          Back to Novel Studio
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-bg ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>
      {/* Top toolbar */}
      <EditorToolbar
        novel={novel}
        chapter={activeChapter}
        saveState={saveState}
        onSave={saveChapter}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onPublishChapter={handlePublishChapter}
        onUnpublishChapter={handleUnpublishChapter}
        onExportPDF={handleExportPDF}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        isFullscreen={fullscreen}
        chapterPublishing={chapterPublishing}
      />

      {/* Three-column editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chapter sidebar */}
        {!fullscreen && (
          <ChapterSidebar
            novelId={novelId}
            chapters={chapters}
            activeChapterId={activeChapter?.id ?? null}
            onSelectChapter={selectChapter}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
        )}

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black">
          {activeChapter ? (
            <>
              {/* Chapter title input — styled like the reader heading */}
              <div className="bg-black border-b border-white/8">
                <div className="max-w-[680px] mx-auto px-6 sm:px-10 pt-10 pb-4">
                  <div className="canvas-beam !mx-0 !mb-6" aria-hidden="true" />
                  <p className="text-[10px] tracking-[0.5em] text-white/25 uppercase mb-2">
                    Chapter {activeChapter.chapterNumber}
                  </p>
                  <input
                    type="text"
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    placeholder="Chapter Title"
                    className="editor-chapter-title w-full bg-transparent font-black text-white placeholder:text-white/15 outline-none focus-visible:outline-none"
                    aria-label="Chapter title"
                    onBlur={() => {
                      if (activeChapter && chapterTitle !== activeChapter.title) {
                        import('@/lib/firebase/firestore').then(({ updateChapter }) => {
                          updateChapter(novelId, activeChapter.id, { title: chapterTitle }).catch(() => {})
                        })
                      }
                    }}
                  />
                  <div className="h-px w-12 bg-white/15 mt-5" />
                </div>
              </div>

              {/* TipTap editor — canvas framed by the locked branding pages
                  exactly where readers see them */}
              <div className="flex-1 overflow-hidden">
                <NovelRichEditor
                  content={editorContent}
                  onChange={handleEditorChange}
                  placeholder="Begin your story here…"
                  beforeContent={
                    isFirstChapter ? (
                      <>
                        <div className="group/brand relative">
                          {/* inert: preview only — links inside must not steal focus/clicks */}
                          <div inert className="select-none">
                            <CreditsPoster novel={novel} chapterNumber={activeChapter.chapterNumber ?? 1} />
                            <TitlePage
                              novel={novel}
                              chapterTitle={chapterTitle || activeChapter.title}
                              chapterNumber={activeChapter.chapterNumber ?? 1}
                            />
                          </div>
                          <div className="absolute inset-x-0 top-0 flex items-start p-2 opacity-0 group-hover/brand:opacity-100 transition-opacity duration-200 bg-gradient-to-b from-black/60 to-transparent pb-8 pointer-events-none">
                            <span className="flex items-center gap-1 text-[10px] bg-black/70 backdrop-blur-sm text-warning font-semibold px-2 py-0.5 rounded-full mt-0.5">
                              <Lock size={9} aria-hidden="true" />
                              Intro pages · Locked
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2.5 py-2.5 border-y border-dashed border-white/10 bg-white/[0.02]">
                          <Lock size={10} className="text-warning" aria-hidden="true" />
                          <span className="text-[9px] tracking-[0.3em] uppercase text-white/30">
                            Branding pages above are locked · your story starts below
                          </span>
                        </div>
                      </>
                    ) : undefined
                  }
                  afterContent={
                    isLastChapter ? (
                      <>
                        <div className="flex items-center justify-center gap-2.5 py-2.5 border-y border-dashed border-white/10 bg-white/[0.02]">
                          <Lock size={10} className="text-warning" aria-hidden="true" />
                          <span className="text-[9px] tracking-[0.3em] uppercase text-white/30">
                            Ending page · locked · shown after your final chapter
                          </span>
                        </div>
                        <div className="group/brand relative">
                          {/* inert: preview only — the poster's CTA links must not navigate mid-edit */}
                          <div inert className="select-none">
                            <EndingPoster novel={novel} />
                          </div>
                          <div className="absolute inset-x-0 top-0 flex items-start p-2 opacity-0 group-hover/brand:opacity-100 transition-opacity duration-200 bg-gradient-to-b from-black/60 to-transparent pb-8 pointer-events-none">
                            <span className="flex items-center gap-1 text-[10px] bg-black/70 backdrop-blur-sm text-warning font-semibold px-2 py-0.5 rounded-full mt-0.5">
                              <Lock size={9} aria-hidden="true" />
                              Ending page · Locked
                            </span>
                          </div>
                        </div>
                      </>
                    ) : undefined
                  }
                />
              </div>
            </>
          ) : (
            /* No chapter selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8" role="status">
              <BookOpen size={40} className="text-white/10 mb-4" aria-hidden="true" />
              <h2 className="text-base font-medium text-white/40 mb-2">No chapter selected</h2>
              <p className="text-sm text-white/25 max-w-xs">
                {chapters.length === 0
                  ? 'Click "Add Chapter" in the sidebar to start writing.'
                  : 'Select a chapter from the sidebar to begin editing.'}
              </p>
            </div>
          )}
        </div>

        {/* Right: AI Assistant */}
        {!fullscreen && (
          <AIAssistant
            novel={novel}
            chapter={activeChapter}
            chapters={chapters}
            novelId={novelId}
            collapsed={aiCollapsed}
            onToggleCollapse={() => setAiCollapsed((v) => !v)}
            onApplyChapter={handleApplyAIChapter}
          />
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
      </p>
    </div>
  )
}
