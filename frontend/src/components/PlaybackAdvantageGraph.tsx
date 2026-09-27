import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import { IconRadiant, IconDire } from './Icons';

function fmtK(n: number) {
  return Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : `${Math.round(Math.abs(n))}`;
}
function formatClock(min: number) {
  const totalSec = Math.round(min * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface KillEvent { time: number; victimHeroId?: number; killerName: string; isRadiant: boolean }

/** A hero-portrait kill marker (the KILLED hero, not the killer — per
 * explicit request). Hovering snaps the chart to that exact data point:
 * a dashed reference line at the kill's time plus a floating box naming
 * who killed who and the real gold/XP swing around that minute (the
 * advantage curve's own change from the minute before to the minute of
 * the kill — real data, not a fabricated instantaneous value, since the
 * underlying radiant_gold_adv/xp_adv arrays are only ever per-minute). */
function KillMarker({ event, pct, color, anchorLeft, onHover }: { event: KillEvent; pct: number; color: string; anchorLeft: boolean; onHover: (e: KillEvent | null) => void }) {
  const victim = event.victimHeroId != null ? HEROES[event.victimHeroId] : null;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => { setHovered(true); onHover(event); }}
      onMouseLeave={() => { setHovered(false); onHover(null); }}
      style={{
        position: 'absolute', left: `${pct}%`, top: '50%',
        transform: 'translate(-50%,-50%)', width: '18px', height: '18px', borderRadius: '3px',
        border: `1.5px solid ${color}`, overflow: 'hidden', cursor: 'default', background: '#000',
        boxShadow: hovered ? `0 0 6px ${color}` : 'none', zIndex: hovered ? 20 : 1,
      }}
    >
      {victim && <img src={getHeroImage(victim.img_name)} alt={victim.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', marginBottom: '5px',
          left: anchorLeft ? 0 : 'auto', right: anchorLeft ? 'auto' : 0,
          background: 'rgba(20,20,24,0.97)', border: '1px solid var(--border-color)', borderRadius: '4px',
          padding: '0.3rem 0.5rem', fontSize: '0.68rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', zIndex: 30,
        }}>
          {event.killerName} killed {victim?.name || 'an enemy'} <span style={{ color: 'var(--text-muted)' }}>@ {formatClock(event.time / 60)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The Playback page's bottom graph: real gold/XP advantage over time with
 * a prominent moving position indicator synced to the shared playback
 * clock, and kill markers showing the KILLED hero's portrait. Hovering a
 * kill marker snaps the chart to that data point (dashed line + a swing
 * readout) — otherwise the same real data (radiant_gold_adv/radiant_xp_adv,
 * kills_log) the shared AdvantageGraph uses, laid out for this page
 * specifically so that component's other call sites (Laning, Graphs,
 * Towers panel) stay untouched.
 */
export default function PlaybackAdvantageGraph({ matchData, allPlayers, currentTime, height = 260 }: { matchData: any; allPlayers: any[]; currentTime: number; height?: number }) {
  const [hoveredKill, setHoveredKill] = useState<KillEvent | null>(null);

  if (!matchData?.radiant_gold_adv || !matchData?.radiant_xp_adv) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Graph data not available.</div>;
  }

  let goldAdv = matchData.radiant_gold_adv;
  let xpAdv = matchData.radiant_xp_adv;
  if (typeof goldAdv === 'string') goldAdv = JSON.parse(goldAdv);
  if (typeof xpAdv === 'string') xpAdv = JSON.parse(xpAdv);

  const advData = goldAdv.map((val: number, idx: number) => ({ time: idx, gold: val, xp: xpAdv[idx] || 0 }));
  const maxAdvVal = Math.max(1, ...advData.map((d: any) => Math.max(Math.abs(d.gold), Math.abs(d.xp))));
  const durationMinutes = Math.max(1, advData.length - 1);

  const radiantDots: KillEvent[] = [];
  const direDots: KillEvent[] = [];
  allPlayers.forEach((p: any) => {
    let log = p.kills_log;
    if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
    if (!Array.isArray(log)) return;
    const killerHero = HEROES[p.hero_id];
    const killerName = killerHero?.name || 'Unknown';
    const isRadiant = p.player_slot < 128;
    log.forEach((e: any) => {
      if (e?.time == null) return;
      const victim = Object.values(HEROES).find((h: any) => `npc_dota_hero_${h.img_name}` === e.key || h.img_name === e.key) as any;
      (isRadiant ? radiantDots : direDots).push({ time: e.time, victimHeroId: victim?.id, killerName, isRadiant });
    });
  });

  const renderDotRibbon = (dots: KillEvent[], color: string) => (
    <div style={{ position: 'relative', height: '20px', margin: '0 30px' }}>
      {dots.map((d, i) => {
        const pct = Math.min(100, Math.max(0, (d.time / 60 / durationMinutes) * 100));
        return <KillMarker key={i} event={d} pct={pct} color={color} anchorLeft={pct < 70} onHover={setHoveredKill} />;
      })}
    </div>
  );

  const currentMinute = currentTime / 60;

  // Real per-minute swing (the advantage curve's own change from the
  // minute before to the minute of the kill) — not a fabricated
  // instantaneous value, since the underlying data is per-minute anyway.
  let killSwing: { gold: number; xp: number } | null = null;
  let killMinute: number | null = null;
  if (hoveredKill) {
    killMinute = Math.min(durationMinutes, Math.floor(hoveredKill.time / 60));
    const cur = advData[killMinute];
    const prev = advData[Math.max(0, killMinute - 1)];
    if (cur && prev) killSwing = { gold: cur.gold - prev.gold, xp: cur.xp - prev.xp };
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--radiant-green)', fontWeight: 700, fontSize: '0.9rem' }}>
          <IconRadiant style={{ width: 18, height: 18 }} /> Radiant
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {hoveredKill && killSwing ? (
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>{hoveredKill.killerName}</strong> killed {hoveredKill.victimHeroId != null ? HEROES[hoveredKill.victimHeroId]?.name : 'an enemy'}
              {' '}@ {formatClock(hoveredKill.time / 60)} — swing that minute:{' '}
              <strong style={{ color: killSwing.gold >= 0 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>{killSwing.gold >= 0 ? '+' : '-'}{fmtK(killSwing.gold)} gold</strong>
              {', '}
              <strong style={{ color: killSwing.xp >= 0 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>{killSwing.xp >= 0 ? '+' : '-'}{fmtK(killSwing.xp)} xp</strong>
            </span>
          ) : 'Gold / XP Advantage'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--dire-red)', fontWeight: 700, fontSize: '0.9rem' }}>
          Dire <IconDire style={{ width: 18, height: 18 }} />
        </div>
      </div>

      {radiantDots.length > 0 && renderDotRibbon(radiantDots, 'var(--radiant-green)')}

      <div style={{ width: '100%', height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={advData} margin={{ top: 4, right: 30, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" tickFormatter={(t) => t + ':00'} />
            <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(val) => (Math.abs(val) > 1000 ? (Math.abs(val) / 1000).toFixed(1) + 'k' : Math.abs(val).toString())} domain={[-maxAdvVal, maxAdvVal]} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            {/* The moving playback-position bar — follows the shared clock */}
            <ReferenceLine x={currentMinute} stroke="var(--accent-gold)" strokeWidth={3} />
            {/* Snaps to whichever kill marker is currently hovered */}
            {killMinute != null && (
              <ReferenceLine x={killMinute} stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" />
            )}
            <defs>
              <linearGradient id="playbackGoldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="linear" dataKey="gold" stroke="var(--accent-gold)" strokeWidth={2} fill="url(#playbackGoldFill)" name="Gold" isAnimationActive={false} />
            <Area type="linear" dataKey="xp" stroke="#4da6ff" strokeWidth={1.5} fill="none" name="Experience" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {direDots.length > 0 && renderDotRibbon(direDots, 'var(--dire-red)')}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="16" height="8"><path d="M0 6 Q4 0 8 6 T16 6" stroke="#4da6ff" strokeWidth="1.5" fill="none" /></svg>
          Experience
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="16" height="8"><path d="M0 6 Q4 0 8 6 T16 6" stroke="var(--accent-gold)" strokeWidth="1.5" fill="none" /></svg>
          Gold
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '3px', background: 'var(--accent-gold)', display: 'inline-block' }} />
          Playback position
        </span>
      </div>
    </div>
  );
}
