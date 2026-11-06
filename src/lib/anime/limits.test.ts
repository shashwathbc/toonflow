import { describe, expect, it } from 'vitest'
import { allowedResolutions, HARD_LIMITS, resolutionAllowed, TIER_LIMITS, tierLimits } from './limits'
import { generationSettingsSchema, createJobSchema, timelineSchema } from './schema'
import { frameSize, aspectCss, ANIME_STYLE_IDS, CAMERA_MOVEMENT_IDS } from './presets'
import { requestFingerprint, composePrompt } from './promptBuilder'
import type { AnimeCharacter, GenerationSettings } from '@/types/anime'

const baseSettings: GenerationSettings = {
  prompt: 'A samurai standing on a mountain during a thunderstorm',
  negativePrompt: '',
  videoStyle: 'cinematic',
  animeStyle: 'shonen',
  cameraMovement: 'slow-pan',
  environment: 'mountain',
  lighting: 'storm',
  mood: 'epic',
  aspectRatio: '16:9',
  durationSec: 5,
  resolution: '720p',
  fps: 24,
  characterIds: [],
  audio: { music: 'none', sfx: false },
}

describe('entitlement limits', () => {
  it('caps the free tier below the creator tier on every cost axis', () => {
    const free = tierLimits('free')
    const creator = tierLimits('creator')
    expect(free.maxDurationSec).toBeLessThan(creator.maxDurationSec)
    expect(free.dailyJobs).toBeLessThan(creator.dailyJobs)
    expect(free.concurrentJobs).toBeLessThan(creator.concurrentJobs)
  })

  it('keeps every tier ceiling within the absolute hard limit', () => {
    for (const limits of Object.values(TIER_LIMITS)) {
      expect(limits.maxDurationSec).toBeLessThanOrEqual(HARD_LIMITS.maxDurationSec)
    }
  })

  it('refuses a resolution above the tier ceiling', () => {
    expect(resolutionAllowed('free', '720p')).toBe(true)
    expect(resolutionAllowed('free', '1080p')).toBe(false)
    expect(resolutionAllowed('creator', '1080p')).toBe(true)
  })

  it('offers only the resolutions the tier may actually request', () => {
    expect(allowedResolutions('free')).toEqual(['480p', '720p'])
    expect(allowedResolutions('creator')).toEqual(['480p', '720p', '1080p'])
  })
})

describe('generationSettingsSchema', () => {
  it('accepts a well-formed request', () => {
    expect(generationSettingsSchema.safeParse(baseSettings).success).toBe(true)
  })

  it('rejects a prompt beyond the hard character ceiling', () => {
    const result = generationSettingsSchema.safeParse({
      ...baseSettings,
      prompt: 'a'.repeat(HARD_LIMITS.promptMaxChars + 1),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a duration past the outer bound, whatever the tier', () => {
    const result = generationSettingsSchema.safeParse({ ...baseSettings, durationSec: 600 })
    expect(result.success).toBe(false)
  })

  it('rejects preset ids that are not on the list', () => {
    expect(generationSettingsSchema.safeParse({ ...baseSettings, animeStyle: 'nope' }).success).toBe(false)
    expect(generationSettingsSchema.safeParse({ ...baseSettings, cameraMovement: '../../x' }).success).toBe(false)
  })

  it('rejects an unsupported frame rate', () => {
    expect(generationSettingsSchema.safeParse({ ...baseSettings, fps: 240 }).success).toBe(false)
  })

  it('caps how many characters one scene may attach', () => {
    const tooMany = Array.from({ length: HARD_LIMITS.maxCharactersPerScene + 1 }, (_, i) => `c${i}`)
    expect(generationSettingsSchema.safeParse({ ...baseSettings, characterIds: tooMany }).success).toBe(false)
  })

  it('keeps every preset id list in sync with the schema', () => {
    for (const id of ANIME_STYLE_IDS) {
      expect(generationSettingsSchema.safeParse({ ...baseSettings, animeStyle: id }).success).toBe(true)
    }
    for (const id of CAMERA_MOVEMENT_IDS) {
      expect(generationSettingsSchema.safeParse({ ...baseSettings, cameraMovement: id }).success).toBe(true)
    }
  })
})

describe('createJobSchema', () => {
  it('defaults intent to a plain generation', () => {
    const result = createJobSchema.safeParse({
      projectId: 'p1',
      sceneId: 's1',
      settings: baseSettings,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.intent).toBe('generate')
  })

  it('rejects an oversized id, which is how a path-traversal attempt arrives', () => {
    const result = createJobSchema.safeParse({
      projectId: 'p'.repeat(500),
      sceneId: 's1',
      settings: baseSettings,
    })
    expect(result.success).toBe(false)
  })
})

describe('frameSize', () => {
  it('produces landscape dimensions capped at the nominal height', () => {
    expect(frameSize('16:9', '720p')).toEqual({ width: 1280, height: 720 })
  })

  it('caps the LONG edge for portrait ratios rather than blowing the height up', () => {
    const portrait = frameSize('9:16', '720p')
    expect(portrait.height).toBe(1280)
    expect(portrait.width).toBe(720)
  })

  it('always returns multiples of 8, which encoders require', () => {
    for (const aspect of ['16:9', '9:16', '1:1', '4:5', '21:9'] as const) {
      for (const resolution of ['480p', '720p', '1080p'] as const) {
        const { width, height } = frameSize(aspect, resolution)
        expect(width % 8).toBe(0)
        expect(height % 8).toBe(0)
      }
    }
  })

  it('formats a CSS aspect-ratio value', () => {
    expect(aspectCss('16:9')).toBe('16 / 9')
  })
})

describe('requestFingerprint', () => {
  it('is stable for identical requests', () => {
    expect(requestFingerprint('s1', baseSettings)).toBe(requestFingerprint('s1', baseSettings))
  })

  it('changes when the scene changes', () => {
    expect(requestFingerprint('s1', baseSettings)).not.toBe(requestFingerprint('s2', baseSettings))
  })

  it('changes when the prompt changes', () => {
    const other = { ...baseSettings, prompt: 'Two warriors fighting in a futuristic Tokyo' }
    expect(requestFingerprint('s1', baseSettings)).not.toBe(requestFingerprint('s1', other))
  })

  it('treats a NEW seed as a genuinely different request', () => {
    const seeded = { ...baseSettings, seed: 42 }
    const reseeded = { ...baseSettings, seed: 43 }
    expect(requestFingerprint('s1', seeded)).not.toBe(requestFingerprint('s1', reseeded))
  })

  it('ignores the order characters were attached in', () => {
    const a = { ...baseSettings, characterIds: ['x', 'y'] }
    const b = { ...baseSettings, characterIds: ['y', 'x'] }
    expect(requestFingerprint('s1', a)).toBe(requestFingerprint('s1', b))
  })
})

describe('composePrompt', () => {
  const character: AnimeCharacter = {
    id: 'c1',
    ownerId: 'u1',
    name: 'Kaito',
    appearance: 'tall and lean',
    clothing: 'a black high-collar coat',
    hair: 'silver',
    eyes: 'amber',
    age: 'late teens',
    personality: 'stubborn',
    voice: '',
    referenceImages: [],
    createdAt: { seconds: 0, nanoseconds: 0 },
    updatedAt: { seconds: 0, nanoseconds: 0 },
  }

  it('produces the SAME character description for every scene using that character', () => {
    const first = composePrompt({ ...baseSettings, prompt: 'scene one' }, [character])
    const second = composePrompt({ ...baseSettings, prompt: 'scene two' }, [character])
    // Consistency is structural: the same stored character yields identical
    // wording, which is what keeps a face recognisable across clips.
    expect(first.prompt).toContain('Kaito, late teens, silver hair, amber eyes')
    expect(second.prompt).toContain('Kaito, late teens, silver hair, amber eyes')
  })

  it('always includes the baseline negative guards', () => {
    const { negativePrompt } = composePrompt(baseSettings, [])
    expect(negativePrompt).toContain('text, watermark, logo, subtitles')
  })

  it('appends the creator negative prompt after the baseline', () => {
    const { negativePrompt } = composePrompt(
      { ...baseSettings, negativePrompt: 'modern clothing' },
      [],
    )
    expect(negativePrompt.endsWith('modern clothing')).toBe(true)
  })
})

describe('timelineSchema', () => {
  const track = {
    id: 'video-1',
    kind: 'video' as const,
    name: 'Video 1',
    clips: [],
    muted: false,
    hidden: false,
    locked: false,
  }

  it('accepts an empty timeline', () => {
    expect(
      timelineSchema.safeParse({ version: 1, aspectRatio: '16:9', fps: 24, tracks: [track] }).success,
    ).toBe(true)
  })

  it('rejects more tracks than the document may hold', () => {
    const tracks = Array.from({ length: HARD_LIMITS.maxTracks + 1 }, (_, i) => ({ ...track, id: `t${i}` }))
    expect(timelineSchema.safeParse({ version: 1, aspectRatio: '16:9', fps: 24, tracks }).success).toBe(false)
  })

  it('rejects a text clip whose colour is not a hex value', () => {
    const bad = {
      ...track,
      clips: [
        {
          id: 'c1',
          kind: 'text' as const,
          start: 0,
          duration: 2,
          trimStart: 0,
          text: 'hi',
          textStyle: {
            fontFamily: 'Inter',
            fontSize: 40,
            color: 'javascript:alert(1)',
            align: 'center' as const,
            bold: false,
            italic: false,
            outline: false,
            outlineColor: '#000000',
            shadow: false,
            opacity: 1,
            rotation: 0,
            x: 0.5,
            y: 0.5,
            animation: 'none',
          },
        },
      ],
    }
    expect(timelineSchema.safeParse({ version: 1, aspectRatio: '16:9', fps: 24, tracks: [bad] }).success).toBe(
      false,
    )
  })
})
