import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clapperboard, Eye, Film, Heart } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import ListingViewTracker from '@/components/marketplace/ListingViewTracker'
import AnimeWatchPlayer from '@/components/anime/AnimeWatchPlayer'
import { adminDb } from '@/lib/firebase/serverApp'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import type { AnimeProject, AnimeScene } from '@/types/anime'

// Per request, like the marketplace listings: publication state, view counts and
// the scene list can all change at any moment, and an ISR-cached page would keep
// serving an unpublished title until its window lapsed.
export const dynamic = 'force-dynamic'

interface WatchData {
  project: AnimeProject
  scenes: AnimeScene[]
}

/**
 * Read a PUBLISHED anime title plus its playable scenes.
 *
 * Runs on the Admin SDK (which bypasses Firestore rules), so the publication
 * check is repeated here explicitly — a draft must never be reachable by
 * guessing its id. `unlisted` IS reachable by direct link (that is what unlisted
 * means) but is excluded from the sitemap and marked noindex below.
 */
async function getWatchData(projectId: string): Promise<WatchData | null> {
  try {
    const db = adminDb()
    const snap = await db.collection('animeProjects').doc(projectId).get()
    if (!snap.exists) return null
    if (snap.get('status') !== 'published' || snap.get('visibility') === 'private') return null

    const sceneSnap = await snap.ref.collection('scenes').orderBy('order', 'asc').get()
    const scenes = sceneSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as AnimeScene)
      // Only scenes that actually hold video. An ungenerated scene has nothing
      // to play and would render as a dead gap in the playlist.
      .filter((scene) => scene.status === 'ready' && Boolean(scene.storageKey))

    const plain = JSON.parse(
      JSON.stringify({
        project: { id: snap.id, ...snap.data(), createdAt: null, updatedAt: null, publishedAt: null },
        scenes: scenes.map((scene) => ({ ...scene, createdAt: null, updatedAt: null })),
      }),
    ) as WatchData
    return plain
  } catch (err) {
    console.error('[anime watch] read failed', err)
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>
}): Promise<Metadata> {
  const { projectId } = await params
  const data = await getWatchData(projectId)
  if (!data) return { title: 'Anime not found', robots: { index: false, follow: false } }

  const { project } = data
  const title = `${toTitleCase(project.title)} — Anime`
  const description =
    project.description.slice(0, 155) ||
    `Watch ${toTitleCase(project.title)}, an AI-generated anime by ${project.ownerName} on ${APP_NAME}.`

  return {
    title,
    description,
    alternates: { canonical: `/anime/${project.id}` },
    // `unlisted` is link-only: reachable, never indexed.
    robots: project.visibility === 'public' ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'video.other',
      title,
      description,
      url: `${APP_URL}/anime/${project.id}`,
      siteName: APP_NAME,
      images: project.thumbnailURL ? [{ url: project.thumbnailURL, alt: project.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      site: SOCIAL_HANDLE,
      title,
      description,
      images: project.thumbnailURL ? [project.thumbnailURL] : undefined,
    },
  }
}

export default async function AnimeWatchPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const data = await getWatchData(projectId)
  if (!data) notFound()

  const { project, scenes } = data
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.durationSec, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <ListingViewTracker kind="anime" id={project.id} />

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: project.title,
          description: project.description || undefined,
          thumbnailUrl: project.thumbnailURL ?? undefined,
          // Duration is the summed scene length in ISO 8601 — real numbers from
          // what the provider actually returned, not an estimate.
          duration: `PT${Math.max(1, Math.round(totalDuration))}S`,
          creator: { '@type': 'Person', name: project.ownerName },
          url: `${APP_URL}/anime/${project.id}`,
          isFamilyFriendly: true,
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-text-secondary">
        <ol className="flex flex-wrap items-center gap-1.5" role="list">
          <li>
            <Link
              href="/browse"
              className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Browse
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/browse?type=anime"
              className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Anime
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text" aria-current="page">
            {toTitleCase(project.title)}
          </li>
        </ol>
      </nav>

      <AnimeWatchPlayer
        projectId={project.id}
        scenes={scenes}
        aspectRatio={project.defaults?.aspectRatio ?? '16:9'}
        poster={project.thumbnailURL}
      />

      <header className="mt-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-studio-anime/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-studio-anime">
          <Clapperboard size={10} aria-hidden="true" />
          Anime
        </span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-text lg:text-3xl">
          {toTitleCase(project.title)}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link
            href={`/profile/${project.ownerId}`}
            className="inline-flex items-center gap-2 rounded-lg text-sm text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {project.ownerPhotoURL && (
              <Image
                src={project.ownerPhotoURL}
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] rounded-full object-cover"
              />
            )}
            by <span className="font-semibold text-text">{project.ownerName}</span>
          </Link>

          <dl className="flex items-center gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <Eye size={12} aria-hidden="true" />
              <dt className="sr-only">Views</dt>
              <dd>{formatCount(project.viewCount)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart size={12} aria-hidden="true" />
              <dt className="sr-only">Likes</dt>
              <dd>{formatCount(project.likeCount)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Film size={12} aria-hidden="true" />
              <dt className="sr-only">Scenes</dt>
              <dd>
                {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Duration</dt>
              <dd className="tabular-nums">{Math.round(totalDuration)}s</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* AI disclosure is a platform policy commitment, so it is stated on the
          page rather than buried in metadata. */}
      <p className="mt-4 rounded-xl border border-bg-border bg-bg-card px-3.5 py-2.5 text-xs text-text-secondary">
        This anime was generated with AI in the Toonflow Anime Studio.
      </p>

      {project.description && (
        <section className="mt-6" aria-labelledby="anime-description">
          <h2 id="anime-description" className="mb-2 text-sm font-bold text-text">
            About
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {project.description}
          </p>
        </section>
      )}

      {project.genres?.length > 0 && (
        <section className="mt-6" aria-labelledby="anime-genres">
          <h2 id="anime-genres" className="mb-2 text-sm font-bold text-text">
            Genres
          </h2>
          <ul className="flex flex-wrap gap-1.5" role="list">
            {project.genres.map((genre) => (
              <li key={genre}>
                <Link
                  href={`/browse?type=anime&genre=${encodeURIComponent(genre)}`}
                  className="inline-block rounded-full border border-bg-border px-2.5 py-1 text-[11px] capitalize text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {genre.replace('-', ' ')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
