import MatchMap from './MatchMap';
import LiveScoreboardPanel from './LiveScoreboardPanel';
import AdvantageGraph from './AdvantageGraph';
import { useMatchPlayback } from '../hooks/useMatchPlayback';

interface PlaybackSectionProps {
  matchData: any;
  allPlayers: any[];
  selectedPlayer: any;
  // Shared clock lifted to MatchOverview so the page-level GlobalPlaybackBar
  // and every other scrub-reactive section (Towers, Builds, Matchup grid)
  // read/drive the exact same currentTime as this map. Falls back to an
  // internal clock when omitted, so this component still works standalone.
  playback?: ReturnType<typeof useMatchPlayback>;
}

/**
 * Embedded playback: the interactive map + a live-updating scoreboard panel
 * sharing one clock (see useMatchPlayback), plus the advantage graph as a
 * scrubber companion. Lives at the bottom of the Overview tab (replaces the
 * old standalone "Playback" tab) and autoplays on mount.
 */
export default function PlaybackSection({ matchData, allPlayers, selectedPlayer, playback: externalPlayback }: PlaybackSectionProps) {
  const ownPlayback = useMatchPlayback();
  const playback = externalPlayback || ownPlayback;

  if (!matchData?.is_parsed) {
    return (
      <div className="glass-surface" style={{ padding: '1.5rem', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
        Playback unlocks once the replay is fully parsed.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem' }}>
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
            hideControls={!!externalPlayback}
            autoPlayOnMount
          />
        </div>
        <div style={{ flex: '3 1 640px', minWidth: '0' }}>
          <LiveScoreboardPanel allPlayers={allPlayers} currentTime={playback.currentTime} />
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '1rem', marginTop: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Net Worth / XP Advantage</h4>
        <AdvantageGraph matchData={matchData} allPlayers={allPlayers} height={260} currentTime={playback.currentTime} />
      </div>
    </div>
  );
}
