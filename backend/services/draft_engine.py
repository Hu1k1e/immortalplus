"""
Draft suggestion engine — 5 roles x 3 categories.

Restructured from an earlier single-list version after real user testing
and feedback surfaced three real problems, all fixed here:

1. Suggestions only ever cited a matchup against ONE enemy hero (an
   early `break` in the old loop) instead of the whole enemy draft —
   _matchup_score now averages advantage across every enemy pick.

2. A "synergy" score that was always zero, since it read OpenDota's
   `with_hero_id` field, which OpenDota's matchup API never actually
   populates (confirmed directly). There is no real hero-pair "plays
   well together" data available from any source this app uses. Rather
   than keep faking a number, "team composition" here is exactly what
   the data actually supports: each candidate hero's own general
   strength (meta_component) combined with its measured performance
   against the SPECIFIC enemies already picked (matchup_component). No
   separate synergy term.

3. Position-meta (Dota2ProTracker) is high-MMR/pro only, not adjusted to
   the player's own rank. meta_component now blends it with HeroMeta
   (OpenDota's overall hero winrate, broken down by rank bracket but not
   by position) when the player's rank bracket is known — ProTracker
   says how strong a hero is at this position among strong players,
   HeroMeta says how that hero performs specifically at the player's own
   rank; blending gets a rank-relative read that neither alone provides.

Per Dota2ProTracker's convention (matches backend/utils/dota_constants.py
POSITIONS), positions are 1=Hard Carry, 2=Mid, 3=Offlane, 4=Soft Support,
5=Hard Support. Each gets three ranked lists:
  - meta_best: highest current-patch winrate at that position (HeroPositionMeta),
    rank-adjusted by HeroMeta when available
  - your_best: the player's own best heroes at that position, from their
    own match history
  - combined: a blended ranking (meta + personal + enemy matchup), the
    "best overall suggestion" list
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
    Fallback hero-position estimate (1-5), used only when a Match row
    has no real Stratz-provided position (OpenDota-sourced matches, or
    Stratz matches synced before this field was added — see
    compute_personal_position_stats, which prefers the real value and
    only falls back to this).

    OpenDota's lane_role is only 1=Safe/2=Mid/3=Off/4=Jungle — it
    doesn't distinguish a core from a support sharing the same lane, so
    this uses GPM as a second signal to split each lane into its core
    and support position. This is a heuristic, not a precise classifier.
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
    wins}}}. Prefers each match's real .position (Stratz's own computed
    1-5 position — see services/stratz.py's _parse_stratz_position and
    models.py's Match.position) when present, falling back to the
    lane_role+GPM heuristic (estimate_position) only for matches that
    don't have it (OpenDota-sourced, or synced before this field
    existed). Takes Match ORM objects directly so the router can pass
    its own query result straight through.
    """
    stats: dict[int, dict[int, dict]] = {p: {} for p in ROLE_KEYS}
    for m in matches:
        position = m.position or estimate_position(m.lane_role, m.gpm)
        if position is None or position not in stats:
            continue
        bucket = stats[position].setdefault(m.hero_id, {"games": 0, "wins": 0})
        bucket["games"] += 1
        if m.result == "win":
            bucket["wins"] += 1
    return stats


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


def _rank_adjusted_meta(hero_id: int, position_stats: dict | None, hero_meta_at_rank: dict[int, dict]) -> tuple[float, str | None]:
    """
    Blends Dota2ProTracker's position-specific (but high-MMR/pro-only)
    winrate with OpenDota's HeroMeta winrate at the player's OWN rank
    bracket (position-agnostic, but rank-specific) when both are
    available. 60/40 weight toward the position-specific number, since
    it's the more relevant signal for "should I pick this at THIS
    position" — HeroMeta only adjusts it toward how the hero performs at
    the player's actual rank generally.
    """
    position_winrate = position_stats["winrate"] if position_stats and position_stats.get("winrate") else None
    rank_meta = hero_meta_at_rank.get(hero_id)
    rank_winrate = rank_meta["winrate"] if rank_meta and rank_meta.get("winrate") else None

    if position_winrate is not None and rank_winrate is not None:
        blended = position_winrate * 0.6 + rank_winrate * 0.4
        return blended * 100, f"{position_winrate*100:.1f}% WR this patch, {rank_winrate*100:.1f}% WR at your rank"
    if position_winrate is not None:
        return position_winrate * 100, f"{position_winrate*100:.1f}% WR this patch ({position_stats.get('matches', 0)} matches)"
    if rank_winrate is not None:
        return rank_winrate * 100, f"{rank_winrate*100:.1f}% WR at your rank"
    return 50.0, None


def calculate_role_based_suggestions(
    ally_picks: list[int],
    enemy_picks: list[int],
    bans: list[int],
    hero_position_meta: dict[int, dict[int, dict]],
    personal_position_stats: dict[int, dict[int, dict]],
    hero_matchups: dict[int, list[dict]],
    hero_meta_at_rank: dict[int, dict] | None = None,
    top_n: int = 6,
) -> dict[str, dict[str, list[dict]]]:
    """
    Args:
        hero_position_meta: {position: {hero_id: {winrate, matches, d2pt_rating}}}
            from HeroPositionMeta (Dota2ProTracker, current patch, 7000+ MMR/pro).
        personal_position_stats: {position: {hero_id: {games, wins}}}
            from the player's own match history (compute_personal_position_stats).
        hero_matchups: {hero_id: [{hero_id, advantage}, ...]} vs enemy heroes,
            from HeroMatchup — hero_id here is the ENEMY being matched against.
        hero_meta_at_rank: {hero_id: {winrate, ...}} from HeroMeta, filtered to
            the player's own rank bracket — optional, used to rank-adjust the
            meta component when available (see _rank_adjusted_meta).

    Returns {role_key: {"meta_best": [...], "your_best": [...], "combined": [...]}}
    for all 5 roles, each list sorted best-first, length up to top_n.
    """
    unavailable = set(ally_picks + enemy_picks + bans)
    hero_meta_at_rank = hero_meta_at_rank or {}
    result = {}

    for position, role_key in ROLE_KEYS.items():
        meta_for_role = hero_position_meta.get(position, {})
        personal_for_role = personal_position_stats.get(position, {})

        # ── meta_best: current-patch winrate at this position, rank-adjusted ──
        meta_best = []
        for hero_id, stats in meta_for_role.items():
            if hero_id in unavailable or not stats.get("winrate"):
                continue
            score, reason = _rank_adjusted_meta(hero_id, stats, hero_meta_at_rank)
            meta_best.append({
                "hero_id": hero_id,
                "hero_name": get_hero_name(hero_id),
                "score": round(score, 1),
                "reason": reason,
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
        # Team composition here is just these two real signals combined —
        # no fabricated synergy term (see module docstring, point 2).
        candidate_ids = set(meta_for_role.keys()) | set(personal_for_role.keys())
        combined = []
        for hero_id in candidate_ids:
            if hero_id in unavailable:
                continue

            meta_component, meta_reason = _rank_adjusted_meta(hero_id, meta_for_role.get(hero_id), hero_meta_at_rank)

            personal_stats = personal_for_role.get(hero_id)
            if personal_stats and personal_stats["games"] >= MIN_PERSONAL_GAMES:
                personal_winrate = personal_stats["wins"] / personal_stats["games"]
                confidence = min(personal_stats["games"] / 20.0, 1.0)
                personal_component = personal_winrate * 100 * confidence + 50 * (1 - confidence)
            else:
                personal_component = 50.0

            matchup_component, matchup_reasons = _matchup_score(hero_id, enemy_picks, hero_matchups)

            score = (
                meta_component * 0.40 +
                personal_component * 0.30 +
                matchup_component * 0.30
            )

            reasons = list(matchup_reasons)
            if personal_stats and personal_stats["games"] >= MIN_PERSONAL_GAMES:
                reasons.append(f"You: {personal_stats['games']} games, {personal_stats['wins']/personal_stats['games']*100:.0f}% WR")
            if meta_reason:
                reasons.append(meta_reason)

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
