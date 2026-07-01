'use client'

import type { Novel } from '@/types'

// Pre-computed particles — stable across renders, no hydration mismatch
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left:     `${(i * 37 + 11) % 97}%`,
  top:      `${(i * 53 + 7)  % 93}%`,
  size:      ((i * 3 + 1) % 3) + 1,
  delay:    `${((i * 1.7)  % 8).toFixed(1)}s`,
  duration: `${(((i * 2.3) % 5) + 6).toFixed(1)}s`,
  opacity:   (((i * 13) % 50) + 15) / 100,
}))

interface IntroPosterProps {
  novel: Novel
}

export function IntroPoster({ novel }: IntroPosterProps) {
  const synopsis = novel.synopsis ?? ''
  const tagline  = synopsis.split(/[.!?]/)[0]?.trim() ?? synopsis.slice(0, 90)

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center bg-black overflow-hidden select-none"
      aria-label="Story introduction"
    >
      {/* Particles */}
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full pointer-events-none will-change-transform"
          style={{
            left:            p.left,
            top:             p.top,
            width:           p.size,
            height:          p.size,
            background:      'white',
            ['--p-opacity' as string]: p.opacity,
            opacity:         p.opacity,
            animationName:        'reader-particle-float',
            animationDuration:    p.duration,
            animationDelay:       p.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
          aria-hidden="true"
        />
      ))}

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 20%, rgba(0,0,0,0.75) 100%)' }}
        aria-hidden="true"
      />

      {/* Ambient glow behind title */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background:      'radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)',
          animationName:        'reader-glow-pulse',
          animationDuration:    '4s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className="relative z-10 text-center px-6 max-w-3xl mx-auto"
        style={{ animationName: 'reader-title-in', animationDuration: '1.2s', animationFillMode: 'both', animationTimingFunction: 'ease-out' }}
      >
        {/* Studio badge */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="w-11 h-11 rounded-xl border border-white/15 flex items-center justify-center backdrop-blur-sm bg-white/5">
            <span className="text-white/70 font-black text-xs tracking-widest">TF</span>
          </div>
          <p className="text-[10px] font-bold tracking-[0.4em] text-white/35 uppercase">
            Toonflow Studio Paint Presents
          </p>
        </div>

        {/* Genre divider */}
        {novel.genres?.[0] && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-14 bg-gradient-to-r from-transparent to-white/20" />
            <p className="text-[10px] tracking-[0.5em] text-white/25 uppercase">{novel.genres[0]}</p>
            <div className="h-px w-14 bg-gradient-to-l from-transparent to-white/20" />
          </div>
        )}

        {/* Main title */}
        <h1
          className="font-black text-white leading-none mb-8"
          style={{
            fontSize:   'clamp(3rem, 10vw, 7rem)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            textShadow: '0 0 60px rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.8)',
            letterSpacing: '-0.02em',
          }}
        >
          {novel.title}
        </h1>

        {/* Tagline */}
        {tagline.length > 8 && (
          <div className="mb-10 space-y-1">
            <p
              className="text-lg sm:text-xl md:text-2xl font-light italic leading-relaxed"
              style={{ color: '#C9A84C', fontFamily: 'Georgia, serif' }}
            >
              &ldquo;{tagline}&rdquo;
            </p>
          </div>
        )}

        {/* Scroll cue */}
        <div className="flex flex-col items-center gap-3 mt-12">
          <p className="text-[9px] tracking-[0.6em] text-white/25 uppercase">Scroll to Begin</p>
          <div
            className="w-px h-10 bg-gradient-to-b from-white/50 to-transparent"
            style={{ animationName: 'reader-scroll-cue', animationDuration: '2s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
