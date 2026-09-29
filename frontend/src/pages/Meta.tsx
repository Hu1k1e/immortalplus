import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

type SortKey = 'matches' | 'meta_score' | 'winrate';

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
  const navigate = useNavigate();
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

  // Auto-refresh on the same cadence as the backend actually re-syncs
  // this data (protracker_interval_minutes, configured in Settings —
  // shared with the Draft Helper's position data, since both now read
  // from the same HeroPositionMeta table) — otherwise this page only
  // ever shows what it had at initial load until a manual refresh or a
  // full page reload, even though fresher data exists server-side.
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState(30);
  useEffect(() => {
    api.get('/settings').then((res) => {
      const d = res.data;
      if (d && typeof d === 'object' && typeof d.protracker_interval_minutes === 'number') {
        setAutoRefreshMinutes(d.protracker_interval_minutes);
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const ms = Math.max(1, autoRefreshMinutes) * 60 * 1000;
    const id = setInterval(() => fetchData(position), ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, autoRefreshMinutes]);

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
  //
  // This page only cares about the hero_position_meta step of the
  // combined refresh — the same POST /draft/refresh-meta also syncs
  // hero_matchups/hero_synergy for the Draft Helper, which involves many
  // more rate-limited per-hero calls and can keep running for a while
  // after hero_position_meta is already done. Waiting for the *overall*
  // state to become "done" made this page's button say "Refreshing…"
  // long after its own data had actually updated, which is what looked
  // like a stuck/broken refresh. Resolving as soon as hero_position_meta
  // shows up in results (regardless of the other steps) fixes that.
  const pollRefreshStatus = useCallback(() => {
    const poll = async () => {
      try {
        const res = await api.get('/draft/refresh-meta/status');
        const results = res.data.results || {};
        const ownStep = results.hero_position_meta;
        if (ownStep) {
          setRefreshStatus(ownStep.status === 'ok' ? 'ok' : 'error');
          setTimeout(() => setRefreshStatus('idle'), 4000);
          fetchData(position);
          return;
        }
        if (res.data.state === 'done') {
          // Finished without ever reporting hero_position_meta (shouldn't
          // normally happen, but don't spin forever if it does).
          setRefreshStatus('error');
          setTimeout(() => setRefreshStatus('idle'), 4000);
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
              <div key={h.hero_id} className="meta-top-hero-card" onClick={() => navigate(`/meta/hero/${h.hero_id}`)}>
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
                </tr>
              </thead>
              <tbody>
                {filteredHeroes.map(h => (
                  <tr key={h.hero_id} className="meta-table-row-clickable" onClick={() => navigate(`/meta/hero/${h.hero_id}`)}>
                    <td className="meta-table-hero">
                      <img src={h.hero_icon} alt={h.hero_name} />
                      <span>{h.hero_name}</span>
                    </td>
                    <td>{h.matches.toLocaleString()}</td>
                    <td className="meta-table-rating" style={{ color: TIER_COLORS[h.tier] }}>{h.meta_score?.toFixed(0)}/100</td>
                    <td><span className="meta-tier-badge" style={{ background: TIER_COLORS[h.tier] }}>{h.tier}</span></td>
                    <td className={h.winrate >= 50 ? 'good' : 'bad'}>{pct(h.winrate)}</td>
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
