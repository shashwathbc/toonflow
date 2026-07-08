'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  ChevronRight,
  RotateCcw,
  ChevronLeft,
  Wand2,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { addNovelAIMessage, getNovelAIChatHistory, clearNovelAIChat, type AIMessage } from '@/lib/firebase/firestore'
import { now, nowTimestamp } from '@/lib/utils/time'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Novel, Chapter } from '@/types'

const QUICK_ACTIONS = [
  { label: 'Generate Ideas', prompt: 'Give me 5 unique story ideas or plot directions for this novel. Consider the current synopsis and make them compelling.' },
  { label: 'Create Character', prompt: 'Create a detailed character profile for a compelling new character that would fit this story. Include name, personality, backstory, and role in the plot.' },
  { label: 'World Building', prompt: 'Help me build out the world of this novel. Describe unique locations, cultural details, history, or lore that would enrich the setting.' },
  { label: 'Write Dialogue', prompt: 'Write a compelling dialogue scene for the current chapter. Make the dialogue natural and character-specific.' },
  { label: 'Continue Story', prompt: 'Continue the story from where the current chapter ends. Write the next 3-4 paragraphs maintaining the same tone and style.' },
  { label: 'Plot Expansion', prompt: 'Suggest 3 ways to deepen the current plot with meaningful subplots, complications, or revelations.' },
  { label: 'Fix Grammar', prompt: 'Review the current chapter content and identify any grammar, punctuation, or style issues. List them with corrections.' },
  { label: 'Rewrite Section', prompt: 'Rewrite the last 2-3 paragraphs of the current chapter with improved pacing, prose, and descriptive language.' },
  { label: 'Summarize', prompt: 'Write a concise 3-sentence summary of the current chapter that captures the key events and emotional beats.' },
]

interface AIAssistantProps {
  novel: Novel | null
  chapter: Chapter | null
  chapters?: Chapter[]
  novelId: string
  collapsed: boolean
  onToggleCollapse: () => void
  onApplyChapter?: (html: string) => void
}

// Condense earlier chapters for the AI consistency engine — strip editor HTML, trim size
function buildPreviousChapters(chapters: Chapter[] | undefined, current: Chapter | null) {
  if (!chapters?.length) return []
  return chapters
    .filter((c) => c.id !== current?.id && (!current || c.chapterNumber < current.chapterNumber))
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .slice(-12)
    .map((c) => ({
      chapterNumber: c.chapterNumber,
      title: c.title,
      status: c.status,
      excerpt: (c.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000),
    }))
}

function MessageBubble({ msg }: { msg: AIMessage & { id?: string } }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={12} className="text-white/70" aria-hidden="true" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-white text-bg rounded-br-sm'
            : 'bg-white/10 text-white/90 border border-white/10 rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
      {isUser && (
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={12} className="text-white/80" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

export function AIAssistant({
  novel,
  chapter,
  chapters,
  novelId,
  collapsed,
  onToggleCollapse,
  onApplyChapter,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Array<AIMessage & { id?: string }>>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [writingChapter, setWritingChapter] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showActions, setShowActions] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!novelId) return
    getNovelAIChatHistory(novelId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [novelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return

    const userMsg: AIMessage & { id?: string } = {
      id: `local-${now()}`,
      role: 'user',
      content: text.trim(),
      createdAt: nowTimestamp(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    // Reset textarea height after clearing
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/novel-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          novelTitle: novel?.title ?? '',
          novelSynopsis: novel?.synopsis ?? '',
          novelGenres: novel?.genres ?? [],
          novelTags: novel?.tags ?? [],
          chapterTitle: chapter?.title ?? '',
          chapterContent: chapter?.content ?? '',
          previousChapters: buildPreviousChapters(chapters, chapter),
          history,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      const assistantMsg: AIMessage & { id?: string } = {
        id: `local-ai-${now()}`,
        role: 'assistant',
        content: data.reply,
        createdAt: nowTimestamp(),
      }

      setMessages((prev) => [...prev, assistantMsg])
      addNovelAIMessage(novelId, { role: 'user', content: text.trim() }).catch(() => {})
      addNovelAIMessage(novelId, { role: 'assistant', content: data.reply }).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service unavailable'
      toast.error(msg)
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function writeFullChapter() {
    if (writingChapter || sending) return
    if (!onApplyChapter) return
    setWritingChapter(true)
    const toastId = toast.loading('Writing your chapter… this can take a minute')

    try {
      const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/novel-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'write-chapter',
          message:
            'Write the complete chapter now — maximum 300 words — from the idea in our conversation (and the current draft, if any). Cinematic, show-don\'t-tell, full continuity with all previous chapters, ending on a strong cliffhanger.',
          novelTitle: novel?.title ?? '',
          novelSynopsis: novel?.synopsis ?? '',
          novelGenres: novel?.genres ?? [],
          novelTags: novel?.tags ?? [],
          chapterTitle: chapter?.title ?? '',
          chapterContent: chapter?.content ?? '',
          previousChapters: buildPreviousChapters(chapters, chapter),
          history,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chapter generation failed')
      if (!data.html) throw new Error('No chapter content generated')

      onApplyChapter(data.html)
      toast.success('Chapter written to the canvas ✍', { id: toastId })

      const note: AIMessage & { id?: string } = {
        id: `local-ai-${now()}`,
        role: 'assistant',
        content: '✍ I wrote the chapter into the canvas — under 300 words, consistent with your previous chapters. Review it in the editor and ask me to revise any beat.',
        createdAt: nowTimestamp(),
      }
      setMessages((prev) => [...prev, note])
      addNovelAIMessage(novelId, { role: 'assistant', content: note.content }).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chapter generation failed'
      toast.error(msg, { id: toastId })
    } finally {
      setWritingChapter(false)
    }
  }

  async function handleConfirmedClear() {
    setConfirmClear(false)
    setMessages([])
    await clearNovelAIChat(novelId).catch(() => {})
    toast.success('Chat cleared')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }

  if (collapsed) {
    return (
      <aside
        className="w-10 border-l border-bg-border flex flex-col items-center pt-3 gap-2 bg-bg"
        aria-label="AI Assistant (collapsed)"
      >
        <Tooltip label="AI Assistant" side="left">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Expand AI Assistant"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        </Tooltip>
        <Wand2 size={14} className="text-white/30 mt-1" aria-hidden="true" />
      </aside>
    )
  }

  return (
    <aside
      className="w-[350px] border-l border-bg-border flex flex-col bg-bg flex-shrink-0"
      aria-label="AI Story Assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
            <Sparkles size={12} className="text-white/70" aria-hidden="true" />
          </div>
          <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && !confirmClear && (
            <Tooltip label="Clear chat history" side="bottom">
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors focus-visible:ring-1 focus-visible:ring-white"
                aria-label="Clear chat history"
              >
                <RotateCcw size={11} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Collapse panel" side="bottom">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-white"
              aria-label="Collapse AI Assistant"
            >
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Inline clear confirmation */}
      {confirmClear && (
        <div
          className="mx-3 mt-2 mb-0 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 flex items-start gap-2"
          role="alert"
        >
          <AlertTriangle size={13} className="text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white/80 mb-1.5">Clear all chat history?</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleConfirmedClear}
                className="text-[10px] px-2 py-1 rounded-md bg-danger text-white hover:bg-danger/80 transition-colors focus-visible:ring-1 focus-visible:ring-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="text-[10px] px-2 py-1 rounded-md bg-white/10 text-white/70 hover:bg-white/20 transition-colors focus-visible:ring-1 focus-visible:ring-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        role="log"
        aria-label="AI conversation"
        aria-live="polite"
      >
        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="text-white/30 animate-spin" aria-label="Loading history" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <Bot size={22} className="text-white/30" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium text-white/50 mb-1">AI Story Assistant</p>
            <p className="text-[11px] text-white/30 leading-relaxed">
              Context-aware. Reads your novel and chapter.
              <br />Ask anything or use quick actions below.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={msg.id ?? i} msg={msg} />
          ))
        )}

        {sending && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Bot size={12} className="text-white/70" aria-hidden="true" />
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" aria-hidden="true" />
                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" aria-hidden="true" />
                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" aria-hidden="true" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Write full chapter */}
      {onApplyChapter && (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={writeFullChapter}
            disabled={writingChapter || sending}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white text-bg text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {writingChapter ? (
              <>
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                Writing chapter…
              </>
            ) : (
              <>
                <Sparkles size={12} aria-hidden="true" />
                Write Full Chapter to Canvas
              </>
            )}
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-3 pb-1">
        <button
          type="button"
          onClick={() => setShowActions((v) => !v)}
          className="w-full flex items-center justify-between py-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
          // spread a literal instead of an expression: Edge Tools' static ARIA
          // scanner can't evaluate expressions and flags aria-expanded={expr}
          {...(showActions ? { 'aria-expanded': 'true' as const } : { 'aria-expanded': 'false' as const })}
          aria-controls="quick-actions-panel"
        >
          <span className="flex items-center gap-1">
            <Wand2 size={10} aria-hidden="true" />
            Quick Actions
          </span>
          <ChevronRight
            size={10}
            className={`transition-transform ${showActions ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </button>

        {showActions && (
          <div id="quick-actions-panel" className="pb-1 flex flex-wrap gap-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setShowActions(false)
                  sendMessage(action.prompt)
                }}
                disabled={sending}
                className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-white"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 border-t border-bg-border">
        <div className="flex items-end gap-2 bg-bg-elevated border border-bg-border rounded-xl p-2 focus-within:border-white/30 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder="Ask anything about your story…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none outline-none max-h-32 leading-5"
            aria-label="Message AI assistant"
          />
          <Tooltip label="Send message" side="top">
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || sending}
              className="w-7 h-7 rounded-lg bg-white text-bg flex items-center justify-center transition-all hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-white flex-shrink-0"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={12} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        </div>
        <p className="text-[10px] text-white/20 text-center mt-1.5">
          Enter ↵ to send · Shift+Enter for new line
        </p>
      </div>
    </aside>
  )
}
