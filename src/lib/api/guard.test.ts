import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { bodyTooLarge, escapeHtml } from './guard'

function reqWithContentLength(len: string | null): NextRequest {
  return {
    headers: { get: (k: string) => (k === 'content-length' ? len : null) },
  } as unknown as NextRequest
}

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('&')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;&amp;&#39;)&quot;&gt;',
    )
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('bodyTooLarge', () => {
  it('is false at or under the limit', () => {
    expect(bodyTooLarge(reqWithContentLength('100'), 200)).toBe(false)
    expect(bodyTooLarge(reqWithContentLength('200'), 200)).toBe(false)
  })

  it('is true over the limit', () => {
    expect(bodyTooLarge(reqWithContentLength('201'), 200)).toBe(true)
  })

  it('treats a missing content-length as 0 bytes', () => {
    expect(bodyTooLarge(reqWithContentLength(null), 200)).toBe(false)
  })
})
