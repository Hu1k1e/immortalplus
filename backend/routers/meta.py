"""
Meta overview and hero statistics endpoints.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import HeroMeta, HeroMatchup, UserSettings
from services.opendota import get_opendota_client
from services.sync import sync_hero_meta
from utils.dota_constants import HEROES, get_hero_name, get_hero_image_url

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
            "primary_attr": data.get("primary_attr", ""),
            "attack_type": data.get("attack_type", ""),
            "roles": data.get("roles", []),
        }
        for hid, data in HEROES.items()
    ]
