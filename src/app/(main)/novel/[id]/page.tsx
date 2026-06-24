import type { Metadata } from 'next'
import { BookOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Novel',
}

interface NovelPageProps {
  params: Promise<{ id: string }>
}

export default async function NovelDetailPage({ params }: NovelPageProps) {
  const { id } = await params

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex gap-8 flex-col md:flex-row">
        {/* Cover */}
        <div
          className="w-48 shrink-0 aspect-[2/3] bg-bg-elevated rounded-xl flex items-center justify-center"
          role="img"
          aria-label="Novel cover"
        >
          <BookOpen size={32} className="text-text-muted" aria-hidden="true" />
        </div>

        {/* Info */}
        <div className="space-y-4 flex-1">
          <p className="text-xs text-text-muted">Novel ID: {id}</p>
          <h1 className="text-2xl font-bold text-text">Loading novel…</h1>
          <p className="text-text-secondary">Novel details will be loaded here.</p>
          <button className="btn-accent" aria-label="Start reading this novel">
            Read Now
          </button>
        </div>
      </div>

      {/* Chapter list */}
      <section className="mt-12" aria-labelledby="chapters-heading">
        <h2 id="chapters-heading" className="section-heading mb-4">Chapters</h2>
        <p className="text-text-muted text-sm">No chapters available yet.</p>
      </section>
    </div>
  )
}
