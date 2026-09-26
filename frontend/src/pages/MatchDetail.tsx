import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { ITEMS } from '../lib/items';

import MatchScoreboard from '../components/MatchScoreboard';
import MatchMap from '../components/MatchMap';
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
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const renderHeroPortrait = (p: any) => {
    const hero = HEROES[p.hero_id];
    if (!hero) return null;
    const isSelected = selectedPlayer?.player_slot === p.player_slot;
    return (
      <img
        key={p.player_slot}
        src={getHeroImage(hero.img_name)}
        alt={hero.name}
        onClick={() => setSelectedPlayer(p)}
        style={{ 
          width: '60px', height: '34px', objectFit: 'cover', cursor: 'pointer',
          border: isSelected ? '2px solid var(--accent-gold)' : '2px solid transparent',
          opacity: isSelected || !selectedPlayer ? 1 : 0.5,
          transition: 'all 0.2s'
        }}
        title={hero.name}
      />
    );
  };

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

      {/* Main Tabs Navigation */}
      <div className="glass-surface" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', marginBottom: '2rem', overflowX: 'auto', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>
        {['Overview', 'Benchmarks', 'Performances', 'Laning', 'Combat', 'Farm', 'Items', 'Graphs', 'Casts', 'Objectives', 'Vision', 'Actions', 'Teamfights', 'Chat', 'Story', 'Log', 'Playback'].map((tab) => (
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

      {/* Hero Selector Bar */}
      <div className="glass-surface" style={{ display: 'flex', gap: '1rem', padding: '1rem', marginBottom: '2rem', alignItems: 'center', overflowX: 'auto' }}>
        <button 
          className={`btn ${!selectedPlayer ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setSelectedPlayer(null)}
          style={{ whiteSpace: 'nowrap' }}
        >
          Team View
        </button>
        <div style={{ width: '1px', height: '30px', background: 'var(--border-color)', margin: '0 1rem' }}></div>
        
        <div style={{ display: 'flex', gap: '4px', borderRight: '2px solid var(--radiant-green)', paddingRight: '1rem' }}>
          {radiant.map(renderHeroPortrait)}
        </div>
        
        <div style={{ display: 'flex', gap: '4px', paddingLeft: '1rem', borderLeft: '2px solid var(--dire-red)' }}>
          {dire.map(renderHeroPortrait)}
        </div>
      </div>

      {mainTab === 'Overview' && (
        !selectedPlayer ? (
          <div className="animation-fade-in" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 350px', minWidth: '350px', maxWidth: '500px' }}>
              <MatchMap matchData={matchData} selectedPlayer={null} compact={false} />
            </div>
            <div style={{ flex: '2 1 500px', minWidth: '0' }}>
              <MatchScoreboard allPlayers={allPlayers} radiantWin={matchData.radiant_win} onPlayerClick={setSelectedPlayer} compact={true} />
            </div>
          </div>
        ) : (
          <>
          <div className="animation-fade-in">
            <div className="glass-surface" style={{ padding: '2rem', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
              {/* Hero Detailed Stats */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <img 
                    src={getHeroImage(HEROES[selectedPlayer.hero_id]?.img_name || '')} 
                    alt="Hero"
                    style={{ width: '150px', height: '84px', objectFit: 'cover', borderRadius: '8px', border: '2px solid var(--border-color)' }}
                  />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '2rem' }}>{selectedPlayer.persona || 'Anonymous'}</h2>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>{HEROES[selectedPlayer.hero_id]?.name}</div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 className="gold-text-gradient">Performance</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">K / D / A</span>
                    <strong>{selectedPlayer.kills} / {selectedPlayer.deaths} / {selectedPlayer.assists}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">Level</span>
                    <strong>{selectedPlayer.level}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">Net Worth</span>
                    <strong style={{ color: 'var(--accent-gold)' }}>{selectedPlayer.net_worth}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">GPM / XPM</span>
                    <strong>{selectedPlayer.gpm} / {selectedPlayer.xpm}</strong>
                  </div>
                </div>
                <div>
                  <h3 className="gold-text-gradient">Combat</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">Hero Damage</span>
                    <strong>{selectedPlayer.hero_damage}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">Tower Damage</span>
                    <strong>{selectedPlayer.tower_damage}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">Hero Healing</span>
                    <strong style={{ color: 'var(--radiant-green)' }}>{selectedPlayer.hero_healing || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-secondary">Wards (Obs/Sen)</span>
                    <strong>{selectedPlayer.obs_placed || 0} / {selectedPlayer.sen_placed || 0}</strong>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Hero Items Panel */}
            <div className="glass-surface" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(0,0,0,0.4)' }}>
              <h3 className="gold-text-gradient" style={{ margin: 0 }}>Inventory Build</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', width: 'fit-content' }}>
                {selectedPlayer.items?.map((item: any, i: number) => {
                  const itemName = typeof item === 'number' || !isNaN(Number(item)) 
                    ? ITEMS[Number(item)] || String(item).replace('item_', '')
                    : String(item).replace('item_', '');
                  
                  return (
                    <div key={`inv-${i}`} style={{ width: '60px', height: '44px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      {itemName && itemName !== 'empty' && itemName !== 'null' && (
                        <img src={getItemImage(itemName)} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div>
                  <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Backpack</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {selectedPlayer.backpack?.map((item: any, i: number) => {
                      const itemName = typeof item === 'number' || !isNaN(Number(item)) 
                        ? ITEMS[Number(item)] || String(item).replace('item_', '')
                        : String(item).replace('item_', '');
                      return (
                        <div key={`bp-${i}`} style={{ width: '45px', height: '33px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', opacity: 0.7 }}>
                          {itemName && itemName !== 'empty' && itemName !== 'null' && (
                            <img src={getItemImage(itemName)} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Neutral</div>
                  <div style={{ width: '45px', height: '45px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-gold)' }}>
                    {selectedPlayer.neutral_item && selectedPlayer.neutral_item !== 'empty' && (
                      <img 
                        src={getItemImage(
                          (typeof selectedPlayer.neutral_item === 'number' || !isNaN(Number(selectedPlayer.neutral_item)))
                            ? ITEMS[Number(selectedPlayer.neutral_item)] || String(selectedPlayer.neutral_item).replace('item_', '')
                            : String(selectedPlayer.neutral_item).replace('item_', '')
                        )} 
                        alt="Neutral" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                    )}
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                <MatchMap matchData={matchData} selectedPlayer={selectedPlayer} />
              </div>
            </div>
            </div>
          </div>
          
          {/* AI Coach and Analysis for the selected player (only available for main player currently) */}
          {(!selectedPlayer || selectedPlayer.player_slot === matchData.player_slot) && (
            <div style={{ marginTop: '3rem' }}>
              {aiError && (
                <div style={{ padding: '1rem', background: 'rgba(255, 60, 60, 0.1)', border: '1px solid var(--dire-red)', borderRadius: '8px', color: 'var(--dire-red)', marginBottom: '2rem' }}>
                  {aiError}
                </div>
              )}

              {analysis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div className="glass-surface" style={{ padding: '1.5rem' }}>
                    <h3>Laning Score</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.laning_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
                      {analysis.laning_score}
                    </div>
                    <p className="text-secondary">CS at 10m: {analysis.cs_at_10}</p>
                  </div>
                  <div className="glass-surface" style={{ padding: '1.5rem' }}>
                    <h3>Farming Score</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.farming_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
                      {analysis.farming_score}
                    </div>
                  </div>
                  <div className="glass-surface" style={{ padding: '1.5rem' }}>
                    <h3>Fighting Score</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.fighting_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
                      {analysis.fighting_score}
                    </div>
                  </div>
                  <div className="glass-surface" style={{ padding: '1.5rem' }}>
                    <h3>Vision Score</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.vision_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
                      {analysis.vision_score}
                    </div>
                  </div>
                </div>
              )}

              {aiCoaching && (
                <div className="glass-surface" style={{ padding: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
                  <h3 style={{ marginBottom: '1rem' }}>AI Coach Feedback</h3>
                  <p style={{ fontSize: '1.1rem', marginBottom: '2rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    "{aiCoaching.overall_summary}"
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                    <div>
                      <h4 style={{ marginBottom: '1rem' }}>Mistakes Identified</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <button 
                          className={`btn ${activeMistakeTab === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveMistakeTab('current')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Your Rank
                        </button>
                        <button 
                          className={`btn ${activeMistakeTab === 'target' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveMistakeTab('target')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Target Rank
                        </button>
                        <button 
                          className={`btn ${activeMistakeTab === 'pro' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveMistakeTab('pro')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Pro Level
                        </button>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          {activeMistakeTab === 'current' && aiCoaching.mistakes_current_rank?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                          {activeMistakeTab === 'target' && aiCoaching.mistakes_target_rank?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                          {activeMistakeTab === 'pro' && aiCoaching.mistakes_pro_level?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ marginBottom: '1rem' }}>Action Items</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {aiCoaching.action_items?.map((item: any, i: number) => (
                          <div key={i} className="card-interactive" style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: `4px solid ${item.priority === 1 ? 'var(--dire-red)' : item.priority === 2 ? 'var(--accent-gold)' : 'var(--radiant-green)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ textTransform: 'capitalize', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{item.category}</span>
                              <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>{item.difficulty}</span>
                            </div>
                            <p>{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
        )
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

      {mainTab === 'Playback' && (
        <div className="animation-fade-in" style={{ padding: '1rem 0' }}>
          <h2 className="gold-text-gradient" style={{ marginBottom: '2rem' }}>Interactive Match Playback</h2>
          <MatchMap matchData={matchData} selectedPlayer={selectedPlayer} />
        </div>
      )}


    </div>
  );
}
