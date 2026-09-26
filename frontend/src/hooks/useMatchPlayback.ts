import { useState } from 'react';

/**
 * A shared playback clock for PlaybackSection: plain lifted state that
 * MatchMap drives via its controlledTime/controlledIsPlaying/controlledSpeed
 * + onControlledTimeChange/onControlledPlayingChange/onControlledSpeedChange
 * props (MatchMap still owns the actual requestAnimationFrame tick loop —
 * this hook just gives a sibling component, LiveScoreboardPanel, the same
 * currentTime to read every frame).
 */
export function useMatchPlayback(initialSpeed = 4, initialTime = 0) {
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSpeed);

  return { currentTime, setCurrentTime, isPlaying, setIsPlaying, playbackSpeed, setPlaybackSpeed };
}
