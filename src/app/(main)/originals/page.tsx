import type { Metadata } from 'next'
import { Tv2 } from 'lucide-react'
import { OriginalsClient } from './OriginalsClient'

export const metadata: Metadata = {
  title: 'Originals — Exclusive Toonflow Content',
  description: 'Exclusive webtoons and novels created by top creators — only on Toonflow Studio Paint.',
}

export default function OriginalsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Tv2 size={24} className="text-accent" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-white">Toonflow Originals</h1>
      </div>
      <p className="text-white/50 mb-8 max-w-xl">
        Exclusive webtoons and novels created by top creators — only on Toonflow Studio Paint.
      </p>
      <OriginalsClient />
    </div>
  )
}
