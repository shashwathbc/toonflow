'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus,
  RotateCcw, RotateCw,
  AlignLeft, AlignCenter, AlignRight,
  Palette,
} from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface NovelRichEditorProps {
  content: string
  onChange: (html: string, wordCount: number) => void
  placeholder?: string
  readOnly?: boolean
  /** Rendered inside the canvas scroll area above the editable content —
      used for the locked branding pages readers see before the chapter */
  beforeContent?: React.ReactNode
  /** Rendered inside the canvas scroll area below the editable content */
  afterContent?: React.ReactNode
  /** Fixed (non-scrolling) block rendered directly below the formatting
      toolbar — used for the chapter title header */
  titleSlot?: React.ReactNode
}

// Text color swatches for the palette
const COLORS = [
  { label: 'White',   value: '#FFFFFF',               cls: 'bg-white' },
  { label: 'Muted',   value: 'rgba(255,255,255,0.5)', cls: 'bg-white/50' },
  { label: 'Gold',    value: '#C9A84C',               cls: 'bg-[#C9A84C]' },
  { label: 'Crimson', value: '#E05252',               cls: 'bg-[#E05252]' },
  { label: 'Frost',   value: '#7EC8E3',               cls: 'bg-[#7EC8E3]' },
  { label: 'Sage',    value: '#7CB87C',               cls: 'bg-[#7CB87C]' },
]

function ToolbarBtn({
  onClick, isActive, label, children, disabled,
}: {
  onClick: () => void
  isActive: boolean
  label: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        {...(isActive ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
        className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:opacity-30 ${
          isActive
            ? 'bg-white text-black'
            : 'text-white/50 hover:bg-white/10 hover:text-white'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-white/10 mx-0.5 self-center" aria-hidden="true" />
}

export function NovelRichEditor({
  content,
  onChange,
  placeholder = 'Begin your story here…',
  readOnly = false,
  beforeContent,
  afterContent,
  titleSlot,
}: NovelRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
    ],
    content: content || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      const words = e.storage.characterCount.words() as number
      onChange(e.getHTML(), words)
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
        'aria-label': 'Chapter content editor',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current) {
      editor.commands.setContent(content || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const words = editor?.storage.characterCount.words() ?? 0
  const chars = editor?.storage.characterCount.characters() ?? 0
  const readingMinutes = Math.max(1, Math.ceil(words / 250))

  return (
    <div className="flex flex-col h-full">
      {/* Formatting toolbar */}
      {!readOnly && editor && (
        <div
          className="flex items-center gap-0.5 px-3 py-1.5 border-b border-white/8 flex-wrap bg-black flex-shrink-0"
          role="toolbar"
          aria-label="Text formatting"
        >
          {/* Undo / Redo */}
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} isActive={false} label="Undo" disabled={!editor.can().undo()}>
            <RotateCcw size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} isActive={false} label="Redo" disabled={!editor.can().redo()}>
            <RotateCw size={12} />
          </ToolbarBtn>

          <Divider />

          {/* Inline styles */}
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} label="Bold">
            <Bold size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} label="Italic">
            <Italic size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} label="Underline">
            <UnderlineIcon size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} label="Strikethrough">
            <Strikethrough size={12} />
          </ToolbarBtn>

          <Divider />

          {/* Headings */}
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} label="Heading 1 — Large dramatic">
            <Heading1 size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} label="Heading 2 — Section">
            <Heading2 size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} label="Heading 3 — Label">
            <Heading3 size={12} />
          </ToolbarBtn>

          <Divider />

          {/* Alignment */}
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} label="Align left">
            <AlignLeft size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} label="Align center">
            <AlignCenter size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} label="Align right">
            <AlignRight size={12} />
          </ToolbarBtn>

          <Divider />

          {/* Lists + Block */}
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} label="Bullet list">
            <List size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} label="Numbered list">
            <ListOrdered size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} label="Blockquote">
            <Quote size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} label="Inline code">
            <Code size={12} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} isActive={false} label="Divider line">
            <Minus size={12} />
          </ToolbarBtn>

          <Divider />

          {/* Color palette */}
          <div className="flex items-center gap-0.5">
            <Palette size={11} className="text-white/30 ml-0.5 mr-1" aria-hidden="true" />
            {COLORS.map((c) => (
              <Tooltip key={c.value} label={`${c.label} text color`} side="bottom">
                <button
                  type="button"
                  aria-label={`Text color: ${c.label}`}
                  onClick={() => editor.chain().focus().setColor(c.value).run()}
                  className={`w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white flex-shrink-0 ${c.cls}`}
                />
              </Tooltip>
            ))}
            <Tooltip label="Reset text color" side="bottom">
              <button
                type="button"
                aria-label="Reset text color"
                onClick={() => editor.chain().focus().unsetColor().run()}
                className="ml-1 text-[10px] text-white/30 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white px-1"
              >
                ✕
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Chapter title header — fixed below the toolbar, above the canvas */}
      {titleSlot && <div className="flex-shrink-0">{titleSlot}</div>}

      {/* Editor content — optionally framed by the locked branding pages so
          the canvas scrolls exactly like the published reader */}
      <div className="flex-1 overflow-y-auto bg-black">
        {beforeContent}
        <div className="max-w-[680px] mx-auto px-6 sm:px-10 py-10 pb-24">
          <EditorContent editor={editor} />
        </div>
        {afterContent}
      </div>

      {/* Stats footer */}
      <div
        className="flex items-center gap-4 px-8 py-2 border-t border-white/8 bg-black text-[11px] text-white/25"
        aria-live="polite"
        aria-label="Document statistics"
      >
        <span>{words.toLocaleString()} words</span>
        <span aria-hidden="true">·</span>
        <span>{chars.toLocaleString()} characters</span>
        <span aria-hidden="true">·</span>
        <span>{readingMinutes} min read</span>
      </div>
    </div>
  )
}
