'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  RotateCcw,
  RotateCw,
} from 'lucide-react'

interface NovelRichEditorProps {
  content: string
  onChange: (html: string, wordCount: number) => void
  placeholder?: string
  readOnly?: boolean
}

function ToolbarBtn({
  onClick,
  isActive,
  label,
  children,
  disabled,
}: {
  onClick: () => void
  isActive: boolean
  label: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      {...(isActive ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
      title={label}
      className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:opacity-30 ${
        isActive
          ? 'bg-white text-bg'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
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
}: NovelRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Underline,
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

  // Sync content when active chapter changes
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
          className="flex items-center gap-0.5 px-4 py-2 border-b border-bg-border flex-wrap sticky top-14 bg-bg-card z-10"
          role="toolbar"
          aria-label="Text formatting"
        >
          <ToolbarBtn
            onClick={() => editor.chain().focus().undo().run()}
            isActive={false}
            label="Undo"
            disabled={!editor.can().undo()}
          >
            <RotateCcw size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().redo().run()}
            isActive={false}
            label="Redo"
            disabled={!editor.can().redo()}
          >
            <RotateCw size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            label="Bold (Ctrl+B)"
          >
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            label="Italic (Ctrl+I)"
          >
            <Italic size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            label="Underline (Ctrl+U)"
          >
            <UnderlineIcon size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            label="Strikethrough"
          >
            <Strikethrough size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            label="Heading 1"
          >
            <Heading1 size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            label="Heading 2"
          >
            <Heading2 size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            label="Heading 3"
          >
            <Heading3 size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            label="Bullet List"
          >
            <List size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            label="Numbered List"
          >
            <ListOrdered size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            label="Blockquote"
          >
            <Quote size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            label="Inline Code"
          >
            <Code size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            isActive={false}
            label="Horizontal Rule"
          >
            <Minus size={13} />
          </ToolbarBtn>
        </div>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-editor mx-auto px-8 py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Stats footer */}
      <div
        className="flex items-center gap-4 px-8 py-2 border-t border-bg-border text-[11px] text-white/30"
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
