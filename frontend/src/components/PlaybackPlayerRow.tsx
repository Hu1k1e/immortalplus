import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage, ITEMS } from '../lib/dota';
import { levelFromXp } from '../lib/heroLevel';
import { getHeroVitals } from '../lib/heroVitals';
import { resolveItemIdName } from '../lib/itemId';
import { purchaseLogOf } from './BuildsPanel';
import { interpAtTime, liveCount } from './LiveScoreboardPanel';

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

function VitalBar({ label, value, max, color, approximate }: { label: string; value: number; max: number; color: string; approximate?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      title={approximate ? `${label}: ${value}/${max} — real max (real hero stats + level), but the fill only tracks alive/dead: no timestamped combat-log data exists to track per-hit damage, so this isn't a real moment-to-moment curve.` : undefined}
    >
      <div style={{ flex: 1, height: '13px', borderRadius: '2px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${color}55`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.15s linear' }} />
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
          {Math.round(value)} / {max}
        </span>
      </div>
    </div>
  );
}

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

  // Real final inventory (item_0..5/backpack_0..2, resolved from numeric
  // ids) rather than "last N purchases" — an item not yet acquired as of
  // currentTime (matched against its real purchase_log timestamp) is
  // dimmed, same convention as the Post-Game Stats scrubber.
  const purchaseLog = purchaseLogOf(player);
  const acquiredAt = (name: string | null): number => {
    if (!name) return 0;
    const matches = purchaseLog.filter((e: any) => e.key === name);
    return matches.length ? (matches[matches.length - 1].time || 0) : 0;
  };
  const mainSlotNames = [0, 1, 2, 3, 4, 5].map((i) => resolveItemIdName(player[`item_${i}`]));
  const backpackNames = [0, 1, 2].map((i) => resolveItemIdName(player[`backpack_${i}`]));

  const deadStatus = getDeadStatus(player, currentTime);
  const isDead = deadStatus?.dead ?? false;
  const timeDeadSoFar = isDead && deadStatus?.deadSince != null ? currentTime - deadStatus.deadSince : 0;
  const vitals = getHeroVitals(player, level, !isDead);

  const StatCell = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{children}</div>
    </div>
  );

  return (
    <div className="glass-surface" style={{
      display: 'flex', gap: '0.8rem', padding: '0.7rem', borderRadius: 'var(--radius-md)',
      borderLeft: `4px solid ${teamColor}`, opacity: isDead ? 0.7 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Portrait + HP/MP + name */}
      <div style={{ width: '160px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          {hero && (
            <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{
              width: '100%', height: '90px', objectFit: 'cover', borderRadius: '6px',
              filter: isDead ? 'grayscale(100%) brightness(0.5)' : 'none',
            }} />
          )}
          <span style={{
            position: 'absolute', bottom: '-6px', left: '-6px', width: '24px', height: '24px', borderRadius: '50%',
            background: '#000', border: '2px solid rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
          }}>{level}</span>
          {isDead && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--dire-red)', fontWeight: 900, fontSize: '1.8rem', textShadow: '0 0 4px #000' }}>✕</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', background: 'rgba(0,0,0,0.85)', padding: '1px 5px', borderRadius: '3px' }}>Dead {fmtClock(timeDeadSoFar)}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: '0.35rem 0 0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </div>
        {vitals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <VitalBar label="HP" value={vitals.hp} max={vitals.maxHp} color="var(--radiant-green)" approximate={vitals.approximate} />
            <VitalBar label="MP" value={vitals.mana} max={vitals.maxMana} color="#4da6ff" approximate={vitals.approximate} />
          </div>
        ) : <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>HP/MP unavailable</div>}
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: nwDelta >= 0 ? teamColor : 'var(--text-muted)', marginTop: '3px' }}>{nwDelta >= 0 ? '+' : ''}{nwDelta} net worth</div>
      </div>

      {/* Labeled stats */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '0.5rem 0.4rem', alignContent: 'center', minWidth: '140px' }}>
        <StatCell label="K / D / A"><span style={{ color: 'var(--radiant-green)' }}>{kills}</span>/<span style={{ color: 'var(--dire-red)' }}>{deaths}</span>/<span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span></StatCell>
        <StatCell label="CS">{cs}</StatCell>
        <StatCell label="GPM / XPM">{gpm} / {xpm}</StatCell>
        <StatCell label="Heal">{heal || '-'}</StatCell>
        <StatCell label="Damage">{dmg || '-'}</StatCell>
        <StatCell label="Tower DMG">{td || '-'}</StatCell>
      </div>

      {/* Inventory: 6 main slots (2x3, real inventory layout) + backpack + gold */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
          {mainSlotNames.map((key, i) => {
            const taken = acquiredAt(key) <= currentTime;
            return (
              <div key={i} style={{ width: '28px', height: '20px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                {key && <img src={getItemImage(key)} alt={key} title={ITEMS[key]?.dname || key.replace(/_/g, ' ')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: taken ? 'none' : 'grayscale(100%) brightness(0.4)', opacity: taken ? 1 : 0.5 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {backpackNames.map((key, i) => {
            const taken = acquiredAt(key) <= currentTime;
            return (
              <div key={i} style={{ width: '20px', height: '15px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
                {key && <img src={getItemImage(key)} alt={key} title={ITEMS[key]?.dname || key} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: taken ? 'none' : 'grayscale(100%) brightness(0.4)', opacity: taken ? 1 : 0.5 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
          {Math.round(interpAtTime(player.gold_t, currentTime)).toLocaleString()}g
        </div>
      </div>
    </div>
  );
}
