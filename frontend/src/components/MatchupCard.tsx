import { useState } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import { getRankBadge } from '../lib/rank';
import { POSITION_INFO, getPlayerPosition } from '../lib/roles';
import { computePerformanceScore } from '../lib/performanceIndicator';
import PositionIcon from './PositionIcon';

interface MatchupCardProps {
  player: any;
  allPlayers: any[];
  onClick?: () => void;
}

function GoldIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#e2b742" stroke="#a87f1f" strokeWidth="1.5" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#7a5a12">$</text>
    </svg>
  );
}

export default function MatchupCard({ player, allPlayers, onClick }: MatchupCardProps) {
  const [hovered, setHovered] = useState(false);
  const hero = HEROES[player.hero_id];
  const isRadiant = player.player_slot < 128;
  const netWorth = player.net_worth ?? player.networth ?? 0;
  const rankBadge = getRankBadge(player.rank_tier);

  const teamPlayers = allPlayers.filter((p) => (p.player_slot < 128) === isRadiant);
  const posNum = getPlayerPosition(player, teamPlayers);
  const posInfo = posNum ? POSITION_INFO[posNum] : null;

  const perf = computePerformanceScore(player, allPlayers);
  const maxAbsScore = 50;
  const barPct = Math.min(100, (Math.abs(perf.score) / maxAbsScore) * 100);
  const barColor = perf.score >= 0 ? (isRadiant ? 'var(--radiant-green)' : '#a855f7') : 'rgba(255,255,255,0.3)';

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
        minWidth: '96px',
        maxWidth: '138px',
      }}
    >
      {hero && (
        <div style={{ width: '100%', aspectRatio: '1 / 0.95', overflow: 'hidden' }}>
          <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', display: 'block' }} />
        </div>
      )}

      <div
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.55rem 0.25rem' }}
        onMouseEnter={(e) => { e.stopPropagation(); setHovered(true); }}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{
          fontSize: '0.62rem', fontWeight: 700, flexShrink: 0, padding: '0.05rem 0.3rem', borderRadius: '3px',
          color: perf.score >= 0 ? (isRadiant ? 'var(--radiant-green)' : '#a855f7') : 'var(--text-muted)',
          background: perf.score >= 0 ? (isRadiant ? 'rgba(81,164,69,0.15)' : 'rgba(168,85,247,0.15)') : 'rgba(255,255,255,0.06)',
        }}>
          {perf.score >= 0 ? '+' : ''}{perf.score}
        </span>
        <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${barPct}%`, height: '100%', background: barColor }} />
        </div>
        {hovered && (
          <div style={{
            position: 'absolute', bottom: '100%', marginBottom: '4px',
            ...(isRadiant ? { left: 0 } : { right: 0 }),
            background: 'rgba(20,20,24,0.97)', border: '1px solid var(--border-color)', borderRadius: '4px',
            padding: '0.3rem 0.5rem', fontSize: '0.68rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', zIndex: 30,
          }}>
            {perf.label}
          </div>
        )}
      </div>

      {posInfo && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.2rem 0' }} title={posInfo.label}>
          <PositionIcon short={posInfo.short} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '0.76rem', padding: '0.15rem 0' }}>
        <span style={{ color: 'var(--text-primary)' }}>{player.kills ?? 0}</span>
        <span style={{ color: 'var(--text-muted)' }}> / </span>
        <span style={{ color: 'var(--dire-red)' }}>{player.deaths ?? 0}</span>
        <span style={{ color: 'var(--text-muted)' }}> / </span>
        <span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--accent-gold)', padding: '0.15rem 0' }}>
        <GoldIcon />
        {netWorth >= 1000 ? `${(netWorth / 1000).toFixed(1)}k` : netWorth}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.4rem 0.55rem' }}>
        {rankBadge ? (
          <img src={rankBadge} alt="rank" style={{ width: '16px', height: '16px', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: perf.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </span>
      </div>
    </div>
  );
}
