import type { EditorElement, Page } from '@/store/useEditorStore'

// A built-in "starter kit" of webtoon building blocks shown in the Assets panel
// so a blank canvas is never a blank page. Everything here is self-contained:
// rich pieces (bubbles, effects) are tiny inline SVGs added as image elements;
// boxes/dividers/text use the native element types (no image at all). No
// network, and the SVGs are small enough that persisting them is negligible.

export type AssetSpec = Partial<EditorElement> & { type: EditorElement['type'] }

export interface AssetItem {
  id: string
  label: string
  /** Inline SVG rendered as the tile thumbnail in the panel. */
  thumb: string
  /** Builds the element to drop onto the active page, sized to that page. */
  create: (page: Page) => AssetSpec
}

export interface AssetCategory {
  id: string
  label: string
  items: AssetItem[]
}

export const svgToDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

const centerX = (page: Page, w: number) => Math.round((page.width - w) / 2)

// ── inline SVG sources ──────────────────────────────────────────────────────
const S = {
  bubbleRound: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><path d="M24 12h192a16 16 0 0 1 16 16v92a16 16 0 0 1-16 16h-92l-38 34v-34H24a16 16 0 0 1-16-16V28a16 16 0 0 1 16-16z" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="round"/></svg>`,
  bubbleThought: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="190" viewBox="0 0 240 190"><path d="M120 18c40 0 70 8 84 26 24 4 24 40 2 46 4 26-30 40-58 34-20 16-58 16-80 2-34 4-56-20-44-42-22-16-10-52 22-54 12-12 44-18 74-12z" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="round"/><circle cx="78" cy="150" r="11" fill="#fff" stroke="#111" stroke-width="5"/><circle cx="52" cy="174" r="7" fill="#fff" stroke="#111" stroke-width="5"/></svg>`,
  bubbleShout: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 240 200"><path d="M120 6l22 34 40-20-8 44 46 6-34 30 34 30-46 6 8 44-40-20-22 34-22-34-40 20 8-44-46-6 34-30-34-30 46-6-8-44 40 20z" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="round"/></svg>`,
  captionBox: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect x="10" y="24" width="220" height="72" rx="8" fill="#111" opacity="0.8"/><rect x="30" y="44" width="140" height="8" rx="4" fill="#fff" opacity="0.85"/><rect x="30" y="64" width="180" height="8" rx="4" fill="#fff" opacity="0.5"/></svg>`,
  title: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><text x="100" y="78" font-family="Inter,sans-serif" font-size="70" font-weight="800" fill="#e8e8e8" text-anchor="middle">Aa</text></svg>`,
  dialogue: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><rect x="28" y="38" width="144" height="9" rx="4" fill="#cfcfcf"/><rect x="28" y="58" width="120" height="9" rx="4" fill="#cfcfcf"/><rect x="28" y="78" width="90" height="9" rx="4" fill="#9a9a9a"/></svg>`,
  narration: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><text x="100" y="72" font-family="Georgia,serif" font-size="40" font-style="italic" fill="#cfcfcf" text-anchor="middle">narration</text></svg>`,
  sfx: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><text x="100" y="82" font-family="Inter,sans-serif" font-size="58" font-weight="900" fill="#fff" text-anchor="middle" transform="rotate(-6 100 60)">POW!</text></svg>`,
  blockWhite: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect x="10" y="10" width="100" height="140" rx="6" fill="#fff" stroke="#333"/></svg>`,
  blockBlack: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect x="10" y="10" width="100" height="140" rx="6" fill="#0a0a0a" stroke="#333"/></svg>`,
  divider: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><rect x="20" y="56" width="160" height="8" rx="4" fill="#8a8a8a"/></svg>`,
  frame: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="160" viewBox="0 0 140 160"><rect x="16" y="16" width="108" height="128" fill="none" stroke="#d0d0d0" stroke-width="6"/></svg>`,
  speedLines: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><g stroke="#111" stroke-width="4"><path d="M0 30h300M0 60h300M0 96h300M0 132h300M0 168h300"/></g></svg>`,
  radialFocus: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g stroke="#111" stroke-width="4">${Array.from({ length: 24 }, (_, i) => { const a = (i * Math.PI) / 12; return `<line x1="${120 + Math.cos(a) * 46}" y1="${120 + Math.sin(a) * 46}" x2="${120 + Math.cos(a) * 120}" y2="${120 + Math.sin(a) * 120}"/>` }).join('')}</g></svg>`,
  impactStar: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><path d="M120 8l24 60 60-40-30 66 66 8-58 30 40 66-64-34-24 66-24-66-64 34 40-66-58-30 66-8-30-66 60 40z" fill="#ffd23f" stroke="#111" stroke-width="5" stroke-linejoin="round"/></svg>`,
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M120 30c6 32 18 44 50 50-32 6-44 18-50 50-6-32-18-44-50-50 32-6 44-18 50-50z" fill="#fff" stroke="#111" stroke-width="3"/><path d="M56 118c4 18 10 24 28 28-18 4-24 10-28 28-4-18-10-24-28-28 18-4 24-10 28-28z" fill="#fff" stroke="#111" stroke-width="3"/></svg>`,
}

const img = (src: string, w: number, page: Page, yFrac: number, name: string, ratio = 0.75): AssetSpec => {
  const width = Math.round(Math.min(page.width * w, page.width))
  const height = Math.round(width * ratio)
  return { type: 'image', src: svgToDataUri(src), x: centerX(page, width), y: Math.round(page.height * yFrac), width, height, name }
}

export const ASSET_LIBRARY: AssetCategory[] = [
  {
    id: 'speech',
    label: 'Speech & Text',
    items: [
      { id: 'bubble-round', label: 'Speech', thumb: S.bubbleRound, create: (p) => img(S.bubbleRound, 0.5, p, 0.1, 'Speech bubble', 0.75) },
      { id: 'bubble-thought', label: 'Thought', thumb: S.bubbleThought, create: (p) => img(S.bubbleThought, 0.5, p, 0.1, 'Thought bubble', 0.8) },
      { id: 'bubble-shout', label: 'Shout', thumb: S.bubbleShout, create: (p) => img(S.bubbleShout, 0.5, p, 0.1, 'Shout bubble', 0.85) },
      {
        id: 'caption', label: 'Caption', thumb: S.captionBox,
        create: (p) => {
          const w = Math.round(p.width * 0.82)
          return { type: 'rect', x: centerX(p, w), y: Math.round(p.height * 0.8), width: w, height: Math.round(p.width * 0.12), fill: '#0A0A0A', opacity: 0.78, stroke: '#000000', strokeWidth: 0, cornerRadius: 6, name: 'Caption box' }
        },
      },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    items: [
      { id: 'title', label: 'Title', thumb: S.title, create: (p) => ({ type: 'text', text: 'Title', x: Math.round(p.width * 0.1), y: Math.round(p.height * 0.06), width: Math.round(p.width * 0.8), fontSize: Math.round(p.width * 0.1), fontStyle: 'bold', align: 'center', fill: '#111111', name: 'Title' }) },
      { id: 'dialogue', label: 'Dialogue', thumb: S.dialogue, create: (p) => ({ type: 'text', text: 'Type your dialogue here…', x: Math.round(p.width * 0.15), y: Math.round(p.height * 0.14), width: Math.round(p.width * 0.55), fontSize: Math.round(p.width * 0.045), align: 'center', fill: '#111111', name: 'Dialogue' }) },
      { id: 'narration', label: 'Narration', thumb: S.narration, create: (p) => ({ type: 'text', text: 'Narration…', x: Math.round(p.width * 0.1), y: Math.round(p.height * 0.04), width: Math.round(p.width * 0.8), fontSize: Math.round(p.width * 0.05), fontStyle: 'italic', fontFamily: 'Georgia', align: 'left', fill: '#222222', name: 'Narration' }) },
      { id: 'sfx', label: 'SFX', thumb: S.sfx, create: (p) => ({ type: 'text', text: 'BOOM!', x: Math.round(p.width * 0.1), y: Math.round(p.height * 0.4), width: Math.round(p.width * 0.8), fontSize: Math.round(p.width * 0.18), fontStyle: 'bold', align: 'center', fill: '#E23B3B', name: 'SFX' }) },
    ],
  },
  {
    id: 'panels',
    label: 'Panels & Backgrounds',
    items: [
      { id: 'block-white', label: 'White', thumb: S.blockWhite, create: (p) => ({ type: 'rect', x: 0, y: 0, width: p.width, height: Math.round(p.width * 1.1), fill: '#FFFFFF', stroke: '#000000', strokeWidth: 0, cornerRadius: 0, name: 'White panel' }) },
      { id: 'block-black', label: 'Black', thumb: S.blockBlack, create: (p) => ({ type: 'rect', x: 0, y: 0, width: p.width, height: Math.round(p.width * 1.1), fill: '#0A0A0A', stroke: '#000000', strokeWidth: 0, cornerRadius: 0, name: 'Black panel' }) },
      { id: 'divider', label: 'Divider', thumb: S.divider, create: (p) => ({ type: 'rect', x: 0, y: Math.round(p.height * 0.5), width: p.width, height: Math.max(6, Math.round(p.width * 0.01)), fill: '#111111', stroke: '#000000', strokeWidth: 0, cornerRadius: 0, name: 'Divider' }) },
      { id: 'frame', label: 'Frame', thumb: S.frame, create: (p) => { const w = Math.round(p.width * 0.86); return { type: 'rect', x: centerX(p, w), y: Math.round(p.height * 0.1), width: w, height: Math.round(w * 1.2), fill: '#FFFFFF', opacity: 0, stroke: '#111111', strokeWidth: Math.max(3, Math.round(p.width * 0.008)), cornerRadius: 0, name: 'Panel frame' } } },
    ],
  },
  {
    id: 'effects',
    label: 'Effects',
    items: [
      { id: 'speed-lines', label: 'Speed', thumb: S.speedLines, create: (p) => img(S.speedLines, 0.9, p, 0.28, 'Speed lines', 0.66) },
      { id: 'radial-focus', label: 'Focus', thumb: S.radialFocus, create: (p) => img(S.radialFocus, 0.9, p, 0.16, 'Focus lines', 1) },
      { id: 'impact-star', label: 'Impact', thumb: S.impactStar, create: (p) => img(S.impactStar, 0.6, p, 0.22, 'Impact star', 1) },
      { id: 'sparkle', label: 'Sparkle', thumb: S.sparkle, create: (p) => img(S.sparkle, 0.4, p, 0.2, 'Sparkle', 1) },
    ],
  },
]
