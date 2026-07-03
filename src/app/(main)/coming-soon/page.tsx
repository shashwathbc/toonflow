import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Wallet, Palette, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Coming Soon — Toonflow Studio Paint',
  description: 'This feature is launching soon on Toonflow Studio Paint.',
}

const FEATURE_COPY = {
  studio: {
    icon: Palette,
    title: 'Webtoon Studio is coming soon',
    message:
      'The long vertical canvas creator with AI panel generation is in the final stretch. Webtoon creation opens shortly after launch.',
  },
  wallet: {
    icon: Wallet,
    title: 'Wallet is coming soon',
    message:
      'Token purchases, creator earnings and payouts are almost ready. For now, enjoy reading — everything on Toonflow is free during launch.',
  },
  default: {
    icon: Sparkles,
    title: 'Coming soon',
    message: 'This feature is not available yet, but it is on the way. Check back soon!',
  },
} as const

interface PageProps {
  searchParams: Promise<{ feature?: string }>
}

export default async function ComingSoonPage({ searchParams }: PageProps) {
  const { feature } = await searchParams
  const copy =
    feature === 'studio' ? FEATURE_COPY.studio
    : feature === 'wallet' ? FEATURE_COPY.wallet
    : FEATURE_COPY.default
  const Icon = copy.icon

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-20">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center">
          <Icon size={32} className="text-accent" aria-hidden="true" />
        </div>
        <span className="absolute -top-2 -right-2 flex h-4 w-4" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-accent" />
        </span>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-3">
        Launching soon
      </p>
      <h1 className="text-2xl sm:text-3xl font-bold text-text mb-4 max-w-md">{copy.title}</h1>
      <p className="text-sm text-text-secondary leading-relaxed max-w-md mb-10">{copy.message}</p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Link
          href="/"
          className="btn-accent text-sm px-5 py-2.5 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to Home
        </Link>
        <Link
          href="/browse"
          className="btn-ghost border border-bg-border text-sm px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-accent"
        >
          Browse Stories
        </Link>
      </div>
    </div>
  )
}
