// Regression tests for the /api/img SSRF / open-relay guard.
//
// The proxy re-serves remote bytes from OUR origin, so `isStorageUrl` is the
// control that decides whether an attacker can put content on
// toonflowstudiopaint.com. Each case below was a live bypass before the
// bucket-scoped rewrite (SECURITY.md F-14).
import { beforeEach, describe, expect, it } from 'vitest'
import { isStorageUrl, proxyImageUrl } from './imageProxy'

const BUCKET = 'toonflow-studio-paint-f76d5.firebasestorage.app'
const PROJECT = 'toonflow-studio-paint-f76d5'

beforeEach(() => {
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = BUCKET
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = PROJECT
})

describe('isStorageUrl — accepts our own buckets', () => {
  it('accepts a Firebase download URL for our bucket', () => {
    expect(
      isStorageUrl(
        `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/webtoons%2Fu1%2Fw1%2Fpanel_1.png?alt=media&token=abc`,
      ),
    ).toBe(true)
  })

  it('accepts the legacy appspot.com spelling of our bucket', () => {
    expect(
      isStorageUrl(`https://firebasestorage.googleapis.com/v0/b/${PROJECT}.appspot.com/o/x.png?alt=media`),
    ).toBe(true)
  })

  it('accepts direct GCS access to our bucket', () => {
    expect(isStorageUrl(`https://storage.googleapis.com/${BUCKET}/covers/a.jpg`)).toBe(true)
  })

  it('accepts domain-style access where the host is our bucket', () => {
    expect(isStorageUrl(`https://${BUCKET}/covers/a.jpg`)).toBe(true)
  })
})

describe('isStorageUrl — rejects buckets we do not own', () => {
  // The core of the vulnerability: these hosts are open to public registration,
  // so a host-suffix allowlist let anyone serve bytes from our origin.
  it('rejects another project GCS bucket on storage.googleapis.com', () => {
    expect(isStorageUrl('https://storage.googleapis.com/attacker-bucket/evil.html')).toBe(false)
  })

  it('rejects an attacker-owned firebasestorage.app bucket', () => {
    expect(isStorageUrl('https://evil-project.firebasestorage.app/evil.html')).toBe(false)
  })

  it('rejects an attacker-owned appspot.com bucket', () => {
    expect(isStorageUrl('https://evil-project.appspot.com/evil.html')).toBe(false)
  })

  it('rejects a download URL that names someone else bucket', () => {
    expect(
      isStorageUrl('https://firebasestorage.googleapis.com/v0/b/evil-project.appspot.com/o/evil.html?alt=media'),
    ).toBe(false)
  })

  it('rejects a lookalike host that merely contains our bucket name', () => {
    expect(isStorageUrl(`https://${BUCKET}.evil.test/evil.html`)).toBe(false)
  })
})

describe('isStorageUrl — rejects non-Storage and malformed targets', () => {
  it('rejects cloud metadata', () => {
    expect(isStorageUrl('http://169.254.169.254/computeMetadata/v1/')).toBe(false)
    expect(isStorageUrl('https://metadata.google.internal/computeMetadata/v1/')).toBe(false)
  })

  it('rejects loopback and private addresses', () => {
    expect(isStorageUrl('http://127.0.0.1/')).toBe(false)
    expect(isStorageUrl('https://10.0.0.1/')).toBe(false)
    expect(isStorageUrl('http://localhost:8080/')).toBe(false)
  })

  it('rejects non-https schemes', () => {
    expect(isStorageUrl(`http://${BUCKET}/a.png`)).toBe(false)
    expect(isStorageUrl('file:///etc/passwd')).toBe(false)
    expect(isStorageUrl('gopher://x/')).toBe(false)
    expect(isStorageUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects credentials smuggled into the authority', () => {
    expect(isStorageUrl(`https://${BUCKET}@evil.test/evil.html`)).toBe(false)
    expect(isStorageUrl(`https://storage.googleapis.com:pass@evil.test/x`)).toBe(false)
  })

  it('rejects an explicit port', () => {
    expect(isStorageUrl(`https://${BUCKET}:8443/a.png`)).toBe(false)
  })

  it('rejects garbage', () => {
    expect(isStorageUrl('')).toBe(false)
    expect(isStorageUrl('not a url')).toBe(false)
    expect(isStorageUrl('//storage.googleapis.com/x')).toBe(false)
  })

  it('rejects a bare Storage host with no bucket in the path', () => {
    expect(isStorageUrl('https://storage.googleapis.com/')).toBe(false)
    expect(isStorageUrl('https://firebasestorage.googleapis.com/v0/b//o/x')).toBe(false)
  })
})

describe('proxyImageUrl', () => {
  it('encodes the target so query params cannot break out', () => {
    const target = `https://${BUCKET}/a.png?alt=media&token=t`
    expect(proxyImageUrl(target)).toBe(`/api/img?u=${encodeURIComponent(target)}`)
    // The encoded form must not reintroduce a second reader-visible parameter.
    expect(proxyImageUrl(target).match(/&/g)).toBeNull()
  })
})
