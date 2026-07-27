// ---------------------------------------------------------------------------
// Brush model + preset registry.
//
// This is intentionally data-only and framework-agnostic so new brushes can be
// added by pushing to BRUSH_PRESETS — no engine or UI changes required. The
// BrushEngine (./engine) interprets these parameters into actual strokes.
//
// Every parameter maps to a real behaviour in the engine:
//   size            base diameter in canvas px
//   hardness        edge falloff — 1 = crisp ink, 0 = airbrush cloud
//   opacity         whole-stroke opacity cap (overlapping dabs never exceed it)
//   flow            paint deposited per dab (buildup within one stroke)
//   spacing         gap between dabs as a fraction of size (smaller = smoother)
//   stabilization   input smoothing — steadies shaky lines
//   scatter         random per-dab jitter as a fraction of size (grainy media)
//   sizePressure    how strongly pen pressure drives line width (0..1)
//   opacityPressure how strongly pen pressure drives opacity/flow (0..1)
// ---------------------------------------------------------------------------

export interface BrushSettings {
  id: string
  name: string
  size: number
  hardness: number
  opacity: number
  flow: number
  spacing: number
  stabilization: number
  scatter: number
  sizePressure: number
  opacityPressure: number
  /** Ink color (hex). Shared across the app — not baked into a preset. */
  color: string
}

/** A preset is every brush parameter except the shared ink color. */
export type BrushPreset = Omit<BrushSettings, 'color'>

// Ordered for the picker. Families: inking → pencils → paint → dry media.
export const BRUSH_PRESETS: BrushPreset[] = [
  { id: 'pen',         name: 'Pen',              size: 6,  hardness: 0.9,  opacity: 1,    flow: 1,    spacing: 0.05, stabilization: 0.35, scatter: 0,    sizePressure: 0.55, opacityPressure: 0 },
  { id: 'g-pen',       name: 'G-Pen',            size: 8,  hardness: 0.95, opacity: 1,    flow: 1,    spacing: 0.04, stabilization: 0.3,  scatter: 0,    sizePressure: 0.85, opacityPressure: 0 },
  { id: 'mapping-pen', name: 'Mapping Pen',      size: 4,  hardness: 1,    opacity: 1,    flow: 1,    spacing: 0.04, stabilization: 0.2,  scatter: 0,    sizePressure: 0.7,  opacityPressure: 0 },
  { id: 'ink',         name: 'Ink Brush',        size: 11, hardness: 0.88, opacity: 1,    flow: 1,    spacing: 0.04, stabilization: 0.42, scatter: 0,    sizePressure: 0.9,  opacityPressure: 0 },
  { id: 'calligraphy', name: 'Calligraphy',      size: 14, hardness: 0.85, opacity: 1,    flow: 1,    spacing: 0.05, stabilization: 0.3,  scatter: 0,    sizePressure: 0.8,  opacityPressure: 0.1 },
  { id: 'pencil',      name: 'Pencil',           size: 4,  hardness: 0.55, opacity: 0.9,  flow: 0.85, spacing: 0.06, stabilization: 0.25, scatter: 0.06, sizePressure: 0.4,  opacityPressure: 0.5 },
  { id: 'mech-pencil', name: 'Mechanical Pencil',size: 2.5,hardness: 0.8,  opacity: 1,    flow: 1,    spacing: 0.05, stabilization: 0.2,  scatter: 0.02, sizePressure: 0.2,  opacityPressure: 0.2 },
  { id: 'marker',      name: 'Marker',           size: 22, hardness: 0.7,  opacity: 0.55, flow: 0.5,  spacing: 0.05, stabilization: 0.25, scatter: 0,    sizePressure: 0,    opacityPressure: 0.2 },
  { id: 'airbrush',    name: 'Airbrush',         size: 44, hardness: 0.04, opacity: 0.9,  flow: 0.06, spacing: 0.03, stabilization: 0.2,  scatter: 0,    sizePressure: 0.2,  opacityPressure: 0.85 },
  { id: 'watercolor',  name: 'Watercolor',       size: 46, hardness: 0.12, opacity: 0.5,  flow: 0.18, spacing: 0.04, stabilization: 0.2,  scatter: 0.05, sizePressure: 0.2,  opacityPressure: 0.55 },
  { id: 'oil',         name: 'Oil Brush',        size: 30, hardness: 0.5,  opacity: 0.85, flow: 0.6,  spacing: 0.05, stabilization: 0.25, scatter: 0.04, sizePressure: 0.3,  opacityPressure: 0.3 },
  { id: 'flat',        name: 'Flat Brush',       size: 26, hardness: 0.8,  opacity: 1,    flow: 1,    spacing: 0.04, stabilization: 0.2,  scatter: 0,    sizePressure: 0.2,  opacityPressure: 0.1 },
  { id: 'chalk',       name: 'Chalk',            size: 24, hardness: 0.3,  opacity: 0.8,  flow: 0.5,  spacing: 0.08, stabilization: 0.15, scatter: 0.35, sizePressure: 0.2,  opacityPressure: 0.4 },
  { id: 'charcoal',    name: 'Charcoal',         size: 28, hardness: 0.35, opacity: 0.85, flow: 0.55, spacing: 0.07, stabilization: 0.15, scatter: 0.3,  sizePressure: 0.3,  opacityPressure: 0.4 },
  { id: 'pixel',       name: 'Pixel',            size: 4,  hardness: 1,    opacity: 1,    flow: 1,    spacing: 0.9,  stabilization: 0,    scatter: 0,    sizePressure: 0,    opacityPressure: 0 },
]

export const DEFAULT_BRUSH_ID = 'pen'

export function getBrushPreset(id: string): BrushPreset {
  return BRUSH_PRESETS.find((b) => b.id === id) ?? BRUSH_PRESETS[0]
}
