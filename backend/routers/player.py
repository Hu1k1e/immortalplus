"""
Player profile and stats endpoints.
"""

import re
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import Player, UserSettings, Match
from services.opendota import get_opendota_client
from services.player_identity import resolve_persona_avatar
from utils.dota_constants import (
    GAME_MODES, LOBBY_TYPES, POSITIONS,
    get_hero_name, get_hero_icon_url, get_hero_image_url,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/player", tags=["player"])


def _require_player(session: Session) -> Player:
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")
    return player


def _apply_filters(
    matches: list,
    exclude_turbo: bool,
    hero_id: Optional[int],
    position: Optional[int],
    game_mode: Optional[int],
    lobby_type: Optional[int],
    solo_party: Optional[str],
) -> list:
    """Shared filter set for /summary, /trends, /most-played-heroes — the
    same knobs shown in the Profile page's filter bar. Filtering happens
    in-memory over the player's already-fetched match list rather than as
    separate SQL predicates per endpoint, since every one of these
    endpoints needs the full filtered set anyway (for counts, sums, or
    windowed slices) and the per-player match count is small enough
    locally that this is simpler than duplicating query-building four times.
    """
    result = matches
    if exclude_turbo:
        result = [m for m in result if m.game_mode != 23]
    if hero_id:
        result = [m for m in result if m.hero_id == hero_id]
    if position:
        result = [m for m in result if m.position == position]
    if game_mode:
        result = [m for m in result if m.game_mode == game_mode]
    if lobby_type is not None:
        result = [m for m in result if m.lobby_type == lobby_type]
    if solo_party == "solo":
        result = [m for m in result if (m.party_size or 1) <= 1]
    elif solo_party == "party":
        result = [m for m in result if (m.party_size or 1) > 1]
    return result


def _steam_id_to_account_id(steam_id: str) -> int:
    """Convert Steam64 ID to Dota 2 account ID (Steam32)."""
    steam64 = int(steam_id)
    return steam64 - 76561197960265728




@router.post("/setup")
async def setup_player(
    steam_id: str,
    session: Session = Depends(get_session),
):
    """
    Initialize a player profile by Steam ID or account ID.
    Fetches profile data from OpenDota.
    """
    # Determine if it's a Steam64 ID or account ID
    sid = steam_id.strip()
    if len(sid) > 10:
        account_id = _steam_id_to_account_id(sid)
    else:
        account_id = int(sid)

    # Check if player already exists
    existing = session.exec(
        select(Player).where(Player.account_id == account_id)
    ).first()

    # Fetch from OpenDota
    settings = session.exec(select(UserSettings)).first()
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    try:
        data = await client.get_player(account_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenDota API error: {str(e)}")

    profile = data.get("profile", {})
    rank_tier = data.get("rank_tier")
    mmr = data.get("mmr_estimate", {}).get("estimate")
    steamid64 = profile.get("steamid") or sid

    # Stratz is tried first (see resolve_persona_avatar's docstring), with
    # OpenDota's `profile` and then the Steam Web API as fallbacks; an
    # already-stored value (for a re-run of setup on an existing player)
    # is the final fallback so a transient failure this time around
    # doesn't blank out a name/avatar a previous run already found.
    persona_name, avatar_url, profile_url = await resolve_persona_avatar(
        account_id, steamid64, profile, settings,
    )
    persona_name = persona_name or (existing.persona_name if existing else None)
    avatar_url = avatar_url or (existing.avatar_url if existing else None)
    profile_url = profile_url or (existing.profile_url if existing else None)

    if existing:
        existing.persona_name = persona_name
        existing.avatar_url = avatar_url
        existing.rank_tier = rank_tier or existing.rank_tier
        existing.mmr_estimate = mmr or existing.mmr_estimate
        existing.profile_url = profile_url
        existing.last_sync_at = datetime.utcnow()
        session.commit()
        session.refresh(existing)
        player = existing
    else:
        player = Player(
            steam_id=steamid64,
            account_id=account_id,
            persona_name=persona_name or "",
            avatar_url=avatar_url or "",
            rank_tier=rank_tier,
            mmr_estimate=mmr,
            profile_url=profile_url or "",
            last_sync_at=datetime.utcnow(),
        )
        session.add(player)
        session.commit()
        session.refresh(player)

        # Create default settings
        default_settings = UserSettings(player_id=player.id)
        session.add(default_settings)
        session.commit()

    # Trigger refresh on OpenDota
    try:
        await client.refresh_player(account_id)
    except Exception:
        pass  # Non-critical

    return {
        "id": player.id,
        "steam_id": player.steam_id,
        "account_id": player.account_id,
        "persona_name": player.persona_name,
        "avatar_url": player.avatar_url,
        "rank_tier": player.rank_tier,
        "mmr_estimate": player.mmr_estimate,
        "profile_url": player.profile_url,
    }


@router.get("/profile")
async def get_profile(session: Session = Depends(get_session)):
    """Get the current player's profile."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found. Set up first.")

    return {
        "id": player.id,
        "steam_id": player.steam_id,
        "account_id": player.account_id,
        "persona_name": player.persona_name,
        "avatar_url": player.avatar_url,
        "rank_tier": player.rank_tier,
        "mmr_estimate": player.mmr_estimate,
        "profile_url": player.profile_url,
        "last_sync_at": player.last_sync_at,
    }


@router.get("/heroes")
async def get_player_heroes(session: Session = Depends(get_session)):
    """Get per-hero statistics for the player from OpenDota."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player or not player.account_id:
        raise HTTPException(status_code=404, detail="No player profile found")

    settings = session.exec(select(UserSettings)).first()
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    try:
        heroes = await client.get_player_heroes(player.account_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return heroes


@router.get("/totals")
async def get_player_totals(session: Session = Depends(get_session)):
    """Get aggregate stat totals."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player or not player.account_id:
        raise HTTPException(status_code=404, detail="No player profile found")

    settings = session.exec(select(UserSettings)).first()
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    try:
        totals = await client.get_player_totals(player.account_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return totals


@router.get("/wl")
async def get_player_winloss(
    limit: int = 20,
    hero_id: int = None,
    session: Session = Depends(get_session),
):
    """Get win/loss record."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player or not player.account_id:
        raise HTTPException(status_code=404, detail="No player profile found")

    settings = session.exec(select(UserSettings)).first()
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    params = {"limit": limit}
    if hero_id:
        params["hero_id"] = hero_id

    try:
        wl = await client.get_player_wl(player.account_id, **params)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return wl


@router.post("/refresh")
async def refresh_player_data(session: Session = Depends(get_session)):
    """Trigger a full profile refresh from OpenDota."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player or not player.account_id:
        raise HTTPException(status_code=404, detail="No player profile found")

    settings = session.exec(select(UserSettings)).first()
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    # Refresh profile
    try:
        data = await client.get_player(player.account_id)
        profile = data.get("profile", {})

        persona_name, avatar_url, profile_url = await resolve_persona_avatar(
            player.account_id, player.steam_id, profile, settings,
        )
        player.persona_name = persona_name or player.persona_name
        player.avatar_url = avatar_url or player.avatar_url
        player.profile_url = profile_url or player.profile_url
        player.rank_tier = data.get("rank_tier") or player.rank_tier
        player.mmr_estimate = data.get("mmr_estimate", {}).get("estimate") or player.mmr_estimate
        player.last_sync_at = datetime.utcnow()
        session.commit()

        await client.refresh_player(player.account_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"status": "refreshed", "persona_name": player.persona_name}


@router.get("/filter-options")
async def get_filter_options():
    """Static option lists for the Profile page's filter bar."""
    return {
        "game_modes": [{"id": k, "name": v} for k, v in GAME_MODES.items() if k != 0],
        "lobby_types": [{"id": k, "name": v} for k, v in LOBBY_TYPES.items()],
        "positions": [{"id": k, "name": v} for k, v in POSITIONS.items()],
    }


@router.get("/summary")
async def get_player_summary(
    exclude_turbo: bool = False,
    hero_id: Optional[int] = None,
    position: Optional[int] = None,
    game_mode: Optional[int] = None,
    lobby_type: Optional[int] = None,
    solo_party: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Matches played / win rate for the local match history, filtered —
    powers the "N Matches" / "Win Rate" row on the Profile page. Computed
    from our own already-synced Match table (not a fresh OpenDota call)
    since a full backfilled history is already local.
    """
    player = _require_player(session)
    all_matches = session.exec(
        select(Match).where(Match.player_id == player.id).order_by(Match.match_id.desc())
    ).all()
    filtered = _apply_filters(all_matches, exclude_turbo, hero_id, position, game_mode, lobby_type, solo_party)

    total = len(filtered)
    wins = sum(1 for m in filtered if m.result == "win")
    losses = sum(1 for m in filtered if m.result == "loss")

    first_match_at = None
    for m in reversed(filtered):
        if m.played_at:
            first_match_at = m.played_at
            break

    return {
        "matches": total,
        "wins": wins,
        "losses": losses,
        "winrate": round(wins / total * 100, 2) if total else 0,
        "first_match_at": first_match_at.isoformat() if first_match_at else None,
    }


@router.get("/trends")
async def get_player_trends(
    window: int = Query(25, ge=1, le=500),
    exclude_turbo: bool = False,
    hero_id: Optional[int] = None,
    position: Optional[int] = None,
    game_mode: Optional[int] = None,
    lobby_type: Optional[int] = None,
    solo_party: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Powers the Profile page's "Trends" card: a position-breakdown donut
    plus a recency win-rate comparison, over the most recent `window`
    (post-filter) matches. `newer_half_winrate` vs `older_half_winrate`
    is this app's own stand-in for Stratz's "Match Win Rate" +/- delta
    (their exact rolling-average formula isn't public) — a simple split
    of the window in half by recency, not a claimed match to their number.
    """
    player = _require_player(session)
    all_matches = session.exec(
        select(Match).where(Match.player_id == player.id).order_by(Match.match_id.desc())
    ).all()
    filtered = _apply_filters(all_matches, exclude_turbo, hero_id, position, game_mode, lobby_type, solo_party)
    recent = filtered[:window]
    total = len(recent)

    position_counts: dict = {}
    position_wins: dict = {}
    for m in recent:
        if m.position and 1 <= m.position <= 5:
            position_counts[m.position] = position_counts.get(m.position, 0) + 1
            if m.result == "win":
                position_wins[m.position] = position_wins.get(m.position, 0) + 1

    hero_counts: dict = {}
    hero_wins: dict = {}
    hero_positions: dict = {}
    # `recent` is newest-first (ordered by match_id desc), so the first
    # match seen per hero_id during this single pass is that hero's most
    # recent game in the window — used to make the Trends ring's hero
    # icons clickable straight to a real match.
    hero_last_match: dict = {}
    for m in recent:
        hero_counts[m.hero_id] = hero_counts.get(m.hero_id, 0) + 1
        if m.result == "win":
            hero_wins[m.hero_id] = hero_wins.get(m.hero_id, 0) + 1
        if m.position and 1 <= m.position <= 5:
            positions_for_hero = hero_positions.setdefault(m.hero_id, {})
            positions_for_hero[m.position] = positions_for_hero.get(m.position, 0) + 1
        hero_last_match.setdefault(m.hero_id, m.match_id)
    top_heroes = sorted(hero_counts.items(), key=lambda x: -x[1])[:14]

    # "Lane Record" — this app's derived stand-in for Stratz's own
    # (proprietary, undocumented) stat of the same name: win/loss counts
    # split by Safe Lane vs Off Lane (lane_role 1 / 3 — the two lanes with
    # a clear contested "won/lost the lane" framing; Mid and Jungle are
    # excluded as a different shape of matchup).
    safe_wins = sum(1 for m in recent if m.lane_role == 1 and m.result == "win")
    safe_losses = sum(1 for m in recent if m.lane_role == 1 and m.result == "loss")
    off_wins = sum(1 for m in recent if m.lane_role == 3 and m.result == "win")
    off_losses = sum(1 for m in recent if m.lane_role == 3 and m.result == "loss")

    # lobby_type 7 is Ranked (Valve's real enum — 5 is "Team Match", a
    # legacy custom-lobby type, not actual ranked matchmaking, despite
    # LOBBY_TYPES' display label; see services/stratz.py's
    # _STRATZ_LOBBY_TYPE_TO_INT for the source of truth). Everything else
    # (Normal, Practice, Battle Cup, etc.) counts as unranked here.
    unranked_pct = round(sum(1 for m in recent if m.lobby_type != 7) / total * 100, 1) if total else 0

    def _winrate(lst) -> Optional[float]:
        t = len(lst)
        return round(sum(1 for m in lst if m.result == "win") / t * 100, 1) if t else None

    half = total // 2
    newer_half = recent[:half]
    older_half = recent[half:half * 2]

    wins = sum(1 for m in recent if m.result == "win")

    return {
        "window": window,
        "total": total,
        "winrate": round(wins / total * 100, 1) if total else 0,
        "newer_half_winrate": _winrate(newer_half),
        "older_half_winrate": _winrate(older_half),
        "party_pct": round(sum(1 for m in recent if (m.party_size or 1) > 1) / total * 100, 1) if total else 0,
        "unranked_pct": unranked_pct,
        "lane_record": {"safe_wins": safe_wins, "safe_losses": safe_losses, "off_wins": off_wins, "off_losses": off_losses},
        "position_breakdown": [
            {
                "position": p, "position_name": POSITIONS.get(p), "count": c,
                "wins": position_wins.get(p, 0),
                "winrate": round(position_wins.get(p, 0) / c * 100, 1) if c else 0,
            }
            for p, c in sorted(position_counts.items())
        ],
        "positionless_count": total - sum(position_counts.values()),
        "strip": [
            {"match_id": m.match_id, "result": m.result, "hero_id": m.hero_id, "hero_icon": get_hero_icon_url(m.hero_id)}
            for m in reversed(recent)
        ],
        "top_heroes": [
            {
                "hero_id": h, "hero_name": get_hero_name(h), "hero_icon": get_hero_icon_url(h),
                "count": c, "wins": hero_wins.get(h, 0),
                "winrate": round(hero_wins.get(h, 0) / c * 100, 1) if c else 0,
                "match_id": hero_last_match.get(h),
                "positions": [
                    {"position": p, "position_name": POSITIONS.get(p), "count": pc}
                    for p, pc in sorted(hero_positions.get(h, {}).items(), key=lambda x: -x[1])
                ],
            }
            for h, c in top_heroes
        ],
    }


@router.get("/most-played-heroes")
async def get_most_played_heroes(
    limit: int = Query(5, ge=1, le=25),
    exclude_turbo: bool = False,
    hero_id: Optional[int] = None,
    position: Optional[int] = None,
    game_mode: Optional[int] = None,
    lobby_type: Optional[int] = None,
    solo_party: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Most-played heroes ranked by games played (not bare win rate — the
    same games-weighted philosophy already used by the draft engine's
    "Your Best" ranking, see backend/services/draft_engine.py), with each
    hero's most common position and a "these N heroes comprise X% of your
    picks" share, matching the Profile page's "Most Played Heroes" card.
    """
    player = _require_player(session)
    all_matches = session.exec(
        select(Match).where(Match.player_id == player.id).order_by(Match.match_id.desc())
    ).all()
    filtered = _apply_filters(all_matches, exclude_turbo, hero_id, position, game_mode, lobby_type, solo_party)
    total = len(filtered)

    by_hero: dict = {}
    for m in filtered:
        d = by_hero.setdefault(m.hero_id, {"matches": 0, "wins": 0, "positions": {}})
        d["matches"] += 1
        if m.result == "win":
            d["wins"] += 1
        if m.position:
            d["positions"][m.position] = d["positions"].get(m.position, 0) + 1

    rows = []
    for hid, d in by_hero.items():
        top_pos = max(d["positions"].items(), key=lambda x: x[1])[0] if d["positions"] else None
        rows.append({
            "hero_id": hid,
            "hero_name": get_hero_name(hid),
            "hero_icon": get_hero_icon_url(hid),
            "hero_image": get_hero_image_url(hid),
            "matches": d["matches"],
            "wins": d["wins"],
            "winrate": round(d["wins"] / d["matches"] * 100, 1) if d["matches"] else 0,
            "position": top_pos,
            "position_name": POSITIONS.get(top_pos) if top_pos else None,
        })
    rows.sort(key=lambda r: r["matches"], reverse=True)
    top = rows[:limit]
    pick_share = round(sum(r["matches"] for r in top) / total * 100, 1) if total else 0

    return {"heroes": top, "pick_share_pct": pick_share, "total_matches": total}
