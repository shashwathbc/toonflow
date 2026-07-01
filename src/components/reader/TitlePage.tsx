'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Novel } from '@/types'

interface TitlePageProps {
  novel: Novel
  chapterTitle: string
  chapterNumber: number
}

export function TitlePage({ novel, chapterTitle, chapterNumber }: TitlePageProps) {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden"
      aria-label="Story title page"
    >
      {/* Blurred cover as ambient background */}
      {novel.coverURL && (
        <>
          <div className="absolute inset-0 opacity-15 scale-110">
            <Image src={novel.coverURL} alt="" fill className="object-cover blur-3xl" aria-hidden="true" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" aria-hidden="true" />
        </>
      )}

      {/* Subtle centre glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div
        className="relative z-10 flex flex-col md:flex-row items-center gap-10 px-6 py-16 max-w-4xl mx-auto w-full"
        style={{ animationName: 'reader-fade-in', animationDuration: '1s', animationFillMode: 'both', animationDelay: '0.2s' }}
      >
        {/* Cover */}
        {novel.coverURL && (
          <div className="flex-shrink-0 w-36 sm:w-48 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.8)] border border-white/10">
            <Image
              src={novel.coverURL}
              alt={novel.title}
              width={192}
              height={288}
              className="object-cover w-full h-full"
            />
          </div>
        )}

        {/* Info */}
        <div className="text-center md:text-left space-y-5">
          {/* Genres */}
          {novel.genres?.length > 0 && (
            <p className="text-[10px] tracking-[0.45em] text-white/30 uppercase font-semibold">
              {novel.genres.slice(0, 3).join('  ·  ')}
            </p>
          )}

          {/* Title */}
          <h2
            className="font-black text-white leading-none"
            style={{
              fontSize:   'clamp(2.2rem, 7vw, 5rem)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            {novel.title}
          </h2>

          {/* Author */}
          <div className="space-y-1">
            <p className="text-[10px] tracking-[0.4em] text-white/30 uppercase">by</p>
            <Link
              href={`/profile/${novel.authorId}`}
              className="text-lg font-semibold text-white/80 hover:text-white transition-colors"
            >
              {novel.authorName}
            </Link>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <span className="text-[11px] px-3 py-1 rounded-full border border-white/15 text-white/50 capitalize">
              {novel.status}
            </span>
            {novel.chapterCount > 0 && (
              <span className="text-[11px] px-3 py-1 rounded-full border border-white/15 text-white/50">
                {novel.chapterCount} chapters
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-24 bg-white/10 mx-auto md:mx-0" />

          {/* Chapter label */}
          <div>
            <p className="text-[10px] tracking-[0.4em] text-white/25 uppercase mb-1">Now Reading</p>
            <p className="text-base font-semibold text-white/60">
              Chapter {chapterNumber}{chapterTitle ? ` · ${chapterTitle}` : ''}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
