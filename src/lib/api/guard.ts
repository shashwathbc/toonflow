// Shared HTTP hardening helpers for route handlers.
import type { NextRequest } from 'next/server'

/**
 * Reject obviously-oversized requests before we buffer the whole body into
 * memory. The per-field zod `.max()` caps are the real enforcement; this is a
 * cheap first gate against multi-megabyte JSON bodies (memory/cost DoS).
 */
export function bodyTooLarge(req: NextRequest, maxBytes: number): boolean {
  const len = Number(req.headers.get('content-length') ?? '0')
  return Number.isFinite(len) && len > maxBytes
}

/**
 * Escape the five HTML-significant characters. Use before interpolating any
 * user-controlled string into an HTML template (e.g. transactional emails) so a
 * value like `<img onerror=…>` can't inject markup.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
