import { useEffect, useRef, useState } from 'react';
import MatchMap from './MatchMap';
import LiveScoreboardPanel from './LiveScoreboardPanel';
import { useMatchPlayback } from '../hooks/useMatchPlayback';

interface PlaybackSectionProps {
  matchData: any;
  allPlayers: any[];
  selectedPlayer: any;
}

/**
 * Embedded playback: the interactive map + a live-updating scoreboard panel
 * sharing one clock, plus its own transport controls. This clock is
 * deliberately separate from the page-wide one that drives Towers/Builds/
 * Matchup (which defaults to the match's finished state) — this section
 * always starts at 0 and autoplays on its own once scrolled into view,
 * like a video player, independent of wherever the page's own scrubber is.
 */
export default function PlaybackSection({ matchData, allPlayers, selectedPlayer }: PlaybackSectionProps) {
  const playback = useMatchPlayback();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasStartedRef = useRef(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // A plain scroll listener + getBoundingClientRect check, not
    // IntersectionObserver — this section can be considerably taller than
    // the viewport (the map+scoreboard row wraps to two stacked rows at
    // narrower widths), which made a percentage-of-total-height threshold
    // unreliable, and IntersectionObserver callbacks proved inconsistent
    // in testing. A direct rect check on scroll is simpler and dependable.
    const checkVisible = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) setInView(true);
    };
    checkVisible();
    window.addEventListener('scroll', checkVisible, { passive: true });
    window.addEventListener('resize', checkVisible);
    return () => {
      window.removeEventListener('scroll', checkVisible);
      window.removeEventListener('resize', checkVisible);
    };
  }, []);

  useEffect(() => {
    if (inView && !hasStartedRef.current && (matchData?.duration || 0) > 0) {
      hasStartedRef.current = true;
      playback.setIsPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, matchData?.duration]);

  if (!matchData?.is_parsed) {
    return (
      <div className="glass-surface" style={{ padding: '1.5rem', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
        Playback unlocks once the replay is fully parsed.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Match Playback</h3>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px', minWidth: '300px', maxWidth: '420px' }}>
          <MatchMap
            matchData={matchData}
            selectedPlayer={selectedPlayer}
            compact={false}
            controlledTime={playback.currentTime}
            controlledIsPlaying={playback.isPlaying}
            controlledSpeed={playback.playbackSpeed}
            onControlledTimeChange={playback.setCurrentTime}
            onControlledPlayingChange={playback.setIsPlaying}
            onControlledSpeedChange={playback.setPlaybackSpeed}
          />
        </div>
        <div style={{ flex: '3 1 640px', minWidth: '0' }}>
          <LiveScoreboardPanel allPlayers={allPlayers} currentTime={playback.currentTime} />
        </div>
      </div>
    </div>
  );
}
