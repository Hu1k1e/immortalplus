"""
Post-game analysis engine.
Generates performance scores, identifies mistakes, and creates actionable coaching items.
"""

import json
import logging
from typing import Optional

from utils.dota_constants import (
    HEROES, get_hero_name, RANK_BRACKETS,
    rank_tier_to_bracket, get_next_rank_bracket, POSITIONS,
)

logger = logging.getLogger(__name__)

# ── Benchmark targets by rank bracket ────────────────────────────
# These are approximate targets. Source: OpenDota benchmarks, Stratz.
# Format: {bracket: {metric: target_value}}
RANK_BENCHMARKS = {
    1: {"cs_min": 3.5, "gpm": 350, "xpm": 400, "deaths": 10.0, "hero_dmg_min": 300, "wards": 2, "kda": 2.0},
    2: {"cs_min": 4.2, "gpm": 380, "xpm": 430, "deaths": 9.0, "hero_dmg_min": 350, "wards": 3, "kda": 2.3},
    3: {"cs_min": 5.0, "gpm": 420, "xpm": 470, "deaths": 8.0, "hero_dmg_min": 400, "wards": 4, "kda": 2.6},
    4: {"cs_min": 5.8, "gpm": 460, "xpm": 510, "deaths": 7.5, "hero_dmg_min": 450, "wards": 5, "kda": 3.0},
    5: {"cs_min": 6.5, "gpm": 510, "xpm": 560, "deaths": 6.8, "hero_dmg_min": 500, "wards": 6, "kda": 3.4},
    6: {"cs_min": 7.2, "gpm": 560, "xpm": 600, "deaths": 5.8, "hero_dmg_min": 550, "wards": 7, "kda": 3.8},
    7: {"cs_min": 8.0, "gpm": 620, "xpm": 650, "deaths": 5.0, "hero_dmg_min": 620, "wards": 8, "kda": 4.2},
    8: {"cs_min": 9.0, "gpm": 680, "xpm": 700, "deaths": 4.0, "hero_dmg_min": 700, "wards": 10, "kda": 5.0},
}


def _score_metric(value: float, target: float, higher_is_better: bool = True) -> float:
    """Score a metric 0-100 based on how close it is to the target."""
    if target == 0:
        return 50.0
    if higher_is_better:
        ratio = value / target
    else:
        # For deaths: lower is better
        ratio = target / max(value, 0.1)
    return min(100.0, max(0.0, ratio * 100))


def _classify_role(lane: Optional[int], lane_role: Optional[int], hero_id: int) -> str:
    """Best-effort role classification from lane data."""
    hero = HEROES.get(hero_id, {})
    roles = hero.get("roles", [])

    if lane == 1:  # Safe lane
        if "Carry" in roles:
            return "pos1"
        return "pos5"
    elif lane == 2:  # Mid
        return "pos2"
    elif lane == 3:  # Off lane
        if "Support" in roles:
            return "pos4"
        return "pos3"
    elif lane == 4:  # Jungle
        return "pos4"

    # Fallback based on hero roles
    if "Carry" in roles:
        return "pos1"
    elif "Support" in roles:
        return "pos5"
    return "pos3"


def analyze_match(match_data: dict, player_data: dict, rank_tier: int = 0) -> dict:
    """
    Perform comprehensive post-game analysis on a single match.

    Args:
        match_data: Full match details from OpenDota
        player_data: The specific player's data from the match
        rank_tier: Player's current rank tier

    Returns:
        Analysis result dict with scores, mistakes, and action items
    """
    bracket = rank_tier_to_bracket(rank_tier)
    next_bracket = get_next_rank_bracket(bracket)
    duration_min = (match_data.get("duration") or 1) / 60

    hero_id = player_data.get("hero_id", 0)
    hero_name = get_hero_name(hero_id)
    role = _classify_role(
        player_data.get("lane"),
        player_data.get("lane_role"),
        hero_id,
    )

    # ── Extract raw stats ────────────────────────────────────────
    kills = player_data.get("kills") or 0
    deaths = player_data.get("deaths") or 0
    assists = player_data.get("assists") or 0
    gpm = player_data.get("gold_per_min") or player_data.get("gpm") or 0
    xpm = player_data.get("xp_per_min") or player_data.get("xpm") or 0
    last_hits = player_data.get("last_hits") or 0
    denies = player_data.get("denies") or 0
    hero_damage = player_data.get("hero_damage") or 0
    tower_damage = player_data.get("tower_damage") or 0
    hero_healing = player_data.get("hero_healing") or 0

    cs_min = last_hits / max(duration_min, 1)
    hero_dmg_min = hero_damage / max(duration_min, 1)
    kda = (kills + assists) / max(deaths, 1)

    # Laning phase data
    lh_t = player_data.get("lh_t") or []
    if isinstance(lh_t, str):
        try:
            lh_t = json.loads(lh_t)
        except (json.JSONDecodeError, TypeError):
            lh_t = []
    cs_at_10 = lh_t[10] if len(lh_t) > 10 else 0

    # Gold timeline
    gold_t = player_data.get("gold_t") or []
    if isinstance(gold_t, str):
        try:
            gold_t = json.loads(gold_t)
        except (json.JSONDecodeError, TypeError):
            gold_t = []

    # Ward data
    obs_placed = len(player_data.get("obs_log") or []) if isinstance(player_data.get("obs_log"), list) else 0
    sen_placed = len(player_data.get("sen_log") or []) if isinstance(player_data.get("sen_log"), list) else 0
    total_wards = obs_placed + sen_placed

    # ── Get benchmarks for current and next rank ─────────────────
    current_bench = RANK_BENCHMARKS.get(bracket, RANK_BENCHMARKS[4])
    next_bench = RANK_BENCHMARKS.get(next_bracket, RANK_BENCHMARKS[5])
    pro_bench = RANK_BENCHMARKS[8]

    # ── Score each dimension ─────────────────────────────────────
    # Adjust benchmarks for role (supports have lower CS/GPM expectations)
    role_cs_factor = 1.0
    role_gpm_factor = 1.0
    role_ward_factor = 1.0
    if role in ("pos4", "pos5"):
        role_cs_factor = 0.3
        role_gpm_factor = 0.7
        role_ward_factor = 2.0
    elif role == "pos3":
        role_cs_factor = 0.7
        role_gpm_factor = 0.85

    farming_score = (
        _score_metric(cs_min, current_bench["cs_min"] * role_cs_factor) * 0.5 +
        _score_metric(gpm, current_bench["gpm"] * role_gpm_factor) * 0.5
    )
    fighting_score = (
        _score_metric(kda, current_bench["kda"]) * 0.4 +
        _score_metric(hero_dmg_min, current_bench["hero_dmg_min"]) * 0.4 +
        _score_metric(deaths, current_bench["deaths"], higher_is_better=False) * 0.2
    )
    vision_score = _score_metric(
        total_wards,
        current_bench["wards"] * role_ward_factor,
    )
    death_score = _score_metric(
        deaths, current_bench["deaths"], higher_is_better=False
    )
    objective_score = _score_metric(tower_damage, 2000) * 0.5 + 50  # Baseline 50

    performance_score = (
        farming_score * 0.25 +
        fighting_score * 0.30 +
        vision_score * 0.15 +
        death_score * 0.15 +
        objective_score * 0.15
    )

    # ── Laning phase score ───────────────────────────────────────
    if role in ("pos1", "pos2"):
        cs_10_target = {1: 35, 2: 40, 3: 45, 4: 50, 5: 55, 6: 60, 7: 65, 8: 75}
        target = cs_10_target.get(bracket, 50)
        laning_score = _score_metric(cs_at_10, target)
    elif role == "pos3":
        target = {1: 20, 2: 25, 3: 30, 4: 35, 5: 40, 6: 45, 7: 50, 8: 55}
        laning_score = _score_metric(cs_at_10, target.get(bracket, 30))
    else:
        # Supports: laning judged differently
        laning_score = min(70 + (assists * 5), 100) if kills + assists > 0 else 50

    # ── Rank comparison ──────────────────────────────────────────
    rank_comparison = {
        "your_rank": {
            "bracket": bracket,
            "cs_min": {"yours": round(cs_min, 1), "target": current_bench["cs_min"] * role_cs_factor},
            "gpm": {"yours": gpm, "target": int(current_bench["gpm"] * role_gpm_factor)},
            "xpm": {"yours": xpm, "target": current_bench["xpm"]},
            "deaths": {"yours": deaths, "target": current_bench["deaths"]},
            "kda": {"yours": round(kda, 1), "target": current_bench["kda"]},
            "wards": {"yours": total_wards, "target": int(current_bench["wards"] * role_ward_factor)},
        },
        "next_rank": {
            "bracket": next_bracket,
            "cs_min": {"target": next_bench["cs_min"] * role_cs_factor},
            "gpm": {"target": int(next_bench["gpm"] * role_gpm_factor)},
            "xpm": {"target": next_bench["xpm"]},
            "deaths": {"target": next_bench["deaths"]},
            "kda": {"target": next_bench["kda"]},
            "wards": {"target": int(next_bench["wards"] * role_ward_factor)},
        },
        "pro": {
            "bracket": 8,
            "cs_min": {"target": pro_bench["cs_min"] * role_cs_factor},
            "gpm": {"target": int(pro_bench["gpm"] * role_gpm_factor)},
            "xpm": {"target": pro_bench["xpm"]},
            "deaths": {"target": pro_bench["deaths"]},
            "kda": {"target": pro_bench["kda"]},
            "wards": {"target": int(pro_bench["wards"] * role_ward_factor)},
        },
    }

    # ── Identify mistakes ────────────────────────────────────────
    mistakes = []

    # Low CS
    if role in ("pos1", "pos2") and cs_at_10 < current_bench["cs_min"] * 7:
        mistakes.append({
            "time": "10:00",
            "type": "farming",
            "severity": "major" if cs_at_10 < current_bench["cs_min"] * 5 else "minor",
            "description": (
                f"Low CS at 10 minutes: {cs_at_10} last hits. "
                f"Target for your rank: {int(current_bench['cs_min'] * 7)}. "
                f"Next rank target: {int(next_bench['cs_min'] * 7)}."
            ),
        })

    # Too many deaths
    if deaths > current_bench["deaths"] + 2:
        mistakes.append({
            "time": "full game",
            "type": "deaths",
            "severity": "major",
            "description": (
                f"You died {deaths} times. Average for your rank: {current_bench['deaths']:.0f}. "
                f"Each unnecessary death gives the enemy gold and map control."
            ),
        })

    # Low GPM for core role
    if role in ("pos1", "pos2") and gpm < current_bench["gpm"] * 0.8:
        mistakes.append({
            "time": "full game",
            "type": "farming",
            "severity": "major",
            "description": (
                f"Low GPM ({gpm}) for a core role. Target: {int(current_bench['gpm'])}. "
                f"Focus on farming patterns and reducing dead time between camps."
            ),
        })

    # Low vision for supports
    if role in ("pos4", "pos5") and total_wards < current_bench["wards"]:
        mistakes.append({
            "time": "full game",
            "type": "vision",
            "severity": "minor",
            "description": (
                f"Low ward count ({total_wards}). Expected for your rank: {int(current_bench['wards'] * role_ward_factor)}. "
                f"Vision control is one of the highest-impact activities for supports."
            ),
        })

    # Low tower damage for cores
    if role in ("pos1", "pos2", "pos3") and tower_damage < 1000 and duration_min > 25:
        mistakes.append({
            "time": "mid-late game",
            "type": "objectives",
            "severity": "minor",
            "description": (
                f"Low tower damage ({tower_damage}). After winning fights, "
                f"push objectives instead of chasing kills."
            ),
        })

    # ── Generate action items ────────────────────────────────────
    action_items = []

    if role in ("pos1", "pos2") and cs_at_10 < current_bench["cs_min"] * 7:
        target_cs = int(next_bench["cs_min"] * 7)
        action_items.append({
            "text": f"Practice last hitting on {hero_name} — aim for {target_cs} CS by 10:00 (you had {cs_at_10})",
            "category": "farming",
            "difficulty": "medium",
            "priority": 1,
        })

    if deaths > current_bench["deaths"]:
        action_items.append({
            "text": f"Reduce deaths: check the minimap before moving to dangerous areas. Target: {current_bench['deaths']:.0f} or fewer deaths per game.",
            "category": "positioning",
            "difficulty": "easy",
            "priority": 1,
        })

    if role in ("pos4", "pos5") and total_wards < current_bench["wards"]:
        action_items.append({
            "text": f"Place at least {int(current_bench['wards'] * role_ward_factor)} wards per game when playing support.",
            "category": "vision",
            "difficulty": "easy",
            "priority": 2,
        })

    if role in ("pos1", "pos2") and gpm < current_bench["gpm"]:
        action_items.append({
            "text": f"Improve farming efficiency: reduce dead time between camps. Target GPM: {int(next_bench['gpm'])}+",
            "category": "farming",
            "difficulty": "medium",
            "priority": 2,
        })

    if tower_damage < 1000 and duration_min > 25 and role in ("pos1", "pos2", "pos3"):
        action_items.append({
            "text": "After winning teamfights, prioritize pushing towers instead of chasing retreating heroes.",
            "category": "objectives",
            "difficulty": "easy",
            "priority": 3,
        })

    # Always provide at least one positive/neutral item
    if not action_items:
        action_items.append({
            "text": f"Strong performance on {hero_name}! Focus on consistency — maintain this level across games.",
            "category": "general",
            "difficulty": "easy",
            "priority": 3,
        })

    # ── Phase breakdowns ─────────────────────────────────────────
    laning_analysis = {
        "cs_at_10": cs_at_10,
        "role": role,
        "hero": hero_name,
        "lane": player_data.get("lane"),
        "score": round(laning_score, 1),
        "cs_target": int(current_bench["cs_min"] * 7) if role in ("pos1", "pos2") else None,
    }

    midgame_analysis = {
        "gpm": gpm,
        "xpm": xpm,
        "hero_damage": hero_damage,
        "tower_damage": tower_damage,
        "score": round(farming_score * 0.5 + fighting_score * 0.5, 1),
    }

    lategame_analysis = {
        "final_kda": f"{kills}/{deaths}/{assists}",
        "final_networth": player_data.get("total_gold") or player_data.get("net_worth", 0),
        "duration_min": round(duration_min, 1),
    }

    return {
        "hero_id": hero_id,
        "hero_name": hero_name,
        "role": role,
        "performance_score": round(performance_score, 1),
        "laning_score": round(laning_score, 1),
        "farming_score": round(farming_score, 1),
        "fighting_score": round(fighting_score, 1),
        "vision_score": round(vision_score, 1),
        "objective_score": round(objective_score, 1),
        "death_score": round(death_score, 1),
        "cs_at_10": cs_at_10,
        "cs_benchmark_rank": round(cs_min / max(current_bench["cs_min"], 0.1) * 100, 1),
        "lane_kills": 0,  # TODO: extract from kills_log with time filter
        "lane_deaths": 0,
        "rank_comparison": rank_comparison,
        "mistakes": mistakes,
        "action_items": action_items,
        "laning_analysis": laning_analysis,
        "midgame_analysis": midgame_analysis,
        "lategame_analysis": lategame_analysis,
    }
