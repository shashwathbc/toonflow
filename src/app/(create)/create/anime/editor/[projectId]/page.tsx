import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditorLoader from '@/components/create/anime/editor/EditorLoader'
import { verifiedUidFromCookies } from '@/lib/auth/serverSession'
import { adminDb } from '@/lib/firebase/serverApp'
import type { AnimeProject } from '@/types/anime'

export const metadata: Metadata = {
  title: 'Editor — Anime Studio',
  robots: { index: false, follow: false },
}

/**
 * The editor loads its project SERVER-SIDE and refuses to render for anyone but
 * the owner.
 *
 * The Firestore rules already deny the underlying reads, but failing here means
 * a non-owner never even receives the editor bundle or the project's title —
 * and gets a clear "not found" instead of an editor that mysteriously stays
 * empty because every listener is being denied.
 */
export default async function AnimeEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const uid = await verifiedUidFromCookies()
  if (!uid) notFound()

  const snap = await adminDb().collection('animeProjects').doc(projectId).get()
  if (!snap.exists || snap.get('ownerId') !== uid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-text">Project not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          It may have been deleted, or it belongs to another account.
        </p>
        <Link href="/create/anime/projects" className="btn-accent mt-6 inline-flex px-4 py-2 text-sm">
          Back to projects
        </Link>
      </div>
    )
  }

  const data = snap.data() ?? {}
  // Firestore Timestamps aren't serializable across the RSC boundary, so hand
  // the client component plain second/nanosecond pairs — the same shape the
  // client SDK produces.
  const project = JSON.parse(
    JSON.stringify({
      id: snap.id,
      ...data,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
    }),
  ) as AnimeProject

  return <EditorLoader project={project} />
}
