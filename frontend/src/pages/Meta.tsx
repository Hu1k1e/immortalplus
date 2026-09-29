import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../lib/api';

interface HeroRow {
  hero_id: number;
  hero_name: string;
  hero_icon: string;
  hero_image: string;
  matches: number;
  winrate: number;
  meta_score: number;
  tier: string;
  contest_rate: number | null;
  lane_adv_pct: number | null;
  radiant_matches: number;
  radiant_winrate: number | null;
  dire_matches: number;
  dire_winrate: number | null;
  phase_1_matches: number;
  phase_1_winrate: number | null;
  phase_2_matches: number;
  phase_2_winrate: number | null;
  phase_3_matches: number;
  phase_3_winrate: number | null;
  build_matches: number;
  build_winrate: number | null;
  updated_at: string | null;
}

interface ProTrackerResponse {
  position: number;
  position_name: string;
  top_heroes: HeroRow[];
  heroes: HeroRow[];
  updated_at: string | null;
}

const POSITION_TABS = [
  { value: 0, label: 'All Roles' },
  { value: 1, label: 'Carry' },
  { value: 2, label: 'Mid' },
  { value: 3, label: 'Offlane' },
  { value: 4, label: 'Soft Sup.' },
  { value: 5, label: 'Hard Sup.' },
];

const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
const TIER_COLORS: Record<string, string> = {
  S: '#e04b4b', A: '#e2a53a', B: '#e2c93a', C: '#7fbf5f', D: '#5f9fbf', E: '#8a8a8a',
};

type SortKey =
  | 'matches' | 'meta_score' | 'winrate' | 'lane_adv_pct' | 'contest_rate'
  | 'build_winrate' | 'radiant_winrate' | 'dire_winrate'
  | 'phase_1_winrate' | 'phase_2_winrate' | 'phase_3_winrate';

function formatAge(iso: string | null): string {
  if (!iso) return 'never';
  const hours = (Date.now() - new Date(iso + 'Z').getTime()) / 3600000;
  if (hours < 0) return 'just now';
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${(hours / 24).toFixed(1)}d ago`;
}

function pct(v: number | null, signed = false): string {
  if (v === null || v === undefined) return '—';
  const sign = signed && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

export default function Meta() {
  const [position, setPosition] = useState(1);
  const [data, setData] = useState<ProTrackerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  const [search, setSearch] = useState('');
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set(TIERS));
  const [minMatches, setMinMatches] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('meta_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = (pos: number) => {
    setLoading(true);
    api.get('/meta/protracker', { params: { position: pos } })
      .then(res => {
        // Defensive: don't trust the response shape blindly — a
        // malformed/non-JSON response (e.g. a dev-server SPA fallback
        // returning index.html for an unmatched /api/* route, seen
        // crashing a different page earlier this project for the same
        // reason) should degrade to an empty state, never crash.
        const raw = res.data;
        const heroes = Array.isArray(raw?.heroes) ? raw.heroes : [];
        const topHeroes = Array.isArray(raw?.top_heroes) ? raw.top_heroes : [];
        setData(raw && Array.isArray(raw.heroes) ? { ...raw, heroes, top_heroes: topHeroes } : null);
      })
      .catch(err => { console.error(err); setData(null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(position); }, [position]);

  // Real min/max matches across the current list, same idea as
  // ProTracker's own "Matches" range slider — bounds move with whatever
  // position/data is currently loaded rather than a hardcoded range.
  const matchesBounds = useMemo(() => {
    if (!data || !data.heroes || !data.heroes.length) return { min: 0, max: 0 };
    const values = data.heroes.map(h => h.matches);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [data]);

  useEffect(() => { setMinMatches(matchesBounds.min); }, [matchesBounds.min]);

  // Extracted so both a fresh click and the mount-time "is a refresh
  // already running" check above can drive the same polling loop.
  const pollRefreshStatus = useCallback(() => {
    const poll = async () => {
      try {
        const res = await api.get('/draft/refresh-meta/status');
        if (res.data.state === 'done') {
          const results = res.data.results || {};
          const allOk = Object.values(results).every((r: any) => r.status === 'ok');
          setRefreshStatus(allOk ? 'ok' : 'error');
          setTimeout(() => setRefreshStatus('idle'), 4000);
          fetchData(position);
          return;
        }
      } catch (err) { console.error(err); }
      setTimeout(poll, 3000);
    };
    setTimeout(poll, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const refreshMeta = async () => {
    setRefreshStatus('loading');
    try {
      await api.post('/draft/refresh-meta');
    } catch (err) {
      console.error(err);
      setRefreshStatus('error');
      setTimeout(() => setRefreshStatus('idle'), 4000);
      return;
    }
    pollRefreshStatus();
  };

  // Pick up a refresh already running on the backend (started before this
  // mount — another tab, a previous visit to this page, or the button was
  // clicked and the user navigated away and back) instead of always
  // showing the button as idle/clickable.
  useEffect(() => {
    api.get('/draft/refresh-meta/status').then((res) => {
      if (res.data?.state === 'running') {
        setRefreshStatus('loading');
        pollRefreshStatus();
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTier = (tier: string) => {
    setSelectedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });
  };

  const filteredHeroes = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = data.heroes.filter(h =>
      (!q || h.hero_name.toLowerCase().includes(q)) &&
      selectedTiers.has(h.tier) &&
      h.matches >= minMatches
    );
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortKey] ?? -Infinity;
      const bv = (b as any)[sortKey] ?? -Infinity;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [data, search, selectedTiers, minMatches, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '');

  return (
    <div>
      <header className="page-header draft-header">
        <div>
          <h1 className="gold-text-gradient">Meta</h1>
          <p className="text-secondary">
            Dota2ProTracker hero meta — 7000+ MMR pubs, current patch.
            {data && <span className="draft-updating-badge">updated {formatAge(data.updated_at)}</span>}
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

      <div className="role-tabs">
        {POSITION_TABS.map(t => (
          <button
            key={t.value}
            className={`role-tab ${position === t.value ? 'role-tab-active' : ''}`}
            onClick={() => setPosition(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !data || data.heroes.length === 0 ? (
        <p className="text-muted suggestion-empty">
          No data yet for this role — try "Refresh Meta Data" above.
        </p>
      ) : (
        <>
          <div className="glass-surface meta-top-heroes">
            {data.top_heroes.map(h => (
              <div key={h.hero_id} className="meta-top-hero-card">
                <img src={h.hero_icon} alt={h.hero_name} />
                <div className="meta-top-hero-body">
                  <span className="meta-top-hero-name">{h.hero_name}</span>
                  <span className="meta-top-hero-stats">
                    {h.matches.toLocaleString()} · {pct(h.winrate)}
                  </span>
                  <span className="meta-top-hero-rating" style={{ color: TIER_COLORS[h.tier] }}>
                    {h.meta_score?.toFixed(0)}/100
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-surface meta-filters">
            <h4>Table Filters</h4>
            <p className="text-muted meta-filters-subtitle">Filter heroes, choose tiers, and control the table display.</p>
            <div className="meta-filters-row">
              <input
                type="text"
                className="hero-pool-search meta-search"
                placeholder="Filter heroes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <label className="meta-matches-filter">
                Matches ≥ {minMatches.toLocaleString()}
                <input
                  type="range"
                  min={matchesBounds.min}
                  max={matchesBounds.max}
                  value={minMatches}
                  onChange={e => setMinMatches(Number(e.target.value))}
                />
              </label>
              <div className="meta-tier-filter">
                {TIERS.map(tier => (
                  <button
                    key={tier}
                    className={`meta-tier-chip ${selectedTiers.has(tier) ? 'active' : ''}`}
                    style={{ borderColor: TIER_COLORS[tier], color: selectedTiers.has(tier) ? '#0a0c10' : TIER_COLORS[tier], background: selectedTiers.has(tier) ? TIER_COLORS[tier] : 'transparent' }}
                    onClick={() => toggleTier(tier)}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-surface meta-table-wrap">
            <table className="meta-table">
              <thead>
                <tr>
                  <th>Hero</th>
                  <th className="sortable" onClick={() => toggleSort('matches')}>Matches{sortArrow('matches')}</th>
                  <th className="sortable" onClick={() => toggleSort('meta_score')}>D2PT Rating{sortArrow('meta_score')}</th>
                  <th>Tier</th>
                  <th className="sortable" onClick={() => toggleSort('winrate')}>WR{sortArrow('winrate')}</th>
                  <th className="sortable" onClick={() => toggleSort('lane_adv_pct')}>Lane Adv{sortArrow('lane_adv_pct')}</th>
                  <th className="sortable" onClick={() => toggleSort('contest_rate')}>Contest Rate{sortArrow('contest_rate')}</th>
                  <th className="sortable" onClick={() => toggleSort('build_winrate')}>Best Build WR{sortArrow('build_winrate')}</th>
                  <th className="sortable" onClick={() => toggleSort('radiant_winrate')}>Radiant{sortArrow('radiant_winrate')}</th>
                  <th className="sortable" onClick={() => toggleSort('dire_winrate')}>Dire{sortArrow('dire_winrate')}</th>
                  <th className="sortable" onClick={() => toggleSort('phase_1_winrate')}>1st Phase{sortArrow('phase_1_winrate')}</th>
                  <th className="sortable" onClick={() => toggleSort('phase_2_winrate')}>2nd Phase{sortArrow('phase_2_winrate')}</th>
                  <th className="sortable" onClick={() => toggleSort('phase_3_winrate')}>3rd Phase{sortArrow('phase_3_winrate')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeroes.map(h => (
                  <tr key={h.hero_id}>
                    <td className="meta-table-hero">
                      <img src={h.hero_icon} alt={h.hero_name} />
                      <span>{h.hero_name}</span>
                    </td>
                    <td>{h.matches.toLocaleString()}</td>
                    <td className="meta-table-rating" style={{ color: TIER_COLORS[h.tier] }}>{h.meta_score?.toFixed(0)}/100</td>
                    <td><span className="meta-tier-badge" style={{ background: TIER_COLORS[h.tier] }}>{h.tier}</span></td>
                    <td className={h.winrate >= 50 ? 'good' : 'bad'}>{pct(h.winrate)}</td>
                    <td className={h.lane_adv_pct !== null ? (h.lane_adv_pct >= 0 ? 'good' : 'bad') : ''}>{pct(h.lane_adv_pct, true)}</td>
                    <td>{h.contest_rate !== null ? `${h.contest_rate.toFixed(1)}%` : '—'}</td>
                    <td>
                      {pct(h.build_winrate)}
                      {h.build_matches > 0 && <span className="meta-table-sub"> ({h.build_matches.toLocaleString()})</span>}
                    </td>
                    <td>
                      {pct(h.radiant_winrate)}
                      {h.radiant_matches > 0 && <span className="meta-table-sub"> ({h.radiant_matches.toLocaleString()})</span>}
                    </td>
                    <td>
                      {pct(h.dire_winrate)}
                      {h.dire_matches > 0 && <span className="meta-table-sub"> ({h.dire_matches.toLocaleString()})</span>}
                    </td>
                    <td>
                      {pct(h.phase_1_winrate)}
                      {h.phase_1_matches > 0 && <span className="meta-table-sub"> ({h.phase_1_matches.toLocaleString()})</span>}
                    </td>
                    <td>
                      {pct(h.phase_2_winrate)}
                      {h.phase_2_matches > 0 && <span className="meta-table-sub"> ({h.phase_2_matches.toLocaleString()})</span>}
                    </td>
                    <td>
                      {pct(h.phase_3_winrate)}
                      {h.phase_3_matches > 0 && <span className="meta-table-sub"> ({h.phase_3_matches.toLocaleString()})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredHeroes.length === 0 && <p className="text-muted suggestion-empty">No heroes match these filters.</p>}
          </div>
        </>
      )}
    </div>
  );
}
