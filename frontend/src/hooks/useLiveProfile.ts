import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { getCached, setCached } from '../lib/apiCache';

const PROFILE_CACHE_KEY = '/player/profile';

const POLL_MS = 5000;
const MAX_ATTEMPTS = 12; // ~60s — covers the backend's startup identity
// resolution (see backend/main.py's refresh_player_identity_once, which
// runs ~12s after boot) landing after this page/component has already
// mounted and fetched the placeholder, without polling forever once a
// real name has been found.

/**
 * Live-updating player profile — polls until a real persona_name shows up
 * (not just the empty placeholder from a not-yet-resolved account), so the
 * header/profile button picks up a name/avatar that resolves after page
 * load (e.g. right after a redeploy, before the backend's startup identity
 * task has finished) without the user needing to reload the page.
 */
export function useLiveProfile() {
  // Seeded from the shared cache so a widget/page remount (e.g.
  // navigating away and back) shows the last-known profile instantly
  // instead of "Loading…" again while this still polls for a fresher one.
  const [profile, setProfile] = useState<any>(() => getCached(PROFILE_CACHE_KEY) ?? null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = () => {
      api.get('/player/profile').then((res) => {
        if (cancelled) return;
        const d = res.data;
        const valid = d && typeof d === 'object' && typeof d.persona_name !== 'undefined';
        if (valid) { setProfile(d); setCached(PROFILE_CACHE_KEY, d); }

        attemptsRef.current += 1;
        const hasRealName = valid && !!d.persona_name;
        if (!hasRealName && attemptsRef.current < MAX_ATTEMPTS) {
          timer = setTimeout(fetchOnce, POLL_MS);
        }
      }).catch(() => {
        if (cancelled) return;
        attemptsRef.current += 1;
        if (attemptsRef.current < MAX_ATTEMPTS) {
          timer = setTimeout(fetchOnce, POLL_MS);
        }
      });
    };

    fetchOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return profile;
}
