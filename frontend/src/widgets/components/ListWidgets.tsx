import type { ComponentType } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { useApiData, timeAgo, formatDuration } from '../hooks';
import { getHeroImage, HEROES } from '../../lib/dota';
import api from '../../lib/api';
import { TrendsRing, POSITION_COLORS, type HeroSeg, type PosSeg } from '../../components/TrendsRing';
import './ListWidgets.css';

interface MatchRow {
  match_id: number;
  hero_id: number;
  result: 'win' | 'loss';
  kills: number; deaths: number; assists: number;
  gpm?: number; duration?: number; played_at?: string;
}

export const RecentMatchesWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const { data, loading } = useApiData<{ matches: MatchRow[] }>('/matches', { limit: 8 });
  const matches = data?.matches ?? [];

  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  if (!matches.length) return <div className="widget-chart-empty">No matches synced yet.</div>;

  return (
    <div className="widget-list">
      {matches.map((m) => {
        const hero = HEROES[m.hero_id];
        return (
          <div key={m.match_id} className={`widget-list-row ${m.result === 'win' ? 'is-win' : 'is-loss'}`} onClick={() => navigate(`/matches/${m.match_id}`)}>
            <img className="widget-list-hero" src={getHeroImage(m.hero_id)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
            <div className="widget-list-main">
              <div className="widget-list-title">{hero?.localized_name || 'Unknown'}</div>
              <div className="widget-list-sub">{m.kills}/{m.deaths}/{m.assists} · {formatDuration(m.duration)}</div>
            </div>
            <span className={`widget-list-result ${m.result === 'win' ? 'win' : 'loss'}`}>{m.result === 'win' ? 'W' : 'L'}</span>
            <span className="widget-list-time">{timeAgo(m.played_at)}</span>
          </div>
        );
      })}
    </div>
  );
};

interface TopHero { hero_id: number; hero_name: string; hero_icon: string; matches: number; winrate: number; position_name?: string | null; }

export const MostPlayedHeroesWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useApiData<{ heroes: TopHero[] }>('/player/most-played-heroes', { limit: 6 });
  const heroes = data?.heroes ?? [];
  const maxMatches = heroes[0]?.matches || 1;

  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  if (!heroes.length) return <div className="widget-chart-empty">No hero data yet.</div>;

  return (
    <div className="widget-list">
      {heroes.map((h) => (
        <div key={h.hero_id} className="widget-list-row widget-hero-row">
          <img className="widget-list-hero-icon" src={h.hero_icon} alt="" />
          <div className="widget-list-main">
            <div className="widget-list-title">{h.hero_name}</div>
            <div className="widget-hero-bar-wrap"><div className="widget-hero-bar" style={{ width: `${Math.min(100, (h.matches / maxMatches) * 100)}%` }} /></div>
          </div>
          <span className={`widget-list-winrate ${h.winrate >= 50 ? 'good' : 'bad'}`}>{h.winrate}%</span>
          <span className="widget-list-time">{h.matches}g</span>
        </div>
      ))}
    </div>
  );
};

interface ActionItem { id: number; text: string; category?: string; difficulty?: string; priority?: number; }

export const ActionItemsWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useApiData<ActionItem[]>('/progress/action-items', { completed: false });
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const items = (data ?? []).filter((i) => !completed.has(i.id));

  const complete = async (id: number) => {
    setCompleted((prev) => new Set(prev).add(id));
    try { await api.put(`/progress/action-items/${id}/complete`); } catch { /* optimistic -- ignore failure */ }
  };

  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  if (!items.length) return <div className="widget-chart-empty">No open action items — nice work!</div>;

  return (
    <div className="widget-list">
      {items.map((item) => (
        <div key={item.id} className="widget-list-row widget-action-row" onClick={() => complete(item.id)}>
          <Circle size={16} className="widget-action-check" />
          <div className="widget-list-main">
            <div className="widget-list-title">{item.text}</div>
            {item.category && <div className="widget-list-sub">{item.category}{item.difficulty ? ` · ${item.difficulty}` : ''}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

interface PlayerTrendsFull {
  top_heroes: HeroSeg[];
  position_breakdown: PosSeg[];
}

export const TrendsRingWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const { data, loading } = useApiData<PlayerTrendsFull>('/player/trends', { window: 25 });

  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;

  return (
    <div className="widget-ring-wrap">
      <TrendsRing
        heroes={data?.top_heroes || []}
        positions={data?.position_breakdown || []}
        onHeroClick={(matchId) => navigate(`/matches/${matchId}`)}
        size={200}
      />
      <div className="widget-ring-legend">
        {(data?.position_breakdown || []).map((b) => (
          <div key={b.position} className="widget-ring-legend-item">
            <span className="widget-ring-legend-dot" style={{ background: POSITION_COLORS[b.position] }} />
            {b.position_name} <span className="widget-ring-legend-count">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface MetaHero { hero_id: number; hero_name: string; hero_icon: string; matches: number; winrate: number; tier: string; }

export const MetaTopHeroesWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const { data, loading } = useApiData<{ top_heroes: MetaHero[] }>('/meta/protracker', { position: 0 });
  const heroes = (data?.top_heroes ?? []).slice(0, 6);

  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  if (!heroes.length) return <div className="widget-chart-empty">Meta data not synced yet.</div>;

  return (
    <div className="widget-list">
      {heroes.map((h) => (
        <div key={h.hero_id} className="widget-list-row widget-hero-row" onClick={() => navigate(`/meta/hero/${h.hero_id}`)}>
          <img className="widget-list-hero-icon" src={h.hero_icon} alt="" />
          <div className="widget-list-main">
            <div className="widget-list-title">{h.hero_name}</div>
            <div className="widget-list-sub">{h.matches} matches</div>
          </div>
          <span className="widget-meta-tier" data-tier={h.tier}>{h.tier}</span>
          <span className={`widget-list-winrate ${h.winrate >= 50 ? 'good' : 'bad'}`}>{h.winrate}%</span>
        </div>
      ))}
    </div>
  );
};
