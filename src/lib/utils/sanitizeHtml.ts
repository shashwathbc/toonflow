// Allowlist HTML sanitizer for reader content rendered via dangerouslySetInnerHTML.
// Chapter/episode bodies come from the TipTap editor and the AI writer, but a
// creator owns their content documents and could write arbitrary HTML directly
// through the client SDK — so anything shown to other readers MUST be sanitized
// or a crafted <img onerror=…> / <script> becomes stored XSS.
//
// In the browser we parse with the DOM and keep only known-safe tags/attributes
// (fail-closed: unknown tags are dropped). On the server we fall back to a
// conservative strip of the executable vectors; reader pages hydrate the real
// content client-side, so the DOM path is what actually runs.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'img',
])

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
      if ((name === 'href' || name === 'src') && !SAFE_URL.test(attr.value.trim())) {
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

// Server fallback: strip the executable vectors. Not a full parser, but the
// reader renders the sanitized DOM output on the client anyway.
function sanitizeOnServer(dirty: string): string {
  return dirty
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*(javascript|data|vbscript):[^"'>\s]*/gi, '$1="#"')
}

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return typeof window === 'undefined' ? sanitizeOnServer(dirty) : sanitizeInBrowser(dirty)
}
