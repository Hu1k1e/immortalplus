import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';

import MatchNavBar from '../components/MatchNavBar';
import MatchOverview from '../components/MatchOverview';
import { BenchmarksTab, PerformancesTab, LaningTab, CombatTab, FarmTab, ItemsTab, CastsTab, ObjectivesTab, VisionTab, ActionsTab, TeamfightsTab, ChatTab, LogTab, StoryTab, GraphsTab } from '../components/MatchTabs';

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

  const userHero = HEROES[matchData.hero_id];
  const isWin = matchData.result === 'win';

  const allPlayers = matchData.all_players || [];

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/matches" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
            &larr; Back to Matches
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {userHero && (
              <img
                src={getHeroImage(userHero.img_name)}
                alt={userHero.name}
                style={{ width: '80px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
              />
            )}
            <h1 style={{ color: isWin ? 'var(--radiant-green)' : 'var(--dire-red)', margin: 0 }}>
              {isWin ? 'Victory' : 'Defeat'}
            </h1>
          </div>
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>
            {matchData.kills} / {matchData.deaths} / {matchData.assists} • {Math.floor(matchData.duration / 60)}:{(matchData.duration % 60).toString().padStart(2, '0')}
            <span style={{ marginLeft: '1rem', color: matchData.is_parsed ? 'var(--radiant-green)' : 'var(--text-muted)' }}>
              {matchData.is_parsed ? '✓ Replay Parsed' : '⚠️ Basic Data Only (Parse to unlock maps & timelines)'}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
      </header>

      <MatchNavBar matchData={matchData} />

      {/* Main Tabs Navigation */}
      <div className="glass-surface" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', marginBottom: '2rem', overflowX: 'auto', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>
        {['Overview', 'Benchmarks', 'Performances', 'Laning', 'Combat', 'Farm', 'Items', 'Graphs', 'Casts', 'Objectives', 'Vision', 'Actions', 'Teamfights', 'Chat', 'Story', 'Log'].map((tab) => (
          <button
            key={tab}
            className={`btn ${mainTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMainTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              background: mainTab === tab ? 'var(--bg-secondary)' : 'transparent',
              color: mainTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: mainTab === tab ? '2px solid var(--accent-gold)' : '2px solid transparent',
              borderRadius: '0'
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
      {mainTab === 'Laning' && <LaningTab allPlayers={allPlayers} radiantWin={matchData.radiant_win} />}
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
