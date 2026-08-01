import type { Metadata } from 'next'
import { ImageIcon, Sparkles, Layers, MoveVertical, Wand2, Rocket, Users } from 'lucide-react'
import { LandingHero } from '@/components/marketing/LandingHero'
import { FeatureGrid, type Feature } from '@/components/marketing/FeatureGrid'
import { HowItWorks, type Step } from '@/components/marketing/HowItWorks'
import { Faq } from '@/components/marketing/Faq'
import { CtaBanner } from '@/components/marketing/CtaBanner'
import JsonLd from '@/components/seo/JsonLd'
import {
  softwareAppSchema,
  faqPageSchema,
  breadcrumbSchema,
  type FaqItem,
} from '@/lib/seo/schema'
import { APP_NAME } from '@/lib/utils/constants'

const PATH = '/ai-webtoon-generator'
const TITLE = 'AI Webtoon Generator — Create Vertical-Scroll Comics'
const DESCRIPTION =
  'Create a webtoon with AI. Toonflow’s AI webtoon generator gives you an infinite vertical canvas, AI art generation, and a panel-by-panel episode builder to make and publish vertical-scroll comics. Join early access.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'ai webtoon generator',
    'ai webtoon creator',
    'create a webtoon',
    'vertical scroll comic maker',
    'webtoon maker',
    'ai comic generator',
    'make a webtoon online',
  ],
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: PATH,
  },
}

const FEATURES: readonly Feature[] = [
  {
    Icon: MoveVertical,
    title: 'Infinite vertical canvas',
    body: 'Design for the way people actually read webtoons — one long, mobile-first vertical scroll, not fixed print pages.',
  },
  {
    Icon: Wand2,
    title: 'AI art generation',
    body: 'Generate characters, backgrounds, and scenes with AI image generation, then drop them straight onto your canvas.',
  },
  {
    Icon: Layers,
    title: 'Panel & episode builder',
    body: 'Arrange panels, layers, and speech into episodes with a drag-and-drop studio built for sequential storytelling.',
  },
  {
    Icon: Sparkles,
    title: 'Consistent style',
    body: 'Keep a cohesive art direction across panels and episodes so your series looks polished and recognizable.',
  },
  {
    Icon: Rocket,
    title: 'Publish episodes',
    body: 'Release episodes to readers on Toonflow and grow a following that returns for every new drop.',
  },
  {
    Icon: Users,
    title: 'Reach readers',
    body: 'Your published webtoons are discoverable in Browse, so a built-in audience can find your series.',
  },
]

const STEPS: readonly Step[] = [
  {
    title: 'Set up your webtoon',
    body: 'Create your series, give it a title and genre, and open the infinite-canvas studio.',
  },
  {
    title: 'Build with AI',
    body: 'Generate art with AI, arrange panels on the vertical canvas, and assemble your episode.',
  },
  {
    title: 'Publish & grow',
    body: 'Publish episodes to readers, gather followers, and keep your series going.',
  },
]

const FAQS: readonly FaqItem[] = [
  {
    q: 'What is an AI webtoon generator?',
    a: `An AI webtoon generator helps you make vertical-scroll comics without drawing everything from scratch. On ${APP_NAME} you generate art with AI, arrange it into panels on an infinite vertical canvas, and publish episodes to readers.`,
  },
  {
    q: 'Is the Webtoon Studio available now?',
    a: 'The Webtoon Studio is currently rolling out to early-access creators. Create a free account and join early access to be among the first to build and publish full webtoon series.',
  },
  {
    q: 'Do I need to know how to draw?',
    a: 'No. You can generate characters, backgrounds, and scenes with AI image generation and assemble them on the canvas. Artists can still bring their own work — the studio supports both.',
  },
  {
    q: 'What format are the comics in?',
    a: 'Webtoons use a long vertical-scroll format optimized for phones — the same reading experience popularized by platforms like WEBTOON and Tapas — rather than fixed print-style pages.',
  },
  {
    q: 'Do I own the webtoons I create?',
    a: 'Yes. You keep ownership of the series you create and publish. Toonflow is the platform you use to build and distribute your work.',
  },
  {
    q: 'How do readers find my webtoon?',
    a: 'Published episodes appear in Browse and can surface in genre and search results, and your followers are notified when you publish new episodes.',
  },
]

export default function AiWebtoonGeneratorPage() {
  return (
    <>
      <JsonLd
        data={softwareAppSchema({
          name: 'Toonflow AI Webtoon Generator',
          description: DESCRIPTION,
          path: PATH,
        })}
      />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'AI Webtoon Generator', path: PATH },
        ])}
      />

      <LandingHero
        eyebrow="AI Webtoon Generator"
        Icon={ImageIcon}
        title="Create vertical-scroll webtoons with AI"
        subtitle="An infinite vertical canvas, AI art generation, and a panel-by-panel episode builder — everything you need to make and publish webtoons. Join early access."
        primaryCta={{ label: 'Get early access', href: '/signup?redirect=/create' }}
        secondaryCta={{ label: 'Browse webtoons', href: '/browse' }}
      />

      <FeatureGrid
        heading="A studio built for webtoons"
        subheading="Design for vertical scroll, generate art with AI, and publish episodes readers love."
        features={FEATURES}
      />

      <HowItWorks heading="How it works" steps={STEPS} />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Webtoons, without the studio overhead
        </h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            Making a webtoon usually means juggling art tools, panel layouts, and
            export settings before a single reader sees your work. Toonflow&apos;s
            AI webtoon generator brings it into one place: generate the art you need,
            lay it out on an infinite vertical canvas made for mobile reading, and
            assemble episodes without wrestling with print-style page dimensions.
          </p>
          <p>
            Whether you&apos;re a solo creator sketching your first series or an artist
            who wants to move faster, early access puts a purpose-built vertical-scroll
            studio in your hands — then publishes your episodes to readers already
            browsing for their next binge.
          </p>
        </div>
      </section>

      <Faq heading="AI Webtoon Generator FAQ" items={FAQS} />

      <CtaBanner
        title="Be first to build your webtoon"
        body="Create a free account and join early access to the Webtoon Studio — AI art, vertical canvas, and one-tap publishing."
        cta={{ label: 'Get early access', href: '/signup?redirect=/create' }}
      />
    </>
  )
}
