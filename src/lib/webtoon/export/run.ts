import {
  EXPORT_FORMATS,
  baseFilename,
  getEpisodePanelUrls,
  pad,
  sanitize,
  type ExportInput,
  type ExportMeta,
  type ExportResult,
  type PanelSource,
  type ProgressFn,
} from './formats'
import { createZip, textBytes, type ZipEntry } from './zip'
import { decodePanel, encodePanel, extFromMime, fetchPanel, sliceVertical } from './imageOps'

const blobBytes = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer())

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build a URL-backed panel source (the published reader). */
export function urlPanelSource(urls: string[]): PanelSource {
  return {
    count: urls.length,
    load: async (i) => {
      const { blob, mime, ext } = await fetchPanel(urls[i])
      return { blob, mime, ext }
    },
  }
}

/** Re-encode every panel to one codec and return them as zip entries. */
async function reencodedEntries(
  source: PanelSource,
  opts: { mime: string; ext: string; maxWidth?: number; quality?: number; folder?: string },
  onProgress: ProgressFn | undefined,
  phase: string
): Promise<ZipEntry[]> {
  const folder = opts.folder ?? ''
  const entries: ZipEntry[] = []
  for (let i = 0; i < source.count; i++) {
    const { blob } = await source.load(i)
    const dec = await decodePanel(blob)
    try {
      const encoded = await encodePanel(dec, { mime: opts.mime, maxWidth: opts.maxWidth, quality: opts.quality })
      entries.push({ name: `${folder}${pad(i + 1, source.count)}.${opts.ext}`, data: await blobBytes(encoded) })
    } finally {
      dec.close()
    }
    onProgress?.(i + 1, source.count, phase)
  }
  return entries
}

/** Pull panels untouched and return them as zip entries (keeps original codec). */
async function rawEntries(
  source: PanelSource,
  folder: string,
  onProgress: ProgressFn | undefined,
  phase: string
): Promise<{ entries: ZipEntry[]; files: { name: string; ext: string; bytes: number }[] }> {
  const entries: ZipEntry[] = []
  const files: { name: string; ext: string; bytes: number }[] = []
  for (let i = 0; i < source.count; i++) {
    const { blob, ext } = await source.load(i)
    const bytes = await blobBytes(blob)
    const leaf = `${pad(i + 1, source.count)}.${ext}`
    entries.push({ name: `${folder}${leaf}`, data: bytes })
    files.push({ name: leaf, ext, bytes: bytes.length })
    onProgress?.(i + 1, source.count, phase)
  }
  return { entries, files }
}

async function buildPdf(source: PanelSource, onProgress?: ProgressFn): Promise<Blob> {
  const { default: JsPDF } = await import('jspdf')
  const MAX_WIDTH = 1200
  const MAX_PAGE_PT = 14000 // PDF hard limit is 14400pt per dimension
  let doc: InstanceType<typeof JsPDF> | null = null

  for (let i = 0; i < source.count; i++) {
    const { blob } = await source.load(i)
    const dec = await decodePanel(blob)
    let dataUrl: string
    let w: number
    let h: number
    try {
      const scale = Math.min(1, MAX_WIDTH / dec.width)
      w = Math.max(1, Math.round(dec.width * scale))
      h = Math.max(1, Math.round(dec.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(dec.source, 0, 0, w, h)
      dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    } finally {
      dec.close()
    }

    // px -> pt at 96dpi, clamped so no page exceeds the format limit.
    let pw = w * 0.75
    let ph = h * 0.75
    const over = Math.max(pw / MAX_PAGE_PT, ph / MAX_PAGE_PT, 1)
    pw /= over
    ph /= over
    const orientation = ph >= pw ? 'portrait' : 'landscape'

    if (!doc) doc = new JsPDF({ orientation, unit: 'pt', format: [pw, ph] })
    else doc.addPage([pw, ph], orientation)
    doc.addImage(dataUrl, 'JPEG', 0, 0, pw, ph, undefined, 'FAST')

    onProgress?.(i + 1, source.count, 'Building PDF')
  }

  if (!doc) throw new Error('Nothing to export.')
  return doc.output('blob')
}

function buildReaderHtml(meta: ExportMeta, imageNames: string[]): string {
  const epLabel = meta.episodeNumber != null ? `Episode ${meta.episodeNumber}` : 'Episode'
  const title = `${meta.webtoonTitle} — ${epLabel}${meta.episodeTitle ? `: ${meta.episodeTitle}` : ''}`
  const imgs = imageNames
    .map((n, i) => `      <img src="images/${n}" alt="Panel ${i + 1}" loading="lazy" />`)
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${xmlEscape(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d0d0f; color: #e7e7ea; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    header { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); background: rgba(13,13,15,.85);
             border-bottom: 1px solid #26262b; padding: 12px 16px; text-align: center; font-size: 14px; font-weight: 600; }
    header small { display: block; font-weight: 400; color: #9a9aa2; margin-top: 2px; }
    main { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; }
    img { width: 100%; height: auto; display: block; }
    footer { text-align: center; color: #6f6f78; font-size: 12px; padding: 32px 16px; }
  </style>
</head>
<body>
  <header>
    ${xmlEscape(meta.webtoonTitle)}
    <small>${epLabel}${meta.episodeTitle ? ` · ${xmlEscape(meta.episodeTitle)}` : ''}</small>
  </header>
  <main>
${imgs}
  </main>
  <footer>Exported from Toonflow Studio Paint</footer>
</body>
</html>
`
}

/**
 * Run one export format against a panel source and return a downloadable blob +
 * filename. All work happens in the browser; `onProgress(done, total, phase)`
 * fires per panel so the UI can show a live percentage.
 */
export async function runExportFromSource(
  formatId: string,
  source: PanelSource,
  meta: ExportMeta,
  onProgress?: ProgressFn
): Promise<ExportResult> {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId)
  if (!format) throw new Error('Unknown export format.')
  if (source.count === 0) throw new Error('There are no panels to download.')

  const base = baseFilename(meta)
  const loaders = Array.from({ length: source.count }, (_, i) => async () => (await source.load(i)).blob)

  switch (formatId) {
    case 'webtoon-vertical':
    case 'tapas-vertical': {
      const isWebtoon = formatId === 'webtoon-vertical'
      const slices = await sliceVertical(
        loaders,
        {
          width: isWebtoon ? 800 : 940,
          maxHeight: isWebtoon ? 1280 : 3000,
          mime: 'image/jpeg',
          quality: 0.92,
        },
        (fetched, total) => onProgress?.(fetched, total, 'Rendering slices')
      )
      const entries: ZipEntry[] = []
      for (let i = 0; i < slices.length; i++) {
        entries.push({ name: `${pad(i + 1, slices.length)}.jpg`, data: await blobBytes(slices[i]) })
      }
      return { blob: createZip(entries), filename: `${base}-${isWebtoon ? 'WEBTOON' : 'Tapas'}.zip` }
    }

    case 'mangadex-pages': {
      const entries = await reencodedEntries(
        source,
        { mime: 'image/png', ext: 'png', maxWidth: 1500 },
        onProgress,
        'Rendering pages'
      )
      return { blob: createZip(entries), filename: `${base}-MangaDex.zip` }
    }

    case 'zip-sequence': {
      const { entries } = await rawEntries(source, '', onProgress, 'Fetching panels')
      return { blob: createZip(entries), filename: `${base}.zip` }
    }

    case 'cbz': {
      const { entries } = await rawEntries(source, '', onProgress, 'Fetching panels')
      const comicInfo = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Title>${xmlEscape(meta.episodeTitle || `Episode ${meta.episodeNumber ?? ''}`)}</Title>
  <Series>${xmlEscape(meta.webtoonTitle)}</Series>
  <Number>${meta.episodeNumber ?? ''}</Number>
  <PageCount>${source.count}</PageCount>
  <Manga>No</Manga>
</ComicInfo>
`
      entries.push({ name: 'ComicInfo.xml', data: textBytes(comicInfo) })
      return { blob: createZip(entries, 'application/vnd.comicbook+zip'), filename: `${base}.cbz` }
    }

    case 'pdf': {
      const blob = await buildPdf(source, onProgress)
      return { blob, filename: `${base}.pdf` }
    }

    case 'png-sequence': {
      const entries = await reencodedEntries(source, { mime: 'image/png', ext: 'png' }, onProgress, 'Encoding PNG')
      return { blob: createZip(entries), filename: `${base}-PNG.zip` }
    }

    case 'jpg-sequence': {
      const entries = await reencodedEntries(
        source,
        { mime: 'image/jpeg', ext: 'jpg', quality: 0.9 },
        onProgress,
        'Encoding JPG'
      )
      return { blob: createZip(entries), filename: `${base}-JPG.zip` }
    }

    case 'webp-sequence': {
      const entries = await reencodedEntries(
        source,
        { mime: 'image/webp', ext: 'webp', quality: 0.9 },
        onProgress,
        'Encoding WebP'
      )
      return { blob: createZip(entries), filename: `${base}-WebP.zip` }
    }

    case 'avif-sequence': {
      const entries = await reencodedEntries(
        source,
        { mime: 'image/avif', ext: 'avif', quality: 0.6 },
        onProgress,
        'Encoding AVIF'
      )
      return { blob: createZip(entries), filename: `${base}-AVIF.zip` }
    }

    case 'html-package': {
      const entries = await reencodedEntries(
        source,
        { mime: 'image/jpeg', ext: 'jpg', maxWidth: 1200, quality: 0.9, folder: 'images/' },
        onProgress,
        'Packaging'
      )
      const imageNames = entries.map((e) => e.name.replace(/^images\//, ''))
      entries.push({ name: 'index.html', data: textBytes(buildReaderHtml(meta, imageNames)) })
      return { blob: createZip(entries), filename: `${base}-HTML.zip` }
    }

    case 'json-images': {
      const { entries, files } = await rawEntries(source, 'images/', onProgress, 'Fetching panels')
      const manifest = {
        generator: 'Toonflow Studio Paint',
        exportedAt: new Date().toISOString(),
        webtoon: meta.webtoonTitle,
        episodeNumber: meta.episodeNumber,
        episodeTitle: meta.episodeTitle,
        panelCount: files.length,
        panels: files.map((f) => ({ file: `images/${f.name}`, format: f.ext, bytes: f.bytes })),
      }
      entries.push({ name: 'metadata.json', data: textBytes(JSON.stringify(manifest, null, 2)) })
      return { blob: createZip(entries), filename: `${sanitize(base)}-data.zip` }
    }

    default:
      throw new Error('Unsupported export format.')
  }
}

/** Reader convenience wrapper: export a published episode from its panel URLs. */
export async function runExport(
  formatId: string,
  input: ExportInput,
  onProgress?: ProgressFn
): Promise<ExportResult> {
  const urls = getEpisodePanelUrls(input.episode)
  if (urls.length === 0) throw new Error('This episode has no panels to download.')
  const meta: ExportMeta = {
    webtoonTitle: input.webtoonTitle,
    episodeNumber: input.episode.episodeNumber,
    episodeTitle: input.episode.title,
  }
  return runExportFromSource(formatId, urlPanelSource(urls), meta, onProgress)
}

/** Trigger a browser download for an export result. */
export function downloadResult(result: ExportResult) {
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Keep the extension helper reachable for editor sources that render blobs.
export { extFromMime }
