import MatchupGrid from './MatchupGrid';
import TowersLaneRow from './TowersLaneRow';
import DraftBuildsKillsRow, { KillBreakdownTable } from './DraftBuildsKillsRow';
import BuildsPanel from './BuildsPanel';
import PlaybackSection from './PlaybackSection';
import GlobalPlaybackBar from './GlobalPlaybackBar';
import PlayerDetail from './PlayerDetail';
interface MatchOverviewProps {
  matchData: any;
  allPlayers: any[];
  analysis: any;
  aiCoaching: any;
  aiError: string;
  activeMistakeTab: string;
  setActiveMistakeTab: (tab: string) => void;
  selectedPlayer: any;
  setSelectedPlayer: (p: any) => void;
  playback: any;
}

export default function MatchOverview({
  matchData, allPlayers, analysis, aiCoaching, aiError,
  activeMistakeTab, setActiveMistakeTab, selectedPlayer, setSelectedPlayer, playback,
}: MatchOverviewProps) {
  if (selectedPlayer) {
    return (
      <PlayerDetail
        matchData={matchData}
        allPlayers={allPlayers}
        selectedPlayer={selectedPlayer}
        setSelectedPlayer={setSelectedPlayer}
        analysis={analysis}
        aiCoaching={aiCoaching}
        aiError={aiError}
        activeMistakeTab={activeMistakeTab}
        setActiveMistakeTab={setActiveMistakeTab}
      />
    );
  }

  return <OverviewBody matchData={matchData} allPlayers={allPlayers} setSelectedPlayer={setSelectedPlayer} playback={playback} />;
}

/**
 * Split out so the shared playback clock (useMatchPlayback) is only ever
 * instantiated while actually viewing the grid — PlayerDetailView returns
 * early above this point and has its own map instance untouched by it.
 * This clock defaults to the match's final state (currentTime = duration),
 * so the page shows the real end-of-game result on load, not an all-zero
 * start — scrubbing or pressing play on the GlobalPlaybackBar is what
 * moves it. Every scrub-reactive section below (Towers, Advantage graph,
 * Builds, Matchup K/D) reads this same currentTime, so scrubbing anywhere
 * updates the whole page at once, and the bar stays reachable while
 * scrolling since it's fixed to the viewport, not a container. This is a
 * SEPARATE clock from PlaybackSection's own — that one always starts at 0
 * and autoplays once scrolled into view, independent of wherever this one
 * is scrubbed to.
 */
function OverviewBody({ matchData, allPlayers, setSelectedPlayer, playback }: { matchData: any; allPlayers: any[]; setSelectedPlayer: (p: any) => void, playback: any }) {
  const isParsed = !!matchData?.is_parsed;

  return (
    <>
      {/* NOT inside .animate-fade-in on purpose — that class's keyframes set
          a `transform`, which makes its element a new containing block for
          any position:fixed descendant (a CSS quirk: transform/filter/
          perspective on an ancestor traps fixed children inside it instead
          of the viewport). GlobalPlaybackBar has to be a sibling, not a
          child, to actually stay fixed to the viewport bottom while
          scrolling. */}
      <div className="animate-fade-in" style={{ paddingBottom: isParsed ? '76px' : 0 }}>
        <MatchupGrid allPlayers={allPlayers} onSelectPlayer={setSelectedPlayer} currentTime={isParsed ? playback.currentTime : undefined} />
        <TowersLaneRow matchData={matchData} allPlayers={allPlayers} currentTime={isParsed ? playback.currentTime : undefined} />
        <DraftBuildsKillsRow matchData={matchData} />
        <BuildsPanel matchData={matchData} allPlayers={allPlayers} currentTime={isParsed ? playback.currentTime : undefined} onSelectPlayer={setSelectedPlayer} />
        <div style={{ marginTop: '1.5rem' }}>
          <KillBreakdownTable allPlayers={allPlayers} />
        </div>
        <PlaybackSection matchData={matchData} allPlayers={allPlayers} selectedPlayer={null} />
      </div>
      {isParsed && (
        <GlobalPlaybackBar
          duration={matchData?.duration || 0}
          currentTime={playback.currentTime}
          isPlaying={playback.isPlaying}
          playbackSpeed={playback.playbackSpeed}
          setCurrentTime={playback.setCurrentTime}
          setIsPlaying={playback.setIsPlaying}
          setPlaybackSpeed={playback.setPlaybackSpeed}
        />
      )}
    </>
  );
}


