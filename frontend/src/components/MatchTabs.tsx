import React, { useState, useMemo } from 'react';
import { HEROES } from '../lib/heroes';
import abilitiesData from '../lib/constants/abilities.json';
import itemsData from '../lib/constants/items.json';
import { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar, AreaChart, Area, ReferenceLine } from 'recharts';
import { Trophy } from 'lucide-react';




const TooltipContent = ({ data, itemName, isItem }: any) => {
  if (!data) return null;
  
  const imgUrl = isItem ? getItemImage(itemName) : getAbilityImage(itemName);
  
  const formatAttrib = (a: any) => {
    let val = Array.isArray(a.value) ? a.value.join(' / ') : a.value;
    if (a.display) {
      return a.display.replace('{value}', val);
    }
    if (a.header) {
      return `${a.header} ${val}`;
    }
    return null;
  };

  return (
    <div style={{
      position: 'absolute', zIndex: 100, width: '340px', pointerEvents: 'none',
      background: '#1a1f26', border: '1px solid #333', padding: '0',
      borderRadius: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)', 
      color: 'var(--text-primary)', textAlign: 'left',
      top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px'
    }}>
      <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
         <img src={imgUrl} style={{ width: isItem ? '60px' : '45px', height: '45px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.5)' }} />
         <div>
           <h4 style={{ margin: '0 0 0.25rem 0', color: '#fff', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{data.dname}</h4>
           {isItem && data.cost > 0 && <div style={{ color: '#e2b742', fontSize: '0.8rem', fontWeight: 'bold' }}>💰 {data.cost}</div>}
         </div>
      </div>
      
      <div style={{ padding: '1rem' }}>
        {data.behavior && (
           <div style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '1rem' }}>
             <span style={{ color: '#888' }}>TARGET:</span> {Array.isArray(data.behavior) ? data.behavior.join(' / ') : data.behavior}
           </div>
        )}
        
        {data.abilities && data.abilities.map((ab: any, i: number) => (
           <div key={i} style={{ marginBottom: '1rem' }}>
             <div style={{ color: '#a3d867', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
               {ab.type === 'active' ? 'Use: ' : 'Passive: '} {ab.title}
             </div>
             <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{ab.description}</div>
           </div>
        ))}

        {(!data.abilities || data.abilities.length === 0) && data.desc && (
           <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '1rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{data.desc}</div>
        )}

        {data.attrib && data.attrib.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            {data.attrib.map((a: any, i: number) => {
               const formatted = formatAttrib(a);
               if (!formatted) return null;
               return (
                 <div key={i} style={{ fontSize: '0.8rem', color: '#fff' }}>
                    {formatted}
                 </div>
               );
            })}
          </div>
        )}
        
        {data.hint && data.hint.length > 0 && (
           <div style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginBottom: '1rem' }}>
             {data.hint.map((h: string, i: number) => <div key={i}>{h}</div>)}
           </div>
        )}
        
        {(data.mc || data.cd) && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {data.mc && <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#2196f3', fontSize: '0.8rem', fontWeight: 'bold' }}>
              💧 {Array.isArray(data.mc) ? data.mc.join('/') : data.mc}
            </div>}
            {data.cd && <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ccc', fontSize: '0.8rem', fontWeight: 'bold' }}>
              ⏱️ {Array.isArray(data.cd) ? data.cd.join('/') : data.cd}
            </div>}
          </div>
        )}
      </div>
    </div>
  );
};

export const RichItemTooltip = ({ itemName, children }: any) => {
  const [show, setShow] = useState(false);
  const data = (itemsData as any)[itemName];
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && data && <TooltipContent data={data} itemName={itemName} isItem={true} />}
    </div>
  );
};

export const RichAbilityTooltip = ({ abilityName, children }: any) => {
  const [show, setShow] = useState(false);
  const data = (abilitiesData as any)[abilityName];
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && data && <TooltipContent data={data} itemName={abilityName} isItem={false} />}
    </div>
  );
};

export const isItemName = (name: string) => {
  if (!name) return false;
  if (name.startsWith('item_')) return true;
  return !!(itemsData as any)[name];
};

export const UniversalTooltip = ({ name, children }: any) => {
  const isItem = isItemName(name);
  if (isItem) {
    return <RichItemTooltip itemName={name.replace('item_', '')}>{children}</RichItemTooltip>;
  } else {
    return <RichAbilityTooltip abilityName={name}>{children}</RichAbilityTooltip>;
  }
};

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

const PercentBar = ({ value, max, color = 'var(--radiant-green)' }: { value: number; max: number; color?: string }) => {
  if (!max || max <= 0) return <span>{value}</span>;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minWidth: '40px' }}>
      <span style={{ fontSize: '0.85rem' }}>{value}</span>
      <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
    </div>
  );
};

const th: React.CSSProperties = { padding: '0.5rem 0.8rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '0.5rem 0.8rem', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' };

const TeamTable = ({ title, players, columns, winner, totals, noOverflow }: { title: string; players: any[]; columns: { key: string; label: any; sortFn?: (a: any, b: any) => number; render: (p: any) => any }[]; winner?: boolean, totals?: any, noOverflow?: boolean }) => {
  const [sortConfig, setSortConfig] = useState<{key: string | null, direction: 'asc' | 'desc'}>({ key: null, direction: 'desc' });
  
  const sortedPlayers = [...players].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const col = columns.find(c => c.key === sortConfig.key);
    if (!col || !col.sortFn) return 0;
    const result = col.sortFn(a, b);
    return sortConfig.direction === 'asc' ? result : -result;
  });

  const handleSort = (key: string, hasSortFn: boolean) => {
    if (!hasSortFn) return;
    let dir: 'asc'|'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') dir = 'asc';
    setSortConfig({ key, direction: dir });
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ color: title.includes('Radiant') ? 'var(--radiant-green)' : 'var(--dire-red)', marginBottom: '0.5rem' }}>
        {title} {winner && <span style={{ background: 'var(--radiant-green)', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '0.5rem' }}>WINNER</span>}
      </h3>
      <div className="glass-surface" style={{ overflowX: noOverflow ? 'visible' : 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>PLAYER</th>
              {columns.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key, !!c.sortFn)} style={{ ...th, textAlign: 'center', cursor: c.sortFn ? 'pointer' : 'default', userSelect: 'none' }}>
                  {c.label}
                  {sortConfig.key === c.key && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p, i) => (
              <tr key={i} style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={td}><PlayerCell p={p} /></td>
                {columns.map(c => <td key={c.key} style={{ ...td, textAlign: 'center' }}>{c.render(p)}</td>)}
              </tr>
            ))}
            {totals && (
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <td style={{ ...td, fontWeight: 'bold' }}>Totals</td>
                {columns.map(c => (
                  <td key={c.key} style={{ ...td, textAlign: 'center', fontWeight: 'bold', color: 'var(--text-primary)' }}>{totals[c.key] !== undefined ? totals[c.key] : ''}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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

  const getKilledBy = (rp: any, cp: any) => {
    const cpImgName = HEROES[cp.hero_id as keyof typeof HEROES]?.img_name;
    const cpHeroKey = cpImgName ? `npc_dota_hero_${cpImgName}` : '';
    return rp.killed_by ? (rp.killed_by[cpHeroKey] || 0) : 0;
  };
  const getDmgTaken = (rp: any, cp: any) => {
    const cpImgName = HEROES[cp.hero_id as keyof typeof HEROES]?.img_name;
    const cpHeroKey = cpImgName ? `npc_dota_hero_${cpImgName}` : '';
    return rp.damage_taken ? (rp.damage_taken[cpHeroKey] || 0) : 0;
  };

  const CrossTable = ({ title, radiant, dire, getField1, getField2, isDamage = false }: any) => {
    return (
      <div style={{ flex: '1 1 45%', overflowX: 'auto', background: 'transparent', borderRadius: '4px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)', textAlign: 'left', fontWeight: 'bold' }}>{title}</h3>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', textAlign: 'center', fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '3px' }}>
          <thead>
            <tr style={{ height: '32px', background: 'rgba(0,0,0,0.27)' }}>
              <th style={{ padding: '0 4px' }}></th>
              {dire.map((cp: any) => (
                <th key={cp.hero_id} style={{ padding: '0 4px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 15%, rgba(35,0,0,0.3) 100%)' }}>
                  <img src={getHeroImage(HEROES[cp.hero_id as keyof typeof HEROES]?.img_name || '')} alt={cp.hero_name} style={{ width: '32px', height: '18px', borderRadius: '2px', objectFit: 'cover' }} />
                </th>
              ))}
              <th style={{ padding: '0 4px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 15%, rgba(35,0,0,0.3) 100%)' }}>
                <span style={{ color: 'var(--dire-red)', fontWeight: 'bold' }}>DIRE</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {radiant.map((rp: any, i: number) => {
              let rowTotal1 = 0;
              let rowTotal2 = 0;
              const rpName = HEROES[rp.hero_id as keyof typeof HEROES]?.name || rp.hero_name;

              return (
                <tr key={rp.hero_id} style={{ background: 'rgba(0,0,0,0.02)' }}>
                  <td style={{ padding: '0', height: '48px', borderRight: '1px solid rgba(102,187,106,0.3)', background: 'linear-gradient(to right, rgba(255,255,255,0.05) 15%, rgba(0,35,0,0.3) 100%)' }}>
                    <img src={getHeroImage(HEROES[rp.hero_id as keyof typeof HEROES]?.img_name || '')} alt={rpName} style={{ width: '32px', height: '18px', borderRadius: '2px', objectFit: 'cover' }} />
                  </td>
                  {dire.map((cp: any) => {
                    const cpName = HEROES[cp.hero_id as keyof typeof HEROES]?.name || cp.hero_name;
                    const v1 = getField1(rp, cp); // Radiant -> Dire
                    const v2 = getField2(rp, cp); // Dire -> Radiant
                    rowTotal1 += v1;
                    rowTotal2 += v2;
                    
                    return (
                      <td key={cp.hero_id} style={{ padding: '0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(239,83,80,0.3)' }} title={`${rpName} → ${cpName}: ${v1}\n${cpName} → ${rpName}: ${v2}`}>
                        <div style={{ display: 'inline-flex', gap: '2px', padding: '0 2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(102,187,106,0.3)', background: 'rgba(0,3,0,0.3)', color: v1 > v2 ? '#fff' : 'var(--text-muted)' }}>
                            {v1 > 0 ? (isDamage ? fmtK(v1) : v1) : '-'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(0,3,0,0.3)', color: v2 > v1 ? '#fff' : 'var(--text-muted)' }}>
                            {v2 > 0 ? (isDamage ? fmtK(v2) : v2) : '-'}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: '0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(239,83,80,0.3)' }} title={`${rpName} → Dire: ${rowTotal1}\nDire → ${rpName}: ${rowTotal2}`}>
                     <div style={{ display: 'inline-flex', gap: '2px', padding: '0 2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(102,187,106,0.3)', background: 'rgba(0,3,0,0.3)', color: rowTotal1 > rowTotal2 ? '#fff' : 'var(--text-muted)' }}>{rowTotal1 > 0 ? (isDamage ? fmtK(rowTotal1) : rowTotal1) : '-'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(0,3,0,0.3)', color: rowTotal2 > rowTotal1 ? '#fff' : 'var(--text-muted)' }}>{rowTotal2 > 0 ? (isDamage ? fmtK(rowTotal2) : rowTotal2) : '-'}</div>
                     </div>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
              <td style={{ padding: '0', height: '48px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'var(--radiant-green)', fontWeight: 'bold' }}>RAD</span>
              </td>
              {dire.map((cp: any) => {
                const cpName = HEROES[cp.hero_id as keyof typeof HEROES]?.name || cp.hero_name;
                let colTotal1 = 0;
                let colTotal2 = 0;
                radiant.forEach((rp: any) => {
                  colTotal1 += getField1(rp, cp);
                  colTotal2 += getField2(rp, cp);
                });
                return (
                  <td key={`${cp.hero_id}_totals`} style={{ padding: '0', borderTop: '1px solid rgba(255,255,255,0.06)' }} title={`Radiant → ${cpName}: ${colTotal1}\n${cpName} → Radiant: ${colTotal2}`}>
                    <div style={{ display: 'inline-flex', gap: '2px', padding: '0 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(0,3,0,0.3)', color: colTotal2 > colTotal1 ? '#fff' : 'var(--text-muted)' }}>{colTotal2 > 0 ? (isDamage ? fmtK(colTotal2) : colTotal2) : '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(102,187,106,0.3)', background: 'rgba(0,3,0,0.3)', color: colTotal1 > colTotal2 ? '#fff' : 'var(--text-muted)' }}>{colTotal1 > 0 ? (isDamage ? fmtK(colTotal1) : colTotal1) : '-'}</div>
                    </div>
                  </td>
                );
              })}
              {(() => {
                let grand1 = 0, grand2 = 0;
                radiant.forEach((rp: any) => dire.forEach((cp: any) => {
                  grand1 += getField1(rp, cp);
                  grand2 += getField2(rp, cp);
                }));
                return (
                  <td style={{ padding: '0', borderTop: '1px solid rgba(255,255,255,0.06)' }} title={`Radiant → Dire: ${grand1}\nDire → Radiant: ${grand2}`}>
                    <div style={{ display: 'inline-flex', gap: '2px', padding: '0 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(102,187,106,0.3)', background: 'rgba(0,3,0,0.3)', color: grand1 > grand2 ? '#fff' : 'var(--text-muted)' }}>{grand1 > 0 ? (isDamage ? fmtK(grand1) : grand1) : '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '21px', border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(0,3,0,0.3)', color: grand2 > grand1 ? '#fff' : 'var(--text-muted)' }}>{grand2 > 0 ? (isDamage ? fmtK(grand2) : grand2) : '-'}</div>
                    </div>
                  </td>
                );
              })()}
            </tr>
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



  const renderAbilityDamage = (dmgDict: any) => {
    if (!dmgDict) return null;
    const sorted = Object.entries(dmgDict).sort((a: any, b: any) => b[1] - a[1]);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
        {sorted.map(([name, amount]: any, i: number) => (
          <UniversalTooltip key={i} name={name}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '2px', cursor: 'help' }}>
              <img src={isItemName(name) ? getItemImage(name.replace('item_', '')) : getAbilityImage(name)} alt={name} style={{ width: '20px', height: '20px', objectFit: 'cover' }} onError={(e) => { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none'; }} />
              <span style={{ fontSize: '0.65rem', marginTop: '2px', color: 'var(--text-muted)' }}>{fmtK(amount)}</span>
            </div>
          </UniversalTooltip>
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
              <UniversalTooltip name={item.ability}>
                <img src={isItemName(item.ability) ? getItemImage(item.ability.replace('item_', '')) : getAbilityImage(item.ability)} alt={item.ability} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px', cursor: 'help' }} onError={(e) => { if (e.currentTarget.parentElement?.parentElement) e.currentTarget.parentElement.parentElement.style.display = 'none'; }} />
              </UniversalTooltip>
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
      {/* CrossTables */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
        <CrossTable title="Kills" radiant={radiant} dire={dire} getField1={getKills} getField2={getKilledBy} />
        <CrossTable title="Damage" radiant={radiant} dire={dire} getField1={getDmg} getField2={getDmgTaken} isDamage />
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

  const maxVals = {
    hero: Math.max(...allPlayers.map((p: any) => p.hero_kills || 0)),
    creep: Math.max(...allPlayers.map((p: any) => p.lane_kills || 0)),
    neutral: Math.max(...allPlayers.map((p: any) => p.neutral_kills || 0)),
    ancient: Math.max(...allPlayers.map((p: any) => p.ancient_kills || 0)),
    tower: Math.max(...allPlayers.map((p: any) => p.tower_kills || 0)),
    courier: Math.max(...allPlayers.map((p: any) => p.courier_kills || 0)),
    roshan: Math.max(...allPlayers.map((p: any) => p.roshan_kills || 0)),
    obs: Math.max(...allPlayers.map((p: any) => p.observer_kills || 0)),
    necro: Math.max(...allPlayers.map((p: any) => p.necronomicon_kills || 0)),
    other: Math.max(...allPlayers.map((p: any) => Math.max(0, (p.last_hits || 0) - ((p.lane_kills || 0) + (p.neutral_kills || 0))))),
  };

  const renderBar = (val: number, max: number, color: string) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const pct = max > 0 ? (val / max) * 100 : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', minWidth: '40px', maxWidth: '60px', margin: '0 auto' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{val}</span>
        <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color }} />
        </div>
      </div>
    );
  };

  const unitCols = [
    { key: 'hero', label: 'HEROES', sortFn: (a: any, b: any) => (a.hero_kills || 0) - (b.hero_kills || 0), render: (p: any) => renderBar(p.hero_kills || 0, maxVals.hero, '#ff9800') },
    { key: 'creep', label: 'CREEPS', sortFn: (a: any, b: any) => (a.lane_kills || 0) - (b.lane_kills || 0), render: (p: any) => renderBar(p.lane_kills || 0, maxVals.creep, '#66bb6a') },
    { key: 'neutral', label: 'NEUTRALS', sortFn: (a: any, b: any) => (a.neutral_kills || 0) - (b.neutral_kills || 0), render: (p: any) => renderBar(p.neutral_kills || 0, maxVals.neutral, '#42a5f5') },
    { key: 'ancient', label: 'ANCIENTS', sortFn: (a: any, b: any) => (a.ancient_kills || 0) - (b.ancient_kills || 0), render: (p: any) => renderBar(p.ancient_kills || 0, maxVals.ancient, 'var(--accent-gold)') },
    { key: 'tower', label: 'TOWERS', sortFn: (a: any, b: any) => (a.tower_kills || 0) - (b.tower_kills || 0), render: (p: any) => renderBar(p.tower_kills || 0, maxVals.tower, 'var(--radiant-green)') },
    { key: 'courier', label: 'COURIERS', sortFn: (a: any, b: any) => (a.courier_kills || 0) - (b.courier_kills || 0), render: (p: any) => renderBar(p.courier_kills || 0, maxVals.courier, 'var(--dire-red)') },
    { key: 'roshan', label: 'ROSHAN', sortFn: (a: any, b: any) => (a.roshan_kills || 0) - (b.roshan_kills || 0), render: (p: any) => renderBar(p.roshan_kills || 0, maxVals.roshan, '#ff9800') },
    { key: 'obs', label: 'OBSERVERS', sortFn: (a: any, b: any) => (a.observer_kills || 0) - (b.observer_kills || 0), render: (p: any) => renderBar(p.observer_kills || 0, maxVals.obs, '#66bb6a') },
    { key: 'necro', label: 'NECRONOMICON', sortFn: (a: any, b: any) => (a.necronomicon_kills || 0) - (b.necronomicon_kills || 0), render: (p: any) => renderBar(p.necronomicon_kills || 0, maxVals.necro, '#42a5f5') },
    { key: 'other', label: 'OTHER', sortFn: (a: any, b: any) => {
        const oA = Math.max(0, (a.last_hits || 0) - ((a.lane_kills || 0) + (a.neutral_kills || 0)));
        const oB = Math.max(0, (b.last_hits || 0) - ((b.lane_kills || 0) + (b.neutral_kills || 0)));
        return oA - oB;
    }, render: (p: any) => {
        const others = Math.max(0, (p.last_hits || 0) - ((p.lane_kills || 0) + (p.neutral_kills || 0)));
        return renderBar(others, maxVals.other, 'var(--text-muted)');
    }},
  ];

  const lhMinutes = [5, 10, 15, 20, 25, 30, 35, 40];
  const maxLhByMin: Record<number, number> = {};
  lhMinutes.forEach(min => {
    maxLhByMin[min] = Math.max(...allPlayers.map((p: any) => (p.lh_t && p.lh_t.length > min) ? p.lh_t[min] : 0));
  });

  const renderLhBar = (current: number, delta: number, max: number, isRad: boolean) => {
    if (!current) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const pct = max > 0 ? (current / max) * 100 : 0;
    const color = isRad ? 'var(--radiant-green)' : 'var(--dire-red)';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', minWidth: '50px', maxWidth: '80px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>{current}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(+{delta})</span>
        </div>
        <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color }} />
        </div>
      </div>
    );
  };

  const lhCols = lhMinutes.map(min => ({
    key: `lh_${min}`,
    label: `${min}'`,
    sortFn: (a: any, b: any) => {
      const vA = (a.lh_t && a.lh_t.length > min) ? a.lh_t[min] : 0;
      const vB = (b.lh_t && b.lh_t.length > min) ? b.lh_t[min] : 0;
      return vA - vB;
    },
    render: (p: any) => {
      if (!p.lh_t || p.lh_t.length <= min) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
      const current = p.lh_t[min];
      const prev = p.lh_t.length > min - 5 ? p.lh_t[min - 5] : 0;
      const delta = current - prev;
      return renderLhBar(current, delta, maxLhByMin[min], p.player_slot < 128);
    }
  }));

  const getTotals = (teamPlayers: any[]) => {
    const t: any = {};
    t.hero = teamPlayers.reduce((acc, p) => acc + (p.hero_kills || 0), 0);
    t.creep = teamPlayers.reduce((acc, p) => acc + (p.lane_kills || 0), 0);
    t.neutral = teamPlayers.reduce((acc, p) => acc + (p.neutral_kills || 0), 0);
    t.ancient = teamPlayers.reduce((acc, p) => acc + (p.ancient_kills || 0), 0);
    t.tower = teamPlayers.reduce((acc, p) => acc + (p.tower_kills || 0), 0);
    t.courier = teamPlayers.reduce((acc, p) => acc + (p.courier_kills || 0), 0);
    t.roshan = teamPlayers.reduce((acc, p) => acc + (p.roshan_kills || 0), 0);
    t.obs = teamPlayers.reduce((acc, p) => acc + (p.observer_kills || 0), 0);
    t.necro = teamPlayers.reduce((acc, p) => acc + (p.necronomicon_kills || 0), 0);
    t.other = teamPlayers.reduce((acc, p) => acc + Math.max(0, (p.last_hits || 0) - ((p.lane_kills || 0) + (p.neutral_kills || 0))), 0);
    
    lhMinutes.forEach(min => {
      t[`lh_${min}`] = teamPlayers.reduce((acc, p) => acc + ((p.lh_t && p.lh_t.length > min) ? p.lh_t[min] : 0), 0);
    });
    return t;
  };

  const radTotals = getTotals(radiant);
  const direTotals = getTotals(dire);

  // Reasons Graph Data Setup
  const goldReasonsData = allPlayers.map(p => {
    const reasons = p.gold_reasons || {};
    return {
      name: HEROES[p.hero_id]?.name || p.hero_name,
      img: getHeroImage(HEROES[p.hero_id]?.img_name || ''),
      isRadiant: p.player_slot < 128,
      'Other': reasons['0'] || 0,
      'Death': reasons['1'] || 0,
      'Buyback': reasons['2'] || 0,
      'Abandon': reasons['3'] || 0,
      'Sell': reasons['4'] || 0,
      'Destroying Structure': reasons['11'] || 0,
      'Hero Kill': reasons['12'] || 0,
      'Creep Kill': reasons['13'] || 0,
      'Roshan Kill': reasons['14'] || 0,
      'Courier Kill': reasons['15'] || 0,
      'Bounty Rune': reasons['16'] || 0,
    };
  });

  const xpReasonsData = allPlayers.map(p => {
    const reasons = p.xp_reasons || {};
    return {
      name: HEROES[p.hero_id]?.name || p.hero_name,
      img: getHeroImage(HEROES[p.hero_id]?.img_name || ''),
      isRadiant: p.player_slot < 128,
      'Other': reasons['0'] || 0,
      'Hero Kill': reasons['1'] || 0,
      'Creep Kill': reasons['2'] || 0,
      'Roshan Kill': reasons['3'] || 0,
    };
  });

  const goldColors = { 'Other': '#9e9e9e', 'Death': '#ef5350', 'Buyback': '#ab47bc', 'Sell': '#78909c', 'Destroying Structure': '#8d6e63', 'Hero Kill': '#ffca28', 'Creep Kill': '#66bb6a', 'Roshan Kill': '#ff7043', 'Courier Kill': '#29b6f6', 'Bounty Rune': '#ffee58' };
  const xpColors = { 'Other': '#9e9e9e', 'Hero Kill': '#ffca28', 'Creep Kill': '#66bb6a', 'Roshan Kill': '#ff7043' };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const p = goldReasonsData.find(d => d.name === payload.value);
    if (!p) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <image href={p.img} x={-16} y={4} width="32" height="18" clipPath="inset(0% round 2px)" style={{ borderBottom: `2px solid ${p.isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}` }} />
      </g>
    );
  };

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>Unit Kills</h2>
      <TeamTable title="Radiant - Unit Kills" players={radiant} columns={unitCols} winner={radiantWin} totals={radTotals} />
      <TeamTable title="Dire - Unit Kills" players={dire} columns={unitCols} winner={!radiantWin} totals={direTotals} />
      
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Last Hits</h2>
      <TeamTable title="Radiant - Last Hits" players={radiant} columns={lhCols} winner={radiantWin} totals={radTotals} />
      <TeamTable title="Dire - Last Hits" players={dire} columns={lhCols} winner={!radiantWin} totals={direTotals} />

      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Gold Reasons</h2>
      <div style={{ width: '100%', height: '400px', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={goldReasonsData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" interval={0} tick={<CustomXAxisTick />} />
            <YAxis tickFormatter={(val) => fmtK(val)} stroke="rgba(255,255,255,0.5)" />
            <Tooltip contentStyle={{ background: '#1a1f26', border: '1px solid var(--border-color)', borderRadius: '4px' }} formatter={(val) => fmtK(val)} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {Object.keys(goldColors).map(key => (
              <Bar key={key} dataKey={key} stackId="a" fill={goldColors[key as keyof typeof goldColors]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>XP Reasons</h2>
      <div style={{ width: '100%', height: '400px', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={xpReasonsData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" interval={0} tick={<CustomXAxisTick />} />
            <YAxis tickFormatter={(val) => fmtK(val)} stroke="rgba(255,255,255,0.5)" />
            <Tooltip contentStyle={{ background: '#1a1f26', border: '1px solid var(--border-color)', borderRadius: '4px' }} formatter={(val) => fmtK(val)} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {Object.keys(xpColors).map(key => (
              <Bar key={key} dataKey={key} stackId="a" fill={xpColors[key as keyof typeof xpColors]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
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
            <RichItemTooltip key={i} itemName={itemName}>
              <div title={itemName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'help' }}>
                <div style={{ width: '36px', height: '26px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={getItemImage(itemName)} alt={itemName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <span style={{ marginTop: '2px', fontSize: '0.65rem' }}>{prefix}{m}:{s}</span>
              </div>
            </RichItemTooltip>
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

  const renderAbilityGrid = (p: any) => {
    const uses = p.ability_uses || {};
    const targets = p.ability_targets || {};
    
    const entries = Object.entries(uses).filter(([k]) => !k.startsWith('item_') && !k.startsWith('special_bonus'));
    if (!entries.length) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    
    const sorted = entries.sort((a: any, b: any) => b[1] - a[1]);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
        {sorted.map(([k, v]: any) => {
          const abTargets = targets[k] || {};
          const targetEntries = Object.entries(abTargets).sort((a: any, b: any) => b[1] - a[1]);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RichAbilityTooltip abilityName={k}>
                <div style={{ position: 'relative', display: 'inline-block', width: '32px', height: '32px' }}>
                  <img src={getAbilityImage(k)} style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '2px', objectFit: 'cover' }} onError={(e) => { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none'; }} />
                  <span style={{ position: 'absolute', bottom: '-4px', left: '-4px', background: 'rgba(0,0,0,0.85)', color: 'var(--accent-gold)', fontSize: '10px', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {v}
                  </span>
                </div>
              </RichAbilityTooltip>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 4px' }}>→</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {targetEntries.map(([tk, tv]: any) => (
                  <div key={tk} title={tk.replace('npc_dota_hero_', '').replace(/_/g, ' ')} style={{ position: 'relative', display: 'inline-block', width: '28px', height: '16px' }}>
                    <img src={getHeroImage(tk.replace('npc_dota_hero_', ''))} style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '2px', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: '-4px', left: '-4px', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '9px', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {tv}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemGrid = (p: any) => {
    const uses = p.item_uses || {};
    const entries = Object.entries(uses).filter(([k]) => !k.includes('tpscroll') && !k.includes('ward'));
    if (!entries.length) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start', alignContent: 'flex-start', paddingTop: '4px' }}>
        {entries.sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => (
          <RichItemTooltip key={k} itemName={k.replace('item_', '')}>
            <div style={{ position: 'relative', display: 'inline-block', width: '38px', height: '28px' }}>
              <img src={getItemImage(k.replace('item_', ''))} style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '2px', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', bottom: '-4px', left: '-4px', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '10px', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>
                {v}
              </span>
            </div>
          </RichItemTooltip>
        ))}
      </div>
    );
  };

  const renderHitsGrid = (p: any) => {
    const hits = p.hero_hits || {};
    const entries = Object.entries(hits);
    if (!entries.length) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start', alignContent: 'flex-start', paddingTop: '4px' }}>
        {entries.sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).map(([k, v]: any) => {
          const isAttack = k === 'null' || k === '';
          const imgSrc = isAttack ? '/assets/images/default_attack.png' : (isItemName(k) ? getItemImage(k.replace('item_', '')) : getAbilityImage(k));
          const title = isAttack ? 'Auto Attack' : k;
          
          return (
            <UniversalTooltip key={k} name={isAttack ? '' : k}>
              <div title={isAttack ? title : undefined} style={{ position: 'relative', display: 'inline-block', width: '38px', height: '28px' }}>
                <img src={imgSrc} style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '2px', objectFit: 'cover' }} onError={(e) => { if (e.currentTarget.parentElement?.parentElement) e.currentTarget.parentElement.parentElement.style.display = 'none'; }} />
                <span style={{ position: 'absolute', bottom: '-4px', left: '-4px', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '10px', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {v}
                </span>
              </div>
            </UniversalTooltip>
          );
        })}
      </div>
    );
  };

  const castsCols = [
    { key: 'abilities', label: 'ABILITIES', render: renderAbilityGrid },
    { key: 'items', label: 'ITEMS', render: renderItemGrid },
    { key: 'hits', label: 'HITS', render: renderHitsGrid }
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Casts" players={radiant} columns={castsCols} winner={radiantWin} />
      <TeamTable title="Dire - Casts" players={dire} columns={castsCols} winner={!radiantWin} />
    </div>
  );
}

// ================ OBJECTIVES TAB ================
export function ObjectivesTab({ allPlayers }: { allPlayers: any[] }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);
  const radiantWin = allPlayers[0]?.radiant_win;

  const dmgCol = (key: string, label: string, damageKeys: string[], tooltip: string) => ({
    key,
    label: <span title={tooltip} style={{ cursor: 'help' }}>{label}</span>,
    sortFn: (a: any, b: any) => {
       const aDmg = damageKeys.reduce((acc, k) => acc + (a.damage?.[k] || 0), 0);
       const bDmg = damageKeys.reduce((acc, k) => acc + (b.damage?.[k] || 0), 0);
       return bDmg - aDmg;
    },
    render: (p: any) => {
       const dmg = damageKeys.reduce((acc, k) => acc + (p.damage?.[k] || 0), 0);
       if (dmg === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
       return <span>{dmg}</span>;
    }
  });

  const getDmgCols = (isRadiant: boolean) => {
    const enemy = isRadiant ? 'badguys' : 'goodguys';
    return [
      { key: 'player', label: 'PLAYER', render: (p: any) => <PlayerCell p={p} /> },
      dmgCol('anc', 'ANC', [`npc_dota_${enemy}_fort`], 'Ancient'),
      dmgCol('raxb', 'RAXB', [`npc_dota_${enemy}_barracks_melee_bot`, `npc_dota_${enemy}_barracks_ranged_bot`], 'Barracks Bot'),
      dmgCol('raxm', 'RAXM', [`npc_dota_${enemy}_barracks_melee_mid`, `npc_dota_${enemy}_barracks_ranged_mid`], 'Barracks Mid'),
      dmgCol('raxt', 'RAXT', [`npc_dota_${enemy}_barracks_melee_top`, `npc_dota_${enemy}_barracks_ranged_top`], 'Barracks Top'),
      dmgCol('rosh', 'ROSH', [`npc_dota_roshan`], 'Roshan'),
      dmgCol('shr', 'SHR', [`npc_dota_${enemy}_healer`], 'Shrine'),
      dmgCol('b1', 'B1', [`npc_dota_${enemy}_tower1_bot`], 'Tower 1 Bot'),
      dmgCol('m1', 'M1', [`npc_dota_${enemy}_tower1_mid`], 'Tower 1 Mid'),
      dmgCol('t1', 'T1', [`npc_dota_${enemy}_tower1_top`], 'Tower 1 Top'),
      dmgCol('b2', 'B2', [`npc_dota_${enemy}_tower2_bot`], 'Tower 2 Bot'),
      dmgCol('m2', 'M2', [`npc_dota_${enemy}_tower2_mid`], 'Tower 2 Mid'),
      dmgCol('t2', 'T2', [`npc_dota_${enemy}_tower2_top`], 'Tower 2 Top'),
      dmgCol('b3', 'B3', [`npc_dota_${enemy}_tower3_bot`], 'Tower 3 Bot'),
      dmgCol('m3', 'M3', [`npc_dota_${enemy}_tower3_mid`], 'Tower 3 Mid'),
      dmgCol('t3', 'T3', [`npc_dota_${enemy}_tower3_top`], 'Tower 3 Top'),
      dmgCol('t4', 'T4', [`npc_dota_${enemy}_tower4`], 'Tower 4'),
    ];
  };

  const runesList = [
    { id: 5, name: 'Bounty', color: '#ff9800' },
    { id: 1, name: 'Haste', color: '#f44336' },
    { id: 0, name: 'Double Damage', color: '#2196f3' },
    { id: 2, name: 'Illusion', color: '#ffeb3b' },
    { id: 3, name: 'Invisibility', color: '#9c27b0' },
    { id: 4, name: 'Regeneration', color: '#4caf50' },
    { id: 6, name: 'Arcane', color: '#e91e63' },
    { id: 7, name: 'Water', color: '#03a9f4' },
    { id: 8, name: 'Wisdom', color: '#673ab7' },
    { id: 9, name: 'Shield', color: '#ffc107' }
  ];

  const runesCols = [
    { key: 'player', label: 'PLAYER', render: (p: any) => <PlayerCell p={p} /> },
    ...runesList.map(r => ({
      key: `rune_${r.id}`,
      label: <img src={`https://www.opendota.com/assets/images/dota2/runes/${r.id}.png`} alt={r.name} title={r.name} style={{ width: '16px', height: '16px', borderRadius: '50%' }} />,
      sortFn: (a: any, b: any) => (b.runes?.[r.id] || 0) - (a.runes?.[r.id] || 0),
      render: (p: any) => {
        const val = p.runes?.[r.id];
        if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
        
        // OpenDota shows a small horizontal bar
        // We'll just render the number with a bar
        // Max value estimation for runes is roughly 10
        const pct = Math.min(100, (val / 10) * 100);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>{val}</span>
            <div style={{ width: '30px', height: '2px', background: 'rgba(255,255,255,0.1)' }}>
               <div style={{ width: `${pct}%`, height: '100%', background: r.color }}></div>
            </div>
          </div>
        );
      }
    }))
  ];

  return (
    <div className="animation-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <TeamTable title="Radiant - Objective Damage" players={radiant} columns={getDmgCols(true)} winner={radiantWin} />
        <TeamTable title="Dire - Objective Damage" players={dire} columns={getDmgCols(false)} winner={!radiantWin} />
      </div>
      
      <div>
        <TeamTable title="Radiant - Runes" players={radiant} columns={runesCols} winner={radiantWin} />
        <TeamTable title="Dire - Runes" players={dire} columns={runesCols} winner={!radiantWin} />
      </div>
    </div>
  );
}

// ================ VISION TAB ================
export function VisionTab({ allPlayers, matchData }: { allPlayers: any[]; matchData: any }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);
  const duration = matchData?.duration || 0;
  
  const [timeFilter, setTimeFilter] = useState(duration);
  const [radHeroFilters, setRadHeroFilters] = useState<Record<string, {obs: boolean, sen: boolean}>>(
    Object.fromEntries(radiant.map((p: any) => [p.hero_id, {obs: true, sen: true}]))
  );
  const [direHeroFilters, setDireHeroFilters] = useState<Record<string, {obs: boolean, sen: boolean}>>(
    Object.fromEntries(dire.map((p: any) => [p.hero_id, {obs: true, sen: true}]))
  );
  
  const toggleRadHero = (heroId: string, type: 'obs'|'sen', val: boolean) => {
    setRadHeroFilters(prev => ({...prev, [heroId]: {...prev[heroId], [type]: val}}));
  };
  const toggleDireHero = (heroId: string, type: 'obs'|'sen', val: boolean) => {
    setDireHeroFilters(prev => ({...prev, [heroId]: {...prev[heroId], [type]: val}}));
  };

  const getAvgLifespan = (placedLog: any[], leftLog: any[], maxDur: number) => {
    if (!placedLog || placedLog.length === 0) return '-';
    let total = 0;
    let count = 0;
    placedLog.forEach((placed: any) => {
      const left = leftLog?.find((l: any) => l.ehandle === placed.ehandle);
      if (left) {
        total += Math.min(Math.max(left.time - placed.time, 0), maxDur);
        count++;
      }
    });
    if (count === 0) return '-';
    const avg = Math.round(total / count);
    return `${Math.floor(avg / 60)}:${(avg % 60).toString().padStart(2, '0')}`;
  };

  const visionCols = [
    { key: 'player', label: 'PLAYER', render: (p: any) => <PlayerCell p={p} /> },
    { key: 'obs_pur', label: <span title="Observer Wards Purchased" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png" style={{ height: '20px' }} /> PUR</span>, render: (p: any) => {
      const pLog = p.purchase_log || [];
      const pur = pLog.filter((i: any) => i.key === 'ward_observer').length;
      return pur || '-';
    }},
    { key: 'obs_use', label: <span title="Observer Wards Placed" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png" style={{ height: '20px' }} /> USE</span>, render: (p: any) => p.obs_placed || '-' },
    { key: 'obs_dur', label: <span title="Observer Wards Average Lifespan" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png" style={{ height: '20px' }} /> DUR</span>, render: (p: any) => getAvgLifespan(p.obs_log, p.obs_left_log, 360) },
    { key: 'sen_pur', label: <span title="Sentry Wards Purchased" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png" style={{ height: '20px' }} /> PUR</span>, render: (p: any) => {
      const pLog = p.purchase_log || [];
      const pur = pLog.filter((i: any) => i.key === 'ward_sentry').length;
      return pur || '-';
    }},
    { key: 'sen_use', label: <span title="Sentry Wards Placed" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png" style={{ height: '20px' }} /> USE</span>, render: (p: any) => p.sen_placed || '-' },
    { key: 'sen_dur', label: <span title="Sentry Wards Average Lifespan" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png" style={{ height: '20px' }} /> DUR</span>, render: (p: any) => getAvgLifespan(p.sen_log, p.sen_left_log, 420) },
    { key: 'dust_pur', label: <span title="Dust Purchased" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dust.png" style={{ height: '20px' }} /> PUR</span>, render: (p: any) => {
      const pLog = p.purchase_log || [];
      const pur = pLog.filter((i: any) => i.key === 'dust').length;
      return pur || '-';
    }},
    { key: 'dust_use', label: <span title="Dust Used" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dust.png" style={{ height: '20px' }} /> USE</span>, render: (p: any) => p.item_uses?.dust || '-' },
    { key: 'smoke_pur', label: <span title="Smoke Purchased" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/smoke_of_deceit.png" style={{ height: '20px' }} /> PUR</span>, render: (p: any) => {
      const pLog = p.purchase_log || [];
      const pur = pLog.filter((i: any) => i.key === 'smoke_of_deceit').length;
      return pur || '-';
    }},
    { key: 'smoke_use', label: <span title="Smoke Used" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/smoke_of_deceit.png" style={{ height: '20px' }} /> USE</span>, render: (p: any) => p.item_uses?.smoke_of_deceit || '-' },
    { key: 'gem_pur', label: <span title="Gem Purchased" style={{ cursor: 'help' }}><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gem.png" style={{ height: '20px' }} /> PUR</span>, render: (p: any) => {
      const pLog = p.purchase_log || [];
      const pur = pLog.filter((i: any) => i.key === 'gem').length;
      return pur || '-';
    }}
  ];

  const wardLog = useMemo(() => {
    let logs: any[] = [];
    allPlayers.forEach(p => {
      const addLogs = (type: string, placed: any[], left: any[]) => {
        if (!placed) return;
        placed.forEach(pl => {
          const l = left?.find((x: any) => x.ehandle === pl.ehandle);
          logs.push({ type, player: p, placed: pl, left: l });
        });
      };
      addLogs('obs', p.obs_log, p.obs_left_log);
      addLogs('sen', p.sen_log, p.sen_left_log);
    });
    logs.sort((a, b) => a.placed.time - b.placed.time);
    return logs;
  }, [allPlayers]);

  const wardLogCols = [
    { key: 'type', label: 'TYPE', render: (w: any) => <img src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_${w.type === 'obs' ? 'observer' : 'sentry'}.png`} style={{ height: '20px' }} /> },
    { key: 'owner', label: 'OWNER', render: (w: any) => <PlayerCell p={w.player} /> },
    { key: 'placed', label: 'PLACED', render: (w: any) => `${Math.floor(w.placed.time / 60)}:${Math.floor(w.placed.time % 60).toString().padStart(2, '0')}` },
    { key: 'left', label: 'LEFT', render: (w: any) => {
      let endTime = (w.left && w.left.time) || duration;
      const lifetime = w.type === 'obs' ? 360 : 420;
      const rawDur = endTime - w.placed.time;
      const discrepancy = rawDur - Math.min(lifetime, rawDur);
      endTime -= discrepancy;
      if (!w.left && endTime === duration - discrepancy) return '-';
      return `${Math.floor(endTime / 60)}:${Math.floor(endTime % 60).toString().padStart(2, '0')}`;
    }},
    { key: 'lifespan', label: 'LIFESPAN', render: (w: any) => {
      const endTime = (w.left && w.left.time) || duration;
      const lifetime = w.type === 'obs' ? 360 : 420;
      const rawDur = endTime - w.placed.time;
      const discrepancy = rawDur - Math.min(lifetime, rawDur);
      const finalDur = rawDur - discrepancy;
      const m = Math.floor(finalDur / 60);
      const s = Math.floor(finalDur % 60).toString().padStart(2, '0');
      
      const isObs = w.type === 'obs';
      let color = 'inherit';
      if (isObs) {
         if (finalDur < 121) color = 'var(--dire-red)';
         else if (finalDur < 241) color = '#eab308';
         else color = 'var(--radiant-green)';
      } else {
         if (finalDur < 81) color = 'var(--dire-red)';
         else if (finalDur < 161) color = '#eab308';
         else color = 'var(--radiant-green)';
      }
      
      return <span style={{ color }}>{`${m}:${s}`}</span>;
    }},
    { key: 'killed_by', label: 'KILLED BY', render: (w: any) => {
      if (!w.left || !w.left.attackername) return '-';
      let killerStr = w.left.attackername;
      if (killerStr.startsWith('npc_dota_hero_')) {
        killerStr = killerStr.replace('npc_dota_hero_', '');
        const killerObj = Object.values(HEROES).find((h: any) => h.img_name === killerStr);
        if (killerObj) {
          const killerP = allPlayers.find((p: any) => p.hero_id === killerObj.id);
          if (killerP) return <PlayerCell p={killerP} />;
          return <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><img src={getHeroImage(killerObj.img_name)} style={{ width: '24px' }}/> {killerObj.name}</div>;
        }
      }
      
      let friendly = killerStr.replace('npc_dota_', '').replace(/_/g, ' ');
      friendly = friendly.replace('goodguys', 'Radiant').replace('badguys', 'Dire');
      friendly = friendly.replace('creep', 'Creep').replace('siege', 'Siege').replace('ranged', 'Ranged').replace('melee', 'Melee').replace('tower', 'Tower');
      friendly = friendly.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return friendly;
    }},
    { key: 'placement', label: 'PLACEMENT', render: (w: any) => {
      const left = Math.min(100, Math.max(0, ((w.placed.x - 64) / 128) * 100));
      const top = Math.min(100, Math.max(0, (1 - ((w.placed.y - 64) / 128)) * 100));
      return (
        <div style={{ position: 'relative', display: 'inline-block' }} className="ward-hover-container">
          <img src="/assets/images/dota2/Game_map_7.41.jpg" style={{ width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', opacity: 0.8 }} />
          <div className="ward-hover-map" style={{ position: 'absolute', zIndex: 100, bottom: '30px', right: 0, width: '200px', height: '200px', border: '2px solid #333', display: 'none', background: '#000' }}>
             <img src="/assets/images/dota2/Game_map_7.41.jpg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
             <img src={w.type === 'obs' ? 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png' : 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png'} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: '16px', height: '16px', transform: 'translate(-50%, -50%)', filter: `drop-shadow(0 0 2px ${w.isRad ? '#22c55e' : '#ef4444'})` }} />
          </div>
        </div>
      );
    }}
  ];

  const activeWards = useMemo(() => {
    let wards: any[] = [];
    allPlayers.forEach(p => {
      const isRad = p.player_slot < 128;
      const filters = isRad ? radHeroFilters[p.hero_id] : direHeroFilters[p.hero_id];
      if (!filters) return;
      
      const addWards = (type: string, placed: any[], left: any[], show: boolean, maxDur: number) => {
        if (!show || !placed) return;
        placed.forEach(pl => {
          if (pl.time > timeFilter) return;
          const l = left?.find((x: any) => x.ehandle === pl.ehandle);
          const endTime = l ? l.time : pl.time + maxDur;
          if (endTime >= timeFilter) {
            const leftPos = Math.min(100, Math.max(0, ((pl.x - 64) / 128) * 100));
            const topPos = Math.min(100, Math.max(0, (1 - ((pl.y - 64) / 128)) * 100));
            wards.push({ type, left: leftPos, top: topPos, owner: p, isRad, placed: pl, leftLog: l, maxDur });
          }
        });
      };
      addWards('obs', p.obs_log, p.obs_left_log, filters.obs, 360);
      addWards('sen', p.sen_log, p.sen_left_log, filters.sen, 420);
    });
    return wards;
  }, [allPlayers, timeFilter, radHeroFilters, direHeroFilters]);

  return (
    <div className="animation-fade-in">
      <style>
        {`
           .hero-filter-table th, .hero-filter-table td { padding: 8px; text-align: center; }
           .ward-hover-container:hover .ward-hover-map { display: block !important; }
           .ward-marker { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; opacity: 0.8; }
           .ward-marker:hover { z-index: 50 !important; opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
           .ward-marker-tooltip { position: absolute; background: rgba(0,0,0,0.9); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; pointer-events: none; z-index: 100; min-width: 200px; display: none; margin-top: -100px; margin-left: 20px; }
           .ward-marker:hover .ward-marker-tooltip { display: block; }
        `}
      </style>

      {/* Top Section: Map & Timeline/Filters */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Map */}
        <div style={{ width: '400px', height: '400px', position: 'relative', border: '1px solid var(--border-color)', background: '#0a0a0a', borderRadius: '8px', overflow: 'hidden' }}>
          <img src="/assets/images/dota2/Game_map_7.41.jpg" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.7 }} />
          {activeWards.map((w: any, i: number) => (
             <div key={i} className="ward-marker" style={{
                left: `${w.left}%`, top: `${w.top}%`,
                width: '16px', height: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
             }}>
               <img src={w.type === 'obs' ? 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png' : 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png'} style={{ width: '100%', height: '100%', filter: `drop-shadow(0 0 2px ${w.isRad ? '#22c55e' : '#ef4444'})` }} />
               <div className="ward-marker-tooltip">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <img src={getHeroImage(HEROES[w.owner.hero_id as keyof typeof HEROES]?.img_name)} style={{ width: '24px' }} />
                    <span style={{ color: w.isRad ? 'var(--radiant-green)' : 'var(--dire-red)' }}>{w.owner.personaname || 'Unknown'}</span>
                    <span>placed {w.type === 'obs' ? 'Observer' : 'Sentry'}</span>
                 </div>
                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                   Placed at: {Math.floor(w.placed.time / 60)}:{Math.floor(w.placed.time % 60).toString().padStart(2, '0')}
                 </div>
                 {w.leftLog && w.leftLog.time <= duration ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Destroyed after {Math.floor((w.leftLog.time - w.placed.time) / 60)}:{Math.floor((w.leftLog.time - w.placed.time) % 60).toString().padStart(2, '0')}
                    </div>
                 ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Expires after {Math.floor(w.maxDur / 60)}:00
                    </div>
                 )}
               </div>
             </div>
          ))}
        </div>
        
        {/* Timeline & Hero Filters */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
           <div style={{ marginBottom: '1.5rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px' }}>
             <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>All time</h4>
             <input type="range" min="0" max={duration} value={timeFilter} onChange={e => setTimeFilter(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
               <span>0:00</span>
               <span>{Math.floor(timeFilter/60)}:{(timeFilter%60).toString().padStart(2, '0')}</span>
               <span>{Math.floor(duration/60)}:{(duration%60).toString().padStart(2, '0')}</span>
             </div>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px' }}>
                 <h4 style={{ marginBottom: '0.5rem', color: 'var(--radiant-green)' }}>Radiant</h4>
                 <table className="hero-filter-table" style={{ width: '100%' }}>
                    <thead>
                       <tr>
                         <th></th>
                         {radiant.map((p: any) => <th key={p.hero_id}><img src={getHeroImage(HEROES[p.hero_id as keyof typeof HEROES]?.img_name)} style={{ height: '30px', borderRadius: '2px' }} title={p.personaname} /></th>)}
                       </tr>
                    </thead>
                    <tbody>
                       <tr>
                         <td><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png" style={{ height: '24px' }} title="Observer Wards" /></td>
                         {radiant.map((p: any) => <td key={p.hero_id}><input type="checkbox" checked={radHeroFilters[p.hero_id]?.obs || false} onChange={e => toggleRadHero(p.hero_id, 'obs', e.target.checked)} /></td>)}
                       </tr>
                       <tr>
                         <td><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png" style={{ height: '24px' }} title="Sentry Wards" /></td>
                         {radiant.map((p: any) => <td key={p.hero_id}><input type="checkbox" checked={radHeroFilters[p.hero_id]?.sen || false} onChange={e => toggleRadHero(p.hero_id, 'sen', e.target.checked)} /></td>)}
                       </tr>
                    </tbody>
                 </table>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px' }}>
                 <h4 style={{ marginBottom: '0.5rem', color: 'var(--dire-red)' }}>Dire</h4>
                 <table className="hero-filter-table" style={{ width: '100%' }}>
                    <thead>
                       <tr>
                         <th></th>
                         {dire.map((p: any) => <th key={p.hero_id}><img src={getHeroImage(HEROES[p.hero_id as keyof typeof HEROES]?.img_name)} style={{ height: '30px', borderRadius: '2px' }} title={p.personaname} /></th>)}
                       </tr>
                    </thead>
                    <tbody>
                       <tr>
                         <td><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png" style={{ height: '24px' }} title="Observer Wards" /></td>
                         {dire.map((p: any) => <td key={p.hero_id}><input type="checkbox" checked={direHeroFilters[p.hero_id]?.obs || false} onChange={e => toggleDireHero(p.hero_id, 'obs', e.target.checked)} /></td>)}
                       </tr>
                       <tr>
                         <td><img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png" style={{ height: '24px' }} title="Sentry Wards" /></td>
                         {dire.map((p: any) => <td key={p.hero_id}><input type="checkbox" checked={direHeroFilters[p.hero_id]?.sen || false} onChange={e => toggleDireHero(p.hero_id, 'sen', e.target.checked)} /></td>)}
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
      
      {/* Player Tables */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
        <TeamTable title="Radiant - Vision" players={radiant} columns={visionCols} winner={matchData?.radiant_win} />
        <TeamTable title="Dire - Vision" players={dire} columns={visionCols} winner={!matchData?.radiant_win} />
      </div>
      
      {/* Ward Log Table */}
      <div>
         <TeamTable title="Ward Log" players={wardLog} columns={wardLogCols} noOverflow={true} />
      </div>
    </div>
  );
}

// ================ ACTIONS TAB ================
export function ActionsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const ACTION_TYPES = [
    { key: '1', label: 'MV [P]' },
    { key: '2', label: 'MV [T]' },
    { key: '3', label: 'ATK [P]' },
    { key: '4', label: 'ATK [T]' },
    { key: '5', label: 'CST [P]' },
    { key: '6', label: 'CST [T]' },
    { key: '8', label: 'CST [N]' },
    { key: '10', label: 'HLD' },
    { key: '24', label: 'GLYPH' },
    { key: '31', label: 'SCN' }
  ];

  const actionCols: any[] = ([
    { 
      key: 'apm', 
      label: 'APM', 
      sortFn: (a: any, b: any) => (a.actions_per_min || 0) - (b.actions_per_min || 0), 
      render: (p: any) => <PercentBar value={p.actions_per_min || 0} max={Math.max(...allPlayers.map((x:any)=>x.actions_per_min||0))} /> 
    }
  ] as any[]).concat(ACTION_TYPES.map(act => ({
    key: `act_${act.key}`,
    label: act.label,
    sortFn: (a: any, b: any) => (a.actions?.[act.key] || 0) - (b.actions?.[act.key] || 0),
    render: (p: any) => {
      const val = p.actions?.[act.key] || 0;
      const maxVal = Math.max(...allPlayers.map((x:any) => x.actions?.[act.key] || 0));
      return val > 0 ? <PercentBar value={val} max={maxVal} /> : '-';
    }
  })));

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Actions" players={radiant} columns={actionCols} winner={radiantWin} />
      <TeamTable title="Dire - Actions" players={dire} columns={actionCols} winner={!radiantWin} />
    </div>
  );
}

// ================ TEAMFIGHTS TAB ================
export function TeamfightsTab({ teamfights, allPlayers }: { teamfights: any[]; allPlayers: any[] }) {
  const [selectedTf, setSelectedTf] = useState<number>(0);

  if (!teamfights?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No teamfight data available.</div>;

  const formatTime = (t: number) => {
    const neg = t < 0;
    const abs = Math.abs(t);
    return `${neg ? '-' : ''}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
  };

  const tf = teamfights[selectedTf];
  const maxDamage = Math.max(...tf.players.map((p: any) => p.damage || 0));
  const maxHealing = Math.max(...tf.players.map((p: any) => p.healing || 0));
  const maxGold = Math.max(...tf.players.map((p: any) => Math.abs(p.gold_delta || 0)));
  const maxXp = Math.max(...tf.players.map((p: any) => Math.abs(p.xp_delta || 0)));

  const renderBar = (val: number, max: number, color: string) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const pct = max > 0 ? (Math.abs(val) / max) * 100 : 0;
    const c = val < 0 ? 'var(--dire-red)' : color;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', minWidth: '40px', maxWidth: '60px', margin: '0 auto' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{val < 0 ? '' : ''}{val}</span>
        <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: c }} />
        </div>
      </div>
    );
  };

  const renderAbilityGrid = (uses: any) => {
    if (!uses || Object.keys(uses).length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'flex-start', maxWidth: '100px' }}>
        {Object.entries(uses).map(([k, v]: any) => (
          <div key={k} style={{ position: 'relative' }}>
            <img src={getAbilityImage(k)} style={{ width: '20px', height: '20px', border: '1px solid rgba(0,0,0,0.5)' }} onError={(e) => { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none'; }} />
            <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '0.65rem', background: 'black', padding: '0 2px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.2)' }}>{v}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderItemGrid = (uses: any) => {
    if (!uses || Object.keys(uses).length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'flex-start', maxWidth: '100px' }}>
        {Object.entries(uses).map(([k, v]: any) => (
          <div key={k} style={{ position: 'relative' }}>
            <img src={getItemImage(k.replace('item_', ''))} style={{ width: '28px', height: '20px', border: '1px solid rgba(0,0,0,0.5)', objectFit: 'cover' }} />
            <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '0.65rem', background: 'black', padding: '0 2px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.2)' }}>{v}</span>
          </div>
        ))}
      </div>
    );
  };

  const cols = [
    { key: 'death', label: 'DEATH', render: (p: any) => p.deaths > 0 ? <span style={{ color: 'var(--dire-red)', fontSize: '1.2rem' }}>💀</span> : '' },
    { key: 'damage', label: 'DAMAGE', sortFn: (a: any, b: any) => (a.damage || 0) - (b.damage || 0), render: (p: any) => renderBar(p.damage || 0, maxDamage, 'var(--accent-gold)') },
    { key: 'healing', label: 'HEALING', sortFn: (a: any, b: any) => (a.healing || 0) - (b.healing || 0), render: (p: any) => renderBar(p.healing || 0, maxHealing, 'var(--radiant-green)') },
    { key: 'gold_delta', label: 'G', sortFn: (a: any, b: any) => (a.gold_delta || 0) - (b.gold_delta || 0), render: (p: any) => renderBar(p.gold_delta || 0, maxGold, '#ff9800') },
    { key: 'xp_delta', label: 'XP', sortFn: (a: any, b: any) => (a.xp_delta || 0) - (b.xp_delta || 0), render: (p: any) => renderBar(p.xp_delta || 0, maxXp, '#42a5f5') },
    { key: 'abilities', label: 'ABILITIES', render: (p: any) => renderAbilityGrid(p.ability_uses) },
    { key: 'items', label: 'ITEMS', render: (p: any) => renderItemGrid(p.item_uses) }
  ];

  const mapEvents: any[] = [];
  let radiantKills = 0;
  let direKills = 0;
  
  if (tf.players) {
    tf.players.forEach((p: any, i: number) => {
      if (p.deaths > 0) {
        const isRad = allPlayers[i].player_slot < 128;
        if (isRad) direKills++; else radiantKills++;
        if (p.deaths_pos) {
          // OpenDota deaths_pos format needs mapping if it exists
          // Sometimes it's an object of { "x,y": count }, sometimes just x and y if mapped
          // We will attempt to parse it safely.
          const px = p.deaths_pos.x || 0;
          const py = p.deaths_pos.y || 0;
          let left = 0, top = 0;
          if (px && py) {
             left = Math.min(100, Math.max(0, ((px - 64) / 128) * 100));
             top = Math.min(100, Math.max(0, (1 - ((py - 64) / 128)) * 100));
          } else {
             // Handle { "123,145": 1 }
             const k = Object.keys(p.deaths_pos)[0];
             if (k && k.includes(',')) {
                const [x,y] = k.split(',').map(Number);
                left = Math.min(100, Math.max(0, ((x - 64) / 128) * 100));
                top = Math.min(100, Math.max(0, (1 - ((y - 64) / 128)) * 100));
             }
          }
          if (left && top) {
            mapEvents.push({ left, top, color: isRad ? 'var(--radiant-green)' : 'var(--dire-red)' });
          }
        }
      }
    });
  }

  const matchDuration = Math.max(...teamfights.map((t: any) => t.end || 0));

  return (
    <div className="animation-fade-in" style={{ padding: '1rem 0' }}>
      
      {/* TIMELINE */}
      <div style={{ position: 'relative', width: '100%', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', marginBottom: '2rem', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, width: '100%', height: '2px', background: 'rgba(255,255,255,0.2)' }} />
        {teamfights.map((t: any, i: number) => {
          const left = (t.start / matchDuration) * 100;
          const isSelected = selectedTf === i;
          return (
            <div 
              key={i} 
              onClick={() => setSelectedTf(i)}
              style={{
                position: 'absolute', 
                left: `${left}%`, 
                width: '16px', height: '16px', 
                background: isSelected ? 'var(--accent-gold)' : 'var(--dire-red)',
                borderRadius: '50%',
                transform: 'translate(-50%, 0)',
                cursor: 'pointer',
                border: isSelected ? '2px solid #fff' : '2px solid #000',
                zIndex: isSelected ? 10 : 1
              }}
              title={`Teamfight ${i+1}
${formatTime(t.start)} - ${formatTime(t.end)}
Deaths: ${t.deaths}`}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* MAP & SUMMARY */}
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '350px', height: '350px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src="/map.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.style.background = '#222'; }} />
            {mapEvents.map((m: any, i: number) => (
              <div key={i} style={{
                position: 'absolute', left: `${m.left}%`, top: `${m.top}%`,
                width: '12px', height: '12px', background: m.color, borderRadius: '50%',
                transform: 'translate(-50%, -50%)', border: '1px solid #000'
              }} />
            ))}
          </div>
          
          <div className="glass-surface" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>{formatTime(tf.start)} - {formatTime(tf.end)}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', color: 'var(--radiant-green)' }}>{radiantKills}</span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RADIANT</div>
              </div>
              <div style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>-</div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', color: 'var(--dire-red)' }}>{direKills}</span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DIRE</div>
              </div>
            </div>
          </div>
        </div>

        {/* TABLES */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <TeamTable 
            title="Radiant - Teamfights" 
            players={allPlayers.filter(p => p.player_slot < 128).map((p, i) => ({ ...p, ...tf.players[i] }))}
            columns={cols}
          />
          <TeamTable 
            title="Dire - Teamfights" 
            players={allPlayers.filter(p => p.player_slot >= 128).map((p, i) => ({ ...p, ...tf.players[i+5] }))}
            columns={cols}
          />
        </div>
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

// ================ GRAPHS TAB ================
export function GraphsTab({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  if (!matchData.radiant_gold_adv || !matchData.radiant_xp_adv) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Graph data not available.</div>;
  
  let goldAdv = matchData.radiant_gold_adv;
  let xpAdv = matchData.radiant_xp_adv;
  if (typeof goldAdv === 'string') goldAdv = JSON.parse(goldAdv);
  if (typeof xpAdv === 'string') xpAdv = JSON.parse(xpAdv);

  const advData = goldAdv.map((val: number, idx: number) => ({
    time: idx,
    gold: val,
    xp: xpAdv[idx] || 0
  }));

  const maxAdvVal = Math.max(...advData.map((d: any) => Math.max(Math.abs(d.gold), Math.abs(d.xp))));
  const gradientOffset = () => {
    const dataMax = Math.max(...advData.map((i: any) => Math.max(i.gold, i.xp)));
    const dataMin = Math.min(...advData.map((i: any) => Math.min(i.gold, i.xp)));
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    return dataMax / (dataMax - dataMin);
  };
  const off = gradientOffset();

  const playerColors = [
    '#3375FF', '#66FFBF', '#BF00BF', '#F3F00B', '#FF6B00', // Radiant
    '#FE86C2', '#A1B447', '#65D9F7', '#008321', '#A46900'  // Dire
  ];

  const getHeroName = (slot: number) => {
    const p = allPlayers.find((x: any) => x.player_slot === slot);
    return p ? HEROES[p.hero_id]?.name || 'Unknown' : 'Unknown';
  };

  // Helper to build array for a specific metric (networth_t, gold_t, etc.)
  const buildLineData = (key: string) => {
    const length = advData.length;
    const res = [];
    for (let i = 0; i < length; i++) {
      const point: any = { time: i };
      allPlayers.forEach((p, idx) => {
        let arr = p[key];
        if (typeof arr === 'string') arr = JSON.parse(arr);
        point[`player_${idx}`] = (arr && arr.length > i) ? arr[i] : (arr && arr.length ? arr[arr.length-1] : 0);
      });
      res.push(point);
    }
    return res;
  };

  const hasData = (key: string) => allPlayers.some(p => {
    let arr = p[key];
    if (typeof arr === 'string') arr = JSON.parse(arr);
    return arr && arr.length > 0;
  });

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
      return (
        <div style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid #323232', borderRadius: '6px', padding: '10px 14px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#fff' }}>
            {label}:00
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sorted.map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: p.stroke }} />
                   <span style={{ color: p.stroke, fontWeight: 600 }}>{p.name}</span>
                </div>
                <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 500 }}>{p.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLineChart = (title: string, dataKey: string) => {
    if (!hasData(dataKey)) return null;
    const chartData = buildLineData(dataKey);
    return (
      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>{title}</h3>
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" tickFormatter={(t) => t + ':00'} />
              <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(val) => val.toLocaleString()} />
              <Tooltip content={<CustomLineTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }} 
                iconType="circle"
              />
              {allPlayers.map((p, idx) => (
                <Line 
                  key={idx} 
                  type="monotone" 
                  dataKey={`player_${idx}`} 
                  name={getHeroName(p.player_slot)} 
                  stroke={playerColors[idx]} 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="animation-fade-in" style={{ padding: '1rem 0' }}>
      <div style={{ marginBottom: '4rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Radiant Advantage</h3>
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={advData} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" tickFormatter={(t) => t + ':00'} />
              <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(val) => Math.abs(val) > 1000 ? (Math.abs(val)/1000).toFixed(1) + 'k' : Math.abs(val).toString()} domain={[-maxAdvVal, maxAdvVal]} />
              <Tooltip 
                contentStyle={{ background: '#1a1f26', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                labelFormatter={(label) => label + ':00'}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
              <defs>
                <linearGradient id="splitColorGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={off} stopColor="var(--accent-gold)" stopOpacity={0.8} />
                  <stop offset={off} stopColor="var(--accent-gold)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="splitColorXP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={off} stopColor="#4da6ff" stopOpacity={0.8} />
                  <stop offset={off} stopColor="#4da6ff" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="gold" stroke="var(--accent-gold)" strokeWidth={2} fill="url(#splitColorGold)" name="Gold" />
              <Area type="monotone" dataKey="xp" stroke="#4da6ff" strokeWidth={2} fill="url(#splitColorXP)" name="Experience" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {renderLineChart('Net Worth', 'networth_t')}
      {renderLineChart('Gold', 'gold_t')}
      {renderLineChart('Experience', 'xp_t')}
      {renderLineChart('Last Hits', 'lh_t')}
      {renderLineChart('Hero Damage', 'hero_damage_t')}
      {renderLineChart('Hero Healing', 'hero_healing_t')}
      {renderLineChart('Camps Stacked', 'camps_stacked_t')}
    </div>
  );
}