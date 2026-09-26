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

// Minimal glyphs standing in for Stratz's role/attack-type badges — not a
// literal asset match, just a same-shape-language approximation per lane role.
const ROLE_ICON_PATHS: Record<string, string> = {
  SAFE: 'M4 20 L16 8 M16 8 L13 8 M16 8 L16 11', // sword slash
  MID: 'M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z', // star
  OFF: 'M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z', // shield
  JNG: 'M12 3 C8 6 6 10 6 13 A6 6 0 0 0 18 13 C18 10 16 6 12 3 Z', // leaf/jungle
};

function RoleIcon({ role, size = 11 }: { role: { short: string; color: string }; size?: number }) {
  const path = ROLE_ICON_PATHS[role.short];
  if (!path) return <span style={{ width: size, height: size, borderRadius: '50%', background: role.color, display: 'inline-block' }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={role.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function GoldIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#e2b742" stroke="#a87f1f" strokeWidth="1.5" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#7a5a12">$</text>
    </svg>
  );
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
        flex: '1 1 0',
        minWidth: '84px',
        maxWidth: '120px',
      }}
    >
      {hero && (
        <div style={{ width: '100%', aspectRatio: '1 / 0.95', overflow: 'hidden' }}>
          <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', display: 'block' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.4rem 0.15rem' }}>
        <span style={{ fontSize: '0.62rem', color: netWorthDelta >= 0 ? (isRadiant ? 'var(--radiant-green)' : '#a855f7') : 'var(--text-muted)', flexShrink: 0 }}>
          {netWorthDelta >= 0 ? '+' : ''}{Math.round(netWorthDelta)}
        </span>
        <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${barPct}%`, height: '100%', background: barColor }} />
        </div>
      </div>

      {role && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.1rem 0' }} title={role.label}>
          <RoleIcon role={role} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '0.72rem', padding: '0.05rem 0' }}>
        <span style={{ color: 'var(--text-primary)' }}>{player.kills ?? 0}</span>
        <span style={{ color: 'var(--text-muted)' }}> / </span>
        <span style={{ color: 'var(--dire-red)' }}>{player.deaths ?? 0}</span>
        <span style={{ color: 'var(--text-muted)' }}> / </span>
        <span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--accent-gold)', padding: '0.1rem 0' }}>
        <GoldIcon />
        {netWorth >= 1000 ? `${(netWorth / 1000).toFixed(1)}k` : netWorth}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.25rem 0.3rem 0.4rem' }}>
        {rankBadge ? (
          <img src={rankBadge} alt="rank" style={{ width: '12px', height: '12px', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span title={`Performance percentile: ${perf.percentile}`} style={{ width: '6px', height: '6px', borderRadius: '50%', background: perf.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70px' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </span>
      </div>
    </div>
  );
}
