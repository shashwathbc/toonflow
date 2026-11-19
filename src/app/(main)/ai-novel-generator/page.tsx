import type { Metadata } from 'next'
import { BookOpen, Sparkles, Wand2, ImageIcon, CalendarClock, BarChart3 } from 'lucide-react'
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

const PATH = '/ai-novel-generator'
const TITLE = 'AI Novel Generator — Write & Publish Your Novel'
const DESCRIPTION =
  'Write a novel with AI. Toonflow’s AI novel generator helps you brainstorm plots, generate synopses, draft chapters, create cover art, and publish serialized fiction to readers worldwide — free to start.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'ai novel generator',
    'write a novel with ai',
    'ai story writer',
    'ai story generator',
    'ai book writer',
    'serialized fiction',
    'publish a novel online',
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
    Icon: Sparkles,
    title: 'AI story assistant',
    body: 'Brainstorm plots, develop characters, unblock scenes, and sharpen dialogue with an AI writing partner built into the editor.',
  },
  {
    Icon: Wand2,
    title: 'Synopsis generator',
    body: 'Generate a compelling synopsis from a one-line idea, or improve and expand what you’ve already written in a click.',
  },
  {
    Icon: ImageIcon,
    title: 'AI cover art',
    body: 'Create eye-catching, anime-style cover art with AI image generation — no designer or stock photos needed.',
  },
  {
    Icon: BookOpen,
    title: 'Chapter editor',
    body: 'A clean, distraction-free rich-text editor made for serialized fiction, with drafts and revisions kept safe.',
  },
  {
    Icon: CalendarClock,
    title: 'Publish on your schedule',
    body: 'Release chapters when you’re ready and build a following that comes back for every update.',
  },
  {
    Icon: BarChart3,
    title: 'Reader analytics',
    body: 'See views, followers, likes, and engagement in your creator dashboard so you know what resonates.',
  },
]

const STEPS: readonly Step[] = [
  {
    title: 'Start your novel',
    body: 'Pick a title and genre, then let AI draft a synopsis to set the tone — or write your own.',
  },
  {
    title: 'Write with AI',
    body: 'Draft chapters in the editor and call on the AI assistant whenever you need ideas, rewrites, or momentum.',
  },
  {
    title: 'Publish & grow',
    body: 'Publish chapters to readers everywhere, track your analytics, and grow an audience for your story.',
  },
]

const FAQS: readonly FaqItem[] = [
  {
    q: 'Is the AI novel generator free to use?',
    a: `Yes — you can create an account and start writing on ${APP_NAME} for free. AI features such as the story assistant, synopsis generation, and cover art use credits, and generous starter credits are included so you can try everything before committing.`,
  },
  {
    q: 'Do I own the rights to what I create?',
    a: 'Yes. You retain ownership of the novels you write and publish. Toonflow is a platform for creating and distributing your work — it does not claim ownership of your stories.',
  },
  {
    q: 'Can AI write an entire novel for me automatically?',
    a: 'The AI is a co-writer, not a replacement for you. It generates synopses, suggests plot and character ideas, drafts and rewrites passages, and helps when you’re stuck — but you stay in control of the story, its voice, and every chapter you publish.',
  },
  {
    q: 'What genres can I write?',
    a: 'Any genre — fantasy, romance, sci-fi, action, isekai, horror, mystery, slice-of-life, and more. You choose the genre when you create your novel, and it helps readers discover your work.',
  },
  {
    q: 'Can I generate cover art with AI?',
    a: 'Yes. You can generate original, anime-style cover art with the built-in AI image generator, so your novel looks professional from day one without hiring a designer.',
  },
  {
    q: 'How do readers discover my novel?',
    a: 'Published novels appear in Browse and can surface in search, genre pages, and reader recommendations. Your followers are notified when you publish new chapters.',
  },
  {
    q: 'Can I earn money from my novels?',
    a: 'Toonflow is built to reward creators. As monetization features roll out, published creators can earn from their audience through the platform’s revenue-sharing model.',
  },
]

export default function AiNovelGeneratorPage() {
  return (
    <>
      <JsonLd
        data={softwareAppSchema({
          name: 'Toonflow AI Novel Generator',
          description: DESCRIPTION,
          path: PATH,
        })}
      />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'AI Novel Generator', path: PATH },
        ])}
      />

      <LandingHero
        eyebrow="AI Novel Generator"
        Icon={BookOpen}
        title="Write & publish your novel with AI"
        subtitle="Turn an idea into a finished, published story. Toonflow's AI novel generator helps you plan plots, draft chapters, design covers, and reach readers — all in one place."
        primaryCta={{ label: 'Start writing free', href: '/signup?redirect=/create/novel' }}
        secondaryCta={{ label: 'Browse novels', href: '/browse?type=novel' }}
      />

      <FeatureGrid
        heading="Everything you need to write a novel"
        subheading="AI assistance at every step, from the first synopsis to your published series."
        features={FEATURES}
      />

      <HowItWorks heading="How it works" steps={STEPS} />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Built for storytellers
        </h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            Whether you&apos;re writing your first web novel or serializing an ongoing
            saga, Toonflow removes the friction between your imagination and a
            published chapter. The AI story assistant helps you break through
            writer&apos;s block, outline arcs, and keep characters consistent, while the
            synopsis generator turns a rough logline into a hook that makes readers
            click.
          </p>
          <p>
            When your chapter is ready, generate a striking anime-style cover, hit
            publish, and your work is discoverable by readers browsing for their next
            favorite series. Track how each release performs and build a loyal
            following — no design tools, no complicated setup, just your story.
          </p>
        </div>
      </section>

      <Faq heading="AI Novel Generator FAQ" items={FAQS} />

      <CtaBanner
        title="Start writing your novel today"
        body="Create a free account and let AI help you write, illustrate, and publish your story to readers everywhere."
        cta={{ label: 'Start writing free', href: '/signup?redirect=/create/novel' }}
      />
    </>
  )
}
