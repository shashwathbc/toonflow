import type { Metadata } from 'next'
import ProjectWorkspace from '@/components/create/anime/ProjectWorkspace'
import { isVideoGenerationConfigured } from '@/lib/anime/provider'
import { verifiedUidFromCookies } from '@/lib/auth/serverSession'
import { resolveTier } from '@/lib/auth/entitlements'

export const metadata: Metadata = {
  title: 'Project — Anime Studio',
  // A private workspace. Never index, never follow into it.
  robots: { index: false, follow: false },
}

export default async function AnimeProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  // The entitlement tier is resolved SERVER-SIDE from the verified session and
  // passed down purely so the prompt UI can grey out controls the account can't
  // use. It is never the enforcement point — /api/anime/jobs re-resolves the
  // same tier from the database on every submission.
  const uid = await verifiedUidFromCookies()
  const tier = uid ? await resolveTier(uid) : 'free'

  return (
    <ProjectWorkspace
      projectId={projectId}
      providerConnected={isVideoGenerationConfigured()}
      tier={tier}
    />
  )
}
