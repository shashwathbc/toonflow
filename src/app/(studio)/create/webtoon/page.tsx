import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, ImageIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Webtoon Studio',
}

export default function WebtoonStudioPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Webtoon Studio</h1>
          <p className="text-text-secondary">Manage and publish your webtoon series.</p>
        </div>
        <Link
          href="/create/webtoon/new"
          className="btn-accent"
          aria-label="Create a new webtoon series"
        >
          <Plus size={16} aria-hidden="true" />
          New Webtoon
        </Link>
      </div>

      <div role="tablist" aria-label="Webtoon status filter" className="flex gap-2 border-b border-bg-border">
        {['All', 'Drafts', 'Published'].map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={i === 0}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              i === 0
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label="All webtoons">
        <div className="card p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center">
            <ImageIcon size={28} className="text-text-muted" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-text">No webtoons yet</p>
            <p className="text-sm text-text-secondary mt-1">
              Upload your first episode and start your webtoon series.
            </p>
          </div>
          <Link href="/create/webtoon/new" className="btn-accent">
            <Plus size={14} aria-hidden="true" />
            Create your first webtoon
          </Link>
        </div>
      </div>
    </div>
  )
}
