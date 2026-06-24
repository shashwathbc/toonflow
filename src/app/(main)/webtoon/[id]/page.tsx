import type { Metadata } from 'next'
import { ImageIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Webtoon',
}

interface WebtoonPageProps {
  params: Promise<{ id: string }>
}

export default async function WebtoonDetailPage({ params }: WebtoonPageProps) {
  const { id } = await params

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex gap-8 flex-col md:flex-row">
        <div
          className="w-48 shrink-0 aspect-[2/3] bg-bg-elevated rounded-xl flex items-center justify-center"
          role="img"
          aria-label="Webtoon cover"
        >
          <ImageIcon size={32} className="text-text-muted" aria-hidden="true" />
        </div>
        <div className="space-y-4 flex-1">
          <p className="text-xs text-text-muted">Webtoon ID: {id}</p>
          <h1 className="text-2xl font-bold text-text">Loading webtoon…</h1>
          <p className="text-text-secondary">Webtoon details will be loaded here.</p>
          <button className="btn-accent" aria-label="Start reading this webtoon">
            Read Now
          </button>
        </div>
      </div>
      <section className="mt-12" aria-labelledby="episodes-heading">
        <h2 id="episodes-heading" className="section-heading mb-4">Episodes</h2>
        <p className="text-text-muted text-sm">No episodes available yet.</p>
      </section>
    </div>
  )
}
