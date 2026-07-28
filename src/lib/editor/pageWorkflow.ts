import type { Page, PageStatus } from '@/store/useEditorStore'
import { pageHasArt } from '@/lib/editor/panelArt'

/**
 * Page-by-page workflow helpers: what each page's status means visually, and the
 * gating that turns a flat list of agent-built pages into a "generate → review →
 * approve → unlock the next one" pipeline (the Story-Plan / Page-Overview flow).
 *
 * An "agent-built page" is any page carrying an `artPrompt`. Only those take part
 * in the gated workflow; hand-made pages are ignored here.
 */

export const PAGE_STATUS_META: Record<PageStatus, { label: string; dot: string; text: string }> = {
  ready: { label: 'Ready', dot: '#4C9AFF', text: 'text-[#7FB6FF]' },
  generating: { label: 'Generating…', dot: '#F59E0B', text: 'text-[#F59E0B]' },
  painted: { label: 'Review', dot: '#A855F7', text: 'text-[#C084FC]' },
  completed: { label: 'Approved', dot: '#22C55E', text: 'text-[#22C55E]' },
}

/**
 * The status to use when a page carries no explicit workflow status — hand-made
 * pages and projects saved before the gated workflow shipped. A page that
 * already has painted art reads as `completed` (so old chapters aren't all
 * re-locked); a blank one reads as `ready`.
 */
export function effectiveStatus(page: Page): PageStatus {
  if (page.status) return page.status
  return pageHasArt(page) ? 'completed' : 'ready'
}

export interface PageGateInfo {
  /** 0-based position among agent-built pages, in reading order. */
  index: number
  status: PageStatus
  /** A later page that can't be worked yet — an earlier page isn't approved. */
  locked: boolean
  /** The one page the creator should work on now (first not-yet-approved). */
  isCurrent: boolean
}

export interface Gating {
  /** Agent-built pages in reading order. */
  built: Page[]
  /** The current workable page, or null when every page is approved. */
  currentId: string | null
  completed: number
  total: number
  info: Map<string, PageGateInfo>
}

/**
 * Derive the gated pipeline state from the pages + their reading order. Pages
 * before/at the current page (and every already-approved page) are workable;
 * every not-yet-approved page after the current one is locked.
 */
export function pageGating(pages: Page[], order: string[]): Gating {
  const built = order
    .map((id) => pages.find((p) => p.id === id))
    .filter((p): p is Page => Boolean(p && p.artPrompt))

  let currentIndex = built.findIndex((p) => effectiveStatus(p) !== 'completed')
  if (currentIndex < 0) currentIndex = built.length // all approved
  const currentId = currentIndex < built.length ? built[currentIndex].id : null

  const info = new Map<string, PageGateInfo>()
  let completed = 0
  built.forEach((p, i) => {
    const status = effectiveStatus(p)
    if (status === 'completed') completed++
    info.set(p.id, {
      index: i,
      status,
      isCurrent: p.id === currentId,
      // Approved pages are never locked, even if they sit after a blank gap.
      locked: status !== 'completed' && i > currentIndex,
    })
  })

  return { built, currentId, completed, total: built.length, info }
}
