import { useState } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getHeroIcon } from '../lib/dota';
import { getPlayerPosition } from '../lib/roles';
import { IconRadiant, IconDire } from './Icons';

// Aggregates lane_pos for multiple players
function getAggregatedHeatmap(players: any[]) {
  const grid: Record<number, Record<number, number>> = {};
  let maxHeat = 0;
  
  players.forEach(p => {
    if (p.lane_pos) {
      Object.entries(p.lane_pos).forEach(([xStr, yDict]: any) => {
        const x = Number(xStr);
        if (!grid[x]) grid[x] = {};
        Object.entries(yDict).forEach(([yStr, count]: any) => {
          const y = Number(yStr);
          const cnt = Number(count);
          grid[x][y] = (grid[x][y] || 0) + cnt;
        });
      });
    }
  });

  const points: any[] = [];
  Object.entries(grid).forEach(([xStr, yDict]) => {
    Object.entries(yDict).forEach(([yStr, count]) => {
      if (count > maxHeat) maxHeat = count;
      points.push({ x: Number(xStr), y: Number(yStr), count });
    });
  });
  
  return { points, maxHeat };
}

const RoleIcon = ({ role, size = 18 }: { role: number, size?: number }) => {
  if (role === 1) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#5c6bc0" strokeWidth="2"><path d="M4 20 L16 8 M16 8 L13 8 M16 8 L16 11"/></svg>; 
  if (role === 2) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#26c6da" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>; 
  if (role === 3) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ff9800" strokeWidth="2"><path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z"/></svg>; 
  if (role === 4) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2"><path d="M12 2 C12 2 18 8 18 14 A6 6 0 0 1 6 14 C6 8 12 2 12 2 Z"/></svg>; 
  if (role === 5) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#66bb6a" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12h6 M12 9v6"/></svg>; 
  return null;
}

function LargeMovementMap({ allPlayers, defaultCheckedSlots }: { allPlayers: any[]; defaultCheckedSlots: number[] }) {
  const [checkedSlots, setCheckedSlots] = useState<Set<number>>(new Set(defaultCheckedSlots));
  
  const handleToggle = (slot: number) => {
    const next = new Set(checkedSlots);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    setCheckedSlots(next);
  };

  const radiant = allPlayers.filter(p => p.player_slot < 128);
  const dire = allPlayers.filter(p => p.player_slot >= 128);
  
  const activePlayers = allPlayers.filter(p => checkedSlots.has(p.player_slot));
  const { points, maxHeat } = getAggregatedHeatmap(activePlayers);

  return (
    <div className="glass-surface" style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', flex: '1 1 0', minWidth: '400px' }}>
      {/* Radiant Checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
        {radiant.map(p => {
          const hero = HEROES[p.hero_id as keyof typeof HEROES];
          return (
            <div key={p.player_slot} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => handleToggle(p.player_slot)}>
              <div style={{ 
                width: '18px', height: '18px', border: '1px solid var(--border-color)', borderRadius: '3px',
                background: checkedSlots.has(p.player_slot) ? 'var(--radiant-green)' : 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {checkedSlots.has(p.player_slot) && <span style={{ color: '#000', fontSize: '14px', lineHeight: 1 }}>✓</span>}
              </div>
              {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '40px', height: '22px', objectFit: 'cover', borderRadius: '3px' }} />}
            </div>
          );
        })}
      </div>
      
      {/* Map */}
      <div style={{ flex: 1, position: 'relative', aspectRatio: '1/1', background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
        <img src="/minimap.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
        {points.map((pt, i) => {
          const left = ((pt.x - 64) / 128) * 100;
          const top = (1 - ((pt.y - 64) / 128)) * 100;
          const intensity = maxHeat > 0 ? pt.count / maxHeat : 0;
          const hue = (1 - intensity) * 240;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`,
              width: '24px', height: '24px', transform: 'translate(-50%, -50%)', borderRadius: '50%',
              background: `radial-gradient(circle, hsla(${hue}, 100%, 50%, ${intensity * 0.8 + 0.2}) 0%, transparent 70%)`,
              zIndex: 2, pointerEvents: 'none'
            }} />
          );
        })}
      </div>

      {/* Dire Checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
        {dire.map(p => {
          const hero = HEROES[p.hero_id as keyof typeof HEROES];
          return (
            <div key={p.player_slot} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flexDirection: 'row-reverse' }} onClick={() => handleToggle(p.player_slot)}>
              <div style={{ 
                width: '18px', height: '18px', border: '1px solid var(--border-color)', borderRadius: '3px',
                background: checkedSlots.has(p.player_slot) ? 'var(--dire-red)' : 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {checkedSlots.has(p.player_slot) && <span style={{ color: '#000', fontSize: '14px', lineHeight: 1 }}>✓</span>}
              </div>
              {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '40px', height: '22px', objectFit: 'cover', borderRadius: '3px' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniMovementMap({ players, isTeamControl, isRadiant, singleHero }: { players: any[], isTeamControl?: boolean, isRadiant?: boolean, singleHero?: boolean }) {
  const { points, maxHeat } = getAggregatedHeatmap(players);
  const colorHex = isRadiant ? '#51a445' : '#c2352b';
  
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
      <img src="/minimap.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
      {points.map((pt, i) => {
        const left = ((pt.x - 64) / 128) * 100;
        const top = (1 - ((pt.y - 64) / 128)) * 100;
        const intensity = maxHeat > 0 ? pt.count / maxHeat : 0;
        
        let bg;
        if (isTeamControl) {
           bg = `radial-gradient(circle, ${colorHex}${Math.floor((intensity * 0.8 + 0.1)*255).toString(16).padStart(2,'0')} 0%, transparent 60%)`;
        } else {
           const hue = (1 - intensity) * 240;
           bg = `radial-gradient(circle, hsla(${hue}, 100%, 50%, ${intensity * 0.8 + 0.2}) 0%, transparent 70%)`;
        }
        
        return (
          <div key={i} style={{
            position: 'absolute', left: `${left}%`, top: `${top}%`,
            width: singleHero ? '28px' : '20px', height: singleHero ? '28px' : '20px', transform: 'translate(-50%, -50%)', borderRadius: '50%',
            background: bg,
            zIndex: 2, pointerEvents: 'none'
          }} />
        );
      })}
      
      {/* Hero Icon */}
      {singleHero && players.length === 1 && (
        <div style={{ position: 'absolute', bottom: '4px', left: '4px', zIndex: 10 }}>
           <img src={getHeroIcon(HEROES[players[0].hero_id as keyof typeof HEROES]?.img_name)} 
                alt="Hero"
                style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)', background: '#000' }} />
        </div>
      )}
    </div>
  );
}

export default function MovementTab({ allPlayers }: { allPlayers: any[] }) {
  const radiant = allPlayers.filter(p => p.player_slot < 128);
  const dire = allPlayers.filter(p => p.player_slot >= 128);

  const getPlayerByRole = (team: any[], role: number) => {
    return team.find(p => getPlayerPosition(p, team) === role);
  };

  return (
    <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Section: 2 Large Maps */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <LargeMovementMap 
          allPlayers={allPlayers} 
          defaultCheckedSlots={radiant.map(p => p.player_slot)} 
        />
        <LargeMovementMap 
          allPlayers={allPlayers} 
          defaultCheckedSlots={dire.map(p => p.player_slot)} 
        />
      </div>

      {/* Bottom Section: Grid of Heatmaps */}
      <div className="glass-surface" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '900px' }}>
          <thead>
            <tr>
              <th style={{ width: '60px', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}></th>
              <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}></th>
              <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><RoleIcon role={1} /></th>
              <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><RoleIcon role={2} /></th>
              <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><RoleIcon role={3} /></th>
              <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><RoleIcon role={4} /></th>
              <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><RoleIcon role={5} /></th>
            </tr>
          </thead>
          <tbody>
            {/* Radiant Row */}
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '1rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <IconRadiant style={{ width: '30px', height: '30px', opacity: 0.8 }} />
              </td>
              <td style={{ padding: '0.5rem', width: '15%' }}>
                <MiniMovementMap players={radiant} isTeamControl={true} isRadiant={true} />
              </td>
              {[1, 2, 3, 4, 5].map(role => {
                const p = getPlayerByRole(radiant, role);
                return (
                  <td key={role} style={{ padding: '0.5rem', width: '15%' }}>
                    <MiniMovementMap players={p ? [p] : []} singleHero={true} />
                  </td>
                );
              })}
            </tr>
            {/* Dire Row */}
            <tr>
              <td style={{ padding: '1rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <IconDire style={{ width: '30px', height: '30px', opacity: 0.8 }} />
              </td>
              <td style={{ padding: '0.5rem', width: '15%' }}>
                <MiniMovementMap players={dire} isTeamControl={true} isRadiant={false} />
              </td>
              {[1, 2, 3, 4, 5].map(role => {
                const p = getPlayerByRole(dire, role);
                return (
                  <td key={role} style={{ padding: '0.5rem', width: '15%' }}>
                    <MiniMovementMap players={p ? [p] : []} singleHero={true} />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
