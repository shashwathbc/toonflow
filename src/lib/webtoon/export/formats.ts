import type { Episode } from '@/types'

/** Grouping shown as section headers in the download menu. */
export type ExportGroup = 'Platforms' | 'Archives' | 'Image sequences' | 'Documents' | 'Data'

/** Icon keys resolved to lucide components inside the menu component. */
export type ExportIcon =
  | 'webtoon'
  | 'tapas'
  | 'mangadex'
  | 'zip'
  | 'cbz'
  | 'pdf'
  | 'png'
  | 'jpg'
  | 'webp'
  | 'avif'
  | 'html'
  | 'json'

export interface ExportFormat {
  id: string
  label: string
  /** One-line description of how it's packaged/optimized. */
  hint: string
  group: ExportGroup
  icon: ExportIcon
  /**
   * Codec this format needs the browser to encode. When set, the menu probes
   * support and disables the item if the browser can't produce it.
   */
  requiresMime?: string
}

/**
 * Every export the download menu offers, in display order. Each maps to a case
 * in `runExport` (see ./run). Keep ids stable — they're referenced by analytics
 * and the menu.
 */
export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'webtoon-vertical',
    label: 'WEBTOON',
    hint: 'Vertical images · 800px slices',
    group: 'Platforms',
    icon: 'webtoon',
  },
  {
    id: 'tapas-vertical',
    label: 'Tapas',
    hint: 'Vertical images · 940px slices',
    group: 'Platforms',
    icon: 'tapas',
  },
  {
    id: 'mangadex-pages',
    label: 'MangaDex',
    hint: 'Page images · PNG sequence',
    group: 'Platforms',
    icon: 'mangadex',
  },
  {
    id: 'zip-sequence',
    label: 'ZIP',
    hint: 'Original panels, image sequence',
    group: 'Archives',
    icon: 'zip',
  },
  {
    id: 'cbz',
    label: 'CBZ',
    hint: 'Comic Book Archive + ComicInfo',
    group: 'Archives',
    icon: 'cbz',
  },
  {
    id: 'pdf',
    label: 'PDF',
    hint: 'One panel per page',
    group: 'Documents',
    icon: 'pdf',
  },
  {
    id: 'html-package',
    label: 'HTML Package',
    hint: 'Self-contained offline reader',
    group: 'Documents',
    icon: 'html',
  },
  {
    id: 'png-sequence',
    label: 'PNG Sequence',
    hint: 'Lossless re-encode, zipped',
    group: 'Image sequences',
    icon: 'png',
  },
  {
    id: 'jpg-sequence',
    label: 'JPG Sequence',
    hint: 'Optimized JPEG, zipped',
    group: 'Image sequences',
    icon: 'jpg',
  },
  {
    id: 'webp-sequence',
    label: 'WebP Sequence',
    hint: 'Smaller files, zipped',
    group: 'Image sequences',
    icon: 'webp',
    requiresMime: 'image/webp',
  },
  {
    id: 'avif-sequence',
    label: 'AVIF Sequence',
    hint: 'Smallest files, zipped',
    group: 'Image sequences',
    icon: 'avif',
    requiresMime: 'image/avif',
  },
  {
    id: 'json-images',
    label: 'JSON + Images',
    hint: 'Metadata manifest + panels',
    group: 'Data',
    icon: 'json',
  },
]

export interface ExportInput {
  webtoonTitle: string
  episode: Pick<Episode, 'panels' | 'episodeNumber' | 'title'>
}

/** Title/episode metadata used for filenames and embedded manifests. */
export interface ExportMeta {
  webtoonTitle: string
  episodeNumber?: number
  episodeTitle?: string
}

/**
 * Abstracts *where* the panels come from so the same 12 formats work for both
 * the published reader (panels are Storage URLs) and the studio editor (panels
 * are rendered on the fly from the Konva stage).
 */
export interface PanelSource {
  count: number
  /** Load panel `i` as a blob, plus its original codec hint for pass-through formats. */
  load: (i: number) => Promise<{ blob: Blob; mime: string; ext: string }>
}

export interface ExportResult {
  blob: Blob
  filename: string
}

export type ProgressFn = (done: number, total: number, phase: string) => void

/** Pull clean panel URLs, tolerating legacy string-or-object panel shapes. */
export function getEpisodePanelUrls(episode: Pick<Episode, 'panels'>): string[] {
  return (episode.panels ?? [])
    .map((p) =>
      typeof p === 'string'
        ? p
        : (p as { url?: string; imageUrl?: string }).url ??
          (p as { url?: string; imageUrl?: string }).imageUrl ??
          ''
    )
    .filter(Boolean)
}

/** Safe, human-readable base filename like `My-Series-Ep3`. */
export function baseFilename(meta: ExportMeta): string {
  const title = sanitize(meta.webtoonTitle || 'Webtoon')
  const ep = meta.episodeNumber != null ? `Ep${meta.episodeNumber}` : 'Episode'
  return `${title}-${ep}`
}

export function sanitize(name: string): string {
  return (
    name
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'export'
  )
}

/** Zero-padded 1-based index, e.g. 1 -> "001". */
export function pad(index: number, count: number): string {
  const width = Math.max(3, String(count).length)
  return String(index).padStart(width, '0')
}
