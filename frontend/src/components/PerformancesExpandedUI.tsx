import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';
import { getAbilityBuildOrder } from '../lib/talents';
import MatchMap from './MatchMap';

export default function PerformancesExpandedUI({ player, matchData }: { player: any, allPlayers: any[], matchData: any }) {
  const scrubMinutes = 10;
  const hero = HEROES[player.hero_id];
  const heroNpcName = hero ? `npc_dota_hero_${hero.img_name}` : undefined;

  const getLogUpTo = (log: any, maxSecs: number) => {
    let arr = log;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) return [];
    return arr.filter((e: any) => (e?.time ?? 0) <= maxSecs);
  };

  const maxSecs = scrubMinutes * 60;
  
  // Abilities
  let abilityUpgrades = player.ability_upgrades_arr || [];
  if (typeof abilityUpgrades === 'string') {
    try { abilityUpgrades = JSON.parse(abilityUpgrades); } catch { abilityUpgrades = []; }
  }
  const abilityOrder = getAbilityBuildOrder(heroNpcName, abilityUpgrades).filter(a => !a.isTalent);
  
  const uniqueAbilities = Array.from(new Set(abilityOrder.map(a => a.name))).slice(0, 4);

  // Items
  const items = getLogUpTo(player.purchase_log, maxSecs)
    .filter(e => e.key && !e.key.startsWith('recipe_') && e.key !== 'ward_dispenser')
    .map(e => e.key)
    .slice(-6);

  // Wards
  const obsPlaced = player.obs_placed || 0;
  const senPlaced = player.sen_placed || 0;
  const wardsDestroyedObs = getLogUpTo(player.kills_log, maxSecs).filter(e => e.key === 'npc_dota_ward_base').length;
  
  // Stacks
  const stacks = player.camps_stacked || 0;
  const hd = player.hero_damage || 0;
  const td = player.tower_damage || 0;
  const hh = player.hero_healing || 0;

  // Damage breakdown for circular rings
  let damageTargets = player.damage_targets || {};
  if (typeof damageTargets === 'string') {
    try { damageTargets = JSON.parse(damageTargets); } catch { damageTargets = {}; }
  }
  const damageList = Object.entries(damageTargets)
    .filter(([k]) => k.startsWith('npc_dota_hero_'))
    .map(([k, v]) => ({ name: k.replace('npc_dota_hero_', ''), damage: v as number }))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 3);
  const totalDamage = damageList.reduce((s, d) => s + d.damage, 0) || 1;

  // Graph data (Networth)
  const nwSeries = player.networth_t || [];
  const nwData = nwSeries.slice(0, 11).map((v: number, i: number) => ({ min: i, val: Math.round(v / 1000) }));
  
  const isRadiant = player.player_slot < 128;
  const teamColor = isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)';

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', background: '#0f1115', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
      {/* Left panel: Build */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '220px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
          <img src="/assets/images/dota2/talent_tree.svg" alt="Talent" style={{ width: '30px', height: '30px', opacity: 0.6 }} />
          {uniqueAbilities.map((name) => {
            const level = abilityUpgrades.filter((a: any) => a === name).length || 0; // approximation
            return (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <img src={getAbilityImage(name)} alt={name} style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1,2,3,4].map(l => (
                    <div key={l} style={{ width: '4px', height: '4px', borderRadius: '50%', background: l <= (level > 4 ? 4 : level) ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '0.4rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', gridColumn: '1 / span 3' }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ width: '100%', aspectRatio: '4/3', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                {items[i] && <img src={getItemImage(items[i])} alt={items[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ width: '28px', height: '21px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
               <img src={getItemImage('tpscroll')} alt="TP" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
          <span>10:00</span>
          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
             <div style={{ position: 'absolute', top: '-4px', right: '0', width: '12px', height: '12px', borderRadius: '50%', background: '#fff' }} />
             <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.4)', borderRadius: '2px' }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>10:00</span>
        </div>
      </div>

      <div style={{ width: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        {/* Top Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>Wards Planted</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 700 }}>
              <span style={{ color: '#eab308' }}>👁</span> {obsPlaced} 
              <span style={{ color: '#3b82f6' }}>👁</span> {senPlaced}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>Wards Destroyed</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 700 }}>
              <span style={{ color: '#22c55e' }}>👁</span> {wardsDestroyedObs} 
              <span style={{ color: '#3b82f6' }}>👁</span> 0
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>Fountain Trips</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>⛲ 2</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>Stacks</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>▤ {stacks}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>HD</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>{hd.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>TD</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>{td.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px' }}>HH</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>{hh.toLocaleString()}</div>
          </div>
        </div>

        {/* Bottom charts */}
        <div style={{ display: 'flex', gap: '0.5rem', height: '140px' }}>
          {/* Graph (stub) */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
             <svg width="100%" height="100%" preserveAspectRatio="none">
               {[2, 6, 10].map((v) => (
                 <line key={v} x1="0" y1={`${100 - (v/12)*100}%`} x2="100%" y2={`${100 - (v/12)*100}%`} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
               ))}
               {nwData.length > 1 && (
                 <polyline 
                   points={nwData.map((d: any, i: number) => `${(i / 10) * 100}%,${100 - (d.val/12)*100}%`).join(' ')} 
                   fill="none" 
                   stroke={teamColor} 
                   strokeWidth="2" 
                 />
               )}
               {nwData.length > 1 && (
                 <polygon 
                   points={`0,100% ${nwData.map((d: any, i: number) => `${(i / 10) * 100}%,${100 - (d.val/12)*100}%`).join(' ')} 100%,100%`} 
                   fill={`${teamColor}33`} 
                 />
               )}
             </svg>
             <div style={{ position: 'absolute', bottom: '4px', left: 0, width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 10px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
               {[2,3,4,5,6,7,8,9].map(m => <span key={m}>{m}:00</span>)}
             </div>
             <div style={{ position: 'absolute', left: '4px', top: 0, height: '100%', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', padding: '10px 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
               <span>2</span><span>6</span><span>10</span>
             </div>
          </div>

          {/* Rings */}
          <div style={{ width: '200px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 1rem' }}>
            {damageList.map((d, i) => {
               const pct = (d.damage / totalDamage) * 100;
               const ringColor = i === 0 ? 'var(--radiant-green)' : (i === 1 ? 'var(--radiant-green)' : 'var(--accent-gold)');
               return (
                 <div key={d.name} style={{ position: 'relative', width: '50px', height: '50px' }}>
                   <svg width="100%" height="100%" viewBox="0 0 36 36">
                     <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                     <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={ringColor} strokeWidth="4" strokeDasharray={`${pct}, 100`} />
                   </svg>
                   <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                     <img src={getHeroImage(d.name)} alt={d.name} style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '50%', marginBottom: '2px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                     <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{Math.round(pct)}</span>
                   </div>
                 </div>
               );
            })}
          </div>

          {/* Map */}
          <div style={{ width: '140px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
            {matchData ? <MatchMap matchData={matchData} selectedPlayer={player} controlledTime={maxSecs} compact={true} hideControls={true} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
