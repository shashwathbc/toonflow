'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  createNovel,
  createChapter,
  createWebtoon,
  createEpisode,
  updateNovel,
  updateWebtoon,
} from '@/lib/firebase/firestore'
import { BookOpen, Film, CheckCircle2, XCircle, Loader2, Sparkles, ArrowLeft } from 'lucide-react'

const COVER_URL = 'https://picsum.photos/seed/ravana/900/1350'

const NOVEL_DATA = {
  title: 'Ravana: The Immortal War',
  synopsis: `In an age when gods and demons waged eternal war across the heavens, Ravana — the ten-headed demon king of Lanka — was cast down from the golden throne by a coalition of divine treachery and mortal steel. But death is not the end for the Immortal King.

Rising from the ashes of his conquered kingdom, his ten minds burning with ancient knowledge and unquenchable fury, Ravana wages a devastating war not just against armies — but against fate itself. He will shatter the boundaries between the mortal realm and the celestial, forge alliances with fallen gods, and unravel the sacred laws that once held him bound.

For there is one truth even the gods fear: when Ravana swears an oath, the universe remembers.`,
  genres: ['fantasy', 'action', 'historical'] as const,
  tags: ['ravana', 'mythology', 'epic-fantasy', 'dark', 'war', 'immortal', 'gods', 'demons'],
  status: 'ongoing' as const,
  viewCount: 12847,
  likeCount: 3291,
  isFeatured: true,
  isOriginal: true,
}

const CHAPTER_1 = {
  title: 'The Fall of Lanka',
  chapterNumber: 1,
  status: 'published' as const,
  wordCount: 1247,
  content: `<h1>The Fall of Lanka</h1>

<p>The heavens wept fire the night Ravana fell.</p>

<p>He felt it before it happened — the precise moment when the cosmic balance shifted against him, when a decade of war condensed into a single divine judgment. The air above Lanka turned to ash. The golden towers his architects had built over seven hundred years groaned under the weight of something heavier than siege weapons: the will of the gods.</p>

<p>From the highest spire of his palace, Ravana watched the horizon burn. Ten minds observed it simultaneously — the military strategist calculating retreat vectors, the philosopher contemplating dharmic consequence, the scholar recognizing celestial signs that had not appeared since the first war between worlds. All ten reached the same conclusion at the same moment.</p>

<p><em>Lanka is lost.</em></p>

<p>Below, his armies still fought. A hundred thousand rakshasas, the finest warriors ever born of demon blood, held the walls against the bridge-crossing host. He could hear Kumbhakarna's war cry even from here — his beloved brother, unstoppable as a mountain, tearing through the monkey-army like a storm through tall grass. But storms end. Mountains fall.</p>

<p>Indrajit appeared at his side without sound, the way shadows move. His firstborn. His greatest creation.</p>

<p>"Father." The word carried everything. <em>It is time. We must flee. There is still a way.</em></p>

<p>Ravana did not turn. "Tell me what you see."</p>

<p>Indrajit was silent for a moment. Then: "I see a man standing at the edge of the world he built, watching it unmake itself. I see ten heads and ten sorrows, and none of them afraid."</p>

<p>"Afraid." Ravana tasted the word like foreign fruit. "I taught you every language in the three worlds, Indrajit. Did I ever teach you that one?"</p>

<p>"No, Father. You did not."</p>

<p>The wall to the east collapsed then — not from the siege engines, but from something else. Ravana's northern mind identified it first: the brahmastra, a weapon of such absolute destruction that even its wielder was diminished by its use. The light it produced had no color. It simply erased the colors of everything it touched.</p>

<p>Half of Lanka's eastern quarter vanished.</p>

<p>Where golden streets had stood for centuries, there was now a void shaped like a wound.</p>

<p>"Go," Ravana said quietly.</p>

<p>"Father—"</p>

<p>"I said <em>go</em>, Indrajit. Take your mother. Take what blood of mine you can carry. What happens next—" He paused, watching the void expand at Lanka's edge. "What happens next is mine alone."</p>

<p>His son obeyed. He always obeyed, in the end. That was both his greatest strength and his only weakness — the same one Ravana had never managed to purge from himself: love.</p>

<hr>

<p>The battle reached the spire at moonrise.</p>

<p>He met it as he met everything — standing, weapons drawn, ten faces forward. They sent their finest against him, divine warriors blessed by heavenly armories, carrying weapons that sang with the names of gods. He broke the first three before they understood what they were fighting.</p>

<p>Ravana had not survived ten thousand years by being strong.</p>

<p>He had survived by being <em>right</em>.</p>

<p>The fatal blow came from a direction he had not calculated — not from the warriors, but from the mortal king himself, the one the gods had spent three yugas preparing. The weapon carried the weight of cosmic law in it, the kind of force that does not merely destroy but <em>concludes</em>. Ravana felt it pass through all ten of his selves simultaneously.</p>

<p>The knowledge it carried with it surprised him.</p>

<p><em>This is not the end. This is the charge.</em></p>

<p>As Lanka burned around him and his body began its long descent toward death, Ravana made a vow. He made it not to any god, not to any witness — he made it to the universe itself, written into the fabric of causality where not even the divine could erase it.</p>

<p><em>I will return.</em></p>

<p><em>And when I do, nothing — not dharma, not fate, not the assembled heavens — will hold me again.</em></p>

<p>The darkness took him. The vow remained.</p>

<h2>Somewhere beyond the reach of ordinary death — </h2>

<p>Ravana opened his eyes.</p>

<p>All ten of them.</p>`,
}

const WEBTOON_DATA = {
  title: 'Ravana: The Immortal War',
  synopsis: `The epic tale of the ten-headed demon king brought to stunning visual life. When the gods conspire to bring down the greatest ruler the three worlds have ever known, they forget one thing: you cannot kill what refuses to die.

Follow Ravana's immortal war across stunning painted panels — from the burning streets of Lanka to the frozen peaks of Mount Meru, from celestial palaces to the depths of the underworld. Each episode is a chapter in the longest war ever fought — not for territory, not for pride, but for the right to exist beyond the judgment of gods.`,
  genres: ['fantasy', 'action', 'historical'] as const,
  tags: ['ravana', 'mythology', 'webtoon', 'dark-fantasy', 'war', 'illustrated'],
  status: 'ongoing' as const,
  viewCount: 28430,
  likeCount: 7104,
  isFeatured: true,
  isOriginal: true,
}

const EPISODE_1 = {
  title: 'Birth of the Demon King',
  episodeNumber: 1,
  status: 'published' as const,
  panels: [
    {
      url: '/images/ravana-cover.png',
      width: 900,
      height: 1350,
      order: 0,
      altText: 'Ravana stands before his ten-headed divine form as Lanka burns behind him',
    },
  ],
  thumbnailURL: '/images/ravana-cover.png',
}

type StepStatus = 'idle' | 'running' | 'done' | 'error'

interface Step {
  label: string
  status: StepStatus
  id?: string
}

export default function UserSeedPage() {
  const { firebaseUser, userProfile, loading } = useAuth()
  const router = useRouter()
  const [steps, setSteps] = useState<Step[]>([
    { label: 'Create Novel — Ravana: The Immortal War', status: 'idle' },
    { label: 'Create Chapter 1 — The Fall of Lanka', status: 'idle' },
    { label: 'Create Webtoon — Ravana: The Immortal War', status: 'idle' },
    { label: 'Create Episode 1 — Birth of the Demon King', status: 'idle' },
  ])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [novelId, setNovelId] = useState<string | null>(null)
  const [webtoonId, setWebtoonId] = useState<string | null>(null)

  function setStep(index: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  async function runSeed() {
    if (!firebaseUser) return
    setRunning(true)

    const authorId = firebaseUser.uid
    const authorName = userProfile?.displayName ?? firebaseUser.displayName ?? 'Unknown Author'
    const authorPhotoURL = userProfile?.photoURL ?? firebaseUser.photoURL ?? null

    // Step 0 — Novel
    setStep(0, { status: 'running' })
    let nId = ''
    try {
      // viewCount/likeCount are server-managed and must start at 0 — Firestore
      // rules reject seeded counters (clients can't inflate stats at creation).
      nId = await createNovel(authorId, authorName, authorPhotoURL, {
        title: NOVEL_DATA.title,
        synopsis: NOVEL_DATA.synopsis,
        genres: NOVEL_DATA.genres as never,
        tags: NOVEL_DATA.tags,
        status: NOVEL_DATA.status,
        coverURL: COVER_URL,
        isFeatured: NOVEL_DATA.isFeatured,
        isOriginal: NOVEL_DATA.isOriginal,
      })
      setNovelId(nId)
      setStep(0, { status: 'done', id: nId })
    } catch (e) {
      console.error(e)
      setStep(0, { status: 'error' })
      setRunning(false)
      return
    }

    // Step 1 — Chapter
    setStep(1, { status: 'running' })
    try {
      const chId = await createChapter(nId, {
        title: CHAPTER_1.title,
        chapterNumber: CHAPTER_1.chapterNumber,
        content: CHAPTER_1.content,
        wordCount: CHAPTER_1.wordCount,
        status: CHAPTER_1.status,
      })
      await updateNovel(nId, { chapterCount: 1 })
      setStep(1, { status: 'done', id: chId })
    } catch (e) {
      console.error(e)
      setStep(1, { status: 'error' })
      setRunning(false)
      return
    }

    // Step 2 — Webtoon
    setStep(2, { status: 'running' })
    let wId = ''
    try {
      wId = await createWebtoon(authorId, authorName, authorPhotoURL, {
        title: WEBTOON_DATA.title,
        synopsis: WEBTOON_DATA.synopsis,
        genres: WEBTOON_DATA.genres as never,
        tags: WEBTOON_DATA.tags,
        status: WEBTOON_DATA.status,
        coverURL: COVER_URL,
        isFeatured: WEBTOON_DATA.isFeatured,
        isOriginal: WEBTOON_DATA.isOriginal,
      })
      setWebtoonId(wId)
      setStep(2, { status: 'done', id: wId })
    } catch (e) {
      console.error(e)
      setStep(2, { status: 'error' })
      setRunning(false)
      return
    }

    // Step 3 — Episode
    setStep(3, { status: 'running' })
    try {
      const epId = await createEpisode(wId, {
        title: EPISODE_1.title,
        episodeNumber: EPISODE_1.episodeNumber,
        panels: EPISODE_1.panels,
        thumbnailURL: EPISODE_1.thumbnailURL,
        status: EPISODE_1.status,
      })
      await updateWebtoon(wId, { episodeCount: 1 })
      setStep(3, { status: 'done', id: epId })
    } catch (e) {
      console.error(e)
      setStep(3, { status: 'error' })
      setRunning(false)
      return
    }

    setRunning(false)
    setDone(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Loader2 size={32} className="animate-spin text-white/60" aria-hidden="true" />
      </div>
    )
  }

  if (!firebaseUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-6 text-center">
        <p className="text-white/40 mb-4">You must be signed in to seed demo data.</p>
        <button onClick={() => router.push('/login')} className="btn-accent">
          Log In
        </button>
      </div>
    )
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg px-6 py-10 max-w-2xl mx-auto flex flex-col justify-center">
      <button
        onClick={() => router.back()}
        className="btn-ghost mb-6 flex items-center gap-2 text-sm self-start"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </button>

      <div className="flex items-center gap-3 mb-2">
        <Sparkles size={20} className="text-white/60" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-white">Seed Demo Project</h1>
      </div>
      <p className="text-white/40 text-sm mb-8">
        Creates a pre-made novel and webtoon named <strong>Ravana: The Immortal War</strong> under your profile to let you test chapter editing, drag-and-drop ordering, and the AI Assistant.
      </p>

      {/* Preview card */}
      <div className="card p-5 mb-8 flex gap-5 bg-bg-card border border-bg-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COVER_URL}
          alt="Ravana: The Immortal War cover"
          className="w-20 rounded-lg object-cover aspect-[2/3] flex-shrink-0 bg-bg-elevated"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
        />
        <div>
          <p className="text-xs text-white/40 mb-1">Seed content</p>
          <h2 className="font-bold text-white text-lg leading-tight mb-1">Ravana: The Immortal War</h2>
          <p className="text-xs text-white/50 mb-3">Dark fantasy epic · 2 formats</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded-full text-white/70">
              <BookOpen size={10} aria-hidden="true" /> Novel + Chapter 1
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded-full text-white/70">
              <Film size={10} aria-hidden="true" /> Webtoon + Episode 1
            </span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-bg-border animate-fade-in"
          >
            <div className="flex-shrink-0">
              {step.status === 'idle' && (
                <div className="w-5 h-5 rounded-full border-2 border-bg-border" />
              )}
              {step.status === 'running' && (
                <Loader2 size={18} className="animate-spin text-white/60" aria-hidden="true" />
              )}
              {step.status === 'done' && (
                <CheckCircle2 size={18} className="text-success" aria-hidden="true" />
              )}
              {step.status === 'error' && (
                <XCircle size={18} className="text-danger" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm ${step.status === 'done' ? 'text-white' : 'text-white/60'}`}>
                {step.label}
              </p>
              {step.id && (
                <p className="text-[10px] text-white/30 font-mono mt-0.5">id: {step.id}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {done ? (
        <div className="space-y-3">
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
            <CheckCircle2 size={24} className="text-success mx-auto mb-2" aria-hidden="true" />
            <p className="text-white font-semibold">Seed complete!</p>
            <p className="text-white/50 text-sm mt-1">Ravana novel and webtoon created successfully under your profile.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {novelId && (
              <a
                href={`/create/novel/${novelId}`}
                className="btn-accent text-sm flex items-center justify-center gap-2"
              >
                <BookOpen size={14} aria-hidden="true" />
                Open Novel Editor
              </a>
            )}
            {webtoonId && (
              <a
                href={`/create/webtoon/${webtoonId}`}
                className="btn-ghost text-sm flex items-center justify-center gap-2 border border-bg-border"
              >
                <Film size={14} aria-hidden="true" />
                Open Webtoon Editor
              </a>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={runSeed}
          disabled={running}
          className="btn-accent w-full text-base py-3 flex items-center justify-center gap-2"
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Seeding…
            </>
          ) : (
            <>
              <Sparkles size={16} aria-hidden="true" />
              Seed Ravana Demo Data
            </>
          )}
        </button>
      )}
    </main>
  )
}
