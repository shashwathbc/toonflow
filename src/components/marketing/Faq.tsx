import { ChevronDown } from 'lucide-react'
import type { FaqItem } from '@/lib/seo/schema'

interface FaqProps {
  heading: string
  items: readonly FaqItem[]
}

/** Accessible FAQ built on native <details>/<summary> — zero client JS, fully
 *  keyboard operable, and the answer text ships in the HTML so it feeds both the
 *  FAQPage rich result and crawlers. Pass the SAME `items` to faqPageSchema() so
 *  the visible copy and the structured data never drift. */
export function Faq({ heading, items }: FaqProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <h2 className="text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        {heading}
      </h2>
      <div className="mt-8 divide-y divide-bg-border border-y border-bg-border">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-semibold text-text list-none [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
              {item.q}
              <ChevronDown
                size={18}
                className="shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-text-secondary">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
