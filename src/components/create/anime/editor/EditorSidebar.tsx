'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeftRight,
  Image as ImageIcon,
  Film,
  LayoutTemplate,
  Music,
  Plus,
  Smile,
  Sparkles,
  Type,
  Users,
  Wand2,
} from 'lucide-react'
import { useVideoEditorStore, DEFAULT_TEXT_STYLE, DEFAULT_TRANSFORM } from '@/store/useVideoEditorStore'
import SceneStatusBadge from '../SceneStatusBadge'
import { EFFECTS, TRANSITIONS } from '@/lib/anime/presets'
import { cn } from '@/lib/utils/cn'
import type { AnimeScene, TrackKind } from '@/types/anime'

export type SidebarTab =
  | 'media'
  | 'ai'
  | 'characters'
  | 'backgrounds'
  | 'effects'
  | 'text'
  | 'audio'
  | 'transitions'
  | 'stickers'
  | 'templates'

export const SIDEBAR_TABS: { id: SidebarTab; label: string; icon: typeof Film }[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'ai', label: 'AI Generate', icon: Wand2 },
  { id: 'characters', label: 'Characters', icon: Users },
  { id: 'backgrounds', label: 'Backgrounds', icon: ImageIcon },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
]

/** Anime-flavoured overlay text presets — real, insertable content. */
const TEXT_PRESETS = [
  { label: 'Title', text: 'EPISODE ONE', size: 96, y: 0.45 },
  { label: 'Subtitle', text: 'The story begins', size: 44, y: 0.6 },
  { label: 'Dialogue', text: '“I won’t lose again.”', size: 40, y: 0.85 },
  { label: 'Caption', text: 'Three years earlier…', size: 34, y: 0.12 },
  { label: 'Impact', text: 'TO BE CONTINUED', size: 80, y: 0.5 },
]

/** Unicode glyph stickers — no external asset host, so the CSP stays intact. */
const STICKERS = ['⚡', '💥', '✨', '🔥', '❄️', '🌸', '💢', '❗', '💫', '🗡️', '🌙', '⭐']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      {children}
    </div>
  )
}

function firstTrackOfKind(kind: TrackKind): string | null {
  const track = useVideoEditorStore.getState().tracks.find((item) => item.kind === kind && !item.locked)
  return track?.id ?? null
}

export default function EditorSidebar({
  projectId,
  scenes,
  activeTab,
  onTabChange,
}: {
  projectId: string
  scenes: AnimeScene[]
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}) {
  const playhead = useVideoEditorStore((s) => s.playhead)
  const addClip = useVideoEditorStore((s) => s.addClip)
  const addTrack = useVideoEditorStore((s) => s.addTrack)
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId)
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const findClip = useVideoEditorStore((s) => s.findClip)
  const [audioName, setAudioName] = useState<string | null>(null)

  /** Drop a clip of `kind` at the playhead, creating a track if none is free. */
  const insert = (kind: TrackKind, clip: Parameters<typeof addClip>[1]) => {
    let trackId = firstTrackOfKind(kind)
    if (!trackId) {
      addTrack(kind)
      trackId = firstTrackOfKind(kind)
    }
    if (!trackId) {
      toast.error('No available track — unlock one and try again')
      return
    }
    addClip(trackId, clip)
  }

  const readyScenes = scenes.filter((scene) => scene.status === 'ready' && scene.storageKey)

  return (
    <div className="flex h-full min-h-0">
      {/* Icon rail */}
      <nav
        className="flex w-14 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-bg-border bg-bg-card py-2"
        aria-label="Editor tools"
      >
        {SIDEBAR_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'true' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 px-1 py-2 text-[9px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeTab === id
                ? 'bg-studio-anime/12 text-studio-anime'
                : 'text-text-muted hover:bg-bg-elevated hover:text-text',
            )}
          >
            <Icon size={17} aria-hidden="true" />
            <span className="text-center leading-tight">{label}</span>
          </button>
        ))}
      </nav>

      {/* Panel */}
      <div className="w-64 shrink-0 overflow-y-auto border-r border-bg-border bg-bg p-3">
        {activeTab === 'media' && (
          <Section title="Project clips">
            {readyScenes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-bg-border p-4 text-center">
                <p className="text-xs text-text-secondary">
                  No generated clips yet. Generate scenes in the project workspace, then drop them here.
                </p>
                <Link
                  href={`/create/anime/project/${projectId}`}
                  className="mt-3 inline-block rounded-lg border border-bg-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Open scenes
                </Link>
              </div>
            ) : (
              <ul className="space-y-1.5" role="list">
                {readyScenes.map((scene) => (
                  <li key={scene.id}>
                    <button
                      type="button"
                      onClick={() =>
                        insert('video', {
                          kind: 'video',
                          start: playhead,
                          duration: scene.durationSec || scene.settings.durationSec,
                          trimStart: 0,
                          sceneId: scene.id,
                          transform: { ...DEFAULT_TRANSFORM },
                          volume: 1,
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-lg border border-bg-border p-2 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
                    >
                      <Film size={14} className="shrink-0 text-studio-anime" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-text">{scene.title}</span>
                        <span className="block text-[10px] tabular-nums text-text-muted">
                          {(scene.durationSec || scene.settings.durationSec).toFixed(1)}s
                        </span>
                      </span>
                      <Plus size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {scenes.length > readyScenes.length && (
              <div className="mt-4">
                <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Not generated
                </h4>
                <ul className="space-y-1" role="list">
                  {scenes
                    .filter((scene) => scene.status !== 'ready' || !scene.storageKey)
                    .map((scene) => (
                      <li
                        key={scene.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-bg-border px-2 py-1.5 opacity-70"
                      >
                        <span className="min-w-0 truncate text-[11px] text-text-secondary">{scene.title}</span>
                        <SceneStatusBadge status={scene.status} />
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <Section title="AI tools">
              <p className="mb-3 text-xs leading-relaxed text-text-secondary">
                Generation runs from the project workspace, where quotas and progress live. These jump you
                straight there with the right action.
              </p>
              <div className="space-y-1.5">
                {[
                  { label: 'AI Scene Generator', hint: 'Write a new scene and generate it' },
                  { label: 'AI Storyboard', hint: 'Turn a story into multiple scenes' },
                  { label: 'AI Regenerate', hint: 'Re-roll a scene you already made' },
                  { label: 'AI Extend', hint: 'Continue an existing clip' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={`/create/anime/project/${projectId}`}
                    className="block rounded-lg border border-bg-border p-2.5 transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
                  >
                    <span className="block text-xs font-semibold text-text">{item.label}</span>
                    <span className="block text-[10px] text-text-muted">{item.hint}</span>
                  </Link>
                ))}
              </div>
            </Section>
            <Section title="Coming with the provider">
              <p className="text-xs leading-relaxed text-text-secondary">
                AI Remove, AI Background, AI Voice and AI Subtitle depend on capabilities the video
                provider exposes. They stay hidden until one is connected rather than appearing as
                buttons that do nothing.
              </p>
            </Section>
          </div>
        )}

        {activeTab === 'characters' && (
          <Section title="Characters">
            <p className="mb-3 text-xs leading-relaxed text-text-secondary">
              Characters are attached when you generate a scene, so the same cast carries through your
              whole story.
            </p>
            <Link
              href="/create/anime/projects#characters"
              className="block rounded-lg border border-bg-border p-2.5 text-xs font-semibold text-text transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
            >
              Manage character roster
            </Link>
          </Section>
        )}

        {activeTab === 'backgrounds' && (
          <Section title="Backgrounds">
            <p className="text-xs leading-relaxed text-text-secondary">
              Background replacement needs a segmentation-capable provider. Until one is connected, build
              backgrounds into the scene prompt — the Environment and Lighting controls in the prompt
              composer are the reliable way to direct them today.
            </p>
          </Section>
        )}

        {activeTab === 'effects' && (
          <Section title="Effects">
            <div className="grid grid-cols-2 gap-1.5">
              {EFFECTS.map((effect) => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() =>
                    insert('effect', {
                      kind: 'effect',
                      start: playhead,
                      duration: 2,
                      trimStart: 0,
                      effect: effect.id,
                      intensity: 0.6,
                    })
                  }
                  className="rounded-lg border border-bg-border p-2 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
                  title={effect.hint}
                >
                  <span className="block text-[11px] font-semibold text-text">{effect.label}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {activeTab === 'text' && (
          <Section title="Text">
            <div className="space-y-1.5">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    insert('text', {
                      kind: 'text',
                      start: playhead,
                      duration: 3,
                      trimStart: 0,
                      text: preset.text,
                      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: preset.size, y: preset.y },
                    })
                  }
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-bg-border p-2.5 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-text">{preset.label}</span>
                    <span className="block truncate text-[10px] text-text-muted">{preset.text}</span>
                  </span>
                  <Plus size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4">
            <Section title="Your audio">
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-bg-border-strong p-4 text-center transition-colors hover:border-studio-anime/50 focus-within:ring-2 focus-within:ring-studio-anime">
                <Music size={18} className="text-text-muted" aria-hidden="true" />
                <span className="text-xs font-semibold text-text">Add audio file</span>
                <span className="text-[10px] text-text-muted">MP3, WAV, OGG · up to 25 MB</span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    if (file.size > 25 * 1024 * 1024) {
                      toast.error('Audio files must be under 25 MB')
                      return
                    }
                    // The clip is placed immediately from an object URL so
                    // editing can start; the file uploads with the project save.
                    const url = URL.createObjectURL(file)
                    const element = new Audio(url)
                    element.addEventListener('loadedmetadata', () => {
                      insert('audio', {
                        kind: 'audio',
                        start: playhead,
                        duration: Number.isFinite(element.duration) ? element.duration : 5,
                        trimStart: 0,
                        audioId: url,
                        volume: 1,
                        fadeInSec: 0,
                        fadeOutSec: 0,
                      })
                      setAudioName(file.name)
                      toast.success(`${file.name} added to the timeline`)
                    })
                  }}
                />
              </label>
              {audioName && <p className="mt-2 truncate text-[10px] text-text-muted">Added: {audioName}</p>}
            </Section>
            <Section title="Silence">
              <button
                type="button"
                onClick={() =>
                  insert('audio', {
                    kind: 'audio',
                    start: playhead,
                    duration: 2,
                    trimStart: 0,
                    volume: 0,
                  })
                }
                className="w-full rounded-lg border border-bg-border p-2 text-xs font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Insert 2s gap
              </button>
            </Section>
          </div>
        )}

        {activeTab === 'transitions' && (
          <Section title="Transitions">
            <p className="mb-2 text-xs text-text-secondary">
              {selectedClipId ? 'Applies to the selected clip.' : 'Select a clip on the timeline first.'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TRANSITIONS.map((transition) => (
                <button
                  key={transition.id}
                  type="button"
                  disabled={!selectedClipId}
                  onClick={() => {
                    if (!selectedClipId) return
                    const found = findClip(selectedClipId)
                    if (!found) return
                    updateClip(selectedClipId, {
                      transitionIn:
                        transition.id === 'none' ? null : { type: transition.id, durationSec: 0.5 },
                    })
                    toast.success(`${transition.label} applied`)
                  }}
                  className="rounded-lg border border-bg-border p-2 text-left text-[11px] font-semibold text-text transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
                  title={transition.hint}
                >
                  {transition.label}
                </button>
              ))}
            </div>
          </Section>
        )}

        {activeTab === 'stickers' && (
          <Section title="Stickers">
            <div className="grid grid-cols-4 gap-1.5">
              {STICKERS.map((sticker) => (
                <button
                  key={sticker}
                  type="button"
                  onClick={() =>
                    insert('text', {
                      kind: 'text',
                      start: playhead,
                      duration: 2,
                      trimStart: 0,
                      text: sticker,
                      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 120, outline: false, y: 0.5 },
                    })
                  }
                  className="aspect-square rounded-lg border border-bg-border text-xl transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
                  aria-label={`Add ${sticker} sticker`}
                >
                  <span aria-hidden="true">{sticker}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {activeTab === 'templates' && (
          <Section title="Timeline templates">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  insert('text', {
                    kind: 'text',
                    start: 0,
                    duration: 2.5,
                    trimStart: 0,
                    text: 'EPISODE ONE',
                    textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 96, y: 0.5 },
                  })
                  insert('effect', {
                    kind: 'effect',
                    start: 0,
                    duration: 2.5,
                    trimStart: 0,
                    effect: 'vignette',
                    intensity: 0.6,
                  })
                  toast.success('Title card added')
                }}
                className="w-full rounded-lg border border-bg-border p-2.5 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
              >
                <span className="block text-xs font-semibold text-text">Title card</span>
                <span className="block text-[10px] text-text-muted">Title text + vignette at 0s</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const end = useVideoEditorStore.getState().duration()
                  insert('text', {
                    kind: 'text',
                    start: Math.max(0, end - 3),
                    duration: 3,
                    trimStart: 0,
                    text: 'TO BE CONTINUED',
                    textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 72, y: 0.5 },
                  })
                  toast.success('End card added')
                }}
                className="w-full rounded-lg border border-bg-border p-2.5 text-left transition-colors hover:border-studio-anime/40 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
              >
                <span className="block text-xs font-semibold text-text">End card</span>
                <span className="block text-[10px] text-text-muted">Adds a closing title at the end</span>
              </button>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
