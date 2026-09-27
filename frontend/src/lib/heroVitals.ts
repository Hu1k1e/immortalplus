import dotaconstants from 'dotaconstants';

const HERO_STATS: Record<string, any> = (dotaconstants as any).heroes || {};

/**
 * Real max HP/Mana at a given level, using the well-documented, stable
 * Dota 2 formulas (Max HP = base_health + Strength*22, Max Mana =
 * base_mana + Intelligence*12 — unchanged for years, matching Dota Wiki/
 * Liquipedia) applied to each hero's real base stats and per-level gain
 * (dotaconstants' `heroes` table, the same constants data OpenDota's own
 * frontend ships).
 *
 * The current (as opposed to max) HP/Mana fill is NOT tracked moment to
 * moment here — no data source available to this app has a timestamped
 * combat log (individual damage/heal instances), only final aggregate
 * totals, so reconstructing a real per-second fill curve would need a new
 * raw-replay-stream parsing service (the same category of backend work as
 * `position_parser.py`, not yet built). Rather than fabricate a
 * plausible-looking wiggle that would actually be wrong during any fight,
 * this reports the real deterministic max and a real alive/dead state
 * (from `pos_t.life_state` when available) — full while alive, empty the
 * instant they die, full again on respawn — and is honest about that
 * simplification via `approximate: true`.
 */
export function getHeroVitals(player: any, level: number, isAlive: boolean) {
  const stat = HERO_STATS[String(player.hero_id)];
  if (!stat) return null;
  const str = (stat.base_str || 0) + (stat.str_gain || 0) * (level - 1);
  const int = (stat.base_int || 0) + (stat.int_gain || 0) * (level - 1);
  const maxHp = Math.round((stat.base_health || 120) + str * 22);
  const maxMana = Math.round((stat.base_mana || 0) + int * 12);
  return {
    maxHp,
    maxMana,
    hp: isAlive ? maxHp : 0,
    mana: isAlive ? maxMana : 0,
    approximate: true,
  };
}
