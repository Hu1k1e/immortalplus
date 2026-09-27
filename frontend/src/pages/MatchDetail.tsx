import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { getRankBadge, getRankLabel } from '../lib/rank';
import { getGameModeLabel, getLobbyTypeLabel, getRegionLabel } from '../lib/matchMeta';

import MatchNavBar from '../components/MatchNavBar';
import MatchOverview from '../components/MatchOverview';
import { IconRadiant, IconDire } from '../components/Icons';
import MovementTab from '../components/MovementTab';
import { BenchmarksTab, PerformancesTab, LaningTab, CombatTab, FarmTab, ItemsTab, CastsTab, ObjectivesTab, VisionTab, ActionsTab, TeamfightsTab, ChatTab, LogTab, StoryTab, GraphsTab } from '../components/MatchTabs';

const MAIN_TABS = ['Overview', 'Benchmarks', 'Performances', 'Laning', 'Movement', 'Combat', 'Farm', 'Items', 'Graphs', 'Casts', 'Objectives', 'Vision', 'Actions', 'Teamfights', 'Chat', 'Story', 'Log'];

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const [matchData, setMatchData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [aiCoaching, setAiCoaching] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeMistakeTab, setActiveMistakeTab] = useState('current');
  const [mainTab, setMainTab] = useState('Overview');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [parseState, setParseState] = useState<'idle' | 'requesting' | 'requested' | 'error'>(
    localStorage.getItem(`parse_requested_${matchId}`) ? 'requested' : 'idle'
  );

  const [refetching, setRefetching] = useState(false);

  const fetchMatchData = async (isPolling = false) => {
    if (!matchId || matchId === 'undefined') return null;
    try {
      const res = await api.get(`/matches/${matchId}`);
      setMatchData(res.data);
      if (res.data.is_parsed) {
        if (parseState !== 'idle') {
          setParseState('idle'); // Clear parsing state once it finishes
        }
        localStorage.removeItem(`parse_requested_${matchId}`);
      }
      if (res.data.is_analyzed) {
        const analysisRes = await api.get(`/matches/${matchId}/analysis`);
        setAnalysis(analysisRes.data);
        if (analysisRes.data.ai_coaching) {
          setAiCoaching(analysisRes.data.ai_coaching);
        }
      }
      return res.data;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  useEffect(() => {
    if (!matchId || matchId === 'undefined') return;

    // Initial load
    fetchMatchData();
  }, [matchId]);

  // Separate effect for polling when parse is in progress
  useEffect(() => {
    if (parseState !== 'requested' && parseState !== 'requesting') return;
    if (!matchId || matchId === 'undefined') return;

    const interval = setInterval(async () => {
      const data = await fetchMatchData(true);
      // fetchMatchData already clears parseState and localStorage when is_parsed=true
      if (data && data.is_parsed) {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [matchId, parseState]);

  const handleRequestParse = async () => {
    if (!matchId || matchId === 'undefined') return;
    setParseState('requesting');
    try {
      await api.post(`/matches/${matchId}/request-parse`);
      setParseState('requested');
      localStorage.setItem(`parse_requested_${matchId}`, 'true');
    } catch (err) {
      setParseState('error');
    }
  };

  const handleRefetch = async () => {
    if (!matchId || matchId === 'undefined') return;
    setRefetching(true);
    setParseState('requesting'); // Reuse the polling logic
    try {
      await api.post(`/matches/${matchId}/refetch`);
      setParseState('requested');
      // Re-load the page data
      await fetchMatchData(true);
    } catch (err) {
      console.error('Failed to refetch:', err);
      setParseState('error');
    } finally {
      setRefetching(false);
    }
  };

  const handleAiAnalysis = async () => {
    setAnalyzingAi(true);
    setAiError('');
    try {
      const res = await api.post(`/matches/${matchId}/coach`);
      setAiCoaching(res.data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.response?.data?.detail || 'Failed to fetch AI coaching. Check your API key in Settings.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading match details...</div>;
  if (!matchData) return <div style={{ padding: '2rem' }}>Match not found.</div>;

  const allPlayers = matchData.all_players || [];

  const radiantKills = allPlayers.filter((p: any) => p.player_slot < 128).reduce((s: number, p: any) => s + (p.kills || 0), 0);
  const direKills = allPlayers.filter((p: any) => p.player_slot >= 128).reduce((s: number, p: any) => s + (p.kills || 0), 0);
  const radiantWon = matchData.radiant_win === true;
  const direWon = matchData.radiant_win === false;
  const durationLabel = `${Math.floor(matchData.duration / 60)}:${(matchData.duration % 60).toString().padStart(2, '0')}`;

  const lobbyLabel = getLobbyTypeLabel(matchData.lobby_type);
  const modeLabel = getGameModeLabel(matchData.game_mode);
  const modeMeta = [lobbyLabel, modeLabel].filter(Boolean).join(' / ') || null;
  const regionLabel = getRegionLabel(allPlayers[0]?.region);
  const rankLabel = getRankLabel(matchData.avg_rank_tier ?? matchData.rank_tier);
  const rankBadge = getRankBadge(matchData.avg_rank_tier ?? matchData.rank_tier);
  const dateLabel = matchData.played_at
    ? new Date(matchData.played_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const goToTab = (tab: string) => { setMainTab(tab); setSelectedPlayer(null); };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <Link to="/matches" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
        &larr; Back to Matches
      </Link>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: matchData.is_parsed ? 'var(--radiant-green)' : 'var(--text-muted)', marginRight: '0.25rem' }}>
          {matchData.is_parsed ? 'Replay Parsed' : 'Basic Data Only'}
        </span>
        {!aiCoaching && (
          <button
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--radiant-green)' }}
            onClick={handleAiAnalysis}
            disabled={analyzingAi}
          >
            {analyzingAi ? 'Analyzing...' : 'Analyze with AI Coach'}
          </button>
        )}
        <button
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          onClick={handleRequestParse}
          disabled={parseState === 'requesting' || parseState === 'requested'}
        >
          {parseState === 'idle' && 'Parse Replay'}
          {parseState === 'requesting' && 'Requesting...'}
          {parseState === 'requested' && '✓ Parse Requested'}
          {parseState === 'error' && '✗ Parse Failed'}
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          onClick={handleRefetch}
          disabled={refetching}
          title="Refetch latest match data from OpenDota/Stratz"
        >
          {refetching ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      <MatchNavBar matchData={matchData} />

      <div className="glass-surface" style={{
        marginBottom: '1.5rem', overflow: 'hidden',
        backgroundImage: 'linear-gradient(90deg, rgba(81,164,69,0.16) 0%, rgba(81,164,69,0.04) 30%, rgba(0,0,0,0) 50%, rgba(194,53,43,0.04) 70%, rgba(194,53,43,0.16) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1 }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '8px', background: 'rgba(81,164,69,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconRadiant style={{ width: '34px', height: '34px' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Radiant</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: radiantWon ? 'var(--radiant-green)' : 'var(--text-muted)' }}>
                {radiantWon ? 'Won' : 'Lost'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
            <div style={{ background: 'rgba(0,0,0,0.35)', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {radiantKills}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '0.9rem' }}>☀️</div>
              <div>{durationLabel}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.35)', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {direKills}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Dire</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: direWon ? 'var(--radiant-green)' : 'var(--text-muted)' }}>
                {direWon ? 'Won' : 'Lost'}
              </div>
            </div>
            <div style={{ width: '52px', height: '52px', borderRadius: '8px', background: 'rgba(194,53,43,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconDire style={{ width: '34px', height: '34px' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 2rem', borderTop: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', flexWrap: 'wrap' }}>
            {modeMeta && <span>{modeMeta}</span>}
            {regionLabel && <span>🌐 {regionLabel}</span>}
            <span>{matchData.match_id}</span>
            {rankLabel && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {rankBadge && <img src={rankBadge} alt={rankLabel} style={{ width: '16px', height: '16px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                {rankLabel}
              </span>
            )}
          </div>
          {dateLabel && <span>{dateLabel}</span>}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="glass-surface" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem 1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => goToTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: mainTab === tab ? 700 : 500,
              background: mainTab === tab ? 'rgba(226,183,66,0.14)' : 'rgba(226,183,66,0.04)',
              color: mainTab === tab ? 'var(--accent-gold)' : 'var(--text-secondary)',
              border: `1px solid ${mainTab === tab ? 'rgba(226,183,66,0.5)' : 'rgba(226,183,66,0.12)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'box-shadow 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 10px rgba(226,183,66,0.45)';
              e.currentTarget.style.borderColor = 'rgba(226,183,66,0.6)';
              if (mainTab !== tab) e.currentTarget.style.color = 'var(--accent-gold)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = mainTab === tab ? 'rgba(226,183,66,0.5)' : 'rgba(226,183,66,0.12)';
              if (mainTab !== tab) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {mainTab === 'Overview' && (
        <MatchOverview
          matchData={matchData}
          allPlayers={allPlayers}
          analysis={analysis}
          aiCoaching={aiCoaching}
          aiError={aiError}
          activeMistakeTab={activeMistakeTab}
          setActiveMistakeTab={setActiveMistakeTab}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
        />
      )}

      {mainTab === 'Benchmarks' && <BenchmarksTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Performances' && <PerformancesTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Laning' && <LaningTab matchData={matchData} allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Movement' && <MovementTab allPlayers={allPlayers} />}
      {mainTab === 'Combat' && <CombatTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Farm' && <FarmTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Items' && <ItemsTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Casts' && <CastsTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Objectives' && <ObjectivesTab allPlayers={allPlayers} />}
      {mainTab === 'Vision' && <VisionTab allPlayers={allPlayers} matchData={matchData} />}
      {mainTab === 'Actions' && <ActionsTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
      {mainTab === 'Teamfights' && <TeamfightsTab teamfights={matchData.teamfights || []} allPlayers={allPlayers} />}
      {mainTab === 'Chat' && <ChatTab chat={matchData.chat || []} allPlayers={allPlayers} />}
      {mainTab === 'Log' && <LogTab allPlayers={allPlayers} matchData={matchData} />}

      {mainTab === 'Graphs' && <GraphsTab matchData={matchData} allPlayers={allPlayers} />}
      {mainTab === 'Story' && <StoryTab matchData={matchData} />}
    </div>
  );
}
