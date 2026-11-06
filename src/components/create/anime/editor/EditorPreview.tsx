'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { useVideoEditorStore } from '@/store/useVideoEditorStore'
import { aspectCss } from '@/lib/anime/presets'
import { TEXT_FONTS } from '@/lib/anime/presets'
import { signSceneAsset } from '@/lib/anime/client'
import type { AnimeScene, TimelineClip, TimelineTrack } from '@/types/anime'

/** CSS filter/animation for each effect preset. Purely presentational. */
function effectStyle(effect: string | undefined, intensity: number): React.CSSProperties {
  const strength = Math.max(0, Math.min(1, intensity))
  switch (effect) {
    case 'glow':
      return { filter: `brightness(${1 + strength * 0.35}) saturate(${1 + strength * 0.4})` }
    case 'motion-blur':
      return { filter: `blur(${strength * 4}px)` }
    case 'flash':
      return { backgroundColor: `rgba(255,255,255,${strength * 0.7})`, mixBlendMode: 'screen' }
    case 'vignette':
      return {
        background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${strength * 0.85}) 100%)`,
      }
    case 'grain':
      return { opacity: strength * 0.25, mixBlendMode: 'overlay' }
    case 'chromatic':
      return { filter: `drop-shadow(${strength * 3}px 0 rgba(255,0,0,.5)) drop-shadow(-${strength * 3}px 0 rgba(0,255,255,.5))` }
    case 'smoke':
      return {
        background: `linear-gradient(180deg, transparent 40%, rgba(200,200,210,${strength * 0.35}) 100%)`,
      }
    case 'fire':
      return {
        background: `linear-gradient(0deg, rgba(255,110,20,${strength * 0.5}) 0%, transparent 55%)`,
        mixBlendMode: 'screen',
      }
    case 'lightning':
      return { backgroundColor: `rgba(200,220,255,${strength * 0.35})`, mixBlendMode: 'screen' }
    case 'particles':
      return {
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,.9) 1px, transparent 1px), radial-gradient(circle, rgba(255,255,255,.6) 1px, transparent 1px)',
        backgroundSize: '90px 90px, 140px 140px',
        opacity: strength * 0.5,
      }
    case 'speed-lines':
      return {
        backgroundImage:
          'repeating-linear-gradient(100deg, rgba(255,255,255,.55) 0 2px, transparent 2px 16px)',
        opacity: strength * 0.4,
        mixBlendMode: 'screen',
      }
    case 'shake':
      return {}
    default:
      return {}
  }
}

function textShadow(style: TimelineClip['textStyle']): string | undefined {
  if (!style) return undefined
  const parts: string[] = []
  if (style.outline) {
    const c = style.outlineColor
    parts.push(`-2px 0 0 ${c}`, `2px 0 0 ${c}`, `0 -2px 0 ${c}`, `0 2px 0 ${c}`)
  }
  if (style.shadow) parts.push('0 4px 12px rgba(0,0,0,.7)')
  return parts.length > 0 ? parts.join(', ') : undefined
}

/**
 * The preview canvas.
 *
 * Video playback is a real <video> seeking against the timeline playhead; text
 * and effect tracks composite on top as DOM layers. That gives an accurate
 * WYSIWYG preview without a render backend — and, importantly, it never
 * fabricates footage: a timeline whose clips point at ungenerated scenes shows
 * the empty state, not a stand-in.
 */
export default function EditorPreview({
  projectId,
  scenes,
}: {
  projectId: string
  scenes: AnimeScene[]
}) {
  const aspectRatio = useVideoEditorStore((s) => s.aspectRatio)
  const playhead = useVideoEditorStore((s) => s.playhead)
  const playing = useVideoEditorStore((s) => s.playing)
  const tracks = useVideoEditorStore((s) => s.tracks)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  const sceneById = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes])

  // Layers visible at the current playhead, computed straight from the
  // subscribed `tracks` (rather than the store's clipsAt getter) so any clip
  // edit re-renders the preview immediately.
  const active = useMemo(() => {
    const out: { clip: TimelineClip; track: TimelineTrack }[] = []
    for (const track of tracks) {
      if (track.hidden) continue
      for (const clip of track.clips) {
        if (clip.hidden) continue
        if (playhead >= clip.start && playhead < clip.start + clip.duration) out.push({ clip, track })
      }
    }
    return out
  }, [tracks, playhead])

  const videoLayer = active.find((entry) => entry.track.kind === 'video')
  const textLayers = active.filter((entry) => entry.track.kind === 'text')
  const effectLayers = active.filter((entry) => entry.track.kind === 'effect')

  const activeSceneId = videoLayer?.clip.sceneId ?? null
  const activeScene = activeSceneId ? sceneById.get(activeSceneId) : undefined
  const hasClip = Boolean(activeScene?.storageKey && activeScene.status === 'ready')

  // Resolve the clip's private asset once per scene, on demand.
  useEffect(() => {
    if (!activeSceneId || !hasClip || signedUrls[activeSceneId]) return
    let cancelled = false
    void signSceneAsset({ projectId, sceneId: activeSceneId }).then((result) => {
      if (cancelled || !result.ok) return
      setSignedUrls((prev) => ({ ...prev, [activeSceneId]: result.url }))
    })
    return () => {
      cancelled = true
    }
  }, [activeSceneId, hasClip, projectId, signedUrls])

  // Keep the <video> element in step with the playhead. Only correct when it has
  // drifted meaningfully — seeking on every frame would stutter playback.
  useEffect(() => {
    const element = videoRef.current
    if (!element || !videoLayer) return
    const target = videoLayer.clip.trimStart + (playhead - videoLayer.clip.start)
    if (Number.isFinite(target) && Math.abs(element.currentTime - target) > 0.25) {
      element.currentTime = Math.max(0, target)
    }
  }, [playhead, videoLayer])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    if (playing) {
      void element.play().catch(() => undefined)
    } else {
      element.pause()
    }
  }, [playing, activeSceneId])

  const transform = videoLayer?.clip.transform
  const shakeActive = effectLayers.some((entry) => entry.clip.effect === 'shake')

  return (
    <div className="flex h-full w-full items-center justify-center bg-black/60 p-3 sm:p-6">
      <div
        className="relative w-full max-w-full overflow-hidden rounded-xl bg-black shadow-2xl"
        // containerType lets the text layers size themselves in `cqw`, so
        // overlay type scales with the preview instead of the viewport.
        style={{ aspectRatio: aspectCss(aspectRatio), maxHeight: '100%', containerType: 'inline-size' }}
        // The preview is a composed result, not an interactive region — the
        // timeline below owns the controls, so this is labelled but not focusable.
        role="img"
        aria-label={
          videoLayer
            ? `Preview at ${playhead.toFixed(1)} seconds`
            : 'Preview — nothing on the timeline at this point'
        }
      >
        {/* Video layer */}
        {videoLayer && hasClip && activeSceneId && signedUrls[activeSceneId] ? (
          <video
            ref={videoRef}
            src={signedUrls[activeSceneId]}
            muted={videoLayer.track.muted || videoLayer.clip.muted}
            playsInline
            preload="auto"
            className={`absolute inset-0 h-full w-full object-contain ${
              shakeActive ? 'animate-shake motion-reduce:animate-none' : ''
            }`}
            style={{
              opacity: transform?.opacity ?? 1,
              transform: transform
                ? `translate(${transform.x * 100}%, ${transform.y * 100}%) scale(${transform.scale}) rotate(${transform.rotation}deg)`
                : undefined,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
            <Clapperboard size={30} aria-hidden="true" />
            <p className="max-w-[22ch] px-4 text-center text-xs">
              {videoLayer
                ? 'This scene hasn’t been generated yet'
                : 'Nothing on the timeline here'}
            </p>
          </div>
        )}

        {/* Effect layers */}
        {effectLayers.map(({ clip }) => (
          <div
            key={clip.id}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={effectStyle(clip.effect, clip.intensity ?? 0.5)}
          />
        ))}

        {/* Text layers */}
        {textLayers.map(({ clip }) => {
          const style = clip.textStyle
          if (!style || !clip.text) return null
          const font = TEXT_FONTS.find((item) => item.stack === style.fontFamily)?.stack ?? style.fontFamily
          return (
            <div
              key={clip.id}
              className="pointer-events-none absolute max-w-[90%] px-2"
              style={{
                left: `${style.x * 100}%`,
                top: `${style.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${style.rotation}deg)`,
                opacity: style.opacity,
                textAlign: style.align,
              }}
            >
              <span
                style={{
                  fontFamily: font,
                  // Scaled against the preview width so text keeps its relative
                  // size at any preview scale.
                  fontSize: `${(style.fontSize / 1080) * 100}cqw`,
                  color: style.color,
                  fontWeight: style.bold ? 800 : 500,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  textShadow: textShadow(clip.textStyle),
                  lineHeight: 1.15,
                  display: 'block',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {clip.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
