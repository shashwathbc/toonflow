import type { Metadata } from 'next'
import { Palette, Sparkles, Wand2, Layers, BookImage, Rocket, Users } from 'lucide-react'
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

const PATH = '/ai-manga-generator'
const TITLE = 'AI Manga Generator — Create Anime-Style Comics'
const DESCRIPTION =
  'Create manga and anime-style comics with AI. Toonflow’s AI manga generator turns your ideas into anime-style art and comic panels you can arrange into episodes and publish to readers. Join early access.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'ai manga generator',
    'ai anime generator',
    'anime art generator',
    'manga maker',
    'ai comic generator',
    'create manga online',
    'anime style comic maker',
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
    Icon: Wand2,
    title: 'Anime-style AI art',
    body: 'Generate characters, scenes, and backgrounds in an anime and manga art style from a simple prompt.',
  },
  {
    Icon: Layers,
    title: 'Panel-by-panel builder',
    body: 'Compose your generated art into manga panels and episodes with a drag-and-drop studio canvas.',
  },
  {
    Icon: Sparkles,
    title: 'Consistent characters',
    body: 'Keep a cohesive look across panels so your cast and world stay recognizable from chapter to chapter.',
  },
  {
    Icon: BookImage,
    title: 'Covers & key art',
    body: 'Produce striking anime-style covers and promotional key art to make your series stand out.',
  },
  {
    Icon: Rocket,
    title: 'Publish episodes',
    body: 'Release your manga to readers on Toonflow and grow a following one chapter at a time.',
  },
  {
    Icon: Users,
    title: 'Reach an audience',
    body: 'Your published series is discoverable in Browse, connecting you with readers who love manga and anime.',
  },
]

const STEPS: readonly Step[] = [
  {
    title: 'Describe your idea',
    body: 'Prompt the AI to generate anime-style characters, backgrounds, and scenes for your story.',
  },
  {
    title: 'Build your panels',
    body: 'Arrange the art into manga panels and episodes on the studio canvas.',
  },
  {
    title: 'Publish & grow',
    body: 'Publish episodes to readers, gather followers, and keep your series going.',
  },
]

const FAQS: readonly FaqItem[] = [
  {
    q: 'What can the AI manga generator make?',
    a: `It generates anime and manga-style artwork — characters, backgrounds, scenes, and covers — from text prompts, which you can arrange into comic panels and episodes on ${APP_NAME} and publish to readers.`,
  },
  {
    q: 'Does it create anime videos or animation?',
    a: 'No — it generates anime-style still art and comic panels, not animated video. It’s built for making manga and webcomics in an anime aesthetic, not motion animation.',
  },
  {
    q: 'Do I need drawing skills?',
    a: 'No. You describe what you want and the AI generates the art. If you are an artist, you can also bring your own illustrations into the studio.',
  },
  {
    q: 'Is it available now?',
    a: 'The visual studio is rolling out to early-access creators. Create a free account and join early access to start generating manga art and building episodes.',
  },
  {
    q: 'Do I own the art and comics I create?',
    a: 'Yes. You retain ownership of the manga and comics you create and publish on the platform.',
  },
  {
    q: 'What art styles are supported?',
    a: 'The generator specializes in anime and manga aesthetics, from clean modern styles to more detailed, expressive looks, so you can match the tone of your story.',
  },
]

export default function AiMangaGeneratorPage() {
  return (
    <>
      <JsonLd
        data={softwareAppSchema({
          name: 'Toonflow AI Manga Generator',
          description: DESCRIPTION,
          path: PATH,
        })}
      />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'AI Manga Generator', path: PATH },
        ])}
      />

      <LandingHero
        eyebrow="AI Manga & Anime Art Generator"
        Icon={Palette}
        title="Create anime-style manga with AI"
        subtitle="Turn a prompt into anime-style art and comic panels, arrange them into episodes, and publish your manga to readers. Join early access."
        primaryCta={{ label: 'Get early access', href: '/signup?redirect=/create' }}
        secondaryCta={{ label: 'Browse comics', href: '/browse' }}
      />

      <FeatureGrid
        heading="From prompt to published manga"
        subheading="Generate anime-style art, build panels, and share your series with readers."
        features={FEATURES}
      />

      <HowItWorks heading="How it works" steps={STEPS} />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Make manga in an anime style — no drawing required
        </h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            Great manga starts with great art, and that&apos;s usually the hardest
            part. Toonflow&apos;s AI manga generator lets you describe the character,
            scene, or mood you want and produces anime-style artwork in seconds — then
            gives you a studio to arrange those images into panels and episodes.
          </p>
          <p>
            Keep your cast consistent across chapters, design covers that pop, and
            publish your series to readers who are already searching for their next
            anime and manga obsession. Join early access to start creating.
          </p>
        </div>
      </section>

      <Faq heading="AI Manga Generator FAQ" items={FAQS} />

      <CtaBanner
        title="Start creating your manga"
        body="Create a free account and join early access to generate anime-style art and publish your manga series."
        cta={{ label: 'Get early access', href: '/signup?redirect=/create' }}
      />
    </>
  )
}
