# OpenDota & Stratz Integration Checklist

This checklist documents the required data to replicate all OpenDota and Stratz match tabs, and identifies gaps in our current database schema or API fetching logic.

## 1. Overview Tab
- **UI Elements:** Scoreboard (K/D/A, Net Worth, LH/DN, GPM/XPM, Items, Hero, Player), Minimap with Playback, Match Header (Duration, Winner, Skill Bracket).
- **Data Required:** Basic player stats, `purchase_log`, `kills_log`, `obs_log`, `sen_log`, `hero_id`, `account_id`, `items`, `backpack`, `neutral_item`.
- **Status:** ✅ Mostly implemented. 
- **Missing Data:** Hero positions on the map (for map playback), detailed building kill positions.

## 2. Benchmarks Tab
- **UI Elements:** Table comparing player stats (GPM, XPM, KPM, LHPM, HDPM, TDPM, HHPM) to percentiles for that hero.
- **Data Required:** `benchmarks` object per player (OpenDota provides this natively when `is_parsed=True`).
- **Status:** ❌ Missing from DB schema (`match_data["players"][i]["benchmarks"]`).

## 3. Performances Tab
- **UI Elements:** Table showing multi-kill streaks, couriers killed, camps stacked, runes controlled, max hit, first blood.
- **Data Required:** `performance` metrics per player: `multi_kills`, `courier_kills`, `camps_stacked`, `creeps_stacked`, `runes_log`, `max_hero_hit`, `first_blood_claimed`.
- **Status:** ❌ Missing from DB schema.

## 4. Laning Tab
- **UI Elements:** CS Over Time sparkline, EFF@10, LH@10, DN@10. Heatmap of hero position during laning phase. Line graph of Last Hits + Denies.
- **Data Required:** `lane_efficiency_pct`, `lane`, `lane_role`, `is_roaming`, `lh_t` (Last Hits over time), `dn_t` (Denies over time), `pos` (position heatmap/log).
- **Status:** ⚠️ Partially implemented (we have `lh_t` and `dn_t`, but lack `lane_efficiency`, `lane_role`, and `pos`).

## 5. Combat Tab
- **UI Elements:** Damage Breakdown matrix (who damaged whom, what abilities did damage), Kills breakdown, Deaths breakdown.
- **Data Required:** `damage_targets` (dict of target: damage), `damage_inflictor` (dict of ability: damage), `killed_by` (dict of hero: count), `kills_log`.
- **Status:** ❌ Missing from DB schema.

## 6. Farm Tab
- **UI Elements:** Last Hit breakdown (creeps vs neutrals), Gold sources (creeps, heroes, buildings), XP sources.
- **Data Required:** `gold_reasons`, `xp_reasons`, `killed` (dict of NPC unit: count).
- **Status:** ❌ Missing from DB schema.

## 7. Items Tab
- **UI Elements:** Timeline of item purchases, starting items, early game, mid game, late game.
- **Data Required:** `purchase_log` (we have this), `item_uses` (dict of item: uses).
- **Status:** ⚠️ We have `purchase_log` but need UI implementation.

## 8. Graphs Tab
- **UI Elements:** Advantage chart (Gold/XP difference over time), Team Gold, Team XP, Player Net Worth over time, Player Level over time.
- **Data Required:** `radiant_gold_adv`, `radiant_xp_adv`, `gold_t` (per player), `xp_t` (per player).
- **Status:** ⚠️ We have `gold_t` and `xp_t` but need to calculate or fetch `radiant_gold_adv` and `radiant_xp_adv`.

## 9. Casts Tab
- **UI Elements:** Ability uses, item uses, targets of abilities.
- **Data Required:** `ability_uses`, `item_uses`, `ability_targets`.
- **Status:** ❌ Missing from DB schema.

## 10. Objectives Tab
- **UI Elements:** Timings for towers, roshan, barracks, outposts, runes.
- **Data Required:** `objectives` (list of objective events), `runes_log`.
- **Status:** ❌ Missing from DB schema.

## 11. Vision Tab
- **UI Elements:** Ward placement map, ward duration timelines.
- **Data Required:** `obs_log`, `sen_log`, `obs_left_log`, `sen_left_log` (to know when wards were destroyed/expired).
- **Status:** ⚠️ We have `obs_log` and `sen_log` but not the expiration/destruction logs.

## 12. Actions Tab
- **UI Elements:** Actions per minute (APM), pings, movement commands.
- **Data Required:** `actions_per_min`, `pings`.
- **Status:** ❌ Missing from DB schema.

## 13. Teamfights Tab
- **UI Elements:** Timelines and locations of teamfights, damage, gold/xp shifts, spells used.
- **Data Required:** `teamfights` (array of teamfight objects).
- **Status:** ❌ Missing from DB schema.

## 14. Fantasy Tab
- **UI Elements:** Fantasy points breakdown (kills, deaths, cs, gpm, towers, roshan, teamfight, wards, stuns).
- **Data Required:** `stuns`, `teamfight_participation`, `camps_stacked`, etc.
- **Status:** ❌ Missing from DB schema.

## 15. Chat / Story / Log Tab
- **UI Elements:** Game chat log, generated narrative story, raw event log.
- **Data Required:** `chat`, `objectives`, `kills_log`.
- **Status:** ❌ Missing `chat` from DB schema.

## Summary of DB Changes Needed
We need to update our `backend/services/sync.py` to extract and store the entire OpenDota match JSON locally in our `matches` table under a new JSON column `opendota_raw`, or expand `players` table JSON columns to include `benchmarks`, `performance`, `damage_targets`, `gold_reasons`, `ability_uses`, `teamfights`, `pos`, etc.
