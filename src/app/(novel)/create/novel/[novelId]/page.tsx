'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useChapters } from '@/hooks/useChapters'
import {
  getNovelById,
  updateNovel,
  updateChapterContent,
  publishNovel,
  unpublishNovel,
} from '@/lib/firebase/firestore'
import { ChapterSidebar } from '@/components/editor/ChapterSidebar'
import { NovelRichEditor } from '@/components/editor/NovelRichEditor'
import { AIAssistant } from '@/components/editor/AIAssistant'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { BookOpen, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import type { Novel, Chapter } from '@/types'

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
  const [novelLoading, setNovelLoading] = useState(true)
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)
  const [chapterTitle, setChapterTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef('')

  // Load novel
  useEffect(() => {
    setNovelLoading(true)
    getNovelById(novelId)
      .then((n) => {
        setNovel(n)
        if (n && firebaseUser && n.authorId !== firebaseUser.uid) {
          toast.error('You do not have permission to edit this novel.')
          router.push('/create/novel')
        }
      })
      .catch(() => toast.error('Failed to load novel'))
      .finally(() => setNovelLoading(false))
  }, [novelId, firebaseUser, router])

  // Auto-select first chapter when chapters load
  useEffect(() => {
    if (chapters.length > 0 && !activeChapter) {
      selectChapter(chapters[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters])

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

  const handleExportPDF = useCallback(() => {
    if (!novel) return
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

    // Title page
    addText(novel.title || 'Untitled Novel', 24, true, 8)
    addText(`by ${novel.authorName}`, 14, false, 6)
    if (novel.synopsis) addText(novel.synopsis, 11, false, 10)

    // Chapters
    chapters.forEach((ch) => {
      doc.addPage()
      y = margin
      addText(`Chapter ${ch.chapterNumber}: ${ch.title}`, 16, true, 6)

      // Strip HTML tags for PDF text
      const plainText = (ch.content ?? '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()

      addText(plainText, 11, false, 4)
    })

    doc.save(`${novel.title || 'novel'}.pdf`)
    toast.success('PDF downloaded')
  }, [novel, chapters])

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
        <button onClick={() => router.push('/create/novel')} className="btn-accent text-sm">
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
        onExportPDF={handleExportPDF}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        isFullscreen={fullscreen}
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
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-card">
          {activeChapter ? (
            <>
              {/* Chapter title input */}
              <div className="px-8 pt-6 pb-2 border-b border-bg-border">
                <input
                  type="text"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="Chapter Title"
                  className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 outline-none focus-visible:ring-0"
                  aria-label="Chapter title"
                  onBlur={() => {
                    if (activeChapter && chapterTitle !== activeChapter.title) {
                      import('@/lib/firebase/firestore').then(({ updateChapter }) => {
                        updateChapter(novelId, activeChapter.id, { title: chapterTitle }).catch(() => {})
                      })
                    }
                  }}
                />
              </div>

              {/* TipTap editor */}
              <div className="flex-1 overflow-hidden">
                <NovelRichEditor
                  content={editorContent}
                  onChange={handleEditorChange}
                  placeholder="Begin your story here…"
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
            novelId={novelId}
            collapsed={aiCollapsed}
            onToggleCollapse={() => setAiCollapsed((v) => !v)}
          />
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
      </p>
    </div>
  )
}
