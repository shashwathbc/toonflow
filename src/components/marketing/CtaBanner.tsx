import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface CtaBannerProps {
  title: string
  body: string
  cta: { label: string; href: string }
}

/** Closing call-to-action band. Server Component. */
export function CtaBanner({ title, body, cta }: CtaBannerProps) {
  return (
    <section className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 pb-20">
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-accent/[0.06] px-6 py-12 text-center sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative">
          <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-text-secondary">{body}</p>
          <Link href={cta.href} className="btn-accent mt-7 px-6 py-3 text-base">
            {cta.label}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
