import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { ITEMS } from '../lib/items';
import MatchMap from './MatchMap';
import MatchupGrid from './MatchupGrid';
import TowersLaneRow from './TowersLaneRow';
import DraftBuildsKillsRow from './DraftBuildsKillsRow';
import BuildsPanel from './BuildsPanel';
import PlaybackSection from './PlaybackSection';

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
}

export default function MatchOverview({
  matchData, allPlayers, analysis, aiCoaching, aiError,
  activeMistakeTab, setActiveMistakeTab, selectedPlayer, setSelectedPlayer,
}: MatchOverviewProps) {
  if (selectedPlayer) {
    return (
      <PlayerDetailView
        matchData={matchData}
        selectedPlayer={selectedPlayer}
        analysis={analysis}
        aiCoaching={aiCoaching}
        aiError={aiError}
        activeMistakeTab={activeMistakeTab}
        setActiveMistakeTab={setActiveMistakeTab}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <MatchupGrid allPlayers={allPlayers} onSelectPlayer={setSelectedPlayer} />
      <TowersLaneRow matchData={matchData} allPlayers={allPlayers} />
      <DraftBuildsKillsRow matchData={matchData} allPlayers={allPlayers} />
      <BuildsPanel matchData={matchData} allPlayers={allPlayers} />
      <PlaybackSection matchData={matchData} allPlayers={allPlayers} selectedPlayer={null} />
    </div>
  );
}

function PlayerDetailView({ matchData, selectedPlayer, analysis, aiCoaching, aiError, activeMistakeTab, setActiveMistakeTab }: {
  matchData: any; selectedPlayer: any; analysis: any; aiCoaching: any; aiError: string;
  activeMistakeTab: string; setActiveMistakeTab: (tab: string) => void;
}) {
  const resolveItemName = (item: any) => {
    if (item == null) return null;
    return typeof item === 'number' || !isNaN(Number(item))
      ? ITEMS[Number(item)] || String(item).replace('item_', '')
      : String(item).replace('item_', '');
  };

  return (
    <>
      <div className="animate-fade-in">
        <div className="glass-surface" style={{ padding: '2rem', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
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

          <div className="glass-surface" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(0,0,0,0.4)' }}>
            <h3 className="gold-text-gradient" style={{ margin: 0 }}>Inventory Build</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', width: 'fit-content' }}>
              {selectedPlayer.items?.map((item: any, i: number) => {
                const itemName = resolveItemName(item);
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
                    const itemName = resolveItemName(item);
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
                      src={getItemImage(resolveItemName(selectedPlayer.neutral_item) || '')}
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

      {(selectedPlayer.player_slot === matchData.player_slot) && (
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
  );
}
