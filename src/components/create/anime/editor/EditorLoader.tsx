'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { AnimeProject } from '@/types/anime'

/**
 * Code-splits the whole video editor.
 *
 * The editor pulls in the timeline, the preview compositor, the Zustand store
 * and every panel — none of which the Create landing page, the studio home or
 * the projects grid should ever pay for. `ssr: false` because the editor is
 * built entirely around browser APIs (pointer events, <video>, rAF, container
 * queries); server-rendering it would produce markup that is thrown away on
 * hydration.
 */
const VideoEditor = dynamic(() => import('./VideoEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-bg">
      <Loader2
        size={26}
        className="animate-spin text-text-muted motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="sr-only">Loading video editor…</span>
    </div>
  ),
})

export default function EditorLoader({ project }: { project: AnimeProject }) {
  return <VideoEditor project={project} />
}
