import type { Metadata } from 'next'
import { Upload, Save } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Webtoon Episode Editor',
}

interface WebtoonEditorPageProps {
  params: Promise<{ id: string }>
}

export default async function WebtoonEditorPage({ params }: WebtoonEditorPageProps) {
  const { id } = await params
  const isNew = id === 'new'

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <header className="h-14 border-b border-bg-border flex items-center justify-between px-4">
        <input
          type="text"
          className="input-base max-w-sm text-base font-semibold"
          defaultValue={isNew ? 'New Episode' : 'Loading…'}
          aria-label="Episode title"
        />
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-sm" aria-label="Save draft episode">
            <Save size={14} aria-hidden="true" />
            Save Draft
          </button>
          <button className="btn-accent text-sm" aria-label="Publish episode">
            Publish
          </button>
        </div>
      </header>

      <main id="main-content" className="flex-1 flex overflow-hidden" tabIndex={-1}>
        {/* Panel list sidebar */}
        <aside className="w-56 border-r border-bg-border p-3 flex flex-col gap-2" aria-label="Panel list">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest px-2">Panels</p>
          <button className="btn-ghost text-sm justify-start">
            <Upload size={14} aria-hidden="true" />
            Upload Panels
          </button>
        </aside>

        {/* Canvas area */}
        <div
          className="flex-1 overflow-auto flex items-start justify-center bg-bg-elevated p-8"
          aria-label="Webtoon canvas — vertical panel layout"
        >
          <div className="w-full max-w-lg space-y-1">
            <div className="w-full aspect-[4/3] bg-bg-card border-2 border-dashed border-bg-border rounded-xl flex items-center justify-center">
              <div className="text-center space-y-2">
                <Upload size={32} className="text-text-muted mx-auto" aria-hidden="true" />
                <p className="text-sm text-text-secondary">Drop panels here or click to upload</p>
                <p className="text-xs text-text-muted">PNG, JPG, WebP — max 25MB each</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Webtoon editor — {isNew ? 'new episode' : `editing episode ${id}`}
      </p>
    </div>
  )
}
