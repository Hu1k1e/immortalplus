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
  const barColor = netWorthDelta >= 0 ? (isRadiant ? 'var(--radiant-green)' : '#a855f7') : 'rgba(255,255,255,0.3)';

  return (
    <div
      className="card-interactive"
      onClick={onClick}
      style={{
        background: isRadiant ? 'rgba(81,164,69,0.05)' : 'rgba(194,53,43,0.05)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {hero && (
        <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '100%', height: '48px', objectFit: 'cover', display: 'block' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem 0.2rem' }}>
        <span style={{ fontSize: '0.68rem', color: netWorthDelta >= 0 ? (isRadiant ? 'var(--radiant-green)' : '#a855f7') : 'var(--text-muted)', minWidth: '30px' }}>
          {netWorthDelta >= 0 ? '+' : ''}{Math.round(netWorthDelta)}
        </span>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${barPct}%`, height: '100%', background: barColor }} />
        </div>
        <span
          title={`Relative performance percentile: ${perf.percentile}`}
          style={{ width: '8px', height: '8px', borderRadius: '50%', background: perf.color, flexShrink: 0 }}
        />
      </div>

      {role && (
        <div style={{ textAlign: 'center', padding: '0.15rem 0' }}>
          <span title={role.label} style={{ width: '9px', height: '9px', borderRadius: '50%', background: role.color, display: 'inline-block' }} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '0.78rem', padding: '0.1rem 0' }}>
        <span style={{ color: 'var(--text-primary)' }}>{player.kills ?? 0}</span>
        <span style={{ color: 'var(--text-muted)' }}> / </span>
        <span style={{ color: 'var(--dire-red)' }}>{player.deaths ?? 0}</span>
        <span style={{ color: 'var(--text-muted)' }}> / </span>
        <span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--accent-gold)', padding: '0.1rem 0' }}>
        {netWorth >= 1000 ? `${(netWorth / 1000).toFixed(1)}k` : netWorth}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.3rem 0.5rem 0.5rem' }}>
        {rankBadge && <img src={rankBadge} alt="rank" style={{ width: '15px', height: '15px', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </span>
      </div>
    </div>
  );
}
