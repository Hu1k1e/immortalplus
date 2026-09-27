import { useState } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getHeroIcon } from '../lib/dota';
import { getPlayerPosition, POSITION_INFO } from '../lib/roles';
import { IconRadiant, IconDire } from './Icons';
import PositionIcon from './PositionIcon';

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

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6B00',
  128: '#FE86C2', 129: '#A1B447', 130: '#65D9F7', 131: '#008321', 132: '#A46900'
};

const ROLE_COLORS: Record<number, string> = {
  1: '#5c6bc0',
  2: '#26c6da',
  3: '#ff9800',
  4: '#ef5350',
  5: '#66bb6a',
};

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
                width: '18px', height: '18px', border: 'none', borderRadius: '3px',
                background: checkedSlots.has(p.player_slot) ? (PLAYER_COLORS[p.player_slot] || 'var(--radiant-green)') : 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {checkedSlots.has(p.player_slot) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
              </div>
              {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '40px', height: '22px', objectFit: 'cover', borderRadius: '3px' }} />}
            </div>
          );
        })}
      </div>
      
      {/* Map */}
      <div style={{ flex: 1, position: 'relative', aspectRatio: '1/1', background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
        <img src="/minimap.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', filter: 'url(#heatmap-filter)' }}>
          {points.map((pt, i) => {
            const left = ((pt.x - 64) / 128) * 100;
            const top = (1 - ((pt.y - 64) / 128)) * 100;
            const intensity = maxHeat > 0 ? pt.count / maxHeat : 0;
            return (
              <div key={i} style={{
                position: 'absolute', left: `${left}%`, top: `${top}%`,
                width: '24px', height: '24px', transform: 'translate(-50%, -50%)', borderRadius: '50%',
                background: `radial-gradient(circle, rgba(0,0,0,${intensity * 0.8 + 0.2}) 0%, rgba(0,0,0,0) 70%)`,
                zIndex: 2, pointerEvents: 'none'
              }} />
            );
          })}
        </div>
      </div>

      {/* Dire Checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
        {dire.map(p => {
          const hero = HEROES[p.hero_id as keyof typeof HEROES];
          return (
            <div key={p.player_slot} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flexDirection: 'row-reverse' }} onClick={() => handleToggle(p.player_slot)}>
              <div style={{ 
                width: '18px', height: '18px', border: 'none', borderRadius: '3px',
                background: checkedSlots.has(p.player_slot) ? (PLAYER_COLORS[p.player_slot] || 'var(--dire-red)') : 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {checkedSlots.has(p.player_slot) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
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
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', filter: isTeamControl ? 'none' : 'url(#heatmap-filter)' }}>
        {points.map((pt, i) => {
          const left = ((pt.x - 64) / 128) * 100;
          const top = (1 - ((pt.y - 64) / 128)) * 100;
          const intensity = maxHeat > 0 ? pt.count / maxHeat : 0;
          
          let bg;
          if (isTeamControl) {
             bg = `radial-gradient(circle, ${colorHex}${Math.floor((intensity * 0.8 + 0.1)*255).toString(16).padStart(2,'0')} 0%, transparent 60%)`;
          } else {
             bg = `radial-gradient(circle, rgba(0,0,0,${intensity * 0.8 + 0.2}) 0%, rgba(0,0,0,0) 70%)`;
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
      </div>
      
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
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <filter id="heatmap-filter">
            <feColorMatrix type="matrix" values="
              0 0 0 0 0
              0 0 0 0 0
              0 0 0 0 0
              0 0 0 1 0" result="alphaOnly" />
            <feComponentTransfer in="alphaOnly">
              <feFuncR type="table" tableValues="0 0 0 0 1 1" />
              <feFuncG type="table" tableValues="0 0 1 1 1 0" />
              <feFuncB type="table" tableValues="0 1 1 0 0 0" />
              <feFuncA type="table" tableValues="0 0.3 0.6 0.8 1 1" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      
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
              {[1, 2, 3, 4, 5].map(role => (
                <th key={role} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div title={POSITION_INFO[role].label} style={{ display: 'flex', justifyContent: 'center' }}>
                    <PositionIcon short={POSITION_INFO[role].short} size={16} color={ROLE_COLORS[role]} />
                  </div>
                </th>
              ))}
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
