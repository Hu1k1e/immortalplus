import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { HEROES } from '../lib/heroes';
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

function GoldIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#e2b742" stroke="#a87f1f" strokeWidth="1.5" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#7a5a12">$</text>
    </svg>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const gold = payload.find((p: any) => p.dataKey === 'gold')?.value ?? 0;
  const xp = payload.find((p: any) => p.dataKey === 'xp')?.value ?? 0;
  const goldRadiant = gold >= 0;
  const xpRadiant = xp >= 0;

  const Row = ({ isRadiant, value, unit }: { isRadiant: boolean; value: number; unit: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
      {isRadiant ? <IconRadiant style={{ width: 12, height: 12 }} /> : <IconDire style={{ width: 12, height: 12 }} />}
      <span style={{ fontWeight: 600 }}>{isRadiant ? 'Radiant' : 'Dire'}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{fmtK(value)} {unit}</span>
    </div>
  );

  return (
    <div style={{ background: '#1a1f26', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '0.78rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{formatClock(label)}</div>
      <Row isRadiant={goldRadiant} value={gold} unit="Gold" />
      <Row isRadiant={xpRadiant} value={xp} unit="XP" />
    </div>
  );
}

function KillDot({ time, label, pct, color, anchorLeft }: { time: number; label: string; pct: number; color: string; anchorLeft: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', left: `${pct}%`, top: '50%',
        transform: 'translate(-50%,-50%)', width: '6px', height: '6px', borderRadius: '50%',
        background: color, border: '1px solid rgba(0,0,0,0.5)', cursor: 'default',
      }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', marginBottom: '5px',
          left: anchorLeft ? 0 : 'auto', right: anchorLeft ? 'auto' : 0,
          background: 'rgba(20,20,24,0.97)', border: '1px solid var(--border-color)', borderRadius: '4px',
          padding: '0.3rem 0.5rem', fontSize: '0.68rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', zIndex: 30,
        }}>
          {label} <span style={{ color: 'var(--text-muted)' }}>@ {formatClock(time / 60)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Net Worth / XP advantage area chart, matching stratz.com's structure:
 * Radiant label+icon top-left, Dire label+icon top-right, a single
 * rectangular white/gold final-advantage box docked next to whichever team
 * actually leads (left if Radiant, right if Dire — never centered), a
 * filled area for net worth with a plain (unfilled) line for XP, a custom
 * tooltip naming whichever team currently leads each stat, and two
 * hoverable kill-event dot ribbons (Radiant kills above the chart, Dire
 * kills below) reading "who killed who". Extracted out of MatchTabs.tsx's
 * GraphsTab (which still renders it unchanged) so it can also be reused
 * next to the embedded Overview playback panel.
 */
export default function AdvantageGraph({ matchData, allPlayers, height = 400 }: { matchData: any; allPlayers?: any[]; height?: number }) {
  if (!matchData?.radiant_gold_adv || !matchData?.radiant_xp_adv) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Graph data not available.</div>;
  }

  let goldAdv = matchData.radiant_gold_adv;
  let xpAdv = matchData.radiant_xp_adv;
  if (typeof goldAdv === 'string') goldAdv = JSON.parse(goldAdv);
  if (typeof xpAdv === 'string') xpAdv = JSON.parse(xpAdv);

  const advData = goldAdv.map((val: number, idx: number) => ({
    time: idx,
    gold: val,
    xp: xpAdv[idx] || 0,
  }));

  const maxAdvVal = Math.max(1, ...advData.map((d: any) => Math.max(Math.abs(d.gold), Math.abs(d.xp))));

  const finalGold = goldAdv[goldAdv.length - 1] || 0;
  const finalXp = xpAdv[xpAdv.length - 1] || 0;
  const radiantLeads = (finalGold + finalXp) >= 0;

  const durationMinutes = Math.max(1, advData.length - 1);

  // Kill events split by acting team — radiant kills ribbon above the
  // chart, dire kills below, each dot hoverable with "who killed who".
  const radiantDots: { time: number; label: string }[] = [];
  const direDots: { time: number; label: string }[] = [];
  (allPlayers || []).forEach((p: any) => {
    let log = p.kills_log;
    if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
    if (!Array.isArray(log)) return;
    const killerHero = HEROES[p.hero_id];
    const killerName = killerHero?.name || 'Unknown';
    log.forEach((e: any) => {
      if (e?.time == null) return;
      const victimHero = Object.values(HEROES).find((h: any) => `npc_dota_hero_${h.img_name}` === e.key || h.img_name === e.key) as any;
      const label = `${killerName} killed ${victimHero?.name || 'an enemy'}`;
      (p.player_slot < 128 ? radiantDots : direDots).push({ time: e.time, label });
    });
  });

  const renderDotRibbon = (dots: { time: number; label: string }[], color: string) => (
    <div style={{ position: 'relative', height: '10px', margin: '0 30px' }}>
      {dots.map((d, i) => {
        const pct = Math.min(100, Math.max(0, (d.time / 60 / durationMinutes) * 100));
        return <KillDot key={i} time={d.time} label={d.label} pct={pct} color={color} anchorLeft={pct < 70} />;
      })}
    </div>
  );

  const AdvantageBox = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(226,183,66,0.4)', borderRadius: '4px',
      padding: '0.25rem 0.65rem',
    }}>
      {radiantLeads && <IconRadiant style={{ width: 14, height: 14, flexShrink: 0 }} />}
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>{fmtK(finalXp)} XP</span>
      <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
        <GoldIcon size={11} /> {fmtK(finalGold)} Gold
      </span>
      {!radiantLeads && <IconDire style={{ width: 14, height: 14, flexShrink: 0 }} />}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--radiant-green)', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
          <IconRadiant style={{ width: 16, height: 16 }} /> Radiant
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: radiantLeads ? 'flex-start' : 'flex-end', minWidth: 0 }}>
          {AdvantageBox}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--dire-red)', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
          Dire <IconDire style={{ width: 16, height: 16 }} />
        </div>
      </div>

      {allPlayers && radiantDots.length > 0 && renderDotRibbon(radiantDots, 'var(--radiant-green)')}

      <div style={{ width: '100%', height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={advData} margin={{ top: 4, right: 30, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" tickFormatter={(t) => t + ':00'} />
            <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(val) => Math.abs(val) > 1000 ? (Math.abs(val) / 1000).toFixed(1) + 'k' : Math.abs(val).toString()} domain={[-maxAdvVal, maxAdvVal]} />
            <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            <defs>
              <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="linear" dataKey="gold" stroke="var(--accent-gold)" strokeWidth={2} fill="url(#goldFill)" name="Gold" isAnimationActive={false} />
            <Area type="linear" dataKey="xp" stroke="#4da6ff" strokeWidth={1.5} fill="none" name="Experience" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {allPlayers && direDots.length > 0 && renderDotRibbon(direDots, 'var(--dire-red)')}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="16" height="8"><path d="M0 6 Q4 0 8 6 T16 6" stroke="#4da6ff" strokeWidth="1.5" fill="none" /></svg>
          Experience
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="16" height="8"><path d="M0 6 Q4 0 8 6 T16 6" stroke="var(--accent-gold)" strokeWidth="1.5" fill="none" /></svg>
          Gold
        </span>
      </div>
    </div>
  );
}
