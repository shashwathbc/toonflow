import { describe, it, expect } from 'vitest'
import { screenContent, isAllowed } from './moderation'

describe('screenContent', () => {
  it('allows empty and ordinary text', () => {
    expect(screenContent('').ok).toBe(true)
    expect(screenContent('A knight rides toward the burning castle at dawn.').ok).toBe(true)
  })

  it('does NOT block legitimate mature fiction (violence, death, war, horror)', () => {
    // The screen must not wreck the product with false positives on the mature
    // themes webtoons legitimately contain.
    const lines = [
      'He drew his blade and killed the demon lord in a spray of blood.',
      'The war left the city in ruins; corpses lined the shattered streets.',
      'A gruesome, terrifying monster tore through the survivors.',
      'She died in his arms as the fire consumed the tower.',
    ]
    for (const line of lines) expect(isAllowed(line)).toBe(true)
  })

  it('hard-blocks unambiguous prohibited terms', () => {
    expect(screenContent('csam').ok).toBe(false)
    expect(screenContent('a loli character, explicit').ok).toBe(false)
    expect(screenContent('bestiality scene').ok).toBe(false)
    expect(screenContent('bestiality scene').category).toBe('bestiality')
  })

  it('blocks a minor indicator co-occurring with a sexual indicator, in any order', () => {
    expect(screenContent('a 12 year old, explicit nude scene').ok).toBe(false)
    expect(screenContent('explicit sexual content with a child').ok).toBe(false)
    expect(screenContent('naked, underage').category).toBe('minor_sexual')
  })

  it('does not block a minor indicator alone (non-sexual context)', () => {
    expect(isAllowed('a child plays in the schoolyard, laughing')).toBe(true)
    expect(isAllowed('the toddler took her first steps')).toBe(true)
  })

  it('blocks non-consensual sexual framing', () => {
    expect(screenContent('a non-consensual explicit scene').ok).toBe(false)
    expect(screenContent('a non-consensual explicit scene').category).toBe('non_consensual')
  })
})
