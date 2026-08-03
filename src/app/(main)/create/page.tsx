import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ImageIcon, Wallet, LayoutDashboard, ArrowRight, Sparkles, Lock } from 'lucide-react'
import { cookies } from 'next/headers'
import { FEATURE_FLAGS, EMAIL_COOKIE_NAME, canUseWebtoonStudio } from '@/lib/utils/constants'

export const metadata: Metadata = {
  title: 'Create — Studio Hub',
}

export default async function CreateHubPage() {
  // Server-set email cookie (from the verified session) — same source the
  // middleware gate uses, so the card and the /create/webtoon gate always agree.
  const email = (await cookies()).get(EMAIL_COOKIE_NAME)?.value
  const canUseWebtoon = canUseWebtoonStudio(email)

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-accent/[0.03] blur-3xl" />
      </div>

      <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        {/* Header */}
        <div className="mb-12 lg:mb-16 max-w-2xl">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-3 py-1 mb-4">
            <Sparkles size={12} aria-hidden="true" />
            Creator Studio
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-text tracking-tight">
            Choose Your Studio
          </h1>
          <p className="text-text-secondary mt-3 text-base lg:text-lg">
            Create novels or webtoons and publish them to readers everywhere.
          </p>
        </div>

        {/* Studio cards — fill the row */}
        <div data-tour="create-studios" className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8">
          {/* Novel Studio */}
          <Link
            href="/create/novel"
            data-tour="create-novel"
            className="group relative card p-8 lg:p-12 flex flex-col gap-5 overflow-hidden hover:border-accent/40 hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label="Open Novel Studio — write and publish novels"
          >
            <div
              aria-hidden="true"
              className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/10 transition-colors duration-300"
            />
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <BookOpen size={26} className="text-accent" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-text">Novel Studio</h2>
              <p className="text-sm lg:text-base text-text-secondary mt-2 leading-relaxed">
                Write and publish serialized novels. Rich text editor with chapter
                scheduling, AI writing assistance and reader analytics.
              </p>
            </div>
            <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-semibold text-accent">
              Open Studio
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
            </div>
          </Link>

          {/* Webtoon Studio — allowlist-gated (see canUseWebtoonStudio) */}
          {canUseWebtoon ? (
            <Link
              href="/create/webtoon"
              data-tour="create-webtoon"
              className="group relative card p-8 lg:p-12 flex flex-col gap-5 overflow-hidden hover:border-accent/40 hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              aria-label="Open Webtoon Studio — create and publish webtoons"
            >
              <div
                aria-hidden="true"
                className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/10 transition-colors duration-300"
              />
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <ImageIcon size={26} className="text-accent" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-text">Webtoon Studio</h2>
                <p className="text-sm lg:text-base text-text-secondary mt-2 leading-relaxed">
                  Upload panels and publish webtoon episodes. Long vertical canvas
                  creator with drag-and-drop episode building.
                </p>
              </div>
              <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-semibold text-accent">
                Open Studio
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
              </div>
            </Link>
          ) : (
            <div
              data-tour="create-webtoon"
              className="relative card p-8 lg:p-12 flex flex-col gap-5 overflow-hidden opacity-80"
              aria-label="Webtoon Studio — coming soon"
            >
              <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning bg-warning/10 border border-warning/20 rounded-full px-3 py-1">
                <Lock size={11} aria-hidden="true" />
                Coming Soon
              </span>
              <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center">
                <ImageIcon size={26} className="text-text-muted" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-text-secondary">Webtoon Studio</h2>
                <p className="text-sm lg:text-base text-text-muted mt-2 leading-relaxed">
                  Upload panels and publish webtoon episodes. Long vertical canvas
                  creator with drag-and-drop episode building.
                </p>
              </div>
              <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-semibold text-text-muted">
                <Lock size={14} aria-hidden="true" />
                Launching after first release
              </div>
            </div>
          )}
        </div>

        {/* Quick links — full-width row */}
        <div className="mt-5 lg:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-8">
          <Link
            href="/wallet"
            className="group card p-5 lg:p-6 flex items-center gap-4 hover:border-accent/40 hover:bg-bg-elevated transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Open Wallet — tokens and earnings"
          >
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-accent" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm lg:text-base font-semibold text-text flex items-center gap-2">
                Wallet
                {!FEATURE_FLAGS.wallet && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-warning bg-warning/10 border border-warning/20 rounded-full px-2 py-0.5">
                    <Lock size={9} aria-hidden="true" />
                    Coming Soon
                  </span>
                )}
              </p>
              <p className="text-xs lg:text-sm text-text-secondary">Tokens &amp; earnings</p>
            </div>
            <ArrowRight
              size={16}
              className="ml-auto text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all duration-200"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/dashboard"
            className="group card p-5 lg:p-6 flex items-center gap-4 hover:border-accent/40 hover:bg-bg-elevated transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Open Dashboard — stats and analytics"
          >
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <LayoutDashboard size={20} className="text-accent" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm lg:text-base font-semibold text-text">Dashboard</p>
              <p className="text-xs lg:text-sm text-text-secondary">Stats &amp; analytics</p>
            </div>
            <ArrowRight
              size={16}
              className="ml-auto text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all duration-200"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </div>
  )
}
