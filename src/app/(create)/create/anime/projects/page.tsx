import type { Metadata } from 'next'
import ProjectsBrowser from '@/components/create/anime/ProjectsBrowser'

export const metadata: Metadata = {
  title: 'My Projects — Anime Studio',
  description: 'Manage your anime video projects, scenes and reusable characters.',
  robots: { index: false, follow: false },
}

export default function AnimeProjectsPage() {
  return <ProjectsBrowser />
}
