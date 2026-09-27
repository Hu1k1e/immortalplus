import { useState, useMemo } from 'react';
import { HEROES } from '../lib/heroes';
import { getItemImage, getAbilityImage, ITEMS } from '../lib/dota';
import { getAbilityBuildOrder } from '../lib/talents';
import { purchaseLogOf } from './BuildsPanel';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const ITEM_ID_TO_NAME: Record<number, string> = {};
Object.entries(ITEMS).forEach(([name, data]: [string, any]) => {
  if (data?.id != null) ITEM_ID_TO_NAME[data.id] = name;
});

function formatClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function parseLog(log: any): any[] {
  let arr = log;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
  return Array.isArray(arr) ? arr : [];
}

function arrAt(arr: any, i: number): number | null {
  let a = arr;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return null; } }
  if (!Array.isArray(a) || a.length === 0) return null;
  return a.length > i ? a[i] : a[a.length - 1];
}

/** Real wards planted by `time <= maxTime` (obs_log/sen_log, per-placement
 * timestamps). Real wards destroyed BY this player is derived by scanning
 * every OTHER player's obs_left_log/sen_left_log for an entry whose
 * `attackername` matches this hero's npc name — that field distinguishes an
 * enemy kill from a natural ward expiry, both confirmed present in real
 * stored match data. */
function wardCounts(player: any, allPlayers: any[], maxTime: number) {
  const heroNpc = HEROES[player.hero_id] ? `npc_dota_hero_${HEROES[player.hero_id].img_name}` : null;
  const planted =
    parseLog(player.obs_log).filter((e) => (e.time ?? 0) <= maxTime).length +
    parseLog(player.sen_log).filter((e) => (e.time ?? 0) <= maxTime).length;
  let destroyed = 0;
  if (heroNpc) {
    allPlayers.forEach((op) => {
      if (op.player_slot === player.player_slot) return;
      parseLog(op.obs_left_log).forEach((e) => { if ((e.time ?? 0) <= maxTime && e.attackername === heroNpc) destroyed++; });
      parseLog(op.sen_left_log).forEach((e) => { if ((e.time ?? 0) <= maxTime && e.attackername === heroNpc) destroyed++; });
    });
  }
  return { planted, destroyed };
}

/** Fountain trips derived from real per-second position data (`pos_t`, only
 * present when the deeper local parse ran) — never available means "-",
 * never a guessed number. A player's own first recorded position stands in
 * for their fountain's location (all 10 players start there), and a trip is
 * counted each time their distance from it crosses back under a small
 * threshold after having gone far enough away — a documented proximity
 * heuristic on top of 100% real coordinates, not a fabricated stat. */
function fountainTrips(player: any, maxTime: number): number | null {
  const pos = player.pos_t;
  if (!pos?.time?.length || !pos.x?.length) return null;
  const originX = pos.x[0];
  const originY = pos.y[0];
  const NEAR = 6, FAR = 15;
  let near = true;
  let trips = 0;
  for (let i = 0; i < pos.time.length; i++) {
    if ((pos.time[i] ?? 0) > maxTime) break;
    const dx = (pos.x[i] ?? originX) - originX;
    const dy = (pos.y[i] ?? originY) - originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (near && dist > FAR) near = false;
    else if (!near && dist < NEAR) { trips++; near = true; }
  }
  return trips;
}

/** Real per-unit-type kill counts (the `killed` dict, final-game totals —
 * no time-sliced version of this field exists anywhere) bucketed into the
 * three creep categories Dota itself distinguishes. */
function creepTypeCounts(player: any) {
  const killed = player.killed || {};
  let melee = 0, ranged = 0, jungle = 0;
  Object.entries(killed).forEach(([key, val]: [string, any]) => {
    const c = Number(val) || 0;
    if (!c) return;
    if (key.includes('_creep_') && key.includes('melee')) melee += c;
    else if (key.includes('_creep_') && (key.includes('ranged') || key.includes('siege'))) ranged += c;
    else if (key.startsWith('npc_dota_neutral_')) jungle += c;
  });
  return { melee, ranged, jungle };
}

function Ring({ value, max, color, label, iconSrc }: { value: number; max: number; color: string; label: string; iconSrc: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }} title={label}>
      <div style={{ position: 'relative', width: '46px', height: '46px' }}>
        <svg width="100%" height="100%" viewBox="0 0 36 36">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', overflow: 'hidden', background: '#0a0a0a' }}>
          <img src={iconSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

const CREEP_ICON = {
  melee: '/assets/images/dota2/creeps/creep_goodguys_melee_model.png',
  ranged: '/assets/images/dota2/creeps/creep_goodguys_ranged_model.png',
  jungle: '/assets/images/dota2/creeps/neutral_satyr_hellcaller_model.png',
};

function FarmTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: '#1a1f26', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.72rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Farm @ {formatClock((label || 0) * 60)}</div>
      <div>Last Hits: <strong>{d?.lh ?? 0}</strong></div>
      <div>Denies: <strong>{d?.dn ?? 0}</strong></div>
    </div>
  );
}

export default function PerformancesExpandedUI({ player, allPlayers, matchData }: { player: any; allPlayers: any[]; matchData: any }) {
  const hero = HEROES[player.hero_id];
  const heroNpcName = hero ? `npc_dota_hero_${hero.img_name}` : undefined;

  const [scrubTime, setScrubTime] = useState(600);
  const minute = Math.min(10, Math.floor(scrubTime / 60));

  const abilityOrder = getAbilityBuildOrder(heroNpcName, player.ability_upgrades_arr).filter((a) => !a.isTalent);
  const abilityLevels = useMemo(() => {
    const counts = new Map<string, number>();
    const order: string[] = [];
    abilityOrder.forEach((a) => {
      if (!counts.has(a.name)) order.push(a.name);
      counts.set(a.name, (counts.get(a.name) || 0) + 1);
    });
    return order.slice(0, 6).map((name) => ({ name, level: counts.get(name) || 0 }));
  }, [abilityOrder]);

  const purchaseLog = purchaseLogOf(player);
  const acquiredTime = (name: string | null): number => {
    if (!name) return 0;
    const matches = purchaseLog.filter((e: any) => e.key === name);
    return matches.length ? (matches[matches.length - 1].time || 0) : 0;
  };
  const mainSlots = [0, 1, 2, 3, 4, 5].map((i) => ITEM_ID_TO_NAME[player[`item_${i}`]] || null);
  const neutralItem = ITEM_ID_TO_NAME[player.item_neutral] || null;
  const backpackSlots = [0, 1, 2].map((i) => ITEM_ID_TO_NAME[player[`backpack_${i}`]] || null);

  const { planted, destroyed } = wardCounts(player, allPlayers, scrubTime);
  const trips = fountainTrips(player, scrubTime);
  const stacks = arrAt(player.camps_stacked_t, minute) ?? player.camps_stacked ?? 0;
  const hd = arrAt(player.hero_damage_t, minute) ?? player.hero_damage ?? 0;
  const hh = arrAt(player.hero_healing_t, minute) ?? player.hero_healing ?? 0;
  const td = player.tower_damage || 0;

  const creep = creepTypeCounts(player);
  const maxCreep = Math.max(1, creep.melee, creep.ranged, creep.jungle);

  const farmData = Array.from({ length: 11 }, (_, m) => ({
    min: m,
    lh: arrAt(player.lh_t, m) ?? 0,
    dn: arrAt(player.dn_t, m) ?? 0,
  }));

  // Small heatmap thumbnail from the same real lane_pos density grid the
  // main Laning Map panel uses.
  const heatmapPoints = useMemo(() => {
    const pts: { x: number; y: number; count: number }[] = [];
    let max = 1;
    if (player?.lane_pos) {
      Object.entries(player.lane_pos).forEach(([xStr, yDict]: any) => {
        Object.entries(yDict).forEach(([yStr, count]: any) => {
          const cnt = Number(count);
          if (cnt > max) max = cnt;
          pts.push({ x: Number(xStr), y: Number(yStr), count: cnt });
        });
      });
    }
    return { pts, max };
  }, [player]);

  const renderItemSlot = (name: string | null, size: { w: number; h: number } = { w: 34, h: 24 }) => {
    const taken = acquiredTime(name) <= scrubTime;
    return (
      <div style={{ width: `${size.w}px`, height: `${size.h}px`, borderRadius: '3px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        {name && (
          <img
            src={getItemImage(name)}
            alt={name}
            title={`${ITEMS[name]?.dname || name}${acquiredTime(name) > 0 ? ` @ ${formatClock(acquiredTime(name))}` : ''}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: taken ? 'none' : 'grayscale(100%) brightness(0.4)', opacity: taken ? 1 : 0.5 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', background: '#0f1115', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
      {/* Left panel: skills + item build, scrubbable */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '230px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {abilityLevels.map(({ name, level }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
              <img src={getAbilityImage(name)} alt={name} title={name} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ display: 'flex', gap: '2px' }}>
                {[1, 2, 3, 4].map((l) => (
                  <div key={l} style={{ width: '4px', height: '4px', borderRadius: '50%', background: l <= Math.min(4, level) ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)' }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
            {mainSlots.map((name, i) => <div key={i}>{renderItemSlot(name)}</div>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div title="Neutral item">{renderItemSlot(neutralItem, { w: 30, h: 30 })}</div>
          </div>
        </div>
        {backpackSlots.some(Boolean) && (
          <div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Backpack</div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {backpackSlots.map((name, i) => <div key={i}>{renderItemSlot(name)}</div>)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>
          <span style={{ color: 'var(--text-secondary)', minWidth: '32px' }}>{formatClock(scrubTime)}</span>
          <input
            type="range" min={0} max={matchData?.duration || 600} value={scrubTime}
            onChange={(e) => setScrubTime(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-gold)' }}
          />
          <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: '32px', textAlign: 'right' }}>{formatClock(matchData?.duration || 600)}</span>
        </div>
      </div>

      <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }} />

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '320px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div>Wards Planted</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{planted}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div>Wards Destroyed</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{destroyed}</div>
          </div>
          <div style={{ textAlign: 'center' }} title="Derived from real per-second position data; shown only when that data exists for this match">
            <div>Fountain Trips</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{trips ?? '-'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div>Stacks</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{stacks}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div>HD</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.round(hd).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }} title="Full-game total — no time-sliced tower damage data exists in any available source">
            <div>TD</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{td.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div>HH</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.round(hh).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 260px', height: '140px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={farmData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="min" stroke="rgba(255,255,255,0.3)" tickFormatter={(m) => `${m}:00`} fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                <Tooltip content={<FarmTooltip />} />
                <Area type="monotone" dataKey="lh" stroke="#66bb6a" fill="#66bb6a33" strokeWidth={2} name="Last Hits" isAnimationActive={false} />
                <Area type="monotone" dataKey="dn" stroke="var(--dire-red)" fill="none" strokeWidth={1.5} name="Denies" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: '1 1 160px', height: '140px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <Ring value={creep.melee} max={maxCreep} color="#66bb6a" label="Melee creeps killed (full game)" iconSrc={CREEP_ICON.melee} />
            <Ring value={creep.ranged} max={maxCreep} color="var(--accent-gold)" label="Ranged creeps killed (full game)" iconSrc={CREEP_ICON.ranged} />
            <Ring value={creep.jungle} max={maxCreep} color="#4da6ff" label="Neutral/jungle creeps killed (full game)" iconSrc={CREEP_ICON.jungle} />
          </div>

          <div style={{ width: '120px', height: '140px', background: '#0a0a0a', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/minimap.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8, position: 'absolute', inset: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {heatmapPoints.pts.map((pt, i) => {
              const left = ((pt.x - 64) / 128) * 100;
              const top = (1 - (pt.y - 64) / 128) * 100;
              const intensity = pt.count / heatmapPoints.max;
              const hue = (1 - intensity) * 120;
              return (
                <div key={i} style={{
                  position: 'absolute', left: `${left}%`, top: `${top}%`, width: '10px', height: '10px',
                  transform: 'translate(-50%,-50%)', borderRadius: '50%',
                  background: `radial-gradient(circle, hsla(${hue},100%,50%,${intensity * 0.8 + 0.2}) 0%, transparent 70%)`,
                }} />
              );
            })}
            {heatmapPoints.pts.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No heatmap data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
