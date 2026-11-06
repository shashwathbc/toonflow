'use client'

import { useVideoEditorStore, DEFAULT_TEXT_STYLE } from '@/store/useVideoEditorStore'
import { EFFECTS, TEXT_ANIMATIONS, TEXT_FONTS, TRANSITIONS } from '@/lib/anime/presets'
import type { TextClipStyle } from '@/types/anime'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-center gap-2">
      <span className="text-[11px] text-text-secondary">{label}</span>
      {children}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full accent-studio-anime"
          aria-label={label}
        />
        <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-text-muted">
          {step < 1 ? value.toFixed(2) : Math.round(value)}
          {suffix}
        </span>
      </div>
    </Row>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-bg-border px-3 py-3 last:border-b-0">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

/**
 * The inspector for whatever is selected. Every control writes straight into the
 * store, and the preview reads from the same state, so edits are visible
 * immediately — no apply step.
 */
export default function EditorProperties() {
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId)
  const tracks = useVideoEditorStore((s) => s.tracks)
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const pushHistory = useVideoEditorStore((s) => s.pushHistory)

  // Derived from `tracks` rather than a store getter so this re-renders whenever
  // the selected clip's own fields change.
  const found = (() => {
    for (const track of tracks) {
      const clip = track.clips.find((item) => item.id === selectedClipId)
      if (clip) return { clip, track }
    }
    return null
  })()

  if (!found) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-xs text-text-muted">
          Select a clip on the timeline to edit its properties.
        </p>
      </div>
    )
  }

  const { clip, track } = found
  const style: TextClipStyle = clip.textStyle ?? DEFAULT_TEXT_STYLE
  const transform = clip.transform ?? { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 }

  const patchStyle = (patch: Partial<TextClipStyle>) =>
    updateClip(clip.id, { textStyle: { ...style, ...patch } })

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-bg-border px-3 py-3">
        <p className="text-xs font-bold capitalize text-text">{clip.kind} clip</p>
        <p className="text-[10px] text-text-muted">on {track.name}</p>
      </div>

      {/* Timing applies to every clip kind */}
      <Group title="Timing">
        <NumberField
          id="prop-start"
          label="Start"
          value={clip.start}
          min={0}
          max={600}
          step={0.05}
          suffix="s"
          onChange={(start) => updateClip(clip.id, { start })}
        />
        <NumberField
          id="prop-duration"
          label="Duration"
          value={clip.duration}
          min={0.2}
          max={120}
          step={0.05}
          suffix="s"
          onChange={(duration) => updateClip(clip.id, { duration })}
        />
        {(clip.kind === 'video' || clip.kind === 'audio') && (
          <NumberField
            id="prop-trim"
            label="Trim in"
            value={clip.trimStart}
            min={0}
            max={120}
            step={0.05}
            suffix="s"
            onChange={(trimStart) => updateClip(clip.id, { trimStart })}
          />
        )}
        <Row label="Lock">
          <input
            type="checkbox"
            checked={clip.locked ?? false}
            onChange={(event) => updateClip(clip.id, { locked: event.target.checked })}
            className="h-4 w-4 rounded border-bg-border-strong bg-bg-elevated accent-studio-anime"
            aria-label="Lock this clip"
          />
        </Row>
      </Group>

      {clip.kind === 'video' && (
        <>
          <Group title="Transform">
            <NumberField
              id="prop-scale"
              label="Scale"
              value={transform.scale}
              min={0.2}
              max={3}
              step={0.01}
              onChange={(scale) => updateClip(clip.id, { transform: { ...transform, scale } })}
            />
            <NumberField
              id="prop-x"
              label="Offset X"
              value={transform.x}
              min={-1}
              max={1}
              step={0.01}
              onChange={(x) => updateClip(clip.id, { transform: { ...transform, x } })}
            />
            <NumberField
              id="prop-y"
              label="Offset Y"
              value={transform.y}
              min={-1}
              max={1}
              step={0.01}
              onChange={(y) => updateClip(clip.id, { transform: { ...transform, y } })}
            />
            <NumberField
              id="prop-rotation"
              label="Rotation"
              value={transform.rotation}
              min={-180}
              max={180}
              suffix="°"
              onChange={(rotation) => updateClip(clip.id, { transform: { ...transform, rotation } })}
            />
            <NumberField
              id="prop-opacity"
              label="Opacity"
              value={transform.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(opacity) => updateClip(clip.id, { transform: { ...transform, opacity } })}
            />
          </Group>

          <Group title="Transitions">
            <Row label="In">
              <select
                value={clip.transitionIn?.type ?? 'none'}
                onChange={(event) => {
                  pushHistory()
                  updateClip(clip.id, {
                    transitionIn:
                      event.target.value === 'none'
                        ? null
                        : { type: event.target.value, durationSec: clip.transitionIn?.durationSec ?? 0.5 },
                  })
                }}
                className="input-base w-full py-1 text-xs"
                aria-label="Transition in"
              >
                {TRANSITIONS.map((transition) => (
                  <option key={transition.id} value={transition.id}>
                    {transition.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Out">
              <select
                value={clip.transitionOut?.type ?? 'none'}
                onChange={(event) => {
                  pushHistory()
                  updateClip(clip.id, {
                    transitionOut:
                      event.target.value === 'none'
                        ? null
                        : { type: event.target.value, durationSec: clip.transitionOut?.durationSec ?? 0.5 },
                  })
                }}
                className="input-base w-full py-1 text-xs"
                aria-label="Transition out"
              >
                {TRANSITIONS.map((transition) => (
                  <option key={transition.id} value={transition.id}>
                    {transition.label}
                  </option>
                ))}
              </select>
            </Row>
          </Group>

          <Group title="Audio">
            <NumberField
              id="prop-volume"
              label="Volume"
              value={clip.volume ?? 1}
              min={0}
              max={2}
              step={0.05}
              onChange={(volume) => updateClip(clip.id, { volume })}
            />
            <Row label="Mute">
              <input
                type="checkbox"
                checked={clip.muted ?? false}
                onChange={(event) => updateClip(clip.id, { muted: event.target.checked })}
                className="h-4 w-4 rounded border-bg-border-strong bg-bg-elevated accent-studio-anime"
                aria-label="Mute this clip"
              />
            </Row>
          </Group>
        </>
      )}

      {clip.kind === 'text' && (
        <>
          <Group title="Content">
            <label htmlFor="prop-text" className="sr-only">
              Text content
            </label>
            <textarea
              id="prop-text"
              value={clip.text ?? ''}
              onChange={(event) => updateClip(clip.id, { text: event.target.value.slice(0, 2000) })}
              rows={3}
              className="input-base w-full resize-none text-xs"
            />
          </Group>

          <Group title="Type">
            <Row label="Font">
              <select
                value={style.fontFamily}
                onChange={(event) => patchStyle({ fontFamily: event.target.value })}
                className="input-base w-full py-1 text-xs"
                aria-label="Font"
              >
                {TEXT_FONTS.map((font) => (
                  <option key={font.id} value={font.stack}>
                    {font.label}
                  </option>
                ))}
              </select>
            </Row>
            <NumberField
              id="prop-fontsize"
              label="Size"
              value={style.fontSize}
              min={8}
              max={220}
              onChange={(fontSize) => patchStyle({ fontSize })}
            />
            <Row label="Colour">
              <input
                type="color"
                value={style.color}
                onChange={(event) => patchStyle({ color: event.target.value })}
                className="h-7 w-full cursor-pointer rounded border border-bg-border bg-bg-elevated"
                aria-label="Text colour"
              />
            </Row>
            <Row label="Align">
              <div className="flex gap-1" role="group" aria-label="Text alignment">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => patchStyle({ align })}
                    aria-pressed={style.align === align}
                    className={`flex-1 rounded border px-1 py-1 text-[10px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      style.align === align
                        ? 'border-studio-anime/40 bg-studio-anime/15 text-studio-anime'
                        : 'border-bg-border text-text-secondary hover:text-text'
                    }`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Style">
              <div className="flex gap-1">
                {(
                  [
                    ['bold', 'Bold'],
                    ['italic', 'Italic'],
                    ['outline', 'Outline'],
                    ['shadow', 'Shadow'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patchStyle({ [key]: !style[key] } as Partial<TextClipStyle>)}
                    aria-pressed={style[key]}
                    className={`flex-1 rounded border px-1 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      style[key]
                        ? 'border-studio-anime/40 bg-studio-anime/15 text-studio-anime'
                        : 'border-bg-border text-text-secondary hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Row>
          </Group>

          <Group title="Position">
            <NumberField
              id="prop-text-x"
              label="X"
              value={style.x}
              min={0}
              max={1}
              step={0.01}
              onChange={(x) => patchStyle({ x })}
            />
            <NumberField
              id="prop-text-y"
              label="Y"
              value={style.y}
              min={0}
              max={1}
              step={0.01}
              onChange={(y) => patchStyle({ y })}
            />
            <NumberField
              id="prop-text-rot"
              label="Rotation"
              value={style.rotation}
              min={-180}
              max={180}
              suffix="°"
              onChange={(rotation) => patchStyle({ rotation })}
            />
            <NumberField
              id="prop-text-opacity"
              label="Opacity"
              value={style.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(opacity) => patchStyle({ opacity })}
            />
          </Group>

          <Group title="Animation">
            <Row label="Preset">
              <select
                value={style.animation}
                onChange={(event) => patchStyle({ animation: event.target.value })}
                className="input-base w-full py-1 text-xs"
                aria-label="Text animation"
              >
                {TEXT_ANIMATIONS.map((animation) => (
                  <option key={animation.id} value={animation.id}>
                    {animation.label}
                  </option>
                ))}
              </select>
            </Row>
          </Group>
        </>
      )}

      {clip.kind === 'effect' && (
        <Group title="Effect">
          <Row label="Type">
            <select
              value={clip.effect ?? 'glow'}
              onChange={(event) => updateClip(clip.id, { effect: event.target.value })}
              className="input-base w-full py-1 text-xs"
              aria-label="Effect type"
            >
              {EFFECTS.map((effect) => (
                <option key={effect.id} value={effect.id}>
                  {effect.label}
                </option>
              ))}
            </select>
          </Row>
          <NumberField
            id="prop-intensity"
            label="Intensity"
            value={clip.intensity ?? 0.5}
            min={0}
            max={1}
            step={0.01}
            onChange={(intensity) => updateClip(clip.id, { intensity })}
          />
        </Group>
      )}

      {clip.kind === 'audio' && (
        <Group title="Audio">
          <NumberField
            id="prop-audio-volume"
            label="Volume"
            value={clip.volume ?? 1}
            min={0}
            max={2}
            step={0.05}
            onChange={(volume) => updateClip(clip.id, { volume })}
          />
          <NumberField
            id="prop-fade-in"
            label="Fade in"
            value={clip.fadeInSec ?? 0}
            min={0}
            max={10}
            step={0.1}
            suffix="s"
            onChange={(fadeInSec) => updateClip(clip.id, { fadeInSec })}
          />
          <NumberField
            id="prop-fade-out"
            label="Fade out"
            value={clip.fadeOutSec ?? 0}
            min={0}
            max={10}
            step={0.1}
            suffix="s"
            onChange={(fadeOutSec) => updateClip(clip.id, { fadeOutSec })}
          />
        </Group>
      )}
    </div>
  )
}
