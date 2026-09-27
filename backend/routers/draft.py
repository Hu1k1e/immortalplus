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
from utils.dota_constants import rank_tier_to_bracket, get_hero_id_by_name

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


def _resolve_hero_id(value) -> int | None:
    """A single GSI pick/ban slot can show up as a numeric hero_id directly,
    or as a real npc class name string (e.g. "npc_dota_hero_antimage") — the
    exact real shape wasn't confirmed against a live game when this was
    first written, so this accepts either rather than assuming one."""
    if value is None:
        return None
    if isinstance(value, int) and value > 0:
        return value
    if isinstance(value, str):
        if value.isdigit():
            iv = int(value)
            return iv if iv > 0 else None
        return get_hero_id_by_name(value)
    return None


def _extract_slots(team_data: dict, prefix: str) -> list[int]:
    """Reads GSI's real flat-field draft shape for one team — numbered
    slots like pick0_id/pick0_class, pick1_id/pick1_class, ... (confirmed
    against the community reference implementation of Dota 2's GSI schema,
    since Valve's own docs don't cover this) — NOT the nested
    {"picks": [{"id": ...}]} array this code originally, incorrectly,
    assumed. Tries "<prefix>N_id" first (if GSI ever sends a numeric id
    directly), falls back to resolving "<prefix>N_class" (the real npc
    name) through the hero name table. Stops at the first completely
    absent slot rather than assuming a fixed count, since pick/ban counts
    differ between game modes.
    """
    out = []
    i = 0
    while True:
        id_key = f"{prefix}{i}_id"
        class_key = f"{prefix}{i}_class"
        if id_key not in team_data and class_key not in team_data:
            break
        hero_id = _resolve_hero_id(team_data.get(id_key)) or _resolve_hero_id(team_data.get(class_key))
        if hero_id:
            out.append(hero_id)
        i += 1
    return out


def update_gsi_draft_state(gsi_data: dict):
    """
    Parse GSI payload and update draft state.
    Called from the GSI router when draft data arrives.

    IMPORTANT — this was never verified against a real live match before
    this pass (the user flagged it as an untested first draft, and that
    was correct: the original version used team2/team3 keys and a nested
    picks[]/bans[] array shape, both wrong against the real GSI schema).
    This version uses team0/team1 and the flat pickN_id/pickN_class,
    banN_id/banN_class shape, matching the real, community-verified GSI
    schema (Valve's own documentation doesn't cover this well). It also
    logs the raw draft block below so the very first real match played
    with this confirms or corrects the remaining assumptions from actual
    evidence — see the logger.info call at the end of this function.
    """
    map_data = gsi_data.get("map", {})
    game_state = map_data.get("game_state", "")

    if game_state in ("DOTA_GAMERULES_STATE_HERO_SELECTION", "DOTA_GAMERULES_STATE_STRATEGY_TIME"):
        _gsi_state["active"] = True
        _gsi_state["phase"] = "pick" if "HERO_SELECTION" in game_state else "strategy"

        draft = gsi_data.get("draft", {})
        # Unconditional, every call during pick/strategy phase — unlike the
        # block below, this fires even when "draft" comes back empty/absent,
        # which is exactly the case that needs diagnosing: the previous
        # version only logged once real pick data was already found, so it
        # went completely silent when the draft block itself was the
        # problem rather than the parsing of it.
        logger.info(
            f"[GSI draft] game_state={game_state} top_level_keys={sorted(gsi_data.keys())} "
            f"draft_present={'draft' in gsi_data} draft_raw={draft!r}"
        )
        if draft:
            # Real GSI team keys are team0/team1, not team2/team3 — fixed.
            # Each side's "home_team" flag (or, defensively, team_name on
            # the player block) is what actually says which one is ours,
            # rather than assuming a fixed team2="dire" mapping.
            player_team_name = gsi_data.get("player", {}).get("team_name")
            team0 = draft.get("team0", {})
            team1 = draft.get("team1", {})
            team0_is_home = team0.get("home_team")

            # "home_team" in GSI corresponds to Radiant. Fall back to the
            # player's own team_name if home_team isn't present for some
            # reason, rather than silently guessing team0.
            if team0_is_home is not None:
                radiant_team, dire_team = (team0, team1) if team0_is_home else (team1, team0)
            elif player_team_name in ("radiant", "dire"):
                radiant_team, dire_team = (team0, team1)
            else:
                radiant_team, dire_team = (team0, team1)

            ally_is_radiant = player_team_name != "dire"
            ally_team_data = radiant_team if ally_is_radiant else dire_team
            enemy_team_data = dire_team if ally_is_radiant else radiant_team

            _gsi_state["ally_picks"] = _extract_slots(ally_team_data, "pick")
            _gsi_state["enemy_picks"] = _extract_slots(enemy_team_data, "pick")
            # Ranked All Pick auto-bans a small number of heroes before
            # picking starts (confirmed real — not a Captains Mode-only
            # thing as first assumed); Captains Mode has player-driven
            # bans on top of that. Both use the same banN_id/banN_class
            # slot shape as picks, read from both sides.
            _gsi_state["bans"] = (
                _extract_slots(ally_team_data, "ban") + _extract_slots(enemy_team_data, "ban")
            )

            logger.info(
                f"[GSI draft] raw team0={team0} team1={team1} player_team={player_team_name} "
                f"-> parsed ally_picks={_gsi_state['ally_picks']} "
                f"enemy_picks={_gsi_state['enemy_picks']} bans={_gsi_state['bans']}"
            )

    elif game_state == "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS":
        _gsi_state["active"] = False
        _gsi_state["phase"] = "playing"
    else:
        _gsi_state["active"] = False
        _gsi_state["phase"] = None

    _gsi_state["game_time"] = map_data.get("clock_time", 0)
