/**
 * A tiny in-memory, stale-while-revalidate cache shared by every
 * `useApiData` call (see widgets/hooks.ts). Plain module-level `Map`, not
 * sessionStorage/localStorage -- it only needs to survive component
 * remounts within the same page session (switching widgets in/out of
 * view, navigating away and back), not across a hard reload, and an
 * unbounded browser-storage cache would be the wrong tradeoff for data
 * that's supposed to go stale and get replaced by a fresh fetch anyway.
 * No TTL/expiry: every consumer of this cache still kicks off a real
 * fetch on mount and overwrites the entry once it resolves -- the cache
 * only ever changes *when* the UI shows data (instantly, from the last
 * known value, instead of a blank/loading flash), never *whether* it
 * refetches.
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function cacheKey(url: string, params?: Record<string, unknown>): string {
  return params ? `${url}?${JSON.stringify(params)}` : url;
}

export function getCached<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function setCached(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}
