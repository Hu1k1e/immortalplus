import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { levelFromXp } from '../lib/heroLevel';
import { interpAtTime, liveCount, liveItems } from './LiveScoreboardPanel';

function fmtClock(t: number) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Real dead/respawn status from per-second position data (`pos_t.life_state`,
 * 0 = alive, 1/2 = dead) — only present when the deeper local parse ran.
 * Returns null (unknown) rather than guessing when that data is missing, so
 * the row falls back to always showing "alive" instead of a fabricated
 * dead state. */
function getDeadStatus(player: any, currentTime: number): { dead: boolean; respawnAt?: number } | null {
  const pos = player.pos_t;
  if (!pos?.time?.length || !pos.life_state) return null;
  let idx = -1;
  for (let i = 0; i < pos.time.length; i++) {
    if ((pos.time[i] ?? 0) <= currentTime) idx = i; else break;
  }
  if (idx < 0) return { dead: false };
  if (!(pos.life_state[idx] > 0)) return { dead: false };
  for (let i = idx; i < pos.time.length; i++) {
    if (!(pos.life_state[i] > 0)) return { dead: true, respawnAt: pos.time[i] };
  }
  return { dead: true };
}

export default function PlaybackPlayerRow({ player, allPlayers, currentTime }: { player: any; allPlayers: any[]; currentTime: number }) {
  const hero = HEROES[player.hero_id];
  const isRadiant = player.player_slot < 128;
  const teamColor = isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)';

  const netWorth = interpAtTime(player.networth_t, currentTime) || interpAtTime(player.gold_t, currentTime);
  const teammates = allPlayers.filter((p) => (p.player_slot < 128) === isRadiant);
  const teamAvgNw = teammates.reduce((s, p) => s + (interpAtTime(p.networth_t, currentTime) || interpAtTime(p.gold_t, currentTime)), 0) / Math.max(1, teammates.length);
  const nwDelta = Math.round(netWorth - teamAvgNw);
  const maxAbsDelta = Math.max(1, ...allPlayers.map((p) => {
    const t2 = allPlayers.filter((x) => (x.player_slot < 128) === (p.player_slot < 128));
    const avg = t2.reduce((s, x) => s + (interpAtTime(x.networth_t, currentTime) || interpAtTime(x.gold_t, currentTime)), 0) / Math.max(1, t2.length);
    return Math.abs((interpAtTime(p.networth_t, currentTime) || interpAtTime(p.gold_t, currentTime)) - avg);
  }));

  const xp = interpAtTime(player.xp_t, currentTime);
  const level = levelFromXp(xp);
  const minutesElapsed = Math.max(1 / 60, currentTime / 60);
  const gpm = Math.round(interpAtTime(player.gold_t, currentTime) / minutesElapsed);
  const xpm = Math.round(xp / minutesElapsed);
  const cs = Math.round(interpAtTime(player.lh_t, currentTime));
  const heal = Math.round(interpAtTime(player.hero_healing_t, currentTime));
  const dmg = Math.round(interpAtTime(player.hero_damage_t, currentTime));
  const kills = liveCount(player, 'kills_log', currentTime);
  const deaths = liveCount(player, 'deaths_log', currentTime);
  const items = liveItems(player, currentTime);

  const deadStatus = getDeadStatus(player, currentTime);
  const isDead = deadStatus?.dead ?? false;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem',
      borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${teamColor}`,
      background: 'rgba(255,255,255,0.02)', opacity: isDead ? 0.6 : 1, transition: 'opacity 0.2s',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {hero && (
          <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{
            width: '52px', height: '30px', objectFit: 'cover', borderRadius: '4px',
            filter: isDead ? 'grayscale(100%) brightness(0.5)' : 'none',
          }} />
        )}
        <span style={{
          position: 'absolute', bottom: '-4px', left: '-4px', width: '17px', height: '17px', borderRadius: '50%',
          background: '#000', border: '1px solid rgba(255,255,255,0.4)', fontSize: '0.6rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
        }}>{level}</span>
        {isDead && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={deadStatus?.respawnAt != null ? `Respawns @ ${fmtClock(deadStatus.respawnAt)}` : 'Dead'}>
            <span style={{ color: 'var(--dire-red)', fontWeight: 900, fontSize: '1.1rem', textShadow: '0 0 3px #000' }}>✕</span>
          </div>
        )}
        {isDead && deadStatus?.respawnAt != null && (
          <span style={{ position: 'absolute', top: '-6px', right: '-6px', fontSize: '0.55rem', background: 'rgba(0,0,0,0.85)', color: 'var(--accent-gold)', padding: '1px 3px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
            {Math.max(0, Math.round(deadStatus.respawnAt - currentTime))}s
          </span>
        )}
      </div>

      <div style={{ width: '86px', flexShrink: 0 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: nwDelta >= 0 ? teamColor : 'var(--text-muted)', minWidth: '24px' }}>{nwDelta >= 0 ? '+' : ''}{nwDelta}</span>
          <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (Math.abs(nwDelta) / maxAbsDelta) * 100)}%`, height: '100%', background: nwDelta >= 0 ? teamColor : 'var(--text-muted)', marginLeft: nwDelta < 0 ? 'auto' : 0 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(28px, 1fr))', gap: '0.3rem', fontSize: '0.72rem', textAlign: 'center', flex: '1 1 auto', minWidth: '180px' }}>
        <span><span style={{ color: 'var(--radiant-green)' }}>{kills}</span>/<span style={{ color: 'var(--dire-red)' }}>{deaths}</span>/<span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span></span>
        <span>{cs}</span>
        <span>{gpm}</span>
        <span>{xpm}</span>
        <span style={{ color: heal ? 'var(--radiant-green)' : 'var(--text-muted)' }}>{heal || '-'}</span>
        <span>{dmg || '-'}</span>
      </div>

      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const key = items[i];
          return (
            <div key={i} style={{ width: '22px', height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
              {key && <img src={getItemImage(key)} alt={key} title={key.replace(/_/g, ' ')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
