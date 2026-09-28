import { getHeroImage, getHeroIcon } from '../lib/dota';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
type PositionFit = Record<number, Record<number, number>>; // hero_id -> position -> matches

const ROLE_ORDER = ['carry', 'mid', 'offlane', 'soft_support', 'hard_support'];
const POSITION_OF_ROLE: Record<string, number> = { carry: 1, mid: 2, offlane: 3, soft_support: 4, hard_support: 5 };
const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry',
  mid: 'Mid',
  offlane: 'Offlane',
  soft_support: 'Soft Sup.',
  hard_support: 'Hard Sup.',
};

function stateSignature(s: GsiState) {
  return JSON.stringify([s.ally_picks, s.enemy_picks, s.bans]);
}

/**
 * GSI has no "queued role" field (confirmed directly against the real
 * GSI schema — no role/position data anywhere in the player or draft
 * blocks), so there's no way to know for certain which position an
 * already-picked hero is filling. This assigns each pick to whichever
 * position it's most commonly played at (hero_position_fit, from real
 * HeroPositionMeta match counts), greedily resolving conflicts by
 * giving each pick to its single best-fitting open position — an
 * estimate from real data, not a guess pulled from nowhere, but still
 * an estimate.
 */
function assignPositions(pickedIds: number[] | undefined | null, fit: PositionFit): Record<number, number | null> {
  const slots: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null, 5: null };
  pickedIds = pickedIds || [];
  if (!pickedIds.length) return slots;

  const candidates: { heroId: number; position: number; score: number }[] = [];
  for (const heroId of pickedIds) {
    for (let position = 1; position <= 5; position++) {
      candidates.push({ heroId, position, score: fit[heroId]?.[position] || 0 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedHeroes = new Set<number>();
  for (const c of candidates) {
    if (usedHeroes.has(c.heroId) || slots[c.position] !== null) continue;
    slots[c.position] = c.heroId;
    usedHeroes.add(c.heroId);
  }
  // Any picks with no position data at all (score 0 everywhere) may still
  // be unassigned — drop them into whatever slot is left, in pick order.
  const openPositions = [1, 2, 3, 4, 5].filter(p => slots[p] === null);
  for (const heroId of pickedIds) {
    if (usedHeroes.has(heroId) || !openPositions.length) continue;
    const position = openPositions.shift()!;
    slots[position] = heroId;
    usedHeroes.add(heroId);
  }
  return slots;
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
  const [positionFit, setPositionFit] = useState<PositionFit>({});
  const [updating, setUpdating] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [summaryRole, setSummaryRole] = useState('carry');
  // Our position-assignment is a best guess (see assignPositions — GSI has
  // no real "queued role" data to confirm it against), so it can get it
  // wrong. null means "use the auto-assigned guess"; once the user drags
  // a hero to a different column, this holds their manual layout instead,
  // until new picks arrive and it resets back to a fresh guess.
  const [allyOverride, setAllyOverride] = useState<Record<number, number | null> | null>(null);
  const [enemyOverride, setEnemyOverride] = useState<Record<number, number | null> | null>(null);
  const dragSource = useRef<{ side: 'ally' | 'enemy'; position: number } | null>(null);
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
      setPositionFit(res.data.hero_position_fit || {});
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }, []);

  const applyState = useCallback((raw: GsiState) => {
    // Defensive: normalize whatever comes back (WS message or the
    // initial REST fetch) instead of trusting its shape blindly — a
    // malformed/partial response should degrade to empty lists, never
    // crash the page.
    const state: GsiState = {
      active: !!raw?.active,
      ally_picks: Array.isArray(raw?.ally_picks) ? raw.ally_picks : [],
      enemy_picks: Array.isArray(raw?.enemy_picks) ? raw.enemy_picks : [],
      bans: Array.isArray(raw?.bans) ? raw.bans : [],
      phase: raw?.phase ?? null,
    };
    setGsiState(state);
    const sig = stateSignature(state);
    if (state.active && sig !== lastFetchedSignature.current) {
      lastFetchedSignature.current = sig;
      fetchSuggestions(state);
    }
  }, [fetchSuggestions]);

  const refreshMeta = async () => {
    // A full resync (hero_matchups alone rate-limits to 30 heroes at
    // 1.5s apart, synergy similarly) genuinely takes over a minute —
    // confirmed directly from production logs, where the sync was
    // working the whole time but the button showed "failed" because it
    // was waiting on one HTTP request for the entire thing. The backend
    // now runs this as a background task; poll its status instead of
    // waiting on the POST response.
    setRefreshStatus('loading');
    try {
      await api.post('/draft/refresh-meta');
    } catch (err) {
      console.error(err);
      setRefreshStatus('error');
      setTimeout(() => setRefreshStatus('idle'), 4000);
      return;
    }

    const poll = async () => {
      try {
        const res = await api.get('/draft/refresh-meta/status');
        if (res.data.state === 'done') {
          const results = res.data.results || {};
          const allOk = Object.values(results).every((r: any) => r.status === 'ok');
          setRefreshStatus(allOk ? 'ok' : 'error');
          setTimeout(() => setRefreshStatus('idle'), 4000);
          return;
        }
      } catch (err) {
        console.error(err);
      }
      setTimeout(poll, 3000);
    };
    setTimeout(poll, 3000);
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

    return () => { if (ws.current) ws.current.close(); };
  }, [applyState]);

  const autoAllySlots = useMemo(() => assignPositions(gsiState.ally_picks, positionFit), [gsiState.ally_picks, positionFit]);
  const autoEnemySlots = useMemo(() => assignPositions(gsiState.enemy_picks, positionFit), [gsiState.enemy_picks, positionFit]);

  // New picks/bans invalidate any manual layout from before them — start
  // from a fresh guess rather than risk carrying a stale swap forward.
  useEffect(() => { setAllyOverride(null); }, [gsiState.ally_picks]);
  useEffect(() => { setEnemyOverride(null); }, [gsiState.enemy_picks]);

  const allySlots = allyOverride ?? autoAllySlots;
  const enemySlots = enemyOverride ?? autoEnemySlots;

  const handleDragStart = (side: 'ally' | 'enemy', position: number) => (e: React.DragEvent) => {
    dragSource.current = { side, position };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (side: 'ally' | 'enemy', position: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const source = dragSource.current;
    dragSource.current = null;
    if (!source || source.side !== side || source.position === position) return;

    const current = side === 'ally' ? allySlots : enemySlots;
    const setOverride = side === 'ally' ? setAllyOverride : setEnemyOverride;
    const next = { ...current };
    // Swap, so the hero that was at the drop target doesn't disappear —
    // it takes the dragged hero's old spot instead.
    next[source.position] = current[position];
    next[position] = current[source.position];
    setOverride(next);
  };

  const renderBanStrip = (heroIds: number[]) => (
    <div className="draft-hero-strip">
      {heroIds.map(id => {
        const hero = HEROES[id];
        if (!hero) return null;
        return (
          <div key={id} className="draft-hero-chip banned">
            <img src={getHeroImage(id)} alt={hero.name} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span>{hero.name}</span>
          </div>
        );
      })}
    </div>
  );

  const renderSlot = (heroId: number | null, roleKey: string, side: 'ally' | 'enemy') => {
    const hero = heroId ? HEROES[heroId] : null;
    const position = POSITION_OF_ROLE[roleKey];
    return (
      <div
        className={`position-slot ${hero ? 'filled' : 'empty'}`}
        onDragOver={(e) => { if (dragSource.current?.side === side) e.preventDefault(); }}
        onDrop={handleDrop(side, position)}
        title={hero ? 'Drag to another column if this guess looks wrong' : undefined}
      >
        {hero ? (
          <img
            src={getHeroImage(heroId!)}
            alt={hero.name}
            draggable
            onDragStart={handleDragStart(side, position)}
          />
        ) : (
          <span className="position-slot-placeholder">Hero…</span>
        )}
        <span className="position-slot-label">{ROLE_LABELS[roleKey]}</span>
      </div>
    );
  };

  const renderScoreList = (items: RoleSuggestion[], emptyText: string) => {
    if (!items.length) return <p className="text-muted suggestion-empty">{emptyText}</p>;
    return (
      <div className="position-column-list">
        {items.map((s) => {
          const hero = HEROES[s.hero_id];
          if (!hero) return null;
          const reasonText = s.reason || (s.reasons && s.reasons[0]) || '';
          return (
            <div key={s.hero_id} className="position-row">
              <img src={getHeroIcon(s.hero_id)} alt={hero.name} className="position-row-icon" />
              <span className="position-row-name">{hero.name}</span>
              <span className={`position-row-score ${s.score >= 55 ? 'good' : s.score <= 45 ? 'bad' : ''}`}>
                {s.score >= 50 ? '+' : ''}{(s.score - 50).toFixed(1)}
              </span>
              {reasonText && <span className="position-row-reason" title={reasonText}>{reasonText}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPositionColumn = (roleKey: string, side: 'ally' | 'enemy') => {
    const position = POSITION_OF_ROLE[roleKey];
    const slots = side === 'ally' ? allySlots : enemySlots;
    const block = byRole?.[roleKey];
    // Ally side gets the real personalized "combined" ranking (meta +
    // your comfort + matchup vs enemy + synergy with allies). Enemy side
    // shows meta strength only — our engine's combined score is computed
    // from YOUR perspective (matchup vs your enemies, synergy with your
    // allies), which isn't meaningful mirrored onto what the enemy team
    // might pick, so it isn't reused there.
    const list = side === 'ally' ? block?.combined : block?.meta_best;
    return (
      <div className="position-column" key={roleKey}>
        {renderSlot(slots[position], roleKey, side)}
        {renderScoreList(list || [], byRole ? 'No data yet.' : 'Suggestions appear once the draft starts.')}
      </div>
    );
  };

  const summaryBlock = byRole?.[summaryRole];

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

      <div className="draft-board">
        <div className="draft-side draft-side-ally">
          <div className="draft-side-header ally">
            <span className="draft-side-title">Your Team</span>
            <span className="draft-side-subtitle">Allies</span>
          </div>
          <div className="position-columns">
            {ROLE_ORDER.map(k => renderPositionColumn(k, 'ally'))}
          </div>
        </div>

        <div className="draft-side draft-side-enemy">
          <div className="draft-side-header enemy">
            <span className="draft-side-title">Enemy Team</span>
            <span className="draft-side-subtitle">Enemies</span>
          </div>
          <div className="position-columns">
            {ROLE_ORDER.map(k => renderPositionColumn(k, 'enemy'))}
          </div>
        </div>
      </div>

      {gsiState.bans.length > 0 && (
        <div className="glass-surface draft-bans-panel">
          <h4>Banned</h4>
          {renderBanStrip(gsiState.bans)}
        </div>
      )}

      <div className="glass-surface draft-suggestions-panel">
        <div className="role-tabs">
          {ROLE_ORDER.map(key => (
            <button
              key={key}
              className={`role-tab ${summaryRole === key ? 'role-tab-active' : ''}`}
              onClick={() => setSummaryRole(key)}
            >
              {ROLE_LABELS[key]}
            </button>
          ))}
        </div>

        {!byRole ? (
          <div className="suggestion-placeholder">
            <p className="text-muted">More detail appears here once the draft starts.</p>
          </div>
        ) : summaryBlock ? (
          <div className="suggestion-columns">
            <div className="suggestion-column">
              <div className="suggestion-column-header">
                <h4>Best This Patch</h4>
                <span className="suggestion-column-subtitle">Highest winrate at this position</span>
              </div>
              {summaryBlock.meta_best.length === 0 ? (
                <p className="text-muted suggestion-empty">Not enough data yet.</p>
              ) : (
                <div className="suggestion-list">
                  {summaryBlock.meta_best.slice(0, 6).map((s, i) => {
                    const hero = HEROES[s.hero_id];
                    if (!hero) return null;
                    return (
                      <div key={s.hero_id} className="suggestion-card animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <img src={getHeroIcon(s.hero_id)} alt={hero.name} className="suggestion-card-icon" />
                        <div className="suggestion-card-body">
                          <div className="suggestion-card-top">
                            <span className="suggestion-card-name">{hero.name}</span>
                            <span className="suggestion-card-score">{s.score.toFixed(0)}</span>
                          </div>
                          <div className="suggestion-score-bar"><div className="suggestion-score-bar-fill" style={{ width: `${Math.min(100, Math.max(4, s.score))}%` }} /></div>
                          {s.reason && <span className="suggestion-card-reason">{s.reason}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="suggestion-column">
              <div className="suggestion-column-header">
                <h4>Your Best</h4>
                <span className="suggestion-column-subtitle">Your history at this position</span>
              </div>
              {summaryBlock.your_best.length === 0 ? (
                <p className="text-muted suggestion-empty">Not enough games yet.</p>
              ) : (
                <div className="suggestion-list">
                  {summaryBlock.your_best.slice(0, 6).map((s, i) => {
                    const hero = HEROES[s.hero_id];
                    if (!hero) return null;
                    return (
                      <div key={s.hero_id} className="suggestion-card animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <img src={getHeroIcon(s.hero_id)} alt={hero.name} className="suggestion-card-icon" />
                        <div className="suggestion-card-body">
                          <div className="suggestion-card-top">
                            <span className="suggestion-card-name">{hero.name}</span>
                            <span className="suggestion-card-score">{s.score.toFixed(0)}</span>
                          </div>
                          <div className="suggestion-score-bar"><div className="suggestion-score-bar-fill" style={{ width: `${Math.min(100, Math.max(4, s.score))}%` }} /></div>
                          {s.reason && <span className="suggestion-card-reason">{s.reason}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
