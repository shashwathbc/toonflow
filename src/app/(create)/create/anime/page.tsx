import type { Metadata } from 'next'
import AnimeStudioHome from '@/components/create/anime/AnimeStudioHome'
import { isVideoGenerationConfigured } from '@/lib/anime/provider'

export const metadata: Metadata = {
  title: 'Anime Studio — Create anime videos with AI',
  description:
    'Turn your ideas into anime scenes, stories, trailers, shorts, and cinematic sequences using AI.',
  // A creator workspace, not a public page. robots.ts already disallows /create;
  // this makes the page itself explicit for crawlers that arrive some other way.
  robots: { index: false, follow: false },
}

export default function AnimeStudioPage() {
  // Resolved on the SERVER: whether a video provider is connected depends on
  // env vars the browser never sees, and a client-side guess about it would be
  // exactly the kind of "looks like it works" fiction this build avoids.
  return <AnimeStudioHome providerConnected={isVideoGenerationConfigured()} />
}
