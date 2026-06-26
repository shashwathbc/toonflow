import type { Metadata } from 'next'
import { Tv2 } from 'lucide-react'

export const dynamic = 'force-static'
export const revalidate = false

export const metadata: Metadata = {
  title: 'Originals — Exclusive Toonflow Content',
  description: 'Exclusive webtoons and novels created by top creators — only on Toonflow Studio Paint.',
}

export default function OriginalsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Tv2 size={24} className="text-accent" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text">Toonflow Originals</h1>
      </div>
      <p className="text-text-secondary mb-8 max-w-xl">
        Exclusive webtoons and novels created by top creators — only on Toonflow Studio Paint.
      </p>

      {/* Grid */}
      <section aria-labelledby="originals-grid-heading">
        <h2 id="originals-grid-heading" className="sr-only">Originals content grid</h2>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
          aria-label="Original content"
        >
          <p className="col-span-full text-text-muted text-sm">No originals published yet. Check back soon!</p>
        </div>
      </section>
    </div>
  )
}
