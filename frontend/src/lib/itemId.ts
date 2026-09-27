import { ITEMS } from './dota';

// item_0..5/item_neutral/backpack_0..2 on a player record are numeric item
// ids, not the name keys ITEMS itself is keyed by (e.g. "blink") — built
// once here so every component resolving those numeric fields (PlayerDetail,
// PerformancesExpandedUI, PlaybackPlayerRow) shares one reverse lookup
// instead of each building (and risking diverging) its own.
export const ITEM_ID_TO_NAME: Record<number, string> = {};
Object.entries(ITEMS).forEach(([name, data]: [string, any]) => {
  if (data?.id != null) ITEM_ID_TO_NAME[data.id] = name;
});

export function resolveItemIdName(id: any): string | null {
  if (id == null) return null;
  return ITEM_ID_TO_NAME[Number(id)] || null;
}
