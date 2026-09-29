import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks';
import { useLiveProfile } from '../../hooks/useLiveProfile';
import { getHeroImage, HEROES } from '../../lib/dota';
import { getRankBadge, getRankLabel } from '../../lib/rank';
import './SpotlightWidgets.css';

interface MatchRow {
  match_id: number;
  hero_id: number;
  result: 'win' | 'loss';
  kills: number; deaths: number; assists: number;
  gpm?: number; duration?: number; played_at?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Big, splash-art "hero card" showing the player's most recent match. */
export const LastMatchSpotlightWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const { data, loading } = useApiData<{ matches: MatchRow[] }>('/matches', { limit: 1 });
  const match = data?.matches?.[0];
  const hero = match ? HEROES[match.hero_id] : null;

  if (loading) return <div className="spotlight-card spotlight-loading animate-pulse" />;
  if (!match) return <div className="spotlight-card spotlight-empty"><span>No matches synced yet.</span></div>;

  const isWin = match.result === 'win';
  return (
    <div
      className={`spotlight-card hero-spotlight ${isWin ? 'is-win' : 'is-loss'}`}
      style={{ backgroundImage: `url(${getHeroImage(match.hero_id)})` }}
      onClick={() => navigate(`/matches/${match.match_id}`)}
      role="button"
    >
      <div className="hero-spotlight-scrim" />
      <div className="hero-spotlight-content">
        <div className="hero-spotlight-top">
          <span className={`hero-spotlight-result ${isWin ? 'win' : 'loss'}`}>{isWin ? 'Victory' : 'Defeat'}</span>
          <span className="hero-spotlight-time">{timeAgo(match.played_at)}</span>
        </div>
        <div className="hero-spotlight-bottom">
          <div className="hero-spotlight-name">{hero?.localized_name || 'Unknown Hero'}</div>
          <div className="hero-spotlight-stats">
            <span className="hero-spotlight-kda">{match.kills}/{match.deaths}/{match.assists}</span>
            <span className="hero-spotlight-dot">•</span>
            <span>{match.gpm ?? 0} GPM</span>
            <span className="hero-spotlight-dot">•</span>
            <span>{formatDuration(match.duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TopHero {
  hero_id: number; hero_name: string; matches: number; winrate: number;
}

/** Big splash card for the player's single most-played hero. */
export const TopHeroSpotlightWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const { data, loading } = useApiData<{ heroes: TopHero[] }>('/player/most-played-heroes', { limit: 1 });
  const hero = data?.heroes?.[0];

  if (loading) return <div className="spotlight-card spotlight-loading animate-pulse" />;
  if (!hero) return <div className="spotlight-card spotlight-empty"><span>No hero data yet.</span></div>;

  return (
    <div
      className="spotlight-card hero-spotlight hero-spotlight-neutral"
      style={{ backgroundImage: `url(${getHeroImage(hero.hero_id)})` }}
      onClick={() => navigate(`/meta/hero/${hero.hero_id}`)}
      role="button"
    >
      <div className="hero-spotlight-scrim" />
      <div className="hero-spotlight-content">
        <div className="hero-spotlight-top">
          <span className="hero-spotlight-badge">Most Played</span>
        </div>
        <div className="hero-spotlight-bottom">
          <div className="hero-spotlight-name">{hero.hero_name}</div>
          <div className="hero-spotlight-stats">
            <span>{hero.matches} matches</span>
            <span className="hero-spotlight-dot">•</span>
            <span className={hero.winrate >= 50 ? 'good' : 'bad'}>{hero.winrate}% WR</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Player identity card -- avatar, name, rank medal. */
export const PlayerIdentityWidget: ComponentType<{ instanceId: string }> = () => {
  const profile = useLiveProfile();
  const rankBadge = profile ? getRankBadge(profile.rank_tier) : null;
  const rankLabel = profile ? getRankLabel(profile.rank_tier) : null;

  return (
    <div className="spotlight-card identity-spotlight">
      <div className="identity-spotlight-glow" />
      <img
        className="identity-spotlight-avatar"
        src={profile?.avatar_url || '/logo.png'}
        alt=""
        onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
      />
      <div className="identity-spotlight-name">{profile ? (profile.persona_name || 'Player') : 'Loading…'}</div>
      {rankLabel && (
        <div className="identity-spotlight-rank">
          {rankBadge && <img src={rankBadge} alt="" />}
          <span>{rankLabel}</span>
        </div>
      )}
    </div>
  );
};

interface LaneRecord { safe_wins: number; safe_losses: number; off_wins: number; off_losses: number; }
interface PlayerTrends { lane_record: LaneRecord; party_pct: number; unranked_pct: number; winrate: number; }

export const LaneRecordWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useApiData<PlayerTrends>('/player/trends', { window: 50 });
  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  const lr = data?.lane_record;
  return (
    <div className="mini-stat-grid">
      <div className="mini-stat">
        <div className="mini-stat-label">Safe Lane</div>
        <div className="mini-stat-value">{lr ? `${lr.safe_wins}-${lr.safe_losses}` : '—'}</div>
      </div>
      <div className="mini-stat">
        <div className="mini-stat-label">Off Lane</div>
        <div className="mini-stat-value">{lr ? `${lr.off_wins}-${lr.off_losses}` : '—'}</div>
      </div>
      <div className="mini-stat">
        <div className="mini-stat-label">Party Queue</div>
        <div className="mini-stat-value">{data?.party_pct ?? 0}%</div>
      </div>
      <div className="mini-stat">
        <div className="mini-stat-label">Unranked</div>
        <div className="mini-stat-value">{data?.unranked_pct ?? 0}%</div>
      </div>
    </div>
  );
};
