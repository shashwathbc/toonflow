import { describe, it, expect } from 'vitest'
import { screenContent, isAllowed } from './moderation'

describe('screenContent — hard blocks', () => {
  it('blocks unambiguous standalone tokens', () => {
    for (const t of ['csam', 'lolicon', 'shotacon', 'child porn', 'bestiality', 'zoophilia']) {
      expect(screenContent(t).ok, t).toBe(false)
    }
  })

  it('blocks a minor indicator co-occurring with a sexual indicator', () => {
    expect(screenContent('an underage character in an explicit scene').ok).toBe(false)
    expect(screenContent('explicit art of a toddler').category).toBe('minor_sexual')
  })
})

describe('screenContent — obfuscation resistance', () => {
  it('defeats leetspeak', () => {
    expect(isAllowed('l0li')).toBe(false)
    expect(isAllowed('cs4m')).toBe(false)
  })

  it('defeats spacing and punctuation between letters', () => {
    expect(isAllowed('l o l i')).toBe(false)
    expect(isAllowed('c-s-a-m')).toBe(false)
  })

  it('catches split minor + sexual obfuscation', () => {
    expect(isAllowed('under4ge ... expl1cit')).toBe(false)
  })
})

describe('screenContent — no false positives on legitimate content', () => {
  it('allows mature adult fiction', () => {
    for (const t of [
      'a knight fighting a dragon in a burning castle',
      'a nude portrait of a grown woman, tasteful renaissance style',
      'a brutal war battlefield with fallen soldiers',
      'childhood friends reunite after twenty years',
      'a horror scene with a haunted house at midnight',
    ]) {
      expect(isAllowed(t), t).toBe(true)
    }
  })

  it('does not flag innocent words that merely contain a token substring', () => {
    // "childhood" contains "child"; the compact pass must not block it.
    expect(isAllowed('a warm childhood memory')).toBe(true)
  })

  it('treats empty input as allowed', () => {
    expect(isAllowed('')).toBe(true)
  })
})
