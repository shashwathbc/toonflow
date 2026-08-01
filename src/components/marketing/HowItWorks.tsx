export interface Step {
  title: string
  body: string
}

interface HowItWorksProps {
  heading: string
  steps: readonly Step[]
}

/** Numbered "how it works" steps. Server Component. The ordered list is real
 *  <ol>/<li> so the sequence is conveyed to assistive tech and crawlers. */
export function HowItWorks({ heading, steps }: HowItWorksProps) {
  return (
    <section className="border-y border-bg-border bg-bg-card/40">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {heading}
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3" role="list">
          {steps.map((step, i) => (
            <li key={step.title} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-text">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
