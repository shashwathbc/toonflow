import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArtEditorLoader from '@/components/create/art/ArtEditorLoader'
import { verifiedUidFromCookies } from '@/lib/auth/serverSession'
import { adminDb } from '@/lib/firebase/serverApp'
import type { Artwork } from '@/types/art'

export const metadata: Metadata = {
  title: 'Editor — Art Studio',
  robots: { index: false, follow: false },
}

export default async function ArtEditorPage({
  params,
}: {
  params: Promise<{ artworkId: string }>
}) {
  const { artworkId } = await params
  const uid = await verifiedUidFromCookies()
  if (!uid) notFound()

  // Ownership is checked before the bundle is even sent. The Firestore rules
  // would deny the reads anyway, but a non-owner should get a clean answer
  // rather than an editor whose every listener silently fails.
  const snap = await adminDb().collection('artworks').doc(artworkId).get()
  if (!snap.exists || snap.get('ownerId') !== uid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-text">Artwork not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          It may have been deleted, or it belongs to another account.
        </p>
        <Link href="/create/art" className="btn-accent mt-6 inline-flex px-4 py-2 text-sm">
          Back to Art Studio
        </Link>
      </div>
    )
  }

  const artwork = JSON.parse(
    JSON.stringify({ id: snap.id, ...snap.data(), createdAt: null, updatedAt: null, publishedAt: null }),
  ) as Artwork

  return <ArtEditorLoader artwork={artwork} />
}
