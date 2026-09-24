"""
Player profile and stats endpoints.
"""

import re
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import Player, UserSettings
from services.opendota import get_opendota_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/player", tags=["player"])


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

    if existing:
        existing.persona_name = profile.get("personaname", existing.persona_name)
        existing.avatar_url = profile.get("avatarfull", existing.avatar_url)
        existing.rank_tier = rank_tier or existing.rank_tier
        existing.mmr_estimate = mmr or existing.mmr_estimate
        existing.profile_url = profile.get("profileurl", existing.profile_url)
        existing.last_sync_at = datetime.utcnow()
        session.commit()
        session.refresh(existing)
        player = existing
    else:
        player = Player(
            steam_id=profile.get("steamid", sid),
            account_id=account_id,
            persona_name=profile.get("personaname", ""),
            avatar_url=profile.get("avatarfull", ""),
            rank_tier=rank_tier,
            mmr_estimate=mmr,
            profile_url=profile.get("profileurl", ""),
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
        player.persona_name = profile.get("personaname", player.persona_name)
        player.avatar_url = profile.get("avatarfull", player.avatar_url)
        player.rank_tier = data.get("rank_tier") or player.rank_tier
        player.mmr_estimate = data.get("mmr_estimate", {}).get("estimate") or player.mmr_estimate
        player.last_sync_at = datetime.utcnow()
        session.commit()

        await client.refresh_player(player.account_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"status": "refreshed", "persona_name": player.persona_name}
