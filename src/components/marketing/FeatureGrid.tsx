import { type LucideIcon } from 'lucide-react'

export interface Feature {
  Icon: LucideIcon
  title: string
  body: string
}

interface FeatureGridProps {
  heading: string
  subheading?: string
  features: readonly Feature[]
}

/** Responsive grid of feature cards. Server Component. Headings use <h2>/<h3>
 *  so the page keeps a clean outline under its single <h1>. */
export function FeatureGrid({ heading, subheading, features }: FeatureGridProps) {
  return (
    <section className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{heading}</h2>
        {subheading && (
          <p className="mt-3 text-base text-text-secondary">{subheading}</p>
        )}
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ Icon, title, body }) => (
          <div key={title} className="card p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/15 bg-accent/10">
              <Icon size={22} className="text-accent" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-text">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
