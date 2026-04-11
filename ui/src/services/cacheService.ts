// Shared TTL cache with in-flight request deduplication.
//
// All timing-sensitive service functions should use cached() instead of
// implementing their own caching. TTLs are derived from the measurementIntervals
// endpoint (via intervalService.ts), not hardcoded.
//
// Invalidation hooks (invalidate / invalidatePrefix) are designed for a future
// push channel (WebSocket/SSE listening to reloadDaemonConfigSuccessful events).

const _cache = new Map<string, { value: unknown; expires: number }>()
const _inflight = new Map<string, Promise<unknown>>()

/**
 * Fetch with TTL caching and in-flight deduplication.
 *
 * @param key   Unique cache key (e.g. 'enlinkd:42', 'snmpIfaces:7')
 * @param ttl   Time-to-live in milliseconds. Use Infinity for session-level cache.
 * @param fn    The fetch function to call on cache miss.
 */
export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = _cache.get(key)
  if (hit && hit.expires > now) return hit.value as T

  // In-flight deduplication: if another caller is already fetching this key,
  // return the same Promise instead of firing a duplicate request.
  const pending = _inflight.get(key)
  if (pending) return pending as Promise<T>

  const promise = fn().then(value => {
    _cache.set(key, { value, expires: now + ttl })
    return value
  }).finally(() => {
    _inflight.delete(key)
  })

  _inflight.set(key, promise)
  return promise
}

/** Remove a single cache entry. Next cached() call for this key will re-fetch. */
export function invalidate(key: string): void {
  _cache.delete(key)
}

/** Remove all cache entries whose key starts with `prefix`. */
export function invalidatePrefix(prefix: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

/** Reset all state — for tests only. */
export function _resetForTesting(): void {
  _cache.clear()
  _inflight.clear()
}
