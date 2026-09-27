import { HEROES } from '../lib/heroes';
import { ITEMS, getHeroImage, getItemImage, getAbilityImage, getHeroIcon } from '../lib/dota';
import abilityIdsJson from '../lib/constants/ability_ids.json';
import { IconRadiant, IconDire } from './Icons';

const ABILITY_IDS: Record<string, string> = abilityIdsJson;

function formatTime(secs: number) {
  if (secs == null) return '';
  const sign = secs < 0 ? '-' : '';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const resolveItemName = (item: any) => {
  if (item == null) return null;
  return typeof item === 'number' || !isNaN(Number(item))
    ? ITEMS[Number(item)]?.name?.replace('item_', '') || String(item).replace('item_', '')
    : String(item).replace('item_', '');
};

const ItemIcon = ({ item, size = 44 }: { item: any; size?: number }) => {
  const itemName = resolveItemName(item);
  if (!itemName || itemName === 'empty' || itemName === 'null') {
    return <div style={{ width: `${size * 1.35}px`, height: `${size}px`, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />;
  }
  return (
    <div style={{ width: `${size * 1.35}px`, height: `${size}px`, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
      <img src={getItemImage(itemName)} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );
};

export default function PlayerDetail({ matchData, selectedPlayer, allPlayers, setSelectedPlayer }: any) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);
  
  const pb = matchData.picks_bans || [];
  const radBans = pb.filter((x: any) => x.team === 0 && !x.is_pick);
  const direBans = pb.filter((x: any) => x.team === 1 && !x.is_pick);
  const radPicks = pb.filter((x: any) => x.team === 0 && x.is_pick);
  const direPicks = pb.filter((x: any) => x.team === 1 && x.is_pick);

  const purchaseLog = selectedPlayer.purchase_log || [];
  const startingItems = purchaseLog.filter((l: any) => l.time <= 0);
  
  const importantItems = purchaseLog.filter((l: any) => {
    const key = l.key.replace('item_', '');
    if (key.includes('recipe')) return false;
    if (['tango', 'flask', 'clarity', 'mango', 'ward_observer', 'ward_sentry', 'tpscroll', 'branches'].includes(key)) return false;
    return ITEMS[key] && ITEMS[key].cost > 1000;
  });

  const regenItems = purchaseLog.filter((l: any) => {
    const key = l.key.replace('item_', '');
    return ['tango', 'flask', 'clarity', 'mango', 'bottle'].includes(key);
  });

  const TimelineBracket = ({ min, title }: { min: number, title: string }) => {
    if (matchData.duration < (min - 10) * 60) return null;
    const bracketStart = (min - 10) * 60;
    const bracketEnd = min * 60;
    const bracketItems = importantItems.filter((l: any) => l.time > bracketStart && l.time <= bracketEnd);
    
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{formatTime(min * 60)} {title}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1.5rem' }}>
          <div className="glass-surface" style={{ padding: '1rem' }}>
             {/* Left Block Placeholder for bracket items */}
             <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
               {bracketItems.length > 0 ? bracketItems.map((item: any, i: number) => (
                 <div key={i}><ItemIcon item={item.key} size={30} /></div>
               )) : <div className="text-secondary">No major items.</div>}
             </div>
          </div>
          <div className="glass-surface" style={{ padding: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Significant Items Purchased</h4>
            {bracketItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {bracketItems.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ItemIcon item={item.key} size={24} />
                      <span>{ITEMS[item.key.replace('item_', '')]?.dname || item.key}</span>
                    </div>
                    <span className="text-secondary">{formatTime(item.time)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-secondary">No significant items were purchased within this time period.</div>
            )}
          </div>
          <div className="glass-surface" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-secondary">Minimap</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ padding: '0 1rem 4rem 1rem' }}>
      
      {/* 1. Top Header Hero Selector */}
      <div className="glass-surface" style={{ display: 'flex', gap: '2rem', padding: '1rem', alignItems: 'center', overflowX: 'auto', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <IconRadiant style={{ width: '24px', height: '24px' }} />
          {radiant.map((p: any) => (
            <div key={p.player_slot} onClick={() => setSelectedPlayer(p)} style={{ cursor: 'pointer', transition: 'all 0.2s', opacity: p.player_slot === selectedPlayer.player_slot ? 1 : 0.4, border: p.player_slot === selectedPlayer.player_slot ? '2px solid var(--radiant-green)' : '2px solid transparent', borderRadius: '50%' }}>
              <img src={getHeroIcon(HEROES[p.hero_id]?.img_name)} alt="Hero" style={{ width: '44px', height: '44px', borderRadius: '50%' }} />
            </div>
          ))}
        </div>
        <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {dire.map((p: any) => (
            <div key={p.player_slot} onClick={() => setSelectedPlayer(p)} style={{ cursor: 'pointer', transition: 'all 0.2s', opacity: p.player_slot === selectedPlayer.player_slot ? 1 : 0.4, border: p.player_slot === selectedPlayer.player_slot ? '2px solid var(--dire-red)' : '2px solid transparent', borderRadius: '50%' }}>
              <img src={getHeroIcon(HEROES[p.hero_id]?.img_name)} alt="Hero" style={{ width: '44px', height: '44px', borderRadius: '50%' }} />
            </div>
          ))}
          <IconDire style={{ width: '24px', height: '24px' }} />
        </div>
      </div>

      {/* 2. Post-Game Stats at the top */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Post-Game Stats</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '3rem' }}>
        <div className="glass-surface" style={{ gridColumn: 'span 2', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary">Level</div>
          <h2>{selectedPlayer.level}</h2>
          <div style={{ display: 'flex', gap: '0.2rem', marginTop: '1rem' }}>
            {[0, 1, 2, 3, 4, 5].map(i => <ItemIcon key={i} item={selectedPlayer[`item_${i}`]} size={32} />)}
          </div>
        </div>
        <div className="glass-surface" style={{ gridColumn: 'span 2', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary">Net Worth</div>
          <h2 style={{ color: 'var(--accent-gold)' }}>{selectedPlayer.net_worth}</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center' }}><div className="text-secondary">Kills</div><strong style={{ color: 'var(--radiant-green)' }}>{selectedPlayer.kills}</strong></div>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center' }}><div className="text-secondary">Deaths</div><strong style={{ color: 'var(--dire-red)' }}>{selectedPlayer.deaths}</strong></div>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center' }}><div className="text-secondary">Assists</div><strong>{selectedPlayer.assists}</strong></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">IMP</div><strong>{selectedPlayer.imp || 'N/A'}</strong></div>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">Kill Contrib</div><strong>{Math.round(((selectedPlayer.kills + selectedPlayer.assists) / (selectedPlayer.player_slot < 128 ? matchData.radiant_score : matchData.dire_score)) * 100) || 0}%</strong></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">GPM</div><strong style={{ color: 'var(--accent-gold)' }}>{selectedPlayer.gpm}</strong></div>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">XPM</div><strong style={{ color: 'var(--radiant-green)' }}>{selectedPlayer.xpm}</strong></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">Last Hits</div><strong>{selectedPlayer.last_hits}</strong></div>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">Denies</div><strong>{selectedPlayer.denies}</strong></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">Hero Damage</div><strong style={{ color: 'var(--dire-red)' }}>{selectedPlayer.hero_damage}</strong></div>
          <div className="glass-surface" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div className="text-secondary">Tower Damage</div><strong>{selectedPlayer.tower_damage}</strong></div>
        </div>
      </div>

      {/* 3. Ability and Item Build */}
      <div className="glass-surface" style={{ padding: '0', marginBottom: '3rem' }}>
        <h3 className="gold-text-gradient" style={{ margin: '0', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Ability and Item Build</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '0' }}>
          <div style={{ padding: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <img src={getHeroIcon(HEROES[selectedPlayer.hero_id]?.img_name)} style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  {[0,1,2].map(i => <ItemIcon key={i} item={selectedPlayer[`item_${i}`]} size={24} />)}
                </div>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  {[3,4,5].map(i => <ItemIcon key={i} item={selectedPlayer[`item_${i}`]} size={24} />)}
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1rem' }}>
              {Array.from({ length: 25 }).map((_, i) => {
                const abilityId = selectedPlayer.ability_upgrades_arr?.[i];
                const abilityName = abilityId ? ABILITY_IDS[String(abilityId)] : null;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '32px' }}>
                    <div className="text-secondary" style={{ fontSize: '0.7rem' }}>{i + 1}</div>
                    {abilityName ? (
                      <img src={getAbilityImage(abilityName)} alt="ability" style={{ width: '32px', height: '32px', borderRadius: '4px' }} title={abilityName} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', marginTop: '1.5rem' }}>
              <div className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Significant Items</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {importantItems.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <ItemIcon item={item.key} size={28} />
                    <span style={{ fontSize: '0.7rem' }}>{formatTime(item.time)}</span>
                  </div>
                ))}
              </div>
              <div className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Regen</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {regenItems.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <ItemIcon item={item.key} size={28} />
                    <span style={{ fontSize: '0.7rem' }}>{formatTime(item.time)}</span>
                  </div>
                ))}
              </div>
              <div className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Neutral Items</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedPlayer.neutral_item && selectedPlayer.neutral_item !== 'empty' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-gold)' }}>
                      <img src={getItemImage(resolveItemName(selectedPlayer.neutral_item) || '')} alt="Neutral" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Match Recap */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Match Recap</h3>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-surface" style={{ flex: 1, padding: '0' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
             <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><IconRadiant style={{ width: '16px' }} /> Radiant Ban Nominations</span>
             <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>Dire Ban Nominations <IconDire style={{ width: '16px' }} /></span>
           </div>
           <div style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {radBans.map((b: any) => <div key={b.order} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><img src={getHeroImage(HEROES[b.hero_id]?.img_name)} style={{ width: '40px', borderRadius: '4px', filter: 'grayscale(100%)' }} /> <span className="text-secondary">{HEROES[b.hero_id]?.name}</span></div>)}
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
               {direBans.map((b: any) => <div key={b.order} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: 'row-reverse' }}><img src={getHeroImage(HEROES[b.hero_id]?.img_name)} style={{ width: '40px', borderRadius: '4px', filter: 'grayscale(100%)' }} /> <span className="text-secondary">{HEROES[b.hero_id]?.name}</span></div>)}
             </div>
           </div>
           {radBans.length === 0 && direBans.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hero nominated</div>}
        </div>

        <div className="glass-surface" style={{ flex: 1, padding: '0' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
             <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><IconRadiant style={{ width: '16px' }} /> Radiant Picks</span>
             <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>Dire Picks <IconDire style={{ width: '16px' }} /></span>
           </div>
           <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {radPicks.map((b: any) => (
                 <div key={b.order} style={{ border: selectedPlayer.hero_id === b.hero_id ? '2px solid var(--accent-gold)' : '2px solid transparent', borderRadius: '4px' }}>
                   <img src={getHeroImage(HEROES[b.hero_id]?.img_name)} style={{ width: '50px', display: 'block', borderRadius: '2px' }} />
                 </div>
               ))}
             </div>
             <div style={{ textAlign: 'center' }}>
               <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Picked {HEROES[selectedPlayer.hero_id]?.name}</div>
               <h3>{pb.find((p:any) => p.hero_id === selectedPlayer.hero_id)?.order < 10 ? 'First Phase' : pb.find((p:any) => p.hero_id === selectedPlayer.hero_id)?.order < 18 ? 'Second Phase' : 'Third Phase'}</h3>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
               {direPicks.map((b: any) => (
                 <div key={b.order} style={{ border: selectedPlayer.hero_id === b.hero_id ? '2px solid var(--accent-gold)' : '2px solid transparent', borderRadius: '4px' }}>
                   <img src={getHeroImage(HEROES[b.hero_id]?.img_name)} style={{ width: '50px', display: 'block', borderRadius: '2px' }} />
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* 5. Starting Build + Matchups */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>-01:40 Starting Build + Matchups</h3>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-surface" style={{ flex: 2, padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {startingItems.map((item: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <ItemIcon item={item.key} size={32} />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{ITEMS[item.key.replace('item_', '')]?.dname || item.key}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>🪙 {ITEMS[item.key.replace('item_', '')]?.cost || 0}</div>
                </div>
              </div>
            ))}
            {startingItems.length === 0 && <div className="text-secondary">No starting items logged.</div>}
          </div>
        </div>
        <div className="glass-surface" style={{ flex: 1, padding: '1rem', display: 'flex', justifyContent: 'center' }}>
          <img src="/minimap.png" style={{ width: '100%', maxWidth: '200px', opacity: 0.5, borderRadius: '4px' }} />
        </div>
      </div>

      {/* 6. Vision by First Minute */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>01:00 Vision by First Minute</h3>
      <div className="glass-surface" style={{ display: 'flex', padding: '1.5rem', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><IconRadiant style={{ width: '16px' }} /> Radiant Ward Placements</div>
          <div className="text-secondary">Ward data unavailable.</div>
        </div>
        <div style={{ width: '150px', height: '150px', background: '#000', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <img src="/minimap.png" style={{ width: '100%', height: '100%', opacity: 0.5 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><IconDire style={{ width: '16px' }} /> Dire Ward Placements</div>
          <div className="text-secondary">Ward data unavailable.</div>
        </div>
      </div>

      {/* 7. Timeline Brackets */}
      {[10, 20, 30, 40].map(min => <TimelineBracket key={min} min={min} title={min===10?'Laning':min===20?'Early Game':min===30?'Mid Game':'Late Game'} />)}

    </div>
  );
}
