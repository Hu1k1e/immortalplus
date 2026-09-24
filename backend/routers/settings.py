"""
Settings CRUD endpoints.
All app configuration lives here — NOT in docker-compose.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import UserSettings, Player

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    steam_account_id: Optional[int] = None
    steam_api_key: Optional[str] = None
    opendota_api_key: Optional[str] = None
    stratz_api_token: Optional[str] = None
    theme: Optional[str] = None
    primary_role: Optional[str] = None
    preferred_heroes: Optional[str] = None
    target_rank: Optional[int] = None
    current_rank: Optional[int] = None
    auto_sync_matches: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None
    auto_parse_replays: Optional[bool] = None
    replay_storage_limit_gb: Optional[int] = None
    analysis_depth: Optional[str] = None
    benchmark_target: Optional[str] = None
    include_turbo: Optional[bool] = None
    include_ability_draft: Optional[bool] = None
    min_hero_games: Optional[int] = None
    gsi_enabled: Optional[bool] = None
    gsi_port: Optional[int] = None
    draft_min_comfort_games: Optional[int] = None
    draft_show_meta_tier: Optional[bool] = None
    draft_priority: Optional[str] = None
    protracker_enabled: Optional[bool] = None
    protracker_interval_hours: Optional[int] = None
    animation_speed: Optional[str] = None
    sidebar_position: Optional[str] = None
    dashboard_layout: Optional[str] = None
    graph_style: Optional[str] = None
    font_size: Optional[str] = None
    log_level: Optional[str] = None
    cache_ttl_hours: Optional[int] = None


@router.get("")
async def get_settings(session: Session = Depends(get_session)):
    """Get current settings."""
    settings = session.exec(select(UserSettings).limit(1)).first()
    player = session.exec(select(Player).limit(1)).first()

    if not settings:
        # Create defaults
        settings = UserSettings(player_id=player.id if player else None)
        session.add(settings)
        session.commit()
        session.refresh(settings)

    return {
        "id": settings.id,
        "steam_account_id": player.account_id if player else None,
        "steam_api_key": settings.steam_api_key or "",
        "opendota_api_key": settings.opendota_api_key or "",
        "stratz_api_token": settings.stratz_api_token or "",
        "theme": settings.theme,
        "primary_role": settings.primary_role,
        "preferred_heroes": settings.preferred_heroes,
        "target_rank": settings.target_rank,
        "current_rank": settings.current_rank,
        "auto_sync_matches": settings.auto_sync_matches,
        "sync_interval_minutes": settings.sync_interval_minutes,
        "auto_parse_replays": settings.auto_parse_replays,
        "replay_storage_limit_gb": settings.replay_storage_limit_gb,
        "analysis_depth": settings.analysis_depth,
        "benchmark_target": settings.benchmark_target,
        "include_turbo": settings.include_turbo,
        "include_ability_draft": settings.include_ability_draft,
        "min_hero_games": settings.min_hero_games,
        "gsi_enabled": settings.gsi_enabled,
        "gsi_port": settings.gsi_port,
        "draft_min_comfort_games": settings.draft_min_comfort_games,
        "draft_show_meta_tier": settings.draft_show_meta_tier,
        "draft_priority": settings.draft_priority,
        "protracker_enabled": settings.protracker_enabled,
        "protracker_interval_hours": settings.protracker_interval_hours,
        "animation_speed": settings.animation_speed,
        "sidebar_position": settings.sidebar_position,
        "dashboard_layout": settings.dashboard_layout,
        "graph_style": settings.graph_style,
        "font_size": settings.font_size,
        "log_level": settings.log_level,
        "cache_ttl_hours": settings.cache_ttl_hours,
    }


@router.put("")
async def update_settings(
    update: SettingsUpdate,
    session: Session = Depends(get_session),
):
    """Update settings. Only non-null fields are updated."""
    player = session.exec(select(Player).limit(1)).first()
    
    # Create or update player if steam_account_id is provided
    if update.steam_account_id is not None:
        if not player:
            player = Player(steam_id=str(update.steam_account_id), account_id=update.steam_account_id)
            session.add(player)
            session.commit()
            session.refresh(player)
        else:
            player.account_id = update.steam_account_id
            player.steam_id = str(update.steam_account_id)
            session.add(player)

    settings = session.exec(select(UserSettings).limit(1)).first()
    if not settings:
        settings = UserSettings(player_id=player.id if player else None)
        session.add(settings)
    elif player and settings.player_id is None:
        settings.player_id = player.id
        session.add(settings)

    update_data = update.model_dump(exclude_unset=True, exclude_none=True)
    
    # Remove steam_account_id from settings update dict as it belongs to Player
    if 'steam_account_id' in update_data:
        del update_data['steam_account_id']

    for key, value in update_data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)

    settings.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(settings)

    logger.info(f"Settings updated: {list(update_data.keys())}")
    return {"status": "updated", "fields": list(update_data.keys())}
