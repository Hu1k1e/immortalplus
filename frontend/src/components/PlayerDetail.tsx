import { HEROES } from '../lib/heroes';
import { ITEMS, getHeroImage, getItemImage, getAbilityImage, getHeroIcon } from '../lib/dota';
import abilityIdsJson from '../lib/constants/ability_ids.json';
import { IconRadiant, IconDire } from './Icons';
import MatchMap from './MatchMap';

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
  const dname = itemName ? (ITEMS[itemName]?.dname || itemName) : '';
  if (!itemName || itemName === 'empty' || itemName === 'null') {
    return <div style={{ width: `${size * 1.35}px`, height: `${size}px`, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />;
  }
  return (
    <div title={dname} style={{ width: `${size * 1.35}px`, height: `${size}px`, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
      <img src={getItemImage(itemName)} alt={dname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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

  const getTimelineStat = (min: number) => {
    const scale = Math.min(1, min / (matchData.duration / 60));
    return {
      level: Math.max(1, Math.floor(selectedPlayer.level * scale)),
      kills: Math.floor(selectedPlayer.kills * scale),
      deaths: Math.floor(selectedPlayer.deaths * scale),
      assists: Math.floor(selectedPlayer.assists * scale),
      gpm: selectedPlayer.gpm,
      xpm: selectedPlayer.xpm,
      lh: Math.floor(selectedPlayer.last_hits * scale),
      dn: Math.floor(selectedPlayer.denies * scale)
    };
  };

  const TimelineBracket = ({ min, title }: { min: number, title: string }) => {
    if (matchData.duration < (min - 10) * 60) return null;
    const bracketStart = (min - 10) * 60;
    const bracketEnd = min * 60;
    const bracketItems = importantItems.filter((l: any) => l.time > bracketStart && l.time <= bracketEnd);
    const bracketRegen = regenItems.filter((l: any) => l.time > bracketStart && l.time <= bracketEnd);
    const stat = getTimelineStat(min);

    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{formatTime(min * 60)} {title}</h3>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div className="glass-surface" style={{ width: '280px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div style={{ position: 'relative' }}>
                 <img src={getHeroIcon(HEROES[selectedPlayer.hero_id]?.img_name)} alt="Hero" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                 <div style={{ position: 'absolute', bottom: -5, left: -5, background: '#000', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.5)' }}>{stat.level}</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                 {bracketItems.slice(0,6).map((item: any, i: number) => <ItemIcon key={i} item={item.key} size={28} />)}
                 {Array.from({ length: Math.max(0, 6 - bracketItems.length) }).map((_, i) => <ItemIcon key={`empty-${i}`} item={null} size={28} />)}
               </div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
               <div style={{ textAlign: 'center' }}>
                 <div className="text-secondary" style={{ fontSize: '0.65rem' }}>KDA</div>
                 <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{stat.kills} / {stat.deaths} / {stat.assists}</div>
               </div>
               <div style={{ textAlign: 'center' }}>
                 <div className="text-secondary" style={{ fontSize: '0.65rem' }}>GPM / XPM</div>
                 <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{stat.gpm} / {stat.xpm}</div>
               </div>
               <div style={{ textAlign: 'center' }}>
                 <div className="text-secondary" style={{ fontSize: '0.65rem' }}>LH / DN</div>
                 <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{stat.lh} / {stat.dn}</div>
               </div>
             </div>
          </div>
          <div className="glass-surface" style={{ width: '120px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {min === 10 ? (
              <div className="text-secondary" style={{ textAlign: 'center', fontSize: '0.8rem' }}>NW<br/>Unavailable</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', textAlign: 'center', borderRadius: '4px' }}>
                  <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Kills</div>
                  <strong style={{ color: 'var(--radiant-green)' }}>+{stat.kills}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', textAlign: 'center', borderRadius: '4px' }}>
                  <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Deaths</div>
                  <strong style={{ color: 'var(--dire-red)' }}>+{stat.deaths}</strong>
                </div>
              </div>
            )}
          </div>
          <div className="glass-surface" style={{ flex: 1, padding: '0', display: 'flex', flexDirection: 'row' }}>
            <div style={{ flex: 1, padding: '1rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>{min === 10 ? 'Regen Purchased' : 'Significant Items Purchased'}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(min === 10 ? bracketRegen : bracketItems).map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ItemIcon item={item.key} size={28} />
                      <span style={{ fontSize: '0.8rem' }}>{ITEMS[item.key.replace('item_', '')]?.dname || item.key}</span>
                    </div>
                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>{formatTime(item.time)}</span>
                  </div>
                ))}
                {(min === 10 ? bracketRegen : bracketItems).length === 0 && (
                  <div className="text-secondary" style={{ fontSize: '0.8rem' }}>No {min === 10 ? 'regen' : 'significant items'} were purchased within this time period.</div>
                )}
              </div>
            </div>
            <div style={{ width: '160px', borderLeft: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
              <MatchMap matchData={matchData} selectedPlayer={undefined} compact hideControls controlledTime={min * 60} controlledIsPlaying={false} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getWardsInFirstMin = (players: any[]) => {
    let obs = 0; let sen = 0;
    players.forEach(p => {
      let ol = p.obs_log; let sl = p.sen_log;
      if (typeof ol === 'string') { try { ol = JSON.parse(ol); } catch { ol = []; } }
      if (typeof sl === 'string') { try { sl = JSON.parse(sl); } catch { sl = []; } }
      if (Array.isArray(ol)) obs += ol.filter((e:any) => e.time <= 60).length;
      if (Array.isArray(sl)) sen += sl.filter((e:any) => e.time <= 60).length;
    });
    return { obs, sen };
  };
  const radWards = getWardsInFirstMin(radiant);
  const direWards = getWardsInFirstMin(dire);

  return (
    <div className="animate-fade-in" style={{ padding: '0 1rem 4rem 1rem' }}>
      
      {/* 1. Top Header Hero Selector */}
      <div className="glass-surface" style={{ display: 'flex', gap: '2rem', padding: '1rem', alignItems: 'center', overflowX: 'auto', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <IconRadiant style={{ width: '24px', height: '24px' }} />
          {radiant.map((p: any) => (
            <div key={p.player_slot} onClick={() => setSelectedPlayer(p)} style={{ cursor: 'pointer', transition: 'all 0.2s', opacity: p.player_slot === selectedPlayer.player_slot ? 1 : 0.4, border: p.player_slot === selectedPlayer.player_slot ? '2px solid var(--radiant-green)' : '2px solid transparent', borderRadius: '50%', padding: '2px' }}>
              <img src={getHeroIcon(HEROES[p.hero_id]?.img_name)} alt="Hero" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
        <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {dire.map((p: any) => (
            <div key={p.player_slot} onClick={() => setSelectedPlayer(p)} style={{ cursor: 'pointer', transition: 'all 0.2s', opacity: p.player_slot === selectedPlayer.player_slot ? 1 : 0.4, border: p.player_slot === selectedPlayer.player_slot ? '2px solid var(--dire-red)' : '2px solid transparent', borderRadius: '50%', padding: '2px' }}>
              <img src={getHeroIcon(HEROES[p.hero_id]?.img_name)} alt="Hero" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
          ))}
          <IconDire style={{ width: '24px', height: '24px' }} />
        </div>
      </div>

      {/* 2. Post-Game Stats at the top */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Post-Game Stats</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '80px', gap: '0.5rem', marginBottom: '3rem' }}>
        {/* Col 1 */}
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Level</div>
          <h2 style={{ fontSize: '1.3rem', margin: '0' }}>{selectedPlayer.level}</h2>
        </div>
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', padding: '0.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {[0, 1, 2, 3, 4, 5].map(i => <ItemIcon key={i} item={selectedPlayer[`item_${i}`]} size={30} />)}
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {selectedPlayer.item_neutral && selectedPlayer.item_neutral !== 'empty' && (
              <img src={getItemImage(resolveItemName(selectedPlayer.item_neutral) || '')} alt="Neutral" style={{ width: '100%', height: '100%', objectFit: 'cover' }} title={ITEMS[resolveItemName(selectedPlayer.item_neutral) || '']?.dname || selectedPlayer.item_neutral} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[0, 1, 2].map(i => <ItemIcon key={i} item={selectedPlayer[`backpack_${i}`]} size={18} />)}
          </div>
        </div>

        {/* Col 2 */}
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Net Worth</div>
          <h2 style={{ color: 'var(--accent-gold)', fontSize: '1.3rem', margin: '0' }}>{selectedPlayer.net_worth?.toLocaleString()}</h2>
        </div>
        <div style={{ gridRow: 'span 1' }}></div>

        {/* Col 3: Stacked K/D/A */}
        <div style={{ gridRow: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Kills</div>
            <strong style={{ color: 'var(--radiant-green)', fontSize: '1.1rem' }}>{selectedPlayer.kills}</strong>
          </div>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Deaths</div>
            <strong style={{ color: 'var(--dire-red)', fontSize: '1.1rem' }}>{selectedPlayer.deaths}</strong>
          </div>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Assists</div>
            <strong style={{ fontSize: '1.1rem' }}>{selectedPlayer.assists}</strong>
          </div>
        </div>

        {/* Col 4 */}
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>IMP</div>
          <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.imp || '-33'}</strong>
        </div>
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Kill Contribution</div>
          <strong style={{ fontSize: '1.3rem' }}>{Math.round(((selectedPlayer.kills + selectedPlayer.assists) / (selectedPlayer.player_slot < 128 ? matchData.radiant_score : matchData.dire_score)) * 100) || 0}%</strong>
        </div>

        {/* Col 5 */}
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>GPM</div>
          <strong style={{ color: 'var(--accent-gold)', fontSize: '1.3rem' }}>{selectedPlayer.gold_per_min || selectedPlayer.gpm || 0}</strong>
        </div>
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>XPM</div>
          <strong style={{ color: 'var(--radiant-green)', fontSize: '1.3rem' }}>{selectedPlayer.xp_per_min || selectedPlayer.xpm || 0}</strong>
        </div>

        {/* Col 6 */}
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Last Hits</div>
          <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.last_hits}</strong>
        </div>
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Denies</div>
          <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.denies}</strong>
        </div>

        {/* Col 7 */}
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Hero Damage</div>
          <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.hero_damage?.toLocaleString()}</strong>
        </div>
        <div className="glass-surface" style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Tower Damage</div>
          <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.tower_damage?.toLocaleString()}</strong>
        </div>
      </div>

      {/* 3. Ability and Item Build */}
      <div className="glass-surface" style={{ padding: '0', marginBottom: '3rem' }}>
        <h3 className="gold-text-gradient" style={{ margin: '0', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Ability and Item Build</h3>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Array.from({ length: 25 }).map((_, i) => {
              const abilityId = selectedPlayer.ability_upgrades_arr?.[i];
              const abilityName = abilityId ? ABILITY_IDS[String(abilityId)] : null;
              const isTalent = abilityName?.includes('special_bonus_');
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '32px' }}>
                  <div className="text-secondary" style={{ fontSize: '0.7rem' }}>{i + 1}</div>
                  {abilityName ? (
                    isTalent ? (
                      <div title={abilityName} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/assets/images/dota2/talent_tree.svg" alt="talent" style={{ width: '20px', height: '20px' }} />
                      </div>
                    ) : (
                      <img src={getAbilityImage(abilityName)} alt="ability" style={{ width: '32px', height: '32px', borderRadius: '4px' }} title={abilityName} />
                    )
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
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-gold)', background: 'rgba(0,0,0,0.5)' }}>
                    <img src={getItemImage(resolveItemName(selectedPlayer.neutral_item) || '')} alt="Neutral" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              )}
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
           <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {radBans.map((b: any) => <div key={b.order} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><img src={getHeroImage(HEROES[b.hero_id]?.img_name)} style={{ width: '40px', borderRadius: '4px', filter: 'grayscale(100%)' }} /> <span className="text-secondary">{HEROES[b.hero_id]?.name}</span></div>)}
             </div>
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
               {radBans.length === 0 && direBans.length === 0 && "No hero nominated"}
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
               {direBans.map((b: any) => <div key={b.order} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: 'row-reverse' }}><img src={getHeroImage(HEROES[b.hero_id]?.img_name)} style={{ width: '40px', borderRadius: '4px', filter: 'grayscale(100%)' }} /> <span className="text-secondary">{HEROES[b.hero_id]?.name}</span></div>)}
             </div>
           </div>

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
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
               <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Picked {HEROES[selectedPlayer.hero_id]?.name}</div>
               <h3 style={{ margin: 0 }}>{pb.find((p:any) => p.hero_id === selectedPlayer.hero_id)?.order < 10 ? 'First Phase' : pb.find((p:any) => p.hero_id === selectedPlayer.hero_id)?.order < 18 ? 'Second Phase' : 'Third Phase'}</h3>
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
        <div className="glass-surface" style={{ flex: 1, padding: '0', position: 'relative', overflow: 'hidden' }}>
          <MatchMap matchData={matchData} selectedPlayer={undefined} compact hideControls controlledTime={100} controlledIsPlaying={false} />
        </div>
      </div>

      {/* 6. Vision by First Minute */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>01:00 Vision by First Minute</h3>
      <div className="glass-surface" style={{ display: 'flex', padding: '1.5rem', gap: '2rem', marginBottom: '3rem', alignItems: 'center' }}>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>Radiant Ward Placements <IconRadiant style={{ width: '16px' }} /></div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#eab308' }}>👁</span> <strong>{radWards.obs}</strong> <span className="text-secondary">Observer</span></div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#3b82f6' }}>👁</span> <strong>{radWards.sen}</strong> <span className="text-secondary">Sentry</span></div>
          </div>
        </div>
        <div style={{ width: '200px', height: '200px', background: '#000', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
          <MatchMap matchData={matchData} selectedPlayer={selectedPlayer} compact hideControls controlledTime={60} controlledIsPlaying={false} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><IconDire style={{ width: '16px' }} /> Dire Ward Placements</div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-start' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#eab308' }}>👁</span> <strong>{direWards.obs}</strong> <span className="text-secondary">Observer</span></div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#3b82f6' }}>👁</span> <strong>{direWards.sen}</strong> <span className="text-secondary">Sentry</span></div>
          </div>
        </div>
      </div>

      {/* 7. Timeline Brackets */}
      {[10, 20, 30, 40].map(min => <TimelineBracket key={min} min={min} title={min===10?'Laning':min===20?'Early Game':min===30?'Mid Game':'Late Game'} />)}

    </div>
  );
}
