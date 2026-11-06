'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { Artwork } from '@/types/art'

/**
 * Code-splits the canvas editor away from the Art Studio landing page.
 * `ssr: false` because the whole thing is built on browser canvas APIs.
 */
const ArtCanvasEditor = dynamic(() => import('./ArtCanvasEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-bg">
      <Loader2 size={26} className="animate-spin text-text-muted motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">Loading art editor…</span>
    </div>
  ),
})

export default function ArtEditorLoader({ artwork }: { artwork: Artwork }) {
  return <ArtCanvasEditor artwork={artwork} />
}
