import heroesJson from './constants/heroes.json';
import itemsJson from './constants/items.json';
import abilitiesJson from './constants/abilities.json';

const CDN_BASE = 'https://cdn.cloudflare.steamstatic.com';

// Make them accessible as records
export const HEROES: Record<string, any> = heroesJson;
export const ITEMS: Record<string, any> = itemsJson;
export const ABILITIES: Record<string, any> = abilitiesJson;

/**
 * Get hero image URL by hero ID or name.
 */
export function getHeroImage(heroIdOrName: string | number): string {
  if (!heroIdOrName) return '';
  
  // If it's a number/id
  if (HEROES[heroIdOrName]) {
    return CDN_BASE + HEROES[heroIdOrName].img;
  }
  
  // If it's a name like "npc_dota_hero_antimage" or just "antimage"
  const nameStr = String(heroIdOrName).replace('npc_dota_hero_', '');
  for (const key in HEROES) {
    if (HEROES[key].name.replace('npc_dota_hero_', '') === nameStr) {
      return CDN_BASE + HEROES[key].img;
    }
  }
  
  // Fallback
  return `${CDN_BASE}/apps/dota2/images/dota_react/heroes/${nameStr}.png`;
}

/**
 * Get the small square hero "icon" crop (headshot, not the wide splash-art
 * crop `getHeroImage` returns) — used for map markers and small badges,
 * same asset heroes.json already stores under the `icon` field.
 */
export function getHeroIcon(heroIdOrName: string | number): string {
  if (!heroIdOrName) return '';

  if (HEROES[heroIdOrName]) {
    return CDN_BASE + HEROES[heroIdOrName].icon;
  }

  const nameStr = String(heroIdOrName).replace('npc_dota_hero_', '');
  for (const key in HEROES) {
    if (HEROES[key].name.replace('npc_dota_hero_', '') === nameStr) {
      return CDN_BASE + HEROES[key].icon;
    }
  }

  return `${CDN_BASE}/apps/dota2/images/dota_react/heroes/icons/${nameStr}.png`;
}

/**
 * Get item image URL by item name.
 */
export function getItemImage(itemName: string): string {
  if (!itemName) return '';
  
  const cleanName = itemName.replace('item_', '');
  if (ITEMS[cleanName]) {
    return CDN_BASE + ITEMS[cleanName].img;
  }
  
  // Fallback
  return `${CDN_BASE}/apps/dota2/images/dota_react/items/${cleanName}.png`;
}

/**
 * Get ability/skill image URL by ability name.
 */
export function getAbilityImage(abilityName: string): string {
  if (!abilityName) return '';
  
  if (abilityName.includes('attribute_bonus')) {
    return '/assets/images/stats.png';
  } else if (abilityName.includes('special_bonus')) {
    return '/assets/images/dota2/talent_tree.svg';
  } else if (['ability_lamp_use', 'ability_pluck_famango', 'twin_gate_portal_warp'].includes(abilityName)) {
    return `/assets/images/dota2/abilities/${abilityName}.png`;
  }
  
  if (ABILITIES[abilityName]) {
    return CDN_BASE + ABILITIES[abilityName].img;
  }
  
  // Fallback
  return `${CDN_BASE}/apps/dota2/images/dota_react/abilities/${abilityName}.png`;
}
