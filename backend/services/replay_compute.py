"""
Ports of the derived-stat formulas from odota_core's svc/util/compute.ts
(computeMatchData) and svc/util/laneMappings.ts.

The local odota/parser container's /blob endpoint returns only *raw* parsed
replay data per player (kills_log, killed, life_state, buyback_log,
lane_pos, gold_t, pings, ...) — confirmed against a real sample response
vendored in odota_core/json/. OpenDota's own backend runs computeMatchData()
over that raw data to derive most of what the UI actually displays
(hero_kills, tower_kills, buyback_count, lane_efficiency_pct, lane, ...).
We replicate the same formulas here so a match we parse locally gets the
same derived stats regardless of whether OpenDota's own official parse job
ever completes.

Each helper is a no-op when its raw input field is missing, so this is safe
to call on any player dict from any source.
"""

from typing import Optional


def _apply_kill_categories(p: dict) -> None:
    """Mirrors compute.ts's `if (pm.killed) { ... }` block."""
    killed = p.get("killed")
    if not isinstance(killed, dict):
        return
    counters = {
        "lane_kills": 0, "observer_kills": 0, "sentry_kills": 0,
        "hero_kills": 0, "neutral_kills": 0, "ancient_kills": 0,
        "tower_kills": 0, "courier_kills": 0, "roshan_kills": 0,
        "necronomicon_kills": 0,
    }
    for key, count in killed.items():
        if not isinstance(count, (int, float)):
            continue
        if "creep_goodguys" in key or "creep_badguys" in key:
            counters["lane_kills"] += count
        if "observer" in key:
            counters["observer_kills"] += count
        if "sentry" in key:
            counters["sentry_kills"] += count
        if key.startswith("npc_dota_hero"):
            counters["hero_kills"] += count
        if key.startswith("npc_dota_neutral"):
            counters["neutral_kills"] += count
            # Best-effort: real ancients list needs dotaconstants' ancients.json,
            # which we don't have vendored — ancient camp units conventionally
            # include "ancient" in their internal name.
            if "ancient" in key:
                counters["ancient_kills"] += count
        if "_tower" in key:
            counters["tower_kills"] += count
        if "courier" in key:
            counters["courier_kills"] += count
        if "roshan" in key:
            counters["roshan_kills"] += count
        if "necronomicon" in key:
            counters["necronomicon_kills"] += count
    p.update(counters)


def _apply_buyback_count(p: dict) -> None:
    log = p.get("buyback_log")
    if isinstance(log, list):
        p["buyback_count"] = len(log)


def _apply_life_state_dead(p: dict) -> None:
    life_state = p.get("life_state")
    if isinstance(life_state, dict):
        p["life_state_dead"] = (life_state.get("1", 0) or 0) + (life_state.get("2", 0) or 0)


def _apply_pings(p: dict) -> None:
    pings = p.get("pings")
    if isinstance(pings, dict):
        p["pings"] = pings.get("0", 0) or 0


def _apply_observer_sentry_uses(p: dict) -> None:
    item_uses = p.get("item_uses")
    if isinstance(item_uses, dict):
        p["observer_uses"] = item_uses.get("ward_observer", 0)
        p["sentry_uses"] = item_uses.get("ward_sentry", 0)


def _apply_camps_stacked(p: dict) -> None:
    stacked_t = p.get("camps_stacked_t")
    if isinstance(stacked_t, list):
        p["camps_stacked"] = len(stacked_t)


def _apply_lane_efficiency(p: dict) -> None:
    gold_t = p.get("gold_t")
    if isinstance(gold_t, list) and len(gold_t) > 10:
        # Same constants as compute.ts: static 10-minute gold baseline from
        # standard creep spawns (melee + ranged + siege + passive + starting).
        ten_minute = 40 * 60 + 45 * 20 + 74 * 2 + 600 * 1.5 + 600
        efficiency = gold_t[10] / ten_minute
        p["lane_efficiency"] = efficiency
        p["lane_efficiency_pct"] = int(efficiency * 100)


def _apply_actions_per_min(p: dict, duration: Optional[int]) -> None:
    actions = p.get("actions")
    if isinstance(actions, dict) and duration:
        total = sum(v for v in actions.values() if isinstance(v, (int, float)))
        p["actions_per_min"] = int((total / duration) * 60)


def _apply_purchase_derived(p: dict, radiant_win: Optional[bool]) -> None:
    purchase_log = p.get("purchase_log")
    if not isinstance(purchase_log, list):
        return
    is_radiant = (p.get("player_slot") or 0) < 128
    purchase_time, first_purchase_time, item_win, item_usage = {}, {}, {}, {}
    for entry in purchase_log:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key")
        time = entry.get("time")
        if not key or key.startswith("recipe_") or key == "ward_dispenser":
            continue
        purchase_time[key] = purchase_time.get(key, 0) + (time or 0)
        if key not in first_purchase_time:
            first_purchase_time[key] = time
        item_usage[key] = 1
        if radiant_win is not None:
            item_win[key] = 1 if is_radiant == radiant_win else 0
    p["purchase_time"] = purchase_time
    p["first_purchase_time"] = first_purchase_time
    p["item_win"] = item_win
    p["item_usage"] = item_usage


# --- Lane detection: exact port of laneMappings.ts's per-cell rule ---

def _lane_for_cell(i: int, j: int) -> int:
    if abs(i - (127 - j)) < 8:
        return 2  # mid
    if j < 27 or i < 27:
        return 3  # top
    if j >= 100 or i >= 100:
        return 1  # bot
    if i < 50:
        return 5  # dire jungle
    if i >= 77:
        return 4  # radiant jungle
    return 2  # mid


# lane -> lane_role, mirroring compute.ts's laneRoles table (bot=1, mid=2, top=3, jungle=4)
_LANE_ROLES_RADIANT = {1: 1, 2: 2, 3: 3, 4: 4, 5: 4}
_LANE_ROLES_DIRE = {1: 3, 2: 2, 3: 1, 4: 4, 5: 4}


def _apply_lane_from_pos(p: dict) -> None:
    """Mirrors compute.ts's getLaneFromPosData, fed by the raw lane_pos histogram."""
    lane_pos = p.get("lane_pos")
    if not isinstance(lane_pos, dict) or not lane_pos:
        return
    is_radiant = (p.get("player_slot") or 0) < 128
    counts: dict = {}
    total = 0
    for x_str, y_dict in lane_pos.items():
        if not isinstance(y_dict, dict):
            continue
        try:
            adj_x = int(x_str) - 64
        except (TypeError, ValueError):
            continue
        for y_str, val in y_dict.items():
            try:
                y = int(y_str)
                val = int(val)
            except (TypeError, ValueError):
                continue
            adj_y = 128 - (y - 64)
            if not (0 <= adj_y < 128 and 0 <= adj_x < 128) or val <= 0:
                continue
            lane = _lane_for_cell(adj_y, adj_x)
            counts[lane] = counts.get(lane, 0) + val
            total += val
    if not total or not counts:
        return
    mode_lane = max(counts, key=counts.get)
    mode_count = counts[mode_lane]
    p["lane"] = mode_lane
    p["lane_role"] = (_LANE_ROLES_RADIANT if is_radiant else _LANE_ROLES_DIRE).get(mode_lane)
    p["is_roaming"] = (mode_count / total) < 0.45


def apply_computed_fields(players: list, duration: Optional[int] = None, radiant_win: Optional[bool] = None) -> None:
    """
    Mutate each player dict in `players` in place, adding the derived stats
    OpenDota's own backend computes from raw parser output. Call this on
    locally-parsed data before merging it into a match record.
    """
    for p in players or []:
        if not isinstance(p, dict):
            continue
        _apply_kill_categories(p)
        _apply_buyback_count(p)
        _apply_life_state_dead(p)
        _apply_pings(p)
        _apply_observer_sentry_uses(p)
        _apply_camps_stacked(p)
        _apply_lane_efficiency(p)
        _apply_actions_per_min(p, duration)
        _apply_purchase_derived(p, radiant_win)
        _apply_lane_from_pos(p)
