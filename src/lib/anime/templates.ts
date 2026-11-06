// Starting points for the Anime Studio. A template is nothing more than a
// pre-filled prompt plus preset choices — real, editable input the creator can
// change before generating anything. Nothing here implies a rendered result.
import type { GenerationSettings } from '@/types/anime'

export interface AnimeTemplate {
  id: string
  label: string
  /** What the creator gets — shown on the card. */
  description: string
  /** Suggested project title when starting from this template. */
  projectTitle: string
  /** Overrides applied on top of the project's defaults. */
  settings: Partial<GenerationSettings>
  /** Beats this template suggests, used to seed a multi-scene project. */
  scenes: { title: string; prompt: string; durationSec: number; cameraMovement: string }[]
}

export const ANIME_TEMPLATES: readonly AnimeTemplate[] = [
  {
    id: 'battle-trailer',
    label: 'Rival Battle Trailer',
    description: 'A four-beat duel: stare-down, first strike, counter, finisher.',
    projectTitle: 'Rival Battle',
    settings: {
      videoStyle: 'trailer',
      animeStyle: 'shonen',
      mood: 'tense',
      lighting: 'storm',
      aspectRatio: '16:9',
    },
    scenes: [
      {
        title: 'Scene 01 — Stare-down',
        prompt:
          'Two rival warriors face each other across a rain-slicked rooftop, coats snapping in the wind, neither moving, lightning flickering behind them',
        durationSec: 5,
        cameraMovement: 'slow-pan',
      },
      {
        title: 'Scene 02 — First strike',
        prompt:
          'The first warrior lunges forward in a burst of speed, blade drawn, water spraying from the rooftop in a wide arc',
        durationSec: 4,
        cameraMovement: 'tracking',
      },
      {
        title: 'Scene 03 — Counterattack',
        prompt:
          'The second warrior parries at the last instant, sparks exploding between the crossed blades, both faces lit from below',
        durationSec: 4,
        cameraMovement: 'handheld',
      },
      {
        title: 'Scene 04 — Finisher',
        prompt:
          'A single decisive strike cuts through the rain in slow motion, the loser falling backwards off frame as lightning fills the sky',
        durationSec: 6,
        cameraMovement: 'orbit',
      },
    ],
  },
  {
    id: 'opening-sequence',
    label: 'Series Opening',
    description: 'A stylised montage that introduces a world and its cast.',
    projectTitle: 'Series Opening',
    settings: {
      videoStyle: 'opening',
      animeStyle: 'modern-anime',
      mood: 'hopeful',
      lighting: 'golden-hour',
      aspectRatio: '16:9',
    },
    scenes: [
      {
        title: 'Scene 01 — Establishing',
        prompt: 'A sweeping shot over a coastal town at sunrise, rooftops catching golden light, gulls wheeling overhead',
        durationSec: 5,
        cameraMovement: 'crane',
      },
      {
        title: 'Scene 02 — Hero intro',
        prompt: 'A young protagonist runs up a long stone staircase toward the camera, school bag swinging, breath visible in the cold air',
        durationSec: 4,
        cameraMovement: 'dolly-out',
      },
      {
        title: 'Scene 03 — The group',
        prompt: 'Four friends stand on a hilltop looking out over the town, wind moving through the grass around them',
        durationSec: 5,
        cameraMovement: 'slow-pan',
      },
    ],
  },
  {
    id: 'vertical-short',
    label: 'Vertical Short',
    description: 'One striking 9:16 moment, sized for Shorts and Reels.',
    projectTitle: 'Vertical Short',
    settings: {
      videoStyle: 'short',
      animeStyle: 'cyberpunk',
      mood: 'ominous',
      lighting: 'neon',
      aspectRatio: '9:16',
      durationSec: 6,
    },
    scenes: [
      {
        title: 'Scene 01 — Neon street',
        prompt:
          'A lone figure in a long coat walks down a rain-soaked neon alley at night, reflections rippling underfoot, steam rising from vents',
        durationSec: 6,
        cameraMovement: 'dolly-in',
      },
    ],
  },
  {
    id: 'dark-fantasy',
    label: 'Dark Fantasy Cold Open',
    description: 'A slow, ominous build for a fantasy series premiere.',
    projectTitle: 'Blood Moon',
    settings: {
      videoStyle: 'cinematic',
      animeStyle: 'dark-fantasy',
      mood: 'ominous',
      lighting: 'night',
      environment: 'ruins',
      aspectRatio: '21:9',
    },
    scenes: [
      {
        title: 'Scene 01 — The kingdom wakes',
        prompt:
          'A ruined castle city under a blood-red moon, banners hanging in still air, faint lights flickering awake one by one in the towers',
        durationSec: 7,
        cameraMovement: 'crane',
      },
      {
        title: 'Scene 02 — Something stirs',
        prompt:
          'Deep beneath the ruins, chains strain against a sealed stone door as dust falls from the ceiling',
        durationSec: 5,
        cameraMovement: 'dolly-in',
      },
    ],
  },
  {
    id: 'slice-of-life',
    label: 'Quiet Moment',
    description: 'A calm, painterly beat — good for interludes and outros.',
    projectTitle: 'Quiet Moment',
    settings: {
      videoStyle: 'slice-of-life',
      animeStyle: 'ghibli-esque',
      mood: 'melancholy',
      lighting: 'golden-hour',
      environment: 'interior',
      aspectRatio: '16:9',
    },
    scenes: [
      {
        title: 'Scene 01 — Afternoon',
        prompt:
          'Late afternoon light moves slowly across a quiet room, dust drifting in the beam, a half-finished cup of tea on the windowsill',
        durationSec: 6,
        cameraMovement: 'static',
      },
    ],
  },
]

export function templateById(id: string): AnimeTemplate | null {
  return ANIME_TEMPLATES.find((t) => t.id === id) ?? null
}
