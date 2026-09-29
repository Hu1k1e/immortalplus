"""
Meta overview and hero statistics endpoints.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import HeroMeta, HeroMatchup, HeroPositionMeta, UserSettings
from services.opendota import get_opendota_client
from services.sync import sync_hero_meta
from utils.dota_constants import HEROES, get_hero_name, get_hero_image_url, get_hero_icon_url, POSITIONS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/heroes")
async def get_hero_meta(
    bracket: int = Query(None, ge=1, le=8, description="Rank bracket 1-8"),
    session: Session = Depends(get_session),
):
    """Get hero meta stats, optionally filtered by rank bracket."""
    query = select(HeroMeta)
    if bracket:
        query = query.where(HeroMeta.rank_bracket == bracket)

    heroes = session.exec(query).all()

    # If no data, try to sync
    if not heroes:
        settings = session.exec(select(UserSettings).limit(1)).first()
        await sync_hero_meta(session, settings)
        heroes = session.exec(query).all()

    result = []
    for h in heroes:
        hero_data = HEROES.get(h.hero_id, {})
        result.append({
            "hero_id": h.hero_id,
            "hero_name": get_hero_name(h.hero_id),
            "hero_image": get_hero_image_url(h.hero_id),
            "rank_bracket": h.rank_bracket,
            "pick_count": h.pick_count,
            "win_count": h.win_count,
            "ban_count": h.ban_count,
            "winrate": round(h.winrate * 100, 1) if h.winrate else 0,
            "roles": hero_data.get("roles", []),
            "primary_attr": hero_data.get("primary_attr", ""),
            "attack_type": hero_data.get("attack_type", ""),
        })

    # Sort by winrate descending
    result.sort(key=lambda x: x["winrate"], reverse=True)

    # Assign tiers
    for i, hero in enumerate(result):
        total = len(result)
        if i < total * 0.1:
            hero["tier"] = "S"
        elif i < total * 0.25:
            hero["tier"] = "A"
        elif i < total * 0.50:
            hero["tier"] = "B"
        elif i < total * 0.75:
            hero["tier"] = "C"
        else:
            hero["tier"] = "D"

    return result


@router.get("/matchups/{hero_id}")
async def get_matchups(
    hero_id: int,
    session: Session = Depends(get_session),
):
    """Get matchup data for a specific hero."""
    matchups = session.exec(
        select(HeroMatchup).where(HeroMatchup.hero_id == hero_id)
    ).all()

    if not matchups:
        # Fetch from OpenDota directly
        settings = session.exec(select(UserSettings).limit(1)).first()
        client = get_opendota_client(settings.opendota_api_key if settings else None)
        try:
            data = await client.get_hero_matchups(hero_id)
            return [
                {
                    "enemy_hero_id": m["hero_id"],
                    "enemy_hero_name": get_hero_name(m["hero_id"]),
                    "games_played": m.get("games_played", 0),
                    "wins": m.get("wins", 0),
                    "advantage": round(
                        ((m.get("wins", 0) / max(m.get("games_played", 1), 1)) - 0.5) * 100, 1
                    ),
                }
                for m in data
                if m.get("games_played", 0) > 50
            ]
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

    return [
        {
            "enemy_hero_id": m.enemy_hero_id,
            "enemy_hero_name": get_hero_name(m.enemy_hero_id),
            "games_played": m.games_played,
            "wins": m.wins,
            "advantage": m.advantage,
        }
        for m in matchups
    ]


@router.post("/sync")
async def sync_meta(session: Session = Depends(get_session)):
    """Force sync hero meta data from OpenDota."""
    settings = session.exec(select(UserSettings).limit(1)).first()
    await sync_hero_meta(session, settings)
    return {"status": "synced"}


@router.get("/hero-list")
async def get_hero_list():
    """Get full list of all heroes with images."""
    return [
        {
            "hero_id": hid,
            "name": data["localized_name"],
            "image": get_hero_image_url(hid),
            "icon": get_hero_icon_url(hid),
            "primary_attr": data.get("primary_attr", ""),
            "attack_type": data.get("attack_type", ""),
            "roles": data.get("roles", []),
        }
        for hid, data in HEROES.items()
    ]


def _tier_for_rank(rank_in_list: int, total: int) -> str:
    """
    S/A/B/C/D/E tier from percentile rank within the current position's
    list — the same bucketing convention already used by GET /heroes
    above, extended to 6 tiers to match ProTracker's own real tier
    filter buttons (S/A/B/C/D/E, confirmed live on their /meta page).
    This is an approximation of their internal tier algorithm (not
    reverse-engineerable from the API response alone), not a claimed
    exact match; disclosed as such rather than presented as their real
    value.
    """
    if total <= 0:
        return "E"
    pct = rank_in_list / total
    if pct < 0.05:
        return "S"
    if pct < 0.15:
        return "A"
    if pct < 0.40:
        return "B"
    if pct < 0.65:
        return "C"
    if pct < 0.85:
        return "D"
    return "E"


@router.get("/protracker")
async def get_protracker_meta(
    position: int = Query(1, ge=0, le=5, description="0=All Roles, 1-5=Carry/Mid/Offlane/Soft Support/Hard Support"),
    session: Session = Depends(get_session),
):
    """
    Per-hero data behind the Meta page's table — from HeroPositionMeta,
    synced from Dota2ProTracker's own /api/heroes/list endpoint (see
    services/protracker.py's fetch_hero_position_meta). Sorted by
    d2pt_rating (their real displayed 0-100 "D2PT Rating") descending,
    same default sort as their own page. top_heroes is the same list's
    first 7 entries.

    This previously sourced a richer HeroPositionDetail table (lane
    advantage, contest rate, Radiant/Dire and pick-phase splits, from a
    different ProTracker endpoint), but that endpoint proved unreliable
    in production across five different fix attempts — see main.py's
    background_sync_loop for the full story — and was dropped in favor
    of this table, which has never once failed. "All Roles" (position 0)
    has no direct row in HeroPositionMeta (ProTracker's own per-position
    endpoint has no combined view), so it's synthesized here: summed
    matches across positions 1-5 per hero, winrate/rating as a
    matches-weighted average.
    """
    if position == 0:
        all_rows = session.exec(
            select(HeroPositionMeta).where(HeroPositionMeta.position.in_([1, 2, 3, 4, 5]))
        ).all()
        by_hero: dict = {}
        for r in all_rows:
            if not r.matches:
                continue
            d = by_hero.setdefault(r.hero_id, {"matches": 0, "winrate_sum": 0.0, "rating_sum": 0.0, "updated_at": None})
            d["matches"] += r.matches
            d["winrate_sum"] += (r.winrate or 0) * r.matches
            d["rating_sum"] += (r.d2pt_rating or 0) * r.matches
            if r.updated_at and (d["updated_at"] is None or r.updated_at > d["updated_at"]):
                d["updated_at"] = r.updated_at
        rows = [
            {
                "hero_id": hid,
                "matches": d["matches"],
                "winrate": d["winrate_sum"] / d["matches"] if d["matches"] else None,
                "d2pt_rating": d["rating_sum"] / d["matches"] if d["matches"] else None,
                "updated_at": d["updated_at"],
            }
            for hid, d in by_hero.items()
        ]
    else:
        db_rows = session.exec(
            select(HeroPositionMeta).where(HeroPositionMeta.position == position)
        ).all()
        rows = [
            {"hero_id": r.hero_id, "matches": r.matches, "winrate": r.winrate, "d2pt_rating": r.d2pt_rating, "updated_at": r.updated_at}
            for r in db_rows
        ]

    rows = [r for r in rows if r["d2pt_rating"] is not None]
    rows.sort(key=lambda r: r["d2pt_rating"], reverse=True)

    total = len(rows)
    heroes = []
    for i, r in enumerate(rows):
        heroes.append({
            "hero_id": r["hero_id"],
            "hero_name": get_hero_name(r["hero_id"]),
            "hero_icon": get_hero_icon_url(r["hero_id"]),
            "hero_image": get_hero_image_url(r["hero_id"]),
            "matches": r["matches"],
            "winrate": round((r["winrate"] or 0) * 100, 1),
            "meta_score": round(r["d2pt_rating"], 1) if r["d2pt_rating"] is not None else None,
            "tier": _tier_for_rank(i, total),
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        })

    return {
        "position": position,
        "position_name": "All Roles" if position == 0 else POSITIONS.get(position),
        "top_heroes": heroes[:7],
        "heroes": heroes,
        "updated_at": heroes[0]["updated_at"] if heroes else None,
    }
