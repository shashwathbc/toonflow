// Firestore timestamps reach the client in several shapes depending on the read
// path: a server Timestamp ({ seconds, nanoseconds }), a JS Date, an epoch
// number, or an ISO string. These helpers centralise the conversion + sort
// comparisons so individual call sites stop re-implementing them.

/** Best-effort epoch SECONDS for any timestamp-ish value; 0 when unknown. */
export function tsToSeconds(ts: unknown): number {
  if (!ts) return 0
  if (typeof ts === 'object') {
    if ('seconds' in ts) return (ts as { seconds: number }).seconds
    if (ts instanceof Date) return Math.floor(ts.getTime() / 1000)
  }
  if (typeof ts === 'number') return Math.floor(ts / 1000)
  if (typeof ts === 'string') return Math.floor(new Date(ts).getTime() / 1000)
  return 0
}

/** Array comparator that sorts NEWEST first (descending) by timestamp. */
export function compareTimestampsDesc(a: unknown, b: unknown): number {
  return tsToSeconds(b) - tsToSeconds(a)
}

/** Array comparator that sorts OLDEST first (ascending) by timestamp. */
export function compareTimestampsAsc(a: unknown, b: unknown): number {
  return tsToSeconds(a) - tsToSeconds(b)
}
