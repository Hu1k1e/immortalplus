import abilityIdsJson from './constants/ability_ids.json';
import heroAbilitiesJson from './constants/hero_abilities.json';
import abilitiesJson from './constants/abilities.json';

const ABILITY_ID_TO_NAME: Record<string, string> = abilityIdsJson as any;
const HERO_ABILITIES: Record<string, { talents?: { name: string; level: number }[] }> = heroAbilitiesJson as any;
const ABILITIES: Record<string, any> = abilitiesJson as any;

export interface TalentOption {
  name: string;
  label: string;
  chosen: boolean;
}

export interface TalentTier {
  level: number; // 1-4, corresponding to hero levels 10/15/20/25
  options: TalentOption[];
}

export function talentLabel(name: string): string {
  const ab = ABILITIES[name];
  if (ab?.dname) return ab.dname;
  return name.replace('special_bonus_', '').replace(/_/g, ' ');
}

/**
 * Resolve a player's 4-tier talent tree (10/15/20/25) from their raw
 * ability_upgrades_arr (a flat list of numeric ability ids leveled up over
 * the game, no per-entry timestamp in any data source available to us —
 * so unlike items, talent picks can't be graphed against the scrub clock).
 * Returns [] when the hero isn't in OpenDota's hero_abilities constants or
 * the player has no upgrade data (unparsed match).
 */
export function getTalentTree(heroName: string | undefined, abilityUpgradesArr: number[] | undefined): TalentTier[] {
  if (!heroName || !Array.isArray(abilityUpgradesArr) || abilityUpgradesArr.length === 0) return [];
  const heroData = HERO_ABILITIES[heroName];
  if (!heroData?.talents) return [];

  const chosenNames = new Set(abilityUpgradesArr.map((id) => ABILITY_ID_TO_NAME[String(id)]).filter(Boolean));

  const tiers: TalentTier[] = [1, 2, 3, 4].map((level) => ({
    level,
    options: heroData.talents!
      .filter((t) => t.level === level)
      .map((t) => ({ name: t.name, label: talentLabel(t.name), chosen: chosenNames.has(t.name) })),
  }));
  return tiers;
}
