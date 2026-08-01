// Minimal ZIP writer (STORE / no compression) with no external dependency.
//
// Comic panels are already compressed (PNG/JPEG/WebP/AVIF), so re-deflating them
// wastes CPU for almost no size win — storing them uncompressed is exactly what
// CBZ readers and every unzip tool accept. This keeps archive building fast and
// dependency-free (we deliberately avoid pulling in jszip just for STORE).

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  /** Path inside the archive. Always forward slashes, e.g. `images/001.jpg`. */
  name: string
  data: Uint8Array
}

/**
 * Build a `.zip` Blob from `entries` using the STORE method. `mime` lets callers
 * mint sibling container types that are structurally plain zips — e.g. CBZ
 * (`application/vnd.comicbook+zip`).
 */
export function createZip(entries: ZipEntry[], mime = 'application/zip'): Blob {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  // Fixed DOS timestamp (1980-01-01 00:00) — reproducible archives.
  const DOS_TIME = 0
  const DOS_DATE = 0x0021

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)
    const size = data.length >>> 0

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // local file header signature
    lv.setUint16(4, 20, true) // version needed to extract
    lv.setUint16(6, 0x0800, true) // flags: bit 11 = UTF-8 filename
    lv.setUint16(8, 0, true) // method: 0 = store
    lv.setUint16(10, DOS_TIME, true)
    lv.setUint16(12, DOS_DATE, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true) // compressed size
    lv.setUint32(22, size, true) // uncompressed size
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // extra field length
    local.set(nameBytes, 30)

    parts.push(local, data)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true) // central directory signature
    cv.setUint16(4, 20, true) // version made by
    cv.setUint16(6, 20, true) // version needed
    cv.setUint16(8, 0x0800, true) // flags: UTF-8
    cv.setUint16(10, 0, true) // method: store
    cv.setUint16(12, DOS_TIME, true)
    cv.setUint16(14, DOS_DATE, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true) // extra length
    cv.setUint16(32, 0, true) // comment length
    cv.setUint16(34, 0, true) // disk number start
    cv.setUint16(36, 0, true) // internal attributes
    cv.setUint32(38, 0, true) // external attributes
    cv.setUint32(42, offset, true) // relative offset of local header
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + data.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const centralOffset = offset

  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true) // end of central directory signature
  ev.setUint16(4, 0, true) // disk number
  ev.setUint16(6, 0, true) // central dir start disk
  ev.setUint16(8, entries.length, true) // entries on this disk
  ev.setUint16(10, entries.length, true) // total entries
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, centralOffset, true)
  ev.setUint16(20, 0, true) // comment length

  return new Blob([...parts, ...central, end] as BlobPart[], { type: mime })
}

/** Convenience: UTF-8 encode a string into bytes for a text ZIP entry. */
export function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}
