import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clapperboard,
  ImageIcon,
  Lock,
  Palette,
  Shirt,
  Sparkles,
  Store,
  Wand2,
} from 'lucide-react'
import { cookies } from 'next/headers'
import { EMAIL_COOKIE_NAME, canUseWebtoonStudio } from '@/lib/utils/constants'

export const metadata: Metadata = {
  title: 'Create Without Limits — Studio Hub',
  description:
    'Turn your imagination into anime videos, artwork, and products. Four studios: Anime, Art, Novel and Webtoon.',
  // The hub is behind auth and disallowed in robots.ts; say so in the page's own
  // meta too so a crawler that reaches it from an external link still backs off.
  robots: { index: false, follow: false },
}

type Tint = 'anime' | 'art' | 'novel' | 'webtoon'

/**
 * Per-studio tint classes.
 *
 * Written out as complete literals rather than composed strings — Tailwind scans
 * source text, so `bg-studio-${tint}` would never make it into the stylesheet.
 */
const TINT: Record<Tint, { icon: string; badge: string; label: string; button: string; border: string; ring: string }> = {
  anime: {
    icon: 'bg-studio-anime/12 text-studio-anime',
    badge: 'border-studio-anime/25 text-studio-anime',
    label: 'text-studio-anime',
    button: 'bg-studio-anime text-bg hover:bg-studio-anime/90',
    border: 'hover:border-studio-anime/45',
    ring: 'focus-visible:ring-studio-anime',
  },
  art: {
    icon: 'bg-studio-art/12 text-studio-art',
    badge: 'border-studio-art/25 text-studio-art',
    label: 'text-studio-art',
    button: 'bg-studio-art text-bg hover:bg-studio-art/90',
    border: 'hover:border-studio-art/45',
    ring: 'focus-visible:ring-studio-art',
  },
  novel: {
    icon: 'bg-studio-novel/12 text-studio-novel',
    badge: 'border-studio-novel/25 text-studio-novel',
    label: 'text-studio-novel',
    button: 'bg-studio-novel text-bg hover:bg-studio-novel/90',
    border: 'hover:border-studio-novel/45',
    ring: 'focus-visible:ring-studio-novel',
  },
  webtoon: {
    icon: 'bg-studio-webtoon/12 text-studio-webtoon',
    badge: 'border-studio-webtoon/25 text-studio-webtoon',
    label: 'text-studio-webtoon',
    button: 'bg-studio-webtoon text-bg hover:bg-studio-webtoon/90',
    border: 'hover:border-studio-webtoon/45',
    ring: 'focus-visible:ring-studio-webtoon',
  },
}

interface Studio {
  id: Tint
  href: string
  badge: string
  title: string
  subtitle: string
  description: string
  flow: [string, string, string, string]
  cta: string
  icon: React.ReactNode
  tourId: string
}

/**
 * All four studios share ONE card shape: icon + badge, title, subtitle,
 * description, a four-beat workflow strip, and a pinned action. Identical
 * structure is what makes the grid read as a grid — the previous layout gave
 * Anime/Art a large treatment and demoted Novel/Webtoon to list rows, which is
 * exactly the mismatch this replaces.
 *
 * Styling follows Material's dark surfaces: flat tonal fills, no glows or blur,
 * elevation expressed by a surface change on hover rather than a transform.
 */
const STUDIOS: Studio[] = [
  {
    id: 'anime',
    href: '/create/anime',
    badge: 'AI Video',
    title: 'Anime Studio',
    subtitle: 'Generate anime videos with AI',
    description:
      'Turn ideas into anime scenes, trailers and cinematic sequences with AI, then cut them together on a real timeline.',
    flow: ['Prompt', 'Generate', 'Edit', 'Publish'],
    cta: 'Open Anime Studio',
    icon: <Clapperboard size={22} aria-hidden="true" />,
    tourId: 'create-anime',
  },
  {
    id: 'art',
    href: '/create/art',
    badge: 'Art & Merch',
    title: 'Art Studio',
    subtitle: 'Create art & merchandise',
    description:
      'Design artwork and put it on tees, hoodies, caps and posters — then publish and sell it in the marketplace.',
    flow: ['Design', 'Publish', 'Sell', 'Deliver'],
    cta: 'Open Art Studio',
    icon: <Palette size={22} aria-hidden="true" />,
    tourId: 'create-art',
  },
  {
    id: 'novel',
    href: '/create/novel',
    badge: 'Writing',
    title: 'Novel Studio',
    subtitle: 'Write & publish serialized novels',
    description:
      'Write chapters in a distraction-free editor with scheduling, AI writing assistance and reader analytics.',
    flow: ['Write', 'Schedule', 'Publish', 'Earn'],
    cta: 'Open Novel Studio',
    icon: <BookOpen size={22} aria-hidden="true" />,
    tourId: 'create-novel',
  },
  {
    id: 'webtoon',
    href: '/create/webtoon',
    badge: 'Comics',
    title: 'Webtoon Studio',
    subtitle: 'Build episodes on an infinite canvas',
    description:
      'Lay out panels on a vertical canvas with lettering, speech bubbles, AI art and one-tap episode publishing.',
    flow: ['Draw', 'Letter', 'Publish', 'Earn'],
    cta: 'Open Webtoon Studio',
    icon: <ImageIcon size={22} aria-hidden="true" />,
    tourId: 'create-webtoon',
  },
]

function StudioCard({ studio, locked }: { studio: Studio; locked?: boolean }) {
  const tint = TINT[studio.id]

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            locked ? 'bg-bg-elevated text-text-muted' : tint.icon
          }`}
        >
          {studio.icon}
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
            <Lock size={9} aria-hidden="true" />
            Soon
          </span>
        ) : (
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tint.badge}`}
          >
            {studio.badge}
          </span>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-xl font-bold tracking-tight text-text">{studio.title}</h3>
        <p className={`mt-1 text-sm font-medium ${locked ? 'text-text-muted' : tint.label}`}>
          {studio.subtitle}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{studio.description}</p>
      </div>

      {/* Four-beat workflow, so each card promises a journey rather than a feature. */}
      <ol className="mt-5 flex flex-wrap items-center gap-1.5" aria-label={`${studio.title} workflow`}>
        {studio.flow.map((step, index) => (
          <li key={step} className="flex items-center gap-1.5">
            <span className="rounded-lg bg-bg-elevated px-2 py-1 text-[11px] font-medium text-text-secondary">
              {step}
            </span>
            {index < studio.flow.length - 1 && (
              <ChevronRight size={11} className="text-text-muted" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      {/* mt-auto pins every action to the same baseline across the row. */}
      <div className="mt-auto pt-6">
        {locked ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-bg-elevated px-4 py-2.5 text-sm font-semibold text-text-muted">
            <Lock size={14} aria-hidden="true" />
            Launching soon
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${tint.button}`}
          >
            {studio.cta}
            <ArrowRight size={15} aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  )

  const shell =
    'flex h-full flex-col rounded-3xl border border-bg-border bg-bg-card p-6 lg:p-7'

  if (locked) {
    return (
      <div
        data-tour={studio.tourId}
        className={`${shell} opacity-75`}
        aria-label={`${studio.title} — launching soon`}
      >
        {body}
      </div>
    )
  }

  return (
    <Link
      href={studio.href}
      data-tour={studio.tourId}
      // Material-style interaction: the surface lifts a tone on hover instead of
      // translating. Cheaper, calmer, and nothing to suppress for reduced motion.
      className={`group ${shell} transition-colors duration-150 hover:bg-bg-elevated ${TINT[studio.id].border} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${TINT[studio.id].ring}`}
      aria-label={`${studio.title} — ${studio.subtitle}`}
    >
      {body}
    </Link>
  )
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-bg-border bg-bg-card px-4 py-3.5 transition-colors duration-150 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="shrink-0 text-text-secondary" aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm font-medium text-text">{label}</span>
      <ChevronRight
        size={16}
        className="ml-auto shrink-0 text-text-muted transition-colors group-hover:text-text"
        aria-hidden="true"
      />
    </Link>
  )
}

export default async function CreateHubPage() {
  // Server-set email cookie (from the verified session) — same source the
  // middleware gate uses, so the card and the /create/webtoon gate always agree.
  const email = (await cookies()).get(EMAIL_COOKIE_NAME)?.value
  const canUseWebtoon = canUseWebtoonStudio(email)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        {/* Hero */}
        <header className="mb-9 max-w-3xl lg:mb-12">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-bg-border bg-bg-card px-3 py-1 text-xs font-medium text-text-secondary">
            <Sparkles size={12} aria-hidden="true" />
            Creator Studio
          </p>
          <h1 className="text-3xl font-black tracking-tight text-text sm:text-5xl">
            Create Without Limits
          </h1>
          <p className="mt-3 text-base text-text-secondary sm:text-lg">
            Turn your imagination into anime videos, artwork, and products.
          </p>
        </header>

        {/* One uniform grid — every studio gets the same card. */}
        <section aria-labelledby="studios-heading">
          <h2 id="studios-heading" className="sr-only">
            Choose a studio
          </h2>
          <div
            data-tour="create-studios"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5"
          >
            {STUDIOS.map((studio) => (
              <StudioCard
                key={studio.id}
                studio={studio}
                locked={studio.id === 'webtoon' && !canUseWebtoon}
              />
            ))}
          </div>
        </section>

        {/* Where the work ends up */}
        <section className="mt-10 lg:mt-14" aria-labelledby="next-steps-heading">
          <h2 id="next-steps-heading" className="sr-only">
            Where your work goes next
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickLink
              href="/marketplace"
              icon={<Store size={17} aria-hidden="true" />}
              label="Browse the Marketplace"
            />
            <QuickLink
              href="/marketplace/merch"
              icon={<Shirt size={17} aria-hidden="true" />}
              label="See merch designs"
            />
            <QuickLink
              href="/create/anime/projects"
              icon={<Wand2 size={17} aria-hidden="true" />}
              label="Continue a project"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
