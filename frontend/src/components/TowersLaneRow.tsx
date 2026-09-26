import { HEROES } from '../lib/heroes';
import { getHeroIcon } from '../lib/dota';
import AdvantageGraph from './AdvantageGraph';

const LANE_NAMES: Record<number, string> = { 1: 'Bottom Lane', 2: 'Middle Lane', 3: 'Top Lane' };

// Real building screen positions (top%/left% on a square map view), taken
// straight from OpenDota's own frontend building-map data — not guessed.
interface BuildingEntry { id: string; top: number; left: number; }

const RADIANT_BUILDINGS: BuildingEntry[] = [
  { id: 't4br', top: 82, left: 12 }, { id: 't4tr', top: 79, left: 8 },
  { id: 't3br', top: 83.5, left: 23 }, { id: 't2br', top: 85, left: 46 }, { id: 't1br', top: 83, left: 78 },
  { id: 't3mr', top: 71, left: 18 }, { id: 't2mr', top: 63, left: 27 }, { id: 't1mr', top: 54, left: 38 },
  { id: 't3tr', top: 68, left: 7 }, { id: 't2tr', top: 51, left: 8 }, { id: 't1tr', top: 35, left: 8 },
  { id: 'brbr', top: 80.5, left: 20 }, { id: 'bmbr', top: 84.5, left: 20 },
  { id: 'brmr', top: 70.5, left: 15 }, { id: 'bmmr', top: 73, left: 18 },
  { id: 'brtr', top: 70.5, left: 5.5 }, { id: 'bmtr', top: 70.5, left: 9.5 },
  { id: 'ar', top: 83, left: 5 },
];
const DIRE_BUILDINGS: BuildingEntry[] = [
  { id: 't4bd', top: 16, left: 84 }, { id: 't4td', top: 13, left: 81 },
  { id: 't3bd', top: 28, left: 86 }, { id: 't2bd', top: 45, left: 86 }, { id: 't1bd', top: 60, left: 86 },
  { id: 't3md', top: 24, left: 73 }, { id: 't2md', top: 34, left: 63 }, { id: 't1md', top: 44, left: 53 },
  { id: 't3td', top: 11, left: 70 }, { id: 't2td', top: 10, left: 44 }, { id: 't1td', top: 10, left: 15 },
  { id: 'brbd', top: 24, left: 84.5 }, { id: 'bmbd', top: 24, left: 88.5 },
  { id: 'brmd', top: 19.5, left: 74.5 }, { id: 'bmmd', top: 22, left: 77.5 },
  { id: 'brtd', top: 8, left: 74 }, { id: 'bmtd', top: 12, left: 74 },
  { id: 'ad', top: 9, left: 84 },
];

function buildingLabel(id: string): string {
  const typeChar = id[0];
  if (typeChar === 'a') return 'Ancient';
  const laneChar = id[2];
  if (typeChar === 'b') {
    const subtype = id[1] === 'm' ? 'Melee' : 'Range';
    const laneName = laneChar === 't' ? 'Top' : laneChar === 'm' ? 'Mid' : 'Bottom';
    return `${laneName} ${subtype} Barracks`;
  }
  const tier = id[1];
  if (tier === '4') return laneChar === 'b' ? 'Bottom Base Tower' : 'Top Base Tower';
  const laneName = laneChar === 't' ? 'Top' : laneChar === 'm' ? 'Mid' : 'Bottom';
  return `Tier ${tier} ${laneName} Tower`;
}

// Same key format Valve's own objectives log uses (verified against real
// stored match data), so status can be derived from the already-reliably
// populated `objectives` field instead of the OpenDota summary's
// tower_status bitmask, which isn't always stored for locally-parsed
// matches. Tier-4 towers share one generic `tower4` key with no lane
// suffix in the raw log — both radiant t4 entries draw from the same
// destroyed-count pool since which specific one is unrecoverable from this data.
function buildingKey(id: string): string {
  const typeChar = id[0];
  const side = id[id.length - 1] === 'r' ? 'good' : 'bad';
  if (typeChar === 'a') return `npc_dota_${side}guys_fort`;
  if (typeChar === 'b') {
    const subtype = id[1] === 'm' ? 'melee_rax' : 'range_rax';
    const laneChar = id[2];
    const lane = laneChar === 't' ? 'top' : laneChar === 'm' ? 'mid' : 'bot';
    return `npc_dota_${side}guys_${subtype}_${lane}`;
  }
  const tier = id[1];
  if (tier === '4') return `npc_dota_${side}guys_tower4`;
  const laneChar = id[2];
  const lane = laneChar === 't' ? 'top' : laneChar === 'm' ? 'mid' : 'bot';
  return `npc_dota_${side}guys_tower${tier}_${lane}`;
}

/** Real map geometry (Stratz's own asset) with every standing tower,
 * barracks, and Ancient plotted at its true position — computed from the
 * match's `objectives` building_kill log (reliably populated) rather than
 * the OpenDota summary's tower_status bitmask (often missing for
 * locally-parsed matches). Destroyed buildings are simply omitted,
 * matching Stratz's sparse marker look. */
function MiniMap({ matchData }: { matchData: any }) {
  let objectives: any[] = [];
  try {
    objectives = typeof matchData?.objectives === 'string' ? JSON.parse(matchData.objectives) : (matchData?.objectives || []);
  } catch { objectives = []; }

  const destroyedCounts: Record<string, number> = {};
  objectives.forEach((o: any) => {
    if (o?.type === 'building_kill' && o.key) {
      destroyedCounts[o.key] = (destroyedCounts[o.key] || 0) + 1;
    }
  });
  const isDestroyed = (id: string): boolean => {
    const key = buildingKey(id);
    if ((destroyedCounts[key] || 0) > 0) {
      destroyedCounts[key] -= 1;
      return true;
    }
    return false;
  };

  const renderBuilding = (b: BuildingEntry, isRadiant: boolean) => {
    if (isDestroyed(b.id)) return null;
    const isAncient = b.id[0] === 'a';
    return (
      <div
        key={b.id}
        title={`${buildingLabel(b.id)} — ${isRadiant ? 'Radiant' : 'Dire'} — Standing`}
        style={{
          position: 'absolute', top: `${b.top}%`, left: `${b.left}%`, transform: 'translate(-50%,-50%)',
          width: isAncient ? '9px' : '7px', height: isAncient ? '9px' : '7px', borderRadius: '2px',
          background: '#ff8c1a',
          border: '1px solid rgba(0,0,0,0.6)',
        }}
      />
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#05070a' }}>
      <img
        src="/assets/images/dota2/minimap_geometry_current.png"
        alt="Map"
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'invert(1) hue-rotate(180deg) brightness(0.8) saturate(1.2) contrast(1.1)' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {RADIANT_BUILDINGS.map((b) => renderBuilding(b, true))}
      {DIRE_BUILDINGS.map((b) => renderBuilding(b, false))}
    </div>
  );
}

function LaneMatchupCards({ allPlayers }: { allPlayers: any[] }) {
  const lanes = [3, 2, 1]; // Top, Mid, Bottom, matching the Stratz reference order

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
      {lanes.map((lane) => {
        const lanePlayers = allPlayers.filter((p) => p.lane === lane);
        const radiant = lanePlayers.filter((p) => p.player_slot < 128);
        const dire = lanePlayers.filter((p) => p.player_slot >= 128);
        let winner: 'radiant' | 'dire' | null = null;
        if (radiant.length && dire.length) {
          const radiantEff = radiant.reduce((s, p) => s + (p.lane_efficiency_pct || 0), 0);
          const direEff = dire.reduce((s, p) => s + (p.lane_efficiency_pct || 0), 0);
          if (radiantEff || direEff) winner = radiantEff >= direEff ? 'radiant' : 'dire';
        }

        const renderHeroes = (players: any[]) => players.length > 0 ? players.map((p) => {
          const hero = HEROES[p.hero_id];
          return hero && <img key={p.player_slot} src={getHeroIcon(hero.img_name)} alt={hero.name} title={hero.name} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border-color)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
        }) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>;

        return (
          <div key={lane} className="glass-surface" style={{ padding: '0.6rem 0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              {renderHeroes(radiant)}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0.4rem' }}>vs</span>
              {renderHeroes(dire)}
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.4rem', fontSize: '0.75rem' }}>
              {winner ? (
                <span style={{ color: winner === 'radiant' ? 'var(--radiant-green)' : 'var(--dire-red)', fontWeight: 700 }}>
                  {winner === 'radiant' ? 'Radiant' : 'Dire'} Won
                </span>
              ) : <span style={{ color: 'var(--text-muted)' }}>No data</span>}
              <span style={{ color: 'var(--text-muted)' }}> · {LANE_NAMES[lane]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TowersLaneRow({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch', marginTop: '1.5rem' }}>
      <div style={{ flex: '1 1 220px', maxWidth: '260px' }}>
        <MiniMap matchData={matchData} />
      </div>
      <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 420px', minWidth: '340px' }}>
        <AdvantageGraph matchData={matchData} allPlayers={allPlayers} height={240} />
      </div>
      <LaneMatchupCards allPlayers={allPlayers} />
    </div>
  );
}
