import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage, ITEMS } from '../lib/dota';
import { levelFromXp } from '../lib/heroLevel';
import { getHeroVitals } from '../lib/heroVitals';
import { resolveItemIdName } from '../lib/itemId';
import { purchaseLogOf } from './BuildsPanel';
import { interpAtTime, liveCount } from './LiveScoreboardPanel';

function GoldIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#e2b742" stroke="#a87f1f" strokeWidth="1.5" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#7a5a12">$</text>
    </svg>
  );
}

function fmtClock(t: number) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function fmtK(n: number) {
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n)}`;
}

/** Real dead/respawn status from per-second position data (`pos_t.life_state`,
 * 0 = alive, 1/2 = dead) — only present when the deeper local parse ran.
 * Returns null (unknown) rather than guessing when that data is missing, so
 * the row falls back to always showing "alive" instead of a fabricated
 * dead state. */
export function getDeadStatus(player: any, currentTime: number): { dead: boolean; deadSince?: number; respawnAt?: number } | null {
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

/** Real HP/Mana (+ real cumulative hero-damage-dealt/healing-dealt/
 * tower-damage-dealt) from `player.vitals_t` (see
 * backend/services/vitals_parser.py — reconstructed from the real
 * combat-log, on-demand per match, not always present) — interpolates
 * between its ~2-second samples. Returns null when that data hasn't been
 * computed for this match yet, so the caller can fall back to the
 * max-only HP/MP placeholder and the older per-minute _t arrays instead of
 * showing nothing. `dmg`/`heal`/`td` are undefined (not 0) when a vitals_t
 * was computed before those fields existed, so the caller can still fall
 * back per-stat rather than treating an old payload as "genuinely zero". */
export function getRealVitals(player: any, currentTime: number): { hp: number; mana: number; maxHp: number; maxMana: number; dmg?: number; heal?: number; td?: number } | null {
  const v = player.vitals_t;
  if (!v?.time?.length) return null;
  let i0 = 0;
  for (let i = 0; i < v.time.length; i++) {
    if (v.time[i] <= currentTime) i0 = i; else break;
  }
  const i1 = Math.min(v.time.length - 1, i0 + 1);
  const t0 = v.time[i0], t1 = v.time[i1];
  const frac = t1 > t0 ? Math.min(1, Math.max(0, (currentTime - t0) / (t1 - t0))) : 0;
  const lerp = (arr: number[]) => (arr[i0] ?? 0) + ((arr[i1] ?? arr[i0] ?? 0) - (arr[i0] ?? 0)) * frac;
  const lerpOpt = (arr: number[] | undefined) => (Array.isArray(arr) && arr.length ? lerp(arr) : undefined);
  return {
    hp: lerp(v.hp), mana: lerp(v.mana), maxHp: lerp(v.max_hp), maxMana: lerp(v.max_mana),
    dmg: lerpOpt(v.dmg), heal: lerpOpt(v.heal), td: lerpOpt(v.td),
  };
}

function VitalBar({ label, value, max, color, approximate }: { label: string; value: number; max: number; color: string; approximate?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      title={approximate ? `${label}: ${value}/${max} — real max (real hero stats + level), but the fill only tracks alive/dead: no timestamped combat-log data exists to track per-hit damage, so this isn't a real moment-to-moment curve.` : undefined}
    >
      <div style={{ flex: 1, height: '17px', borderRadius: '3px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${color}55`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.15s linear' }} />
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
          {Math.round(value)} / {Math.round(max)}
        </span>
      </div>
    </div>
  );
}

export default function PlaybackPlayerRow({ player, currentTime }: { player: any; currentTime: number }) {
  const hero = HEROES[player.hero_id];
  const isRadiant = player.player_slot < 128;
  const teamColor = isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)';

  const xp = interpAtTime(player.xp_t, currentTime);
  const level = levelFromXp(xp);
  const minutesElapsed = Math.max(1 / 60, currentTime / 60);
  const gpm = Math.round(interpAtTime(player.gold_t, currentTime) / minutesElapsed);
  const xpm = Math.round(xp / minutesElapsed);
  const cs = Math.round(interpAtTime(player.lh_t, currentTime));
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
  const realVitals = getRealVitals(player, currentTime);
  const vitals = realVitals
    ? { hp: realVitals.hp, mana: realVitals.mana, maxHp: realVitals.maxHp, maxMana: realVitals.maxMana, approximate: false }
    : getHeroVitals(player, level, !isDead);

  // Heal/Hero Damage prefer the real per-second reconstruction (vitals_t,
  // regardless of the hp/mana real_mode — see vitals_parser.py) and fall
  // back to the older per-minute hero_healing_t/hero_damage_t (real when
  // a full local deep-parse populated them, but not always present).
  // Tower damage has no per-minute fallback anywhere in this app — no
  // "tower_damage_t" field has ever existed — so it only ever shows a
  // real value once vitals_t's "td" series exists, "-" otherwise.
  const heal = Math.round(realVitals?.heal ?? interpAtTime(player.hero_healing_t, currentTime));
  const dmg = Math.round(realVitals?.dmg ?? interpAtTime(player.hero_damage_t, currentTime));
  const td = realVitals?.td != null ? Math.round(realVitals.td) : null;

  const StatCell = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{children}</div>
    </div>
  );

  return (
    <div className="glass-surface" style={{
      display: 'flex', gap: '1rem', padding: '0.9rem', borderRadius: 'var(--radius-md)',
      borderLeft: `4px solid ${teamColor}`, opacity: isDead ? 0.7 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Portrait + HP/MP + name */}
      <div style={{ width: '195px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          {hero && (
            <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{
              width: '100%', height: '115px', objectFit: 'cover', borderRadius: '6px',
              filter: isDead ? 'grayscale(100%) brightness(0.5)' : 'none',
            }} />
          )}
          <span style={{
            position: 'absolute', bottom: '-7px', left: '-7px', width: '29px', height: '29px', borderRadius: '50%',
            background: '#000', border: '2px solid rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
          }}>{level}</span>
          {isDead && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--dire-red)', fontWeight: 900, fontSize: '2.1rem', textShadow: '0 0 4px #000' }}>✕</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', background: 'rgba(0,0,0,0.85)', padding: '1px 6px', borderRadius: '3px' }}>Dead {fmtClock(timeDeadSoFar)}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0.4rem 0 0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </div>
        {vitals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <VitalBar label="HP" value={vitals.hp} max={vitals.maxHp} color="var(--radiant-green)" approximate={vitals.approximate} />
            <VitalBar label="MP" value={vitals.mana} max={vitals.maxMana} color="#4da6ff" approximate={vitals.approximate} />
          </div>
        ) : <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>HP/MP unavailable</div>}
      </div>

      {/* Labeled stats */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '0.7rem 0.5rem', alignContent: 'center', minWidth: '170px' }}>
        <StatCell label="K / D / A"><span style={{ color: 'var(--radiant-green)' }}>{kills}</span>/<span style={{ color: 'var(--dire-red)' }}>{deaths}</span>/<span style={{ color: 'var(--text-secondary)' }}>{player.assists ?? 0}</span></StatCell>
        <StatCell label="CS">{cs}</StatCell>
        <StatCell label="GPM / XPM">{gpm} / {xpm}</StatCell>
        <StatCell label="Heal">{heal ? fmtK(heal) : '-'}</StatCell>
        <StatCell label="Hero Damage">{dmg ? fmtK(dmg) : '-'}</StatCell>
        <StatCell label="Tower DMG">{td ? fmtK(td) : '-'}</StatCell>
      </div>

      {/* Inventory: 6 main slots (2x3, real inventory layout) + backpack + gold */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          {mainSlotNames.map((key, i) => {
            const taken = acquiredAt(key) <= currentTime;
            return (
              <div key={i} style={{ width: '36px', height: '26px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                {key && <img src={getItemImage(key)} alt={key} title={ITEMS[key]?.dname || key.replace(/_/g, ' ')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: taken ? 'none' : 'grayscale(100%) brightness(0.4)', opacity: taken ? 1 : 0.5 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '3px' }}>
          {backpackNames.map((key, i) => {
            const taken = acquiredAt(key) <= currentTime;
            return (
              <div key={i} style={{ width: '26px', height: '19px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                {key && <img src={getItemImage(key)} alt={key} title={ITEMS[key]?.dname || key} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: taken ? 'none' : 'grayscale(100%) brightness(0.4)', opacity: taken ? 1 : 0.5 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
          <GoldIcon size={15} />
          {Math.round(interpAtTime(player.gold_t, currentTime)).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
