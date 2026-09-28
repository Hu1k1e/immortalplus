import { getHeroImage, getHeroIcon } from '../lib/dota';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import HeroPool from '../components/HeroPool';

interface GsiState {
  active: boolean;
  ally_picks: number[];
  enemy_picks: number[];
  bans: number[];
  phase: string | null;
}

interface MatchupBreakdownEntry {
  hero_id: number;
  hero_name: string;
  value: number;
}

interface RoleSuggestion {
  hero_id: number;
  hero_name: string;
  score: number;
  reason?: string;
  reasons?: string[];
  // Full per-enemy/per-ally breakdown behind this hero's matchup/synergy
  // component (every currently-picked hero this suggestion has real data
  // for, not just the 1-2 that make it into `reasons`) — only populated
  // on the "combined" list (see draft_engine.py), rendered as a hover
  // tooltip instead of static text.
  matchup_breakdown?: MatchupBreakdownEntry[];
  synergy_breakdown?: MatchupBreakdownEntry[];
}

interface RoleBlock {
  position: number;
  position_name: string;
  meta_best: RoleSuggestion[];
  your_best: RoleSuggestion[];
  combined: RoleSuggestion[];
}

type ByRole = Record<string, RoleBlock>;

interface DataSourceHealth {
  label: string;
  count: number;
  last_updated: string | null;
  age_hours: number | null;
  status: 'ok' | 'stale' | 'empty' | 'not_configured';
}

const SOURCE_LABELS: Record<string, string> = {
  hero_meta: 'Hero Meta (OpenDota)',
  hero_matchups: 'Matchups (OpenDota)',
  hero_position_meta: 'Position Meta (Stratz/ProTracker)',
  hero_synergy: 'Synergy (Stratz)',
};

function formatAge(hours: number | null): string {
  if (hours === null) return 'never';
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${(hours / 24).toFixed(1)}d ago`;
}
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
  const [dataHealth, setDataHealth] = useState<DataSourceHealth[] | null>(null);
  // Our position-assignment is a best guess (see assignPositions — GSI has
  // no real "queued role" data to confirm it against), so it can get it
  // wrong. null means "use the auto-assigned guess"; once the user drags
  // a hero to a different column, this holds their manual layout instead,
  // until new picks arrive and it resets back to a fresh guess.
  const [allyOverride, setAllyOverride] = useState<Record<number, number | null> | null>(null);
  const [enemyOverride, setEnemyOverride] = useState<Record<number, number | null> | null>(null);
  // Drag source covers both tabs: a slot already holding a hero (either
  // tab, swaps with the drop target) or a hero dragged straight out of
  // the Manual tab's hero pool (places into the drop target instead of
  // swapping, since the pool isn't "consumed" from anywhere).
  const dragSource = useRef<
    { kind: 'slot'; side: 'ally' | 'enemy'; position: number } | { kind: 'pool'; heroId: number } | null
  >(null);
  const ws = useRef<WebSocket | null>(null);
  const lastFetchedSignature = useRef<string>('');

  // ── Manual Draft tab — same board/suggestions UI as Live, but picks are
  // placed explicitly by the user (drag from the hero pool, or click a
  // slot then click a hero) instead of coming from GSI/the screen scanner.
  const [activeTab, setActiveTab] = useState<'live' | 'manual'>('live');
  const emptySlots = (): Record<number, number | null> => ({ 1: null, 2: null, 3: null, 4: null, 5: null });
  const [manualAlly, setManualAlly] = useState<Record<number, number | null>>(emptySlots());
  const [manualEnemy, setManualEnemy] = useState<Record<number, number | null>>(emptySlots());
  const [manualByRole, setManualByRole] = useState<ByRole | null>(null);
  const [manualUpdating, setManualUpdating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ side: 'ally' | 'enemy'; position: number } | null>(null);
  const [heroSearch, setHeroSearch] = useState('');

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

  const fetchDataHealth = useCallback(async () => {
    try {
      const res = await api.get('/draft/data-health');
      setDataHealth(res.data.sources || null);
    } catch (err) {
      console.error(err);
    }
  }, []);

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
          fetchDataHealth();
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
    fetchDataHealth();

    return () => { if (ws.current) ws.current.close(); };
  }, [applyState, fetchDataHealth]);

  const autoAllySlots = useMemo(() => assignPositions(gsiState.ally_picks, positionFit), [gsiState.ally_picks, positionFit]);
  const autoEnemySlots = useMemo(() => assignPositions(gsiState.enemy_picks, positionFit), [gsiState.enemy_picks, positionFit]);

  // New picks/bans invalidate any manual layout from before them — start
  // from a fresh guess rather than risk carrying a stale swap forward.
  useEffect(() => { setAllyOverride(null); }, [gsiState.ally_picks]);
  useEffect(() => { setEnemyOverride(null); }, [gsiState.enemy_picks]);

  const allySlots = allyOverride ?? autoAllySlots;
  const enemySlots = enemyOverride ?? autoEnemySlots;

  const handleDragStart = (side: 'ally' | 'enemy', position: number) => (e: React.DragEvent) => {
    dragSource.current = { kind: 'slot', side, position };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (side: 'ally' | 'enemy', position: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const source = dragSource.current;
    dragSource.current = null;
    if (!source || source.kind !== 'slot' || source.side !== side || source.position === position) return;

    const current = side === 'ally' ? allySlots : enemySlots;
    const setOverride = side === 'ally' ? setAllyOverride : setEnemyOverride;
    const next = { ...current };
    // Swap, so the hero that was at the drop target doesn't disappear —
    // it takes the dragged hero's old spot instead.
    next[source.position] = current[position];
    next[position] = current[source.position];
    setOverride(next);
  };

  // ── Manual tab handlers ──────────────────────────────────────────────
  // Dota doesn't allow the same hero on both teams or twice on one team,
  // so placing a hero anywhere first strips it out of every other slot
  // it might already occupy — otherwise drag/click placement could create
  // impossible duplicate drafts.
  const placeHeroInManualSlot = (side: 'ally' | 'enemy', position: number, heroId: number) => {
    setManualAlly(prev => {
      const next = { ...prev };
      for (const p of [1, 2, 3, 4, 5]) if (next[p] === heroId) next[p] = null;
      if (side === 'ally') next[position] = heroId;
      return next;
    });
    setManualEnemy(prev => {
      const next = { ...prev };
      for (const p of [1, 2, 3, 4, 5]) if (next[p] === heroId) next[p] = null;
      if (side === 'enemy') next[position] = heroId;
      return next;
    });
  };

  const handlePoolDragStart = (heroId: number) => {
    dragSource.current = { kind: 'pool', heroId };
  };

  const handlePoolHeroClick = (heroId: number) => {
    if (!selectedSlot) return;
    placeHeroInManualSlot(selectedSlot.side, selectedSlot.position, heroId);
    setSelectedSlot(null);
  };

  const handleManualSlotClick = (side: 'ally' | 'enemy', position: number) => {
    const slots = side === 'ally' ? manualAlly : manualEnemy;
    const isSameSelected = selectedSlot?.side === side && selectedSlot?.position === position;
    if (isSameSelected && slots[position] !== null) {
      // Clicking an already-selected, filled slot clears it — the only
      // way to remove a placed hero without dragging another on top of it.
      const setSlots = side === 'ally' ? setManualAlly : setManualEnemy;
      setSlots(prev => ({ ...prev, [position]: null }));
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot(isSameSelected ? null : { side, position });
  };

  const handleManualSlotDrop = (side: 'ally' | 'enemy', position: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const source = dragSource.current;
    dragSource.current = null;
    if (!source) return;

    if (source.kind === 'pool') {
      placeHeroInManualSlot(side, position, source.heroId);
      return;
    }
    // Slot-to-slot: swap within the same side only (dragging across
    // sides would silently move a hero to the other team, surprising).
    if (source.side !== side || source.position === position) return;
    const current = side === 'ally' ? manualAlly : manualEnemy;
    const setSlots = side === 'ally' ? setManualAlly : setManualEnemy;
    const next = { ...current };
    next[source.position] = current[position];
    next[position] = current[source.position];
    setSlots(next);
  };

  const manualAllyIds = useMemo(
    () => Object.values(manualAlly).filter((id): id is number => id !== null),
    [manualAlly]
  );
  const manualEnemyIds = useMemo(
    () => Object.values(manualEnemy).filter((id): id is number => id !== null),
    [manualEnemy]
  );

  useEffect(() => {
    if (activeTab !== 'manual') return;
    let cancelled = false;
    setManualUpdating(true);
    api.post('/draft/suggest', {
      ally_picks: manualAllyIds,
      enemy_picks: manualEnemyIds,
      bans: [],
    })
      .then(res => { if (!cancelled) setManualByRole(res.data.by_role || null); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setManualUpdating(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, manualAllyIds.join(','), manualEnemyIds.join(',')]);

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
        onDragOver={(e) => { if (dragSource.current?.kind === 'slot' && dragSource.current.side === side) e.preventDefault(); }}
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

  const renderManualSlot = (heroId: number | null, roleKey: string, side: 'ally' | 'enemy') => {
    const hero = heroId ? HEROES[heroId] : null;
    const position = POSITION_OF_ROLE[roleKey];
    const selected = selectedSlot?.side === side && selectedSlot?.position === position;
    return (
      <div
        className={`position-slot manual-slot ${hero ? 'filled' : 'empty'} ${selected ? 'selected' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleManualSlotDrop(side, position)}
        onClick={() => handleManualSlotClick(side, position)}
        title={hero ? 'Click to select (click again to remove), or drag a hero from the pool' : 'Click, then pick a hero from the pool above'}
      >
        {hero ? (
          <img
            src={getHeroImage(heroId!)}
            alt={hero.name}
            draggable
            onDragStart={handleDragStart(side, position)}
          />
        ) : (
          <span className="position-slot-placeholder">{selected ? 'Pick a hero…' : 'Hero…'}</span>
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
          // Every currently-picked enemy/ally this hero has real data
          // for — combined into one tooltip rather than the old
          // always-visible, truncated-to-one "Good against X" text, and
          // it grows automatically as more enemies/allies get picked
          // since it's recomputed by the backend on every /suggest call.
          const breakdown = [...(s.matchup_breakdown || []), ...(s.synergy_breakdown || [])];
          return (
            <div key={s.hero_id} className="position-row">
              <img src={getHeroIcon(s.hero_id)} alt={hero.name} className="position-row-icon" />
              <span className="position-row-name">{hero.name}</span>
              <span
                className={`position-row-score ${s.score >= 55 ? 'good' : s.score <= 45 ? 'bad' : ''}`}
                title="Suggestion score out of 100 (meta strength + your comfort + matchups + synergy blended) — 50 is neutral, higher is better"
              >
                {Math.round(s.score)}
              </span>
              {breakdown.length > 0 && (
                <div className="position-row-tooltip">
                  {breakdown.map((b, idx) => (
                    <div className="position-row-tooltip-item" key={`${b.hero_id}-${idx}`}>
                      <img src={getHeroIcon(b.hero_id)} alt={b.hero_name} />
                      <span className={b.value >= 0 ? 'good' : 'bad'}>
                        {b.value >= 0 ? '+' : ''}{b.value.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

  const renderManualPositionColumn = (roleKey: string, side: 'ally' | 'enemy') => {
    const position = POSITION_OF_ROLE[roleKey];
    const slots = side === 'ally' ? manualAlly : manualEnemy;
    const block = manualByRole?.[roleKey];
    // Same choice as the Live tab: ally gets the personalized "combined"
    // ranking, enemy gets meta strength only (combined is computed from
    // YOUR perspective — matchup vs your enemies, synergy with your
    // allies — which isn't meaningful mirrored onto the enemy picks).
    const list = side === 'ally' ? block?.combined : block?.meta_best;
    return (
      <div className="position-column" key={roleKey}>
        {renderManualSlot(slots[position], roleKey, side)}
        {renderScoreList(list || [], manualByRole ? 'No data yet.' : 'Add heroes above to see suggestions.')}
      </div>
    );
  };

  const summaryBlock = byRole?.[summaryRole];
  const manualSummaryBlock = manualByRole?.[summaryRole];
  const activeByRole = activeTab === 'live' ? byRole : manualByRole;
  const activeSummaryBlock = activeTab === 'live' ? summaryBlock : manualSummaryBlock;
  const manualUsedHeroIds = useMemo(
    () => new Set<number>([...manualAllyIds, ...manualEnemyIds]),
    [manualAllyIds, manualEnemyIds]
  );

  return (
    <div>
      <header className="page-header draft-header">
        <div>
          <h1 className="gold-text-gradient">Draft Helper</h1>
          <p className="text-secondary">
            {activeTab === 'live'
              ? (gsiState.active ? `Drafting phase active (${gsiState.phase})...` : 'Waiting for Dota 2 draft phase to begin...')
              : 'Manually build both teams to get suggestions — no live game needed.'}
            {(activeTab === 'live' ? updating : manualUpdating) && <span className="draft-updating-badge">updating…</span>}
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

      <div className="draft-mode-tabs">
        <button
          className={`draft-mode-tab ${activeTab === 'live' ? 'draft-mode-tab-active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          Live Draft
        </button>
        <button
          className={`draft-mode-tab ${activeTab === 'manual' ? 'draft-mode-tab-active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Draft
        </button>
      </div>

      {dataHealth && (
        <div className="glass-surface data-health-panel">
          {dataHealth.map(s => (
            <div key={s.label} className={`data-health-item status-${s.status}`}>
              <span className={`data-health-dot status-${s.status}`} />
              <span className="data-health-label">{SOURCE_LABELS[s.label] || s.label}</span>
              <span className="data-health-count">{s.count.toLocaleString()} rows</span>
              <span className="data-health-age">
                {s.status === 'not_configured' ? 'not configured' : formatAge(s.age_hours)}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'manual' && (
        <HeroPool
          usedHeroIds={manualUsedHeroIds}
          search={heroSearch}
          onSearchChange={setHeroSearch}
          onDragStart={handlePoolDragStart}
          onHeroClick={handlePoolHeroClick}
          selectedSlotActive={!!selectedSlot}
        />
      )}

      {activeTab === 'live' ? (
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
      ) : (
        <div className="draft-board">
          <div className="draft-side draft-side-ally">
            <div className="draft-side-header ally">
              <span className="draft-side-title">Your Team</span>
              <span className="draft-side-subtitle">Allies</span>
            </div>
            <div className="position-columns">
              {ROLE_ORDER.map(k => renderManualPositionColumn(k, 'ally'))}
            </div>
          </div>

          <div className="draft-side draft-side-enemy">
            <div className="draft-side-header enemy">
              <span className="draft-side-title">Enemy Team</span>
              <span className="draft-side-subtitle">Enemies</span>
            </div>
            <div className="position-columns">
              {ROLE_ORDER.map(k => renderManualPositionColumn(k, 'enemy'))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'live' && gsiState.bans.length > 0 && (
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

        {!activeByRole ? (
          <div className="suggestion-placeholder">
            <p className="text-muted">
              {activeTab === 'live' ? 'More detail appears here once the draft starts.' : 'Add heroes above to see suggestions.'}
            </p>
          </div>
        ) : activeSummaryBlock ? (
          <div className="suggestion-columns">
            <div className="suggestion-column">
              <div className="suggestion-column-header">
                <h4>Best This Patch</h4>
                <span className="suggestion-column-subtitle">Highest winrate at this position</span>
              </div>
              {activeSummaryBlock.meta_best.length === 0 ? (
                <p className="text-muted suggestion-empty">Not enough data yet.</p>
              ) : (
                <div className="suggestion-list">
                  {activeSummaryBlock.meta_best.slice(0, 6).map((s, i) => {
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
              {activeSummaryBlock.your_best.length === 0 ? (
                <p className="text-muted suggestion-empty">Not enough games yet.</p>
              ) : (
                <div className="suggestion-list">
                  {activeSummaryBlock.your_best.slice(0, 6).map((s, i) => {
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
