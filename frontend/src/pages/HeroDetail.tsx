import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';
import { resolveItemIdName } from '../lib/itemId';
import './HeroDetail.css';

interface PositionRow {
  position: number;
  position_name: string;
  matches: number;
  winrate: number | null;
  d2pt_rating: number | null;
  pick_share: number;
}
interface HeroBreakdown {
  hero_id: number;
  hero_name: string;
  hero_icon: string;
  hero_image: string;
  total_matches: number;
  overall_winrate: number | null;
  positions: PositionRow[];
  most_popular_position: number | null;
}
interface AbilityEntry {
  ability_id: number;
  name: string | null;
  display_name: string | null;
  is_talent: boolean;
}
interface CoreItem {
  item_id: number;
  avg_minute: number;
}
interface WeeklyRate {
  window_start: number;
  matches: number;
  wins: number;
  win_rate: number;
  pick_rate: number;
}
interface HeroOverviewData {
  hero_id: number;
  position: number;
  matches: number;
  wins: number;
  win_rate: number | null;
  pick_rate: number | null;
  lane_advantage: number | null;
  meta_score: number | null;
  rating_rank: number | null;
  rating_cohort_size: number | null;
  role_pick_share: number | null;
  all_role_matches: number | null;
  starting_item_ids: number[];
  ability_sequence: AbilityEntry[];
  core_items: CoreItem[];
  weekly_rates: WeeklyRate[];
  updated_at: string | null;
}

function formatAge(iso: string | null): string {
  if (!iso) return 'never';
  const hours = (Date.now() - new Date(iso + 'Z').getTime()) / 3600000;
  if (hours < 0) return 'just now';
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${(hours / 24).toFixed(1)}d ago`;
}

function fmtWeekDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function WeeklyRateChart({ points }: { points: WeeklyRate[] }) {
  const width = 700;
  const height = 140;
  const padding = 14;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const winValues = points.map((p) => p.win_rate);
  const pickValues = points.map((p) => p.pick_rate);
  const winMin = Math.min(...winValues);
  const winRange = Math.max(...winValues) - winMin || 1;
  const pickMin = Math.min(...pickValues);
  const pickRange = Math.max(...pickValues) - pickMin || 1;

  const xFor = (i: number) => padding + (i / Math.max(1, points.length - 1)) * (width - padding * 2);
  const winYFor = (v: number) => height - padding - ((v - winMin) / winRange) * (height - padding * 2);
  const pickYFor = (v: number) => height - padding - ((v - pickMin) / pickRange) * (height - padding * 2);

  const winCoords = points.map((p, i) => [xFor(i), winYFor(p.win_rate)]);
  const pickCoords = points.map((p, i) => [xFor(i), pickYFor(p.pick_rate)]);
  const winPath = winCoords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const pickPath = pickCoords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const winArea = `${winPath} L${winCoords[winCoords.length - 1][0].toFixed(1)},${height - padding} L${winCoords[0][0].toFixed(1)},${height - padding} Z`;
  const slotWidth = (width - padding * 2) / points.length;

  return (
    <div className="hero-chart-wrap">
      <div className="hero-chart-legend">
        <span className="hero-chart-legend-item"><span className="hero-chart-dot" style={{ background: '#51a445' }} />Win Rate</span>
        <span className="hero-chart-legend-item"><span className="hero-chart-dot dashed" style={{ borderColor: '#e2b742' }} />Pick Rate</span>
      </div>
      <div className="hero-chart-svg-wrap">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="hero-chart-svg">
          <defs>
            <linearGradient id="hero-chart-win-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#51a445" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#51a445" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={winArea} fill="url(#hero-chart-win-grad)" />
          <path d={winPath} fill="none" stroke="#51a445" strokeWidth="2" />
          <path d={pickPath} fill="none" stroke="#e2b742" strokeWidth="2" strokeDasharray="5 4" />
          {hoverIdx !== null && (
            <line x1={xFor(hoverIdx)} y1={padding / 2} x2={xFor(hoverIdx)} y2={height - padding / 2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          )}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={xFor(i)} cy={winYFor(p.win_rate)} r={hoverIdx === i ? 4.5 : 2.5} fill="#51a445" className="hero-chart-point" />
              <circle cx={xFor(i)} cy={pickYFor(p.pick_rate)} r={hoverIdx === i ? 4.5 : 2.5} fill="#e2b742" className="hero-chart-point" />
              <rect
                x={xFor(i) - slotWidth / 2} y={0} width={slotWidth} height={height}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            </g>
          ))}
        </svg>
        {hoverIdx !== null && (
          <div
            className="hero-chart-tooltip"
            style={{
              left: `${(xFor(hoverIdx) / width) * 100}%`,
              transform: `translateX(${xFor(hoverIdx) / width > 0.7 ? '-100%' : '-8px'})`,
            }}
          >
            <div className="hero-chart-tooltip-date">{fmtWeekDate(points[hoverIdx].window_start)}</div>
            <div className="hero-chart-tooltip-row"><span className="dot" style={{ background: '#51a445' }} />Win rate <b>{points[hoverIdx].win_rate.toFixed(1)}%</b></div>
            <div className="hero-chart-tooltip-row"><span className="dot" style={{ background: '#e2b742' }} />Pick rate <b>{points[hoverIdx].pick_rate.toFixed(1)}%</b></div>
            <div className="hero-chart-tooltip-matches">{points[hoverIdx].matches.toLocaleString()} matches</div>
          </div>
        )}
      </div>
      <div className="hero-chart-x-axis">
        <span>{fmtWeekDate(points[0].window_start)}</span>
        <span>{fmtWeekDate(points[points.length - 1].window_start)}</span>
      </div>
    </div>
  );
}

export default function HeroDetail() {
  const { heroId } = useParams<{ heroId: string }>();
  const navigate = useNavigate();
  const id = Number(heroId);

  const [breakdown, setBreakdown] = useState<HeroBreakdown | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [overview, setOverview] = useState<HeroOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    setBreakdown(null);
    setOverview(null);
    api.get(`/meta/hero/${id}`).then((res) => {
      const d = res.data;
      if (d && typeof d === 'object' && Array.isArray(d.positions)) {
        setBreakdown(d);
        setPosition(d.most_popular_position || d.positions.find((p: PositionRow) => p.matches > 0)?.position || 1);
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!position) return;
    setOverviewLoading(true);
    setOverview(null);
    api.get(`/meta/hero/${id}/overview`, { params: { position } }).then((res) => {
      const d = res.data;
      if (d && typeof d === 'object' && typeof d.matches === 'number') setOverview(d);
    }).catch(() => {}).finally(() => setOverviewLoading(false));
  }, [id, position]);

  if (!breakdown) {
    return <p className="text-muted">Loading…</p>;
  }

  return (
    <div className="hero-detail-page">
      <button className="btn btn-secondary hero-detail-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Back to Meta
      </button>

      <div className="glass-surface hero-detail-header">
        <img
          src={getHeroImage(breakdown.hero_id)}
          alt={breakdown.hero_name}
          className="hero-detail-portrait"
          onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
        />
        <div className="hero-detail-title">
          <h1>{breakdown.hero_name}</h1>
          <span className="text-muted">7000+ MMR Β· {breakdown.total_matches.toLocaleString()} matches Β· {breakdown.overall_winrate ?? '—'}% WR</span>
        </div>
        <div className="hero-detail-role-tabs">
          {breakdown.positions.filter((p) => p.matches > 0).map((p) => (
            <button
              key={p.position}
              className={`hero-role-tab ${position === p.position ? 'active' : ''}`}
              onClick={() => setPosition(p.position)}
            >
              {breakdown.most_popular_position === p.position && <span className="hero-role-tab-badge">Most popular</span>}
              <span className="hero-role-tab-name">{p.position_name}</span>
              <span className="hero-role-tab-stats">
                {p.winrate != null ? `${p.winrate}%` : '—'} Β· {p.matches.toLocaleString()}
                {p.d2pt_rating != null && <> Β· {p.d2pt_rating}/100</>}
              </span>
            </button>
          ))}
        </div>
      </div>

      {overviewLoading && !overview ? (
        <p className="text-muted hero-detail-loading">Loading role data (fetched live from Dota2ProTracker the first time — may take a few seconds)…</p>
      ) : overview ? (
        <>
          <div className="hero-detail-stats-row">
            <div className="glass-surface hero-detail-stat-card">
              <div className="hero-detail-stat-label">D2PT Rating</div>
              <div className="hero-detail-stat-value">{overview.meta_score != null ? `${overview.meta_score.toFixed(0)}/100` : '—'}</div>
            </div>
            <div className="glass-surface hero-detail-stat-card">
              <div className="hero-detail-stat-label">Lane Advantage</div>
              <div className={`hero-detail-stat-value ${overview.lane_advantage != null ? (overview.lane_advantage >= 0 ? 'good' : 'bad') : ''}`}>
                {overview.lane_advantage != null ? `${overview.lane_advantage > 0 ? '+' : ''}${overview.lane_advantage}%` : '—'}
              </div>
            </div>
            <div className="glass-surface hero-detail-stat-card">
              <div className="hero-detail-stat-label">Role Pick Share</div>
              <div className="hero-detail-stat-value">{overview.role_pick_share != null ? `${overview.role_pick_share}%` : '—'}</div>
              {overview.all_role_matches != null && (
                <div className="hero-detail-stat-sub">of {overview.all_role_matches.toLocaleString()} total games</div>
              )}
            </div>
            <div className="glass-surface hero-detail-stat-card">
              <div className="hero-detail-stat-label">Rating Rank</div>
              <div className="hero-detail-stat-value">
                {overview.rating_rank != null ? `#${overview.rating_rank}` : '—'}
                {overview.rating_cohort_size ? <span className="hero-detail-stat-sub-inline"> / {overview.rating_cohort_size}</span> : null}
              </div>
            </div>
          </div>

          {overview.weekly_rates.length > 1 && (
            <div className="glass-surface hero-detail-chart-card">
              <h4>Pick &amp; Win Rate — last {overview.weekly_rates.length} weeks</h4>
              <WeeklyRateChart points={overview.weekly_rates} />
            </div>
          )}

          <div className="hero-detail-build-row">
            <div className="glass-surface hero-detail-build-card">
              <h4>
                Most-Played Build
                {overview.matches > 0 && (
                  <span className="hero-detail-build-meta"> — {overview.matches.toLocaleString()} matches Β· {overview.win_rate?.toFixed(1)}% WR</span>
                )}
              </h4>
              {overview.starting_item_ids.length > 0 && (
                <>
                  <div className="hero-detail-build-section-label">Starting Items</div>
                  <div className="hero-detail-item-row">
                    {overview.starting_item_ids.map((itemId, i) => {
                      const name = resolveItemIdName(itemId);
                      return name ? <img key={i} src={getItemImage(name)} alt="" className="hero-detail-item-icon" /> : null;
                    })}
                  </div>
                </>
              )}
              {overview.core_items.length > 0 && (
                <>
                  <div className="hero-detail-build-section-label">Core Items</div>
                  <div className="hero-detail-item-row">
                    {overview.core_items.map((ci, i) => {
                      const name = resolveItemIdName(ci.item_id);
                      if (!name) return null;
                      return (
                        <div key={i} className="hero-detail-core-item">
                          <img src={getItemImage(name)} alt="" className="hero-detail-item-icon" />
                          <span className="hero-detail-item-timing">{ci.avg_minute.toFixed(0)}m</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {overview.starting_item_ids.length === 0 && overview.core_items.length === 0 && (
                <p className="text-muted">No build data for this role yet.</p>
              )}
            </div>

            <div className="glass-surface hero-detail-build-card">
              <h4>Ability Order</h4>
              {overview.ability_sequence.length > 0 ? (
                <div className="hero-detail-ability-row">
                  {overview.ability_sequence.map((a, i) => (
                    <div key={i} className={`hero-detail-ability ${a.is_talent ? 'is-talent' : ''}`} title={a.display_name || ''}>
                      {a.is_talent ? (
                        <div className="hero-detail-talent-chip">{a.display_name}</div>
                      ) : a.name ? (
                        <img src={getAbilityImage(a.name)} alt={a.display_name || ''} />
                      ) : (
                        <div className="hero-detail-ability-unknown">?</div>
                      )}
                      <span className="hero-detail-ability-order">{i + 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No ability order data for this role yet.</p>
              )}
            </div>
          </div>

          {overview.updated_at && <p className="text-muted hero-detail-updated">Data updated {formatAge(overview.updated_at)}</p>}
        </>
      ) : (
        <p className="text-muted hero-detail-loading">No data available for this role yet.</p>
      )}
    </div>
  );
}
