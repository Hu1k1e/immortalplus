import { useState } from 'react';

/**
 * A shared playback clock for PlaybackSection: plain lifted state that
 * MatchMap drives via its controlledTime/controlledIsPlaying/controlledSpeed
 * + onControlledTimeChange/onControlledPlayingChange/onControlledSpeedChange
 * props (MatchMap still owns the actual requestAnimationFrame tick loop —
 * this hook just gives a sibling component, LiveScoreboardPanel, the same
 * currentTime to read every frame).
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

  const setCurrentTime = (t: number) => {
    setHasScrubbed(true);
    setCurrentTimeRaw(t);
  };
  const setIsPlaying = (p: boolean) => {
    if (p) setHasScrubbed(true);
    setIsPlayingRaw(p);
  };

  const displayTime = hasScrubbed ? currentTime : duration;

  return { currentTime, displayTime, setCurrentTime, isPlaying, setIsPlaying, playbackSpeed, setPlaybackSpeed, hasScrubbed };
}
