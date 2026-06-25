import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ImageIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Create — Studio Hub',
}

export default function CreateHubPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-text">Choose Your Studio</h1>
        <p className="text-text-secondary mt-1">
          Create novels or webtoons and share them with millions of readers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        {/* Novel Studio */}
        <Link
          href="/create/novel"
          className="card p-8 flex flex-col gap-4 hover:border-accent/40 hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label="Open Novel Studio — write and publish novels"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <BookOpen size={24} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">Novel Studio</h2>
            <p className="text-sm text-text-secondary mt-1">
              Write and publish serialized novels. Rich text editor with chapter scheduling.
            </p>
          </div>
          <div className="mt-auto">
            <span className="text-sm font-medium text-accent">Open Studio →</span>
          </div>
        </Link>

        {/* Webtoon Studio */}
        <Link
          href="/create/webtoon"
          className="card p-8 flex flex-col gap-4 hover:border-accent/40 hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label="Open Webtoon Studio — create and publish webtoons"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <ImageIcon size={24} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">Webtoon Studio</h2>
            <p className="text-sm text-text-secondary mt-1">
              Upload panels and publish webtoon episodes. Long vertical canvas creator.
            </p>
          </div>
          <div className="mt-auto">
            <span className="text-sm font-medium text-accent">Open Studio →</span>
          </div>
        </Link>
      </div>

      {/* Demo Seed Section */}
      <div className="mt-12 max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white">Want to explore instantly?</h3>
          <p className="text-xs text-text-secondary mt-1">
            Seed a pre-made project with dummy chapters/episodes to test out editing and the AI assistant.
          </p>
        </div>
        <Link href="/create/seed" className="btn-accent text-xs whitespace-nowrap px-4 py-2">
          Seed Ravana Demo
        </Link>
      </div>
    </div>
  )
}
