"""
Draft helper endpoints.
Uses GSI data + cached meta to suggest hero picks during draft phase.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import Player, UserSettings, HeroMatchup, HeroMeta
from services.draft_engine import calculate_draft_suggestions
from services.opendota import get_opendota_client
from utils.dota_constants import rank_tier_to_bracket

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/draft", tags=["draft"])

# In-memory GSI state (updated by GSI webhook)
_gsi_state = {
    "active": False,
    "phase": None,       # "strategy", "ban", "pick", "playing"
    "ally_picks": [],
    "enemy_picks": [],
    "bans": [],
    "game_time": 0,
}

# Connected WebSocket clients for live draft updates
_ws_clients: list[WebSocket] = []


@router.post("/suggest")
async def suggest_picks(
    ally_picks: list[int] = [],
    enemy_picks: list[int] = [],
    bans: list[int] = [],
    session: Session = Depends(get_session),
):
    """
    Get hero pick suggestions based on current draft state.
    Uses only publicly visible picks + cached meta data.
    """
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    settings = session.exec(select(UserSettings).limit(1)).first()

    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    # Get player's hero pool
    client = get_opendota_client(settings.opendota_api_key if settings else None)
    try:
        player_heroes = await client.get_player_heroes(player.account_id)
    except Exception:
        player_heroes = []

    # Get hero matchup data from DB
    hero_matchups = {}
    matchups = session.exec(select(HeroMatchup)).all()
    for mu in matchups:
        if mu.hero_id not in hero_matchups:
            hero_matchups[mu.hero_id] = []
        hero_matchups[mu.hero_id].append({
            "hero_id": mu.enemy_hero_id,
            "games_played": mu.games_played,
            "wins": mu.wins,
            "advantage": mu.advantage or 0,
        })

    # If no local matchup data, fetch from OpenDota for enemy heroes
    if not hero_matchups and enemy_picks:
        try:
            for enemy_id in enemy_picks:
                data = await client.get_hero_matchups(enemy_id)
                for m in data:
                    hid = m.get("hero_id")
                    if hid not in hero_matchups:
                        hero_matchups[hid] = []
                    games = m.get("games_played", 0)
                    wins = m.get("wins", 0)
                    hero_matchups[hid].append({
                        "hero_id": enemy_id,
                        "games_played": games,
                        "wins": games - wins,  # Invert: these are enemy stats
                        "advantage": ((wins / max(games, 1)) - 0.5) * -100,
                    })
        except Exception as e:
            logger.warning(f"Failed to fetch matchups: {e}")

    # Get hero meta from DB
    bracket = rank_tier_to_bracket(player.rank_tier or 0)
    hero_meta = {}
    metas = session.exec(
        select(HeroMeta).where(HeroMeta.rank_bracket == bracket)
    ).all()
    for m in metas:
        hero_meta[m.hero_id] = {
            "winrate": m.winrate or 0.5,
            "pickrate": (m.pick_count or 0) / max(sum(mm.pick_count or 0 for mm in metas), 1),
        }

    suggestions = calculate_draft_suggestions(
        ally_picks=ally_picks,
        enemy_picks=enemy_picks,
        bans=bans,
        player_hero_stats=player_heroes,
        hero_matchups=hero_matchups,
        hero_meta=hero_meta,
        rank_bracket=bracket,
        min_comfort_games=settings.draft_min_comfort_games if settings else 10,
        priority=settings.draft_priority if settings else "balanced",
    )

    return {
        "suggestions": suggestions,
        "ally_picks": ally_picks,
        "enemy_picks": enemy_picks,
        "bans": bans,
        "bracket": bracket,
        "priority": settings.draft_priority if settings else "balanced",
    }


@router.get("/state")
async def get_draft_state():
    """Get current GSI draft state."""
    return _gsi_state


@router.websocket("/ws")
async def draft_websocket(ws: WebSocket):
    """WebSocket for real-time draft updates from GSI."""
    await ws.accept()
    _ws_clients.append(ws)
    try:
        while True:
            # Keep connection alive, send state on change
            data = await ws.receive_text()
            # Client can send manual pick updates
            try:
                msg = json.loads(data)
                if msg.get("type") == "update_picks":
                    _gsi_state["ally_picks"] = msg.get("ally_picks", [])
                    _gsi_state["enemy_picks"] = msg.get("enemy_picks", [])
                    _gsi_state["bans"] = msg.get("bans", [])
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        _ws_clients.remove(ws)


async def broadcast_draft_update(state: dict):
    """Broadcast draft state to all connected WebSocket clients."""
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_json(state)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.remove(ws)


def update_gsi_draft_state(gsi_data: dict):
    """
    Parse GSI payload and update draft state.
    Called from the GSI router when draft data arrives.
    """
    map_data = gsi_data.get("map", {})
    game_state = map_data.get("game_state", "")

    if game_state in ("DOTA_GAMERULES_STATE_HERO_SELECTION", "DOTA_GAMERULES_STATE_STRATEGY_TIME"):
        _gsi_state["active"] = True
        _gsi_state["phase"] = "pick" if "HERO_SELECTION" in game_state else "strategy"

        # Extract draft picks from GSI
        draft = gsi_data.get("draft", {})
        if draft:
            ally_team = "team2" if gsi_data.get("player", {}).get("team_name") == "dire" else "team3"
            enemy_team = "team3" if ally_team == "team2" else "team2"

            _gsi_state["ally_picks"] = [
                p.get("id") for p in draft.get(ally_team, {}).get("picks", [])
                if p.get("id", 0) > 0
            ]
            _gsi_state["enemy_picks"] = [
                p.get("id") for p in draft.get(enemy_team, {}).get("picks", [])
                if p.get("id", 0) > 0
            ]
            _gsi_state["bans"] = [
                b.get("id") for team_key in [ally_team, enemy_team]
                for b in draft.get(team_key, {}).get("bans", [])
                if b.get("id", 0) > 0
            ]

    elif game_state == "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS":
        _gsi_state["active"] = False
        _gsi_state["phase"] = "playing"
    else:
        _gsi_state["active"] = False
        _gsi_state["phase"] = None

    _gsi_state["game_time"] = map_data.get("clock_time", 0)
