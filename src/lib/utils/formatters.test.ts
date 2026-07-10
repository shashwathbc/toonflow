import { describe, it, expect } from 'vitest'
import { formatCount, slugify, truncate, wordCount, readingTime } from './formatters'

describe('formatCount', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1500)).toBe('1.5K')
    expect(formatCount(2_400_000)).toBe('2.4M')
  })
  it('coerces null/undefined to 0', () => {
    expect(formatCount(null)).toBe('0')
    expect(formatCount(undefined)).toBe('0')
  })
})

describe('slugify', () => {
  it('lowercases, strips punctuation and collapses spaces to hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
  })
})

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('short', 10)).toBe('short')
  })
  it('appends an ellipsis when cutting', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde…')
  })
})

describe('wordCount / readingTime', () => {
  it('counts words ignoring extra whitespace', () => {
    expect(wordCount('  one   two three ')).toBe(3)
    expect(wordCount('')).toBe(0)
  })
  it('estimates reading time at ~200 wpm, min 1', () => {
    expect(readingTime(0)).toBe('1 min read')
    expect(readingTime(400)).toBe('2 min read')
  })
})
