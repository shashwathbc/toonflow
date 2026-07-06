'use client'

import type { Novel } from '@/types'

// Per-particle placement/timing as literal Tailwind classes (position, base
// opacity, and the --p-* vars the shared animate-[…] class + the
// reader-particle-float keyframes consume). Literal strings so the JIT sees
// them — values match the old `(i * k + c) % m` generation formulas, stable
// across renders so there is no hydration mismatch.
const PARTICLES = [
  'left-[11%] top-[7%] opacity-[0.15] [--p-opacity:0.15] [--p-dur:6.0s] [--p-delay:0.0s]',
  'left-[48%] top-[60%] opacity-[0.28] [--p-opacity:0.28] [--p-dur:8.3s] [--p-delay:1.7s]',
  'left-[85%] top-[20%] opacity-[0.41] [--p-opacity:0.41] [--p-dur:10.6s] [--p-delay:3.4s]',
  'left-[25%] top-[73%] opacity-[0.54] [--p-opacity:0.54] [--p-dur:7.9s] [--p-delay:5.1s]',
  'left-[62%] top-[33%] opacity-[0.17] [--p-opacity:0.17] [--p-dur:10.2s] [--p-delay:6.8s]',
  'left-[2%] top-[86%] opacity-[0.3] [--p-opacity:0.3] [--p-dur:7.5s] [--p-delay:0.5s]',
  'left-[39%] top-[46%] opacity-[0.43] [--p-opacity:0.43] [--p-dur:9.8s] [--p-delay:2.2s]',
  'left-[76%] top-[6%] opacity-[0.56] [--p-opacity:0.56] [--p-dur:7.1s] [--p-delay:3.9s]',
  'left-[16%] top-[59%] opacity-[0.19] [--p-opacity:0.19] [--p-dur:9.4s] [--p-delay:5.6s]',
  'left-[53%] top-[19%] opacity-[0.32] [--p-opacity:0.32] [--p-dur:6.7s] [--p-delay:7.3s]',
  'left-[90%] top-[72%] opacity-[0.45] [--p-opacity:0.45] [--p-dur:9.0s] [--p-delay:1.0s]',
  'left-[30%] top-[32%] opacity-[0.58] [--p-opacity:0.58] [--p-dur:6.3s] [--p-delay:2.7s]',
  'left-[67%] top-[85%] opacity-[0.21] [--p-opacity:0.21] [--p-dur:8.6s] [--p-delay:4.4s]',
  'left-[7%] top-[45%] opacity-[0.34] [--p-opacity:0.34] [--p-dur:10.9s] [--p-delay:6.1s]',
  'left-[44%] top-[5%] opacity-[0.47] [--p-opacity:0.47] [--p-dur:8.2s] [--p-delay:7.8s]',
  'left-[81%] top-[58%] opacity-[0.6] [--p-opacity:0.6] [--p-dur:10.5s] [--p-delay:1.5s]',
  'left-[21%] top-[18%] opacity-[0.23] [--p-opacity:0.23] [--p-dur:7.8s] [--p-delay:3.2s]',
  'left-[58%] top-[71%] opacity-[0.36] [--p-opacity:0.36] [--p-dur:10.1s] [--p-delay:4.9s]',
  'left-[95%] top-[31%] opacity-[0.49] [--p-opacity:0.49] [--p-dur:7.4s] [--p-delay:6.6s]',
  'left-[35%] top-[84%] opacity-[0.62] [--p-opacity:0.62] [--p-dur:9.7s] [--p-delay:0.3s]',
  'left-[72%] top-[44%] opacity-[0.25] [--p-opacity:0.25] [--p-dur:7.0s] [--p-delay:2.0s]',
  'left-[12%] top-[4%] opacity-[0.38] [--p-opacity:0.38] [--p-dur:9.3s] [--p-delay:3.7s]',
  'left-[49%] top-[57%] opacity-[0.51] [--p-opacity:0.51] [--p-dur:6.6s] [--p-delay:5.4s]',
  'left-[86%] top-[17%] opacity-[0.64] [--p-opacity:0.64] [--p-dur:8.9s] [--p-delay:7.1s]',
  'left-[26%] top-[70%] opacity-[0.27] [--p-opacity:0.27] [--p-dur:6.2s] [--p-delay:0.8s]',
  'left-[63%] top-[30%] opacity-[0.4] [--p-opacity:0.4] [--p-dur:8.5s] [--p-delay:2.5s]',
  'left-[3%] top-[83%] opacity-[0.53] [--p-opacity:0.53] [--p-dur:10.8s] [--p-delay:4.2s]',
  'left-[40%] top-[43%] opacity-[0.16] [--p-opacity:0.16] [--p-dur:8.1s] [--p-delay:5.9s]',
]

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
          key={p}
          className={`absolute w-[2px] h-[2px] rounded-full bg-white pointer-events-none will-change-transform animate-[reader-particle-float_var(--p-dur)_ease-in-out_var(--p-delay)_infinite] ${p}`}
          aria-hidden="true"
        />
      ))}

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_20%,rgba(0,0,0,0.75)_100%)]"
        aria-hidden="true"
      />

      {/* Ambient glow behind title */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)] animate-[reader-glow-pulse_4s_ease-in-out_infinite]"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto animate-[reader-title-in_1.2s_ease-out_both]">
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
        <h1 className="font-black text-white leading-none mb-8 text-[length:clamp(3rem,10vw,7rem)] tracking-[-0.02em] [font-family:Georgia,'Times_New_Roman',serif] [text-shadow:0_0_60px_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.8)]">
          {novel.title}
        </h1>

        {/* Tagline */}
        {tagline.length > 8 && (
          <div className="mb-10 space-y-1">
            <p className="text-lg sm:text-xl md:text-2xl font-light italic leading-relaxed text-[#C9A84C] [font-family:Georgia,serif]">
              &ldquo;{tagline}&rdquo;
            </p>
          </div>
        )}

        {/* Scroll cue */}
        <div className="flex flex-col items-center gap-3 mt-12">
          <p className="text-[9px] tracking-[0.6em] text-white/25 uppercase">Scroll to Begin</p>
          <div
            className="w-px h-10 bg-gradient-to-b from-white/50 to-transparent animate-[reader-scroll-cue_2s_ease-in-out_infinite]"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
