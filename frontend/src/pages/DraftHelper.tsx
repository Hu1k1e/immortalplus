import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';

export default function DraftHelper() {
  const [gsiState, setGsiState] = useState<{ active: boolean; ally_picks: number[]; enemy_picks: number[]; bans: number[]; phase: string | null }>({
    active: false,
    ally_picks: [],
    enemy_picks: [],
    bans: [],
    phase: null,
  });
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  // Manual fallback toggles for testing
  const testPick = async () => {
    const newState = {
      ...gsiState,
      active: true,
      phase: 'pick',
      enemy_picks: [1, 2], // Anti-Mage, Axe
      ally_picks: [14],    // Pudge
    };
    setGsiState(newState);
    fetchSuggestions(newState);
  };

  const fetchSuggestions = async (state: typeof gsiState) => {
    setLoadingSuggestions(true);
    try {
      const res = await api.post('/draft/suggest', {
        ally_picks: state.ally_picks,
        enemy_picks: state.enemy_picks,
        bans: state.bans,
      });
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/draft/ws`;
    
    const connectWs = () => {
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => console.log('Draft WS Connected');
      
      ws.current.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          setGsiState(state);
          if (state.active) {
            fetchSuggestions(state);
          }
        } catch (e) {
          console.error('Failed to parse WS msg:', e);
        }
      };

      ws.current.onclose = () => {
        console.log('Draft WS Disconnected. Reconnecting in 5s...');
        setTimeout(connectWs, 5000);
      };
    };

    connectWs();

    // Fetch initial state via REST
    api.get('/draft/state').then(res => {
      setGsiState(res.data);
      if (res.data.active) fetchSuggestions(res.data);
    }).catch(console.error);

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const getHeroImgUrl = (imgName: string) => {
    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${imgName}.png`;
  };

  const renderHeroList = (heroIds: number[]) => {
    if (!heroIds || heroIds.length === 0) return <p className="text-muted">No heroes selected yet.</p>;
    
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {heroIds.map(id => {
          const hero = HEROES[id];
          if (!hero) return null;
          return (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <img 
                src={getHeroImgUrl(hero.img_name)} 
                alt={hero.name}
                style={{ width: '80px', height: '45px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{hero.name}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="gold-text-gradient">Live Draft Helper</h1>
          <p className="text-secondary">
            {gsiState.active ? `Drafting phase active (${gsiState.phase})...` : 'Waiting for Dota 2 draft phase to begin...'}
          </p>
        </div>
        {!gsiState.active && (
          <button className="btn btn-secondary" onClick={testPick}>Test Draft Flow</button>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-surface card-interactive" style={{ padding: '1.5rem', minHeight: '150px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--radiant-green)' }}>Your Team</h3>
          {renderHeroList(gsiState.ally_picks)}
        </div>

        <div className="glass-surface card-interactive" style={{ padding: '1.5rem', minHeight: '150px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--dire-red)' }}>Enemy Team</h3>
          {renderHeroList(gsiState.enemy_picks)}
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '1.5rem', marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Suggested Picks</h2>
        
        {loadingSuggestions ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px' }}>
            <p className="text-muted animate-pulse">Analyzing meta and matchups...</p>
          </div>
        ) : suggestions.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {suggestions.slice(0, 8).map((s) => {
              const hero = HEROES[s.hero_id];
              if (!hero) return null;
              return (
                <div key={s.hero_id} className="card-interactive" style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <img 
                    src={getHeroImgUrl(hero.img_name)} 
                    alt={hero.name}
                    style={{ width: '60px', height: '34px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold' }}>{hero.name}</span>
                    <span style={{ fontSize: '0.8rem', color: s.composite_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>Score: {s.composite_score.toFixed(1)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.reasons && s.reasons.length > 0 ? s.reasons[0] : 'Solid pick'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px' }}>
            <p className="text-muted">No suggestions available. Awaiting picks.</p>
          </div>
        )}
      </div>
    </div>
  );
}
