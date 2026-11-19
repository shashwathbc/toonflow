import type { Metadata } from 'next'
import { Tv2 } from 'lucide-react'
import { OriginalsClient } from './OriginalsClient'

export const metadata: Metadata = {
  // Brand omitted on purpose — the root template appends it.
  title: 'Originals',
  // Differs from the on-page intro copy below; an identical meta description
  // and first body line reads as duplication to search engines.
  description: 'Original novels and webtoons published by Toonflow creators.',
}

export default function OriginalsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Tv2 size={24} className="text-accent" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text">Toonflow Originals</h1>
      </div>
      <p className="text-text-secondary mb-8 max-w-xl">
        Novels and webtoons published from the Create studio by Toonflow creators.
      </p>
      <OriginalsClient />
    </div>
  )
}
