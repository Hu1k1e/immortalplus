// Real building screen positions (top%/left% on a square map view) — the
// patch 7.33 set (buildingData733.ts), the coordinate set OpenDota's own
// frontend vendors. These percentages are calibrated against a SPECIFIC
// reference image: OpenDota's own DotaMap.tsx pairs buildingData733.ts with
// map/detailed_733.jpg (confirmed by reading that component directly, not
// guessed) — a textured, vignetted map render, not the plain outline image
// (map/simple.png) an earlier pass wrongly assumed and measured instead,
// which has a much larger hard black margin and made things worse, not
// better. Decoded detailed_733.jpg (temporarily installed jpeg-js/pngjs,
// `npm install --no-save`, removed immediately after — no package.json
// changes) and pixel-scanned its actual vignette boundary: content spans
// 0.78%-98.56% horizontally and 3.11%-96.00% vertically (a thin, asymmetric
// vignette, not a large uniform margin). Both `minimap_geometry_current.png`
// and `/minimap.png` (confirmed separately via the same pixel-scan method)
// fill 0-100% edge to edge, so remapPct/remapPctY rescale from that
// reference image's real content bounds into that edge-to-edge space —
// valid for either asset, since both are full, unpadded map crops in the
// same orientation.
const PAD_X_START = 0.78;
const PAD_X_END = 98.56;
const PAD_Y_START = 3.11;
const PAD_Y_END = 96.0;
export function remapPct(v: number): number {
  return ((v - PAD_X_START) / (PAD_X_END - PAD_X_START)) * 100;
}
export function remapPctY(v: number): number {
  return ((v - PAD_Y_START) / (PAD_Y_END - PAD_Y_START)) * 100;
}

export interface BuildingEntry { id: string; top: number; left: number; }

export const RADIANT_BUILDINGS: BuildingEntry[] = [
  { id: 't4br', top: 82, left: 12 }, { id: 't4tr', top: 79, left: 8 },
  { id: 't3br', top: 83.5, left: 23 }, { id: 't2br', top: 85, left: 46 }, { id: 't1br', top: 82, left: 75 },
  { id: 't3mr', top: 71.5, left: 18.5 }, { id: 't2mr', top: 63, left: 27.5 }, { id: 't1mr', top: 54, left: 38 },
  { id: 't3tr', top: 68, left: 8 }, { id: 't2tr', top: 53, left: 9 }, { id: 't1tr', top: 36, left: 9.5 },
  { id: 'brbr', top: 80.5, left: 20 }, { id: 'bmbr', top: 84.5, left: 20 },
  { id: 'brmr', top: 72, left: 15 }, { id: 'bmmr', top: 74.5, left: 18 },
  { id: 'brtr', top: 70.5, left: 6.5 }, { id: 'bmtr', top: 70.5, left: 10.5 },
  { id: 'ar', top: 83, left: 5 },
];
export const DIRE_BUILDINGS: BuildingEntry[] = [
  { id: 't4bd', top: 16, left: 84 }, { id: 't4td', top: 13, left: 81 },
  { id: 't3bd', top: 28, left: 85.5 }, { id: 't2bd', top: 45, left: 85 }, { id: 't1bd', top: 60, left: 84 },
  { id: 't3md', top: 24, left: 73 }, { id: 't2md', top: 33, left: 64 }, { id: 't1md', top: 43.5, left: 51 },
  { id: 't3td', top: 12.5, left: 70 }, { id: 't2td', top: 11, left: 49 }, { id: 't1td', top: 12, left: 18 },
  { id: 'brbd', top: 24, left: 84 }, { id: 'bmbd', top: 24, left: 88 },
  { id: 'brmd', top: 19.5, left: 74.5 }, { id: 'bmmd', top: 22, left: 77.5 },
  { id: 'brtd', top: 10, left: 74 }, { id: 'bmtd', top: 14, left: 74 },
  { id: 'ad', top: 9, left: 84 },
];

export function buildingLabel(id: string): string {
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
export function buildingKey(id: string): string {
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

/** Real standing buildings (both sides) as of `currentTime` (or the whole
 * match, when omitted), each with its remapped top%/left% ready to render —
 * computed from the match's `objectives` building_kill log. Destroyed
 * buildings are simply left out, matching Stratz's sparse marker look. */
export function getStandingBuildings(matchData: any, currentTime?: number) {
  let objectives: any[] = [];
  try {
    objectives = typeof matchData?.objectives === 'string' ? JSON.parse(matchData.objectives) : (matchData?.objectives || []);
  } catch { objectives = []; }

  const destroyedCounts: Record<string, number> = {};
  objectives.forEach((o: any) => {
    if (o?.type === 'building_kill' && o.key && (currentTime == null || (o.time || 0) <= currentTime)) {
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

  const radiant = RADIANT_BUILDINGS.filter((b) => !isDestroyed(b.id)).map((b) => ({ ...b, topPct: remapPctY(b.top), leftPct: remapPct(b.left) }));
  const dire = DIRE_BUILDINGS.filter((b) => !isDestroyed(b.id)).map((b) => ({ ...b, topPct: remapPctY(b.top), leftPct: remapPct(b.left) }));
  return { radiant, dire };
}
