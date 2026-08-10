// Pure-function tests for the catalog metadata helpers. These decide what
// Google indexes and what every social card shows, so the edge cases (Markdown
// leaking into descriptions, unlisted content being indexed) are worth pinning.
import { describe, it, expect } from 'vitest'
import {
  isIndexable,
  stripMarkdown,
  toDescription,
  synopsisSnippet,
  PUBLIC_STATUSES,
} from './contentMeta'

describe('isIndexable', () => {
  it('indexes published public content', () => {
    for (const status of PUBLIC_STATUSES) {
      expect(isIndexable(status, 'public')).toBe(true)
    }
  })

  it('never indexes drafts', () => {
    expect(isIndexable('draft', 'public')).toBe(false)
  })

  it('never indexes private or unlisted content, even when published', () => {
    expect(isIndexable('published', 'private')).toBe(false)
    // Webtoons support `unlisted`: reachable by link, deliberately out of search.
    expect(isIndexable('published', 'unlisted')).toBe(false)
    expect(isIndexable('ongoing', 'unlisted')).toBe(false)
  })

  it('fails closed on missing fields', () => {
    expect(isIndexable(undefined, undefined)).toBe(false)
    expect(isIndexable('published', undefined)).toBe(false)
    expect(isIndexable(undefined, 'public')).toBe(false)
  })
})

describe('stripMarkdown', () => {
  it('removes ATX headings', () => {
    expect(stripMarkdown('# Lord Krishna\n\nIn the shadow')).toBe('Lord Krishna In the shadow')
  })

  it('removes emphasis, code and strikethrough markers', () => {
    expect(stripMarkdown('**bold** and _italic_ and `code` and ~~gone~~')).toBe(
      'bold and italic and code and gone'
    )
  })

  it('reduces links to their label and images to their alt text', () => {
    expect(stripMarkdown('see [the docs](https://x.com)')).toBe('see the docs')
    expect(stripMarkdown('![cover art](/a.png)')).toBe('cover art')
  })

  it('removes list markers and blockquotes', () => {
    expect(stripMarkdown('- one\n- two')).toBe('one two')
    expect(stripMarkdown('> quoted')).toBe('quoted')
  })

  it('strips stray HTML rather than emitting tags into a meta tag', () => {
    expect(stripMarkdown('a <b>bold</b> word')).toBe('a bold word')
  })

  it('collapses whitespace', () => {
    expect(stripMarkdown('a\n\n\tb   c')).toBe('a b c')
  })
})

describe('toDescription', () => {
  it('passes short text through unchanged', () => {
    expect(toDescription('A short synopsis.')).toBe('A short synopsis.')
  })

  it('truncates on a word boundary with an ellipsis', () => {
    const out = toDescription('word '.repeat(80))
    expect(out.length).toBeLessThanOrEqual(156)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/\s…$/) // no dangling space before the ellipsis
  })

  it('strips Markdown before measuring, so syntax never reaches the meta tag', () => {
    expect(toDescription('# Title\n\nBody text')).toBe('Title Body text')
  })

  it('respects a custom max length', () => {
    expect(toDescription('a'.repeat(50), 20).length).toBeLessThanOrEqual(21)
  })
})

describe('synopsisSnippet', () => {
  it('drops a leading heading that just repeats the title', () => {
    // The real catalog case: synopsis begins with "# Lord Krishna".
    expect(synopsisSnippet('# Lord Krishna\n\nIn the shadow of prophecy', 'Lord Krishna')).toBe(
      'In the shadow of prophecy'
    )
  })

  it('leaves the synopsis alone when it does not echo the title', () => {
    expect(synopsisSnippet('A tale of two cities', 'Lord Krishna')).toBe('A tale of two cities')
  })

  it('falls back to the full synopsis rather than returning empty', () => {
    // Synopsis is nothing but the echoed title — better to repeat it than to
    // emit an empty description.
    expect(synopsisSnippet('# Lord Krishna', 'Lord Krishna')).toBe('Lord Krishna')
  })

  it('matches case-insensitively and trims leading punctuation', () => {
    expect(synopsisSnippet('LORD KRISHNA — the beginning', 'Lord Krishna')).toBe('the beginning')
  })
})
