/**
 * Tiny module-scope promise cache with TTL.
 *
 * - Dedupes concurrent identical requests (both callers await one promise).
 * - Makes back/forward navigation feel instant: client components remount
 *   on soft navigation and would otherwise refetch identical Firestore data.
 * - Failed promises are evicted so errors are never cached.
 */
const cache = new Map<string, { promise: Promise<unknown>; expires: number }>()

export function cachedRequest<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expires > now) return hit.promise as Promise<T>

  const promise = fetcher().catch((err) => {
    cache.delete(key)
    throw err
  })
  cache.set(key, { promise, expires: now + ttlMs })
  return promise
}

export function invalidateRequest(keyPrefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key)
  }
}
