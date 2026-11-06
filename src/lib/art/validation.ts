// Upload validation for the Art Studio. Isomorphic: the browser runs it to give
// instant feedback, the API route runs the SAME functions on the real bytes.
//
// Why magic bytes and not `file.type`: the MIME type on a File/FormData part is
// attacker-controlled metadata — renaming `payload.html` to `art.png` and
// declaring `image/png` costs nothing. Sniffing the container signature is the
// only check that looks at what the file actually IS.
//
// SVG is accepted ONLY as a design source that we rasterise; it is never stored
// or served as-is, because an SVG is a document that can carry <script> and
// external references (the Storage rules deny image/svg+xml for the same
// reason). Everything else is a raster format with no scripting surface.

export const ACCEPTED_RASTER_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const
export const ACCEPTED_UPLOAD_MIME = [...ACCEPTED_RASTER_MIME, 'image/svg+xml'] as const

export type AcceptedMime = (typeof ACCEPTED_UPLOAD_MIME)[number]

/** 25 MB — the same ceiling the Storage rules enforce for large assets. */
export const MAX_ARTWORK_BYTES = 25 * 1024 * 1024
/** SVG is text; a legitimate design never needs megabytes of markup. */
export const MAX_SVG_BYTES = 2 * 1024 * 1024
export const MAX_ARTWORK_DIMENSION = 8192
export const MIN_ARTWORK_DIMENSION = 64

export type ValidationFailure =
  | 'empty'
  | 'too_large'
  | 'unsupported_type'
  | 'type_mismatch'
  | 'dimensions_too_small'
  | 'dimensions_too_large'
  | 'svg_unsafe'

export interface ValidationResult {
  ok: boolean
  code?: ValidationFailure
  message?: string
  /** The type actually detected from the bytes, not the declared one. */
  detectedMime?: AcceptedMime
}

const FAILURE_MESSAGES: Record<ValidationFailure, string> = {
  empty: 'That file is empty.',
  too_large: 'That file is too large. The limit is 25 MB (2 MB for SVG).',
  unsupported_type: 'Only PNG, JPG, WebP and SVG files are supported.',
  type_mismatch: "That file's contents don't match its type. Please re-export it and try again.",
  dimensions_too_small: `Artwork must be at least ${MIN_ARTWORK_DIMENSION}×${MIN_ARTWORK_DIMENSION} pixels.`,
  dimensions_too_large: `Artwork must be no larger than ${MAX_ARTWORK_DIMENSION}×${MAX_ARTWORK_DIMENSION} pixels.`,
  svg_unsafe: 'That SVG contains scripts or external references, which are not allowed.',
}

function fail(code: ValidationFailure): ValidationResult {
  return { ok: false, code, message: FAILURE_MESSAGES[code] }
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, i) => bytes[offset + i] === byte)
}

/**
 * Identify the container from its leading bytes. Returns null for anything not
 * on the allowlist — including formats we could technically decode. An
 * allowlist, never a denylist.
 */
export function sniffMime(bytes: Uint8Array): AcceptedMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  // WebP: "RIFF" .... "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'
  }
  // SVG: XML text containing an <svg root within the first chunk.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 1024)).trimStart()
  if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    return 'image/svg+xml'
  }
  return null
}

/**
 * Reject SVGs carrying active content. We rasterise SVG before storing it, and
 * rasterisation in a browser still executes nothing — but the file is also
 * parsed, and an SVG that reaches out to a remote host or embeds a script is
 * never a legitimate design asset. Refuse rather than sanitise: a design that
 * needs a script isn't one we can print.
 */
export function isSvgSafe(source: string): boolean {
  const lowered = source.toLowerCase()
  const banned = ['<script', '<foreignobject', '<use', 'javascript:', 'xlink:href="http', 'href="http', '<iframe', '<embed', '<object']
  if (banned.some((needle) => lowered.includes(needle))) return false
  // Inline event handlers (onload=, onclick=, …).
  return !/\son[a-z]+\s*=/.test(lowered)
}

/**
 * Validate raw bytes. `declaredMime` is only used to catch a mismatch — the
 * decision is always made from the sniffed type.
 */
export function validateArtworkBytes(bytes: Uint8Array, declaredMime?: string): ValidationResult {
  if (bytes.byteLength === 0) return fail('empty')

  const detected = sniffMime(bytes)
  if (!detected) return fail('unsupported_type')

  const limit = detected === 'image/svg+xml' ? MAX_SVG_BYTES : MAX_ARTWORK_BYTES
  if (bytes.byteLength > limit) return fail('too_large')

  // A declared type that disagrees with the bytes is the classic disguised-file
  // upload. Normalise the jpg/jpeg spelling before comparing.
  if (declaredMime) {
    const normalized = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime
    if (normalized !== detected) return fail('type_mismatch')
  }

  if (detected === 'image/svg+xml') {
    const source = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (!isSvgSafe(source)) return fail('svg_unsafe')
  }

  return { ok: true, detectedMime: detected }
}

export function validateDimensions(width: number, height: number): ValidationResult {
  if (width < MIN_ARTWORK_DIMENSION || height < MIN_ARTWORK_DIMENSION) return fail('dimensions_too_small')
  if (width > MAX_ARTWORK_DIMENSION || height > MAX_ARTWORK_DIMENSION) return fail('dimensions_too_large')
  return { ok: true }
}

/** Browser-side convenience: read enough of a File to run the byte checks. */
export async function validateArtworkFile(file: File): Promise<ValidationResult> {
  if (file.size === 0) return fail('empty')
  if (file.size > MAX_ARTWORK_BYTES) return fail('too_large')
  // SVG needs the whole file for the safety scan; rasters only need the header.
  const looksSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
  const slice = looksSvg ? file : file.slice(0, 4096)
  const bytes = new Uint8Array(await slice.arrayBuffer())
  const result = validateArtworkBytes(bytes, file.type || undefined)
  if (!result.ok) return result
  if (result.detectedMime !== 'image/svg+xml' && file.size > MAX_ARTWORK_BYTES) return fail('too_large')
  return result
}

/** File extension for a validated raster type. */
export function extensionFor(mime: AcceptedMime): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
  }
}
