import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../lib/api';
import { HEROES, getHeroImage } from '../lib/dota';
import { getRankBadge, getRankLabel } from '../lib/rank';
import PositionIcon from '../components/PositionIcon';
import './Profile.css';

// Muted, desaturated tones (matched to the reference design) rather than
// this app's usual saturated gold/green/red accent palette — the ring is a
// dense multi-segment chart, so it reads better toned down.
const POSITION_COLORS: Record<number, string> = {
  1: '#c9a24b',
  2: '#5b8fa8',
  3: '#a85c4b',
  4: '#6a9b6e',
  5: '#8a6fa0',
};
const POSITION_SHORT: Record<number, string> = { 1: 'CARRY', 2: 'MID', 3: 'OFF', 4: 'SOFT4', 5: 'HARD5' };

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

const HERO_RING_COLORS = ['#c9a24b', '#5b8fa8', '#8a6fa0', '#a85c4b', '#6a9b6e', '#b98aa5', '#7d9bb0', '#a98f6b', '#6f8a63', '#9c7a9e', '#5f7d94', '#b07a5a'];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

type HeroSeg = { hero_id: number; hero_name: string; hero_icon: string; count: number; wins: number; winrate: number; match_id: number | null; positions: { position: number; position_name: string; count: number }[] };
type PosSeg = { position: number; position_name: string; count: number; wins: number; winrate: number };
type RingTooltip = { kind: 'hero'; data: HeroSeg } | { kind: 'position'; data: PosSeg };

function TrendsRing({
  heroes, positions, onHeroClick, size = 240,
}: {
  heroes: HeroSeg[];
  positions: PosSeg[];
  onHeroClick: (matchId: number) => void;
  size?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ info: RingTooltip; x: number; y: number } | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 20;
  const outerWidth = 26;
  const gap = 16;
  const innerR = outerR - outerWidth / 2 - gap - 12;
  const innerWidth = 24;

  const heroTotal = heroes.reduce((s, h) => s + h.count, 0);
  const outerCirc = 2 * Math.PI * outerR;
  let outerOffset = 0;
  const heroSegs = heroes.map((h) => {
    const frac = heroTotal ? h.count / heroTotal : 0;
    const seg = { ...h, frac, dash: frac * outerCirc, offset: outerOffset, midAngle: -90 + (outerOffset / outerCirc) * 360 + (frac * 360) / 2 };
    outerOffset += frac * outerCirc;
    return seg;
  });

  const posTotal = positions.reduce((s, p) => s + p.count, 0);
  const innerCirc = 2 * Math.PI * innerR;
  let innerOffset = 0;
  const posSegs = positions.map((p) => {
    const frac = posTotal ? p.count / posTotal : 0;
    const seg = { ...p, frac, dash: frac * innerCirc, offset: innerOffset };
    innerOffset += frac * innerCirc;
    return seg;
  });

  const iconSize = 22;

  const showTooltip = (e: React.MouseEvent, info: RingTooltip) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ info, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <div className="profile-donut-wrap" ref={wrapRef}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(226,183,66,0.03)" />
            <stop offset="100%" stopColor="rgba(226,183,66,0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={outerR + outerWidth / 2 + 6} fill="url(#ringGlow)" />
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={outerWidth} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={innerWidth} />

        {heroTotal === 0 && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--text-muted)">No data</text>
        )}

        {heroSegs.map((s, i) => (
          <circle
            key={s.hero_id}
            cx={cx} cy={cy} r={outerR}
            fill="none"
            stroke={HERO_RING_COLORS[i % HERO_RING_COLORS.length]}
            strokeOpacity={0.85}
            strokeWidth={outerWidth}
            strokeDasharray={`${s.dash} ${outerCirc - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="profile-ring-segment"
            onMouseEnter={(e) => showTooltip(e, { kind: 'hero', data: s })}
            onMouseMove={(e) => showTooltip(e, { kind: 'hero', data: s })}
            onMouseLeave={hideTooltip}
            onClick={() => s.match_id && onHeroClick(s.match_id)}
          />
        ))}

        {posSegs.map((s) => (
          <circle
            key={s.position}
            cx={cx} cy={cy} r={innerR}
            fill="none"
            stroke={POSITION_COLORS[s.position]}
            strokeOpacity={0.9}
            strokeWidth={innerWidth}
            strokeDasharray={`${s.dash} ${innerCirc - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="profile-ring-segment"
            onMouseEnter={(e) => showTooltip(e, { kind: 'position', data: s })}
            onMouseMove={(e) => showTooltip(e, { kind: 'position', data: s })}
            onMouseLeave={hideTooltip}
          />
        ))}

        {heroSegs.filter((s) => s.frac * 360 >= 12 && s.hero_icon).map((s) => {
          const [x, y] = polarPoint(cx, cy, outerR, s.midAngle);
          return (
            <g
              key={`icon-${s.hero_id}`}
              transform={`translate(${x - iconSize / 2}, ${y - iconSize / 2})`}
              className="profile-ring-hero-icon"
              onMouseEnter={(e) => showTooltip(e, { kind: 'hero', data: s })}
              onMouseMove={(e) => showTooltip(e, { kind: 'hero', data: s })}
              onMouseLeave={hideTooltip}
              onClick={() => s.match_id && onHeroClick(s.match_id)}
            >
              <circle cx={iconSize / 2} cy={iconSize / 2} r={iconSize / 2 + 1.5} fill="var(--bg-base)" />
              <image href={s.hero_icon} width={iconSize} height={iconSize} clipPath="circle(50%)" />
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="profile-ring-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: `translate(${tooltip.x > size / 2 ? '-100%' : '0'}, -50%) translateX(${tooltip.x > size / 2 ? '-14px' : '14px'})`,
          }}
        >
          {tooltip.info.kind === 'hero' ? (
            <>
              <div className="profile-ring-tooltip-header">
                <img src={tooltip.info.data.hero_icon} alt="" />
                <span>{tooltip.info.data.hero_name}</span>
              </div>
              <div className="profile-ring-tooltip-stats">
                <div>
                  <div className="profile-ring-tooltip-label">Record</div>
                  <div>{tooltip.info.data.wins}-{tooltip.info.data.count - tooltip.info.data.wins}</div>
                </div>
                <div>
                  <div className="profile-ring-tooltip-label">Winrate</div>
                  <div className={tooltip.info.data.winrate >= 50 ? 'good' : 'bad'}>{tooltip.info.data.winrate}%</div>
                </div>
                <div>
                  <div className="profile-ring-tooltip-label">Position</div>
                  <div className="profile-ring-tooltip-positions">
                    {tooltip.info.data.positions.length === 0 && <span>—</span>}
                    {tooltip.info.data.positions.slice(0, 2).map((p) => (
                      <span key={p.position} className="profile-ring-tooltip-pos" title={`${p.position_name}: ${p.count}`}>
                        <PositionIcon short={POSITION_SHORT[p.position]} size={12} color={POSITION_COLORS[p.position]} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="profile-ring-tooltip-header">
                <PositionIcon short={POSITION_SHORT[tooltip.info.data.position]} size={14} color={POSITION_COLORS[tooltip.info.data.position]} />
                <span>{tooltip.info.data.position_name}</span>
              </div>
              <div className="profile-ring-tooltip-stats">
                <div>
                  <div className="profile-ring-tooltip-label">Record</div>
                  <div>{tooltip.info.data.wins}-{tooltip.info.data.count - tooltip.info.data.wins}</div>
                </div>
                <div>
                  <div className="profile-ring-tooltip-label">Winrate</div>
                  <div className={tooltip.info.data.winrate >= 50 ? 'good' : 'bad'}>{tooltip.info.data.winrate}%</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
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
          <h1>{profile ? (profile.persona_name || 'Player') : 'Loading…'}</h1>
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
          <div className="profile-stat-label">
            Matches
            {summary?.first_match_at && (
              <span className="profile-stat-label-sub"> — since {new Date(summary.first_match_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="profile-stat-card glass-surface">
          <div className="profile-stat-value-row">
            <div className="profile-stat-value green">{summary?.winrate ?? 0}%</div>
            {summary && <div className="profile-stat-sub">{summary.wins} - {summary.losses}</div>}
          </div>
          <div className="profile-stat-label">Win Rate</div>
          {summary && (
            <div className="profile-winrate-bar">
              <div className="profile-winrate-bar-win" style={{ width: `${summary.winrate}%` }} />
            </div>
          )}
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

        <div className="profile-right-col">
          <div className="profile-trends-card glass-surface">
            <div className="profile-card-title-row">
              <div className="profile-card-title">Trends</div>
              <div className="profile-window-toggle">
                <button className={trendWindow === 25 ? 'active' : ''} onClick={() => setTrendWindow(25)}>25 Matches</button>
                <button className={trendWindow === 100 ? 'active' : ''} onClick={() => setTrendWindow(100)}>100</button>
              </div>
            </div>

            <TrendsRing
              heroes={trends?.top_heroes || []}
              positions={trends?.position_breakdown || []}
              onHeroClick={(matchId) => navigate(`/matches/${matchId}`)}
            />

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
                <div className="profile-trend-footer-label">Lane Record</div>
                <div className="profile-trend-footer-value profile-trend-footer-value-sm">
                  {trends?.lane_record ? `${trends.lane_record.safe_wins} - ${trends.lane_record.safe_losses} - ${trends.lane_record.off_wins} - ${trends.lane_record.off_losses}` : '—'}
                </div>
              </div>
              <div>
                <div className="profile-trend-footer-label">Party Queue</div>
                <div className="profile-trend-footer-value">{trends?.party_pct ?? 0}%</div>
              </div>
              <div>
                <div className="profile-trend-footer-label">Unranked</div>
                <div className="profile-trend-footer-value">{trends?.unranked_pct ?? 0}%</div>
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
      </div>
    </div>
  );
}
