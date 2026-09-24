"""
Draft suggestion engine.
Analyzes visible draft picks and suggests optimal hero picks based on:
- Enemy hero counter-picks (matchup data)
- Ally hero synergies
- Player's personal hero pool (comfort + winrate)
- Current meta strength by rank bracket
"""

import logging
from typing import Optional
from utils.dota_constants import HEROES, get_hero_name, rank_tier_to_bracket

logger = logging.getLogger(__name__)


def calculate_draft_suggestions(
    ally_picks: list[int],
    enemy_picks: list[int],
    bans: list[int],
    player_hero_stats: list[dict],
    hero_matchups: dict[int, list[dict]],
    hero_meta: dict[int, dict],
    rank_bracket: int = 4,
    min_comfort_games: int = 10,
    priority: str = "balanced",
    top_n: int = 8,
) -> list[dict]:
    """
    Generate ranked hero suggestions for the draft.

    Args:
        ally_picks: List of hero_ids already picked by allies
        enemy_picks: List of hero_ids already picked by enemies
        bans: List of banned hero_ids
        player_hero_stats: Player's per-hero stats [{hero_id, games, wins, ...}, ...]
        hero_matchups: {hero_id: [{hero_id, games_played, wins, advantage}, ...]}
        hero_meta: {hero_id: {winrate, pickrate, tier, ...}}
        rank_bracket: Player's rank bracket (1-8)
        min_comfort_games: Minimum games to consider a hero "comfortable"
        priority: "counterpick", "comfort", "meta", "balanced"
        top_n: Number of suggestions to return

    Returns:
        List of suggestion dicts sorted by composite score
    """
    unavailable = set(ally_picks + enemy_picks + bans)

    # Build player comfort map
    comfort_map = {}
    for stat in player_hero_stats:
        hid = stat.get("hero_id")
        games = stat.get("games", 0) or stat.get("match_count", 0) or 0
        wins = stat.get("win", 0) or stat.get("wins", 0) or stat.get("winCount", 0) or 0
        if games >= min_comfort_games:
            comfort_map[hid] = {
                "games": games,
                "winrate": wins / max(games, 1),
                "comfort_score": min(games / 50.0, 1.0),  # Normalized 0-1
            }

    suggestions = []

    for hero_id, hero_data in HEROES.items():
        if hero_id in unavailable:
            continue

        # ── Counter-pick score (vs enemy heroes) ─────────────
        counter_score = 0.0
        counter_reasons = []
        for enemy_id in enemy_picks:
            matchup_data = hero_matchups.get(hero_id, [])
            for mu in matchup_data:
                if mu.get("hero_id") == enemy_id or mu.get("hero_id2") == enemy_id:
                    advantage = mu.get("advantage", 0)
                    if advantage is None:
                        advantage = 0
                    counter_score += advantage
                    if advantage > 1.0:
                        counter_reasons.append(
                            f"Good against {get_hero_name(enemy_id)} (+{advantage:.1f}%)"
                        )
                    elif advantage < -1.0:
                        counter_reasons.append(
                            f"Weak against {get_hero_name(enemy_id)} ({advantage:.1f}%)"
                        )
                    break

        # Normalize counter score to 0-100 range
        if enemy_picks:
            counter_score_norm = 50 + (counter_score / max(len(enemy_picks), 1)) * 10
        else:
            counter_score_norm = 50

        # ── Synergy score (with ally heroes) ─────────────────
        synergy_score = 0.0
        synergy_reasons = []
        for ally_id in ally_picks:
            matchup_data = hero_matchups.get(hero_id, [])
            for mu in matchup_data:
                # Some APIs provide "with" data
                if mu.get("with_hero_id") == ally_id:
                    syn = mu.get("synergy", 0) or 0
                    synergy_score += syn
                    if syn > 1.0:
                        synergy_reasons.append(
                            f"Synergy with {get_hero_name(ally_id)} (+{syn:.1f}%)"
                        )
                    break

        synergy_score_norm = 50 + synergy_score * 5

        # ── Comfort score (player's hero pool) ───────────────
        comfort = comfort_map.get(hero_id)
        if comfort:
            comfort_score = (
                comfort["comfort_score"] * 40 +
                comfort["winrate"] * 60
            )
            comfort_reason = (
                f"You have {comfort['games']} games "
                f"({comfort['winrate']*100:.0f}% WR)"
            )
        else:
            comfort_score = 20  # Low score for unfamiliar heroes
            comfort_reason = "Not in your hero pool"

        # ── Meta score ───────────────────────────────────────
        meta = hero_meta.get(hero_id, {})
        meta_winrate = meta.get("winrate", 0.5)
        meta_pickrate = meta.get("pickrate", 0.0)
        meta_score = (meta_winrate * 100) * 0.7 + min(meta_pickrate * 500, 30) * 0.3
        meta_tier = "S" if meta_winrate > 0.54 else "A" if meta_winrate > 0.52 else "B" if meta_winrate > 0.50 else "C" if meta_winrate > 0.48 else "D"

        # ── Composite score based on priority ────────────────
        weights = {
            "counterpick": {"counter": 0.45, "synergy": 0.15, "comfort": 0.25, "meta": 0.15},
            "comfort":     {"counter": 0.15, "synergy": 0.10, "comfort": 0.55, "meta": 0.20},
            "meta":        {"counter": 0.20, "synergy": 0.15, "comfort": 0.15, "meta": 0.50},
            "balanced":    {"counter": 0.30, "synergy": 0.15, "comfort": 0.30, "meta": 0.25},
        }
        w = weights.get(priority, weights["balanced"])

        composite = (
            counter_score_norm * w["counter"] +
            synergy_score_norm * w["synergy"] +
            comfort_score * w["comfort"] +
            meta_score * w["meta"]
        )

        # Build reasoning
        reasons = []
        if counter_reasons:
            reasons.extend(counter_reasons[:2])
        if synergy_reasons:
            reasons.extend(synergy_reasons[:1])
        reasons.append(comfort_reason)
        reasons.append(f"Meta tier: {meta_tier} ({meta_winrate*100:.1f}% WR)")

        suggestions.append({
            "hero_id": hero_id,
            "hero_name": get_hero_name(hero_id),
            "composite_score": round(composite, 1),
            "counter_score": round(counter_score_norm, 1),
            "synergy_score": round(synergy_score_norm, 1),
            "comfort_score": round(comfort_score, 1),
            "meta_score": round(meta_score, 1),
            "meta_tier": meta_tier,
            "meta_winrate": round(meta_winrate * 100, 1),
            "player_games": comfort["games"] if comfort else 0,
            "player_winrate": round(comfort["winrate"] * 100, 1) if comfort else 0,
            "reasons": reasons,
            "roles": hero_data.get("roles", []),
        })

    # Sort by composite score descending
    suggestions.sort(key=lambda x: x["composite_score"], reverse=True)

    return suggestions[:top_n]
