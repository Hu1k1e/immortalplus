import { useMemo, useState } from 'react';
import { HEROES } from '../lib/heroes';
import { ITEMS, getHeroImage, getItemImage, getAbilityImage, getHeroIcon } from '../lib/dota';
import abilityIdsJson from '../lib/constants/ability_ids.json';
import { IconRadiant, IconDire } from './Icons';
import MatchMap from './MatchMap';
import { MiniMap as TowersMiniMap } from './TowersLaneRow';
import { purchaseLogOf } from './BuildsPanel';

const LANE_OVERLAY: Record<number, string> = { 3: '/assets/images/dota2/minimap_top.svg', 2: '/assets/images/dota2/minimap_mid.svg', 1: '/assets/images/dota2/minimap_bot.svg' };
// Matches each real overlay's actual highlighted corner (inspected directly:
// top.svg lights up the top-left, bot.svg the bottom-right, mid.svg a
// diagonal band through the center) so the hero icons sit inside the
// highlighted region instead of always dead-center regardless of lane.
const LANE_ICON_ALIGN: Record<number, { justifyContent: string; alignContent: string }> = {
  3: { justifyContent: 'flex-start', alignContent: 'flex-start' },
  2: { justifyContent: 'center', alignContent: 'center' },
  1: { justifyContent: 'flex-end', alignContent: 'flex-end' },
};

const WARD_ICON = {
  obs: { good: '/assets/images/dota2/map/goodguys_observer.png', bad: '/assets/images/dota2/map/badguys_observer.png' },
  sen: { good: '/assets/images/dota2/map/goodguys_sentry.png', bad: '/assets/images/dota2/map/badguys_sentry.png' },
};
// Real Dota constants (matching OpenDota's own frontend, odota_ui's
// utility.tsx getWardSize: observer vision radius 1600, sentry true-sight
// radius 1000, calibrated against a 12000-unit reference map width) —
// expressed here as a % radius of this map's own container.
const WARD_RADIUS_PCT = { obs: (1600 / 12000) * 100, sen: (1000 / 12000) * 100 };

/** Wards planted within the first minute, plotted on the same real Stratz
 * map asset (and the same x/y -> percent transform) MatchMap already uses
 * for hero markers — no towers, since this panel is about vision, not
 * objectives. */
function VisionMiniMap({ allPlayers }: { allPlayers: any[] }) {
  const dots: { left: number; top: number; radiant: boolean; type: 'obs' | 'sen' }[] = [];
  allPlayers.forEach((p: any) => {
    const isRadiant = p.player_slot < 128;
    (p.obs_log || []).filter((w: any) => (w.time ?? 0) <= 60).forEach((w: any) => {
      dots.push({ left: Math.min(100, Math.max(0, ((w.x - 64) / 128) * 100)), top: Math.min(100, Math.max(0, (1 - (w.y - 64) / 128) * 100)), radiant: isRadiant, type: 'obs' });
    });
    (p.sen_log || []).filter((w: any) => (w.time ?? 0) <= 60).forEach((w: any) => {
      dots.push({ left: Math.min(100, Math.max(0, ((w.x - 64) / 128) * 100)), top: Math.min(100, Math.max(0, (1 - (w.y - 64) / 128) * 100)), radiant: isRadiant, type: 'sen' });
    });
  });
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#17181b' }}>
      <img src="/assets/images/dota2/minimap_geometry_current.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'invert(0.85) hue-rotate(180deg) brightness(0.6) saturate(0.9)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      {dots.map((d, i) => {
        const r = WARD_RADIUS_PCT[d.type];
        return (
          <div key={i} style={{ position: 'absolute', left: `${d.left}%`, top: `${d.top}%`, transform: 'translate(-50%,-50%)', width: `${r * 2}%`, aspectRatio: '1/1' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: d.radiant ? 'rgba(81,164,69,0.16)' : 'rgba(194,53,43,0.16)', border: `1px solid ${d.radiant ? 'rgba(81,164,69,0.5)' : 'rgba(194,53,43,0.5)'}` }} />
            <img src={WARD_ICON[d.type][d.radiant ? 'good' : 'bad']} alt="" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '55%', maxWidth: '18px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        );
      })}
    </div>
  );
}

const ABILITY_IDS: Record<string, string> = abilityIdsJson;

function formatTime(secs: number) {
  if (secs == null) return '';
  const sign = secs < 0 ? '-' : '';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// item_0..5/item_neutral/backpack_0..2 are numeric item ids, not name keys —
// ITEMS is keyed by name (e.g. "blink"), so a reverse id->name map is
// needed to actually resolve them. This was missing before (silently
// falling back to the raw numeric id as a fake "name", which then failed
// every image lookup) — the real cause of the broken item icons here.
const ITEM_ID_TO_NAME: Record<number, string> = {};
Object.entries(ITEMS).forEach(([name, data]: [string, any]) => {
  if (data?.id != null) ITEM_ID_TO_NAME[data.id] = name;
});

const resolveItemName = (item: any) => {
  if (item == null) return null;
  if (typeof item === 'number' || (!isNaN(Number(item)) && String(item).trim() !== '')) {
    return ITEM_ID_TO_NAME[Number(item)] || null;
  }
  return String(item).replace('item_', '');
};

const ItemIcon = ({ item, size = 44, dim = false }: { item: any; size?: number; dim?: boolean }) => {
  const itemName = resolveItemName(item);
  const dname = itemName ? (ITEMS[itemName]?.dname || itemName) : '';
  if (!itemName || itemName === 'empty' || itemName === 'null') {
    return <div style={{ width: `${size * 1.35}px`, height: `${size}px`, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />;
  }
  return (
    <div title={dname} style={{ width: `${size * 1.35}px`, height: `${size}px`, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
      <img src={getItemImage(itemName)} alt={dname} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dim ? 'grayscale(100%) brightness(0.4)' : 'none', opacity: dim ? 0.5 : 1 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );
};

export default function PlayerDetail({ matchData, selectedPlayer, allPlayers, setSelectedPlayer }: any) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  // Post-Game Stats item build: starts showing the final build, scrubbing
  // back greys out anything not yet acquired as of that time (real
  // purchase_log timestamps matched against the final inventory's resolved
  // item names — the same convention BuildsPanel/PerformancesExpandedUI use).
  const [statsScrub, setStatsScrub] = useState(matchData.duration || 0);
  const finalItemsLog = purchaseLogOf(selectedPlayer);
  const acquiredAt = (name: string | null): number => {
    if (!name) return 0;
    const matches = finalItemsLog.filter((e: any) => e.key === name);
    return matches.length ? (matches[matches.length - 1].time || 0) : 0;
  };
  const itemDim = (raw: any) => acquiredAt(resolveItemName(raw)) > statsScrub;

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

  const countLogUpTo = (log: any, maxSecs: number) => {
    let arr = log;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) return 0;
    return arr.filter((e: any) => (e?.time ?? 0) <= maxSecs).length;
  };
  const arrAtMinute = (arr: any, min: number, fallback: number) => {
    let a = arr;
    if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return fallback; } }
    if (!Array.isArray(a) || a.length === 0) return fallback;
    return a.length > min ? a[min] : a[a.length - 1];
  };

  // Real, time-sliced values (kills_log/deaths_log/lh_t/dn_t), not a
  // proportional estimate off the final totals — level has no real
  // per-time source anywhere in this app's data, so it stays scaled.
  const getTimelineStat = (min: number) => {
    const secs = min * 60;
    const scale = Math.min(1, min / (matchData.duration / 60));
    return {
      level: Math.max(1, Math.floor(selectedPlayer.level * scale)),
      kills: countLogUpTo(selectedPlayer.kills_log, secs),
      deaths: countLogUpTo(selectedPlayer.deaths_log, secs),
      assists: Math.floor((selectedPlayer.assists || 0) * scale),
      gpm: selectedPlayer.gold_per_min ?? selectedPlayer.gpm ?? 0,
      xpm: selectedPlayer.xp_per_min ?? selectedPlayer.xpm ?? 0,
      lh: arrAtMinute(selectedPlayer.lh_t, min, 0),
      dn: arrAtMinute(selectedPlayer.dn_t, min, 0),
    };
  };

  const countLogInRange = (log: any, start: number, end: number) => {
    let arr = log;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) return 0;
    return arr.filter((e: any) => (e?.time ?? 0) > start && (e?.time ?? 0) <= end).length;
  };

  const TimelineBracket = ({ min, title }: { min: number, title: string }) => {
    if (matchData.duration < (min - 10) * 60) return null;
    const bracketStart = (min - 10) * 60;
    const bracketEnd = min * 60;
    const bracketItems = importantItems.filter((l: any) => l.time > bracketStart && l.time <= bracketEnd);
    const bracketRegen = regenItems.filter((l: any) => l.time > bracketStart && l.time <= bracketEnd);
    const bracketKills = countLogInRange(selectedPlayer.kills_log, bracketStart, bracketEnd);
    const bracketDeaths = countLogInRange(selectedPlayer.deaths_log, bracketStart, bracketEnd);
    // No assist-specific timestamped log exists anywhere in this app's data
    // (the same real limitation MatchupCard's live K/D already documents) —
    // the final total is scaled proportionally by bracket window as the
    // best available approximation, not a made-up number.
    const scaleAt = (secs: number) => Math.min(1, secs / matchData.duration);
    const bracketAssists = Math.max(0, Math.floor((selectedPlayer.assists || 0) * scaleAt(bracketEnd)) - Math.floor((selectedPlayer.assists || 0) * scaleAt(bracketStart)));
    const stat = getTimelineStat(min);

    const laneMatchup = useMemo(() => {
      if (min !== 10) return null;
      const lane = selectedPlayer.lane;
      if (!lane) return [];
      const playersInLane = matchData.all_players.filter((p: any) => p.lane === lane);
      return playersInLane.sort((a: any, b: any) => {
        const aGold = a.gold_t?.[10] || (a.net_worth / (matchData.duration / 600));
        const bGold = b.gold_t?.[10] || (b.net_worth / (matchData.duration / 600));
        return bGold - aGold;
      });
    }, [min, selectedPlayer, matchData]);

    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{formatTime(min * 60)} {title}</h3>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', minHeight: '200px' }}>
          <div className="glass-surface" style={{ width: '280px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
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

          {min === 10 ? (
            <>
              <div className="glass-surface" style={{ flex: 1, padding: '1.25rem', display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem', marginBottom: '1rem', fontSize: '0.68rem' }}>
                    <span className="text-secondary" style={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>NET WORTH</span>
                    <span style={{ color: 'var(--radiant-green)' }}>■ Radiant</span>
                    <span style={{ color: 'var(--dire-red)' }}>■ Dire</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {laneMatchup?.map((p: any) => {
                       const isRad = p.player_slot < 128;
                       const gold = p.gold_t?.[10] || (p.net_worth / (matchData.duration / 600));
                       const maxGold = Math.max(1, ...laneMatchup.map((x:any) => x.gold_t?.[10] || (x.net_worth / (matchData.duration / 600))));
                       const pct = Math.max(5, (gold / maxGold) * 100);
                       return (
                         <div key={p.player_slot} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                           <img src={getHeroIcon(HEROES[p.hero_id]?.img_name)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: `1.5px solid ${isRad ? 'var(--radiant-green)' : 'var(--dire-red)'}` }} />
                           <div style={{ width: '16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{p.level || 6}</div>
                           <div style={{ width: '46px', textAlign: 'right', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{Math.floor(gold).toLocaleString()}</div>
                           <div style={{ flex: 1, height: '5px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                             <div style={{ height: '100%', width: `${pct}%`, background: isRad ? 'var(--radiant-green)' : 'var(--dire-red)', borderRadius: '3px' }} />
                           </div>
                         </div>
                       );
                    })}
                    {(!laneMatchup || laneMatchup.length === 0) && <div className="text-secondary" style={{ textAlign: 'center' }}>No lane data</div>}
                  </div>
                </div>

                {/* Lane crop: only the real lane-shaped region of the map
                    itself (masked by Stratz's own minimap_top/mid/bot.svg)
                    is visible — not the whole map with a highlight on top —
                    with this lane's heroes shown on top of it. */}
                {selectedPlayer.lane && LANE_OVERLAY[selectedPlayer.lane] && (
                  <div style={{ width: '130px', flexShrink: 0, position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'transparent', alignSelf: 'flex-start' }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      WebkitMaskImage: `url(${LANE_OVERLAY[selectedPlayer.lane]})`, WebkitMaskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat',
                      maskImage: `url(${LANE_OVERLAY[selectedPlayer.lane]})`, maskSize: '100% 100%', maskRepeat: 'no-repeat',
                    }}>
                      {/* Deliberately NOT using the invert/hue-rotate/darken
                          filter the main Towers panel applies for dark-theme
                          consistency — that filter takes this asset's real
                          natural light/near-white coloring and inverts it
                          dark, which is exactly why this crop kept looking
                          washed out no matter how much brightness was piled
                          on. Showing it in its native light coloring (small
                          contrast/brightness polish only) reads correctly
                          against the dark card without fighting the source
                          asset. */}
                      <img src="/assets/images/dota2/minimap_geometry_current.png" alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(1.2) contrast(1.05)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px', ...LANE_ICON_ALIGN[selectedPlayer.lane] }}>
                      {laneMatchup?.map((p: any) => (
                        <img key={p.player_slot} src={getHeroIcon(HEROES[p.hero_id]?.img_name)} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', border: `1.5px solid ${p.player_slot < 128 ? 'var(--radiant-green)' : 'var(--dire-red)'}`, boxShadow: '0 0 4px rgba(0,0,0,0.9)' }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="glass-surface" style={{ width: '300px', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>Regen Purchased</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {bracketRegen.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ItemIcon item={item.key} size={28} />
                        <span style={{ fontSize: '0.8rem' }}>{ITEMS[item.key.replace('item_', '')]?.dname || item.key}</span>
                      </div>
                      <span className="text-secondary" style={{ fontSize: '0.75rem' }}>{formatTime(item.time)}</span>
                    </div>
                  ))}
                  {bracketRegen.length === 0 && (
                    <div className="text-secondary" style={{ fontSize: '0.8rem' }}>No regen were purchased within this time period.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="glass-surface" style={{ width: '120px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', textAlign: 'center', borderRadius: '4px' }}>
                    <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Kills</div>
                    <strong style={{ color: 'var(--radiant-green)' }}>+{bracketKills}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', textAlign: 'center', borderRadius: '4px' }}>
                    <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Deaths</div>
                    <strong style={{ color: 'var(--dire-red)' }}>+{bracketDeaths}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', textAlign: 'center', borderRadius: '4px' }}>
                    <div className="text-secondary" style={{ fontSize: '0.7rem' }}>Assists</div>
                    <strong style={{ color: 'var(--text-primary)' }}>+{bracketAssists}</strong>
                  </div>
                </div>
              </div>
              <div className="glass-surface" style={{ flex: 1, padding: '0', display: 'flex', flexDirection: 'row' }}>
                <div style={{ flex: 1, padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>Significant Items Purchased</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {bracketItems.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ItemIcon item={item.key} size={28} />
                          <span style={{ fontSize: '0.8rem' }}>{ITEMS[item.key.replace('item_', '')]?.dname || item.key}</span>
                        </div>
                        <span className="text-secondary" style={{ fontSize: '0.75rem' }}>{formatTime(item.time)}</span>
                      </div>
                    ))}
                    {bracketItems.length === 0 && (
                      <div className="text-secondary" style={{ fontSize: '0.8rem' }}>No significant items were purchased within this time period.</div>
                    )}
                  </div>
                </div>
                <div style={{ width: '150px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem' }}>
                  <TowersMiniMap matchData={matchData} currentTime={min * 60} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };


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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '3rem', height: '240px' }}>
        {/* Col 1 & 2 wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 2 }}>
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Level</div>
              <h2 style={{ fontSize: '1.3rem', margin: '0' }}>{selectedPlayer.level}</h2>
            </div>
            <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Net Worth</div>
              <h2 style={{ color: 'var(--accent-gold)', fontSize: '1.3rem', margin: '0' }}>{selectedPlayer.net_worth?.toLocaleString()}</h2>
            </div>
          </div>
          <div className="glass-surface" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center', padding: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {[0, 1, 2, 3, 4, 5].map(i => <ItemIcon key={i} item={selectedPlayer[`item_${i}`]} size={30} dim={itemDim(selectedPlayer[`item_${i}`])} />)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedPlayer.item_neutral && selectedPlayer.item_neutral !== 'empty' && (
                    <img src={getItemImage(resolveItemName(selectedPlayer.item_neutral) || '')} alt="Neutral" style={{ width: '100%', height: '100%', objectFit: 'cover' }} title={ITEMS[resolveItemName(selectedPlayer.item_neutral) || '']?.dname || 'Neutral item'} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 1, 2].map(i => <ItemIcon key={i} item={selectedPlayer[`backpack_${i}`]} size={18} dim={itemDim(selectedPlayer[`backpack_${i}`])} />)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 700, padding: '0 0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{formatTime(statsScrub)}</span>
              <input
                type="range" min={0} max={matchData.duration || 0} value={statsScrub}
                onChange={(e) => setStatsScrub(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-gold)' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>{formatTime(matchData.duration || 0)}</span>
            </div>
          </div>
        </div>

        {/* Col 3: Stacked K/D/A */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1.2 }}>
          <div className="glass-surface" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>IMP</div>
            <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.imp || '-33'}</strong>
          </div>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Kill Contribution</div>
            <strong style={{ fontSize: '1.3rem' }}>{Math.round(((selectedPlayer.kills + selectedPlayer.assists) / (selectedPlayer.player_slot < 128 ? matchData.radiant_score : matchData.dire_score)) * 100) || 0}%</strong>
          </div>
        </div>

        {/* Col 5 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>GPM</div>
            <strong style={{ color: 'var(--accent-gold)', fontSize: '1.3rem' }}>{selectedPlayer.gold_per_min || selectedPlayer.gpm || 0}</strong>
          </div>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>XPM</div>
            <strong style={{ color: 'var(--radiant-green)', fontSize: '1.3rem' }}>{selectedPlayer.xp_per_min || selectedPlayer.xpm || 0}</strong>
          </div>
        </div>

        {/* Col 6 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Last Hits</div>
            <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.last_hits}</strong>
          </div>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Denies</div>
            <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.denies}</strong>
          </div>
        </div>

        {/* Col 7 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1.2 }}>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Hero Damage</div>
            <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.hero_damage?.toLocaleString()}</strong>
          </div>
          <div className="glass-surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Tower Damage</div>
            <strong style={{ fontSize: '1.3rem' }}>{selectedPlayer.tower_damage?.toLocaleString()}</strong>
          </div>
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
          <MatchMap matchData={matchData} selectedPlayer={undefined} compact hideControls mode="lanes" />
        </div>
      </div>

      {/* 6. Vision by First Minute */}
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>01:00 Vision by First Minute</h3>
      <div className="glass-surface" style={{ display: 'flex', padding: '1.5rem', gap: '2rem', marginBottom: '3rem', alignItems: 'flex-start' }}>
        {/* Radiant Wards List */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}><IconRadiant style={{ width: '16px' }} /> <strong style={{ color: 'var(--radiant-green)' }}>Radiant Ward Placements</strong></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             {matchData.all_players.filter((p:any) => p.player_slot < 128).flatMap((p:any) => p.obs_log?.filter((w:any) => w.time <= 60).map((w:any) => ({...w, hero: p.hero_id, type: 'obs'})) || []).concat(
               matchData.all_players.filter((p:any) => p.player_slot < 128).flatMap((p:any) => p.sen_log?.filter((w:any) => w.time <= 60).map((w:any) => ({...w, hero: p.hero_id, type: 'sen'})) || [])
             ).sort((a:any, b:any) => a.time - b.time).map((ward:any, i:number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <ItemIcon item={ward.type === 'obs' ? 'ward_observer' : 'ward_sentry'} size={24} />
                     <span className="text-secondary">planted by</span>
                     <img src={getHeroIcon(HEROES[ward.hero]?.img_name)} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                     <span style={{ color: 'var(--radiant-green)', fontWeight: 600 }}>{HEROES[ward.hero]?.name}</span>
                   </div>
                   <span className="text-secondary">{formatTime(ward.time)}</span>
                </div>
             ))}
          </div>
        </div>

        {/* Map */}
        <div style={{ width: '200px', flexShrink: 0, alignSelf: 'center' }}>
          <VisionMiniMap allPlayers={matchData.all_players} />
        </div>

        {/* Dire Wards List */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}><IconDire style={{ width: '16px' }} /> <strong style={{ color: 'var(--dire-red)' }}>Dire Ward Placements</strong></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             {matchData.all_players.filter((p:any) => p.player_slot >= 128).flatMap((p:any) => p.obs_log?.filter((w:any) => w.time <= 60).map((w:any) => ({...w, hero: p.hero_id, type: 'obs'})) || []).concat(
               matchData.all_players.filter((p:any) => p.player_slot >= 128).flatMap((p:any) => p.sen_log?.filter((w:any) => w.time <= 60).map((w:any) => ({...w, hero: p.hero_id, type: 'sen'})) || [])
             ).sort((a:any, b:any) => a.time - b.time).map((ward:any, i:number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <ItemIcon item={ward.type === 'obs' ? 'ward_observer' : 'ward_sentry'} size={24} />
                     <span className="text-secondary">planted by</span>
                     <img src={getHeroIcon(HEROES[ward.hero]?.img_name)} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                     <span style={{ color: 'var(--dire-red)', fontWeight: 600 }}>{HEROES[ward.hero]?.name}</span>
                   </div>
                   <span className="text-secondary">{formatTime(ward.time)}</span>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* 7. Timeline Brackets */}
      {[10, 20, 30, 40].map(min => <TimelineBracket key={min} min={min} title={min===10?'Laning':min===20?'Early Game':min===30?'Mid Game':'Late Game'} />)}

    </div>
  );
}
