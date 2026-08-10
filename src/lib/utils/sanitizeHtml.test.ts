// Tests for the SERVER path of the sanitizer (vitest runs in node, so
// `typeof window === 'undefined'` and sanitizeHtml() dispatches to
// sanitizeOnServer). This path guards stored XSS the moment reader content is
// server-rendered, and it previously had no test coverage at all.
//
// Each "blocks" case is a payload the old denylist implementation let through
// or would have let through.
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

/** No executable surface survived: no handlers, no script-ish scheme, no tag
 *  that can run code. */
function assertInert(out: string) {
  expect(out).not.toMatch(/<\s*script/i)
  expect(out).not.toMatch(/\son[a-z]+\s*=/i)
  expect(out).not.toMatch(/javascript:/i)
  expect(out).not.toMatch(/formaction/i)
}

describe('sanitizeHtml (server path)', () => {
  it('returns empty string for nullish input', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
    expect(sanitizeHtml('')).toBe('')
  })

  it('keeps allowlisted formatting tags and text', () => {
    const out = sanitizeHtml('<p>Hello <strong>world</strong> and <em>friends</em></p>')
    expect(out).toContain('<strong>world</strong>')
    expect(out).toContain('<em>friends</em>')
    expect(out).toContain('Hello')
  })

  it('drops script elements together with their contents', () => {
    const out = sanitizeHtml('<p>safe</p><script>alert(1)</script>')
    expect(out).toContain('safe')
    expect(out).not.toContain('alert(1)')
    assertInert(out)
  })

  it('drops an unterminated script rather than leaking the rest', () => {
    const out = sanitizeHtml('<p>safe</p><script>alert(1)')
    expect(out).not.toContain('alert(1)')
    assertInert(out)
  })

  it('strips inline event handlers', () => {
    assertInert(sanitizeHtml('<img src="/a.png" onerror="alert(1)">'))
    assertInert(sanitizeHtml('<p onmouseover=alert(1)>hover</p>'))
    // Handler on a tag the old denylist never inspected.
    assertInert(sanitizeHtml('<details open ontoggle="alert(1)">x</details>'))
  })

  it('blocks javascript: URLs, including entity-encoded ones', () => {
    // Plain.
    assertInert(sanitizeHtml('<a href="javascript:alert(1)">click</a>'))
    // Entity-encoded "a" — browsers decode this, the old regex did not.
    assertInert(sanitizeHtml('<a href="jav&#97;script:alert(1)">click</a>'))
    // Entity-encoded colon.
    assertInert(sanitizeHtml('<a href="javascript&colon;alert(1)">click</a>'))
    // Embedded control character inside the scheme.
    assertInert(sanitizeHtml('<a href="jav\tascript:alert(1)">click</a>'))
  })

  it('blocks formaction, which the old denylist ignored entirely', () => {
    const out = sanitizeHtml('<form><button formaction="javascript:alert(1)">go</button></form>')
    assertInert(out)
  })

  it('drops non-allowlisted attributes but keeps safe ones', () => {
    const out = sanitizeHtml('<a href="https://example.com" title="ok" data-evil="x">link</a>')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('title="ok"')
    expect(out).not.toContain('data-evil')
  })

  it('forces rel on links so creator content cannot leak referrer or opener', () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>')
    expect(out).toContain('rel="noopener noreferrer nofollow"')
    // A creator-supplied rel must not survive alongside the forced one.
    expect(out.match(/rel=/g)).toHaveLength(1)
  })

  it('allows relative, anchor and mailto URLs', () => {
    expect(sanitizeHtml('<a href="/browse">b</a>')).toContain('href="/browse"')
    expect(sanitizeHtml('<a href="#top">t</a>')).toContain('href="#top"')
    expect(sanitizeHtml('<a href="mailto:a@b.com">m</a>')).toContain('href="mailto:a@b.com"')
  })

  it('strips dangerous style values but keeps benign ones', () => {
    expect(sanitizeHtml('<p style="color:red">x</p>')).toContain('style="color:red"')
    const out = sanitizeHtml('<p style="background:url(javascript:alert(1))">x</p>')
    expect(out).not.toContain('style=')
    assertInert(out)
  })

  it('unwraps unknown tags but preserves their text', () => {
    const out = sanitizeHtml('<table><tr><td>cell text</td></tr></table>')
    expect(out).toContain('cell text')
    expect(out).not.toMatch(/<\s*table/i)
  })

  it('drops svg/math foreign content wholesale', () => {
    assertInert(sanitizeHtml('<svg><animate onbegin="alert(1)" /></svg>'))
    assertInert(sanitizeHtml('<math><mtext></mtext></math>'))
  })

  it('escapes stray angle brackets so text cannot become markup', () => {
    const out = sanitizeHtml('<p>5 < 7 and 9 > 2</p>')
    expect(out).toContain('&lt;')
    expect(out).toContain('&gt;')
  })

  it('is idempotent — sanitizing twice changes nothing further', () => {
    const once = sanitizeHtml('<p>hi <a href="https://a.com">link</a><script>x()</script></p>')
    expect(sanitizeHtml(once)).toBe(once)
  })
})
