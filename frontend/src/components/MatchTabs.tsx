import React, { useState } from 'react';
import { HEROES } from '../lib/heroes';
import abilitiesData from '../lib/constants/abilities.json';
import itemsData from '../lib/constants/items.json';
import { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Trophy } from 'lucide-react';

// ================ SHARED HELPERS ================
const fmt = (n: any, d = 0) => (n == null || isNaN(n)) ? '-' : Number(n).toFixed(d);
const fmtK = (n: any) => (n == null || isNaN(n)) ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const pct = (n: any) => (n == null || isNaN(n)) ? '-' : `${(n * 100).toFixed(2)}%`;

const PlayerCell = ({ p }: { p: any }) => {
  const hero = HEROES[p.hero_id];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '36px', height: '20px', objectFit: 'cover', borderRadius: '2px' }} />}
      <span style={{ fontSize: '0.85rem' }}>{p.persona || 'Anonymous'}</span>
    </div>
  );
};

const th: React.CSSProperties = { padding: '0.5rem 0.8rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '0.5rem 0.8rem', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' };

const TeamTable = ({ title, players, columns, winner }: { title: string; players: any[]; columns: { key: string; label: string; render: (p: any) => any }[]; winner?: boolean }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h3 style={{ color: title.includes('Radiant') ? 'var(--radiant-green)' : 'var(--dire-red)', marginBottom: '0.5rem' }}>
      {title} {winner && <span style={{ background: 'var(--radiant-green)', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '0.5rem' }}>WINNER</span>}
    </h3>
    <div className="glass-surface" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>PLAYER</th>{columns.map(c => <th key={c.key} style={{ ...th, textAlign: 'center' }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i} style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={td}><PlayerCell p={p} /></td>
              {columns.map(c => <td key={c.key} style={{ ...td, textAlign: 'center' }}>{c.render(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ================ BENCHMARKS TAB ================
export function BenchmarksTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const getBenchColor = (pct: number) => {
    if (pct < 0.25) return 'var(--dire-red)';
    if (pct >= 0.75) return 'var(--radiant-green)';
    return 'var(--accent-gold)';
  };

  const renderBench = (b: any, rawOverride?: any) => {
    if (!b) return '-';
    const pctStr = pct(b.pct);
    const color = getBenchColor(b.pct);
    const rawVal = rawOverride !== undefined ? rawOverride : fmt(b.raw, 2);
    return (
      <div title={`Bracket Percentile: ${pct(b.pct_bracket)}\nRaw Value: ${rawVal}`} style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', fontSize: '0.8rem' }}>
        <span style={{ color }}>{pctStr}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{rawVal}</span>
      </div>
    );
  };

  const benchCols = [
    { key: 'gpm', label: 'GPM', render: (p: any) => renderBench(p.benchmarks?.gold_per_min, p.gpm) },
    { key: 'xpm', label: 'XPM', render: (p: any) => renderBench(p.benchmarks?.xp_per_min, p.xpm) },
    { key: 'kpm', label: 'KPM', render: (p: any) => renderBench(p.benchmarks?.kills_per_min) },
    { key: 'dpm', label: 'DPM', render: (p: any) => renderBench(p.benchmarks?.deaths_per_min) },
    { key: 'aspm', label: 'ASPM', render: (p: any) => renderBench(p.benchmarks?.assists_per_min) },
    { key: 'lhm', label: 'LHM', render: (p: any) => renderBench(p.benchmarks?.last_hits_per_min) },
    { key: 'dnm', label: 'DNM', render: (p: any) => renderBench(p.benchmarks?.denies_per_min) },
    { key: 'hdm', label: 'HDM', render: (p: any) => renderBench(p.benchmarks?.hero_damage_per_min) },
    { key: 'hhm', label: 'HHM', render: (p: any) => renderBench(p.benchmarks?.hero_healing_per_min) },
    { key: 'td', label: 'TD', render: (p: any) => renderBench(p.benchmarks?.tower_damage, p.tower_damage) },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Benchmarks" players={radiant} columns={benchCols} winner={radiantWin} />
      <TeamTable title="Dire - Benchmarks" players={dire} columns={benchCols} winner={!radiantWin} />
    </div>
  );
}

// ================ PERFORMANCES TAB ================
export function PerformancesTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const parseMulti = (p: any) => {
    if (!p.multi_kills) return 0;
    const max = Math.max(0, ...Object.keys(p.multi_kills).map(Number));
    return max > 1 ? max : 0;
  };
  const parseStreak = (p: any) => {
    if (!p.kill_streaks) return 0;
    const max = Math.max(0, ...Object.keys(p.kill_streaks).map(Number));
    return max > 2 ? max : 0;
  };
  const parseStuns = (p: any) => p.stuns || 0;
  const parseStacked = (p: any) => p.camps_stacked || 0;
  const parseDead = (p: any) => p.life_state_dead || 0;
  const parseBuybacks = (p: any) => p.buyback_count || 0;
  const parsePings = (p: any) => p.pings || 0;
  const parseHit = (p: any) => p.max_hero_hit?.value || 0;

  const maxMulti = Math.max(...allPlayers.map(parseMulti));
  const maxStreak = Math.max(...allPlayers.map(parseStreak));
  const maxStuns = Math.max(...allPlayers.map(parseStuns));
  const maxStacked = Math.max(...allPlayers.map(parseStacked));
  const maxDead = Math.max(...allPlayers.map(parseDead));
  const maxBuybacks = Math.max(...allPlayers.map(parseBuybacks));
  const maxPings = Math.max(...allPlayers.map(parsePings));
  const maxHit = Math.max(...allPlayers.map(parseHit));

  const renderBar = (val: number, max: number, color: string, isTime = false, formatter?: (v: number) => string) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const pct = max > 0 ? (val / max) * 100 : 0;
    const displayVal = formatter ? formatter(val) : (isTime ? `${Math.floor(val/60)}:${(val%60).toString().padStart(2, '0')}` : fmt(val, val % 1 !== 0 ? 2 : 0));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '60px', margin: '0 auto' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{displayVal}</span>
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', borderRadius: '2px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
        </div>
      </div>
    );
  };

  const renderHit = (p: any) => {
    const val = parseHit(p);
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const hitColor = 'var(--accent-gold)';
    const pct = maxHit > 0 ? (val / maxHit) * 100 : 0;
    const targetHero = p.max_hero_hit?.key?.replace('npc_dota_hero_', '');
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '90px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{val}</span>
          {targetHero && <img src={getHeroImage(targetHero)} alt={targetHero} style={{ width: '32px', height: '18px', objectFit: 'cover', borderRadius: '2px' }} />}
        </div>
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', borderRadius: '2px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: hitColor, borderRadius: '2px' }} />
        </div>
      </div>
    );
  };

  const perfCols = [
    { key: 'multi', label: 'MULTI', render: (p: any) => renderBar(parseMulti(p), maxMulti, 'var(--radiant-green)') },
    { key: 'streak', label: 'STREAK', render: (p: any) => renderBar(parseStreak(p), maxStreak, '#66bb6a') },
    { key: 'stuns', label: 'STUNS', render: (p: any) => renderBar(parseStuns(p), maxStuns, '#42a5f5') },
    { key: 'stacked', label: 'STACKED', render: (p: any) => renderBar(parseStacked(p), maxStacked, 'var(--accent-gold)') },
    { key: 'dead', label: 'DEAD', render: (p: any) => renderBar(parseDead(p), maxDead, 'var(--dire-red)', true) },
    { key: 'buybacks', label: 'BUYBACKS', render: (p: any) => renderBar(parseBuybacks(p), maxBuybacks, '#ff9800') },
    { key: 'pings', label: 'PNG (M)', render: (p: any) => renderBar(parsePings(p), maxPings, '#ff9800') },
    { key: 'biggest_hit', label: 'BIGGEST HIT', render: (p: any) => renderHit(p) },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Performances" players={radiant} columns={perfCols} winner={radiantWin} />
      <TeamTable title="Dire - Performances" players={dire} columns={perfCols} winner={!radiantWin} />
    </div>
  );
}

// ================ LANING TAB ================
export function LaningTab({ allPlayers, radiantWin: _radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const getLaneName = (lane: number | null) => {
    switch (lane) { case 1: return 'Safe'; case 2: return 'Mid'; case 3: return 'Off'; default: return '-'; }
  };

  const laningCols = [
    { key: 'select', label: '', render: (p: any) => (
      <input 
        type="radio" 
        name="laning-select" 
        checked={selectedPlayer?.player_slot === p.player_slot} 
        onChange={() => setSelectedPlayer(p)} 
        style={{ cursor: 'pointer', accentColor: 'var(--accent-gold)' }} 
      />
    )},
    { key: 'side', label: 'SIDE', render: (p: any) => <span style={{ color: p.player_slot < 128 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>{p.player_slot < 128 ? 'Radiant' : 'Dire'}</span> },
    { key: 'lane', label: 'LANE', render: (p: any) => getLaneName(p.lane) },
    { key: 'win', label: 'WIN', render: (p: any) => {
        // Determine lane winner based on highest efficiency in their lane
        const lanePlayers = allPlayers.filter(x => x.lane === p.lane);
        if (lanePlayers.length < 2 || !p.lane) return '-';
        const maxEff = Math.max(...lanePlayers.map(x => x.lane_efficiency_pct || 0));
        const isWinner = (p.lane_efficiency_pct || 0) === maxEff && maxEff > 0;
        return isWinner ? <Trophy size={16} color="var(--accent-gold)" /> : <span style={{ color: 'var(--text-muted)' }}>-</span>;
    }},
    { key: 'cs_over_time', label: 'CS OVER TIME', render: (p: any) => {
        if (!p.lh_t || p.lh_t.length < 10) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
        
        // Find maximum CS (LH + DN) in any single minute for scaling
        let maxCs = 1;
        const minutes = [];
        for (let m = 1; m <= 10; m++) {
          const lh = (p.lh_t[m] || 0) - (p.lh_t[m-1] || 0);
          const dn = (p.dn_t[m] || 0) - (p.dn_t[m-1] || 0);
          minutes.push({ lh: Math.max(0, lh), dn: Math.max(0, dn) });
          maxCs = Math.max(maxCs, lh + dn);
        }

        return (
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '24px', gap: '2px', justifyContent: 'center' }}>
            {minutes.map((m, i) => {
               const lhHeight = (m.lh / maxCs) * 100;
               const dnHeight = (m.dn / maxCs) * 100;
               return (
                 <div key={i} title={`Min ${i+1}: ${m.lh} LH, ${m.dn} DN`} style={{ width: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                   <div style={{ height: `${dnHeight}%`, background: 'var(--dire-red)', width: '100%' }} />
                   <div style={{ height: `${lhHeight}%`, background: '#66bb6a', width: '100%' }} />
                 </div>
               );
            })}
          </div>
        );
    }},
    { key: 'eff', label: 'EFF@10', render: (p: any) => {
         const eff = p.lane_efficiency_pct ? p.lane_efficiency_pct : (p.lane_efficiency ? p.lane_efficiency * 100 : 0);
         if (!eff) return '-';
         return (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '100px', margin: '0 auto' }}>
              <span style={{ fontSize: '0.85rem' }}>{fmt(eff, 2)}%</span>
              <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                 <div style={{ width: `${Math.min(100, eff)}%`, height: '100%', background: '#66bb6a', borderRadius: '2px' }} />
              </div>
           </div>
         );
    }},
    { key: 'lh10', label: 'LH@10', render: (p: any) => {
         const lh = p.lh_t && p.lh_t.length > 10 ? p.lh_t[10] : (p.lh_t?.length > 0 ? p.lh_t[p.lh_t.length - 1] : 0);
         return (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
             <span>{lh}</span>
             <div style={{ width: '30px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
               <div style={{ width: `${Math.min(100, (lh/80)*100)}%`, height: '100%', background: 'var(--accent-gold)', borderRadius: '2px' }} />
             </div>
           </div>
         );
    }},
    { key: 'dn10', label: 'DN@10', render: (p: any) => {
         const dn = p.dn_t && p.dn_t.length > 10 ? p.dn_t[10] : 0;
         return (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
             <span>{dn}</span>
             <div style={{ width: '30px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
               <div style={{ width: `${Math.min(100, (dn/30)*100)}%`, height: '100%', background: 'var(--accent-gold)', borderRadius: '2px' }} />
             </div>
           </div>
         );
    }},
  ];

  // Prepare Heatmap Points for Selected Player
  let heatmapPoints: any[] = [];
  let maxHeat = 1;
  if (selectedPlayer && selectedPlayer.lane_pos) {
    Object.entries(selectedPlayer.lane_pos).forEach(([xStr, yDict]: any) => {
      Object.entries(yDict).forEach(([yStr, count]: any) => {
        const cnt = Number(count);
        if (cnt > maxHeat) maxHeat = cnt;
        heatmapPoints.push({ x: Number(xStr), y: Number(yStr), count: cnt });
      });
    });
  }

  // Prepare data for the LineChart (Last Hits + Denies over first 15 mins)
  const laningChartData = [];
  for (let m = 1; m <= 15; m++) {
    const dataPoint: any = { time: m };
    allPlayers.forEach(p => {
       const lh = p.lh_t && p.lh_t.length > m ? p.lh_t[m] : (p.lh_t && p.lh_t.length > 0 ? p.lh_t[p.lh_t.length - 1] : 0);
       const dn = p.dn_t && p.dn_t.length > m ? p.dn_t[m] : (p.dn_t && p.dn_t.length > 0 ? p.dn_t[p.dn_t.length - 1] : 0);
       dataPoint[`player_${p.player_slot}`] = lh + dn;
    });
    laningChartData.push(dataPoint);
  }

  const PLAYER_COLORS: Record<number, string> = {
    0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6B00',
    128: '#FE86C2', 129: '#A1B447', 130: '#65D9F7', 131: '#008321', 132: '#A46900'
  };

  return (
    <div className="animation-fade-in">
      <TeamTable title="All Players" players={allPlayers} columns={laningCols} />
      
      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        {/* Heatmap Section */}
        <div className="glass-surface" style={{ flex: '1 1 300px', maxWidth: '350px', padding: '1rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Laning Map</h3>
          {selectedPlayer ? (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <img src="/minimap.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
              {heatmapPoints.map((pt, i) => {
                 const left = ((pt.x - 64) / 128) * 100;
                 const top = (1 - ((pt.y - 64) / 128)) * 100;
                 const intensity = pt.count / maxHeat;
                 // Gradient: Red -> Yellow -> Green based on intensity (Dota style)
                 const hue = (1 - intensity) * 120;
                 return (
                   <div key={i} style={{
                     position: 'absolute',
                     left: `${left}%`, top: `${top}%`,
                     width: '16px', height: '16px',
                     transform: 'translate(-50%, -50%)',
                     borderRadius: '50%',
                     background: `radial-gradient(circle, hsla(${hue}, 100%, 50%, ${intensity * 0.8 + 0.2}) 0%, transparent 70%)`,
                     zIndex: 2,
                     pointerEvents: 'none'
                   }} />
                 );
              })}
            </div>
          ) : (
            <div style={{ width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>
              Select a player to view heatmap
            </div>
          )}
        </div>

        {/* Chart Section */}
        <div className="glass-surface" style={{ flex: '2 1 500px', padding: '1rem', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center', color: 'var(--text-primary)' }}>Last Hits + Denies (First 15 Minutes)</h3>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={laningChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" tickFormatter={(t) => `${t}:00`} />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                  labelFormatter={(t) => `Minute ${t}`}
                />
                <Legend formatter={(value) => {
                   const slot = parseInt(value.split('_')[1]);
                   const p = allPlayers.find(x => x.player_slot === slot);
                   return <span style={{ color: selectedPlayer?.player_slot === slot ? '#fff' : 'inherit', fontWeight: selectedPlayer?.player_slot === slot ? 'bold' : 'normal' }}>{p ? HEROES[p.hero_id as keyof typeof HEROES]?.name || `Player ${slot}` : value}</span>;
                }} />
                {allPlayers.map((p) => {
                  const isSelected = selectedPlayer?.player_slot === p.player_slot;
                  return (
                    <Line 
                      key={p.player_slot}
                      type="monotone" 
                      dataKey={`player_${p.player_slot}`} 
                      stroke={PLAYER_COLORS[p.player_slot] || 'var(--text-primary)'} 
                      strokeWidth={isSelected ? 4 : 2}
                      opacity={selectedPlayer && !isSelected ? 0.3 : 1}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================ COMBAT TAB ================
export function CombatTab({ allPlayers, radiantWin: _radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const getKills = (rp: any, cp: any) => {
    const cpImgName = HEROES[cp.hero_id as keyof typeof HEROES]?.img_name;
    const cpHeroKey = cpImgName ? `npc_dota_hero_${cpImgName}` : '';
    return rp.killed ? (rp.killed[cpHeroKey] || 0) : 0;
  };
  const getDmg = (rp: any, cp: any) => {
    const cpImgName = HEROES[cp.hero_id as keyof typeof HEROES]?.img_name;
    const cpHeroKey = cpImgName ? `npc_dota_hero_${cpImgName}` : '';
    return rp.damage ? (rp.damage[cpHeroKey] || 0) : 0;
  };

  const HeroMatrix = ({ title, allPlayers, getValue, isDamage = false }: any) => {
    return (
      <div style={{ flex: '1 1 45%', overflowX: 'auto', background: 'var(--bg-surface)', borderRadius: '4px', padding: '1rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', textAlign: 'center' }}>{title}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.2rem' }}></th>
              {allPlayers.map((cp: any) => (
                <th key={cp.hero_id} style={{ padding: '0.2rem', minWidth: '24px' }}>
                  <img src={getHeroImage(HEROES[cp.hero_id as keyof typeof HEROES]?.img_name || '')} alt={cp.hero_name} style={{ width: '28px', height: '16px', borderRadius: '2px' }} />
                </th>
              ))}
              <th style={{ padding: '0.2rem', color: 'var(--text-muted)' }}>SUM</th>
            </tr>
          </thead>
          <tbody>
            {allPlayers.map((rp: any) => {
              let sum = 0;
              const rpName = HEROES[rp.hero_id as keyof typeof HEROES]?.name || rp.hero_name;
              return (
                <tr key={rp.hero_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.2rem' }}>
                     <img src={getHeroImage(HEROES[rp.hero_id as keyof typeof HEROES]?.img_name || '')} alt={rpName} style={{ width: '28px', height: '16px', borderRadius: '2px', borderLeft: `3px solid ${rp.player_slot < 128 ? 'var(--radiant-green)' : 'var(--dire-red)'}` }} />
                  </td>
                  {allPlayers.map((cp: any) => {
                    const cpName = HEROES[cp.hero_id as keyof typeof HEROES]?.name || cp.hero_name;
                    const val = getValue(rp, cp);
                    sum += val;
                    const isSelf = rp.player_slot === cp.player_slot;
                    
                    return (
                      <td key={cp.hero_id} 
                        title={val > 0 ? `${rpName} → ${cpName}: ${isDamage ? fmtK(val) : val}` : undefined}
                        style={{ 
                          padding: '0.2rem', 
                          background: isSelf ? 'rgba(255,255,255,0.02)' : (val > 0 ? (isDamage ? 'rgba(255,152,0,0.1)' : 'rgba(102,187,106,0.1)') : 'transparent'), 
                          color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' 
                        }}>
                        {isSelf ? '' : (val > 0 ? (isDamage ? fmtK(val) : val) : '-')}
                      </td>
                    );
                  })}
                  <td style={{ padding: '0.2rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{isDamage ? fmtK(sum) : sum}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBar = (val: number, max: number, color: string, isTime = false, formatter?: (v: number) => string) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const pct = max > 0 ? (val / max) * 100 : 0;
    const displayVal = formatter ? formatter(val) : (isTime ? `${Math.floor(val/60)}:${(val%60).toString().padStart(2, '0')}` : fmt(val, val % 1 !== 0 ? 2 : 0));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '60px', margin: '0 auto' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{displayVal}</span>
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', borderRadius: '2px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
        </div>
      </div>
    );
  };

  const maxDeaths = Math.max(...allPlayers.map((p: any) => p.deaths || 0));
  const maxGoldLost = Math.max(...allPlayers.map((p: any) => p.deaths_log?.reduce((acc: number, d: any) => acc + (d.gold_lost || 0), 0) || 0));
  const maxDead = Math.max(...allPlayers.map((p: any) => p.life_state_dead || 0));

  const getDeathsCols = () => [
    { key: 'd', label: 'D', render: (p: any) => renderBar(p.deaths, maxDeaths, 'var(--dire-red)') },
    { key: 'gold_lost', label: 'GOLD LOST', render: (p: any) => {
         const gl = p.deaths_log?.reduce((acc: number, d: any) => acc + (d.gold_lost || 0), 0) || 0;
         return renderBar(gl, maxGoldLost, 'var(--accent-gold)', false, (v) => fmtK(v));
    } },
    { key: 'time_dead', label: 'TIME DEAD', render: (p: any) => renderBar(p.life_state_dead || 0, maxDead, '#66bb6a', true) },
    { key: 'killed_by', label: 'KILLED BY', render: (p: any) => {
        const log = p.deaths_log || [];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxWidth: '300px', padding: '0.5rem 0' }}>
            {log.map((d: any, i: number) => {
               const killer = d.key?.replace('npc_dota_hero_', '');
               const m = Math.floor(d.time / 60);
               const s = (d.time % 60).toString().padStart(2, '0');
               return (
                 <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                   {killer && !killer.includes('creep') && !killer.includes('neutral') && !killer.includes('tower') ? 
                     <img src={getHeroImage(killer)} alt={killer} style={{ width: '24px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} /> : 
                     <span style={{ height: '14px' }}>☠️</span>}
                   <span style={{ marginTop: '2px' }}>{`${m}:${s}`}</span>
                 </div>
               );
            })}
          </div>
        );
    }}
  ];

  const RichAbilityTooltip = ({ name, children, isItem = false }: any) => {
    const [show, setShow] = useState(false);
    const data = isItem ? (itemsData as any)[name.replace('item_', '')] : (abilitiesData as any)[name];

    return (
      <div 
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
        {show && data && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            background: '#1a1f26', border: '1px solid var(--border-color)', padding: '1rem',
            borderRadius: '4px', zIndex: 100, width: '320px', pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)', color: 'var(--text-primary)',
            textAlign: 'left', marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
               <img src={isItem ? getItemImage(name.replace('item_', '')) : getAbilityImage(name)} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
               <div>
                 <h4 style={{ margin: '0 0 0.5rem 0', color: '#e2b742', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{data.dname}</h4>
                 {data.dmg_type && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DAMAGE TYPE: <span style={{ color: '#fff' }}>{data.dmg_type}</span></div>}
                 {data.bkbpierce && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PIERCES DEBUFF IMMUNITY: <span style={{ color: data.bkbpierce === 'Yes' ? '#66bb6a' : '#ef5350' }}>{data.bkbpierce}</span></div>}
               </div>
            </div>
            {data.desc && <p style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '1rem', lineHeight: '1.4' }}>{data.desc}</p>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {data.attrib && data.attrib.map((a: any, i: number) => (
                 <div key={i} style={{ fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{a.header} </span>
                    <span style={{ color: '#fff' }}>{Array.isArray(a.value) ? a.value.join(' / ') : a.value}</span>
                 </div>
              ))}
            </div>
            
            {(data.mc || data.cd) && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {data.mc && <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#2196f3', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  <div style={{ width: '12px', height: '12px', background: '#2196f3', borderRadius: '2px' }} /> {Array.isArray(data.mc) ? data.mc.join('/') : data.mc}
                </div>}
                {data.cd && <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  ⏱️ {Array.isArray(data.cd) ? data.cd.join('/') : data.cd}
                </div>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAbilityDamage = (dmgDict: any) => {
    if (!dmgDict) return null;
    const sorted = Object.entries(dmgDict).sort((a: any, b: any) => b[1] - a[1]);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
        {sorted.map(([name, amount]: any, i: number) => (
          <RichAbilityTooltip key={i} name={name} isItem={name.includes('item_')}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '2px', cursor: 'help' }}>
              <img src={name.includes('item_') ? getItemImage(name.replace('item_', '')) : getAbilityImage(name)} alt={name} style={{ width: '20px', height: '20px', objectFit: 'cover' }} onError={(e) => e.currentTarget.style.display = 'none'} />
              <span style={{ fontSize: '0.65rem', marginTop: '2px', color: 'var(--text-muted)' }}>{fmtK(amount)}</span>
            </div>
          </RichAbilityTooltip>
        ))}
      </div>
    );
  };

  const renderDamageTargets = (targetsDict: any) => {
    if (!targetsDict) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    // Format: { "pudge_meat_hook": { "npc_dota_hero_nyx_assassin": 3135, ... } }
    // Calculate total per ability for sorting
    const abilities = Object.entries(targetsDict).map(([ability, heroes]: any) => {
      const total = Object.values(heroes).reduce((sum: any, val: any) => sum + val, 0) as number;
      return { ability, heroes, total };
    }).sort((a, b) => b.total - a.total);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
        {abilities.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '4px', width: '100%' }}>
            {/* Ability Icon + Total */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '60px' }}>
              <RichAbilityTooltip name={item.ability} isItem={item.ability.includes('item_')}>
                <img src={item.ability.includes('item_') ? getItemImage(item.ability.replace('item_', '')) : getAbilityImage(item.ability)} alt={item.ability} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px', cursor: 'help' }} onError={(e) => e.currentTarget.style.display = 'none'} />
              </RichAbilityTooltip>
              <span style={{ fontSize: '0.75rem', color: '#e2b742', fontWeight: 'bold' }}>{fmtK(item.total)}</span>
            </div>
            
            {/* Arrow */}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
            
            {/* Targets Breakdown */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {Object.entries(item.heroes)
                .sort((a: any, b: any) => b[1] - a[1])
                .map(([heroName, amount]: any, j: number) => {
                  const name = HEROES[Object.values(HEROES).find(h => h.img_name === heroName.replace('npc_dota_hero_', ''))?.id as number]?.name || heroName;
                  return (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '2px' }} title={`${name}: ${amount}`}>
                      <img src={getHeroImage(heroName.replace('npc_dota_hero_', ''))} alt={heroName} style={{ width: '20px', height: '12px', objectFit: 'cover', borderRadius: '2px' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                      <span style={{ fontSize: '0.65rem', marginTop: '1px', color: 'var(--text-muted)' }}>{fmtK(amount)}</span>
                    </div>
                  );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getDamageCols = () => [
    { key: 'dealt', label: 'DEALT', render: (p: any) => renderDamageTargets(p.damage_targets) },
    { key: 'received', label: 'RECEIVED', render: (p: any) => renderAbilityDamage(p.damage_inflictor_received) }
  ];

  return (
    <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 10x10 Matrices */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <HeroMatrix title="Kills" allPlayers={allPlayers} getValue={getKills} />
        <HeroMatrix title="Damage" allPlayers={allPlayers} getValue={getDmg} isDamage />
      </div>

      {/* Radiant Tables */}
      <TeamTable title="Radiant - Deaths" players={radiant} columns={getDeathsCols()} winner={_radiantWin} />
      <TeamTable title="Radiant - Damage" players={radiant} columns={getDamageCols()} winner={_radiantWin} />
      
      {/* Dire Tables */}
      <TeamTable title="Dire - Deaths" players={dire} columns={getDeathsCols()} winner={!_radiantWin} />
      <TeamTable title="Dire - Damage" players={dire} columns={getDamageCols()} winner={!_radiantWin} />
    </div>
  );
}

// ================ FARM TAB ================
export function FarmTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const maxHeroKills = Math.max(...allPlayers.map((p: any) => p.hero_kills || 0));
  const maxCreepKills = Math.max(...allPlayers.map((p: any) => p.lane_kills || 0));
  const maxNeutralKills = Math.max(...allPlayers.map((p: any) => p.neutral_kills || 0));
  const maxAncientKills = Math.max(...allPlayers.map((p: any) => p.ancient_kills || 0));
  const maxTowerKills = Math.max(...allPlayers.map((p: any) => p.tower_kills || 0));
  const maxCourierKills = Math.max(...allPlayers.map((p: any) => p.courier_kills || 0));
  const maxRoshanKills = Math.max(...allPlayers.map((p: any) => p.roshan_kills || 0));
  const maxObserverKills = Math.max(...allPlayers.map((p: any) => p.observer_kills || 0));
  const maxNecroKills = Math.max(...allPlayers.map((p: any) => p.necronomicon_kills || 0));

  const renderBar = (val: number, max: number, color: string) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const pct = max > 0 ? (val / max) * 100 : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '50px', margin: '0 auto' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{val}</span>
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', borderRadius: '2px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
        </div>
      </div>
    );
  };

  const unitCols = [
    { key: 'hero', label: 'HEROES', render: (p: any) => renderBar(p.hero_kills || 0, maxHeroKills, '#ff9800') },
    { key: 'creep', label: 'CREEPS', render: (p: any) => renderBar(p.lane_kills || 0, maxCreepKills, '#66bb6a') },
    { key: 'neutral', label: 'NEUTRALS', render: (p: any) => renderBar(p.neutral_kills || 0, maxNeutralKills, '#42a5f5') },
    { key: 'ancient', label: 'ANCIENTS', render: (p: any) => renderBar(p.ancient_kills || 0, maxAncientKills, 'var(--accent-gold)') },
    { key: 'tower', label: 'TOWERS', render: (p: any) => renderBar(p.tower_kills || 0, maxTowerKills, 'var(--radiant-green)') },
    { key: 'courier', label: 'COURIERS', render: (p: any) => renderBar(p.courier_kills || 0, maxCourierKills, 'var(--dire-red)') },
    { key: 'roshan', label: 'ROSHAN', render: (p: any) => renderBar(p.roshan_kills || 0, maxRoshanKills, '#ff9800') },
    { key: 'obs', label: 'OBSERVERS', render: (p: any) => renderBar(p.observer_kills || 0, maxObserverKills, '#66bb6a') },
    { key: 'necro', label: 'NECRONOMICON', render: (p: any) => renderBar(p.necronomicon_kills || 0, maxNecroKills, '#42a5f5') },
    { key: 'other', label: 'OTHER', render: (p: any) => {
        const others = (p.last_hits || 0) - ((p.lane_kills || 0) + (p.neutral_kills || 0));
        return renderBar(Math.max(0, others), Math.max(0, others), 'var(--text-muted)');
    }},
  ];

  const lhCols = [5, 10, 15, 20, 25, 30, 35, 40].map(min => ({
    key: `lh_${min}`,
    label: `${min}'`,
    render: (p: any) => {
      if (!p.lh_t || p.lh_t.length <= min) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
      const current = p.lh_t[min];
      const prev = p.lh_t.length > min - 5 ? p.lh_t[min - 5] : 0;
      const delta = current - prev;
      return (
        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
          <span style={{ color: 'var(--accent-gold)' }}>{current}</span>
          <span style={{ color: 'var(--text-muted)' }}>(+{delta})</span>
        </div>
      );
    }
  }));

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>Unit Kills</h2>
      <TeamTable title="Radiant - Unit Kills" players={radiant} columns={unitCols} winner={radiantWin} />
      <TeamTable title="Dire - Unit Kills" players={dire} columns={unitCols} winner={!radiantWin} />
      
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Last Hits</h2>
      <TeamTable title="Radiant - Last Hits" players={radiant} columns={lhCols} winner={radiantWin} />
      <TeamTable title="Dire - Last Hits" players={dire} columns={lhCols} winner={!radiantWin} />
    </div>
  );
}

// ================ ITEMS TAB ================
export function ItemsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const renderItemPhase = (p: any, startMin: number, endMin: number | null) => {
    const log = p.purchase_log || [];
    const filtered = log.filter((item: any) => {
      const mins = item.time / 60;
      if (endMin === null) return mins >= startMin;
      return mins >= startMin && mins < endMin;
    });

    if (!filtered.length) return <span style={{ color: 'var(--text-muted)' }}>-</span>;

    return (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', maxWidth: '350px', padding: '0.5rem 0' }}>
        {filtered.map((item: any, i: number) => {
          const itemName = item.key?.replace('item_', '') || '';
          if (itemName === 'tpscroll' && (startMin > 0)) return null; // Reduce clutter from TP scrolls late game
          
          const m = Math.floor(Math.abs(item.time || 0) / 60);
          const s = (Math.abs(item.time || 0) % 60).toString().padStart(2, '0');
          const prefix = (item.time || 0) < 0 ? '-' : '';
          
          return (
            <div key={i} title={itemName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '32px', height: '23px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
                <img src={getItemImage(itemName)} alt={itemName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <span style={{ marginTop: '2px' }}>{prefix}{m}:{s}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const itemsCols = [
    { key: 'starting', label: 'STARTING', render: (p: any) => renderItemPhase(p, -99, 10) },
    { key: 'early', label: 'EARLY', render: (p: any) => renderItemPhase(p, 10, 20) },
    { key: 'mid', label: 'MID', render: (p: any) => renderItemPhase(p, 20, 30) },
    { key: 'late', label: 'LATE', render: (p: any) => renderItemPhase(p, 30, null) },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Items" players={radiant} columns={itemsCols} winner={radiantWin} />
      <TeamTable title="Dire - Items" players={dire} columns={itemsCols} winner={!radiantWin} />
    </div>
  );
}

// ================ CASTS TAB ================
export function CastsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const renderAbilities = (p: any) => {
    const uses = p.ability_uses || {};
    const entries = Object.entries(uses).sort(([, a]: any, [, b]: any) => b - a).slice(0, 6);
    if (!entries.length) return <span style={{ color: 'var(--text-muted)' }}>No data</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {entries.map(([name, count]: any) => (
          <div key={name} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--accent-gold)' }}>{count}x</span>
            <img src={getAbilityImage(name)} alt={name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span style={{ color: 'var(--text-secondary)' }}>{name.replace(/_/g, ' ').replace(/^[a-z]+\s/, '')}</span>
          </div>
        ))}
      </div>
    );
  };

  const castsCols = [
    { key: 'abilities', label: 'ABILITY CASTS', render: renderAbilities },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Casts" players={radiant} columns={castsCols} winner={radiantWin} />
      <TeamTable title="Dire - Casts" players={dire} columns={castsCols} winner={!radiantWin} />
    </div>
  );
}

// ================ OBJECTIVES TAB ================
export function ObjectivesTab({ objectives, allPlayers }: { objectives: any[]; allPlayers: any[] }) {
  if (!objectives?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No objectives data available.</div>;

  const getHeroName = (slot: number) => {
    const p = allPlayers.find((x: any) => x.player_slot === slot);
    return p ? HEROES[p.hero_id]?.name || 'Unknown' : 'Unknown';
  };

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;

  const buildingKills = objectives.filter((o: any) => o.type === 'building_kill');
  const otherEvents = objectives.filter((o: any) => o.type !== 'building_kill');

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Objectives</h2>
      <div className="glass-surface" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Building Kills</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildingKills.map((o: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-gold)', minWidth: '50px' }}>{formatTime(o.time)}</span>
              <span>{o.key?.replace('npc_dota_', '').replace(/_/g, ' ')}</span>
              {o.player_slot != null && <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>by {getHeroName(o.player_slot)}</span>}
            </div>
          ))}
        </div>
      </div>
      {otherEvents.length > 0 && (
        <div className="glass-surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Other Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {otherEvents.map((o: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <span style={{ color: 'var(--accent-gold)', minWidth: '50px' }}>{formatTime(o.time)}</span>
                <span>{o.type?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================ VISION TAB ================
export function VisionTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const visionCols = [
    { key: 'obs', label: 'OBS PLACED', render: (p: any) => p.obs_placed || 0 },
    { key: 'sen', label: 'SEN PLACED', render: (p: any) => p.sen_placed || 0 },
    { key: 'obs_log', label: 'OBS COUNT', render: (p: any) => p.obs_log?.length || 0 },
    { key: 'sen_log', label: 'SEN COUNT', render: (p: any) => p.sen_log?.length || 0 },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Vision" players={radiant} columns={visionCols} winner={radiantWin} />
      <TeamTable title="Dire - Vision" players={dire} columns={visionCols} winner={!radiantWin} />
    </div>
  );
}

// ================ ACTIONS TAB ================
export function ActionsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const actionCols = [
    { key: 'apm', label: 'APM', render: (p: any) => p.actions_per_min || '-' },
    { key: 'pings', label: 'PINGS', render: (p: any) => p.pings || '-' },
    { key: 'runes', label: 'RUNE PICKUPS', render: (p: any) => p.rune_pickups || 0 },
    { key: 'stacked', label: 'CAMPS STACKED', render: (p: any) => p.camps_stacked || 0 },
    { key: 'creeps', label: 'CREEPS STACKED', render: (p: any) => p.creeps_stacked || 0 },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Actions" players={radiant} columns={actionCols} winner={radiantWin} />
      <TeamTable title="Dire - Actions" players={dire} columns={actionCols} winner={!radiantWin} />
    </div>
  );
}

// ================ TEAMFIGHTS TAB ================
export function TeamfightsTab({ teamfights, allPlayers }: { teamfights: any[]; allPlayers: any[] }) {
  if (!teamfights?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No teamfight data available.</div>;

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Teamfights ({teamfights.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {teamfights.map((tf: any, idx: number) => (
          <div key={idx} className="glass-surface" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Teamfight #{idx + 1}</h3>
              <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
                <span>⏱ {formatTime(tf.start)} - {formatTime(tf.end)}</span>
                <span>💀 {tf.deaths} deaths</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>PLAYER</th>
                    <th style={{ ...th, textAlign: 'center' }}>DMG</th>
                    <th style={{ ...th, textAlign: 'center' }}>HEAL</th>
                    <th style={{ ...th, textAlign: 'center' }}>GOLD Δ</th>
                    <th style={{ ...th, textAlign: 'center' }}>XP Δ</th>
                    <th style={{ ...th, textAlign: 'center' }}>DEATHS</th>
                    <th style={{ ...th, textAlign: 'center' }}>BB</th>
                  </tr>
                </thead>
                <tbody>
                  {tf.players?.map((tfp: any, pi: number) => {
                    const player = allPlayers[pi];
                    if (!player) return null;
                    return (
                      <tr key={pi}>
                        <td style={td}><PlayerCell p={player} /></td>
                        <td style={{ ...td, textAlign: 'center' }}>{fmtK(tfp.damage)}</td>
                        <td style={{ ...td, textAlign: 'center', color: 'var(--radiant-green)' }}>{fmtK(tfp.healing)}</td>
                        <td style={{ ...td, textAlign: 'center', color: tfp.gold_delta >= 0 ? 'var(--accent-gold)' : 'var(--dire-red)' }}>{tfp.gold_delta >= 0 ? '+' : ''}{tfp.gold_delta}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{tfp.xp_delta >= 0 ? '+' : ''}{tfp.xp_delta}</td>
                        <td style={{ ...td, textAlign: 'center', color: tfp.deaths ? 'var(--dire-red)' : '' }}>{tfp.deaths}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{tfp.buybacks || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================ CHAT TAB ================
export function ChatTab({ chat, allPlayers }: { chat: any[]; allPlayers: any[] }) {
  if (!chat?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No chat data available.</div>;

  const formatTime = (t: number) => {
    const neg = t < 0;
    const abs = Math.abs(t);
    return `${neg ? '-' : ''}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
  };

  const getPlayer = (slot: number) => allPlayers.find((p: any) => p.player_slot === slot);

  // Only show actual text chat, not chatwheel
  const textChat = chat.filter((c: any) => c.type === 'chat');

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Chat Log</h2>
      <div className="glass-surface" style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
        {textChat.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No text chat in this match.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {textChat.map((c: any, i: number) => {
              const player = getPlayer(c.player_slot);
              const hero = player ? HEROES[player.hero_id] : null;
              const isRadiant = (c.player_slot ?? 0) < 128;
              return (
                <div key={i} style={{ display: 'flex', gap: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '50px', fontSize: '0.8rem' }}>{formatTime(c.time)}</span>
                  <span style={{ color: isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {hero?.name || 'Unknown'}:
                  </span>
                  <span style={{ fontSize: '0.85rem' }}>{c.key}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ================ LOG TAB ================
export function LogTab({ allPlayers, matchData }: { allPlayers: any[]; matchData: any }) {
  // Combine all kill events from all players into a unified log
  const events: { time: number; text: string; type: string }[] = [];

  allPlayers.forEach((p: any) => {
    const hero = HEROES[p.hero_id]?.name || 'Unknown';
    (p.kills_log || []).forEach((k: any) => {
      events.push({ time: k.time, text: `${hero} killed an enemy`, type: 'kill' });
    });
  });

  // Add objectives
  (matchData.objectives || []).forEach((o: any) => {
    if (o.type === 'building_kill') {
      events.push({ time: o.time, text: `Building destroyed: ${o.key?.replace('npc_dota_', '').replace(/_/g, ' ')}`, type: 'objective' });
    } else if (o.type === 'CHAT_MESSAGE_FIRSTBLOOD') {
      events.push({ time: o.time, text: 'First Blood!', type: 'firstblood' });
    }
  });

  events.sort((a, b) => a.time - b.time);

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
  const colorMap: Record<string, string> = { kill: 'var(--dire-red)', objective: 'var(--accent-gold)', firstblood: '#ff4444' };

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Match Log</h2>
      <div className="glass-surface" style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No log data available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.3rem 0.5rem', borderLeft: `3px solid ${colorMap[e.type] || 'var(--text-muted)'}`, background: 'rgba(0,0,0,0.15)', borderRadius: '0 4px 4px 0' }}>
                <span style={{ color: 'var(--text-muted)', minWidth: '50px', fontSize: '0.8rem' }}>{formatTime(e.time)}</span>
                <span style={{ fontSize: '0.85rem' }}>{e.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
