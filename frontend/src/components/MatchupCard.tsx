import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import { getRankBadge } from '../lib/rank';
import { getRoleInfo } from '../lib/roles';
import { computePerformanceScore } from '../lib/performanceIndicator';

interface MatchupCardProps {
  player: any;
  allPlayers: any[];
  netWorthDelta: number; // this player's net worth minus their lane opponent's
  maxDelta: number; // for bar scaling within the whole matchup grid
  onClick?: () => void;
}

export default function MatchupCard({ player, allPlayers, netWorthDelta, maxDelta, onClick }: MatchupCardProps) {
  const hero = HEROES[player.hero_id];
  const isRadiant = player.player_slot < 128;
  const netWorth = player.net_worth ?? player.networth ?? 0;
  const rankBadge = getRankBadge(player.rank_tier);
  const role = getRoleInfo(player.lane_role);
  const perf = computePerformanceScore(player, allPlayers);

  const barPct = maxDelta > 0 ? Math.min(100, (Math.abs(netWorthDelta) / maxDelta) * 100) : 0;
  const barColor = netWorthDelta >= 0 ? (isRadiant ? 'var(--radiant-green)' : '#a855f7') : 'var(--text-muted)';

  return (
    <div
      className="card-interactive"
      onClick={onClick}
      style={{
        background: isRadiant ? 'rgba(81,164,69,0.06)' : 'rgba(194,53,43,0.06)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '0.6rem 0.8rem',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {hero && (
          <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '44px', height: '25px', objectFit: 'cover', borderRadius: '3px' }} />
        )}
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--text-primary)' }}>{player.kills ?? 0}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span style={{ color: 'var(--dire-red)' }}>{player.deaths ?? 0}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.7rem', color: netWorthDelta >= 0 ? barColor : 'var(--text-muted)', minWidth: '28px' }}>
          {netWorthDelta >= 0 ? '+' : ''}{Math.round(netWorthDelta)}
        </span>
        <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${barPct}%`, height: '100%', background: barColor }} />
        </div>
        <span
          title={`Relative performance percentile: ${perf.percentile}`}
          style={{ width: '8px', height: '8px', borderRadius: '50%', background: perf.color, flexShrink: 0 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {role ? (
          <span style={{ fontSize: '0.65rem', color: role.color, fontWeight: 700, letterSpacing: '0.03em' }}>{role.short}</span>
        ) : <span />}
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
          {netWorth >= 1000 ? `${(netWorth / 1000).toFixed(1)}k` : netWorth}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {rankBadge && <img src={rankBadge} alt="rank" style={{ width: '16px', height: '16px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </span>
      </div>
    </div>
  );
}
