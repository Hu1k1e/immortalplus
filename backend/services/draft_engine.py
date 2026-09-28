"""
Draft suggestion engine — 5 roles x 3 categories.

Restructured from an earlier single-list version after real user testing
showed two problems: (1) suggestions only ever cited a matchup against
ONE enemy hero (the first match found, via an early `break`) instead of
the whole enemy draft, and (2) a "synergy" score that was always zero —
it read OpenDota's `with_hero_id` field, which OpenDota's matchup API
never actually populates (confirmed earlier this session). Both are
fixed here: matchup scoring now averages advantage across every enemy
pick, and synergy is a role-completeness heuristic instead of a
fabricated statistic — see _role_completeness_bonus's docstring for why
that's the honest choice given what data is actually available.

Per Dota2ProTracker's convention (matches backend/utils/dota_constants.py
POSITIONS), positions are 1=Hard Carry, 2=Mid, 3=Offlane, 4=Soft Support,
5=Hard Support. Each gets three ranked lists:
  - meta_best: highest current-patch winrate at that position (HeroPositionMeta)
  - your_best: the player's own best heroes at that position, from their
    own match history
  - combined: a blended ranking (meta + personal + enemy matchup +
    role-completeness), the "best overall suggestion" list
"""

import logging
from utils.dota_constants import HEROES, get_hero_name, POSITIONS

logger = logging.getLogger(__name__)

ROLE_KEYS = {1: "carry", 2: "mid", 3: "offlane", 4: "soft_support", 5: "hard_support"}

# Minimum games before personal stats for a hero are trusted at all —
# below this, a small sample could show a misleading 100% or 0% winrate.
MIN_PERSONAL_GAMES = 3


def estimate_position(lane_role: int | None, gpm: int | None) -> int | None:
    """
    Rough hero-position estimate (1-5) from data Match rows actually
    have. OpenDota's lane_role is only 1=Safe/2=Mid/3=Off/4=Jungle — it
    doesn't distinguish a core from a support sharing the same lane, so
    this uses GPM as a second signal to split each lane into its core
    and support position. This is a heuristic, not a precise classifier
    (a real one would need item timings / support-gold-spent, which
    isn't stored) — good enough for ranking "your best heroes in this
    role" relative to each other, not presented as exact.
    """
    if lane_role is None:
        return None
    gpm = gpm or 0
    if lane_role == 2:
        return 2  # Mid
    if lane_role == 1:
        return 1 if gpm >= 400 else 5  # Safe lane: carry vs hard support
    if lane_role == 3:
        return 3 if gpm >= 350 else 4  # Off lane: offlaner vs soft support
    if lane_role == 4:
        return 1  # Jungle is rare in modern Dota; fall back to carry
    return None


def compute_personal_position_stats(matches: list) -> dict[int, dict[int, dict]]:
    """
    Buckets a player's own Match rows into {position: {hero_id: {games,
    wins}}} via estimate_position. Takes Match ORM objects directly
    (needs .hero_id, .lane_role, .gpm, .result) so the router can pass
    its own query result straight through.
    """
    stats: dict[int, dict[int, dict]] = {p: {} for p in ROLE_KEYS}
    for m in matches:
        position = estimate_position(m.lane_role, m.gpm)
        if position is None:
            continue
        bucket = stats[position].setdefault(m.hero_id, {"games": 0, "wins": 0})
        bucket["games"] += 1
        if m.result == "win":
            bucket["wins"] += 1
    return stats


def _role_completeness_bonus(hero_id: int, ally_picks: list[int]) -> tuple[float, str | None]:
    """
    Small bonus (0-10) if none of the allies already picked share this
    hero's primary role tag (HEROES[hero]["roles"][0] — Carry/Support/
    Initiator/etc). This is a heuristic for team-composition diversity,
    NOT a real statistical synergy score: OpenDota's matchup API has no
    real hero-pair "plays well together" data to draw from (its
    with_hero_id field is present in the schema but never actually
    populated — confirmed directly, not assumed), and no other source in
    this app currently has that data either. Better to be honest about
    "probably fills a gap in your comp" than report a fabricated
    percentage with false precision.
    """
    hero_roles = set(HEROES.get(hero_id, {}).get("roles", []))
    if not hero_roles:
        return 0.0, None
    primary_role = HEROES[hero_id]["roles"][0]

    ally_roles = set()
    for ally_id in ally_picks:
        ally_roles.update(HEROES.get(ally_id, {}).get("roles", [])[:1])

    if primary_role not in ally_roles:
        return 10.0, f"Fills a {primary_role} gap in your team"
    return 0.0, None


def _matchup_score(hero_id: int, enemy_picks: list[int], hero_matchups: dict[int, list[dict]]) -> tuple[float, list[str]]:
    """Average advantage vs EVERY currently-picked enemy hero this app
    has matchup data for (previously stopped at the first match found,
    which meant a suggestion only ever cited one enemy hero even with a
    full 5-hero enemy draft). Returns a 0-100-normalized score and up to
    2 human-readable reasons for the strongest/weakest matchups found."""
    if not enemy_picks:
        return 50.0, []

    matchup_data = hero_matchups.get(hero_id, [])
    by_enemy = {m.get("hero_id"): m.get("advantage", 0) or 0 for m in matchup_data}

    advantages = []
    reasons = []
    for enemy_id in enemy_picks:
        if enemy_id in by_enemy:
            adv = by_enemy[enemy_id]
            advantages.append(adv)
            if abs(adv) > 1.0:
                verb = "Good against" if adv > 0 else "Weak against"
                reasons.append(f"{verb} {get_hero_name(enemy_id)} ({adv:+.1f}%)")

    if not advantages:
        return 50.0, []

    avg_advantage = sum(advantages) / len(advantages)
    score = 50 + avg_advantage * 5
    reasons.sort(key=lambda r: abs(float(r.rsplit("(", 1)[1].rstrip("%)").replace("+", ""))), reverse=True)
    return max(0.0, min(100.0, score)), reasons[:2]


def calculate_role_based_suggestions(
    ally_picks: list[int],
    enemy_picks: list[int],
    bans: list[int],
    hero_position_meta: dict[int, dict[int, dict]],
    personal_position_stats: dict[int, dict[int, dict]],
    hero_matchups: dict[int, list[dict]],
    top_n: int = 6,
) -> dict[str, dict[str, list[dict]]]:
    """
    Args:
        hero_position_meta: {position: {hero_id: {winrate, matches, d2pt_rating}}}
            from HeroPositionMeta (Dota2ProTracker, current patch).
        personal_position_stats: {position: {hero_id: {games, wins, winrate}}}
            from the player's own match history, bucketed via estimate_position.
        hero_matchups: {hero_id: [{hero_id, advantage}, ...]} vs enemy heroes,
            from HeroMatchup — hero_id here is the ENEMY being matched against.

    Returns {role_key: {"meta_best": [...], "your_best": [...], "combined": [...]}}
    for all 5 roles, each list sorted best-first, length up to top_n.
    """
    unavailable = set(ally_picks + enemy_picks + bans)
    result = {}

    for position, role_key in ROLE_KEYS.items():
        meta_for_role = hero_position_meta.get(position, {})
        personal_for_role = personal_position_stats.get(position, {})

        # ── meta_best: current-patch winrate at this position ────────
        meta_best = []
        for hero_id, stats in meta_for_role.items():
            if hero_id in unavailable:
                continue
            winrate = stats.get("winrate")
            if winrate is None:
                continue
            meta_best.append({
                "hero_id": hero_id,
                "hero_name": get_hero_name(hero_id),
                "score": round(winrate * 100, 1),
                "reason": f"{winrate*100:.1f}% WR this patch ({stats.get('matches', 0)} matches)",
            })
        meta_best.sort(key=lambda x: x["score"], reverse=True)
        meta_best = meta_best[:top_n]

        # ── your_best: player's own history at this position ─────────
        your_best = []
        for hero_id, stats in personal_for_role.items():
            if hero_id in unavailable or stats["games"] < MIN_PERSONAL_GAMES:
                continue
            winrate = stats["wins"] / stats["games"]
            your_best.append({
                "hero_id": hero_id,
                "hero_name": get_hero_name(hero_id),
                "score": round(winrate * 100, 1),
                "reason": f"{stats['games']} games, {winrate*100:.0f}% WR",
            })
        your_best.sort(key=lambda x: (x["score"], personal_for_role[x["hero_id"]]["games"]), reverse=True)
        your_best = your_best[:top_n]

        # ── combined: blended overall suggestion ──────────────────────
        candidate_ids = set(meta_for_role.keys()) | set(personal_for_role.keys())
        combined = []
        for hero_id in candidate_ids:
            if hero_id in unavailable:
                continue

            meta_stats = meta_for_role.get(hero_id)
            meta_component = (meta_stats["winrate"] * 100) if meta_stats and meta_stats.get("winrate") else 50.0

            personal_stats = personal_for_role.get(hero_id)
            if personal_stats and personal_stats["games"] >= MIN_PERSONAL_GAMES:
                personal_winrate = personal_stats["wins"] / personal_stats["games"]
                confidence = min(personal_stats["games"] / 20.0, 1.0)
                personal_component = personal_winrate * 100 * confidence + 50 * (1 - confidence)
            else:
                personal_component = 50.0

            matchup_component, matchup_reasons = _matchup_score(hero_id, enemy_picks, hero_matchups)
            role_bonus, role_reason = _role_completeness_bonus(hero_id, ally_picks)

            score = (
                meta_component * 0.35 +
                personal_component * 0.30 +
                matchup_component * 0.25 +
                role_bonus
            )

            reasons = list(matchup_reasons)
            if personal_stats and personal_stats["games"] >= MIN_PERSONAL_GAMES:
                reasons.append(f"You: {personal_stats['games']} games, {personal_stats['wins']/personal_stats['games']*100:.0f}% WR")
            if meta_stats and meta_stats.get("winrate"):
                reasons.append(f"{meta_stats['winrate']*100:.1f}% WR this patch")
            if role_reason:
                reasons.append(role_reason)

            combined.append({
                "hero_id": hero_id,
                "hero_name": get_hero_name(hero_id),
                "score": round(score, 1),
                "reasons": reasons[:3],
            })
        combined.sort(key=lambda x: x["score"], reverse=True)
        combined = combined[:top_n]

        result[role_key] = {
            "position": position,
            "position_name": POSITIONS[position],
            "meta_best": meta_best,
            "your_best": your_best,
            "combined": combined,
        }

    return result
