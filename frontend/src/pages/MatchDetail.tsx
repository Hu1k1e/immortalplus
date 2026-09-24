import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { HEROES, getHeroImgUrl } from '../lib/heroes';
import { ITEMS } from '../lib/items';
import MatchTimeline from '../components/MatchTimeline';
import MatchScoreboard from '../components/MatchScoreboard';

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const [matchData, setMatchData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [aiCoaching, setAiCoaching] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeTab, setActiveTab] = useState('current');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  useEffect(() => {
    fetchMatchData();
  }, [matchId]);

  const fetchMatchData = async () => {
    try {
      const res = await api.get(`/matches/${matchId}`);
      setMatchData(res.data);
      if (res.data.is_analyzed) {
        const analysisRes = await api.get(`/matches/${matchId}/analysis`);
        setAnalysis(analysisRes.data);
        if (analysisRes.data.ai_coaching) {
          setAiCoaching(analysisRes.data.ai_coaching);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
        src={getHeroImgUrl(hero.img_name)}
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
                src={getHeroImgUrl(userHero.img_name)} 
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
          </p>
        </div>
      </header>

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

      {!selectedPlayer ? (
        <>
          <MatchTimeline matchData={matchData} aiCoaching={aiCoaching} />
          <MatchScoreboard allPlayers={allPlayers} radiantWin={matchData.radiant_win} />
        </>
      ) : (
        <div className="animation-fade-in">
          <div className="glass-surface" style={{ padding: '2rem', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
            {/* Hero Detailed Stats */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <img 
                  src={getHeroImgUrl(HEROES[selectedPlayer.hero_id]?.img_name || '')} 
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
                        <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
                            <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
                        src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${
                          (typeof selectedPlayer.neutral_item === 'number' || !isNaN(Number(selectedPlayer.neutral_item)))
                            ? ITEMS[Number(selectedPlayer.neutral_item)] || String(selectedPlayer.neutral_item).replace('item_', '')
                            : String(selectedPlayer.neutral_item).replace('item_', '')
                        }.png`} 
                        alt="Neutral" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User's Hero specific data (Analysis and AI Coach) */}
          {selectedPlayer.player_slot === matchData.player_slot && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="gold-text-gradient" style={{ margin: 0 }}>Your Analysis</h2>
                {!aiCoaching && (
                  <button 
                    className="btn btn-primary" 
                    onClick={handleAiAnalysis}
                    disabled={analyzingAi}
                  >
                    {analyzingAi ? 'AI is analyzing...' : 'Analyze with AI Coach'}
                  </button>
                )}
              </div>

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
                          className={`btn ${activeTab === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveTab('current')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Your Rank
                        </button>
                        <button 
                          className={`btn ${activeTab === 'target' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveTab('target')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Target Rank
                        </button>
                        <button 
                          className={`btn ${activeTab === 'pro' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveTab('pro')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Pro Level
                        </button>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          {activeTab === 'current' && aiCoaching.mistakes_current_rank?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                          {activeTab === 'target' && aiCoaching.mistakes_target_rank?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                          {activeTab === 'pro' && aiCoaching.mistakes_pro_level?.map((m: string, i: number) => <li key={i}>{m}</li>)}
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
        </div>
      )}
    </div>
  );
}
