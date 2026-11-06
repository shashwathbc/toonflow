'use client'

import { useId, useMemo, useState } from 'react'
import { ChevronDown, Dices, Settings2, Users } from 'lucide-react'
import {
  ANIME_STYLES,
  ASPECT_RATIOS,
  CAMERA_MOVEMENTS,
  ENVIRONMENT_PRESETS,
  FPS_OPTIONS,
  LIGHTING_PRESETS,
  MOOD_PRESETS,
  MUSIC_PRESETS,
  RESOLUTIONS,
  VIDEO_STYLES,
} from '@/lib/anime/presets'
import { HARD_LIMITS, allowedResolutions, tierLimits, type EntitlementTier } from '@/lib/anime/limits'
import { cn } from '@/lib/utils/cn'
import type { AnimeCharacter, AspectRatio, GenerationSettings, ResolutionId } from '@/types/anime'

/** Three worked examples, shown as one-tap starting points. */
const EXAMPLE_PROMPTS = [
  'A samurai standing on a mountain during a thunderstorm',
  'Two warriors fighting in a futuristic Tokyo',
  'A dark fantasy kingdom awakening under a blood moon',
]

function Select({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { id: string; label: string; hint?: string }[]
  hint?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="input-base w-full text-sm disabled:cursor-not-allowed disabled:opacity-50"
        aria-describedby={hint ? `${id}-hint` : undefined}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

export interface PromptComposerProps {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
  characters: AnimeCharacter[]
  tier: EntitlementTier
  /** Rendered under the controls — the Generate button and its status. */
  footer?: React.ReactNode
  compact?: boolean
}

/**
 * The prompt surface.
 *
 * Beginners see one large box, three examples and four everyday choices. Every
 * technical control (seed, fps, negative prompt, resolution…) lives behind
 * Advanced Settings, collapsed by default — the split the brief asks for, and
 * the reason the default view isn't intimidating.
 *
 * All ceilings shown here mirror the SERVER's entitlement limits. They exist to
 * grey out controls, not to enforce anything: /api/anime/jobs re-checks every
 * one of them against the tier it resolves from the database.
 */
export default function PromptComposer({
  settings,
  onChange,
  characters,
  tier,
  footer,
  compact = false,
}: PromptComposerProps) {
  const uid = useId()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const limits = tierLimits(tier)
  const resolutions = useMemo(() => allowedResolutions(tier), [tier])

  const patch = (next: Partial<GenerationSettings>) => onChange({ ...settings, ...next })

  const promptLength = settings.prompt.length
  const overLimit = promptLength > HARD_LIMITS.promptMaxChars

  const toggleCharacter = (characterId: string) => {
    const selected = settings.characterIds.includes(characterId)
    if (selected) {
      patch({ characterIds: settings.characterIds.filter((id) => id !== characterId) })
      return
    }
    if (settings.characterIds.length >= HARD_LIMITS.maxCharactersPerScene) return
    patch({ characterIds: [...settings.characterIds, characterId] })
  }

  return (
    <div className="space-y-5">
      {/* ── Prompt ─────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor={`${uid}-prompt`} className="text-sm font-semibold text-text">
            Describe your scene
          </label>
          <span
            className={cn('text-[11px] tabular-nums', overLimit ? 'text-danger' : 'text-text-muted')}
            aria-live="polite"
          >
            {promptLength} / {HARD_LIMITS.promptMaxChars}
          </span>
        </div>
        <textarea
          id={`${uid}-prompt`}
          value={settings.prompt}
          onChange={(event) => patch({ prompt: event.target.value.slice(0, HARD_LIMITS.promptMaxChars) })}
          rows={compact ? 3 : 5}
          placeholder="Describe the anime video you want to create..."
          className={cn(
            'input-base w-full resize-y text-sm leading-relaxed',
            overLimit && 'border-danger focus:border-danger',
          )}
          aria-invalid={overLimit}
          aria-describedby={`${uid}-prompt-help`}
        />
        <p id={`${uid}-prompt-help`} className="mt-1.5 text-[11px] text-text-muted">
          Detail helps. Describe the subject, what they&apos;re doing, and where.
        </p>

        <ul className="mt-2.5 flex flex-wrap gap-1.5" role="list" aria-label="Example prompts">
          {EXAMPLE_PROMPTS.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => patch({ prompt: example })}
                className="rounded-full border border-bg-border px-3 py-1 text-left text-[11px] text-text-secondary transition-colors hover:border-studio-anime/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Everyday controls ──────────────────────────── */}
      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
        <Select
          id={`${uid}-anime-style`}
          label="Anime style"
          value={settings.animeStyle}
          onChange={(animeStyle) => patch({ animeStyle })}
          options={ANIME_STYLES}
        />
        <Select
          id={`${uid}-video-style`}
          label="Video style"
          value={settings.videoStyle}
          onChange={(videoStyle) => patch({ videoStyle })}
          options={VIDEO_STYLES}
        />
        <Select
          id={`${uid}-mood`}
          label="Mood"
          value={settings.mood}
          onChange={(mood) => patch({ mood })}
          options={MOOD_PRESETS}
        />
        <Select
          id={`${uid}-camera`}
          label="Camera"
          value={settings.cameraMovement}
          onChange={(cameraMovement) => patch({ cameraMovement })}
          options={CAMERA_MOVEMENTS}
        />
      </div>

      {/* Duration — the single control with a real cost implication, so it stays
          visible rather than being buried in Advanced. */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor={`${uid}-duration`} className="text-xs font-medium text-text-secondary">
            Duration
          </label>
          <span className="text-xs font-semibold tabular-nums text-text">{settings.durationSec}s</span>
        </div>
        <input
          id={`${uid}-duration`}
          type="range"
          min={HARD_LIMITS.minDurationSec}
          max={limits.maxDurationSec}
          step={1}
          value={Math.min(settings.durationSec, limits.maxDurationSec)}
          onChange={(event) => patch({ durationSec: Number(event.target.value) })}
          className="w-full accent-studio-anime"
          aria-describedby={`${uid}-duration-hint`}
        />
        <p id={`${uid}-duration-hint`} className="mt-1 text-[11px] text-text-muted">
          Up to {limits.maxDurationSec}s per clip on your plan. Build longer stories from multiple scenes.
        </p>
      </div>

      {/* ── Characters ─────────────────────────────────── */}
      {characters.length > 0 && (
        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Users size={13} aria-hidden="true" />
            Characters in this scene
            <span className="text-text-muted">
              ({settings.characterIds.length}/{HARD_LIMITS.maxCharactersPerScene})
            </span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((character) => {
              const selected = settings.characterIds.includes(character.id)
              const atLimit =
                !selected && settings.characterIds.length >= HARD_LIMITS.maxCharactersPerScene
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => toggleCharacter(character.id)}
                  disabled={atLimit}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime',
                    selected
                      ? 'border-studio-anime/40 bg-studio-anime/15 text-studio-anime'
                      : 'border-bg-border text-text-secondary hover:text-text',
                    atLimit && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {character.name}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* ── Advanced ───────────────────────────────────── */}
      <div className="rounded-xl border border-bg-border bg-bg-card">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          aria-controls={`${uid}-advanced`}
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Settings2 size={15} aria-hidden="true" />
          Advanced Settings
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={cn('ml-auto transition-transform motion-reduce:transition-none', advancedOpen && 'rotate-180')}
          />
        </button>

        {advancedOpen && (
          <div id={`${uid}-advanced`} className="space-y-4 border-t border-bg-border p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Select
                id={`${uid}-aspect`}
                label="Aspect ratio"
                value={settings.aspectRatio}
                onChange={(value) => patch({ aspectRatio: value as AspectRatio })}
                options={ASPECT_RATIOS}
              />
              <Select
                id={`${uid}-resolution`}
                label="Resolution"
                value={settings.resolution}
                onChange={(value) => patch({ resolution: value as ResolutionId })}
                options={RESOLUTIONS.filter((option) => resolutions.includes(option.id))}
                hint={
                  resolutions.length < RESOLUTIONS.length
                    ? `Up to ${limits.maxResolution} on your plan`
                    : undefined
                }
              />
              <Select
                id={`${uid}-lighting`}
                label="Lighting"
                value={settings.lighting}
                onChange={(lighting) => patch({ lighting })}
                options={LIGHTING_PRESETS}
              />
              <Select
                id={`${uid}-environment`}
                label="Environment"
                value={settings.environment}
                onChange={(environment) => patch({ environment })}
                options={ENVIRONMENT_PRESETS}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <label htmlFor={`${uid}-fps`} className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Frame rate
                </label>
                <select
                  id={`${uid}-fps`}
                  value={settings.fps}
                  onChange={(event) => patch({ fps: Number(event.target.value) })}
                  className="input-base w-full text-sm"
                >
                  {FPS_OPTIONS.map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} fps
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label htmlFor={`${uid}-seed`} className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Seed
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${uid}-seed`}
                    type="number"
                    min={0}
                    max={4_000_000_000}
                    value={settings.seed ?? ''}
                    placeholder="Random"
                    onChange={(event) => {
                      const raw = event.target.value
                      patch({ seed: raw === '' ? undefined : Math.max(0, Math.floor(Number(raw))) })
                    }}
                    className="input-base w-full text-sm"
                    aria-describedby={`${uid}-seed-hint`}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ seed: Math.floor(Math.random() * 1_000_000) })}
                    className="shrink-0 rounded-lg border border-bg-border px-3 text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Use a random seed"
                  >
                    <Dices size={15} aria-hidden="true" />
                  </button>
                </div>
                <p id={`${uid}-seed-hint`} className="mt-1 text-[11px] text-text-muted">
                  Reuse a seed to keep a look consistent across scenes.
                </p>
              </div>

              <Select
                id={`${uid}-music`}
                label="Music"
                value={settings.audio.music}
                onChange={(music) => patch({ audio: { ...settings.audio, music } })}
                options={MUSIC_PRESETS}
              />
            </div>

            <div>
              <label
                htmlFor={`${uid}-negative`}
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Negative prompt
              </label>
              <textarea
                id={`${uid}-negative`}
                value={settings.negativePrompt}
                onChange={(event) =>
                  patch({ negativePrompt: event.target.value.slice(0, HARD_LIMITS.negativePromptMaxChars) })
                }
                rows={2}
                placeholder="Things to avoid — e.g. modern clothing, on-screen text"
                className="input-base w-full resize-none text-sm"
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={settings.audio.sfx}
                onChange={(event) => patch({ audio: { ...settings.audio, sfx: event.target.checked } })}
                className="h-4 w-4 rounded border-bg-border-strong bg-bg-elevated accent-studio-anime focus-visible:ring-2 focus-visible:ring-studio-anime"
              />
              Ask for ambient sound effects where the provider supports them
            </label>
          </div>
        )}
      </div>

      {footer && <div className="flex flex-wrap items-center gap-3">{footer}</div>}
    </div>
  )
}
