"""
Draft suggestion engine — 5 roles x 3 categories.

Restructured from an earlier single-list version after real user testing
and feedback surfaced three real problems, all fixed here:

1. Suggestions only ever cited a matchup against ONE enemy hero (an
   early `break` in the old loop) instead of the whole enemy draft —
   _matchup_score now averages advantage across every enemy pick.

2. A "synergy" score that was always zero, since it read OpenDota's
   `with_hero_id` field, which OpenDota's matchup API never actually
   populates (confirmed directly) — OpenDota has no real hero-pair
   "plays well together" data. This was fixed in two steps: first by
   dropping the fake number entirely (a brief period where "team
   composition" was just meta + matchup, no synergy term at all), then
   by finding that Stratz's public GraphQL API — the exact one this app
   already has a client and token for — DOES have real pair data
   (heroStats.matchUp[].with, a genuine `synergy` field, confirmed
   directly against Stratz's real schema). synergy_component now uses
   that when available (see services/sync.py's sync_hero_synergy),
   and is neutral (50) for any hero pair without data yet — never faked.

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
  - combined: a blended ranking (rank-adjusted meta + personal comfort +
    enemy matchup + ally synergy), the "best overall suggestion" list
"""

import logging
from utils.dota_constants import HEROES, get_hero_name, POSITIONS

logger = logging.getLogger(__name__)

ROLE_KEYS = {1: "carry", 2: "mid", 3: "offlane", 4: "soft_support", 5: "hard_support"}

# Minimum games before personal stats for a hero are trusted at all —
# below this, a small sample could show a misleading 100% or 0% winrate.
MIN_PERSONAL_GAMES = 3

# Games at which "Your Best"'s volume component maxes out (see below) —
# a hero played this many times or more gets full credit for being a
# real, established part of the player's pool; scales linearly below it.
YOUR_BEST_VOLUME_CAP_GAMES = 25


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


# Same real bug class as MIN_META_MATCHES, applied to per-matchup and
# per-pair-synergy samples too: OpenDota's matchup "advantage" and
# Stratz's pair "synergy" are both computed from a specific two-hero
# sample that can be tiny (a rarely-seen combo might have only 1-5
# recorded games), and a 1-game 100%-or-0% result produces an extreme
# advantage/synergy value that isn't statistically meaningful. Any
# matchup/pair sample below this is treated as "no data" (falls back to
# neutral) rather than trusted at full weight.
MIN_MATCHUP_MATCHES = 20
MIN_SYNERGY_MATCHES = 20


def _matchup_score(hero_id: int, enemy_picks: list[int], hero_matchups: dict[int, list[dict]]) -> tuple[float, list[str], list[dict]]:
    """Average advantage vs EVERY currently-picked enemy hero this app
    has matchup data for (previously stopped at the first match found,
    which meant a suggestion only ever cited one enemy hero even with a
    full 5-hero enemy draft). Returns a 0-100-normalized score, up to 2
    human-readable reasons for the strongest/weakest matchups found, and
    a full per-enemy breakdown (every currently-picked enemy this hero
    has matchup data for, not just the top 2) — the frontend renders
    that breakdown as a hover tooltip (hero icon + colored advantage)
    instead of cramming it into always-visible text."""
    if not enemy_picks:
        return 50.0, [], []

    matchup_data = hero_matchups.get(hero_id, [])
    by_enemy = {
        m.get("hero_id"): m.get("advantage", 0) or 0
        for m in matchup_data
        if (m.get("games_played") or 0) >= MIN_MATCHUP_MATCHES
    }

    advantages = []
    reasons = []
    breakdown = []
    for enemy_id in enemy_picks:
        if enemy_id in by_enemy:
            adv = by_enemy[enemy_id]
            advantages.append(adv)
            breakdown.append({"hero_id": enemy_id, "hero_name": get_hero_name(enemy_id), "value": round(adv, 1)})
            if abs(adv) > 1.0:
                verb = "Good against" if adv > 0 else "Weak against"
                reasons.append(f"{verb} {get_hero_name(enemy_id)} ({adv:+.1f}%)")

    if not advantages:
        return 50.0, [], []

    avg_advantage = sum(advantages) / len(advantages)
    score = 50 + avg_advantage * 5
    reasons.sort(key=lambda r: abs(float(r.rsplit("(", 1)[1].rstrip("%)").replace("+", ""))), reverse=True)
    breakdown.sort(key=lambda b: abs(b["value"]), reverse=True)
    return max(0.0, min(100.0, score)), reasons[:2], breakdown


def _synergy_score(hero_id: int, ally_picks: list[int], hero_synergy: dict[int, list[dict]]) -> tuple[float, list[str], list[dict]]:
    """
    Average REAL synergy vs every currently-picked ally hero, from
    Stratz's heroStats.matchUp[].with data (see services/sync.py's
    sync_hero_synergy) — same shape and same normalization approach as
    _matchup_score's "advantage" handling.

    Scaling verified directly against real production data once a
    working Stratz token was live (this was previously an unverified
    assumption): real synergy values for actual hero pairs came back as
    1.9-3.4-ish (e.g. Anti-Mage paired with Invoker/Lone Druid/Dazzle/
    Enchantress), the same single-digit-to-low-double-digit magnitude as
    OpenDota's matchup `advantage` field — confirming the shared *5
    normalization and 0-100 clamp is the right scale for both, not a
    guess.
    """
    if not ally_picks:
        return 50.0, [], []

    synergy_data = hero_synergy.get(hero_id, [])
    by_ally = {
        s.get("hero_id"): s.get("synergy", 0) or 0
        for s in synergy_data
        if (s.get("matches") or 0) >= MIN_SYNERGY_MATCHES
    }

    values = []
    reasons = []
    breakdown = []
    for ally_id in ally_picks:
        if ally_id in by_ally:
            val = by_ally[ally_id]
            values.append(val)
            breakdown.append({"hero_id": ally_id, "hero_name": get_hero_name(ally_id), "value": round(val, 1)})
            if abs(val) > 1.0:
                verb = "Strong pairing with" if val > 0 else "Weak pairing with"
                reasons.append(f"{verb} {get_hero_name(ally_id)} ({val:+.1f})")

    if not values:
        return 50.0, [], []

    avg_synergy = sum(values) / len(values)
    score = 50 + avg_synergy * 5
    breakdown.sort(key=lambda b: abs(b["value"]), reverse=True)
    return max(0.0, min(100.0, score)), reasons[:2], breakdown


# Minimum real matches at a position before its winrate is trusted for
# ranking at all. Confirmed as a real, live bug (not guessed) by pulling
# ProTracker's own API response directly: Ancient Apparition and Pugna
# both showed "pos 1 matches: 1, pos 1 winrate: 1" (one single Carry game
# — a win) — a real number, correctly scraped, but statistically
# meaningless, and with no floor it sorted to the very top of "Best This
# Patch" ahead of heroes with hundreds or thousands of real matches at
# that position, since a lone 100% winrate blends to a near-maximal
# score. 20 is comfortably above that kind of noise while still well
# below the hundreds-to-thousands of matches a genuinely-played
# position/hero combo has in the real data (e.g. Pugna pos 4: 571
# matches, Jakiro pos 5: 1541).
MIN_META_MATCHES = 20


def _meta_score(position_stats: dict | None) -> tuple[float | None, str | None]:
    """
    ProTracker's own position-specific rating for this hero — no longer
    blended with OpenDota's HeroMeta "winrate at your rank bracket"
    (removed entirely, not just hidden from display, per explicit
    request questioning its relevance: that field is position-agnostic —
    a hero's overall winrate at a rank bracket regardless of which of the
    5 positions it was played at — so mixing it into a POSITION-specific
    suggestion list was pulling every position's score toward the same
    one aggregate number, a real accuracy problem for exactly the same
    reason ProTracker's own data is used per-position in the first place).

    Prefers ProTracker's own d2pt_rating (their site's real "Best This
    Patch" ranking column — confirmed directly against their live /meta
    page, which sorts by this exact number, 0-100, S/A/B/C/D/E-tiered)
    over recomputing a rank from bare winrate ourselves. Falls back to a
    bare winrate*100 only for the hero/position combos ProTracker doesn't
    compute a rating for. Returns (None, None) — not a faked neutral
    value — when there isn't enough real data (see MIN_META_MATCHES);
    callers decide how to treat that absence (meta_best excludes the
    hero entirely, combined/dynamic-meta_best fall back to neutral 50).
    """
    has_enough_matches = position_stats and (position_stats.get("matches") or 0) >= MIN_META_MATCHES
    if not has_enough_matches:
        return None, None
    d2pt_rating = position_stats.get("d2pt_rating")
    if d2pt_rating is not None:
        return d2pt_rating, f"D2PT rating {d2pt_rating:.0f}/100 this patch"
    winrate = position_stats.get("winrate")
    if winrate is not None:
        return winrate * 100, f"{winrate*100:.1f}% WR this patch ({position_stats.get('matches', 0)} matches)"
    return None, None


def calculate_role_based_suggestions(
    ally_picks: list[int],
    enemy_picks: list[int],
    bans: list[int],
    hero_position_meta: dict[int, dict[int, dict]],
    personal_position_stats: dict[int, dict[int, dict]],
    hero_matchups: dict[int, list[dict]],
    hero_synergy: dict[int, list[dict]] | None = None,
    top_n: int = 6,
    combined_limit: int = 200,
) -> dict[str, dict[str, list[dict]]]:
    """
    Args:
        hero_position_meta: {position: {hero_id: {winrate, matches, d2pt_rating}}}
            from HeroPositionMeta (Dota2ProTracker, current patch, 7000+ MMR/pro).
        personal_position_stats: {position: {hero_id: {games, wins}}}
            from the player's own match history (compute_personal_position_stats).
        hero_matchups: {hero_id: [{hero_id, advantage}, ...]} vs enemy heroes,
            from HeroMatchup — hero_id here is the ENEMY being matched against.
        hero_synergy: {hero_id: [{hero_id, synergy}, ...]} vs ally heroes, from
            HeroSynergy (Stratz) — optional, real pair data when present (see
            _synergy_score), neutral when absent (no Stratz token configured).

    Returns {role_key: {"meta_best": [...], "your_best": [...], "combined": [...]}}
    for all 5 roles, each list sorted best-first. meta_best/your_best are
    capped at top_n (summary lists); combined is capped at the much
    higher combined_limit since the frontend's per-position columns are
    meant to be scrolled through, not just show a top handful.

    meta_best and combined are computed together in one pass per hero
    (not two separate loops) since both need the same matchup/synergy
    lookups — meta_best used to be a frozen, patch-only ranking that
    never reacted to the current draft at all, confirmed as a real,
    reported gap ("does not dynamically change to reflect what is good
    this patch + what is good with enemy + our heroes"). It's now
    meta(0.6) + matchup-vs-enemy(0.25) + synergy-with-allies(0.15) — the
    same real per-draft signals `combined` uses, just without the
    personal-comfort term (that's what `your_best`/`combined` are for)
    — so it re-sorts on every pick exactly like `combined` already did.
    """
    unavailable = set(ally_picks + enemy_picks + bans)
    hero_synergy = hero_synergy or {}
    result = {}

    for position, role_key in ROLE_KEYS.items():
        meta_for_role = hero_position_meta.get(position, {})
        personal_for_role = personal_position_stats.get(position, {})

        # ── your_best + meta_best (both draft-reactive) + combined ──────
        # One pass over every candidate hero computes all three lists,
        # since they share the same matchup/synergy lookups. No fabricated
        # numbers — a signal with no data for a given hero just sits at
        # the neutral midpoint (50) instead of pulling the score either way.
        #
        # your_best used to be personal history only, static regardless
        # of the draft — reported directly as a problem right after
        # meta_best got the same fix ("it does not change when new heros
        # are added to the draft"). Its personal component (bare-winrate-
        # ranked was ALSO already fixed separately, see the note below,
        # to blend in games-played) now gets folded in with the same
        # matchup-vs-enemy/synergy-with-allies terms meta_best uses
        # (personal 0.6 / matchup 0.25 / synergy 0.15).
        candidate_ids = set(meta_for_role.keys()) | set(personal_for_role.keys())
        your_best = []
        meta_best = []
        combined = []
        for hero_id in candidate_ids:
            if hero_id in unavailable:
                continue

            meta_score, meta_reason = _meta_score(meta_for_role.get(hero_id))
            meta_component = meta_score if meta_score is not None else 50.0

            personal_stats = personal_for_role.get(hero_id)
            has_personal = personal_stats and personal_stats["games"] >= MIN_PERSONAL_GAMES
            if has_personal:
                personal_winrate = personal_stats["wins"] / personal_stats["games"]
                confidence = min(personal_stats["games"] / 20.0, 1.0)
                # Confidence-weighted winrate alone — a lucky 4-game
                # streak shouldn't look as trustworthy as a real 18-game
                # sample (shrinks toward neutral 50 for a small sample).
                winrate_component = personal_winrate * 100 * confidence + 50 * (1 - confidence)
                # your_best specifically also credits games played on
                # their own terms, not just as a confidence multiplier —
                # direct request: "most played heros + win rate, a
                # combination of both" (previously ranked by bare winrate
                # with games only breaking ties, so a 4-5 game 80% WR
                # hero consistently outranked an 18-game real sample).
                volume_component = min(personal_stats["games"] / YOUR_BEST_VOLUME_CAP_GAMES, 1.0) * 100
                personal_component = winrate_component  # used by combined below
                your_best_personal_blend = winrate_component * 0.6 + volume_component * 0.4
            else:
                personal_component = 50.0
                your_best_personal_blend = None

            matchup_component, matchup_reasons, matchup_breakdown = _matchup_score(hero_id, enemy_picks, hero_matchups)
            synergy_component, synergy_reasons, synergy_breakdown = _synergy_score(hero_id, ally_picks, hero_synergy)

            if has_personal:
                your_best.append({
                    "hero_id": hero_id,
                    "hero_name": get_hero_name(hero_id),
                    "score": round(
                        your_best_personal_blend * 0.6 + matchup_component * 0.25 + synergy_component * 0.15, 1
                    ),
                    "reason": f"{personal_stats['games']} games, {personal_winrate*100:.0f}% WR",
                    "matchup_breakdown": matchup_breakdown,
                    "synergy_breakdown": synergy_breakdown,
                })

            combined_score = (
                meta_component * 0.35 +
                personal_component * 0.25 +
                matchup_component * 0.25 +
                synergy_component * 0.15
            )

            reasons = list(matchup_reasons) + list(synergy_reasons)
            if has_personal:
                reasons.append(f"You: {personal_stats['games']} games, {personal_winrate*100:.0f}% WR")
            if meta_reason:
                reasons.append(meta_reason)

            combined.append({
                "hero_id": hero_id,
                "hero_name": get_hero_name(hero_id),
                "score": round(combined_score, 1),
                "reasons": reasons[:4],
                # Full per-hero breakdown (every currently-picked enemy/ally
                # this hero has real data for, not just the top-2 that make
                # the "reasons" text) — the frontend renders this as a
                # hover tooltip rather than static subtext, and it updates
                # automatically as more heroes get picked since it's
                # recomputed from the current ally_picks/enemy_picks on
                # every /suggest call.
                "matchup_breakdown": matchup_breakdown,
                "synergy_breakdown": synergy_breakdown,
            })

            if meta_score is None:
                # Real matches at this position are too few (or nonexistent)
                # to trust at all — see MIN_META_MATCHES. Excluded from
                # meta_best entirely rather than kept with a score diluted
                # down to the neutral fallback, since a hero essentially
                # never played here doesn't belong in "Best This Patch" no
                # matter how the matchup/synergy terms shake out.
                continue
            meta_best.append({
                "hero_id": hero_id,
                "hero_name": get_hero_name(hero_id),
                "score": round(meta_score * 0.6 + matchup_component * 0.25 + synergy_component * 0.15, 1),
                "reason": meta_reason,
                "matchup_breakdown": matchup_breakdown,
                "synergy_breakdown": synergy_breakdown,
            })

        your_best.sort(key=lambda x: x["score"], reverse=True)
        your_best = your_best[:top_n]
        meta_best.sort(key=lambda x: x["score"], reverse=True)
        meta_best = meta_best[:top_n]
        combined.sort(key=lambda x: x["score"], reverse=True)
        combined = combined[:combined_limit]

        result[role_key] = {
            "position": position,
            "position_name": POSITIONS[position],
            "meta_best": meta_best,
            "your_best": your_best,
            "combined": combined,
        }

    return result
