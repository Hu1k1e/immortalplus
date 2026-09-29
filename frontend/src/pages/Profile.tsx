import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../lib/api';
import { HEROES, getHeroImage } from '../lib/dota';
import { getRankBadge, getRankLabel } from '../lib/rank';
import './Profile.css';

const POSITION_COLORS: Record<number, string> = {
  1: '#e2b742',
  2: '#4fb8e0',
  3: '#c2352b',
  4: '#51a445',
  5: '#8b6bd8',
};

interface FilterState {
  excludeTurbo: boolean;
  heroId: string;
  position: string;
  gameMode: string;
  lobbyType: string;
  soloParty: string;
}

const DEFAULT_FILTERS: FilterState = {
  excludeTurbo: false, heroId: '', position: '', gameMode: '', lobbyType: '', soloParty: '',
};

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.floor(mo / 12)} yr ago`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Donut({ breakdown, size = 150 }: { breakdown: { position: number; position_name: string; count: number }[]; size?: number }) {
  const total = breakdown.reduce((s, b) => s + b.count, 0);
  const r = size / 2 - 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = breakdown.map((b) => {
    const frac = total ? b.count / total : 0;
    const seg = { ...b, frac, dash: frac * circumference, offset };
    offset += frac * circumference;
    return seg;
  });

  return (
    <div className="profile-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
        {total === 0 && (
          <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--text-muted)">No data</text>
        )}
        {segments.map((s) => (
          <circle
            key={s.position}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={POSITION_COLORS[s.position]}
            strokeWidth="16"
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{s.position_name}: {s.count} games ({Math.round(s.frac * 100)}%)</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [filterOptions, setFilterOptions] = useState<any>({ game_modes: [], lobby_types: [], positions: [] });
  const [heroList, setHeroList] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [summary, setSummary] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [trendWindow, setTrendWindow] = useState(25);
  const [topHeroes, setTopHeroes] = useState<any>(null);

  useEffect(() => {
    api.get('/player/profile').then((r) => {
      const d = r.data;
      if (d && typeof d === 'object' && typeof d.persona_name !== 'undefined') setProfile(d);
    }).catch(() => {});
    api.get('/player/filter-options').then((r) => {
      const d = r.data;
      if (d && typeof d === 'object' && Array.isArray(d.positions)) setFilterOptions(d);
    }).catch(() => {});
    api.get('/meta/hero-list').then((r) => setHeroList(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const filterParams = useMemo(() => {
    const p: Record<string, any> = {};
    if (filters.excludeTurbo) p.exclude_turbo = true;
    if (filters.heroId) p.hero_id = filters.heroId;
    if (filters.position) p.position = filters.position;
    if (filters.gameMode) p.game_mode = filters.gameMode;
    if (filters.lobbyType) p.lobby_type = filters.lobbyType;
    if (filters.soloParty) p.solo_party = filters.soloParty;
    return p;
  }, [filters]);

  useEffect(() => {
    api.get('/player/summary', { params: filterParams }).then((r) => {
      const d = r.data;
      if (d && typeof d === 'object' && typeof d.matches === 'number') setSummary(d);
    }).catch(() => {});
    api.get('/matches', { params: { ...filterParams, limit: 20 } }).then((r) => {
      const d = r.data;
      setMatches(d && typeof d === 'object' && Array.isArray(d.matches) ? d.matches : []);
    }).catch(() => {});
    api.get('/player/most-played-heroes', { params: { ...filterParams, limit: 5 } }).then((r) => {
      const d = r.data;
      if (d && typeof d === 'object' && Array.isArray(d.heroes)) setTopHeroes(d);
    }).catch(() => {});
  }, [filterParams]);

  useEffect(() => {
    api.get('/player/trends', { params: { ...filterParams, window: trendWindow } }).then((r) => {
      const d = r.data;
      if (d && typeof d === 'object' && Array.isArray(d.position_breakdown)) setTrends(d);
    }).catch(() => {});
  }, [filterParams, trendWindow]);

  const rankBadge = profile ? getRankBadge(profile.rank_tier) : null;
  const rankLabel = profile ? getRankLabel(profile.rank_tier) : null;

  const setFilter = (key: keyof FilterState, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="profile-page">
      <div className="profile-header glass-surface">
        <img
          src={profile?.avatar_url || '/logo.png'}
          alt=""
          className="profile-header-avatar"
          onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
        />
        <div className="profile-header-info">
          <h1>{profile?.persona_name || 'Loading…'}</h1>
          {rankLabel && <span className="profile-header-rank-label">{rankLabel}</span>}
        </div>
        {rankBadge && <img src={rankBadge} alt={rankLabel || ''} className="profile-header-rank-badge" />}
      </div>

      <div className="profile-filters glass-surface">
        <label className="profile-filter-toggle">
          <input type="checkbox" checked={filters.excludeTurbo} onChange={(e) => setFilter('excludeTurbo', e.target.checked)} />
          Exclude Turbo
        </label>
        <select value={filters.heroId} onChange={(e) => setFilter('heroId', e.target.value)}>
          <option value="">All Heroes</option>
          {heroList.map((h) => <option key={h.hero_id} value={h.hero_id}>{h.name}</option>)}
        </select>
        <select value={filters.position} onChange={(e) => setFilter('position', e.target.value)}>
          <option value="">All Positions</option>
          {filterOptions.positions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.gameMode} onChange={(e) => setFilter('gameMode', e.target.value)}>
          <option value="">All Game Modes</option>
          {filterOptions.game_modes.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={filters.lobbyType} onChange={(e) => setFilter('lobbyType', e.target.value)}>
          <option value="">All Lobby Types</option>
          {filterOptions.lobby_types.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filters.soloParty} onChange={(e) => setFilter('soloParty', e.target.value)}>
          <option value="">Solo/Party</option>
          <option value="solo">Solo Only</option>
          <option value="party">Party Only</option>
        </select>
      </div>

      <div className="profile-stats-row">
        <div className="profile-stat-card glass-surface">
          <div className="profile-stat-value gold">{summary?.matches?.toLocaleString() ?? '—'}</div>
          <div className="profile-stat-label">Matches</div>
          {summary?.first_match_at && (
            <div className="profile-stat-sub">First match: {new Date(summary.first_match_at).toLocaleDateString()}</div>
          )}
        </div>
        <div className="profile-stat-card glass-surface">
          <div className="profile-stat-value green">{summary?.winrate ?? 0}%</div>
          <div className="profile-stat-label">Win Rate</div>
          {summary && (
            <div className="profile-winrate-bar">
              <div className="profile-winrate-bar-win" style={{ width: `${summary.winrate}%` }} />
            </div>
          )}
          {summary && <div className="profile-stat-sub">{summary.wins} - {summary.losses}</div>}
        </div>
      </div>

      <div className="profile-main-row">
        <div className="profile-matches-card glass-surface">
          <div className="profile-card-title">Matches</div>
          <div className="profile-matches-list">
            {matches.length === 0 && <div className="profile-empty">No matches found for these filters.</div>}
            {matches.map((m) => {
              const hero = HEROES[m.hero_id];
              const rankB = getRankBadge(m.rank_tier);
              return (
                <div
                  key={m.match_id}
                  className={`profile-match-row ${m.result === 'win' ? 'is-win' : 'is-loss'}`}
                  onClick={() => navigate(`/matches/${m.match_id}`)}
                >
                  <img
                    className="profile-match-hero"
                    src={getHeroImage(m.hero_id)}
                    alt={hero?.localized_name || ''}
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                  <span className={`profile-match-result ${m.result === 'win' ? 'win' : 'loss'}`}>
                    {m.result === 'win' ? 'W' : 'L'}
                  </span>
                  <span className="profile-match-kda">{m.kills}/{m.deaths}/{m.assists}</span>
                  <div className="profile-match-gpm-bar-wrap" title={`${m.gpm ?? 0} GPM`}>
                    <div className="profile-match-gpm-bar" style={{ width: `${Math.min(100, ((m.gpm || 0) / 800) * 100)}%` }} />
                  </div>
                  {rankB ? (
                    <img src={rankB} alt="" className="profile-match-rank" />
                  ) : <span className="profile-match-rank-spacer" />}
                  <span className="profile-match-party">
                    {m.party_size && m.party_size > 1 ? (<><Users size={11} />{m.party_size}</>) : '—'}
                  </span>
                  <span className="profile-match-duration">{formatDuration(m.duration)}</span>
                  <span className="profile-match-time">{timeAgo(m.played_at)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="profile-trends-card glass-surface">
          <div className="profile-card-title-row">
            <div className="profile-card-title">Trends</div>
            <div className="profile-window-toggle">
              <button className={trendWindow === 25 ? 'active' : ''} onClick={() => setTrendWindow(25)}>25 Matches</button>
              <button className={trendWindow === 100 ? 'active' : ''} onClick={() => setTrendWindow(100)}>100</button>
            </div>
          </div>

          <Donut breakdown={trends?.position_breakdown || []} />

          <div className="profile-donut-legend">
            {(trends?.position_breakdown || []).map((b: any) => (
              <div key={b.position} className="profile-donut-legend-item">
                <span className="profile-donut-legend-dot" style={{ background: POSITION_COLORS[b.position] }} />
                {b.position_name} <span className="profile-donut-legend-count">{b.count}</span>
              </div>
            ))}
          </div>

          {(trends?.strip?.length ?? 0) > 0 && (
            <div className="profile-strip">
              {trends.strip.map((s: any, i: number) => (
                <span key={i} className={`profile-strip-dot ${s.result === 'win' ? 'win' : 'loss'}`} title={`${s.result === 'win' ? 'Win' : 'Loss'} — match ${s.match_id}`} />
              ))}
            </div>
          )}

          <div className="profile-trend-footer">
            <div>
              <div className="profile-trend-footer-label">Match Win Rate</div>
              <div className="profile-trend-footer-value">
                {trends?.winrate ?? 0}%
                {trends?.newer_half_winrate != null && trends?.older_half_winrate != null && (
                  <span className={trends.newer_half_winrate >= trends.older_half_winrate ? 'up' : 'down'}>
                    {trends.newer_half_winrate >= trends.older_half_winrate ? '▲' : '▼'}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="profile-trend-footer-label">Party Queue</div>
              <div className="profile-trend-footer-value">{trends?.party_pct ?? 0}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-heroes-card glass-surface">
        <div className="profile-card-title">Most Played Heroes</div>
        <div className="profile-heroes-list">
          {(topHeroes?.heroes || []).map((h: any) => (
            <div key={h.hero_id} className="profile-hero-row">
              <img src={h.hero_icon} alt={h.hero_name} className="profile-hero-icon" />
              <div className="profile-hero-info">
                <div className="profile-hero-name">{h.hero_name}</div>
                {h.position_name && <div className="profile-hero-position">{h.position_name}</div>}
              </div>
              <div className={`profile-hero-winrate ${h.winrate >= 50 ? 'good' : 'bad'}`}>{h.winrate}%</div>
              <div className="profile-hero-bar-wrap">
                <div className="profile-hero-bar" style={{ width: `${Math.min(100, (h.matches / ((topHeroes?.heroes?.[0]?.matches) || h.matches)) * 100)}%` }} />
              </div>
              <div className="profile-hero-matches">{h.matches}</div>
            </div>
          ))}
          {topHeroes && (topHeroes.heroes || []).length === 0 && <div className="profile-empty">No hero data for these filters.</div>}
        </div>
        {topHeroes?.pick_share_pct > 0 && (
          <div className="profile-card-footer">These {topHeroes.heroes.length} heroes comprise <span className="gold">{topHeroes.pick_share_pct}%</span> of your picks.</div>
        )}
      </div>
    </div>
  );
}
