import { useEffect, useState } from 'react';
import api from '../lib/api';
import { cacheKey, getCached, setCached } from '../lib/apiCache';

/** Fetches on mount, but stale-while-revalidate: if this exact url+params
 * was already fetched anywhere else in the app this session, the cached
 * value is shown *immediately* (loading starts false, no blank/spinner
 * flash) while a fresh request still goes out in the background and
 * replaces it once it resolves -- this is what makes switching back to
 * an already-visited widget/page feel instant instead of re-showing a
 * loading state every single time, while still keeping the data itself
 * live (never permanently stale, never a stale click a user has to
 * force-refresh their way around). See lib/apiCache.ts. */
export function useApiData<T>(url: string, params?: Record<string, unknown>): { data: T | null; loading: boolean; error: boolean } {
  const paramsKey = params ? JSON.stringify(params) : '';
  const key = cacheKey(url, params);
  const cached = getCached<T>(key);
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = cacheKey(url, params);
    const cachedNow = getCached<T>(key);
    if (cachedNow !== undefined) {
      setData(cachedNow);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(false);
    api.get(url, params ? { params } : undefined)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setCached(key, res.data);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  return { data, loading, error };
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
