import { getHeroImage, getHeroIcon } from '../lib/dota';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';

interface GsiState {
  active: boolean;
  ally_picks: number[];
  enemy_picks: number[];
  bans: number[];
  phase: string | null;
}

interface RoleSuggestion {
  hero_id: number;
  hero_name: string;
  score: number;
  reason?: string;
  reasons?: string[];
}

interface RoleBlock {
  position: number;
  position_name: string;
  meta_best: RoleSuggestion[];
  your_best: RoleSuggestion[];
  combined: RoleSuggestion[];
}

type ByRole = Record<string, RoleBlock>;

const ROLE_ORDER = ['carry', 'mid', 'offlane', 'soft_support', 'hard_support'];
const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry',
  mid: 'Mid',
  offlane: 'Offlane',
  soft_support: 'Soft Support',
  hard_support: 'Hard Support',
};

function stateSignature(s: GsiState) {
  return JSON.stringify([s.ally_picks, s.enemy_picks, s.bans]);
}

export default function DraftHelper() {
  const [gsiState, setGsiState] = useState<GsiState>({
    active: false,
    ally_picks: [],
    enemy_picks: [],
    bans: [],
    phase: null,
  });

  const [byRole, setByRole] = useState<ByRole | null>(null);
  const [activeRole, setActiveRole] = useState('carry');
  const [updating, setUpdating] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const ws = useRef<WebSocket | null>(null);
  const lastFetchedSignature = useRef<string>('');

  const fetchSuggestions = useCallback(async (state: GsiState) => {
    setUpdating(true);
    try {
      const res = await api.post('/draft/suggest', {
        ally_picks: state.ally_picks,
        enemy_picks: state.enemy_picks,
        bans: state.bans,
      });
      setByRole(res.data.by_role || null);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }, []);

  const applyState = useCallback((state: GsiState) => {
    setGsiState(state);
    const sig = stateSignature(state);
    // Only re-fetch when picks/bans actually changed — GSI posts several
    // times a second while a draft is active, and re-fetching on every
    // one of those (even when nothing changed) was what caused the
    // suggestions panel to blink every ~second.
    if (state.active && sig !== lastFetchedSignature.current) {
      lastFetchedSignature.current = sig;
      fetchSuggestions(state);
    }
  }, [fetchSuggestions]);

  const refreshMeta = async () => {
    setRefreshStatus('loading');
    try {
      const res = await api.post('/draft/refresh-meta');
      setRefreshStatus(res.data.status === 'ok' ? 'ok' : 'error');
    } catch (err) {
      console.error(err);
      setRefreshStatus('error');
    } finally {
      setTimeout(() => setRefreshStatus('idle'), 4000);
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
          applyState(JSON.parse(event.data));
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

    api.get('/draft/state').then(res => applyState(res.data)).catch(console.error);

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [applyState]);

  const renderHeroStrip = (heroIds: number[]) => {
    if (!heroIds || heroIds.length === 0) return <p className="text-muted">No heroes selected yet.</p>;
    return (
      <div className="draft-hero-strip">
        {heroIds.map(id => {
          const hero = HEROES[id];
          if (!hero) return null;
          return (
            <div key={id} className="draft-hero-chip">
              <img src={getHeroImage(id)} alt={hero.name} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span>{hero.name}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSuggestionColumn = (title: string, subtitle: string, items: RoleSuggestion[]) => (
    <div className="suggestion-column">
      <div className="suggestion-column-header">
        <h4>{title}</h4>
        <span className="suggestion-column-subtitle">{subtitle}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-muted suggestion-empty">Not enough data yet.</p>
      ) : (
        <div className="suggestion-list">
          {items.map((s, i) => {
            const hero = HEROES[s.hero_id];
            if (!hero) return null;
            const reasonText = s.reason || (s.reasons && s.reasons[0]) || '';
            return (
              <div key={s.hero_id} className="suggestion-card animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <img src={getHeroIcon(s.hero_id)} alt={hero.name} className="suggestion-card-icon" />
                <div className="suggestion-card-body">
                  <div className="suggestion-card-top">
                    <span className="suggestion-card-name">{hero.name}</span>
                    <span className="suggestion-card-score">{s.score.toFixed(0)}</span>
                  </div>
                  <div className="suggestion-score-bar">
                    <div className="suggestion-score-bar-fill" style={{ width: `${Math.min(100, Math.max(4, s.score))}%` }} />
                  </div>
                  {reasonText && <span className="suggestion-card-reason">{reasonText}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const role = byRole?.[activeRole];

  return (
    <div>
      <header className="page-header draft-header">
        <div>
          <h1 className="gold-text-gradient">Live Draft Helper</h1>
          <p className="text-secondary">
            {gsiState.active ? `Drafting phase active (${gsiState.phase})...` : 'Waiting for Dota 2 draft phase to begin...'}
            {updating && <span className="draft-updating-badge">updating…</span>}
          </p>
        </div>
        <button
          className={`btn btn-secondary refresh-meta-btn refresh-${refreshStatus}`}
          onClick={refreshMeta}
          disabled={refreshStatus === 'loading'}
        >
          {refreshStatus === 'loading' && 'Refreshing...'}
          {refreshStatus === 'ok' && 'Data refreshed ✓'}
          {refreshStatus === 'error' && 'Refresh failed ✗'}
          {refreshStatus === 'idle' && 'Refresh Meta Data'}
        </button>
      </header>

      <div className="draft-teams-grid">
        <div className="glass-surface card-interactive draft-team-panel draft-team-ally">
          <h3>Your Team</h3>
          {renderHeroStrip(gsiState.ally_picks)}
        </div>

        <div className="glass-surface card-interactive draft-team-panel draft-team-enemy">
          <h3>Enemy Team</h3>
          {renderHeroStrip(gsiState.enemy_picks)}
        </div>
      </div>

      {gsiState.bans.length > 0 && (
        <div className="glass-surface draft-bans-panel">
          <h4>Banned</h4>
          {renderHeroStrip(gsiState.bans)}
        </div>
      )}

      <div className="glass-surface draft-suggestions-panel">
        <div className="role-tabs">
          {ROLE_ORDER.map(key => (
            <button
              key={key}
              className={`role-tab ${activeRole === key ? 'role-tab-active' : ''}`}
              onClick={() => setActiveRole(key)}
            >
              {ROLE_LABELS[key]}
            </button>
          ))}
        </div>

        {!byRole ? (
          <div className="suggestion-placeholder">
            <p className="text-muted">Suggestions will appear once the draft starts.</p>
          </div>
        ) : role ? (
          <div className="suggestion-columns">
            {renderSuggestionColumn('Best This Patch', 'Highest winrate at this position', role.meta_best)}
            {renderSuggestionColumn('Your Best', 'Your history at this position', role.your_best)}
            {renderSuggestionColumn('Best Suggestion', 'Meta + your comfort + matchups', role.combined)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
