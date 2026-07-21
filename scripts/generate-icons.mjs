/**
 * Regenerate every app icon and social image from the single brand source,
 * `src/assets/logomain.png`.
 *
 * Run manually after the logo changes:  npm run icons
 *
 * Deliberately NOT wired into `build` — the project builds on pure Turbopack
 * (see CLAUDE.md) and adding an image pipeline to the build would put a native
 * binary on the critical path of every deploy.
 *
 * ── Geometry notes ────────────────────────────────────────────────────────
 * The source is 668x598 — NOT square (1.117:1). Everything here therefore
 * contain-fits the mark and centres it on a correctly-sized canvas rather than
 * resizing directly, which would distort it.
 *
 * The canvas is flooded opaque with BG (#0F0F0F, matching the manifest's
 * background_color/theme_color) rather than left transparent, because:
 *   - iOS ignores alpha on apple-touch icons and composites on black anyway;
 *   - Android maskable icons must cover the full bleed or the launcher shows
 *     gaps at the crop edges.
 *
 * INSETS: the mark occupies this fraction of the canvas width. The maskable
 * variant is tighter (0.80) because Android crops to a safe zone and anything
 * outside it can be cut. 0.80 is the ubiquitous convention and is safe for the
 * rounded-square/squircle masks launchers actually use; a true circle mask
 * would need ~0.70. Raise the inset if the mark ever looks cropped on Android.
 */
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/assets/logomain.png')

/** Brand surface. Keep in sync with manifest background_color/theme_color. */
const BG = { r: 0x0f, g: 0x0f, b: 0x0f, alpha: 1 }

/**
 * Square icon: contain-fit the mark to `inset` of the canvas, centre it on an
 * opaque BG square, emit PNG.
 */
async function squareIcon(size, inset, outPath) {
  const markSize = Math.round(size * inset)
  const mark = await sharp(SRC)
    .resize(markSize, markSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  return outPath
}

/**
 * Social card: 1200x630 (the aspect every crawler expects). The mark is sized
 * by HEIGHT here, not width — a wide canvas with a width-driven mark would
 * overflow vertically.
 */
async function socialImage(outPath) {
  const W = 1200
  const H = 630
  const markH = 260

  const mark = await sharp(SRC)
    .resize(null, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  return outPath
}

/**
 * favicon.ico — the icon browsers actually paint in the tab, in preference to
 * the <link rel="icon"> PNG. sharp can't write a multi-resolution ICO, so we
 * render the brand mark to square PNG buffers at the classic favicon sizes and
 * let png-to-ico pack them. A tighter inset (0.94) than the app icons because
 * at 16px every pixel of the mark counts.
 */
async function faviconIco(outPath) {
  // 16/32/48 only. png-to-ico stores frames as uncompressed BMP, so a 256px
  // frame balloons the file to ~270KB for a size the tab never renders — the
  // high-DPI/shell cases are served by the PNG icon convention instead.
  const sizes = [16, 32, 48]
  const buffers = await Promise.all(
    sizes.map(async (size) => {
      const markSize = Math.round(size * 0.94)
      const mark = await sharp(SRC)
        .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer()
      return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
        .composite([{ input: mark, gravity: 'center' }])
        .png()
        .toBuffer()
    })
  )
  await writeFile(outPath, await pngToIco(buffers))
  return outPath
}

async function main() {
  await mkdir(join(ROOT, 'public/icons'), { recursive: true })

  const meta = await sharp(SRC).metadata()
  console.log(`source: ${SRC}`)
  console.log(`        ${meta.width}x${meta.height} ${meta.format} (alpha: ${meta.hasAlpha})\n`)

  const outputs = await Promise.all([
    // ── PWA manifest icons ────────────────────────────────────────────────
    // Filename-VERSIONED (.v2). These paths live under next.config.js's
    // immutable 1-year cache header AND public/sw.js's cache-forever branch,
    // so bytes at a given path can never be changed in the field. A new logo
    // means a new version suffix here + in public/manifest.json.
    squareIcon(192, 0.9, join(ROOT, 'public/icons/icon-192.v2.png')),
    squareIcon(512, 0.9, join(ROOT, 'public/icons/icon-512.v2.png')),
    squareIcon(512, 0.8, join(ROOT, 'public/icons/icon-maskable-512.v2.png')),

    // ── App Router file conventions ───────────────────────────────────────
    // Next content-hashes these into the emitted <link>/<meta> tags, so they
    // self-bust on every change. They also sidestep the service worker: its
    // STATIC_PATTERNS matches `/icons/` with a trailing slash, which these
    // root-level paths never match.
    squareIcon(512, 0.9, join(ROOT, 'src/app/icon.png')),
    squareIcon(180, 0.88, join(ROOT, 'src/app/apple-icon.png')),
    socialImage(join(ROOT, 'src/app/opengraph-image.png')),
    socialImage(join(ROOT, 'src/app/twitter-image.png')),

    // The classic tab favicon. Was a generic black-circle/white-triangle
    // placeholder that browsers preferred over the PNG icon above — this is
    // what actually shows in the tab.
    faviconIco(join(ROOT, 'src/app/favicon.ico')),
  ])

  for (const out of outputs) {
    // Read the byte count off disk — sharp's metadata().size is only populated
    // when the input was a Buffer, and reads NaN for a file path.
    const { size } = await stat(out)
    const rel = out.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
    // sharp can't introspect .ico; report it without dimensions.
    if (out.endsWith('.ico')) {
      console.log(`  ${rel.padEnd(42)} 16/32/48 ico ${(size / 1024).toFixed(1)}KB`)
      continue
    }
    const { width, height, format } = await sharp(out).metadata()
    console.log(`  ${rel.padEnd(42)} ${String(width).padStart(4)}x${String(height).padEnd(4)} ${format} ${(size / 1024).toFixed(1)}KB`)
  }

  console.log('\nDone. Remember to bump CACHE_VERSION in public/sw.js if icon paths changed.')
}

main().catch((err) => {
  console.error('[generate-icons] failed:', err)
  process.exit(1)
})
