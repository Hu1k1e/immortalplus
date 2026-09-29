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

function WeeklyRateChart({ points, valueKey, label, color, suffix = '%' }: {
  points: WeeklyRate[]; valueKey: 'win_rate' | 'pick_rate'; label: string; color: string; suffix?: string;
}) {
  const width = 300;
  const height = 90;
  const padding = 6;
  const values = points.map((p) => p[valueKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p[valueKey] - min) / range) * (height - padding * 2);
    return [x, y];
  });
  const pathD = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${coords[coords.length - 1][0].toFixed(1)},${height - padding} L${coords[0][0].toFixed(1)},${height - padding} Z`;

  return (
    <div className="hero-chart">
      <div className="hero-chart-label">{label}</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${valueKey})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill={color}>
            <title>{points[i][valueKey].toFixed(1)}{suffix}</title>
          </circle>
        ))}
      </svg>
      <div className="hero-chart-range">
        <span>{min.toFixed(1)}{suffix}</span>
        <span>{max.toFixed(1)}{suffix}</span>
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
              <div className="hero-chart-row">
                <WeeklyRateChart points={overview.weekly_rates} valueKey="win_rate" label="Win Rate" color="#51a445" />
                <WeeklyRateChart points={overview.weekly_rates} valueKey="pick_rate" label="Pick Rate" color="#e2b742" />
              </div>
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
