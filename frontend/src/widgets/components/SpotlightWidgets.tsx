import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks';
import { useLiveProfile } from '../../hooks/useLiveProfile';
import { getHeroImage, getHeroRenderImage, getHeroIcon, getItemImage } from '../../lib/dota';
import { resolveItemIdName } from '../../lib/itemId';
import { getRankBadge, getRankLabel } from '../../lib/rank';
import { computePerformanceScore } from '../../lib/performanceIndicator';
import api from '../../lib/api';
import './SpotlightWidgets.css';

interface MatchRow {
  match_id: number;
  hero_id: number;
  result: 'win' | 'loss';
  kills: number; deaths: number; assists: number;
  gpm?: number; duration?: number; played_at?: string;
}

interface MatchDetail extends MatchRow {
  player_slot: number;
  items: (number | null)[] | null;
  neutral_item: number | null;
  all_players: any[] | null;
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

/** <img> that tries the 3D hero-model render first, falling back to the
 * flat splash-art crop (and finally the small icon) if the render 404s --
 * Valve doesn't expose the render path anywhere in generated constants, so
 * this is the only safe way to use it. */
function HeroRenderImage({ heroId, className }: { heroId: number; className?: string }) {
  const [src, setSrc] = useState(() => getHeroRenderImage(heroId));
  const [stage, setStage] = useState(0);
  useEffect(() => { setSrc(getHeroRenderImage(heroId)); setStage(0); }, [heroId]);
  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={() => {
        if (stage === 0) { setStage(1); setSrc(getHeroImage(heroId)); }
        else if (stage === 1) { setStage(2); setSrc(getHeroIcon(heroId)); }
      }}
    />
  );
}

function useMatchDetail(matchId: number | null) {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!matchId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/matches/${matchId}`).then((res) => {
      if (!cancelled) setData(res.data);
    }).catch(() => { /* leave data null -- widget shows empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId]);
  return { data, loading };
}

function ItemRow({ items, neutralItem }: { items: (number | null)[] | null; neutralItem: number | null }) {
  const slots = items ?? [null, null, null, null, null, null];
  return (
    <div className="hero-spotlight-items">
      {slots.map((id, i) => {
        const name = resolveItemIdName(id);
        return (
          <div key={i} className="hero-spotlight-item-slot">
            {name && <img src={getItemImage(name)} alt="" />}
          </div>
        );
      })}
      <div className="hero-spotlight-item-slot hero-spotlight-item-slot-neutral">
        {resolveItemIdName(neutralItem) && <img src={getItemImage(resolveItemIdName(neutralItem)!)} alt="" />}
      </div>
    </div>
  );
}

function LineupRow({ allPlayers, mySlot }: { allPlayers: any[]; mySlot: number }) {
  const isRadiant = (slot: number) => slot < 128;
  const mine = allPlayers.filter((p) => isRadiant(p.player_slot) === isRadiant(mySlot)).sort((a, b) => a.player_slot - b.player_slot);
  const theirs = allPlayers.filter((p) => isRadiant(p.player_slot) !== isRadiant(mySlot)).sort((a, b) => a.player_slot - b.player_slot);

  return (
    <div className="hero-spotlight-lineup">
      <div className="hero-spotlight-lineup-team">
        {mine.map((p) => (
          <img
            key={p.player_slot}
            src={getHeroIcon(p.hero_id)}
            alt=""
            className={p.player_slot === mySlot ? 'is-self' : ''}
          />
        ))}
      </div>
      <span className="hero-spotlight-lineup-vs">vs</span>
      <div className="hero-spotlight-lineup-team">
        {theirs.map((p) => (
          <img key={p.player_slot} src={getHeroIcon(p.hero_id)} alt="" />
        ))}
      </div>
    </div>
  );
}

/** Big, splash-art "hero card" showing the player's most recent match. */
export const LastMatchSpotlightWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const { data: list, loading: listLoading } = useApiData<{ matches: MatchRow[] }>('/matches', { limit: 1 });
  const matchId = list?.matches?.[0]?.match_id ?? null;
  const { data: detail, loading: detailLoading } = useMatchDetail(matchId);
  const match = detail ?? list?.matches?.[0];

  if (listLoading || (matchId && detailLoading && !detail)) {
    return <div className="spotlight-card spotlight-loading animate-pulse" />;
  }
  if (!match) return <div className="spotlight-card spotlight-empty"><span>No matches synced yet.</span></div>;

  const isWin = match.result === 'win';
  const perf = detail?.all_players ? computePerformanceScore(
    detail.all_players.find((p: any) => p.player_slot === detail.player_slot),
    detail.all_players,
  ) : null;

  return (
    <div className="spotlight-card hero-spotlight-card">
      <div className="hero-spotlight-header" onClick={() => navigate(`/matches/${match.match_id}`)} role="button">
        <div>
          <div className="hero-spotlight-title">Last Match</div>
          <div className="hero-spotlight-subtitle">{timeAgo(match.played_at)}</div>
        </div>
      </div>

      <div className="hero-spotlight-render-box" onClick={() => navigate(`/matches/${match.match_id}`)} role="button">
        <HeroRenderImage heroId={match.hero_id} className="hero-spotlight-render" />
      </div>

      <div className="hero-spotlight-stat-row">
        <span className={`hero-spotlight-result-pill ${isWin ? 'win' : 'loss'}`}>{isWin ? 'WON' : 'LOST'}</span>
        <span className="hero-spotlight-kda">{match.kills} / {match.deaths} / {match.assists}</span>
        {perf && (
          <div className="hero-spotlight-perf">
            <span className={perf.score >= 0 ? 'good' : 'bad'}>{perf.score > 0 ? '+' : ''}{perf.score}</span>
            <div className="hero-spotlight-perf-bar">
              <div
                className={`hero-spotlight-perf-bar-fill ${perf.score >= 0 ? 'good' : 'bad'}`}
                style={{ width: `${Math.min(100, Math.abs(perf.score) * 2)}%`, marginLeft: perf.score < 0 ? 'auto' : 0 }}
              />
            </div>
          </div>
        )}
      </div>

      {detail && <ItemRow items={detail.items} neutralItem={detail.neutral_item} />}

      {detail?.all_players && detail.all_players.length === 10 && (
        <>
          <div className="hero-spotlight-divider" />
          <LineupRow allPlayers={detail.all_players} mySlot={detail.player_slot} />
        </>
      )}
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
    <div className="spotlight-card hero-spotlight-card" onClick={() => navigate(`/meta/hero/${hero.hero_id}`)} role="button">
      <div className="hero-spotlight-header">
        <div>
          <div className="hero-spotlight-title">Top Hero</div>
          <div className="hero-spotlight-subtitle">{hero.hero_name}</div>
        </div>
        <span className="hero-spotlight-badge">Most Played</span>
      </div>
      <div className="hero-spotlight-render-box">
        <HeroRenderImage heroId={hero.hero_id} className="hero-spotlight-render" />
      </div>
      <div className="hero-spotlight-stat-row hero-spotlight-stat-row-center">
        <span>{hero.matches} matches</span>
        <span className="hero-spotlight-dot">•</span>
        <span className={hero.winrate >= 50 ? 'good' : 'bad'}>{hero.winrate}% WR</span>
      </div>
    </div>
  );
};

/** Player identity card -- avatar, name, rank medal, recent form. */
export const PlayerIdentityWidget: ComponentType<{ instanceId: string }> = () => {
  const navigate = useNavigate();
  const profile = useLiveProfile();
  const rankBadge = profile ? getRankBadge(profile.rank_tier) : null;
  const rankLabel = profile ? getRankLabel(profile.rank_tier) : null;
  const { data: trends } = useApiData<{ winrate: number; strip: { match_id: number; result: string; hero_id: number; hero_icon: string }[] }>('/player/trends', { window: 10 });
  const strip = trends?.strip ?? [];
  const wins = strip.filter((s) => s.result === 'win').length;

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

      {strip.length > 0 && (
        <>
          <div className="identity-spotlight-form">
            <span className="identity-spotlight-form-record">{wins}W - {strip.length - wins}L</span>
            <span className="identity-spotlight-form-label">Last {strip.length} · {trends?.winrate ?? 0}% WR</span>
          </div>
          <div className="identity-spotlight-strip">
            {strip.map((s) => (
              <img
                key={s.match_id}
                className={`identity-spotlight-strip-icon ${s.result === 'win' ? 'win' : 'loss'}`}
                src={s.hero_icon}
                alt=""
                onClick={() => navigate(`/matches/${s.match_id}`)}
                role="button"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface LaneRecord { safe_wins: number; safe_losses: number; off_wins: number; off_losses: number; }
interface PlayerTrends { lane_record: LaneRecord; party_pct: number; unranked_pct: number; winrate: number; total: number; }

export const LaneRecordWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useApiData<PlayerTrends>('/player/trends', { window: 50 });
  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  if (!data || !data.total) return <div className="widget-chart-empty">No recent matches to compute lane/queue data from.</div>;
  const lr = data.lane_record;
  const hasLaneData = lr && (lr.safe_wins + lr.safe_losses + lr.off_wins + lr.off_losses) > 0;
  return (
    <div className="mini-stat-grid">
      <div className="mini-stat">
        <div className="mini-stat-label">Safe Lane</div>
        <div className="mini-stat-value">{hasLaneData ? `${lr.safe_wins}-${lr.safe_losses}` : 'No data'}</div>
      </div>
      <div className="mini-stat">
        <div className="mini-stat-label">Off Lane</div>
        <div className="mini-stat-value">{hasLaneData ? `${lr.off_wins}-${lr.off_losses}` : 'No data'}</div>
      </div>
      <div className="mini-stat">
        <div className="mini-stat-label">Party Queue</div>
        <div className="mini-stat-value">{data.party_pct}%</div>
      </div>
      <div className="mini-stat">
        <div className="mini-stat-label">Unranked</div>
        <div className="mini-stat-value">{data.unranked_pct}%</div>
      </div>
    </div>
  );
};
