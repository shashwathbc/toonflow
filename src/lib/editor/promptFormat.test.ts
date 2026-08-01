import { describe, it, expect } from 'vitest'
import {
  formatPagePrompt,
  parsePagePrompt,
  tagForLineKind,
  kindForTag,
} from './promptFormat'

describe('tag ⇄ kind', () => {
  it('upper-cases a bubble kind and inverts losslessly', () => {
    expect(tagForLineKind('narration')).toBe('NARRATION')
    expect(tagForLineKind('sleep_talking')).toBe('SLEEP_TALKING')
    expect(kindForTag('NARRATION')).toBe('narration')
    expect(kindForTag('sleep_talking')).toBe('sleep_talking')
  })

  it('maps the SFX tag to the onomatopoeia caption kind', () => {
    expect(tagForLineKind('sfx')).toBe('SFX')
    expect(kindForTag('SFX')).toBe('sfx')
  })

  it('falls back to plain speech for an unknown tag (e.g. a name)', () => {
    expect(kindForTag('Arin')).toBe('speech')
  })
})

describe('formatPagePrompt / parsePagePrompt', () => {
  const art =
    'A distant Himalayan Shiva temple in the snow. Color: midnight blue, secondary bronze, accent violet.'
  const lines = [
    { kind: 'sfx' as const, text: 'DONG. DONG. DONG.' },
    { kind: 'narration' as const, text: 'A forgotten age had ended.' },
  ]

  it('renders both headers in the canonical order', () => {
    const block = formatPagePrompt(art, lines)
    expect(block).toContain('PROMPT\n' + art)
    expect(block).toContain('\nTEXT\n[SFX] DONG. DONG. DONG.')
    expect(block).toContain('[NARRATION] A forgotten age had ended.')
  })

  it('round-trips art + lines through format → parse', () => {
    const parsed = parsePagePrompt(formatPagePrompt(art, lines))
    expect(parsed.art).toBe(art)
    expect(parsed.lines).toEqual([
      { tag: 'SFX', text: 'DONG. DONG. DONG.', kind: 'sfx' },
      { tag: 'NARRATION', text: 'A forgotten age had ended.', kind: 'narration' },
    ])
  })

  it('drops empty text rows and keeps the pattern on a silent panel', () => {
    const block = formatPagePrompt(art, [])
    const parsed = parsePagePrompt(block)
    expect(parsed.art).toBe(art)
    expect(parsed.lines).toEqual([])
  })

  it('treats a header-less prompt as art-only (legacy / hand-typed)', () => {
    const parsed = parsePagePrompt('just an old art prompt with no headers')
    expect(parsed.art).toBe('just an old art prompt with no headers')
    expect(parsed.lines).toEqual([])
  })

  it('treats an untagged TEXT row as a plain speech line', () => {
    const parsed = parsePagePrompt('PROMPT\nsome art\n\nTEXT\nHello there!')
    expect(parsed.lines).toEqual([{ tag: 'SPEECH', text: 'Hello there!', kind: 'speech' }])
  })
})
