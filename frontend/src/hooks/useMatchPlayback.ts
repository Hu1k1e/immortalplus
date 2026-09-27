import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A shared playback clock for PlaybackSection: plain lifted state that
 * MatchMap drives via its controlledTime/controlledIsPlaying/controlledSpeed
 * + onControlledTimeChange/onControlledPlayingChange/onControlledSpeedChange
 * props when embedded there (MatchMap owns its own requestAnimationFrame
 * loop in that case). When used standalone (e.g. the page-wide Overview
 * clock behind GlobalPlaybackBar, which has no MatchMap ticking it), this
 * hook runs its own identical rAF loop whenever `isPlaying` is true —
 * without it, pressing play only flips the icon and nothing advances.
 *
 * The slider itself always starts at rest showing 0 (`currentTime`, the raw
 * state) — but until the user actually scrubs or presses play, every
 * scrub-reactive section on the page reads `displayTime`, which stays
 * pinned to the match's final result instead. The first real interaction
 * (`setCurrentTime`/`setIsPlaying(true)`) flips `hasScrubbed` and from then
 * on `displayTime` just mirrors the real scrubbed position.
 */
export function useMatchPlayback(initialSpeed = 4, duration = 0) {
  const [currentTime, setCurrentTimeRaw] = useState(0);
  const [hasScrubbed, setHasScrubbed] = useState(false);
  const [isPlaying, setIsPlayingRaw] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSpeed);

  const animRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const setCurrentTime = (t: number) => {
    setHasScrubbed(true);
    setCurrentTimeRaw(t);
  };
  const setIsPlaying = (p: boolean) => {
    if (p) setHasScrubbed(true);
    setIsPlayingRaw(p);
  };

  const tick = useCallback((timestamp: number) => {
    if (!lastTickRef.current) lastTickRef.current = timestamp;
    const elapsed = (timestamp - lastTickRef.current) / 1000;
    lastTickRef.current = timestamp;

    setCurrentTimeRaw((prev) => {
      const next = prev + elapsed * playbackSpeed;
      if (next >= duration) {
        setIsPlayingRaw(false);
        return duration;
      }
      return next;
    });

    animRef.current = requestAnimationFrame(tick);
  }, [playbackSpeed, duration]);

  useEffect(() => {
    if (isPlaying && duration > 0) {
      lastTickRef.current = 0;
      animRef.current = requestAnimationFrame(tick);
    } else if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, duration, tick]);

  const displayTime = hasScrubbed ? currentTime : duration;

  return { currentTime, displayTime, setCurrentTime, isPlaying, setIsPlaying, playbackSpeed, setPlaybackSpeed, hasScrubbed };
}
