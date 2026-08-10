// Allowlist HTML sanitizer for reader content rendered via dangerouslySetInnerHTML.
// Chapter/episode bodies come from the TipTap editor and the AI writer, but a
// creator owns their content documents and could write arbitrary HTML directly
// through the client SDK — so anything shown to other readers MUST be sanitized
// or a crafted <img onerror=…> / <script> becomes stored XSS.
//
// Two implementations, ONE policy (the allowlists below are shared):
//   • Browser — parse with DOMParser and keep only known-safe tags/attributes.
//   • Server  — tokenizer over the same allowlist. This used to be a denylist of
//     a handful of tags plus an `on\w+=` strip, which let through
//     `formaction=javascript:`, `<a href="jav&#97;script:…">` (browsers decode
//     entities in attributes, the regex didn't) and any event handler on a tag
//     it wasn't looking for. Both paths are now fail-closed: unknown tag →
//     dropped, unknown attribute → dropped, non-allowlisted URL scheme → dropped.
//
// Reader pages currently hydrate content client-side, so the DOM path is what
// runs today — but the server path must be just as safe, because the moment any
// of this content is server-rendered (for SEO) it becomes the live path.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'img',
])

/** Tags whose *contents* are never markup — dropping the tag alone would leave
 *  the script body as visible text, so the whole subtree goes. */
const RAW_TEXT_TAGS = ['script', 'style', 'iframe', 'noscript', 'noembed', 'template', 'xmp', 'svg', 'math']

/** Void elements — no closing tag, so they serialise as `<br />`. */
const VOID_TAGS = new Set(['br', 'hr', 'img'])

const GLOBAL_ATTRS = new Set(['style', 'class'])
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
}

const SAFE_URL = /^(https?:|mailto:|\/|#)/i
const UNSAFE_STYLE = /(expression|javascript:|url\s*\(|@import)/i

function attrAllowed(tag: string, name: string): boolean {
  if (name.startsWith('on')) return false
  return GLOBAL_ATTRS.has(name) || (TAG_ATTRS[tag]?.has(name) ?? false)
}

/** Normalise an attribute value the way a browser would before it resolves a
 *  URL: decode numeric/named entities and drop the whitespace and C0 control
 *  characters that are legal inside a scheme (`java\tscript:` is a live URL).
 *  Only used to DECIDE whether a URL is safe — never to rewrite the output. */
function normalizeUrl(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&(tab|newline);/gi, '')
    // C0 controls + space: a tab or newline inside the scheme still navigates.
    .replace(/[\u0000-\u0020\u007f]/g, '')
}

function urlSafe(value: string): boolean {
  return SAFE_URL.test(normalizeUrl(value))
}

// ── Browser path ──────────────────────────────────────────────
function sanitizeInBrowser(dirty: string): string {
  const doc = new DOMParser().parseFromString(dirty, 'text/html')

  doc.body.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      el.remove()
      return
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (!attrAllowed(tag, name)) {
        el.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src') && !urlSafe(attr.value.trim())) {
        el.removeAttribute(attr.name)
      }
      if (name === 'style' && UNSAFE_STYLE.test(attr.value)) {
        el.removeAttribute(attr.name)
      }
    }
    if (tag === 'a') el.setAttribute('rel', 'noopener noreferrer nofollow')
  })

  return doc.body.innerHTML
}

// ── Server path ───────────────────────────────────────────────
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
// A tag: optional slash, name, then an attribute blob that tolerates quoted `>`.
const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/?\s*>/g

function escapeText(text: string): string {
  return text.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return value.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Rebuild a start tag from ONLY the attributes that survive the allowlist. */
function buildStartTag(tag: string, rawAttrs: string): string {
  const kept: string[] = []
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(rawAttrs)) !== null) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (!attrAllowed(tag, name)) continue
    if ((name === 'href' || name === 'src') && !urlSafe(value.trim())) continue
    if (name === 'style' && UNSAFE_STYLE.test(value)) continue
    if (tag === 'a' && name === 'rel') continue // forced below
    kept.push(`${name}="${escapeAttr(value)}"`)
  }
  if (tag === 'a') kept.push('rel="noopener noreferrer nofollow"')
  const attrs = kept.length ? ` ${kept.join(' ')}` : ''
  return VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`
}

function sanitizeOnServer(dirty: string): string {
  // 1. Remove raw-text / foreign-content elements together with their contents.
  //    Unterminated forms (`<script>…` with no close) are cut to end-of-input so
  //    a dangling opener can't smuggle the rest of the document through.
  let html = dirty
  for (const tag of RAW_TEXT_TAGS) {
    html = html
      .replace(new RegExp(`<\\s*${tag}\\b[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`, 'gi'), '')
      .replace(new RegExp(`<\\s*${tag}\\b[\\s\\S]*$`, 'gi'), '')
  }
  // 2. Comments — `<!-- -->` can hide conditional-comment script in old engines.
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<![\s\S]*?>/g, '')

  // 3. Walk the remaining tags. Anything not on the allowlist is unwrapped (the
  //    tag disappears, its text stays) — safe, because every executable element
  //    was already removed wholesale in step 1.
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(html)) !== null) {
    out += escapeText(html.slice(last, m.index))
    last = m.index + m[0].length

    const isClose = m[1] === '/'
    const tag = m[2].toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) continue
    out += isClose ? (VOID_TAGS.has(tag) ? '' : `</${tag}>`) : buildStartTag(tag, m[3] ?? '')
  }
  out += escapeText(html.slice(last))
  return out
}

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return typeof window === 'undefined' ? sanitizeOnServer(dirty) : sanitizeInBrowser(dirty)
}
