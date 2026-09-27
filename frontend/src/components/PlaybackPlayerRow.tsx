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
function getDeadStatus(player: any, currentTime: number): { dead: boolean; deadSince?: number; respawnAt?: number } | null {
  const pos = player.pos_t;
  if (!pos?.time?.length || !pos.life_state) return null;
  let idx = -1;
  for (let i = 0; i < pos.time.length; i++) {
    if ((pos.time[i] ?? 0) <= currentTime) idx = i; else break;
  }
  if (idx < 0) return { dead: false };
  if (!(pos.life_state[idx] > 0)) return { dead: false };
  let deadSince = pos.time[idx];
  for (let i = idx; i >= 0; i--) {
    if (pos.life_state[i] > 0) deadSince = pos.time[i]; else break;
  }
  for (let i = idx; i < pos.time.length; i++) {
    if (!(pos.life_state[i] > 0)) return { dead: true, deadSince, respawnAt: pos.time[i] };
  }
  return { dead: true, deadSince };
}

/** A labeled, honestly-empty bar for HP/Mana — real continuous HP/Mana
 * reconstruction is a separate, not-yet-built backend effort (no data
 * source available to this app has it yet), so this renders the slot the
 * layout calls for without fabricating numbers. Swap in real values here
 * once that pipeline exists. */
function VitalBarPlaceholder({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={`${label} — not available yet (HP/Mana reconstruction is a separate, not-yet-built effort)`}>
      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', width: '14px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: '5px', borderRadius: '2px', background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 6px)', border: `1px solid ${color}33` }} />
    </div>
  );
}

export const ROW_GRID = '2.3fr 0.85fr 0.6fr 0.6fr 0.6fr 3fr';
export const STAT_GRID = 'repeat(3, 1fr)';

export default function PlaybackPlayerRow({ player, allPlayers, currentTime }: { player: any; allPlayers: any[]; currentTime: number }) {
  const hero = HEROES[player.hero_id];
  const isRadiant = player.player_slot < 128;
  const teamColor = isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)';

  const netWorth = interpAtTime(player.networth_t, currentTime) || interpAtTime(player.gold_t, currentTime);
  const teammates = allPlayers.filter((p) => (p.player_slot < 128) === isRadiant);
  const teamAvgNw = teammates.reduce((s, p) => s + (interpAtTime(p.networth_t, currentTime) || interpAtTime(p.gold_t, currentTime)), 0) / Math.max(1, teammates.length);
  const nwDelta = Math.round(netWorth - teamAvgNw);

  const xp = interpAtTime(player.xp_t, currentTime);
  const level = levelFromXp(xp);
  const minutesElapsed = Math.max(1 / 60, currentTime / 60);
  const gpm = Math.round(interpAtTime(player.gold_t, currentTime) / minutesElapsed);
  const xpm = Math.round(xp / minutesElapsed);
  const cs = Math.round(interpAtTime(player.lh_t, currentTime));
  const heal = Math.round(interpAtTime(player.hero_healing_t, currentTime));
  const dmg = Math.round(interpAtTime(player.hero_damage_t, currentTime));
  const td = Math.round(interpAtTime(player.tower_damage_t, currentTime));
  const kills = liveCount(player, 'kills_log', currentTime);
  const deaths = liveCount(player, 'deaths_log', currentTime);
  const items = liveItems(player, currentTime);

  const deadStatus = getDeadStatus(player, currentTime);
  const isDead = deadStatus?.dead ?? false;
  const timeDeadSoFar = isDead && deadStatus?.deadSince != null ? currentTime - deadStatus.deadSince : 0;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: ROW_GRID, gap: '0.6rem', alignItems: 'center', padding: '0.6rem 0.7rem',
      borderRadius: 'var(--radius-sm)', borderLeft: `4px solid ${teamColor}`,
      background: 'rgba(255,255,255,0.02)', opacity: isDead ? 0.65 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Portrait + name + HP/MP + net worth delta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {hero && (
            <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{
              width: '92px', height: '52px', objectFit: 'cover', borderRadius: '6px',
              filter: isDead ? 'grayscale(100%) brightness(0.5)' : 'none',
            }} />
          )}
          <span style={{
            position: 'absolute', bottom: '-6px', left: '-6px', width: '22px', height: '22px', borderRadius: '50%',
            background: '#000', border: '2px solid rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
          }}>{level}</span>
          {isDead && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--dire-red)', fontWeight: 900, fontSize: '1.6rem', textShadow: '0 0 4px #000' }}>✕</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
            {player.persona || player.personaname || 'Anonymous'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '3px' }}>
            <VitalBarPlaceholder label="HP" color="var(--radiant-green)" />
            <VitalBarPlaceholder label="MP" color="#4da6ff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: nwDelta >= 0 ? teamColor : 'var(--text-muted)' }}>{nwDelta >= 0 ? '+' : ''}{nwDelta}</span>
          </div>
        </div>
      </div>

      <span style={{ textAlign: 'center', fontSize: '0.82rem' }}>
        <span style={{ color: 'var(--radiant-green)' }}>{kills}</span>/<span style={{ color: 'var(--dire-red)' }}>{deaths}</span>/<span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span>
      </span>
      <span style={{ textAlign: 'center', fontSize: '0.82rem' }}>{cs}</span>
      <span style={{ textAlign: 'center', fontSize: '0.82rem' }}>{gpm}<br /><span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{xpm}</span></span>
      <span style={{ textAlign: 'center', fontSize: '0.78rem' }}>
        <span style={{ color: heal ? 'var(--radiant-green)' : 'var(--text-muted)' }}>{heal || '-'}</span><br />
        <span>{dmg || '-'}</span><br />
        <span style={{ color: 'var(--text-muted)' }}>{td || '-'}</span>
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifySelf: 'end' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const key = items[i];
            return (
              <div key={i} style={{ width: '26px', height: '19px', background: 'rgba(0,0,0,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
                {key && <img src={getItemImage(key)} alt={key} title={key.replace(/_/g, ' ')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: '0.68rem', color: isDead ? 'var(--dire-red)' : 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>
          {isDead ? fmtClock(timeDeadSoFar) : '-'}
        </span>
      </div>
    </div>
  );
}
