// ---------------------------------------------------------------------------
// Speech-bubble system — emotion presets + vector outline drawing.
//
// A bubble is a real, editable element (see BubbleElement in the store): a
// vector outline drawn per `kind` plus wrapped text you can type and resize.
// This module is pure data + geometry (NO Konva / DOM imports) so the store can
// import it without pulling Konva into SSR — the drawing takes a structural
// PathCtx that Konva.Context satisfies at the call site.
// ---------------------------------------------------------------------------

export type BubbleKind =
  | 'speech' | 'thought' | 'shout' | 'scream' | 'whisper' | 'narration' | 'electronic'
  | 'angry' | 'explosive' | 'flashback' | 'weak' | 'love' | 'cold' | 'robot'
  | 'announcement' | 'phone' | 'tv' | 'demon' | 'divine' | 'cursed' | 'telepathy'
  | 'echo' | 'sarcastic' | 'crying' | 'panic' | 'embarrassed' | 'evil_laugh'
  | 'secret' | 'sleep_talking' | 'alien' | 'battle'

export interface BubbleDef {
  kind: BubbleKind
  label: string
  emotion: string
  defaultText: string
  fill: string
  stroke: string
  textColor: string
  fontFamily: string
  fontStyle: string // 'normal' | 'bold' | 'italic'
  dashed: boolean
}

// Each preset carries the emotion it conveys and sample text to match.
export const BUBBLE_DEFS: BubbleDef[] = [
  { kind: 'speech',        label: 'Speech',         emotion: 'Normal conversation',   defaultText: 'Hello there!',            fill: '#FFFFFF', stroke: '#111111', textColor: '#111111', fontFamily: 'Inter',       fontStyle: 'normal', dashed: false },
  { kind: 'thought',       label: 'Thought',        emotion: 'Internal thoughts',     defaultText: 'Hmm… I wonder.',          fill: '#FFFFFF', stroke: '#111111', textColor: '#333333', fontFamily: 'Inter',       fontStyle: 'italic', dashed: false },
  { kind: 'shout',         label: 'Shout',          emotion: 'Anger / Shock',         defaultText: 'WHAT?!',                  fill: '#FFFFFF', stroke: '#111111', textColor: '#111111', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'scream',        label: 'Scream',         emotion: 'Terror',                defaultText: 'AAAAH!!',                 fill: '#FFF7F7', stroke: '#8E1616', textColor: '#8E1616', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'whisper',       label: 'Whisper',        emotion: 'Quiet voice',           defaultText: '(psst… over here)',       fill: '#FFFFFF', stroke: '#7A7A7A', textColor: '#555555', fontFamily: 'Inter',       fontStyle: 'italic', dashed: true },
  { kind: 'narration',     label: 'Narration',      emotion: 'Story narration',       defaultText: 'Later that night…',       fill: '#0B0B0B', stroke: '#0B0B0B', textColor: '#F2F2F2', fontFamily: 'Georgia',     fontStyle: 'italic', dashed: false },
  { kind: 'electronic',    label: 'Electronic',     emotion: 'Robotic',               defaultText: 'BZZT— signal lost',       fill: '#F4F7FF', stroke: '#1B3A6B', textColor: '#1B3A6B', fontFamily: 'Courier New', fontStyle: 'normal', dashed: false },
  { kind: 'angry',         label: 'Angry',          emotion: 'Shouting, rage',        defaultText: 'HOW DARE YOU!',           fill: '#FFEEEE', stroke: '#CC0000', textColor: '#CC0000', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'explosive',     label: 'Explosive',      emotion: 'Screaming, battle cry', defaultText: 'DIE!!',                   fill: '#FFE4B5', stroke: '#FF4500', textColor: '#FF0000', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'flashback',     label: 'Flashback',      emotion: 'Memories',              defaultText: 'It was 10 years ago...',  fill: '#F0F0F0', stroke: '#AAAAAA', textColor: '#555555', fontFamily: 'Georgia',     fontStyle: 'italic', dashed: false },
  { kind: 'weak',          label: 'Weak Voice',     emotion: 'Sick, exhausted',       defaultText: 'h-help me...',            fill: '#FFFFFF', stroke: '#999999', textColor: '#777777', fontFamily: 'Inter',       fontStyle: 'italic', dashed: false },
  { kind: 'love',          label: 'Love',           emotion: 'Romantic',              defaultText: 'I love you~',             fill: '#FFF0F5', stroke: '#FF69B4', textColor: '#FF1493', fontFamily: 'Georgia',     fontStyle: 'normal', dashed: false },
  { kind: 'cold',          label: 'Cold',           emotion: 'Emotionless',           defaultText: 'I don\'t care.',          fill: '#F0F8FF', stroke: '#4682B4', textColor: '#000080', fontFamily: 'Inter',       fontStyle: 'normal', dashed: false },
  { kind: 'robot',         label: 'Robot',          emotion: 'AI, machine',           defaultText: 'AFFIRMATIVE.',            fill: '#E6E6FA', stroke: '#4B0082', textColor: '#4B0082', fontFamily: 'Courier New', fontStyle: 'bold',   dashed: false },
  { kind: 'announcement',  label: 'Announcement',   emotion: 'Loudspeaker, PA',       defaultText: 'ATTENTION ALL PASSENGERS',fill: '#FFFFE0', stroke: '#B8860B', textColor: '#8B4500', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'phone',         label: 'Phone',          emotion: 'Telephone call',        defaultText: 'Are you there?',          fill: '#F5FFFA', stroke: '#2E8B57', textColor: '#006400', fontFamily: 'Inter',       fontStyle: 'normal', dashed: true },
  { kind: 'tv',            label: 'TV / Radio',     emotion: 'Electronic audio',      defaultText: 'BREAKING NEWS',           fill: '#F0FFF0', stroke: '#00FA9A', textColor: '#008000', fontFamily: 'Courier New', fontStyle: 'normal', dashed: false },
  { kind: 'demon',         label: 'Demon',          emotion: 'Evil voice',            defaultText: 'YOUR SOUL IS MINE.',      fill: '#000000', stroke: '#8B0000', textColor: '#FFFFFF', fontFamily: 'Georgia',     fontStyle: 'bold',   dashed: false },
  { kind: 'divine',        label: 'Divine',         emotion: 'Holy voice',            defaultText: 'FEAR NOT, CHILD.',        fill: '#FFFFF0', stroke: '#FFD700', textColor: '#DAA520', fontFamily: 'Georgia',     fontStyle: 'normal', dashed: false },
  { kind: 'cursed',        label: 'Cursed',         emotion: 'Horror',                defaultText: 'l-e-a-v-e...',            fill: '#2F4F4F', stroke: '#000000', textColor: '#A9A9A9', fontFamily: 'Georgia',     fontStyle: 'italic', dashed: false },
  { kind: 'telepathy',     label: 'Telepathy',      emotion: 'Mind communication',    defaultText: '(I can hear you.)',       fill: '#F8F8FF', stroke: '#9370DB', textColor: '#8A2BE2', fontFamily: 'Inter',       fontStyle: 'italic', dashed: false },
  { kind: 'echo',          label: 'Echo',           emotion: 'Large cave, memory',    defaultText: 'hello... hello...',       fill: '#FFFFFF', stroke: '#D3D3D3', textColor: '#A9A9A9', fontFamily: 'Inter',       fontStyle: 'italic', dashed: false },
  { kind: 'sarcastic',     label: 'Sarcastic',      emotion: 'Dry humor',             defaultText: 'Oh, brilliant idea.',     fill: '#FFFFFF', stroke: '#111111', textColor: '#111111', fontFamily: 'Inter',       fontStyle: 'italic', dashed: false },
  { kind: 'crying',        label: 'Crying',         emotion: 'Emotional',             defaultText: 'WAAAH!!',                 fill: '#F0FFFF', stroke: '#00CED1', textColor: '#008B8B', fontFamily: 'Inter',       fontStyle: 'normal', dashed: false },
  { kind: 'panic',         label: 'Panic',          emotion: 'Shock',                 defaultText: 'WHAT DO WE DO?!',         fill: '#FFFAFA', stroke: '#DC143C', textColor: '#DC143C', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'embarrassed',   label: 'Embarrassed',    emotion: 'Shy',                   defaultText: 'u-um... hi...',           fill: '#FFF0F5', stroke: '#DB7093', textColor: '#C71585', fontFamily: 'Inter',       fontStyle: 'normal', dashed: false },
  { kind: 'evil_laugh',    label: 'Evil Laugh',     emotion: 'Villain',               defaultText: 'MUAHAHAHA!',              fill: '#000000', stroke: '#FF00FF', textColor: '#FF00FF', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
  { kind: 'secret',        label: 'Secret',         emotion: 'Confidential',          defaultText: 'don\'t tell anyone...',   fill: '#FFFFFF', stroke: '#C0C0C0', textColor: '#808080', fontFamily: 'Inter',       fontStyle: 'italic', dashed: true },
  { kind: 'sleep_talking', label: 'Sleep Talking',  emotion: 'Dream',                 defaultText: 'zzzz...',                 fill: '#F0F8FF', stroke: '#6495ED', textColor: '#4169E1', fontFamily: 'Inter',       fontStyle: 'normal', dashed: false },
  { kind: 'alien',         label: 'Alien',          emotion: 'Strange language',      defaultText: '⍙⟒ ☊⍜⋔⟒ ⟟⋏ ⌿⟒⏃☊⟒',       fill: '#F5FFFA', stroke: '#00FF7F', textColor: '#008080', fontFamily: 'Courier New', fontStyle: 'normal', dashed: false },
  { kind: 'battle',        label: 'Battle',         emotion: 'Intense combat',        defaultText: 'TAKE THIS!',              fill: '#FFF5EE', stroke: '#FF8C00', textColor: '#B22222', fontFamily: 'Inter',       fontStyle: 'bold',   dashed: false },
]

export function getBubbleDef(kind: BubbleKind): BubbleDef {
  return BUBBLE_DEFS.find((b) => b.kind === kind) ?? BUBBLE_DEFS[0]
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi))

/** Height reserved at the bottom for the tail (0 for tailless kinds). */
function tailHeight(kind: BubbleKind, h: number): number {
  switch (kind) {
    case 'speech':
    case 'whisper':
    case 'electronic':
    case 'weak':
    case 'love':
    case 'robot':
    case 'phone':
    case 'tv':
    case 'crying':
    case 'embarrassed':
    case 'secret':
    case 'sleep_talking':
    case 'alien':
      return clamp(h * 0.16, 12, 32)
    case 'thought':
      return clamp(h * 0.22, 16, 46)
    default:
      return 0
  }
}

/** The padded rectangle inside a bubble where its text is laid out. */
export function bubbleTextRect(
  kind: BubbleKind,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  const pad = clamp(w * 0.09, 10, 26)
  const bodyH = h - tailHeight(kind, h)
  switch (kind) {
    case 'shout':
    case 'angry':
    case 'evil_laugh':
    case 'battle':
      return { x: w * 0.22, y: h * 0.26, width: w * 0.56, height: h * 0.46 }
    case 'scream':
    case 'explosive':
    case 'panic':
    case 'demon':
      return { x: w * 0.24, y: h * 0.28, width: w * 0.52, height: h * 0.42 }
    case 'thought':
    case 'sleep_talking':
      return { x: w * 0.16, y: bodyH * 0.14, width: w * 0.68, height: bodyH * 0.7 }
    case 'narration':
    case 'flashback':
    case 'announcement':
      return { x: pad, y: pad, width: w - 2 * pad, height: h - 2 * pad }
    default:
      return { x: pad, y: pad, width: w - 2 * pad, height: bodyH - 2 * pad }
  }
}

// --- vector outlines --------------------------------------------------------
// Structural type satisfied by Konva.Context (and the raw 2D context). Keeping
// it local avoids importing Konva here.
export interface PathCtx {
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void
  arc(x: number, y: number, r: number, a0: number, a1: number, anti?: boolean): void
}

const TAU = Math.PI * 2

function pathRoundRect(ctx: PathCtx, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r)
  ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(r, h)
  ctx.quadraticCurveTo(0, h, 0, h - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
}

function pathRoundTail(ctx: PathCtx, w: number, h: number, tailH: number, r: number, tailCenter: number) {
  const bodyH = h - tailH
  r = Math.min(r, w / 2, bodyH / 2)
  const tw = Math.min(w * 0.14, 26)
  const tx = w * tailCenter
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r)
  ctx.lineTo(w, bodyH - r)
  ctx.quadraticCurveTo(w, bodyH, w - r, bodyH)
  ctx.lineTo(tx + tw, bodyH)
  ctx.lineTo(tx - tw * 0.3, h) // tail tip, slightly skewed
  ctx.lineTo(tx - tw, bodyH)
  ctx.lineTo(r, bodyH)
  ctx.quadraticCurveTo(0, bodyH, 0, bodyH - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
}

function pathElectronic(ctx: PathCtx, w: number, h: number, tailH: number) {
  const bodyH = h - tailH
  const c = Math.min(w * 0.09, bodyH * 0.18, 20)
  const tw = Math.min(w * 0.12, 22)
  const tx = w * 0.3
  ctx.beginPath()
  ctx.moveTo(c, 0)
  ctx.lineTo(w - c, 0)
  ctx.lineTo(w, c)
  ctx.lineTo(w, bodyH - c)
  ctx.lineTo(w - c, bodyH)
  ctx.lineTo(tx + tw, bodyH)
  ctx.lineTo(tx + tw * 0.2, h) // angular tail
  ctx.lineTo(tx - tw, bodyH)
  ctx.lineTo(c, bodyH)
  ctx.lineTo(0, bodyH - c)
  ctx.lineTo(0, c)
  ctx.closePath()
}

function pathThought(ctx: PathCtx, w: number, h: number, tailH: number) {
  const bodyH = h - tailH
  const cx = w / 2
  const cy = bodyH / 2
  const rx = (w / 2) * 0.98
  const ry = (bodyH / 2) * 0.98
  const bumps = Math.max(10, Math.round(w / 34))
  const bulge = Math.min(rx, ry) * 0.26
  ctx.beginPath()
  ctx.moveTo(cx + rx, cy)
  for (let i = 0; i < bumps; i++) {
    const a1 = ((i + 1) / bumps) * TAU
    const am = ((i + 0.5) / bumps) * TAU
    const nx = cx + Math.cos(a1) * rx
    const ny = cy + Math.sin(a1) * ry
    const cxp = cx + Math.cos(am) * (rx + bulge)
    const cyp = cy + Math.sin(am) * (ry + bulge)
    ctx.quadraticCurveTo(cxp, cyp, nx, ny)
  }
  ctx.closePath()
  // Two trailing thought puffs as separate subpaths.
  const c1r = Math.max(5, tailH * 0.28)
  const c2r = Math.max(3, tailH * 0.18)
  const c1x = w * 0.34
  const c1y = bodyH + tailH * 0.35
  const c2x = w * 0.26
  const c2y = bodyH + tailH * 0.78
  ctx.moveTo(c1x + c1r, c1y)
  ctx.arc(c1x, c1y, c1r, 0, TAU)
  ctx.moveTo(c2x + c2r, c2y)
  ctx.arc(c2x, c2y, c2r, 0, TAU)
}

function pathBurst(ctx: PathCtx, w: number, h: number, spikes: number, innerRatio: number) {
  const cx = w / 2
  const cy = h / 2
  const ox = (w / 2) * 0.98
  const oy = (h / 2) * 0.98
  const n = spikes * 2
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2
    const outer = i % 2 === 0
    const rx = ox * (outer ? 1 : innerRatio)
    const ry = oy * (outer ? 1 : innerRatio)
    const x = cx + Math.cos(a) * rx
    const y = cy + Math.sin(a) * ry
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Build the bubble outline path for `kind` within the box (0,0,w,h). */
export function pathBubble(ctx: PathCtx, kind: BubbleKind, w: number, h: number) {
  switch (kind) {
    case 'speech':
    case 'weak':
    case 'love':
    case 'divine':
    case 'echo':
    case 'crying':
    case 'embarrassed':
    case 'alien':
    case 'sarcastic':
    case 'cursed': {
      const t = tailHeight(kind, h)
      pathRoundTail(ctx, w, h, t, Math.min(24, (h - t) * 0.28), 0.28)
      break
    }
    case 'whisper':
    case 'secret':
    case 'phone': {
      const t = tailHeight(kind, h)
      pathRoundTail(ctx, w, h, t, Math.min(28, (h - t) * 0.42), 0.3)
      break
    }
    case 'electronic':
    case 'robot':
    case 'tv':
    case 'cold':
    case 'telepathy':
      pathElectronic(ctx, w, h, tailHeight(kind, h))
      break
    case 'thought':
    case 'sleep_talking':
      pathThought(ctx, w, h, tailHeight(kind, h))
      break
    case 'shout':
    case 'angry':
    case 'evil_laugh':
    case 'battle':
      pathBurst(ctx, w, h, 12, 0.72)
      break
    case 'scream':
    case 'explosive':
    case 'panic':
    case 'demon':
      pathBurst(ctx, w, h, 18, 0.64)
      break
    case 'narration':
    case 'flashback':
    case 'announcement':
    default:
      pathRoundRect(ctx, w, h, Math.min(10, h * 0.12))
  }
}

// --- element spec builder ---------------------------------------------------
// Shared by the store (addBubble) and the asset library so a bubble looks the
// same however it is inserted. Returns everything but position/base flags.
export interface BubbleSpec {
  type: 'bubble'
  bubbleType: BubbleKind
  name: string
  text: string
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
  fontStyle: string
  textColor: string
  align: 'left' | 'center' | 'right'
  dashed: boolean
}

function heightRatio(kind: BubbleKind): number {
  switch (kind) {
    case 'narration':
    case 'flashback':
    case 'announcement':
      return 0.42
    case 'shout':
    case 'scream':
    case 'angry':
    case 'explosive':
    case 'panic':
    case 'demon':
    case 'evil_laugh':
    case 'battle':
      return 0.95
    case 'thought':
    case 'sleep_talking':
      return 0.82
    default:
      return 0.72
  }
}

export function makeBubbleSpec(kind: BubbleKind, width: number): BubbleSpec {
  const def = getBubbleDef(kind)
  return {
    type: 'bubble',
    bubbleType: kind,
    name: `${def.label} bubble`,
    text: def.defaultText,
    width: Math.round(width),
    height: Math.round(width * heightRatio(kind)),
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: Math.max(2, Math.round(width * 0.014)),
    fontSize: Math.max(13, Math.round(width * 0.11)),
    fontFamily: def.fontFamily,
    fontStyle: def.fontStyle,
    textColor: def.textColor,
    align: 'center',
    dashed: def.dashed,
  }
}
