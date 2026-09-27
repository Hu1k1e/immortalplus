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
 * This clock's bar always sits at rest showing 0 on load, but every
 * scrub-reactive section below (Towers, Advantage graph, Builds, Matchup
 * K/D) reads `displayTime`, which stays pinned to the match's real
 * end-of-game result until the user's first actual scrub or play — at
 * that point `displayTime` just mirrors the real scrubbed position, same
 * as the bar itself. Every scrub-reactive section reads this same
 * currentTime, so scrubbing anywhere updates the whole page at once, and
 * the bar stays reachable while scrolling since it's fixed to the
 * viewport, not a container. This is a SEPARATE clock from
 * PlaybackSection's own — that one always starts at 0 and autoplays once
 * scrolled into view, independent of wherever this one is scrubbed to.
 */
function OverviewBody({ matchData, allPlayers, setSelectedPlayer, playback }: { matchData: any; allPlayers: any[]; setSelectedPlayer: (p: any) => void, playback: any }) {
  const isParsed = !!matchData?.is_parsed;
  const displayTime = isParsed ? playback.displayTime : undefined;

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
        <MatchupGrid allPlayers={allPlayers} onSelectPlayer={setSelectedPlayer} currentTime={displayTime} />
        <TowersLaneRow matchData={matchData} allPlayers={allPlayers} currentTime={displayTime} />
        <DraftBuildsKillsRow matchData={matchData} />
        <BuildsPanel matchData={matchData} allPlayers={allPlayers} currentTime={displayTime} onSelectPlayer={setSelectedPlayer} />
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


