import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';

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
  const [profile, setProfile] = useState<any>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = () => {
      api.get('/player/profile').then((res) => {
        if (cancelled) return;
        const d = res.data;
        const valid = d && typeof d === 'object' && typeof d.persona_name !== 'undefined';
        if (valid) setProfile(d);

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
